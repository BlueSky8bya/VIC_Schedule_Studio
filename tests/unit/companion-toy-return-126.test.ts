import { describe, expect, it } from "vitest";
import { companionToyReturnDelivered, companionToyReturnTarget, sampleCompanionToyReturn } from "@/lib/ui/viewer-companion/toy-return";

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
