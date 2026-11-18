type Eye = { center: readonly number[]; bounds: readonly number[] };
type Glyph = { canvas: HTMLCanvasElement; x: number; y: number };
const glyphs = new WeakMap<HTMLImageElement, Glyph[]>();

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

/** Boundary-matched cream repair instead of a flat rectangular colour plate.
 * Exact old ink is replaced even at the edge; clean skin feathers over2px. */
export function companionFaceBackground(source: Uint8ClampedArray, size: number, box: readonly number[], fallback: readonly number[]) {
  const [left, top, right, bottom] = box, width = right - left + 1, height = bottom - top + 1;
  const result = new Uint8ClampedArray(width * height * 4);
  const skin = (i: number) => source[i] >= 190 && source[i + 1] >= 175 && source[i + 2] >= 130;
  const sample = (x: number, y: number) => { const at = (Math.max(0, Math.min(size - 1, y)) * size + Math.max(0, Math.min(size - 1, x))) * 4; return skin(at) ? [source[at], source[at + 1], source[at + 2]] : fallback; };
  const corners = [sample(left - 1, top - 1), sample(right + 1, top - 1), sample(left - 1, bottom + 1), sample(right + 1, bottom + 1)];
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const u = (x - left + 1) / (width + 1), v = (y - top + 1) / (height + 1), a = sample(left - 1, y), b = sample(right + 1, y), c = sample(x, top - 1), d = sample(x, bottom + 1);
    const i = (y * size + x) * 4, to = ((y - top) * width + x - left) * 4;
    const blend = skin(i) ? Math.min(1, Math.min(x - left, right - x, y - top, bottom - y) / 2) : 1;
    for (let channel = 0; channel < 3; channel++) {
      const corner = corners[0][channel] * (1 - u) * (1 - v) + corners[1][channel] * u * (1 - v) + corners[2][channel] * (1 - u) * v + corners[3][channel] * u * v;
      const background = a[channel] * (1 - u) + b[channel] * u + c[channel] * (1 - v) + d[channel] * v - corner;
      result[to + channel] = source[i + channel] * (1 - blend) + background * blend;
    }
    result[to + 3] = source[i + 3];
  }
  return result;
}
