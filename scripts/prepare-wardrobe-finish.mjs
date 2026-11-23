// Preserve the accepted silhouette/registration. Only material paint changes.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const rgb = color => color.match(/[a-f\d]{2}/gi).map(n => parseInt(n, 16));
const hex = values => '#' + values.map(n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')).join('');
const shift = (color, amount) => hex(rgb(color).map(n => n + amount));
const blend = (a, b, amount) => hex(rgb(a).map((n, i) => n * (1 - amount) + rgb(b)[i] * amount));
const receipts = [];
for (const epoch of [114, 115]) {
  const source = `public/companion/collection/accessories-${epoch}-v2.svg`;
  const target = `public/companion/collection/accessories-${epoch}-finish-v2.svg`;
  const original = await fs.readFile(source, 'utf8');
  // Broad painted light/shadow masses stay inside the original surfaces.
  // Cloth remains matte; brass has a smaller, warmer highlight shoulder.
  let result = original.replace(/<linearGradient\b[^>]*id="([^"]+)"[^>]*><stop offset="0" stop-color="(#[a-f\d]{6})"\/><stop offset="1" stop-color="(#[a-f\d]{6})"\/><\/linearGradient>/gi,
    (_, id, top, bottom) => {
      const metal = ['gold', 'brass', 'blade'].includes(id);
      const brim = id.includes('brim');
      const stops = metal
        ? [[0, blend(top, '#fff8da', .34)], [.22, blend(top, '#fff8da', .62)], [.42, top], [.7, blend(top, bottom, .65)], [1, blend(bottom, '#795330', .22)]]
        : [[0, blend(top, '#fff5df', .21)], [.32, blend(top, '#fff5df', brim ? .08 : .15)], [.68, blend(top, bottom, .66)], [1, blend(bottom, '#604b3c', brim ? .17 : .21)]];
      return `<linearGradient id="${id}" x1="5%" y1="0%" x2="${metal ? '38' : '62'}%" y2="100%">${stops.map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`).join('')}</linearGradient>`;
    });
  // Brim undersides, existing ribbons, rims and lenses use their own paint.
  // No geometry, opacity, embedded print, added line, texture or filter changes.
  const fills = epoch === 114 ? ['#dfbd86', '#e4bb88', '#d6bd8d', '#d5b071', '#f5d389', '#65564e', '#89756a', '#786b86', '#aa96b5', '#84949c', '#f4d894', '#f4dfad', '#fff4d9', '#fff5db'] : ['#efdb8b', '#f4df90', '#fff4d9'];
  const strokes = epoch === 114 ? ['#795539', '#9b7043', '#a26960', '#8c7063', '#ad8c67'] : ['#74533e', '#997a3f'];
  const defs = [];
  for (const [attribute, colors] of [['fill', fills], ['stroke', strokes]]) for (const [i, color] of colors.entries()) {
    const id = `finish-${attribute}-${i}`;
    const pattern = new RegExp(`${attribute}="${color}"`, 'g');
    if (!pattern.test(result)) continue;
    result = result.replace(pattern, `${attribute}="url(#${id})"`);
    const rim = attribute === 'stroke';
    defs.push(`<linearGradient id="${id}" x1="0%" y1="0%" x2="45%" y2="100%"><stop offset="0" stop-color="${blend(color, '#fff1c8', rim ? .35 : .24)}"/><stop offset=".27" stop-color="${shift(color, rim ? 22 : 13)}"/><stop offset=".62" stop-color="${color}"/><stop offset="1" stop-color="${blend(color, '#533c2e', .22)}"/></linearGradient>`);
  }
  result = result.replace('</defs>', defs.join('') + '</defs>');
  // A few broad painted planes echo the character's layered paper surfaces.
  // They are inset-clipped to the existing silhouettes, never new outlines.
  const planes = {
    felt: ['M31 26L48 26L52 87L35 92Z', 'M84 24L104 24L100 94L86 94Z'],
    plum: ['M28 23L46 23L50 89L31 94Z', 'M87 22L106 22L103 94L89 94Z'],
    bread: ['M25 34L53 32L43 77L20 80Z', 'M82 30L111 35L110 81L89 85Z'],
    tweed: ['M24 31L48 30L41 82L22 81Z', 'M82 30L108 31L109 83L89 83Z'],
    sage: ['M31 32L49 32L45 79L26 79Z', 'M85 32L102 32L105 80L89 80Z'],
    'blue-felt': ['M50 26L64 20L57 88L32 92Z', 'M70 35L98 83L104 95L83 97Z'],
    paper: ['M20 44L44 44L40 87L20 87Z', 'M85 45L109 45L109 91L72 91Z'],
    'rose-cloth': ['M15 40L45 40L36 79L15 81Z', 'M14 76Q64 85 114 76L114 90H14Z'],
    'green-cloth': ['M15 40L45 40L36 79L15 81Z', 'M14 76Q64 85 114 76L114 90H14Z'],
    'purple-cloth': ['M15 40L45 40L36 79L15 81Z', 'M14 76Q64 85 114 76L114 90H14Z'],
    'cream-cloth': ['M15 40L45 40L36 79L15 81Z', 'M14 76Q64 85 114 76L114 90H14Z'],
  };
  const clips = [];
  let planeIndex = 0;
  result = result.replace(/<path d="([^"]+)" fill="url\(#([\w-]+)\)"[^>]*\/>/g, (path, d, material) => {
    if (!planes[material]) return path;
    const id = `finish-plane-${planeIndex++}`;
    clips.push(`<clipPath id="${id}"><path d="${d}" transform="translate(64 64) scale(.94) translate(-64 -64)"/></clipPath>`);
    const [light, shadow] = planes[material];
    return `${path}<g data-finish-plane="${material}" clip-path="url(#${id})" stroke="none"><path d="${light}" fill="#fff4cf" opacity=".24"/><path d="${shadow}" fill="#634a38" opacity=".17"/></g>`;
  });
  result = result.replace('</defs>', clips.join('') + '</defs>');
  await fs.writeFile(target, result);
  receipts.push({ source, sourceSha256: sha(original), target, targetSha256: sha(result), paintedPlanes: planeIndex, scope: 'existing path/transform/opacity/embedded image bytes and registration unchanged; broad inset-clipped interior paint only' });
}
await fs.mkdir('runs/20261123-wardrobe-style/refinement-2', { recursive: true });
await fs.writeFile('runs/20261123-wardrobe-style/refinement-2/preparation.json', JSON.stringify(receipts, null, 2) + '\n');
console.log(JSON.stringify(receipts.map(({ target, targetSha256 }) => ({ target, targetSha256 }))));
