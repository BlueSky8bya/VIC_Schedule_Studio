import { describe, expect, it } from "vitest";
import { calendarPassage, passage, REGION_WINDOWS } from "@/lib/ui/premiere/choreography";

describe("continuous public premiere choreography", () => {
  it("orders every panel region and finishes them before the screen handover", () => {
    for (const [start, end] of Object.values(REGION_WINDOWS)) {
      expect(start).toBeGreaterThan(end);
      expect(end).toBeGreaterThan(68);
      expect(passage(start, start, end)).toBe(0);
      expect(passage(end, start, end)).toBe(1);
      expect(passage((start + end) / 2, start, end)).toBeCloseTo(.5);
    }
  });
  it("is continuous, bounded and reversible after postponement/dismissal", () => {
    expect(passage(140, 154, 138)).toBeGreaterThan(.9);
    expect(passage(165, 154, 138)).toBe(0);
    expect(passage(Infinity, 154, 138)).toBe(0);
    expect(passage(-5, 154, 138)).toBe(1);
    expect(Math.abs(passage(145, 154, 138) - passage(144.99, 154, 138))).toBeLessThan(.002);
  });
  it("de-emphasizes other days before departure and sweeps from the outside inward", () => {
    expect(calendarPassage(135, 0)).toEqual({ dim: 0, leave: 0 });
    const far = calendarPassage(100, 8), near = calendarPassage(100, 0);
    expect(far.dim).toBeGreaterThan(near.dim);
    expect(far.leave).toBe(0); expect(near.leave).toBe(0);
    expect(calendarPassage(76, 8).leave).toBeGreaterThan(calendarPassage(76, 0).leave);
    expect(calendarPassage(68, 0)).toEqual({ dim: 1, leave: 1 });
  });
});
