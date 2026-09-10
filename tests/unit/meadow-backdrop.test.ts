import { describe, expect, it } from "vitest";
import { meadowGroundCrop, SPRING_MEADOW_BACKDROP as spec } from "../../components/shared/ambient/art/backdrop-manifest";

describe("spring meadow responsive source contract", () => {
  it("covers desktop ground uniformly without reading beyond the source at extreme aspect ratios", () => {
    for (const [w, h] of [[641, 1800], [1024, 768], [1400, 860], [1920, 1080], [2560, 1440], [3440, 1440], [5120, 1440], [3840, 2160], [1440, 1440]]) {
      const hy = h * .26, c = meadowGroundCrop(w, h, hy);
      expect(c.sy).toBe(spec.horizon);
      expect(c.sx).toBeGreaterThanOrEqual(0);
      expect(c.sx + c.sw).toBeLessThanOrEqual(spec.width + 1e-8);
      expect(c.sy + c.sh).toBeLessThanOrEqual(spec.height + 1e-8);
      expect(w / c.sw).toBeCloseTo((h - hy) / c.sh, 8);
      expect(c.sx + c.sw / 2).toBeCloseTo(spec.width / 2, 8);
    }
  });
  it("has a complete terrain silhouette above the ground anchor", () => {
    expect(spec.skyline).toHaveLength(spec.width);
    expect(spec.skyline.every(y => Number.isInteger(y) && y > 0 && y < spec.horizon)).toBe(true);
    expect(spec.width * spec.height * 4).toBe(6 * 1024 * 1024);
  });
});
