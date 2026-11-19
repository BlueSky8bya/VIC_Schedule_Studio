type Eye = { center: readonly number[]; bounds: readonly number[] };
type Glyph = { canvas: HTMLCanvasElement; x: number; y: number };
const glyphs = new WeakMap<HTMLImageElement, Glyph[]>();
const backgrounds = new WeakMap<Uint8ClampedArray, Map<string, Uint8ClampedArray<ArrayBuffer>>>();

/** Keep the running pupil's brown texture AND enclosed white glint, without
 * transplanting the running pose's rectangular cream background or cheek. */
export function companionEyeGlyph(image: HTMLImageElement, eyes: readonly Eye[], side: number, grid: number, index: number): Glyph {
  let cached = glyphs.get(image);
  if (!cached) {
    const cell = image.naturalWidth / grid;
    cached = eyes.map(eye => {
      const x = Math.floor((eye.bounds[0] - .8) / 80 * cell), y = Math.floor((eye.bounds[1] - 1) / 80 * cell);
      const width = Math.ceil((eye.bounds[2] + .8) / 80 * cell) - x, height = Math.ceil((eye.bounds[3] + 1) / 80 * cell) - y;
      const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(image, index % grid * cell + x, Math.floor(index / grid) * cell + y, width, height, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height), data = pixels.data, count = width * height;
      const seen = new Uint8Array(count), dark = (i: number) => data[i * 4] < 185 && data[i * 4 + 1] < 150 && data[i * 4 + 2] < 130;
      const centre = [eye.center[0] / 80 * cell - x, eye.center[1] / 80 * cell - y];
      let best: number[] = [], distance = Infinity;
      for (let start = 0; start < count; start++) if (!seen[start] && dark(start)) {
        const queue = [start]; seen[start] = 1; let sx = 0, sy = 0;
        for (let q = 0; q < queue.length; q++) { const at = queue[q], px = at % width, py = Math.floor(at / width); sx += px + .5; sy += py + .5;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = px + dx, yy = py + dy, i = yy * width + xx;
            if (xx >= 0 && yy >= 0 && xx < width && yy < height && !seen[i] && dark(i)) { seen[i] = 1; queue.push(i); }
          }
        }
        const d = Math.hypot(sx / queue.length - centre[0], sy / queue.length - centre[1]);
        if (queue.length > 3 && d < distance) { distance = d; best = queue; }
      }
      const ink = new Uint8Array(count), outside = new Uint8Array(count), queue: number[] = [];
      for (const i of best) ink[i] = 1;
      const add = (i: number) => { if (!ink[i] && !outside[i]) { outside[i] = 1; queue.push(i); } };
      for (let px = 0; px < width; px++) { add(px); add((height - 1) * width + px); }
      for (let py = 0; py < height; py++) { add(py * width); add(py * width + width - 1); }
      for (let q = 0; q < queue.length; q++) { const at = queue[q], px = at % width, py = Math.floor(at / width);
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const xx = px + dx, yy = py + dy; if (xx >= 0 && yy >= 0 && xx < width && yy < height) add(yy * width + xx); }
      }
      // The four corners belong to the surrounding skin, not the pupil.
      const background = [0, 1, 2].map(c => [0, width - 1, (height - 1) * width, count - 1].map(i => data[i * 4 + c]).sort((a, b) => a - b)[2]);
      for (let i = 0; i < count; i++) {
        if (!outside[i]) { data[i * 4 + 3] = 255; continue; }
        const px = i % width, py = Math.floor(i / width); let near = false;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = px + dx, yy = py + dy; if (xx >= 0 && yy >= 0 && xx < width && yy < height && ink[yy * width + xx]) near = true; }
        const orange = data[i * 4] > 210 && data[i * 4 + 1] < 190 && data[i * 4 + 2] < 135;
        const alpha = near && !orange ? Math.max(0, Math.min(1, (background[1] - data[i * 4 + 1]) / Math.max(1, background[1] - 45))) : 0;
        if (alpha > .015) for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.max(0, Math.min(255, (data[i * 4 + c] - background[c] * (1 - alpha)) / alpha));
        data[i * 4 + 3] = alpha > .015 ? Math.round(alpha * 255) : 0;
      }
      ctx.putImageData(pixels, 0, 0); return { canvas, x, y };
    });
    glyphs.set(image, cached);
  }
  return cached[side];
}

/** Repair only old ink and its fringe, with the actual surrounding paper as
 * the boundary. Sampling rows from the rectangle's edges projected ink/AA
 * into straight scanlines between the eyes. Harmonic fill has no such edges. */
export function companionFaceBackground(source: Uint8ClampedArray, size: number, box: readonly number[], fallback: readonly number[]) {
  const key = `${size}:${box.join(",")}:${fallback.join(",")}`;
  let cached = backgrounds.get(source);
  if (!cached) { cached = new Map(); backgrounds.set(source, cached); }
  const previous = cached.get(key); if (previous) return previous;
  const [left, top, right, bottom] = box, width = right - left + 1, height = bottom - top + 1;
  const result = new Uint8ClampedArray(width * height * 4);
  const skin = (i: number) => source[i] >= 190 && source[i + 1] >= 175 && source[i + 2] >= 130;
  // Include a fixed exterior ring. The result still owns only the admitted box.
  const stride = width + 2, field = new Float32Array(stride * (height + 2) * 3), mask: number[] = [];
  for (let y = top - 1; y <= bottom + 1; y++) for (let x = left - 1; x <= right + 1; x++) {
    const sx = Math.max(0, Math.min(size - 1, x)), sy = Math.max(0, Math.min(size - 1, y));
    const i = (sy * size + sx) * 4, to = ((y - top + 1) * stride + x - left + 1) * 3;
    for (let c = 0; c < 3; c++) field[to + c] = skin(i) ? source[i + c] : fallback[c];
  }
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const i = (y * size + x) * 4, to = ((y - top) * width + x - left) * 4;
    let nearInk = !skin(i);
    if (!nearInk) for (let dy = -2; dy <= 2 && !nearInk; dy++) for (let dx = -2; dx <= 2 && !nearInk; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < size && yy < size && !skin((yy * size + xx) * 4)) nearInk = true;
    }
    for (let c = 0; c < 3; c++) result[to + c] = source[i + c];
    if (nearInk) mask.push((y - top + 1) * stride + x - left + 1);
    result[to + 3] = source[i + 3];
  }
  for (let pass = 0; pass < 160; pass++) {
    let change = 0;
    for (const at of mask) for (let c = 0; c < 3; c++) {
      const i = at * 3 + c, value = (field[i - 3] + field[i + 3] + field[i - stride * 3] + field[i + stride * 3]) / 4;
      change = Math.max(change, Math.abs(field[i] - value)); field[i] = value;
    }
    if (change < .015) break;
  }
  for (const at of mask) {
    const x = at % stride - 1, y = Math.floor(at / stride) - 1, to = (y * width + x) * 4;
    for (let c = 0; c < 3; c++) result[to + c] = field[at * 3 + c];
  }
  // A moving expression may admit several rectangles on one source cell.
  // Keep this bounded; the WeakMap releases all of them with that source.
  if (cached.size >= 24) cached.clear();
  cached.set(key, result); return result;
}
