// Uniform atlas downsample only. Keep the original generator native unchanged.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
const run = 'art-src/최초공개/응원단/작업회차/20261014-움직이는응원단';
const native = `${run}/원본/빅타민_응원과관람_16프레임.png`;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = await fs.readFile(native);
if (hash(bytes) !== 'f36c8060b0ce35582b54256b5ab403d5734e2d452b44386ce28f04ed9b1459b6') throw new Error('Preserved audience native changed');
const { width, height, hasAlpha } = await sharp(bytes).metadata();
if (width !== 1254 || height !== 1254 || !hasAlpha) throw new Error('Unexpected atlas geometry/alpha');
const output = 'public/premiere/victamin-audience.webp';
const derived = await sharp(bytes).resize(1024, 1024).webp({ quality: 88, alphaQuality: 100 }).toBuffer();
await fs.writeFile(output, derived);
await fs.writeFile(`${run}/파생기록.json`, JSON.stringify({
  native, sha256: hash(bytes), nativeGeometry: [width, height],
  processing: 'Uniform whole-atlas downsample1254→1024 and WebP encoding. Native alpha preserved; no repaint, segmentation, frame transplant or local correction.',
  grid: [4, 4], frameSize: [256, 256],
  cheeringFrames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 11], settlingFrames: [12, 13, 14, 15],
  excludedFrames: { 9: 'Inner-ear colors reversed against REF-016/017', 10: 'Inner-ear colors reversed against REF-016/017' },
  output: { path: output, bytes: derived.length, sha256: hash(derived) },
  approval: 'Requested implementation; producer observation only. No owner visual approval or independent art PASS inferred.'
}, null, 2) + '\n');
console.log(`${output}: ${derived.length} bytes`);
