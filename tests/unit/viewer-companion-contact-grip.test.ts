import { describe, expect, it } from "vitest";
import { companionGripProfile } from "@/lib/ui/viewer-companion/contact-grip";
import { createCompanionHeldInertia } from "@/lib/ui/viewer-companion/held-inertia";
import { createCompanionMotion, type CompanionMotionInput } from "@/lib/ui/viewer-companion/motion";

const left = { x: .26, y: .18 }, right = { x: .74, y: .18 }, body = { x: .5, y: .6 };
const input = (now: number, grip = body, patch: Partial<CompanionMotionInput> = {}): CompanionMotionInput => ({ row: 8, phase: 0, status: "held", x: 190, y: 380, now, grip, ...patch });

describe("physical grip material", () => {
  it("distinguishes both ears and torso while keeping mirrored gravity symmetric", () => {
    const l = companionGripProfile(left), r = companionGripProfile(right), b = companionGripProfile(body);
    expect(l.kind).toBe("left-ear"); expect(r.kind).toBe("right-ear"); expect(b.kind).toBe("body");
    expect(l.extension).toBeCloseTo(r.extension, 12); expect(l.lean).toBeCloseTo(-r.lean, 12);
    expect(l.extension).toBeGreaterThan(b.extension); expect(b.lean).toBe(0);
    expect(companionGripProfile({ x: .5, y: .95 }).extension).toBeLessThan(b.extension);
  });

  it("bounds invalid contacts and keeps response continuous across part labels", () => {
    expect(companionGripProfile({ x: NaN, y: .1 })).toEqual(companionGripProfile());
    expect(companionGripProfile({ x: -4, y: 3 })).toEqual(companionGripProfile({ x: 0, y: 1 }));
    for (const y of [.35, .44, .72, .78]) {
      const before = companionGripProfile({ x: .3, y: y - 1e-6 }), after = companionGripProfile({ x: .3, y: y + 1e-6 });
      for (const key of ["extension", "width", "lean", "phase", "impulse", "side"] as const) expect(Math.abs(before[key] - after[key])).toBeLessThan(.001);
    }
  });

  it("keeps actual anatomy and contact unchanged while producing distinct hanging silhouettes", () => {
    const samples = [left, right, body].map(grip => {
      const motion = createCompanionMotion({ loopRows: [8] });
      motion.sample(input(0, grip));
      return Array.from({ length: 121 }, (_, i) => motion.sample(input(200 + i * 1000 / 120, grip)));
    });
    const mean = (items: typeof samples[number], key: "scaleY" | "tilt") => items.reduce((sum, pose) => sum + pose[key], 0) / items.length;
    expect(mean(samples[0], "scaleY")).toBeGreaterThan(mean(samples[2], "scaleY") + .04);
    expect(mean(samples[0], "tilt")).toBeGreaterThan(4); expect(mean(samples[1], "tilt")).toBeLessThan(-4);
    for (const items of samples) expect(items.every(p => p.row === 8 && p.facing === 1 && p.bob === 0 && p.scaleY > 1)).toBe(true);
    for (const items of samples) for (const pose of items) expect(pose.scaleX * pose.scaleY).toBeCloseTo(1, 5);
    expect(samples[0].some((p, i) => p.column !== samples[1][i].column)).toBe(true);
  });

  it("conjugates off-centre rest lean through facing and releases continuously", () => {
    const motion = createCompanionMotion({ loopRows: [8] });
    motion.sample({ ...input(0), row: 2, status: "walk", x: 220 });
    motion.sample({ ...input(100), row: 2, status: "walk", x: 210 });
    motion.sample(input(200, left));
    const held = motion.sample(input(500, left));
    expect(held.facing).toBe(-1);
    const released = motion.sample(input(500, left, { row: 0, status: "idle" }));
    expect(released.scaleX).toBe(held.scaleX); expect(released.scaleY).toBe(held.scaleY); expect(released.tilt).toBe(held.tilt);
    expect(motion.sample(input(610, left, { row: 0, status: "idle" }))).toMatchObject({ bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
    expect(motion.sample(input(800, right, { reduced: true }))).toMatchObject({ bob: 0, scaleX: 1, scaleY: 1, tilt: 0 });
  });

  it("couples upward ear tugs in opposite directions and keeps the centre uncoupled", () => {
    const sample = (grip: typeof body) => { const spring = createCompanionHeldInertia(); spring.push(0, -36, 0, grip); return spring.sample(70); };
    expect(sample(left).tilt).toBeGreaterThan(.5); expect(sample(right).tilt).toBeLessThan(-.5); expect(sample(body).tilt).toBe(0);
    expect(sample(left).stretch).toBeGreaterThan(sample(body).stretch);
    const spring = createCompanionHeldInertia(); spring.push(25, -20, 0, left); const before = spring.sample(110);
    spring.push(-25, 20, 110, right); expect(spring.sample(110)).toEqual(before);
    expect(spring.sample(1610)).toEqual({ tilt: 0, stretch: 0, active: false });
  });

  it("leaves the body behind an upward or downward hand at either ear", () => {
    for (const grip of [left, right]) for (const dy of [-36, 36]) {
      const motion = createCompanionHeldInertia(); motion.push(0, dy, 0, grip);
      const pose = motion.sample(70), angle = pose.tilt * Math.PI / 180;
      // Independent world-space body point after material scale and rotation.
      // Compare its vertical displacement with the point before the hand tug.
      const rx = (.5 - grip.x) * 92, ry = (.83 - grip.y) * 92;
      const sy = 1 + pose.stretch, bodyDeltaY = rx / sy * Math.sin(angle) + ry * sy * Math.cos(angle) - ry;
      expect(Math.sign(bodyDeltaY)).toBe(-Math.sign(dy));
    }
  });
});
