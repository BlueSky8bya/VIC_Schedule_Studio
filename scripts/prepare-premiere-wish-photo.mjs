// Whole owner-selected original; only uniform downsampling and WebP encoding.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';

const folder = 'art-src/최초공개/응원단/작업회차/20261015-기대배경';
const source = `${folder}/고정입력/28241791931065693.png`;
const bytes = await fs.readFile(source);
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const sourceSha = 'fca977c3e789d2c033a2076cba7317deed9d4af177b1550ea3eda8faaf9ac720';
if (hash(bytes) !== sourceSha) throw new Error('Read-only original changed');
const result = await sharp(bytes).resize({ width: 1536, withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
const output = 'public/premiere/victory-wish.webp';
await fs.writeFile(output, result);
await fs.writeFile(`${folder}/파생기록.json`, JSON.stringify({ source, sourceSha, output, outputSha: hash(result), bytes: result.length, method: 'Whole original, proportional resize to 1536x864, WebP 88, metadata stripped. No generation, crop, facial editing or compositing.' }, null, 2) + '\n');
console.log(`${output}: ${result.length} bytes`);
