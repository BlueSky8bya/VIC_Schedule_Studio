import type { Frame } from "../scene-engine";
import { loadImage } from "../assets";
import { beginLoad, endLoad } from "../loading";
import { horizonY } from "../world/view";
import { withSurfaceDepth } from "../world/depth-render";
import { composeNearGround } from "../world/ground-detail";
import geometry from "./meadow-layer-geometry.json";
import summerGeometry from "./meadow-summer-layer-geometry.json";
import autumnGeometry from "./meadow-autumn-layer-geometry.json";
import winterGeometry from "./meadow-winter-layer-geometry.json";
import type { SeasonKey } from "../registry";
import { meadowLayerGroundCrop } from "./backdrop-manifest";

type Layer = keyof typeof geometry;
type Cache = { c: HTMLCanvasElement; key: string; width: number; height: number; y: number };
const LAYERS: Layer[] = ["far", "ground", "frame"];
export const meadowLayerUrls = (season: SeasonKey) => LAYERS.map(layer => `/ambient/art/backdrop-meadow-${season}-${layer}-v${season === "spring" ? (layer === "ground" ? 5 : 2) : 1}.png`);
export const MEADOW_LAYER_URLS = meadowLayerUrls("spring");
const GEOMETRIES = { spring: geometry, summer: summerGeometry, autumn: autumnGeometry, winter: winterGeometry };

/** Three originals, independently composed. Measured clip spans exclude RGB
 * generator mattes; sources are not mislabelled alpha PNGs. No per-frame masks. */
export class MeadowBackdrop {
  private images: Partial<Record<Layer, HTMLImageElement>> = {};
  private masked: Partial<Record<Layer, { c: HTMLCanvasElement; x: number; y: number }>> = {};
  private caches: Partial<Record<Layer, Cache>> = {};
  private nearGround?: HTMLCanvasElement;
  private detailImage?: HTMLImageElement;
  private disposed = false;
  version = 0;
  bakes = 0;
  private geometry: typeof geometry;
  constructor(private season: SeasonKey = "spring") {
    this.geometry = GEOMETRIES[season];
    beginLoad();
    // Uncached optional detail image: release its decoded bitmap after composition.
    const detail = this.detailImage = new Image();
    detail.src = `/ambient/art/backdrop-meadow-${season}-near-detail-v1.png`;
    const detailReady = detail.decode().then(() => detail).catch(() => null);
    void Promise.all(meadowLayerUrls(season).map(url => loadImage(url).then(async image => { await image.decode(); return image; })))
      .then(images => {
        if (this.disposed || images.some(i => i.naturalWidth !== 1536 || i.naturalHeight !== 1024)) {
          detail.removeAttribute("src"); this.detailImage = undefined; return;
        }
        LAYERS.forEach((layer, index) => {
          if (layer === "ground") { this.images[layer] = images[index]; return; }
          // Select integer source pixels BEFORE any fractional cache scaling.
          // A scaled clip has antialiased coverage and can sample RGB matte
          // outside a valid span even with imageSmoothingEnabled=false.
          const spans=this.geometry[layer].spans;
          const x=Math.min(...spans.map(s=>s[0])),y=Math.min(...spans.map(s=>s[1]));
          const right=Math.max(...spans.map(s=>s[0]+s[2])),bottom=Math.max(...spans.map(s=>s[1]+1));
          const c=document.createElement("canvas");c.width=right-x;c.height=bottom-y;
          const cg=c.getContext("2d")!;cg.imageSmoothingEnabled=false;
          for(const [sx,sy,width] of spans)cg.drawImage(images[index],sx,sy,width,1,sx-x,sy-y,width,1);
          // Feather only already-clean pixels; the excluded magenta matte never returns.
          if(layer==='far'){
            const soft=document.createElement('canvas');soft.width=c.width;soft.height=c.height;
            const sg=soft.getContext('2d')!;sg.filter='blur(1.6px)';sg.drawImage(c,0,0);
            cg.clearRect(0,0,c.width,c.height);cg.drawImage(soft,0,0);soft.width=soft.height=1;
          }
          this.masked[layer]={c,x,y};
        });
        this.version++;
        window.dispatchEvent(new Event("vic:ambient-art-ready"));
        // Optional artwork must never hold the original three layers hostage.
        void detailReady.then(near => {
          if (this.disposed) return;
          if (near?.naturalWidth === 1536 && near.naturalHeight === 1024) {
            this.nearGround = composeNearGround(images[1], near);
            this.version++;
            window.dispatchEvent(new Event("vic:ambient-art-ready"));
          }
          detail.removeAttribute("src"); this.detailImage = undefined;
        });
      }).catch(() => {
        detail.removeAttribute("src"); this.detailImage = undefined;
        // Keep fallback if any original layer fails.
      }).finally(endLoad);
  }
  get ready() { return this.version > 0; }
  drawGround(g: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.ready) return;
    const c = meadowLayerGroundCrop(w, h, horizonY(h));
    g.save(); g.imageSmoothingEnabled = false;
    const scale = c.height / 1024;
    // Same-direction tiles avoid a mirror fold. Blend only their overlapping
    // margins in this one-time ground bake; no image editing or extra canvas.
    const alpha = g.globalAlpha;
    for (let i = 0; i < c.tiles.length; i++) {
      const tile = c.tiles[i];
      const blend = i === 0 ? 0 : c.overlap;
      if (blend) for (let j = 0; j < 32; j++) {
        const x0 = Math.round(blend * j / 32);
        const x1 = Math.round(blend * (j + 1) / 32);
        const t = (j + .5) / 32;
        g.globalAlpha = alpha * t * t * (3 - 2 * t);
        g.drawImage(this.nearGround ?? this.images.ground!, x0 / scale, 0, (x1 - x0) / scale, 1024, tile.x + x0, c.y, x1 - x0, c.height);
      }
      g.globalAlpha = alpha;
      const start = Math.round(blend);
      g.drawImage(this.nearGround ?? this.images.ground!, start / scale, 0, 1536 - start / scale, 1024, tile.x + start, c.y, c.tileWidth - start, c.height);
    }
    g.restore();
  }
  private cache(layer: "far" | "frame", f: Frame): Cache {
    const width = f.w + 64, height = layer === "far" ? 96 : 192;
    const tier = f.depthTier ?? "full";
    const desired = Math.min(f.dpr, 1.5) * (tier === "full" ? 1 : tier === "lite" ? .5 : .25);
    const scale = Math.min(desired, Math.sqrt(1024 * 1024 / (4 * width * height)) * .99);
    const y = layer === "far" ? horizonY(f.h) - 72 : f.h - 176;
    const key = `${width}/${f.h}/${scale}/${y}`;
    const previous = this.caches[layer];
    if (previous?.key === key) return previous;
    const c = previous?.c ?? document.createElement("canvas");
    c.width = Math.ceil(width * scale); c.height = Math.ceil(height * scale);
    const g = c.getContext("2d")!;
    g.scale(scale, scale); g.imageSmoothingEnabled = layer === "far";
    const paint = (x: number, yy: number, k: number, clip?: [number, number, number, number], kx = k) => {
      g.save();
      if (clip) { g.beginPath(); g.rect(...clip); g.clip(); }
      g.translate(x, yy); g.scale(kx, k);
      const source=this.masked[layer]!;
      g.drawImage(source.c,source.x,source.y); g.restore();
    };
    const k = Math.min(.65, Math.max(.3, f.h / 2048));
    if (layer === "far") {
      const tw = 1536 * k, base = this.geometry.far.bounds[3], left = (width - tw) / 2;
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
      const nearK = Math.min(.95, Math.max(.55, f.h / 1200));
      const edgeWidth = Math.min(f.w * .24, 440 * nearK + 32);
      // Several staggered groups instead of a thin row of isolated blades.
      // Their roots extend below the viewport; the middle half stays open.
      for (const [offset, base, size] of [[-24, 189, 1], [74, 172, .76], [145, 196, .62]]) {
        const kk = nearK * size;
        paint(32 + offset, base - 1024 * kk, kk, [0, 0, edgeWidth, height]);
      }
      for (const [offset, base, size] of [[-16, 194, .92], [90, 176, .81], [166, 199, .57]]) {
        const kk = nearK * size;
        paint(width - 32 - offset - 1536 * kk, base - 1024 * kk, kk, [width - edgeWidth, 0, edgeWidth, height]);
      }
      // Taper inward instead of leaving a ruler-straight clipped edge in grass.
      const fade = g.createLinearGradient(0, 0, width, 0);
      fade.addColorStop(0, "#fff");
      fade.addColorStop(Math.max(0, edgeWidth - 48) / width, "#fff");
      fade.addColorStop(edgeWidth / width, "transparent");
      fade.addColorStop((width - edgeWidth) / width, "transparent");
      fade.addColorStop((width - Math.max(0, edgeWidth - 48)) / width, "#fff");
      fade.addColorStop(1, "#fff");
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = fade; g.fillRect(0, 0, width, height);
      g.globalCompositeOperation = "source-over";
    }
    this.bakes++;
    return this.caches[layer] = { c, key, width, height, y };
  }
  private draw(layer: "far" | "frame", g: CanvasRenderingContext2D, f: Frame) {
    if (!this.ready) return false;
    const c = this.cache(layer, f);
    withSurfaceDepth(g, layer === "far" ? 0 : 1, () => {
      g.save(); g.imageSmoothingEnabled = layer === "far";
      g.drawImage(c.c, -32, c.y, c.width, c.height); g.restore();
    });
    return true;
  }
  drawFar(g: CanvasRenderingContext2D, f: Frame) { return this.draw("far", g, f); }
  drawForeground(g: CanvasRenderingContext2D, f: Frame) { return this.draw("frame", g, f); }
  debug() { return { season: this.season, ready: this.ready, version: this.version, bakes: this.bakes, layers: LAYERS, bytes: Object.values(this.caches).reduce((n, v) => n + v.c.width * v.c.height * 4, 0), nearDetailBytes: this.nearGround ? this.nearGround.width * this.nearGround.height * 4 : 0, maskedBytes:Object.values(this.masked).reduce((n,v)=>n+v.c.width*v.c.height*4,0), sourcePixels: 3 * 1536 * 1024 }; }
  dispose() { this.disposed = true; this.detailImage?.removeAttribute("src");this.detailImage=undefined; if(this.nearGround)this.nearGround.width=this.nearGround.height=1;this.nearGround=undefined; this.images = {}; for(const v of Object.values(this.masked))v.c.width=v.c.height=1;this.masked={}; for (const v of Object.values(this.caches)) v.c.width = v.c.height = 1; this.caches = {}; }
}
