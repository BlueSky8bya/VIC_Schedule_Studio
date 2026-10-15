import { describe, expect, it } from "vitest";
import { boundCompanionBallisticArc, boundCompanionSineArc } from "@/lib/ui/viewer-companion/jump-arc";

const y = (from: number, to: number, coefficient: number, p: number) => from + (to - from) * p - coefficient * p * (1 - p);
const ease = (p: number) => p * p * p * (p * (p * 6 - 15) + 10);

describe("companion viewport-aware jump lift", () => {
  it("preserves an unconstrained flight's coefficient, endpoints and apex", () => {
    const arc = boundCompanionBallisticArc(500, 500, 560, 100);
    expect(arc).toEqual({ coefficient: 560, apexProgress: .5 });
    expect(y(500, 500, arc.coefficient, 0)).toBe(500);
    expect(y(500, 500, arc.coefficient, 1)).toBe(500);
    expect(y(500, 500, arc.coefficient, arc.apexProgress)).toBe(360);
  });

  it("keeps the formerly hidden same-height top flight at the safe ceiling", () => {
    expect(y(180, 180, 560, .5)).toBe(40); //92px sprite previously hidden below100.
    const arc = boundCompanionBallisticArc(180, 180, 560, 100);
    expect(arc.coefficient).toBeCloseTo(320, 5);
    expect(arc.apexProgress).toBe(.5);
    expect(y(180, 180, arc.coefficient, .5)).toBeCloseTo(100, 6);
    // One smooth parabola, rather than clamping a whole apex interval flat.
    expect(y(180, 180, arc.coefficient, .49)).toBeGreaterThan(100);
    expect(y(180, 180, arc.coefficient, .51)).toBeGreaterThan(100);
  });

  it("retains useful lift and the later apex on a rising transfer", () => {
    const arc = boundCompanionBallisticArc(230, 110, 560, 100);
    expect(arc.coefficient).toBeGreaterThan(120);
    expect(arc.apexProgress).toBeGreaterThan(.5);
    expect(arc.apexProgress).toBeLessThan(1);
    expect(y(230, 110, arc.coefficient, arc.apexProgress)).toBeCloseTo(100, 6);
    expect(y(230, 110, arc.coefficient, 1)).toBe(110);
  });

  it("mirrors the rising flight for a downward transfer", () => {
    const up = boundCompanionBallisticArc(230, 110, 560, 100);
    const down = boundCompanionBallisticArc(110, 230, 560, 100);
    expect(down.coefficient).toBe(up.coefficient);
    expect(down.apexProgress).toBeCloseTo(1 - up.apexProgress, 12);
    expect(y(110, 230, down.coefficient, down.apexProgress)).toBeCloseTo(100, 6);
  });

  it("handles ceiling endpoints and a zero-lift flight without division by zero", () => {
    expect(boundCompanionBallisticArc(100, 100, 560, 100)).toEqual({ coefficient: 0, apexProgress: 0 });
    expect(boundCompanionBallisticArc(100, 220, 560, 100).coefficient).toBeCloseTo(120, 10);
    expect(boundCompanionBallisticArc(100, 220, 560, 100).apexProgress).toBe(0);
    expect(boundCompanionBallisticArc(220, 100, 560, 100).apexProgress).toBe(1);
    expect(boundCompanionBallisticArc(220, 100, 0, 100)).toEqual({ coefficient: 0, apexProgress: 1 });
  });

  it("bounds the whole trajectory across asymmetric endpoint and impulse budgets", () => {
    for (const from of [100, 100.001, 110, 180, 340, 900]) for (const to of [100, 100.001, 140, 260, 700]) for (const requested of [0, 40, 176, 560, 1500]) {
      const arc = boundCompanionBallisticArc(from, to, requested, 100);
      expect(arc.coefficient).toBeGreaterThanOrEqual(0); expect(arc.coefficient).toBeLessThanOrEqual(requested);
      expect(arc.apexProgress).toBeGreaterThanOrEqual(0); expect(arc.apexProgress).toBeLessThanOrEqual(1);
      for (let step = 0; step <= 120; step++) expect(y(from, to, arc.coefficient, step / 120)).toBeGreaterThanOrEqual(100);
      expect(y(from, to, arc.coefficient, arc.apexProgress)).toBeGreaterThanOrEqual(100);
      expect(y(from, to, arc.coefficient, 0)).toBeCloseTo(from, 12); expect(y(from, to, arc.coefficient, 1)).toBeCloseTo(to, 12);
    }
  });

  it("leaves real out-of-viewport anchors outside instead of inventing a safe endpoint", () => {
    for (const [from, to] of [[99, 180], [180, 99], [20, 40]]) {
      expect(boundCompanionBallisticArc(from, to, 560, 100).coefficient).toBe(560);
      expect(boundCompanionSineArc(from, to, 60, 100)).toBe(60);
    }
  });

  it("caps home and gentle-settle sine lift independently of their monotone baseline easing", () => {
    for (const [from, to, requested] of [[130, 150, 60], [104, 180, 10], [600, 700, 60], [100, 100, 10]]) {
      const amplitude = boundCompanionSineArc(from, to, requested, 100);
      expect(amplitude).toBeGreaterThanOrEqual(0); expect(amplitude).toBeLessThanOrEqual(requested);
      for (let step = 0; step <= 120; step++) {
        const p = step / 120;
        expect(from + (to - from) * ease(p) - Math.sin(p * Math.PI) * amplitude).toBeGreaterThanOrEqual(100 - 1e-9);
      }
    }
    expect(boundCompanionSineArc(130, 150, 60, 100)).toBe(30);
    expect(boundCompanionSineArc(104, 180, 10, 100)).toBe(4);
    expect(boundCompanionSineArc(600, 700, 60, 100)).toBe(60);
  });

  it("rejects invalid lift and coordinates without returning a nonfinite pose budget", () => {
    for (const invalid of [NaN, Infinity, -Infinity, -4]) {
      expect(boundCompanionBallisticArc(180, 220, invalid, 100)).toEqual({ coefficient: 0, apexProgress: 0 });
      expect(boundCompanionSineArc(180, 220, invalid, 100)).toBe(0);
    }
    for (const invalid of [NaN, Infinity, -Infinity]) {
      expect(boundCompanionBallisticArc(invalid, 220, 560, 100)).toEqual({ coefficient: 0, apexProgress: 0 });
      expect(boundCompanionBallisticArc(180, invalid, 560, 100)).toEqual({ coefficient: 0, apexProgress: 0 });
      expect(boundCompanionBallisticArc(180, 220, 560, invalid)).toEqual({ coefficient: 0, apexProgress: 0 });
      expect(boundCompanionSineArc(180, 220, 60, invalid)).toBe(0);
    }
  });
});
