// Measure the preserved atlas, never repaint/re-encode the native or public
// image. The only output is a renderer registration/clip metadata table.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = 'public/companion/victamin-motion.webp';
const native = 'art-src/빅타민/동행/작업회차/20261015-달력탐험/원본/빅타민_256동작.png';
const output = 'lib/ui/viewer-companion/sprite-registration.json';
const assetSha256 = '535d67d02bac975e0f2c41b3d34dadcb393b9ba1cfab3d87187a5017a9d5d24f';
const nativeSha256 = '2c6d49304ff53970f35cbb7fcc86d3014fe06f047c8d90abdc862bf5a28d8749';
const cell = 80, grid = 16, threshold = 160, margin = 2;
// The generated preparation/landing rows contain more than one squat/recover
// cycle. Select one observed semantic sequence rather than racing two cycles
// through180ms. These are existing drawings, not newly generated frames.
const clips = {
  0: [6, 7, 8, 9], 1: [8, 9, 10, 11], 2: [5, 6, 7, 8],
  3: [6, 4, 2, 1], 4: [6, 7, 8, 9], 5: [7, 8, 9, 10], 6: [1, 2, 4, 5],
  7: [0, 2, 4, 6], 8: [12, 13, 14, 15], 9: [0, 1, 2, 3],
  10: [0, 2, 4, 7, 11, 15], 11: [2, 3, 4, 5, 6], 12: [0, 3, 5, 7, 11, 15],
  13: [4, 5, 6, 7], 14: [0, 4, 8, 12, 15], 15: [0, 4, 8, 12, 15],
};
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const round = value => Math.round(value * 1e6) / 1e6;
const median = values => { const sorted = [...values].sort((a, b) => a - b); return (sorted[7] + sorted[8]) / 2; };

if (process.argv.slice(2).some(arg => arg !== '--check')) throw Error('Usage: node scripts/measure-companion-registration.mjs [--check]');
const check = process.argv.includes('--check');
const [assetBytes, nativeBytes] = await Promise.all([fs.readFile(path.join(root, source)), fs.readFile(path.join(root, native))]);
if (hash(assetBytes) !== assetSha256 || hash(nativeBytes) !== nativeSha256) throw Error('Pinned companion pixels changed; registration must not silently follow a new asset');
const { data, info } = await sharp(assetBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (info.width !== cell * grid || info.height !== cell * grid || info.channels !== 4) throw Error('Expected the preserved 1280x1280 RGBA companion atlas');

function measure(row, column) {
  const mask = new Uint8Array(cell * cell), visited = new Uint8Array(cell * cell), components = [];
  for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
    const alpha = data[((row * cell + y) * info.width + column * cell + x) * 4 + 3];
    if (alpha >= threshold) mask[y * cell + x] = 1;
  }
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index] || visited[index]) continue;
    const queue = [index]; visited[index] = 1;
    for (let head = 0; head < queue.length; head++) {
      const point = queue[head], x = point % cell, y = Math.floor(point / cell);
      for (let nextY = Math.max(0, y - 1); nextY <= Math.min(cell - 1, y + 1); nextY++) {
        for (let nextX = Math.max(0, x - 1); nextX <= Math.min(cell - 1, x + 1); nextX++) {
          const next = nextY * cell + nextX;
          if (mask[next] && !visited[next]) { visited[next] = 1; queue.push(next); }
        }
      }
    }
    components.push(queue);
  }
  components.sort((a, b) => b.length - a.length);
  const body = components[0];
  if (!body || body.length < 100) throw Error(`Missing main body in frame ${row}:${column}`);
  const xs = body.map(point => point % cell), ys = body.map(point => Math.floor(point / cell));
  // Rectangle edges are pixel edges; right/bottom are exclusive. Pixel centres
  // are x+.5/y+.5, so the foot's horizontal centroid uses the same CSS geometry.
  const left = Math.min(...xs), top = Math.min(...ys), right = Math.max(...xs) + 1, bottom = Math.max(...ys) + 1;
  const band = body.filter(point => Math.floor(point / cell) >= bottom - 5);
  const footCenterX = band.reduce((sum, point) => sum + point % cell + .5, 0) / band.length;
  const x = round(cell / 2 - footCenterX), y = cell - bottom;
  const clip = [Math.max(0, top - margin), Math.max(0, cell - right - margin), Math.max(0, cell - bottom - margin), Math.max(0, left - margin)];
  if (clip.some(value => value < 0 || value >= cell) || clip[0] + clip[2] >= cell || clip[1] + clip[3] >= cell) throw Error(`Invalid protective clip in ${row}:${column}`);
  if (left - clip[3] < margin || top - clip[0] < margin || cell - clip[1] - right < margin || cell - clip[2] - bottom < margin) throw Error(`Body stroke margin lost in ${row}:${column}`);
  return { frame: { x, y, clip }, body: { left, top, right, bottom, width: right - left, height: bottom - top, centerX: (left + right) / 2, footCenterX }, secondaryPixels: components[1]?.length ?? 0 };
}

const measured = Array.from({ length: grid }, (_, row) => Array.from({ length: grid }, (_, column) => measure(row, column)));
const table = { assetSha256, cell, frames: measured.map(row => row.map(item => item.frame)), clips };
const serialized = `${JSON.stringify(table, null, 2)}\n`;
if (check) {
  if (await fs.readFile(path.join(root, output), 'utf8') !== serialized) throw Error('Companion registration table differs from the pinned, reproducible measurement');
} else {
  await fs.writeFile(path.join(root, output), serialized);
}

const flat = measured.flat();
const beforeX = Math.max(...flat.map(item => Math.abs(item.body.footCenterX - cell / 2)));
const beforeY = Math.max(...flat.map(item => Math.abs(item.body.bottom - cell)));
const afterX = Math.max(...flat.map(item => Math.abs(item.body.footCenterX + item.frame.x - cell / 2)));
const afterY = Math.max(...flat.map(item => Math.abs(item.body.bottom + item.frame.y - cell)));
if (afterX > .000001 || afterY > .000001) throw Error('Registration failed the measured horizontal/foot anchor');
const currentHashes = await Promise.all([fs.readFile(path.join(root, source)), fs.readFile(path.join(root, native))]);
if (hash(currentHashes[0]) !== assetSha256 || hash(currentHashes[1]) !== nativeSha256) throw Error('An input image changed during metadata measurement');
const rows = measured.map((row, index) => {
  const body = row.map(item => item.body);
  const width = median(body.map(item => item.width)), height = median(body.map(item => item.height)), centerX = median(body.map(item => item.centerX)), bottom = median(body.map(item => item.bottom));
  return { row: index, median: { width, height, centerX, bottom }, maxDeviation: { centerX: Math.max(...body.map(item => Math.abs(item.centerX - centerX))), bottom: Math.max(...body.map(item => Math.abs(item.bottom - bottom))) } };
});
console.log(JSON.stringify({ output, check, imagesUnchanged: true, assetSha256, nativeSha256, cells: flat.length, threshold, margin, maxSecondaryComponentPixels: Math.max(...flat.map(item => item.secondaryPixels)), maxAnchorError80px: { before: { x: round(beforeX), y: beforeY }, after: { x: Number(afterX.toFixed(9)), y: afterY } }, rows }, null, 2));
