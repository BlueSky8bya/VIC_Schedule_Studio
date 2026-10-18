// Mechanical whole-cell crop/isotropic registration of one new8-key native.
// No generation, drawing, face transplant, alpha retouch or old-asset changes.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = 'art-src/빅타민/동행/작업회차/20261018-교감살림응원';
const source = `${run}/원본/빅타민_교감살림응원_8키포즈.png`;
const nativeSha256 = '3153807b4b72b56c158d434eaf538d3e3c18ceacb10dab333401776656826a70';
const output = 'public/companion/hd/victamin-episodes-104-v1.webp';
const metadataPath = `${run}/정리본/동작등록.json`, receiptPath = `${run}/패킹파생기록.json`;
const previewPath = `${run}/정리본/검토/등록키포즈.png`;
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(value => value !== '--check')) throw Error('Usage: node scripts/prepare-companion-episodes.mjs [--check]');
const names = ['ask-petting', 'lean-nuzzle', 'paper-knead-left', 'paper-nest-right', 'cheer-tangled', 'cheer-peek', 'cheer-tidy', 'doze-curl'];
const cell = 192, logicalCell = 80, ratio = cell / logicalCell, foot = 180;
const encoding = { quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const round = value => Math.round(value * 1e6) / 1e6;
const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const read = name => fs.readFile(path.join(root, name));

// Same primary alpha-component registration used by the existing recovery
// packer. Measurement never removes or repaints source pixels.
function bodyBounds(bytes, width, height, all = false, minimumPixels = 3000) {
  const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let best; const components = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || bytes[start * 4 + 3] <= 160) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    seen[start] = 1; queue[0] = start;
    while (head < tail) {
      const at = queue[head++], x = at % width, y = Math.floor(at / width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (const next of [x > 0 ? at - 1 : -1, x + 1 < width ? at + 1 : -1, y > 0 ? at - width : -1, y + 1 < height ? at + width : -1]) {
        if (next >= 0 && !seen[next] && bytes[next * 4 + 3] > 160) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    const body = { left, top, right, bottom, width: right - left, height: bottom - top, pixels: tail };
    if (tail > minimumPixels) components.push(body);
    if (!best || tail > best.pixels) best = body;
  }
  if (all) return components;
  if (!best || best.pixels < 100) throw Error('Missing complete native mascot');
  return best;
}

const native = await read(source), info = await sharp(native).metadata();
if (hash(native) !== nativeSha256 || info.width !== 1774 || info.height !== 887 || !info.hasAlpha) throw Error('Pinned8-key native changed');
const rgbaNative = await sharp(native).ensureAlpha().raw().toBuffer();
let transparent = 0, visible = 0;
for (let at = 3; at < rgbaNative.length; at += 4) { if (rgbaNative[at] === 0) transparent++; if (rgbaNative[at] > 160) visible++; }
if (!transparent || !visible) throw Error('Genuine alpha and visible subjects required');
// The generator's first row crosses the nominal half-height line. Find the
// eight actual connected bodies, then split only in the clear gaps between
// rows/columns, following the existing play-sheet complete-body extraction.
const bodies = bodyBounds(rgbaNative, info.width, info.height, true).sort((a, b) => b.pixels - a.pixels).slice(0, 8);
const byIndex = new Map(bodies.map(body => [Math.floor((body.top + body.bottom) / 2 / (info.height / 2)) * 4 + Math.floor((body.left + body.right) / 2 / (info.width / 4)), body]));
if (byIndex.size !== 8 || [...byIndex.keys()].some(index => index < 0 || index >= 8)) throw Error('Ambiguous actual4x2 native body mapping');
const row0Bottom = Math.max(...bodies.filter(body => (body.top + body.bottom) / 2 < info.height / 2).map(body => body.bottom));
const row1Top = Math.min(...bodies.filter(body => (body.top + body.bottom) / 2 >= info.height / 2).map(body => body.top));
if (row0Bottom >= row1Top) throw Error('No transparent gap between complete native rows');
const rowSplit = Math.floor((row0Bottom + row1Top) / 2);
const keys = [];
for (let index = 0; index < names.length; index++) {
  const column = index % 4, row = Math.floor(index / 4);
  const body = byIndex.get(index), previous = byIndex.get(index - 1), next = byIndex.get(index + 1);
  const left = column === 0 ? 0 : Math.floor((previous.right + body.left) / 2), right = column === 3 ? info.width : Math.floor((body.right + next.left) / 2);
  const top = row === 0 ? 0 : rowSplit, bottom = row === 0 ? rowSplit : info.height;
  const nominal = { left, top, width: right - left, height: bottom - top };
  const raw = await sharp(native).extract(nominal).ensureAlpha().raw().toBuffer();
  const sourceBody = bodyBounds(raw, nominal.width, nominal.height);
  if (sourceBody.left < 2 || sourceBody.top < 2 || sourceBody.right > nominal.width - 2 || sourceBody.bottom > nominal.height - 2) throw Error(`Whole mascot crosses source cell${index}`);
  const parts = bodyBounds(raw, nominal.width, nominal.height, true, 30);
  const content = { left: Math.max(0, Math.min(...parts.map(part => part.left)) - 4), top: Math.max(0, Math.min(...parts.map(part => part.top)) - 4), right: Math.min(nominal.width, Math.max(...parts.map(part => part.right)) + 4), bottom: Math.min(nominal.height, Math.max(...parts.map(part => part.bottom)) + 4) };
  const crop = { left: content.left, top: content.top, width: content.right - content.left, height: content.bottom - content.top };
  // The normal frontal paper-body width is367 native pixels (ears excluded).
  // One common130/367 scale applies to every complete pose, including props,
  // intentional leaning, two knead compressions and the low sleeping curl.
  const scale = 130 / 367;
  const resized = await sharp(raw, { raw: { width: nominal.width, height: nominal.height, channels: 4 } }).extract(crop).resize({ width: Math.floor(crop.width * scale), kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const small = bodyBounds(resized.data, resized.info.width, resized.info.height);
  const padLeft = Math.round(cell / 2 - (small.left + small.right) / 2), padTop = foot - small.bottom;
  if (padLeft < 0 || padTop < 0 || padLeft + resized.info.width > cell || padTop + resized.info.height > cell) throw Error(`Complete whole-cell crop does not fit${index}`);
  const rgba = await sharp({ create: { width: cell, height: cell, channels: 4, background: '#0000' } }).composite([{ input: resized.data, raw: { width: resized.info.width, height: resized.info.height, channels: 4 }, left: padLeft, top: padTop }]).raw().toBuffer();
  const packedBody = bodyBounds(rgba, cell, cell);
  const visibleParts = bodyBounds(rgba, cell, cell, true, 3);
  const visibleBounds = { left: Math.min(...visibleParts.map(part => part.left)), top: Math.min(...visibleParts.map(part => part.top)), right: Math.max(...visibleParts.map(part => part.right)), bottom: Math.max(...visibleParts.map(part => part.bottom)) };
  const frame = { index, x: round((cell / 2 - (packedBody.left + packedBody.right) / 2) / ratio), y: round((cell - packedBody.bottom) / ratio), clip: [visibleBounds.top / ratio - 2, (cell - visibleBounds.right) / ratio - 2, (cell - visibleBounds.bottom) / ratio - 2, visibleBounds.left / ratio - 2].map(value => round(Math.max(0, value))) };
  if (packedBody.bottom !== foot || packedBody.width > 154 || packedBody.height > 154) throw Error(`Physical registration failed${index}`);
  keys.push({ rgba, name: names[index], index, nominal, crop, nativeBody: body, sourceBody, scale, resized: { width: resized.info.width, height: resized.info.height }, padding: { left: padLeft, top: padTop }, body: packedBody, visibleBounds, frame, rgbaSha256: hash(rgba) });
}
const rgba = await sharp({ create: { width: cell * 8, height: cell * 2, channels: 4, background: '#0000' } }).composite(keys.map(key => ({ input: key.rgba, raw: { width: cell, height: cell, channels: 4 }, left: key.index * cell, top: 0 }))).raw().toBuffer();
const webp = await sharp(rgba, { raw: { width: cell * 8, height: cell * 2, channels: 4 } }).webp(encoding).toBuffer();
const decoded = await sharp(webp).ensureAlpha().raw().toBuffer();
for (let at = 3; at < rgba.length; at += 4) if (rgba[at] !== decoded[at]) throw Error('WebP alpha changed');
for (let at = cell * 8 * cell * 4 + 3; at < decoded.length; at += 4) if (decoded[at] !== 0) throw Error('Unused second atlas row must remain fully transparent');
const atlas = { src: output.slice('public'.length), sha256: hash(webp), bytes: webp.length, width: cell * 8, height: cell * 2 };
const metadata = { version: 1, cell, logicalCell, grid: 8, gridRows: 2, authoredKeys: 8, unusedTransparentSlots: 8, atlas, frames: keys.map(key => ({ key: key.name, ...key.frame })), proposedLogicalRows: Object.fromEntries(keys.map(key => [key.name, 33 + key.index])) };
const receipt = { version: 1, source, sourceSha256: nativeSha256, native: { width: info.width, height: info.height, transparentPixels: transparent, visiblePixels: visible, rowSplit }, method: 'Eight actual connected native bodies; complete4x2 cells split in clear inter-body gaps; one common isotropic130/367 scale; complete primary alpha component centered at96 and bottom180;8authored keys in first8x1 row, second row transparent. No new drawing or feature-specific scaling.', encoding, generationCallsByThisScript: 0, newGeneratedKeys: 8, frames: keys.map(({ rgba: unused, ...key }) => { void unused; return key; }), atlas, approval: 'GENERATOR_OBSERVED_NOT_NEW_OWNER_VISUAL_APPROVAL_OR_SPECIALIST_PASS' };
const preview = await sharp({ create: { width: cell * 4, height: cell * 2, channels: 4, background: '#fffaf0' } }).composite(keys.map(key => ({ input: key.rgba, raw: { width: cell, height: cell, channels: 4 }, left: key.index % 4 * cell, top: Math.floor(key.index / 4) * cell }))).png().toBuffer();
for (const [name, bytes] of [[output, webp], [metadataPath, jsonBytes(metadata)], [receiptPath, jsonBytes(receipt)], [previewPath, preview]]) {
  const target = path.join(root, name);
  if (check) { if (!(await fs.readFile(target)).equals(bytes)) throw Error(`Derivative differs:${name}`); }
  else {
    await fs.mkdir(path.dirname(target), { recursive: true });
    try { if (!(await fs.readFile(target)).equals(bytes)) throw Error(`Refuse differing existing derivative:${name}`); }
    catch (error) { if (error.code !== 'ENOENT') throw error; await fs.writeFile(target, bytes); }
  }
}
console.log(JSON.stringify({ check, source, sourceSha256: nativeSha256, output, atlas, keys: keys.map(key => ({ name: key.name, frame: key.frame, body: key.body })) }));
