import { describe, it, expect } from "vitest";
import { horizonY, groundYAt, toGroundV, withViewHorizon, SPRING_MEADOW_HORIZON_V } from "../../components/shared/ambient/world/view";
import { meadowLayerGroundCrop } from "../../components/shared/ambient/art/backdrop-manifest";
import geometry from "../../components/shared/ambient/art/meadow-layer-geometry.json";

describe("spring meadow layered camera", () => {
  it("restores the default camera across nesting and errors and keeps ground inversion", () => {
    expect(horizonY(1000)).toBe(260);
    withViewHorizon(SPRING_MEADOW_HORIZON_V, () => {
      expect(horizonY(1000)).toBe(350);
      for (const v of [0, .2, .6, 1]) expect(toGroundV(groundYAt(v, 1000), 1000)).toBeCloseTo(v);
      expect(() => withViewHorizon(.26, () => { throw Error("test"); })).toThrow();
      expect(horizonY(1000)).toBe(350);
    });
    expect(horizonY(1000)).toBe(260);
  });
  it("preserves the complete distance gradient on tall, wide and 4K ground", () => {
    for (const [w,h] of [[641,1800],[1400,860],[5120,1440],[3840,2160]]) {
      const c=meadowLayerGroundCrop(w,h,h*.35);
      expect(c.sx).toBeGreaterThanOrEqual(0);
      expect(c.sx+c.sw).toBeLessThanOrEqual(1536+1e-8);
      expect(c.sy).toBe(0);
      expect(c.sh).toBe(1024);
      expect(c.y+c.height).toBe(h);
      expect(c.y).toBeLessThan(h*.35-4);
      expect(c.tileWidth / 1536).toBeCloseTo(c.height / 1024);
      expect(c.tiles[0].x).toBeLessThanOrEqual(0);
      expect(c.tiles.at(-1)!.x + c.tileWidth).toBeGreaterThanOrEqual(w - 1e-8);
      for (let i = 1; i < c.tiles.length; i++) {
        expect(c.tiles[i].x).toBeCloseTo(c.tiles[i-1].x + c.tileWidth - c.overlap);
        expect(c.tiles[i].x).toBeLessThan(c.tiles[i-1].x + c.tileWidth);
      }
    }
  });
  it("reveals more ground at equal height without enlarging grass", () => {
    const standard = meadowLayerGroundCrop(1400, 860, 301);
    const wide = meadowLayerGroundCrop(3440, 860, 301);
    expect(wide.tileWidth).toBe(standard.tileWidth);
    expect(wide.tiles.length).toBeGreaterThan(standard.tiles.length);
  });
  it("keeps the distant ridge shallow and the foreground center clear", () => {
    expect(geometry.far.bounds[0]).toBe(0);
    expect(geometry.far.bounds[2]).toBe(1536);
    expect(geometry.far.bounds[3]-geometry.far.bounds[1]).toBeLessThan(180);
    expect(geometry.frame.spans.every(([x,y,w])=>y>=850&&(x+w<=440||x>=1100))).toBe(true);
    for (const layer of [geometry.far,geometry.frame]) {
      expect(layer.spans.length).toBeGreaterThan(0);
      expect(layer.spans.every(([x,y,w])=>x>=0&&y>=0&&x+w<=1536&&y<1024&&w>0)).toBe(true);
    }
  });
});
