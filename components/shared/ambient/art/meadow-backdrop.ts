import type { Frame } from "../scene-engine";
import { loadImage } from "../assets";
import { beginLoad, endLoad } from "../loading";
import { horizonY } from "../world/view";
import { withDepthLayer } from "../world/depth-render";
import { meadowGroundCrop, SPRING_MEADOW_BACKDROP as spec } from "./backdrop-manifest";

/** One shared decoded image; a scene owns only a small, bounded horizon cache.
 * Pixel-derived silhouette metadata clips out the source sky without modifying
 * its bytes or baking a fixed sky/weather layer into the live scene. */
export class MeadowBackdrop {
  private image: HTMLImageElement | null = null;
  private far: HTMLCanvasElement | null = null;
  private key = "";
  private disposed = false;
  version = 0;
  bakes = 0;
  constructor() {
    beginLoad();
    void loadImage(spec.url).then(async image => {
      await image.decode();
      if (this.disposed || image.naturalWidth !== spec.width || image.naturalHeight !== spec.height) return;
      this.image = image;
      this.version++;
      window.dispatchEvent(new Event("vic:ambient-art-ready"));
    }).catch(() => { /* Keep the procedural fallback; failed requests are cached. */ }).finally(endLoad);
  }
  get ready() { return this.image !== null; }
  drawGround(g: CanvasRenderingContext2D, w: number, h: number) {
    if (!this.image) return;
    const hy = horizonY(h), c = meadowGroundCrop(w, h, hy);
    g.save(); g.imageSmoothingEnabled = false;
    g.drawImage(this.image, c.sx, c.sy, c.sw, c.sh, 0, hy, w, h - hy);
    g.restore();
  }
  drawFar(g: CanvasRenderingContext2D, f: Frame) {
    if (!this.image) return false;
    const hy = horizonY(f.h), width = f.w + 64, height = Math.ceil(hy + 4);
    const tier = f.depthTier ?? "full";
    const desired = Math.min(f.dpr, 1.5) * (tier === "full" ? .5 : tier === "lite" ? .25 : .125);
    const scale = Math.min(desired, Math.sqrt(2 * 1024 * 1024 / (4 * width * height)) * .99);
    const key = `${width}/${height}/${scale}`;
    if (!this.far || key !== this.key) {
      this.far ??= document.createElement("canvas");
      this.far.width = Math.max(1, Math.ceil(width * scale));
      this.far.height = Math.max(1, Math.ceil(height * scale));
      const cg = this.far.getContext("2d")!;
      cg.scale(scale, scale); cg.imageSmoothingEnabled = false;
      // Keep canopy height proportional to viewport height. Mirror only the
      // distant panorama beyond its side edges on wide screens, not the ground.
      const k = f.h / spec.height;
      const tw = spec.width * k, left = (width - tw) / 2;
      const first = Math.floor(-left / tw), last = Math.ceil((width - left) / tw);
      for (let tile = first; tile < last; tile++) {
        const tx = Math.round((left + tile * tw) * scale) / scale;
        const right = Math.round((left + (tile + 1) * tw) * scale) / scale;
        const tileWidth = right - tx;
        cg.save();
        cg.translate(tx, hy - spec.horizon * k);
        if (Math.abs(tile) % 2 === 1) { cg.translate(tileWidth, 0); cg.scale(-1, 1); }
        cg.scale(tileWidth / spec.width, k);
        cg.beginPath(); cg.moveTo(0, spec.horizon + 5);
        for (let x = 0; x < spec.width; x++) {
          cg.lineTo(x, spec.skyline[x]); cg.lineTo(x + 1, spec.skyline[x]);
        }
        cg.lineTo(spec.width, spec.horizon + 5); cg.closePath(); cg.clip();
        cg.drawImage(this.image, 0, 0);
        cg.restore();
      }
      this.key = key; this.bakes++;
    }
    withDepthLayer(g, "far", () => {
      g.save(); g.imageSmoothingEnabled = false;
      g.drawImage(this.far!, -32, 0, width, height); g.restore();
    });
    return true;
  }
  debug() { return { ready: this.ready, version: this.version, bakes: this.bakes, bytes: (this.far?.width ?? 0) * (this.far?.height ?? 0) * 4, sourcePixels: spec.width * spec.height }; }
  dispose() { this.disposed = true; this.image = null; if (this.far) this.far.width = this.far.height = 1; this.far = null; }
}
