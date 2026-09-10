import type { Frame } from "../scene-engine";
import { loadImage } from "../assets";
import { beginLoad, endLoad } from "../loading";
import { horizonY } from "../world/view";
import { withDepthLayer } from "../world/depth-render";
import geometry from "./meadow-layer-geometry.json";
import { meadowLayerGroundCrop } from "./backdrop-manifest";

type Layer = keyof typeof geometry;
type Cache = { c: HTMLCanvasElement; key: string; width: number; height: number; y: number };
const LAYERS: Layer[] = ["far", "ground", "frame"];
export const MEADOW_LAYER_URLS = LAYERS.map(layer => `/ambient/art/backdrop-meadow-spring-${layer}-v${layer === "ground" ? 5 : 2}.png`);

/** Three originals, independently composed. Measured clip spans exclude RGB
 * generator mattes; sources are not mislabelled alpha PNGs. No per-frame masks. */
export class MeadowBackdrop {
  private images: Partial<Record<Layer, HTMLImageElement>> = {};
  private paths: Partial<Record<Layer, Path2D>> = {};
  private caches: Partial<Record<Layer, Cache>> = {};
  private disposed = false;
  version = 0;
  bakes = 0;
  constructor() {
    beginLoad();
    void Promise.all(MEADOW_LAYER_URLS.map(url => loadImage(url).then(async image => { await image.decode(); return image; })))
      .then(images => {
        if (this.disposed || images.some(i => i.naturalWidth !== 1536 || i.naturalHeight !== 1024)) return;
        LAYERS.forEach((layer, index) => {
          this.images[layer] = images[index];
          if (layer !== "ground") {
            const p = new Path2D();
            for (const [x, y, width] of geometry[layer].spans) p.rect(x, y, width, 1);
            this.paths[layer] = p;
          }
        });
        this.version++;
        window.dispatchEvent(new Event("vic:ambient-art-ready"));
      }).catch(() => { /* Keep fallback if any layer fails. */ }).finally(endLoad);
  }
  get ready() { return this.version > 0; }
  drawGround(g: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.ready) return;
    const c = meadowLayerGroundCrop(w, h, horizonY(h));
    g.save(); g.imageSmoothingEnabled = false;
    g.drawImage(this.images.ground!, c.sx, c.sy, c.sw, c.sh, 0, c.y, w, c.height);
    g.restore();
  }
  private cache(layer: "far" | "frame", f: Frame): Cache {
    const width = f.w + 64, height = layer === "far" ? 96 : 128;
    const tier = f.depthTier ?? "full";
    const desired = Math.min(f.dpr, 1.5) * (tier === "full" ? 1 : tier === "lite" ? .5 : .25);
    const scale = Math.min(desired, Math.sqrt(1024 * 1024 / (4 * width * height)) * .99);
    const y = layer === "far" ? horizonY(f.h) - 72 : f.h - 112;
    const key = `${width}/${f.h}/${scale}/${y}`;
    const previous = this.caches[layer];
    if (previous?.key === key) return previous;
    const c = previous?.c ?? document.createElement("canvas");
    c.width = Math.ceil(width * scale); c.height = Math.ceil(height * scale);
    const g = c.getContext("2d")!;
    g.scale(scale, scale); g.imageSmoothingEnabled = false;
    const paint = (x: number, yy: number, k: number, clip?: [number, number, number, number], kx = k) => {
      g.save();
      if (clip) { g.beginPath(); g.rect(...clip); g.clip(); }
      g.translate(x, yy); g.scale(kx, k); g.clip(this.paths[layer]!);
      g.drawImage(this.images[layer]!, 0, 0); g.restore();
    };
    const k = Math.min(.65, Math.max(.3, f.h / 2048));
    if (layer === "far") {
      const tw = 1536 * k, base = geometry.far.bounds[3], left = (width - tw) / 2;
      for (let i = Math.floor(-left / tw); i < Math.ceil((width - left) / tw); i++) {
        const x = Math.round((left + i * tw) * scale) / scale;
        const right = Math.round((left + (i + 1) * tw) * scale) / scale;
        // Quantize both boundaries and overlap one backing pixel; fractional
        // widths otherwise expose a vertical seam on portrait displays.
        paint(x, 80 - base * k, k, undefined, (right - x + 1 / scale) / 1536);
      }
      // Blend the ridge's bottom into M instead of exposing the source cut line.
      const fade = g.createLinearGradient(0, 64, 0, 80);
      fade.addColorStop(0, "#fff"); fade.addColorStop(1, "rgba(255,255,255,0)");
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = fade; g.fillRect(0, 0, width, height);
      g.globalCompositeOperation = "source-over";
    } else {
      const edgeWidth = Math.min(f.w * .22, 768 * k + 32);
      paint(32, 112 - 1024 * k, k, [0, 0, edgeWidth, height]);
      paint(width - 32 - 1536 * k, 112 - 1024 * k, k, [width - edgeWidth, 0, edgeWidth, height]);
    }
    this.bakes++;
    return this.caches[layer] = { c, key, width, height, y };
  }
  private draw(layer: "far" | "frame", g: CanvasRenderingContext2D, f: Frame) {
    if (!this.ready) return false;
    const c = this.cache(layer, f);
    withDepthLayer(g, layer, () => {
      g.save(); g.imageSmoothingEnabled = false;
      g.drawImage(c.c, -32, c.y, c.width, c.height); g.restore();
    });
    return true;
  }
  drawFar(g: CanvasRenderingContext2D, f: Frame) { return this.draw("far", g, f); }
  drawForeground(g: CanvasRenderingContext2D, f: Frame) { return this.draw("frame", g, f); }
  debug() { return { ready: this.ready, version: this.version, bakes: this.bakes, layers: LAYERS, bytes: Object.values(this.caches).reduce((n, v) => n + v.c.width * v.c.height * 4, 0), sourcePixels: 3 * 1536 * 1024 }; }
  dispose() { this.disposed = true; this.images = {}; this.paths = {}; for (const v of Object.values(this.caches)) v.c.width = v.c.height = 1; this.caches = {}; }
}
