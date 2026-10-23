import { COMPANION_TOY_VISUALS, type CompanionToyKind } from "./toy-catalog";

export const COMPANION_AXIS_TOYS: ReadonlySet<CompanionToyKind> = new Set(["spinning-top", "battle-top-launcher", "pinwheel"]);
type Pixels = { width: number; height: number; data: Uint8ClampedArray };

/** A small cylindrical front-surface projection, not a rotating flat card.
 * Keep the source silhouette/alpha, vertical axle and bottom tip fixed, and
 * move only the printed body surface. Back texture is the mirrored source
 * hemisphere: the original illustration has no hidden back-side artwork.
 * The launcher is a separate stationary region of the same original image. */
export function projectCompanionTopSurface(source: Pixels, output: Uint8ClampedArray, kind: "spinning-top" | "battle-top-launcher", degrees: number) {
  output.set(source.data);
  const phase = ((Number.isFinite(degrees) ? degrees : 0) % 360) * Math.PI / 180;
  if (Math.abs(phase) < 1e-9) return;
  const { width, height, data } = source;
  const top = Math.floor(height * (kind === "spinning-top" ? .28 : .43));
  const bottom = Math.ceil(height * (kind === "spinning-top" ? .77 : .94));
  for (let y = top; y < bottom; y++) {
    const first = kind === "spinning-top" ? 0 : Math.floor(width * (y < height * .64 ? .57 : .34));
    let left = first, right = width - 1;
    while (left < right && data[(y * width + left) * 4 + 3] < 180) left++;
    while (right > left && data[(y * width + right) * 4 + 3] < 180) right--;
    const radius = (right - left) / 2, centre = (left + right) / 2;
    if (radius < 2) continue;
    for (let x = left; x <= right; x++) {
      const dest = (y * width + x) * 4;
      if (data[dest + 3] < 180) continue;
      const theta = Math.asin(Math.max(-1, Math.min(1, (x - centre) / radius)));
      const sx = Math.max(left, Math.min(right, Math.round(centre + Math.sin(theta - phase) * radius)));
      const sample = (y * width + sx) * 4;
      // Preserve the outline and its antialiasing. A row does not sample
      // transparent outside pixels or rotate the handle/launcher/tip.
      output[dest] = data[sample]; output[dest + 1] = data[sample + 1]; output[dest + 2] = data[sample + 2];
    }
  }
}

type PaintCache = { image: HTMLImageElement; source: HTMLCanvasElement; pixels: ImageData; output: ImageData; rotor?: HTMLCanvasElement; shaft?: HTMLCanvasElement; angle: number };
const caches = new WeakMap<HTMLCanvasElement, PaintCache>();

/** Called only by the existing finite toy paint clock. At most four 2x live
 * toy canvases; no RAF, timer, new asset, physics or collection side effect. */
export function paintCompanionToyAxis(canvas: HTMLCanvasElement, image: HTMLImageElement, kind: CompanionToyKind, degrees: number) {
  if (!COMPANION_AXIS_TOYS.has(kind) || !image.complete || !image.naturalWidth) return false;
  const size = COMPANION_TOY_VISUALS[kind], width = size.width * 2, height = size.height * 2;
  let cache = caches.get(canvas);
  if (!cache || cache.image !== image || canvas.width !== width || canvas.height !== height) {
    const source = document.createElement("canvas"); source.width = canvas.width = width; source.height = canvas.height = height;
    const context = source.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(image, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);
    cache = { image, source, pixels, output: context.createImageData(width, height), angle: NaN };
    if (kind === "pinwheel") {
      const rotor = document.createElement("canvas"), shaft = document.createElement("canvas");
      rotor.width = shaft.width = width; rotor.height = shaft.height = height;
      const r = rotor.getContext("2d"), s = shaft.getContext("2d");
      if (!r || !s) return false;
      const blades = r.createImageData(width, height), stick = s.createImageData(width, height);
      // Classify only the original narrow ochre shaft below the hub. A
      // rectangular crop would cut the green lower blade or duplicate it
      // as stationary art. No new blade/stick artwork is synthesized.
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const shaftPixel = y >= height * .52 && x >= width * .4 && x <= width * .6 && pixels.data[i] > pixels.data[i + 1] * 1.07 && pixels.data[i + 1] > pixels.data[i + 2] * 1.2;
        const target = shaftPixel || y >= height * .67 ? stick.data : blades.data;
        target.set(pixels.data.subarray(i, i + 4), i);
      }
      r.putImageData(blades, 0, 0); s.putImageData(stick, 0, 0);
      cache.rotor = rotor; cache.shaft = shaft;
    }
    caches.set(canvas, cache);
  }
  const angle = Number.isFinite(degrees) ? degrees : 0;
  if (angle === cache.angle) return true;
  const context = canvas.getContext("2d"); if (!context) return false;
  context.clearRect(0, 0, width, height);
  if (kind === "pinwheel" && cache.rotor && cache.shaft) {
    context.drawImage(cache.shaft, 0, 0);
    context.save(); context.translate(width * .5, height * .35); context.rotate(angle * Math.PI / 180);
    context.drawImage(cache.rotor, -width * .5, -height * .35); context.restore();
  } else if (kind === "spinning-top" || kind === "battle-top-launcher") {
    projectCompanionTopSurface(cache.pixels, cache.output.data, kind, angle); context.putImageData(cache.output, 0, 0);
  } else return false;
  cache.angle = angle; canvas.dataset.motionPainted = performance.now().toFixed(3); canvas.dataset.motionAngle = angle.toFixed(3);
  return true;
}
