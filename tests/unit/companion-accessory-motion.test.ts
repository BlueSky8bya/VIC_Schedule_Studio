import { describe, expect, it } from "vitest";
import { COMPANION_ACCESSORY_IDS } from "@/lib/ui/viewer-companion/gifts";
import { canStartCompanionAccessoryMotion, COMPANION_ACCESSORY_MOTION_MS, isCompanionHat, sampleCompanionAccessoryMotion } from "@/lib/ui/viewer-companion/accessory-motion";
import { projectCompanionSpritePoint } from "@/lib/ui/viewer-companion/sofa-pose";

describe("finite equipped accessory gestures", () => {
  it("returns exactly to the registered rest transform, without a lingering or negative-time gesture", () => {
    for (const id of COMPANION_ACCESSORY_IDS) {
      for (const age of [-100, 0, COMPANION_ACCESSORY_MOTION_MS, COMPANION_ACCESSORY_MOTION_MS * 100]) {
        const pose = sampleCompanionAccessoryMotion(id, age);
        expect(pose.bodyLift).toBe(0); expect(pose.bodyLean).toBe(0); expect(pose.squash).toBe(0);
        expect(pose.accessory).toEqual({ lift: 0, shift: 0, roll: 0, scale: 1 });
      }
      expect(sampleCompanionAccessoryMotion(id, COMPANION_ACCESSORY_MOTION_MS).done).toBe(true);
      for (let age = 0; age <= COMPANION_ACCESSORY_MOTION_MS; age += 25) {
        const pose = sampleCompanionAccessoryMotion(id, age);
        expect([pose.frame, pose.bodyLift, pose.bodyLean, pose.squash, ...Object.values(pose.accessory)].every(Number.isFinite)).toBe(true);
        expect(pose.bodyLift).toBeGreaterThanOrEqual(0); expect(pose.bodyLift).toBeLessThanOrEqual(26);
      }
    }
  });
  it("gives hats a26px parabolic hop and a separate floating ornament followed by landing", () => {
    for (const id of COMPANION_ACCESSORY_IDS.filter(isCompanionHat)) {
      const at = (p: number) => sampleCompanionAccessoryMotion(id, p * COMPANION_ACCESSORY_MOTION_MS);
      expect(at(.39).bodyLift).toBeCloseTo(26, 8); expect(at(.3).bodyLift).toBeCloseTo(at(.48).bodyLift, 8);
      expect(at(.6).bodyLift).toBe(0); expect(at(.6).accessory.lift).toBeGreaterThan(0);
      expect(at(.65).row).toBe(6); expect(at(.9).bodyLift).toBe(0); expect(at(.9).accessory.lift).toBe(0);
    }
  });
  it("distinguishes all twelve prop gestures and rejects unsafe supports or low ceilings", () => {
    const traces = COMPANION_ACCESSORY_IDS.map(id => JSON.stringify([.2, .35, .5, .65].map(p => sampleCompanionAccessoryMotion(id, p * COMPANION_ACCESSORY_MOTION_MS))));
    expect(new Set(traces).size).toBe(12);
    const safe = { id: "beret" as const, roam: true, stable: true, safe: true, headroom: 160, edgeClearance: 60, energy: .8 };
    expect(canStartCompanionAccessoryMotion(safe)).toBe(true);
    for (const patch of [{ roam: false }, { stable: false }, { safe: false }, { headroom: 149 }, { edgeClearance: 47 }, { energy: .24 }, { headroom: NaN }]) expect(canStartCompanionAccessoryMotion({ ...safe, ...patch })).toBe(false);
    expect(canStartCompanionAccessoryMotion({ ...safe, id: "sunglasses", headroom: 120 })).toBe(true);
  });
  it("keeps the registered foot projection and pickup point on the same visible hop in both facings", () => {
    for (const facing of [-1, 1] as const) for (const phase of [.18, .3, .39, .48, .6]) {
      const motion = sampleCompanionAccessoryMotion("beret", phase * COMPANION_ACCESSORY_MOTION_MS), cell = { x: -3, y: 2, clip: [0, 0, 0, 0] };
      const foot = projectCompanionSpritePoint({ size: 92, display: { x: 500, y: 600, scale: 1 }, cell, shape: { bob: -motion.bodyLift, tilt: motion.bodyLean, scaleX: 1 + motion.squash * .5, scaleY: 1 - motion.squash }, pressure: { x: 0, y: 0, tilt: 0, squash: 0 }, response: { lift: 0, squash: 0 }, facing, sway: { tilt: 0, stretch: 0 } }, { x: 40 - cell.x, y: 80 - cell.y });
      expect(foot!.x).toBeCloseTo(500, 3); expect(foot!.y).toBeCloseTo(600 - motion.bodyLift, 3);
    }
  });
});
