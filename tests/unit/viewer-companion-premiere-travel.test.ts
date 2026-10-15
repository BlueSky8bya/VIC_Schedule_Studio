import { describe, expect, it } from "vitest";
import { sampleCompanionPremiereTravel } from "@/lib/ui/viewer-companion/premiere-travel";

describe("companion premiere display travel", () => {
  const from = { x: 140, y: 400, scale: 1 }, to = { x: 600, y: 250, scale: .12 };
  it("ends precisely at the cached actual card without changing either endpoint", () => {
    const a = { ...from }, b = { ...to };
    expect(sampleCompanionPremiereTravel(from, to, 0, 92)).toEqual({ ...from, opacity: 1 });
    const end = sampleCompanionPremiereTravel(from, to, 1, 92);
    expect(end.x).toBe(to.x); expect(end.y).toBe(to.y); expect(end.scale).toBeCloseTo(to.scale); expect(end.opacity).toBe(0);
    expect(from).toEqual(a); expect(to).toEqual(b);
  });
  it("bounds the lift by the scaled top margin throughout a return", () => {
    const start = { x: 300, y: 26, scale: .12 }, end = { x: 500, y: 110, scale: 1 };
    for (let n = 0; n <= 120; n++) {
      const point = sampleCompanionPremiereTravel(start, end, n / 120, 92, true);
      expect(point.y - point.scale * 92).toBeGreaterThanOrEqual(4 - 1e-8);
    }
    expect(sampleCompanionPremiereTravel(start, end, 0, 92, true).opacity).toBe(0);
    expect(sampleCompanionPremiereTravel(start, end, 1, 92, true).opacity).toBe(1);
  });
  it("has distinct middle poses and clamps a corrected clock to its endpoints", () => {
    expect(sampleCompanionPremiereTravel(from, to, -.5, 92)).toEqual(sampleCompanionPremiereTravel(from, to, 0, 92));
    expect(sampleCompanionPremiereTravel(from, to, 2, 92)).toEqual(sampleCompanionPremiereTravel(from, to, 1, 92));
    const middle = sampleCompanionPremiereTravel(from, to, .5, 92);
    expect(middle.x).toBeGreaterThan(from.x); expect(middle.x).toBeLessThan(to.x);
    expect(middle.scale).toBeGreaterThan(to.scale); expect(middle.scale).toBeLessThan(from.scale);
  });
  it("takes off at its actual size, arcs visibly, then folds into the card without crossing the ceiling", () => {
    expect(sampleCompanionPremiereTravel(from, to, .35, 92).scale).toBe(1);
    const middle = sampleCompanionPremiereTravel(from, to, .5, 92);
    expect((from.y + to.y) / 2 - middle.y).toBeGreaterThan(70);
    for (let index = 0; index <= 120; index++) {
      const point = sampleCompanionPremiereTravel({ x: 90, y: 110, scale: 1 }, { x: 160, y: 26, scale: .12 }, index / 120, 92);
      expect(point.y - point.scale * 92).toBeGreaterThanOrEqual(4 - 1e-8);
    }
  });
});
