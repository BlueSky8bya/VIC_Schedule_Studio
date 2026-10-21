import { describe, expect, it } from "vitest";
import { COMPANION_EXPRESSIONS, COMPANION_EXPRESSION_MIN_EYE, sampleCompanionExpression } from "@/lib/ui/viewer-companion/expressions";

describe("166 continuous eyelids preserve identity through expression entry, hold and recovery", () => {
  it("keeps all36 open apertures substantial and all closure channels continuous at240 samples", () => {
    expect(COMPANION_EXPRESSION_MIN_EYE).toBeGreaterThanOrEqual(.78);
    for (const [id] of COMPANION_EXPRESSIONS) {
      let previous = sampleCompanionExpression(id, 0);
      for (let n = 1; n <= 240; n++) {
        const f = sampleCompanionExpression(id, n / 240);
        expect(Math.min(f.left, f.right)).toBeGreaterThanOrEqual(.78);
        for (const key of ["leftClosure", "rightClosure"] as const) {
          expect(f[key]).toBeGreaterThanOrEqual(0); expect(f[key]).toBeLessThanOrEqual(1);
          // The effective rendered channel includes its entry/recovery weight.
          expect(Math.abs(f[key] * f.weight - previous[key] * previous.weight)).toBeLessThan(.075);
        }
        previous = f;
      }
      expect(previous.weight).toBe(0); expect(previous.leftClosure).toBe(0); expect(previous.rightClosure).toBe(0);
    }
  });
  it("opens awake eyes and closes giggle/relief eyes through genuine intermediate lids", () => {
    for (const id of ["awake", "giggle", "relief"] as const) {
      const hold = Array.from({ length: 120 }, (_, n) => sampleCompanionExpression(id, .2 + n / 120 * .55));
      expect(hold.some(f => f.leftClosure > .1 && f.leftClosure < .9)).toBe(true);
      expect(new Set(hold.map(f => f.leftShape)).size).toBe(1);
      expect(hold.at(-1)!.leftClosure).toBe(id === "awake" ? 0 : 1);
    }
  });
  it("retains separate open-eye acting and deliberate smiles/squeezes", () => {
    expect(sampleCompanionExpression("savor", .55).left).not.toBe(sampleCompanionExpression("shy", .55).left);
    expect(sampleCompanionExpression("sunny", .55).leftClosure).toBe(0);
    expect(sampleCompanionExpression("melt", .55).leftClosure).toBe(1);
    expect(sampleCompanionExpression("sour", .55).leftClosure).toBe(1);
    expect(sampleCompanionExpression("sour", .55).rightClosure).toBe(0);
  });
});
