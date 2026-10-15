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
const roundPlumSha256 = '02176fce14522c20ba86fabd8e5edb581e233f8f908f32ef5a6bed8baf9772c2';
const ovalPlumSha256 = '20f95f69573988fdc3dbb5a4b664ca9cbc16d389534367d3d5dbe63a09772851';
const svg = `<?xml version="1.0" encoding="utf-8"?>
<!-- Modified for VIC Schedule Studio, 2026-10-15: code-native red plum contour using Noto Emoji food colour/shading conventions. This is not an upstream plum SVG. See SOURCES.md and LICENSE.txt. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="plum-face" x1=".05" y1=".4" x2="1" y2=".55">
      <stop stop-color="#C93335"/><stop offset=".18" stop-color="#E76B38"/><stop offset=".38" stop-color="#F8B34C"/><stop offset=".57" stop-color="#FFC15A"/><stop offset=".75" stop-color="#EE8B3D"/><stop offset="1" stop-color="#C93335"/>
    </linearGradient>
  </defs>
  <!-- Dominant warm-red skin and an off-centre golden blush follow the owner's photo direction. -->
  <path fill="#C93335" d="M62 17c22-3 45 12 53 35 8 23-3 51-22 65-16 11-39 11-56 1C18 107 8 85 12 62c4-25 24-43 50-45Z"/>
  <path fill="url(#plum-face)" d="M55 22c-16 3-27 22-28 43-1 24 7 44 20 54 8 5 16 1 23-10 13-21 14-53 5-72-4-10-11-16-20-15Z"/>
  <path fill="#A92B32" opacity=".55" d="M108 44c10 25 2 53-18 69-12 10-29 13-44 8 17 9 34 8 48-3 20-16 29-43 21-66-2-5-4-9-7-13v5Z"/>
  <!-- A quiet curved seam; the body is not split into peach-like heart lobes. -->
  <path d="M69 27c-6 16-8 34-4 51 3 13 3 24-2 35" fill="none" stroke="#A9372D" stroke-width="2.2" stroke-linecap="round" opacity=".3"/>
  <path d="M59 23c3-1 7-1 10 0" fill="none" stroke="#A82B2B" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>
  <path d="M64 21c0-4 1-7 4-10" fill="none" stroke="#684237" stroke-width="4.5" stroke-linecap="round"/>
  <path d="M29 46c4-7 9-12 16-15" fill="none" stroke="#FFF0BE" stroke-width="6" stroke-linecap="round" opacity=".72"/>
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
if (![priorPlumSha256, roundPlumSha256, ovalPlumSha256, sha256(svg)].includes(sha256(existing))) throw Error('Plum has unrecognized edits; preserve them before applying this correction');
manifest.derivatives.plum = {
  basedOn: 'VIC code-native plum contour using Noto Emoji food colour/shading conventions; original apple.svg retained unchanged for source lineage.',
  changes: 'Replaced the elongated burgundy oval with a plump rounded plum, dominant warm-red skin, an off-centre golden-yellow/orange blush, short bare stem and shallow curved seam, following the owner-provided photo direction. No apple shoulder/waist or leaf; no peach-like split or upstream plum original claimed.',
  replacesSha256: priorPlumSha256,
  previousRoundSha256: roundPlumSha256,
  previousOvalSha256: ovalPlumSha256,
  visualDirection: 'Owner-provided inline photo: red/yellow plums. Photo shape/colour direction relayed by the root agent; no photo file, bytes or license claim is attached to this derivative.',
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
console.log(JSON.stringify({ check, kind: 'plum', sha256: sha256(svg), bytes: Buffer.byteLength(svg), priorPlumSha256, previousRoundSha256: roundPlumSha256, previousOvalSha256: ovalPlumSha256, unchangedOtherFruits: preserved.length, newDependencies: 0, generatedImages: 0 }));
