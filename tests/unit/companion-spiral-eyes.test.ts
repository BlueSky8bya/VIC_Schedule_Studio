import { describe, expect, it } from "vitest";
import edition from "@/lib/ui/viewer-companion/appearance-edition.json";
import { companionSpiralEyeBounds, restoreCompanionSpiralEyes } from "@/lib/ui/viewer-companion/spiral-eyes";

describe("same-source dizzy eye restoration", () => {
  it("restores both full rings after an overlapping face repair and touches nothing else", () => {
    const source = new Uint8ClampedArray(192 * 192 * 4).map((_, i) => i % 251);
    for (const frame of edition.frames.filter(frame => frame.eyeState === "spiral")) {
      const target = new Uint8ClampedArray(source.length).fill(17), before = target.slice();
      const bounds = companionSpiralEyeBounds(frame.physicalIndex);
      expect(bounds).toHaveLength(2);
      expect(bounds.every(([l, t, r, b]) => r - l >= 20 && b - t >= 20 && l >= 0 && b < 192)).toBe(true);
      restoreCompanionSpiralEyes(target, source, frame.physicalIndex);
      let mismatches = 0;
      for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
        const restored = bounds.some(([l, t, r, b]) => x >= l && x <= r && y >= t && y <= b);
        const at = (y * 192 + x) * 4;
        for (let c = 0; c < 4; c++) if (target[at + c] !== (restored ? source : before)[at + c]) mismatches++;
      }
      expect(mismatches, `eye-only restoration ${frame.physicalIndex}`).toBe(0);
    }
  });
  it("leaves every other authored expression byte-for-byte intact", () => {
    const source = new Uint8ClampedArray(192 * 192 * 4).fill(222), target = new Uint8ClampedArray(source.length).fill(31);
    for (const frame of edition.frames.filter(frame => frame.eyeState !== "spiral")) {
      expect(companionSpiralEyeBounds(frame.physicalIndex)).toEqual([]);
      restoreCompanionSpiralEyes(target, source, frame.physicalIndex);
    }
    expect(target.every(value => value === 31)).toBe(true);
  });
});
