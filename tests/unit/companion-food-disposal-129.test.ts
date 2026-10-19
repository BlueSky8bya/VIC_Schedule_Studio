import { describe, expect, it } from "vitest";
import { companionFoodDisposalDelivered, companionFoodDisposalTarget, sampleCompanionFoodDisposal } from "@/lib/ui/viewer-companion/food-disposal";

describe("129 physical food delivery to the current bin", () => {
  it("reaches the actual opening before acknowledging a distant carried snack", () => {
    const from = { x: 150, y: 450 }, rect = { left: 272.609375, top: 434.875, width: 59.390625, height: 57.59375 };
    const target = companionFoodDisposalTarget(rect)!;
    expect(target.x).toBe(302.3046875); expect(target.y).toBeCloseTo(455.0328125, 8);
    expect(sampleCompanionFoodDisposal(from, target, 0)).toEqual(from);
    expect(companionFoodDisposalDelivered(from, target)).toBe(false);
    const midpoint = sampleCompanionFoodDisposal(from, target, .3);
    expect(midpoint.x).toBeCloseTo((from.x + target.x) / 2, 8);
    expect(midpoint.y).toBeLessThan(Math.min(from.y, target.y));
    for (const p of [.6, .8, 1]) {
      const painted = sampleCompanionFoodDisposal(from, target, p);
      expect(painted).toEqual(target); expect(companionFoodDisposalDelivered(painted, target)).toBe(true);
    }
  });
  it("uses the new source after resize and keeps the strict painted20px boundary", () => {
    const from = { x: 150, y: 450 }, before = companionFoodDisposalTarget({ left: 300, top: 400, width: 53, height: 51 })!;
    const current = companionFoodDisposalTarget({ left: 272, top: 435, width: 59, height: 58 })!;
    expect(companionFoodDisposalDelivered(before, current)).toBe(false);
    expect(sampleCompanionFoodDisposal(from, current, .6)).toEqual(current);
    expect(companionFoodDisposalDelivered({ x: current.x - 20, y: current.y }, current)).toBe(false);
    expect(companionFoodDisposalDelivered({ x: current.x - 19.99, y: current.y }, current)).toBe(true);
    expect(companionFoodDisposalDelivered(undefined, current)).toBe(false);
  });
  it("rejects hidden, removed and invalid native targets", () => {
    const rect = { left: 272, top: 435, width: 59, height: 58 };
    expect(companionFoodDisposalTarget(rect, false)).toBeUndefined();
    for (const bad of [{ ...rect, width: 0 }, { ...rect, height: -1 }, { ...rect, top: NaN }]) expect(companionFoodDisposalTarget(bad)).toBeUndefined();
  });
});
