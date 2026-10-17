// Mechanical registration of four newly generated whole-body airborne keys.
// No facial repaint, extra generated frames, old source overwrite or runtime IO.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = 'art-src/빅타민/동행/작업회차/20261017-관성비행';
const source = `${run}/원본/빅타민_관성비행_4키포즈.png`;
const output = 'public/companion/hd/victamin-play-32-throw.webp';
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(value => value !== '--check')) throw Error('Usage: node scripts/prepare-companion-throw.mjs [--check]');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const round = value => Math.round(value * 1e6) / 1e6;
const native = await fs.readFile(path.join(root, source));
if (hash(native) !== '728098be7cd6731628b18f7bc0331b620768c7a5db4765b56dd8337468de4498') throw Error('Airborne native changed');
const { data, info } = await sharp(native).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== 1288 || info.height !== 1221) throw Error('Unexpected airborne native dimensions');
const cell = 192, logicalCell = 80, ratio = cell / logicalCell, nativeCell = info.width / 2;

// Main connected silhouette supplies the bounds. Copy the whole RGBA crop,
// including its natural antialiasing; never paint/denoise character pixels.
function bodyBounds(bytes, width, height) {
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let best;
  for (let i = 0; i < visited.length; i++) {
    if (visited[i] || bytes[i * 4 + 3] <= 160) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    queue[0] = i; visited[i] = 1;
    while (head < tail) {
      const at = queue[head++], x = at % width, y = Math.floor(at / width);
      left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      for (const next of [x > 0 ? at - 1 : -1, x + 1 < width ? at + 1 : -1, y > 0 ? at - width : -1, y + 1 < height ? at + width : -1]) {
        if (next >= 0 && !visited[next] && bytes[next * 4 + 3] > 160) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    if (!best || tail > best.pixels) best = { left, top, right, bottom, width: right - left, height: bottom - top, pixels: tail };
  }
  if (!best || best.pixels < width * height * .1) throw Error('No complete recovery body');
  return best;
}

const keys = [];
for (let index = 0; index < 4; index++) {
  // The provider's two rows are not equal: the lower ears cross the numeric
  // halfway line. Split in the actual transparent gutter, preserving whole
  // connected characters and the odd final scanline without rescaling native.
  const row = Math.floor(index / 2), cellTop = row === 0 ? 0 : 580;
  const nominal = { left: index % 2 * nativeCell, top: cellTop, width: nativeCell, height: (row === 0 ? 580 : info.height) - cellTop };
  const raw = await sharp(data, { raw: info }).extract(nominal).raw().toBuffer();
  const bounds = bodyBounds(raw, nominal.width, nominal.height);
  if (bounds.left < 3 || bounds.top < 3 || bounds.right > nominal.width - 3 || bounds.bottom > nominal.height - 3) throw Error(`Airborne body crosses cell ${index}`);
  const crop = { left: Math.max(0, bounds.left - 3), top: Math.max(0, bounds.top - 3), width: bounds.width + 6, height: bounds.height + 6 };
  const scale = Math.min(141 / bounds.width, 151 / bounds.height);
  const resizedResult = await sharp(raw, { raw: { width: nominal.width, height: nominal.height, channels: 4 } }).extract(crop).resize({ width: Math.floor(crop.width * scale), kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const resized = resizedResult.data, { width, height } = resizedResult.info;
  const small = bodyBounds(resized, width, height);
  const left = Math.round(cell / 2 - (small.left + small.right) / 2), top = 180 - small.bottom;
  const rgba = await sharp({ create: { width: cell, height: cell, channels: 4, background: '#0000' } }).composite([{ input: resized, raw: { width, height, channels: 4 }, left, top }]).raw().toBuffer();
  const body = bodyBounds(rgba, cell, cell);
  const frame = { x: round((cell / 2 - (body.left + body.right) / 2) / ratio), y: round((cell - body.bottom) / ratio), clip: [body.top / ratio - 2, (cell - body.right) / ratio - 2, (cell - body.bottom) / ratio - 2, body.left / ratio - 2].map(round) };
  if (frame.clip.some(value => value < 0) || body.width > 144 || body.height > 154) throw Error(`Recovery registration failed ${index}`);
  keys.push({ rgba, frame, index, nominal, bounds, crop, scale, width, height, body, rgbaSha256: hash(rgba) });
}
const columns = Array.from({ length: 16 }, (_, column) => Math.floor(column / 4));
const rgba = await sharp({ create: { width: cell * 8, height: cell * 2, channels: 4, background: '#0000' } }).composite(columns.map((key, column) => ({ input: keys[key].rgba, raw: { width: cell, height: cell, channels: 4 }, left: column % 8 * cell, top: Math.floor(column / 8) * cell }))).raw().toBuffer();
const encoding = { quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 };
const webp = await sharp(rgba, { raw: { width: cell * 8, height: cell * 2, channels: 4 } }).webp(encoding).toBuffer();
const decoded = await sharp(webp).ensureAlpha().raw().toBuffer();
for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== decoded[i]) throw Error('Recovery alpha changed in encoding');
const metadataPath = path.join(root, 'lib/ui/viewer-companion/play-motion-sprite.json');
const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
const atlas = { src: output.slice('public'.length), sha256: hash(webp), bytes: webp.length, width: cell * 8, height: cell * 2 };
const frames = columns.map((key, column) => ({ atlas: 12, index: column, ...keys[key].frame }));
const row = columns.map((unused, column) => { void unused; return 192 + column; });
const record = { source, sourceSha256: hash(native), nativeWidth: info.width, nativeHeight: info.height, newlyGeneratedKeys: 4, derivedFrameSlots: 16, generationCallsByThisScript: 0, method: '2x2 whole-body RGBA crops, uniform downscale with integer rounding, centre/foot registration; no facial painting or new intermediate drawings', encoding, keys: keys.map(({ rgba: unused, ...key }) => { void unused; return key; }), columns, atlas };
if (check) {
  const saved = await fs.readFile(path.join(root, output));
  if (!saved.equals(webp) || JSON.stringify(metadata.atlases[12]) !== JSON.stringify(atlas) || JSON.stringify(metadata.frames.slice(192, 208)) !== JSON.stringify(frames) || JSON.stringify(metadata.rows[12]) !== JSON.stringify(row)) throw Error('Airborne derivatives differ');
  const receipt = JSON.parse(await fs.readFile(path.join(root, run, '패킹파생기록.json'), 'utf8'));
  if (JSON.stringify(receipt) !== JSON.stringify(record)) throw Error('Recovery receipt differs');
} else {
  await fs.writeFile(path.join(root, output), webp);
  if (![12, 13].includes(metadata.atlases.length) || ![192, 208].includes(metadata.frames.length) || ![12, 13].includes(metadata.rows.length)) throw Error('Unexpected existing play lineage');
  metadata.atlases[12] = atlas; metadata.frames.splice(192, 16, ...frames); metadata.rows[12] = row;
  await fs.writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  await fs.writeFile(path.join(root, run, '패킹파생기록.json'), `${JSON.stringify(record, null, 2)}\n`);
}
console.log(JSON.stringify({ check, sourceSha256: record.sourceSha256, newlyGeneratedKeys: 4, derivedFrameSlots: 16, atlas: atlas.src, bytes: webp.length }));
