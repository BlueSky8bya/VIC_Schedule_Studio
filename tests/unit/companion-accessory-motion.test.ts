import { describe, expect, it } from "vitest";
import { COMPANION_ACCESSORY_IDS } from "@/lib/ui/viewer-companion/gifts";
import { canStartCompanionAccessoryMotion, COMPANION_ACCESSORY_MOTION_MS, isCompanionHat, sampleCompanionAccessoryMotion } from "@/lib/ui/viewer-companion/accessory-motion";
import { projectCompanionSpritePoint } from "@/lib/ui/viewer-companion/sofa-pose";
import { COMPANION_ACCESSORIES, currentCompanionAccessory } from "@/lib/ui/viewer-companion/accessory-catalog";

describe("finite equipped accessory gestures", () => {
  it("returns exactly to the registered rest transform, without a lingering or negative-time gesture", () => {
    for (const id of COMPANION_ACCESSORY_IDS) {
      for (const age of [-100, 0, COMPANION_ACCESSORY_MOTION_MS, COMPANION_ACCESSORY_MOTION_MS * 100]) {
        const pose = sampleCompanionAccessoryMotion(id, age);
        expect(pose.bodyLift).toBe(0); expect(pose.bodyLean).toBe(0); expect(pose.squash).toBe(0);
        expect(pose.accessory).toMatchObject({ lift: 0, shift: 0, roll: 0, scale: 1 });
        if (id === "propeller-hat") expect(pose.accessory.rotor).toBe(0);
        if (id === "magic-pocket") expect(pose.accessory.aperture).toBe(0);
      }
      expect(sampleCompanionAccessoryMotion(id, COMPANION_ACCESSORY_MOTION_MS).done).toBe(true);
      for (let age = 0; age <= COMPANION_ACCESSORY_MOTION_MS; age += 25) {
        const pose = sampleCompanionAccessoryMotion(id, age);
        expect([pose.frame, pose.bodyLift, pose.bodyLean, pose.squash, ...Object.values(pose.accessory)].every(Number.isFinite)).toBe(true);
        expect(pose.bodyLift).toBeGreaterThanOrEqual(0); expect(pose.bodyLift).toBeLessThanOrEqual(id === "propeller-hat" ? 45 : 26);
      }
    }
  });
  it("gives hats a26px parabolic hop and a separate floating ornament followed by landing", () => {
    for (const id of COMPANION_ACCESSORY_IDS.filter(id => isCompanionHat(id) && id !== "propeller-hat")) {
      const at = (p: number) => sampleCompanionAccessoryMotion(id, p * COMPANION_ACCESSORY_MOTION_MS);
      expect(at(.39).bodyLift).toBeCloseTo(26, 8); expect(at(.3).bodyLift).toBeCloseTo(at(.48).bodyLift, 8);
      expect(at(.6).bodyLift).toBe(0); expect(at(.6).accessory.lift).toBeGreaterThan(0);
      expect(at(.65).row).toBe(6); expect(at(.9).bodyLift).toBe(0); expect(at(.9).accessory.lift).toBe(0);
    }
  });
  it("shares source body rows by mounting family and rejects unsafe supports or low ceilings", () => {
    // New simple ornaments reuse the authored body; their item transforms may
    // vary without manufacturing another character pose for each keepsake.
    for (const id of COMPANION_ACCESSORY_IDS) for (const phase of [.2, .35, .5, .65]) {
      const motion = sampleCompanionAccessoryMotion(id, phase * COMPANION_ACCESSORY_MOTION_MS);
      if (id === "propeller-hat") expect(motion.row).toBe(phase < .45 ? 4 : 5);
      else if (id === "magic-pocket") expect(motion.row).toBe(phase > .2 && phase < .75 ? 1 : 9);
      else expect(motion.row).toBe(isCompanionHat(id) ? phase < .6 ? 4 : 6 : 9);
      expect(motion.accessory.scale).toBeGreaterThanOrEqual(1);
      if (COMPANION_ACCESSORIES[currentCompanionAccessory(id)].family !== "head") expect(motion.bodyLift).toBe(0);
    }
    const safe = { id: "beret" as const, roam: true, stable: true, safe: true, headroom: 160, edgeClearance: 60, energy: .8 };
    expect(canStartCompanionAccessoryMotion(safe)).toBe(true);
    for (const patch of [{ roam: false }, { stable: false }, { safe: false }, { headroom: 149 }, { edgeClearance: 47 }, { energy: .24 }, { headroom: NaN }]) expect(canStartCompanionAccessoryMotion({ ...safe, ...patch })).toBe(false);
    expect(canStartCompanionAccessoryMotion({ ...safe, id: "sunglasses", headroom: 120 })).toBe(true);
    expect(canStartCompanionAccessoryMotion({ ...safe, id: "propeller-hat", headroom: 174 })).toBe(false);
    expect(canStartCompanionAccessoryMotion({ ...safe, id: "propeller-hat", headroom: 175 })).toBe(true);
  });
  it("uses a finite hovering arc and a visibly opened pocket only during their special beats", () => {
    const prop = (phase: number) => sampleCompanionAccessoryMotion("propeller-hat", phase * COMPANION_ACCESSORY_MOTION_MS);
    expect(prop(.45).bodyLift).toBeCloseTo(45); expect(prop(.3).bodyLift).toBeCloseTo(prop(.6).bodyLift);
    expect(prop(.3).row).toBe(4); expect(prop(.6).row).toBe(5); expect(prop(.8).row).toBe(6); expect(prop(1).row).toBe(9);
    expect(prop(.7).accessory.rotor).toBeGreaterThan(2500);
    const pocket = (phase: number) => sampleCompanionAccessoryMotion("magic-pocket", phase * COMPANION_ACCESSORY_MOTION_MS);
    expect(pocket(.19).accessory.aperture).toBe(0); expect(pocket(.475).accessory.aperture).toBeCloseTo(1); expect(pocket(.76).accessory.aperture).toBe(0);
  });
  it("keeps the registered foot projection and pickup point on the same visible hop in both facings", () => {
    for (const facing of [-1, 1] as const) for (const phase of [.18, .3, .39, .48, .6]) {
      const motion = sampleCompanionAccessoryMotion("beret", phase * COMPANION_ACCESSORY_MOTION_MS), cell = { x: -3, y: 2, clip: [0, 0, 0, 0] };
      const foot = projectCompanionSpritePoint({ size: 92, display: { x: 500, y: 600, scale: 1 }, cell, shape: { bob: -motion.bodyLift, tilt: motion.bodyLean, scaleX: 1 + motion.squash * .5, scaleY: 1 - motion.squash }, pressure: { x: 0, y: 0, tilt: 0, squash: 0 }, response: { lift: 0, squash: 0 }, facing, sway: { tilt: 0, stretch: 0 } }, { x: 40 - cell.x, y: 80 - cell.y });
      expect(foot!.x).toBeCloseTo(500, 3); expect(foot!.y).toBeCloseTo(600 - motion.bodyLift, 3);
    }
  });
});
