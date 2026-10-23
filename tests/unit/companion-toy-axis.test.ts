import { describe, expect, it } from "vitest";
import { COMPANION_AXIS_TOYS, projectCompanionTopSurface } from "@/lib/ui/viewer-companion/toy-motion-paint";

describe("same-art axial surface projection", () => {
  const width = 40, height = 40;
  const pixels = () => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 4; x < width - 4; x++) {
      const at = (y * width + x) * 4;
      data[at] = x * 5; data[at + 1] = y * 4; data[at + 2] = 70; data[at + 3] = 255;
    }
    return { width, height, data };
  };
  it("covers precisely the upright tops and independently mounted pinwheel", () => {
    expect([...COMPANION_AXIS_TOYS].sort()).toEqual(["battle-top-launcher", "pinwheel", "spinning-top"]);
  });
  it.each(["spinning-top", "battle-top-launcher"] as const)("rotates %s surface while preserving every silhouette alpha, axle and tip pixel", kind => {
    const source = pixels(), output = new Uint8ClampedArray(source.data.length);
    projectCompanionTopSurface(source, output, kind, 83);
    expect(output).not.toEqual(source.data);
    for (let i = 3; i < output.length; i += 4) expect(output[i]).toBe(source.data[i]);
    expect(output.slice(0, width * 10 * 4)).toEqual(source.data.slice(0, width * 10 * 4));
    expect(output.slice(width * 38 * 4)).toEqual(source.data.slice(width * 38 * 4));
    if (kind === "battle-top-launcher") for (let y = 0; y < height * .64; y++) {
      expect(output.slice(y * width * 4, (y * width + Math.floor(width * .57)) * 4)).toEqual(source.data.slice(y * width * 4, (y * width + Math.floor(width * .57)) * 4));
    }
    expect(source.data).toEqual(pixels().data);
  });
  it("returns the exact original after every whole turn and handles invalid angle without a blank frame", () => {
    const source = pixels(), output = new Uint8ClampedArray(source.data.length);
    for (const degrees of [0, 360, 720, -360, NaN, Infinity]) {
      projectCompanionTopSurface(source, output, "spinning-top", degrees); expect(output).toEqual(source.data);
    }
  });
});
