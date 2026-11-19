import { describe, expect, it } from "vitest";
import { compositeCompanionFaceInk, restoreCompanionTearInk } from "@/lib/ui/viewer-companion/face-ink";
import { companionFaceBackground } from "@/lib/ui/viewer-companion/face-plate";

describe("facial ink above cheeks", () => {
  it("keeps opaque eyes continuous over an orange cheek and preserves the source alpha", () => {
    const source = new Uint8ClampedArray([240, 150, 100, 253, 240, 150, 100, 253]);
    const target = source.slice();
    compositeCompanionFaceInk(target, source, new Uint8ClampedArray([112, 70, 38, 255, 0, 0, 0, 0]), 1);
    expect([...target]).toEqual([112, 70, 38, 253, 240, 150, 100, 253]);
  });
  it("feathers new ink by its coverage without cutting it at the old repair rectangle", () => {
    const source = new Uint8ClampedArray([240, 160, 100, 253]);
    const target = source.slice();
    compositeCompanionFaceInk(target, source, new Uint8ClampedArray([100, 60, 20, 128]), 1);
    expect([...target]).toEqual([170, 110, 60, 253]);
  });
  it("does not paint through the translucent silhouette or change alpha", () => {
    const source = new Uint8ClampedArray([220, 200, 170, 128, 0, 0, 0, 0]);
    const target = source.slice();
    compositeCompanionFaceInk(target, source, new Uint8ClampedArray(8).fill(255), 1);
    expect(target).toEqual(source);
  });
  it("restores same-source blue tears after eye-background repair without restoring the old mouth or cheek", () => {
    const source = new Uint8ClampedArray([80, 175, 215, 253, 240, 150, 100, 253, 110, 70, 40, 253]);
    const target = new Uint8ClampedArray(12).fill(19);
    restoreCompanionTearInk(target, source);
    expect([...target]).toEqual([80, 175, 215, 253, 19, 19, 19, 19, 19, 19, 19, 19]);
  });
  it("leaves clean textured paper unchanged instead of repainting a rectangular plate", () => {
    const size = 16, source = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) source.set([235 + (x * y % 15), 210 + (x + y) % 20, 160 + x % 10, 253], (y * size + x) * 4);
    const repaired = companionFaceBackground(source, size, [3, 3, 12, 12], [245, 225, 180]);
    for (let y = 3; y <= 12; y++) for (let x = 3; x <= 12; x++) expect([...repaired.subarray(((y - 3) * 10 + x - 3) * 4, ((y - 3) * 10 + x - 3) * 4 + 4)]).toEqual([...source.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)]);
  });
  it("continues the surrounding paper gradient without projecting a dark eye into a scanline", () => {
    const size = 32, source = new Uint8ClampedArray(size * size * 4), truth = source.slice();
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const rgba = [230 + x / 2, 202 + y / 2, 155 + (x + y) / 2, 253];
      source.set(rgba, (y * size + x) * 4); truth.set(rgba, (y * size + x) * 4);
    }
    for (let y = 10; y <= 20; y++) for (let x = 10; x <= 20; x++) if (Math.hypot(x - 15, y - 15) < 5) source.set([90, 55, 30, 253], (y * size + x) * 4);
    const repaired = companionFaceBackground(source, size, [5, 5, 26, 26], [240, 215, 175]);
    for (let y = 5; y <= 26; y++) for (let x = 5; x <= 26; x++) {
      const i = ((y - 5) * 22 + x - 5) * 4, at = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) expect(Math.abs(repaired[i + c] - truth[at + c])).toBeLessThanOrEqual(1);
      expect(repaired[i + 3]).toBe(253);
    }
  });
});
