import { describe, expect, it } from "vitest";
import { sampleCompanionExpression, sampleCompanionThrowExpression } from "@/lib/ui/viewer-companion/expressions";

describe("the real throw's display-only face", () => {
  it("stays startled throughout flight instead of drifting into a relaxed smile", () => {
    for (const p of [0, .2, .5, .9, 1]) {
      const frame = sampleCompanionThrowExpression("airborne", p), face = sampleCompanionExpression(frame.id, frame.progress);
      expect(face.weight).toBe(1); expect(face.smile).toBe(0);
      expect(face.open).toBeGreaterThan(.6); expect(face.mouthRound).toBe(1);
      expect(face.leftClosure).toBe(0); expect(face.rightClosure).toBe(0);
      expect(face.brow).toBeGreaterThan(.6);
    }
  });
  it("starts contact continuously, then relaxes to the exact original source at its end", () => {
    expect(sampleCompanionThrowExpression("landing", 0)).toEqual(sampleCompanionThrowExpression("airborne"));
    const middle = sampleCompanionThrowExpression("landing", .5), end = sampleCompanionThrowExpression("landing", 1);
    expect(sampleCompanionExpression(middle.id, middle.progress).smile).toBeGreaterThan(.3);
    expect(sampleCompanionExpression(end.id, end.progress)).toEqual(sampleCompanionExpression("relief", 0));
  });
  it("bounds malformed contact samples without creating a new expression catalogue entry", () => {
    for (const p of [NaN, Infinity, -1, 0, .5, 1, 4]) {
      const frame = sampleCompanionThrowExpression("landing", p);
      expect(frame.id).toBe("relief"); expect(frame.progress).toBeGreaterThanOrEqual(.2); expect(frame.progress).toBeLessThanOrEqual(1);
    }
  });
});
