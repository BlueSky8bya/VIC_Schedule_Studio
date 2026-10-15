// Preserve the generator's16 native drawings. Only grid extraction, a shared
// Lanczos3 scale and transparent padding produce this runtime atlas.
// Registration/clip hides distant alpha specks in CSS; no pixel is repainted.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = 'art-src/빅타민/동행/작업회차/20261015-깔끔한키포즈';
const source = `${run}/원본/빅타민_16키포즈.png`;
const output = 'public/companion/victamin-clean.webp';
const metadata = 'lib/ui/viewer-companion/clean-sprite.json';
const receipt = `${run}/파생기록.json`;
const nativeSha256 = 'd303c111b3671dffe1b7bcd529c900f63c4d54f178c4bbd097ab2f8c8603ef47';
const grid = 4, packedCell = 128, unitCell = 80, threshold = 160, margin = 2;
// The existing geometry measures a .76-cell collision envelope. Keep the
// complete measured component inside it, including its ears, without changing
// geometry.60units is below both that60.8-unit envelope and the requested72 cap.
const maxBody = { width: 55, height: 60 };
const rows = [[0, 1], [0], [2, 3], [0, 4], [5], [6], [7, 0], [0], [8], [9], [10], [11], [12, 0], [13], [14], [15]];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const round = number => Math.round(number * 1e6) / 1e6;
const absolute = name => path.join(root, name);
if (process.argv.slice(2).some(arg => arg !== '--check')) throw Error('Usage: node scripts/prepare-viewer-companion-clean.mjs [--check]');
const check = process.argv.includes('--check');

/** Eight-connected alpha>160. Bounding edges are exclusive CSS pixel edges. */
function primaryComponent(data, width, height) {
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let main = null, secondaryPixels = 0;
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] <= threshold) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    visited[start] = 1; queue[0] = start;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
          const next = yy * width + xx;
          if (!visited[next] && data[next * 4 + 3] > threshold) { visited[next] = 1; queue[tail++] = next; }
        }
      }
    }
    const component = { left, top, right, bottom, width: right - left, height: bottom - top, pixels: tail };
    if (!main || component.pixels > main.pixels) { if (main) secondaryPixels = Math.max(secondaryPixels, main.pixels); main = component; }
    else secondaryPixels = Math.max(secondaryPixels, component.pixels);
  }
  if (!main || main.pixels < 100) throw Error('Missing/sparse main alpha component');
  return { ...main, secondaryPixels };
}

const raw = await fs.readFile(absolute(source));
if (hash(raw) !== nativeSha256) throw Error('Preserved clean companion native changed');
const { width, height, hasAlpha } = await sharp(raw).metadata();
if (width !== 1254 || height !== 1254 || !hasAlpha) throw Error('Expected the preserved1254x1254 RGBA4x4 native');
const extracted = [];
for (let index = 0; index < grid * grid; index++) {
  const column = index % grid, row = Math.floor(index / grid);
  const left = Math.round(column * width / grid), top = Math.round(row * height / grid);
  const box = { left, top, width: Math.round((column + 1) * width / grid) - left, height: Math.round((row + 1) * height / grid) - top };
  const native = await sharp(raw).extract(box).ensureAlpha().raw().toBuffer();
  extracted.push({ index, box, native, body: primaryComponent(native, box.width, box.height) });
}
const unit = unitCell / packedCell;
// One scale across every drawing preserves authored size changes. Each output
// is padded, never stretched independently to fill its cell.
const scaleLimit = Math.min(...extracted.flatMap(item => [
  (packedCell - 2 * margin) / item.box.width,
  (packedCell - 2 * margin) / item.box.height,
  maxBody.width / unit / item.body.width,
  maxBody.height / unit / item.body.height,
]));
// Resize the complete square once. Its alternating313/314 native grid cells
// then share one exact scale, rather than16 slightly different integer fits.
const scaledCell = Math.floor(scaleLimit * width / grid);
if (scaledCell < 1) throw Error('Invalid common scaled cell');
const scaledSide = scaledCell * grid, scale = scaledSide / width;
const scaledNative = await sharp(raw).resize(scaledSide, scaledSide, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
const composites = [], frames = [], cells = [], unique = new Set();
for (const item of extracted) {
  const scaledWidth = scaledCell, scaledHeight = scaledCell;
  const resized = await sharp(scaledNative, { raw: { width: scaledSide, height: scaledSide, channels: 4 } })
    .extract({ left: item.index % grid * scaledCell, top: Math.floor(item.index / grid) * scaledCell, width: scaledCell, height: scaledCell }).raw().toBuffer();
  const padLeft = Math.floor((packedCell - scaledWidth) / 2), padTop = Math.floor((packedCell - scaledHeight) / 2);
  const packed = await sharp(resized, { raw: { width: scaledWidth, height: scaledHeight, channels: 4 } })
    .extend({ left: padLeft, right: packedCell - scaledWidth - padLeft, top: padTop, bottom: packedCell - scaledHeight - padTop, background: '#0000' }).png().toBuffer();
  const packedPixels = await sharp(packed).ensureAlpha().raw().toBuffer();
  const body = primaryComponent(packedPixels, packedCell, packedCell);
  if (body.width * unit > maxBody.width || body.height * unit > maxBody.height) throw Error(`Collision envelope exceeded in cell${item.index}`);
  const x = round(unitCell / 2 - (body.left + body.right) / 2 * unit), y = round(unitCell - body.bottom * unit);
  const clipPixels = [body.top - margin, packedCell - body.right - margin, packedCell - body.bottom - margin, body.left - margin];
  if (clipPixels.some(value => value < 0) || clipPixels[0] + clipPixels[2] >= packedCell || clipPixels[1] + clipPixels[3] >= packedCell) throw Error(`Main stroke margin lost in cell${item.index}`);
  const frame = { x, y, clip: clipPixels.map(value => round(value * unit)) };
  const anchor = { centerX: round((body.left + body.right) / 2 * unit + x), footY: round(body.bottom * unit + y) };
  if (anchor.centerX !== 40 || anchor.footY !== 80) throw Error(`Registration anchor changed in cell${item.index}`);
  const pngSha256 = hash(packed); unique.add(pngSha256); frames.push(frame);
  cells.push({ index: item.index, nativeBox: item.box, nativeCellSha256: hash(item.native), nativeBody: item.body,
    resized: [scaledWidth, scaledHeight], padding: [padLeft, padTop], packedPngSha256: pngSha256, body,
    bodyUnits: { width: round(body.width * unit), height: round(body.height * unit) }, anchor, registration: frame });
  composites.push({ input: packed, left: item.index % grid * packedCell, top: Math.floor(item.index / grid) * packedCell });
}
if (unique.size !== 16) throw Error(`Only${unique.size} byte-distinct drawings; expected16 native cells`);
const derived = await sharp({ create: { width: grid * packedCell, height: grid * packedCell, channels: 4, background: '#0000' } })
  .composite(composites).webp({ lossless: true, effort: 6 }).toBuffer();
const table = `${JSON.stringify({ grid, frames, rows }, null, 2)}\n`;
const record = `${JSON.stringify({ source, nativeSha256, nativeBytes: raw.length, nativeGeometry: [width, height],
  output, outputSha256: hash(derived), bytes: derived.length, geometry: [grid * packedCell, grid * packedCell], grid, packedCell, registrationUnitCell: unitCell,
  metadata, metadataSha256: hash(table), threshold, connected: 8, clipMarginPixels: margin, commonScale: scale, scaledNativeGeometry: [scaledSide, scaledSide], resizeKernel: 'lanczos3', maxBodyUnits: maxBody, uniqueCells: unique.size,
  process: 'Preserve16 fixed4x4 native cell records; uniformly downsample the whole native once with Lanczos3, then extract16 equal cells; transparent padding; losslessWebP. Main alpha>160 component bbox centre40/foot80 registration. Secondary alpha/colour is not manually erased; CSSclip hides distant specks. No repaint, denoise, mirroring, generated in-betweens or native edits.',
  cells, approval: 'Engineering derivation only. No independent art review or owner visual acceptance inferred.' }, null, 2)}\n`;
const products = [[output, derived], [metadata, table], [receipt, record]];
if (hash(await fs.readFile(absolute(source))) !== nativeSha256) throw Error('Preserved native changed during derivation');
for (const [name, bytes] of products) {
  if (check) { if (hash(await fs.readFile(absolute(name))) !== hash(bytes)) throw Error(`Reproducibility mismatch:${name}`); }
  else { await fs.mkdir(path.dirname(absolute(name)), { recursive: true }); await fs.writeFile(absolute(name), bytes); }
}
console.log(JSON.stringify({ check, source, nativeSha256, output, outputSha256: hash(derived), bytes: derived.length, grid, packedCell,
  frames: frames.length, commonScale: scale, maxBodyUnits: { width: Math.max(...cells.map(item => item.bodyUnits.width)), height: Math.max(...cells.map(item => item.bodyUnits.height)) }, metadata }));
