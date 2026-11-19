import { describe, expect, it } from "vitest";
import { sampleCompanionSleepMouth } from "@/lib/ui/viewer-companion/expression-painter";

describe("sleep mouth follows the existing CSS breath", () => {
  it("rests closed, reaches the former small-o at the breath peak and closes again", () => {
    for (const phase of [0, .08, .12, .82, .95, 1]) expect(sampleCompanionSleepMouth(phase * 4800)).toBe(0);
    expect(sampleCompanionSleepMouth(.44 * 4800)).toBe(1);
    const samples = Array.from({ length: 481 }, (_, n) => sampleCompanionSleepMouth(n * 10));
    expect(Math.max(...samples)).toBeGreaterThan(.9999);
    expect(Math.min(...samples)).toBe(0);
    expect(Math.max(...samples.slice(1).map((value, i) => Math.abs(value - samples[i])))).toBeLessThan(.011);
    for (const elapsed of [1500, 2112, 3300, 4500]) expect(sampleCompanionSleepMouth(elapsed + 4800)).toBeCloseTo(sampleCompanionSleepMouth(elapsed), 10);
  });
  it("fails closed for an absent or invalid animation clock", () => {
    for (const elapsed of [NaN, Infinity, -Infinity, -1]) expect(sampleCompanionSleepMouth(elapsed)).toBe(0);
  });
});
