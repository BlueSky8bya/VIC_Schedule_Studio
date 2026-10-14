// Deterministic sprite extraction only. The unmodified generator native and
// prompt/lineage stay in the Korean source archive; no runtime source import.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const source = path.resolve('art-src/최초공개/응원단/작업회차/20261014/원본/최초공개_표정과응원_원본.png');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const bytes = await fs.readFile(source);
if (hash(bytes) !== '05d73d85bd98874a9e874158d841b407648b1409c9f8ccd0ffbc89e717b2e8ee') throw new Error('Preserved generation native changed');
const { width, height } = await sharp(bytes).metadata();
if (width !== 1254 || height !== 1254) throw new Error('Unexpected native geometry');
// Rejected generated human expressions are no longer runtime deliverables.
// Actual owner-provided photographs use prepare-premiere-reference-photos.mjs.
const variants = [['victamin-cheer', 0, 627], ['victamin-seated', 627, 627]];
await fs.mkdir('public/premiere', { recursive: true });
const derivatives = [];
for (const [name, left, top] of variants) {
  const output = `public/premiere/${name}.webp`;
  const buffer = await sharp(bytes).extract({ left, top, width: 627, height: 627 }).resize(480, 480).webp({ quality: 86, alphaQuality: 100 }).toBuffer();
  await fs.writeFile(output, buffer);
  derivatives.push({ path: output, box: [left, top, left + 627, top + 627], width: 480, height: 480, sha256: hash(buffer), bytes: buffer.length });
}
await fs.writeFile(path.join(path.dirname(source), '../파생기록.json'), JSON.stringify({ native: path.relative(process.cwd(), source), sha256: hash(bytes), mode: 'builtin imagegen; one generation; draft, no human visual approval claimed', processing: 'quadrant extraction, uniform downsample, WebP; native alpha preserved', derivatives }, null, 2) + '\n');
console.log(derivatives.map(x => `${x.path}: ${x.bytes} bytes`).join('\n'));
