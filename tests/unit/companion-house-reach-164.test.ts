import { describe, expect, it } from "vitest";
import { COMPANION_JUMP_LIMITS } from "@/lib/ui/viewer-companion/brain";
import { sampleCompanionHomeReach } from "@/lib/ui/viewer-companion/home-interaction";

describe("164 proportional physical house control reach", () => {
  it("reaches the observed expanded-room cord without raising ordinary jump limits", () => {
    const before = COMPANION_JUMP_LIMITS.maxRise;
    const pose = { hand: { x: 385.56, y: 463.27 }, contact: { x: 385.56, y: 256.47 }, footY: 501.27, ceiling: 121, size: 92, jump: true };
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
      const input = { hand: { x: 250, y: footY - size * .42 }, contact, footY, ceiling, size, jump: true, progress: .5 };
      const reach = sampleCompanionHomeReach(input)!;
      expect(reach.touching).toBe(true);
      expect(reach.lift).toBeGreaterThan(0);
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
    const pose = { hand: { x: 200, y: 450 }, contact: { x: 200, y: 150 }, footY: 490, ceiling: 100, size: 92, jump: true, progress: .5 };
    expect(sampleCompanionHomeReach(pose)?.touching).toBe(false);
    expect(sampleCompanionHomeReach({ ...pose, footY: NaN })).toBeUndefined();
    expect(sampleCompanionHomeReach({ ...pose, size: 0 })).toBeUndefined();
    expect(sampleCompanionHomeReach({ ...pose, progress: Infinity })).toBeUndefined();
  });
});
