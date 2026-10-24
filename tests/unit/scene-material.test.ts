import { describe, expect, it, vi } from "vitest";
import { publishSceneBackdrop, publishSceneMaterial, sceneMaterialMatrix } from "@/lib/ui/scene-material";

describe("shared seasonal material basis", () => {
  const field = (rgb: number[]) => new Uint8ClampedArray(Array.from({ length: 4 }, () => [...rgb, 255]).flat());
  it("preserves original alpha and reconstructs neutral RGB without painting a rectangle", () => {
    const values = sceneMaterialMatrix({ size: 2, basis: [field([0,0,0]),field([255,0,0]),field([0,255,0]),field([0,0,255])] }, .4, .7).split(" ").map(Number);
    expect(values).toEqual([1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0]);
  });
  it("uses the spatial colored light field, including bounded source-over offsets", () => {
    const black = field([20,30,40]),red=field([120,30,40]),green=field([20,160,40]),blue=field([20,30,210]);
    red[4]=220;
    const left=sceneMaterialMatrix({size:2,basis:[black,red,green,blue]},0,0).split(" ").map(Number);
    const halfway=sceneMaterialMatrix({size:2,basis:[black,red,green,blue]},.5,0).split(" ").map(Number);
    expect(left[4]).toBeCloseTo(20/255,4); expect(left[0]).toBeCloseTo(100/255,4);
    expect(halfway[0]).toBeCloseTo(150/255,4); expect(left[6]).toBeCloseTo(130/255,4);
    expect(left.slice(-5)).toEqual([0,0,0,1,0]);
  });
  it("keeps pending-night title contrast independent of material readiness and stale owners", () => {
    const toggleAttribute = vi.fn(), owner = {} as HTMLCanvasElement, oldOwner = {} as HTMLCanvasElement;
    vi.stubGlobal("document", { documentElement: { toggleAttribute } });
    try {
      publishSceneBackdrop(true, owner);
      publishSceneMaterial(undefined, owner);
      publishSceneBackdrop(undefined, oldOwner);
      expect(toggleAttribute.mock.calls).toEqual([["data-ambient-night", true]]);
      publishSceneBackdrop(undefined, owner);
      expect(toggleAttribute).toHaveBeenLastCalledWith("data-ambient-night", false);
    } finally { publishSceneBackdrop(undefined, owner); vi.unstubAllGlobals(); }
  });
});
