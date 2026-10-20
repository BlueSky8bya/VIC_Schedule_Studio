import { describe, expect, it } from "vitest";
import { sampleCompanionCheer } from "@/lib/ui/viewer-companion/cheer";

const scalars = (p: number) => { const pose = sampleCompanionCheer(p); return [pose.lift, pose.lean, pose.compression]; };
describe("the limbless pompom body cheers by bouncing", () => {
  it("starts and finishes at rest and has no held prop or limb geometry", () => {
    for (const p of [0, 1, -.1, 1.1, NaN, Infinity]) expect(sampleCompanionCheer(p)).toEqual({ lift: 0, lean: 0, compression: 0, hop: 0, airborne: false });
    expect(Object.keys(sampleCompanionCheer(.5)).sort()).toEqual(["airborne", "compression", "hop", "lean", "lift"]);
  });
  it("makes five distinct airborne beats with grounded gaps and a stronger finale", () => {
    const samples = Array.from({ length: 2001 }, (_, index) => sampleCompanionCheer(index / 2000));
    expect([...new Set(samples.filter(p => p.airborne).map(p => p.hop))]).toEqual([1, 2, 3, 4, 5]);
    for (const hop of [1, 2, 3, 4, 5]) expect(Math.min(...samples.filter(p => p.hop === hop).map(p => p.lift))).toBeLessThan(-14);
    expect(Math.min(...samples.map(p => p.lift))).toBeCloseTo(-24, 2);
    for (const p of [.26, .41, .56, .71]) expect(sampleCompanionCheer(p).airborne).toBe(false);
  });
  it("bounds local deformation", () => {
    for (let index = 0; index <= 2000; index++) {
      const pose = sampleCompanionCheer(index / 2000);
      expect(scalars(index / 2000).every(Number.isFinite)).toBe(true);
      expect(pose.lift).toBeGreaterThanOrEqual(-24.001); expect(pose.lift).toBeLessThanOrEqual(0);
      expect(Math.abs(pose.lean)).toBeLessThanOrEqual(6);
      expect(pose.compression).toBeGreaterThanOrEqual(-.025001); expect(pose.compression).toBeLessThanOrEqual(.055001);
    }
  });
  it("joins anticipation, takeoffs, landings and recovery without velocity jumps", () => {
    const h = 1e-6;
    for (const p of [.015, .12, .238, .25, .27, .295, .388, .40, .42, .445, .538, .55, .57, .595, .688, .70, .72, .745, .878, .89, .90, .935, .985]) {
      const before = scalars(p - h), at = scalars(p), after = scalars(p + h);
      for (let i = 0; i < at.length; i++) expect(Math.abs((after[i] - 2 * at[i] + before[i]) / h)).toBeLessThan(.15);
    }
  });
});
