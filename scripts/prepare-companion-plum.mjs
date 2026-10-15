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
const svg = `<?xml version="1.0" encoding="utf-8"?>
<!-- Modified for VIC Schedule Studio, 2026-10-15: code-native red plum contour using Noto Emoji food colour/shading conventions. This is not an upstream plum SVG. See SOURCES.md and LICENSE.txt. -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <!-- A gently uneven vertical oval, with one continuous rounded crown. -->
  <path fill="#8E344B" d="M62 21c18-2 34 11 40 31 7 24 1 52-16 66-13 11-32 10-46 0C24 106 18 83 23 60c5-24 20-40 39-39Z"/>
  <path fill="#C05C68" d="M61 23c-16-1-31 16-35 38-4 22 3 43 16 54 10 8 23 7 34-2 15-14 22-39 18-60-4-18-17-31-33-30Z"/>
  <path fill="#AB4A5D" d="M94 43c9 25 4 53-12 70-9 9-21 13-33 10 14 6 27 4 38-6 17-15 23-42 15-65-2-5-4-9-8-13v4Z"/>
  <!-- Quiet wax bloom and a shallow seam, never a peach-like split. -->
  <path fill="#E5C4CA" opacity=".24" d="M58 28c-14 1-26 14-29 32-2 11-1 22 3 30-1-16 3-30 10-39 8-10 17-13 27-10 8 2 15 7 21 16-5-19-18-30-32-29Z"/>
  <path d="M63 29c-5 13-4 26-1 40 3 14 3 27-1 40" fill="none" stroke="#843047" stroke-width="2.2" stroke-linecap="round" opacity=".34"/>
  <path d="M59 27c2-1 5-1 8 0" fill="none" stroke="#692F36" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>
  <path d="M63 24c0-5 2-9 6-12" fill="none" stroke="#684237" stroke-width="5" stroke-linecap="round"/>
  <path d="M34 51c2-5 5-9 9-12" fill="none" stroke="#F0B3AD" stroke-width="5" stroke-linecap="round" opacity=".65"/>
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
if (![priorPlumSha256, roundPlumSha256, sha256(svg)].includes(sha256(existing))) throw Error('Plum has unrecognized edits; preserve them before applying this correction');
manifest.derivatives.plum = {
  basedOn: 'VIC code-native plum contour using Noto Emoji food colour/shading conventions; original apple.svg retained unchanged for source lineage.',
  changes: 'Replaced the earlier round contour with one subtly asymmetric vertical-oval red/burgundy plum, short bare stem, a shallow fruit seam and subtle wax bloom. No apple shoulder/waist or leaf; no peach-like split or upstream plum original claimed.',
  replacesSha256: priorPlumSha256,
  previousRoundSha256: roundPlumSha256,
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
console.log(JSON.stringify({ check, kind: 'plum', sha256: sha256(svg), bytes: Buffer.byteLength(svg), priorPlumSha256, previousRoundSha256: roundPlumSha256, unchangedOtherFruits: preserved.length, newDependencies: 0, generatedImages: 0 }));
