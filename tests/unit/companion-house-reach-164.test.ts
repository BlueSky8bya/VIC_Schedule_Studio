import { describe, expect, it } from "vitest";
import { COMPANION_JUMP_LIMITS } from "@/lib/ui/viewer-companion/brain";
import { companionHomeCordTouches, sampleCompanionHomeReach } from "@/lib/ui/viewer-companion/home-interaction";

describe("164 proportional physical house control reach", () => {
  it("reaches the observed expanded-room cord without raising ordinary jump limits", () => {
    const before = COMPANION_JUMP_LIMITS.maxRise;
    const pose = { hand: { x: 385.56, y: 463.27 }, contact: { x: 385.56, y: 256.47 }, footY: 501.27, ceiling: 121, size: 92, jump: true, cord: true };
    const sample = sampleCompanionHomeReach({ ...pose, progress: .5 })!;
    expect(sample.touching).toBe(true);
    expect(sample.lift).toBeGreaterThan(140);
    expect(sample.lift).toBeLessThan(pose.footY - pose.ceiling - pose.size * .72);
    expect(COMPANION_JUMP_LIMITS.maxRise).toBe(before);
    for (const progress of [0, 1]) expect(sampleCompanionHomeReach({ ...pose, progress })?.lift).toBe(0);
  });
  it("retains finite physical contact, ceiling and jumping-OFF constraints across room scales", () => {
    let count = 0;
    for (let height = 240; height <= 600; height += 10) for (const ceiling of [20, 121, 300]) for (const size of [76, 92]) {
      const footY = ceiling + height - 6, contact = { x: 250, y: ceiling + height * .35 };
      const input = { hand: { x: 250, y: footY - size * .42 }, contact, footY, ceiling, size, jump: true, progress: .5, cord: true };
      const reach = sampleCompanionHomeReach(input)!;
      expect(reach.touching).toBe(true);
      expect(reach.lift).toBeGreaterThan(0);
      expect(Math.hypot(reach.from.x - contact.x, reach.from.y - contact.y)).toBeLessThan(.001);
      expect(footY - reach.lift - size * .72).toBeGreaterThanOrEqual(ceiling);
      expect(Math.hypot(reach.from.x - contact.x, reach.from.y - contact.y)).toBeLessThanOrEqual(size * .48);
      expect(sampleCompanionHomeReach({ ...input, contact: { ...contact, x: 400 } })?.touching).toBe(false);
      expect(sampleCompanionHomeReach({ ...input, jump: false })?.touching).toBe(false);
      expect(sampleCompanionHomeReach({ ...input, ceiling: footY - 10 })?.touching).toBe(false);
      count++;
    }
    expect(count).toBe(222);
  });
  it("does not invent contact with invalid or physically unreachable handles", () => {
    const pose = { hand: { x: 200, y: 450 }, contact: { x: 200, y: 90 }, footY: 490, ceiling: 100, size: 92, jump: true, progress: .5, cord: true };
    expect(sampleCompanionHomeReach(pose)?.touching).toBe(false);
    expect(sampleCompanionHomeReach({ ...pose, footY: NaN })).toBeUndefined();
    expect(sampleCompanionHomeReach({ ...pose, size: 0 })).toBeUndefined();
    expect(sampleCompanionHomeReach({ ...pose, progress: Infinity })).toBeUndefined();
  });
  it("never acknowledges the old18px gap or a horizontally missed cord", () => {
    const pose = { hand: { x: 200, y: 450 }, contact: { x: 200, y: 250 }, footY: 490, ceiling: 100, size: 92, jump: true, progress: .5, cord: true };
    expect(sampleCompanionHomeReach(pose)?.from).toEqual(pose.contact);
    expect(sampleCompanionHomeReach({ ...pose, contact: { x: 218.4, y: 250 } })?.touching).toBe(false);
    expect(sampleCompanionHomeReach({ ...pose, progress: .1 })?.touching).toBe(false);
  });
  it("preserves the existing chest/tool contact for other furniture", () => {
    const pose = { hand: { x: 200, y: 300 }, contact: { x: 200, y: 275 }, footY: 340, ceiling: 100, size: 92, jump: false, progress: .5 };
    expect(sampleCompanionHomeReach({ ...pose, cord: false })?.touching).toBe(true);
    expect(sampleCompanionHomeReach(pose)?.touching).toBe(true);
    expect(sampleCompanionHomeReach({ ...pose, cord: true })?.touching).toBe(false);
  });
  it("uses the measured knob edge and opaque patch, never the old body-width gap", () => {
    const knob = { x: 200, y: 250, width: 4.4, height: 7.2 };
    expect(companionHomeCordTouches({ x: 202.15, y: 251.5 }, knob, 92)).toBe(true);
    expect(companionHomeCordTouches({ x: 200, y: 268.4 }, knob, 92)).toBe(false);
    expect(companionHomeCordTouches({ x: 205, y: 250 }, knob, 92)).toBe(false);
    expect(companionHomeCordTouches({ x: 200, y: 250 }, { ...knob, width: NaN }, 92)).toBe(false);
  });
});
