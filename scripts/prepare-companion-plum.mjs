// A code-native vector correction, not image generation or an upstream plum.
// Preserve the eight pinned Noto originals and every other delivered snack.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'public/companion/food');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) throw Error('Usage: node scripts/prepare-companion-plum.mjs [--check]');
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const priorPlumSha256 = 'fa6913b2ec7de27b806e8e2d2708f9f6c4764c624e1ed668a994303072a2d234';
const svg = `<?xml version="1.0" encoding="utf-8"?>
<!-- Modified for VIC Schedule Studio, 2026-10-15: code-native red plum contour using Noto Emoji food colour/shading conventions. This is not an upstream plum SVG. See SOURCES.md and LICENSE.txt. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <path fill="#8E344B" d="M64 23C84 19 105 31 114 52c12 27-3 58-29 68-24 9-54-1-67-24C4 71 13 42 35 29c10-6 20-7 29-6Z"/>
  <path fill="#C05C68" d="M64 23c-21-5-44 11-49 35-6 25 9 51 31 59 16 5 29 1 40-9 17-16 24-44 14-63-9-17-22-24-36-22Z"/>
  <path fill="#AB4A5D" d="M101 45c9 27-2 53-24 67-10 6-23 9-35 4 15 10 32 11 46 5 25-11 38-41 26-67-3-6-7-11-13-16l0 7Z"/>
  <!-- A broad, quiet wax bloom; no purple recolour, leaf or apple shoulder. -->
  <path fill="#E5C4CA" opacity=".24" d="M58 29c-16-2-33 10-38 27-3 11-2 22 3 30-2-16 2-30 12-39 9-8 20-10 32-8 10 1 20 7 26 17-4-15-19-25-35-27Z"/>
  <path d="M65 29c-7 10-7 22-3 35 5 16 7 33 0 47" fill="none" stroke="#843047" stroke-width="2.5" stroke-linecap="round" opacity=".42"/>
  <path d="M60 28c3-1 7-1 10 0" fill="none" stroke="#692F36" stroke-width="3" stroke-linecap="round" opacity=".7"/>
  <path d="M64 25c0-7 3-12 8-15" fill="none" stroke="#684237" stroke-width="6" stroke-linecap="round"/>
  <path d="M28 50c3-6 7-10 12-12" fill="none" stroke="#F0B3AD" stroke-width="6" stroke-linecap="round" opacity=".65"/>
</svg>
`;

const manifestPath = path.join(directory, 'sources.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
const preserved = [];
for (const item of manifest.delivered.filter(item => item.kind !== 'plum')) {
  const file = path.join(directory, `${item.kind}.svg`), bytes = await fs.readFile(file);
  if (sha256(bytes) !== item.sha256) throw Error(`Preserved fruit changed: ${item.kind}`);
  preserved.push({ file, sha256: item.sha256 });
}
const existing = await fs.readFile(path.join(directory, 'plum.svg'));
if (![priorPlumSha256, sha256(svg)].includes(sha256(existing))) throw Error('Plum has unrecognized edits; preserve them before applying this correction');
manifest.derivatives.plum = {
  basedOn: 'VIC code-native plum contour using Noto Emoji food colour/shading conventions; original apple.svg retained unchanged for source lineage.',
  changes: 'Replaced the apple-derived silhouette with one round-oval red/burgundy plum, short bare stem, a single fruit seam and subtle wax bloom. No apple shoulder/waist or leaf; no upstream plum original claimed.',
  replacesSha256: priorPlumSha256,
  originalBasisSha256: manifest.files.find(item => item.kind === 'apple').sha256,
  reproduction: 'node scripts/prepare-companion-plum.mjs --check',
};
manifest.delivered.find(item => item.kind === 'plum').sha256 = sha256(svg);
const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
for (const [file, bytes] of [[path.join(directory, 'plum.svg'), svg], [manifestPath, manifestBytes]]) {
  if (check) { if (sha256(await fs.readFile(file)) !== sha256(bytes)) throw Error(`Reproduction mismatch: ${path.relative(root, file)}`); }
  else await fs.writeFile(file, bytes);
}
for (const item of preserved) if (sha256(await fs.readFile(item.file)) !== item.sha256) throw Error('A non-plum fruit was changed');
console.log(JSON.stringify({ check, kind: 'plum', sha256: sha256(svg), bytes: Buffer.byteLength(svg), priorPlumSha256, unchangedOtherFruits: preserved.length, newDependencies: 0, generatedImages: 0 }));
