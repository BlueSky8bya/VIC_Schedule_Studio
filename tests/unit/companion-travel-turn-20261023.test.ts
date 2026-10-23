import { describe, expect, it } from "vitest";
import { createCompanionMotion, type CompanionMotionInput } from "@/lib/ui/viewer-companion/motion";

const input = (patch: Partial<CompanionMotionInput> = {}): CompanionMotionInput => ({ row: 2, phase: 0, status: "walk", x: 100, y: 500, now: 0, ...patch });
const create = () => createCompanionMotion({ rowCount: 40 });

describe("finite autonomous body turn anticipation", () => {
  it("starts before world displacement, leads with a local lean, and keeps the eye/accessory facing plane full width", () => {
    const motion = create();
    motion.sample(input({ travelDirection: 1 }));
    const first = motion.sample(input({ now: 100, travelDirection: -1 }));
    const lead = motion.sample(input({ now: 128, travelDirection: -1 }));
    const turned = motion.sample(input({ now: 170, travelDirection: -1 }));
    const settled = motion.sample(input({ now: 240, travelDirection: -1 }));
    expect(first).toMatchObject({ facing: 1, turn: { direction: -1, phase: 0 } });
    expect(lead.facing).toBe(1); expect(lead.tilt).toBeLessThan(-1); expect(lead.turn!.phase).toBeCloseTo(.2);
    expect(turned.facing).toBe(-1); expect(settled.facing).toBe(-1); expect(settled.turn).toBeUndefined();
    expect(settled).toMatchObject({ scaleX: 1, scaleY: 1, tilt: 0 });
    for (const pose of [first, lead, turned, settled]) {
      expect([-1, 1]).toContain(pose.facing); expect(pose.scaleX * pose.scaleY).toBeCloseTo(1, 5);
      expect(pose.scaleY).toBeGreaterThan(.97); expect(Math.abs(pose.tilt)).toBeLessThanOrEqual(3);
    }
  });

  it("does not restart the finite turn on every frame or when the next jump clip begins", () => {
    const motion = create(); motion.sample(input());
    motion.sample(input({ now: 100, travelDirection: -1 }));
    expect(motion.sample(input({ row: 3, status: "jump", now: 170, travelDirection: -1 })).turn!.phase).toBe(.5);
    expect(motion.sample(input({ row: 4, status: "jump", now: 240, travelDirection: -1 })).turn).toBeUndefined();
    expect(motion.sample(input({ row: 5, status: "jump", now: 270, travelDirection: -1 })).turn).toBeUndefined();
  });

  it("does not apply the same anticipation twice when the walk clip becomes jump preparation", () => {
    const continuous = create(), jumping = create();
    for (const motion of [continuous, jumping]) {
      motion.sample(input()); motion.sample(input({ now: 100, travelDirection: -1 }));
      motion.sample(input({ now: 128, travelDirection: -1 }));
    }
    const reference = continuous.sample(input({ now: 129, travelDirection: -1 }));
    const changed = jumping.sample(input({ row: 3, status: "jump", now: 129, travelDirection: -1 }));
    expect(changed.tilt).toBeCloseTo(reference.tilt, 5);
    expect(changed.scaleY).toBeCloseTo(reference.scaleY, 5);
    expect(changed.turn).toEqual(reference.turn);
  });

  it.each([30, 60, 120])("keeps one bounded envelope across every jump stage at%sHz", fps => {
    const continuous = create(), jumping = create();
    for (const motion of [continuous, jumping]) { motion.sample(input()); motion.sample(input({ now: 100, travelDirection: -1 })); }
    for (let step = 1; step <= Math.ceil(fps * .2); step++) {
      const now = 100 + step * 1000 / fps, row = 3 + step % 4;
      const reference = continuous.sample(input({ now, travelDirection: -1 }));
      const changed = jumping.sample(input({ row, status: "jump", now, travelDirection: -1 }));
      expect(changed.tilt).toBeCloseTo(reference.tilt, 5);
      expect(changed.scaleY).toBeCloseTo(reference.scaleY, 5);
      expect(Math.abs(changed.tilt)).toBeLessThanOrEqual(3);
      expect(changed.scaleY).toBeGreaterThanOrEqual(.975);
      if (now >= 240) expect(changed.turn).toBeUndefined();
    }
  });

  it.each([30, 60, 120])("uses elapsed time consistently at%sHz and leaves the caller's actual positions unchanged", fps => {
    const motion = create(); motion.sample(input()); let pose;
    for (let step = 0; step <= fps / 5; step++) {
      const now = step * 1000 / fps, worldX = 100 - 20 * now / 200;
      const frame = input({ now, x: worldX, travelDirection: -1 });
      const before = { ...frame }; pose = motion.sample(frame);
      expect(frame).toEqual(before); expect([-1, 1]).toContain(pose.facing);
      expect(Math.abs(pose.tilt)).toBeLessThan(6); expect(pose.scaleX * pose.scaleY).toBeCloseTo(1, 5);
    }
    expect(pose!.facing).toBe(-1); expect(pose!.turn).toBeUndefined();
  });

  it.each(["held", "play", "sleep", "look", "idle"])("ignores a travel heading in%s instead of taking over its existing owner", status => {
    const baseline = create(), cue = create();
    for (const now of [0, 28, 70, 140, 200]) {
      const frame = input({ row: status === "held" ? 8 : 0, status, now });
      expect(cue.sample({ ...frame, travelDirection: -1 })).toEqual(baseline.sample(frame));
    }
  });

  it("preserves reduced/OFF neutrality and cancels the cue on a real captured or stationary interruption", () => {
    for (const reduced of [true, false]) {
      const motion = create(); motion.sample(input());
      motion.sample(input({ now: 100, travelDirection: -1 }));
      const frame = motion.sample(input({ row: 8, status: "held", now: 128, reduced, travelDirection: -1 }));
      expect(frame.turn).toBeUndefined();
      if (reduced) expect(frame).toMatchObject({ bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
    }
    const quiet = create();
    expect(quiet.sample(input({ reduced: true, travelDirection: -1 })).turn).toBeUndefined();
  });

  it("keeps a legacy caller's actual displacement-facing behavior when no autonomous heading is offered", () => {
    const motion = create(); motion.sample(input());
    const moved = motion.sample(input({ x: 99, now: 16 }));
    expect(moved.facing).toBe(-1); expect(moved.turn).toBeUndefined();
    expect(motion.sample(input({ row: 8, status: "held", x: 140, now: 32 })).facing).toBe(-1);
  });
});
