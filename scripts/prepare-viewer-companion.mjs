// A fixed 16x16 native becomes 256 padded cells. No repaint, mirroring or pose
// fabrication: every cell comes from its own generator drawing; preserve native.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
const run = 'art-src/빅타민/동행/작업회차/20261015-달력탐험';
const source = `${run}/원본/빅타민_256동작.png`;
const raw = await fs.readFile(source), hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
if (hash(raw) !== '2c6d49304ff53970f35cbb7fcc86d3014fe06f047c8d90abdc862bf5a28d8749') throw Error('Preserved companion native changed');
const { width, height, hasAlpha } = await sharp(raw).metadata();
if (!width || !height || !hasAlpha || width !== height) throw Error('Square RGBA native required');
const cells = [], receipts = [], unique = new Set();
for (let row = 0; row < 16; row++) for (let column = 0; column < 16; column++) {
  const left = Math.round(column * width / 16), top = Math.round(row * height / 16);
  const box = { left, top, width: Math.round((column + 1) * width / 16) - left, height: Math.round((row + 1) * height / 16) - top };
  const png = await sharp(raw).extract(box).resize(64, 64, { fit: 'contain', kernel: 'nearest', background: '#0000' }).extend({ top: 8, bottom: 8, left: 8, right: 8, background: '#0000' }).png().toBuffer();
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let opaque = 0; for (let i = 3; i < data.length; i += info.channels) if (data[i] > 160) opaque++;
  if (opaque < 100) throw Error(`Empty/sparse cell ${row}:${column}`);
  const sha256 = hash(png); unique.add(sha256); receipts.push({ row, column, box, opaque, sha256 });
  cells.push({ input: png, left: column * 80, top: row * 80 });
}
if (unique.size !== 256) throw Error(`Only ${unique.size} byte-distinct cells; do not claim 256 unique drawings`);
const output = 'public/companion/victamin-motion.webp';
const derived = await sharp({ create: { width: 1280, height: 1280, channels: 4, background: '#0000' } }).composite(cells).webp({ lossless: true }).toBuffer();
await fs.mkdir('public/companion', { recursive: true }); await fs.writeFile(output, derived);
await fs.writeFile(`${run}/파생기록.json`, JSON.stringify({ source, nativeSha256: hash(raw), nativeGeometry: [width, height], grid: [16, 16], cell: 80, uniqueCells: unique.size, output, outputSha256: hash(derived), bytes: derived.length, process: 'Per-grid-cell extraction, nearest uniform containment64px, transparent8px padding, losslessWebP. No repaint or manual pose edits.', cells: receipts, approval: 'Requested draft integration. Generator observation only; byte-distinct frames are not 256 independently approved poses.' }, null, 2) + '\n');
console.log(JSON.stringify({ output, bytes: derived.length, uniqueCells: unique.size, native: [width, height], nativeSha256: hash(raw) }));
