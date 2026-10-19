import { describe, expect, it } from "vitest";
import { companionToyBoxClose, companionToyReturnDelivered, companionToyReturnTarget, planCompanionToyBoxApproach, sampleCompanionToyReturn, validCompanionToyBoxApproach } from "@/lib/ui/viewer-companion/toy-return";
import { COMPANION_JUMP_LIMITS, platformLandingX, type Platform } from "@/lib/ui/viewer-companion/brain";

describe("126 current native toy-return opening", () => {
  it("follows the current opening instead of a body-relative reflow offset", () => {
    const old = companionToyReturnTarget({ left: 309, top: 352, width: 26, height: 4 })!;
    const current = companionToyReturnTarget({ left: 260.5, top: 389.375, width: 26, height: 4 })!;
    // Real carry-resize failure: the former body-relative aim missed by22.561px.
    expect(companionToyReturnDelivered({ x: 250.939, y: 393.375 }, current)).toBe(false);
    const from = { x: 197.243, y: 370 };
    expect(sampleCompanionToyReturn(from, old, 0)).toEqual(from);
    for (const p of [.28, .5, 1]) {
      const painted = sampleCompanionToyReturn(from, current, p);
      expect(painted.x).toBe(273.5); expect(painted.y).toBeCloseTo(393.375, 10);
      expect(companionToyReturnDelivered(painted, current)).toBe(true);
    }
    // A second independent box move consumes the new sample, not a replayed clock.
    const moved = { x: current.x + 47, y: current.y - 18 };
    expect(sampleCompanionToyReturn({ x: from.x - 20, y: from.y + 9 }, moved, .7)).toEqual(moved);
  });
  it("keeps the authored lift and strict last-painted20px ACK", () => {
    const from = { x: 100, y: 500 }, to = { x: 200, y: 400 };
    expect(sampleCompanionToyReturn(from, to, .14)).toEqual({ x: 150, y: 432 });
    expect(companionToyReturnDelivered({ x: 180, y: 400 }, to)).toBe(false);
    expect(companionToyReturnDelivered({ x: 180.01, y: 400 }, to)).toBe(true);
    expect(companionToyReturnDelivered(undefined, to)).toBe(false);
    expect(companionToyReturnDelivered({ x: NaN, y: 400 }, to)).toBe(false);
    expect(companionToyReturnDelivered(to, undefined)).toBe(false);
  });
  it("rejects disconnected or hidden source samples and empty native openings", () => {
    const rect = { left: 100, top: 200, width: 26, height: 4 };
    expect(companionToyReturnTarget(rect, false)).toBeUndefined();
    for (const bad of [{ ...rect, width: 0 }, { ...rect, height: -1 }, { ...rect, top: Infinity }]) expect(companionToyReturnTarget(bad)).toBeUndefined();
    expect(companionToyReturnTarget(rect)).toEqual({ x: 113, y: 204 });
  });
});

describe("128 bounded final grounded box approach", () => {
  const floor: Platform = { id: "companion-home-floor", kind: "floor", manualOnly: true, x: 50, y: 491.859375, width: 89.8525 };
  const box = { left: 225.8125, top: 380, width: 111.59375, height: 51 };
  const from = { x: 127.8525, y: floor.y, platformId: floor.id };

  it("walks the observed5.96px shortfall within the actual body-safe span without changing landing or close bounds", () => {
    const ordinaryLanding = platformLandingX(floor, box.left + box.width / 2);
    expect(ordinaryLanding).toBeCloseTo(from.x, 8);
    expect(companionToyBoxClose(from, box, 92)).toBe(false);
    const step = planCompanionToyBoxApproach(from, floor, box, 92)!;
    expect(step.kind).toBe("walk");
    if (step.kind !== "walk") throw new Error("Expected a real final walk");
    expect(step.target.x).toBeCloseTo(134.8125, 8);
    expect(step.target.x - from.x).toBeCloseTo(6.96, 8);
    expect(step.target.y).toBe(floor.y); expect(step.target.platformId).toBe(floor.id);
    expect(companionToyBoxClose(step.target, box, 92)).toBe(true);
    // Every future point is on this same safe interval; the registered body
    // stays beyond the feeder's original3px protection throughout the walk.
    for (let i = 0; i <= 20; i++) {
      const x = from.x + (step.target.x - from.x) * i / 20;
      expect(x).toBeGreaterThanOrEqual(floor.x); expect(x).toBeLessThanOrEqual(floor.x + floor.width);
      expect(177.8125 - (x + 92 * .76 / 2)).toBeGreaterThanOrEqual(3);
    }
    expect(COMPANION_JUMP_LIMITS.landingInset).toBe(12);
    expect(platformLandingX(floor, box.left + box.width / 2)).toBe(ordinaryLanding);
    // Continuing the original sniff at this endpoint is ready. It must not
    // replan the generic landing and walk back to the starting point.
    expect(planCompanionToyBoxApproach(step.target, floor, box, 92)).toEqual({ kind: "ready" });
  });

  it("keeps an already close offer unchanged and handles the opposite approach symmetrically", () => {
    expect(planCompanionToyBoxApproach({ ...from, x: 135 }, floor, box, 92)).toEqual({ kind: "ready" });
    const rightFloor: Platform = { ...floor, x: 340, width: 120 }, rightBox = { ...box, left: 200, width: 100 };
    const step = planCompanionToyBoxApproach({ ...from, x: 400 }, rightFloor, rightBox, 92)!;
    expect(step).toEqual({ kind: "walk", target: { x: 391, y: floor.y, platformId: floor.id } });
    expect(companionToyBoxClose({ ...from, x: 392 }, rightBox, 92)).toBe(true);
    expect(companionToyBoxClose({ ...from, x: 392.001 }, rightBox, 92)).toBe(false);
  });

  it("rejects unsupported, non-home, non-body and disconnected or cancelled offers", () => {
    for (const support of [undefined, { ...floor, id: "date-1" }, { ...floor, kind: "card" as const }, { ...floor, manualOnly: false }, { ...floor, width: 0 }])
      expect(planCompanionToyBoxApproach(from, support, box, 92)).toBeUndefined();
    for (const point of [{ ...from, platformId: "companion-home-floor-1" }, { ...from, y: floor.y + 2.01 }, { ...from, x: floor.x - .01 }, { ...from, x: NaN }])
      expect(planCompanionToyBoxApproach(point, floor, box, 92)).toBeUndefined();
    expect(planCompanionToyBoxApproach(from, floor, box, 92, false)).toBeUndefined();
  });

  it("does not cross a gap, walk a new route or relax an invalid box gate", () => {
    expect(planCompanionToyBoxApproach(from, { ...floor, width: 80 }, box, 92)).toBeUndefined();
    expect(planCompanionToyBoxApproach(from, { ...floor, width: 350 }, { ...box, left: 300 }, 92)).toBeUndefined();
    for (const rect of [{ ...box, width: 0 }, { ...box, height: -1 }, { ...box, left: Infinity }, { ...box, top: floor.y - box.height - 140.01 }])
      expect(planCompanionToyBoxApproach(from, floor, rect, 92)).toBeUndefined();
    expect(planCompanionToyBoxApproach(from, floor, box, 0)).toBeUndefined();
  });

  it("revalidates the same finite walk after translation or resize and cancels a lost intersection", () => {
    const step = planCompanionToyBoxApproach(from, floor, box, 92)!;
    if (step.kind !== "walk") throw new Error("Expected a real final walk");
    expect(validCompanionToyBoxApproach(from, step.target, floor, box, 92)).toBe(true);
    const movedFloor = { ...floor, x: floor.x + 80, y: floor.y + 30 }, movedBox = { ...box, left: box.left + 80, top: box.top + 30 };
    const movedFrom = { ...from, x: from.x + 80, y: from.y + 30 }, movedTarget = { ...step.target, x: step.target.x + 80, y: step.target.y + 30 };
    expect(validCompanionToyBoxApproach(movedFrom, movedTarget, movedFloor, movedBox, 92)).toBe(true);
    expect(validCompanionToyBoxApproach(movedFrom, step.target, movedFloor, movedBox, 92)).toBe(false);
    expect(validCompanionToyBoxApproach(from, step.target, { ...floor, width: 84 }, box, 92)).toBe(false);
    expect(validCompanionToyBoxApproach(from, step.target, floor, { ...box, left: box.left + 10 }, 92)).toBe(false);
    expect(validCompanionToyBoxApproach(from, { ...step.target, platformId: "companion-home-floor-1" }, floor, box, 92)).toBe(false);
    expect(validCompanionToyBoxApproach(from, step.target, floor, box, 92, false)).toBe(false);
    expect(validCompanionToyBoxApproach(from, step.target, undefined, box, 92)).toBe(false);
  });
});
