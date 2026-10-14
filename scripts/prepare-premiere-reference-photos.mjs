// Owner-provided photographs, cropped as whole pictures. No generated facial
// pixels, eye transforms, transplanted head, background removal or grafting.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
const folder = 'art-src/최초공개/응원단/작업회차/20261015-원본사진반응';
const sources = [
  { name: 'neutral', file: '기본_원본.png', id: 'REF-004', sha: 'b799c830d2e4eec4ab464c7f07de296560d184b4a487016ff330b750440615ee', box: [240, 0, 640, 800] },
  { name: 'delighted', file: '웃음_원본.png', id: 'REF-284', sha: '7f11cccd01fdcd5f2817144a4b1c79091501f0ba64cdfac5a5890ad5b49824ea', box: [125, 0, 440, 550] },
  { name: 'unimpressed', file: '경멸_원본.png', id: 'REF-120', sha: '0b56d6554ad02b333616ab5c84def06636f6c46db91215424f7894f0a30bc151', box: [18, 0, 480, 600] }
];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const outputs = [];
await fs.mkdir('public/premiere', { recursive: true });
for (const source of sources) {
  const file = path.join(folder, '고정입력', source.file), bytes = await fs.readFile(file);
  if (hash(bytes) !== source.sha) throw new Error(`Changed read-only original ${source.id}`);
  const [left, top, width, height] = source.box;
  const result = await sharp(bytes).extract({ left, top, width, height }).resize(320, 400).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  const output = `public/premiere/tori-photo-${source.name}.webp`;
  await fs.writeFile(output, result);
  outputs.push({ source_id: source.id, source: file, source_sha256: source.sha, crop_xywh: source.box, output, width: 320, height: 400, bytes: result.length, sha256: hash(result) });
}
await fs.writeFile(path.join(folder, '파생기록.json'), JSON.stringify({ method: 'Whole-photo crop and uniform resize only. Original expression/perspective/wardrobe/background retained. No imagegen, donor-parts or face compositing.', outputs }, null, 2) + '\n');
console.log(outputs.map(x => `${x.output}: ${x.bytes} bytes`).join('\n'));
