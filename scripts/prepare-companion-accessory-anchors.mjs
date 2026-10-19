// Offline, source-bound registration only. Never redraw or change a sprite.
// Coordinates are logical80 BEFORE each frame's existing x/y registration.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = 'lib/ui/viewer-companion/accessory-anchors.json';
const metadataPaths = ['hd-motion-sprite', 'play-motion-sprite', 'living-motion-sprite'].map(name => `lib/ui/viewer-companion/${name}.json`);
const args = process.argv.slice(2), check = args.includes('--check'), sheets = args.includes('--sheet');
const outArg = args.find(arg => arg.startsWith('--out='));
if (args.some(arg => !['--check', '--sheet'].includes(arg) && !arg.startsWith('--out='))) throw Error('Usage: node scripts/prepare-companion-accessory-anchors.mjs [--check] [--sheet] [--out=.scratch-pw/...]');
const evidenceFolder = path.resolve(root, outArg?.slice(6) ?? '.scratch-pw/companion-106');
if (!evidenceFolder.startsWith(path.join(root, '.scratch-pw') + path.sep)) throw Error('Anchor evidence must stay in workspace .scratch-pw');
const cell = 192, logicalCell = 80, ratio = cell / logicalCell;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const round = value => Math.round(value * 1e6) / 1e6;
const point = value => value.map(number => round(number / ratio));
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const minus = (a, b) => [a[0] - b[0], a[1] - b[1]];
const plus = (a, b, scale = 1) => [a[0] + b[0] * scale, a[1] + b[1] * scale];
const unit = value => { const length = Math.hypot(...value); if (length < .01) throw Error('Degenerate landmark axis'); return value.map(number => number / length); };
const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const wrap = value => (value + 540) % 360 - 180;

// Visually inspected source-key exceptions, pinned by the atlas SHA below.
// The two rear tumble keys have NO eyes: their real ear/body connection,
// rather than invented face points, establishes which way is up.
const manualKeys = [
  { atlas: 20, cells: [3, 4, 5], roots: [[130, 115], [130, 145]], note: 'Quarter-front tumble rotated90 degrees: inner-yellow body papers otherwise compete with the two ears to the right.' },
  { atlas: 20, cells: [6, 7], roots: [[79, 134], [88, 158]], body: [111, 123], note: 'Rear tumble, ears extend left; no visible eyes or cheeks.' },
  { atlas: 20, cells: [8, 9, 10], roots: [[104, 157], [132, 146]], body: [96, 116], note: 'Rear inverted tumble, ears extend down/right; no visible eyes or cheeks.' },
  { atlas: 27, cells: [8, 9, 10, 11, 12, 13, 14, 15], eyes: [[84, 153], [113, 153]], roots: [[77, 132], [117, 132]], note: 'Sulk key with ears folded down the face: orange components are inner ears, not square cheeks.' },
  { atlas: 32, cells: [7], roots: [[90, 114], [120, 116]], note: 'Curled sleep key: the folded far ear has no isolated inner-yellow component; roots observed on the complete source key.' },
];
// Explicit pixel ROIs belong to these observed bytes, not an atlas number.
// New drawings must be measured again instead of inheriting an old ear root.
const manualSources = { 20: '52bdd0c379f3c74823944bfe64cbed59c4005072821afacd03950336c5b9748c', 27: '4abe40fa4f7214e82eec91ace885fdac174d754425d96dac1c3b33738b0ca944', 32: 'c8a66edbb01cc423ecebe0bf37b5a8ac3233fa7ae22c9a6735a8b85854771d6c' };
const currentManualKeys = [
  { sha256: 'eaa134b4001477439dae456989d255e4cf723da31fbc5c3809f6b6d85285fcdb', atlas: 9, cells: [5], minDarkPixels: 21, eyes: [[90.738095, 125.357143], [121.277778, 123.5]], note: '131 actual192px frame5 viewed: left/right closed smiling arches have21/27 connected dark pixels. Exact-source exception admits the21-pixel left arch and excludes the new open U mouth.' },
  { sha256: '17c96fe6080085cc8772bedc4dcb89de37a9c60c9166722db5b38ee6fabac8c9', atlas: 16, cells: [10], minDarkPixels: 16, eyes: [[91.166667, 124.5], [123.26, 123.46]], note: '118 corrected yawn inspected on actual192px decoded cell: sleepy closed arcs contain18/25 dark pixels; explicit eye ROIs exclude the28-pixel oval mouth below/between them. Only this source key accepts smaller dark components.' },
  { sha256: 'c0c4b95b09a56be0278aecc7368eedb3644a9b367c72f43224ee1767cba01fd4', atlas: 20, cells: [3, 4, 5], roots: [[125, 120], [121, 142]], note: '114 source viewed at native192 with20px grid: both pale inner ears extend right; observe their body junctions, not yellow body papers.' },
  { sha256: 'c0c4b95b09a56be0278aecc7368eedb3644a9b367c72f43224ee1767cba01fd4', atlas: 20, cells: [6, 7], roots: [[80, 136], [87, 156]], body: [110, 124], note: '114 source rear tumble directly inspected: two ears join the left/lower body; no eyes or face supplied.' },
  { sha256: 'c0c4b95b09a56be0278aecc7368eedb3644a9b367c72f43224ee1767cba01fd4', atlas: 20, cells: [8, 9, 10], roots: [[102, 159], [125, 154]], body: [108, 125], note: '114 source inverted rear tumble directly inspected: white rear ears join below the body; no face is invented.' },
  { sha256: '098e64532c469fcb54ffbaff48bb9bc55fcd1cd6de899d3fffe82e863323858d', atlas: 20, cells: [3, 4, 5], roots: [[125, 120], [121, 142]], note: '115 source re-inspected at native192 with20px grid after alpha1 cleanup and opaque registration. Both rightward ear junctions remain at these measured coordinates; new compressed pixels are not identical to114.' },
  { sha256: '098e64532c469fcb54ffbaff48bb9bc55fcd1cd6de899d3fffe82e863323858d', atlas: 20, cells: [6, 7], roots: [[80, 136], [87, 156]], body: [110, 124], note: '115 rear tumble re-inspected directly: ears join the left/lower body at these coordinates. No eye or face is fabricated; new source SHA is required.' },
  { sha256: '098e64532c469fcb54ffbaff48bb9bc55fcd1cd6de899d3fffe82e863323858d', atlas: 20, cells: [8, 9, 10], roots: [[102, 159], [125, 154]], body: [108, 125], note: '115 inverted rear tumble re-inspected directly on current20px native grid: downward/right ears meet the white body at these coordinates, without inventing a face.' },
];
// These yaw labels describe the authored drawing. In-plane roll is measured
// independently; a90-degree tumble must not choose an anatomical side view.
function orientation(atlas, index) {
  if (atlas < 19 || atlas === 22 || atlas === 26 || atlas === 27 || atlas === 28 || atlas === 32) return 'front';
  if (atlas === 20 && index >= 6 && index <= 10) return 'back';
  if (atlas === 20) return index >= 14 ? 'front' : 'quarter';
  if (atlas === 21 || atlas === 23 || atlas === 29) return index < 8 ? 'quarter' : 'front';
  if (atlas === 25 || atlas === 31) return index >= 8 && index < 12 ? 'front' : 'quarter';
  if (atlas === 19) return index >= 8 && index < 10 ? 'front' : 'quarter';
  return 'quarter';
}

function components(mask) {
  const seen = new Uint8Array(mask.length), queue = new Int32Array(mask.length), result = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let head = 0, tail = 1, sx = 0, sy = 0, left = cell, top = cell, right = 0, bottom = 0;
    seen[start] = 1; queue[0] = start;
    while (head < tail) {
      const at = queue[head++], x = at % cell, y = Math.floor(at / cell);
      sx += x + .5; sy += y + .5; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(cell - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(cell - 1, x + 1); xx++) {
        const next = yy * cell + xx;
        if (mask[next] && !seen[next]) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    if (tail < 8) continue;
    const center = [sx / tail, sy / tail], pixels = Array.from(queue.subarray(0, tail));
    let vx = 0, vy = 0, xy = 0;
    for (const at of pixels) { const x = at % cell + .5 - center[0], y = Math.floor(at / cell) + .5 - center[1]; vx += x * x; vy += y * y; xy += x * y; }
    vx /= tail; vy /= tail; xy /= tail;
    const delta = Math.sqrt((vx - vy) ** 2 + 4 * xy ** 2);
    result.push({ center, pixels, bounds: [left, top, right, bottom], count: tail, elongation: (vx + vy + delta) / Math.max(.1, vx + vy - delta) });
  }
  return result.sort((a, b) => b.count - a.count);
}
function classify(bytes, minDarkPixels = 22) {
  const masks = Array.from({ length: 4 }, () => new Uint8Array(cell * cell));
  for (let at = 0; at < cell * cell; at++) {
    // Scan the same RGBA thresholds without allocating19 million temporary
    // Buffer views across the complete520-frame verification.
    const offset = at * 4, r = bytes[offset], g = bytes[offset + 1], b = bytes[offset + 2], a = bytes[offset + 3];
    if (a <= 160) continue;
    masks[0][at] = 1;
    if (r < 120 && g < 100 && b < 90) masks[1][at] = 1;
    if (r > 200 && g < 190 && r - g > 45 && g - b > 8 && b < 155) masks[2][at] = 1;
    if (r > 210 && g > 180 && g - b > 35 && r - g < 65 && b < 165) masks[3][at] = 1;
  }
  const [body, dark, orange, yellow] = masks.map(components);
  if (!body[0] || body[0].count < 3000) throw Error('Missing primary connected body');
  return { body: body[0], dark: dark.filter(part => part.count >= minDarkPixels && part.count <= 250 && part.bounds[2] - part.bounds[0] < 25 && part.bounds[3] - part.bounds[1] < 26), orange, yellow };
}
function nearestParts(candidates, targets, limit = 15) {
  const chosen = targets.map(target => candidates.reduce((best, part) => !best || distance(part.center, target) < distance(best.center, target) ? part : best, undefined));
  if (chosen.some((part, i) => !part || distance(part.center, targets[i]) > limit) || chosen[0] === chosen[1]) return;
  return chosen;
}
function findFace(parts, atlas, index, manual) {
  if (manual?.eyes) {
    const eyes = nearestParts(parts.dark, manual.eyes, 7);
    if (!eyes) throw Error(`Manual eye ROI does not contain measured dark components ${atlas}:${index}`);
    return { eyes, cheeks: [], method: 'eyes-manual-ear-roots' };
  }
  const hint = atlas === 20 && index >= 3 && index <= 5 ? 90 : atlas === 20 && index >= 11 && index <= 13 ? -30 : 0;
  const candidates = parts.orange.filter(part => part.count >= 45 && part.count < 400 && part.elongation < 5 && part.bounds[2] - part.bounds[0] < 32 && part.bounds[3] - part.bounds[1] < 32);
  let best;
  for (let left = 0; left < candidates.length; left++) for (let right = left + 1; right < candidates.length; right++) {
    let cheeks = [candidates[left], candidates[right]];
    const hintAxis = [Math.cos(hint * Math.PI / 180), Math.sin(hint * Math.PI / 180)];
    if (dot(cheeks[0].center, hintAxis) > dot(cheeks[1].center, hintAxis)) cheeks = cheeks.reverse();
    const span = distance(cheeks[0].center, cheeks[1].center), axis = unit(minus(cheeks[1].center, cheeks[0].center)), normal = [-axis[1], axis[0]];
    if (span < 35 || span > 76 || Math.abs(wrap(Math.atan2(axis[1], axis[0]) * 180 / Math.PI - hint)) > 42) continue;
    const targets = [plus(plus(cheeks[0].center, axis, span * .2), normal, -span * .12), plus(plus(cheeks[1].center, axis, -span * .2), normal, -span * .12)];
    const eyes = nearestParts(parts.dark, targets);
    if (!eyes || distance(eyes[0].center, eyes[1].center) < 19) continue;
    const score = targets.reduce((sum, target, i) => sum + distance(target, eyes[i].center) ** 2, 0) + (span - (parts.body.bounds[2] - parts.body.bounds[0]) * .4) ** 2 * .15;
    if (!best || score < best.score) best = { eyes, cheeks, score, method: 'dark-eyes-orange-cheeks' };
  }
  if (!best || best.score > 180) throw Error(`Uncertain measured eye/cheek pair ${atlas}:${index} (score ${best?.score})`);
  return best;
}
function earRoots(parts, face, normal, cheeks, manual, atlas, index) {
  if (manual?.roots) return { roots: manual.roots, components: [], method: 'explicit-source-key-ear-roots' };
  // One orange and one yellow inner ear are visible in these source keys.
  // A large yellow paper square just above the eyes is not an ear: the real
  // inner-ear component extends farther toward the head's up direction.
  const score = part => part.count * dot(minus(part.center, face), normal) ** 2;
  const selected = [parts.orange, parts.yellow].map(colour => colour.filter(part => part.count >= 60 && part.elongation < 30 && !cheeks.includes(part) && dot(minus(part.center, face), normal) < -16).sort((a, b) => score(b) - score(a))[0]);
  if (selected.some(part => !part)) throw Error(`Uncertain two visible inner ears ${atlas}:${index}`);
  const roots = selected.map(part => {
    let nearest, best = Infinity;
    for (const pixel of part.pixels) { const p = [pixel % cell + .5, Math.floor(pixel / cell) + .5], d = distance(p, face); if (d < best) { best = d; nearest = p; } }
    // The inner colour ends inside the white outer ear. Follow its actual
    // nearest endpoint toward the measured face by the visible stroke gap.
    return plus(nearest, unit(minus(face, nearest)), 5);
  });
  const axis = [normal[1], -normal[0]];
  if (dot(roots[0], axis) > dot(roots[1], axis)) { roots.reverse(); selected.reverse(); }
  return { roots, components: selected, method: 'inner-colour-nearest-face-endpoints' };
}
const evidencePart = part => ({ center: point(part.center), bounds: point(part.bounds), pixels: part.count });
function crossSection(body, origin, axis, normal, height) {
  let left = Infinity, right = -Infinity, count = 0;
  for (const pixel of body.pixels) {
    const x = pixel % cell + .5 - origin[0], y = Math.floor(pixel / cell) + .5 - origin[1];
    if (Math.abs(x * normal[0] + y * normal[1] - height) > 1.5) continue;
    const along = x * axis[0] + y * axis[1]; left = Math.min(left, along); right = Math.max(right, along); count++;
  }
  if (count < 10) throw Error('Missing body alpha cross-section for attachment');
  return [left, right];
}
function register(bytes, frame, physicalIndex) {
  const { atlas, index } = frame, manual = currentManualKeys.find(key => key.sha256 === sources[atlas].sha256 && key.atlas === atlas && key.cells.includes(index)) ?? (manualSources[atlas] === sources[atlas].sha256 ? manualKeys.find(key => key.atlas === atlas && key.cells.includes(index)) : undefined);
  const parts = classify(bytes, manual?.minDarkPixels ?? 22);
  const view = orientation(atlas, index), rear = view === 'back';
  if (rear && !manual?.body) throw Error(`Unregistered rear source ${atlas}:${index}: inspect actual new body/ear roots before registration`);
  const measured = rear ? { eyes: [], cheeks: [], method: 'rear-body-ear-roots' } : findFace(parts, atlas, index, manual);
  const face = rear ? manual.body : midpoint(measured.eyes[0].center, measured.eyes[1].center);
  const normal = rear ? unit(minus(manual.body, midpoint(...manual.roots))) : (() => { const axis = unit(minus(measured.eyes[1].center, measured.eyes[0].center)); return [-axis[1], axis[0]]; })();
  const axis = [normal[1], -normal[0]], roll = Math.atan2(axis[1], axis[0]) * 180 / Math.PI;
  const ears = earRoots(parts, face, normal, measured.cheeks, manual, atlas, index);
  const head = plus(midpoint(...ears.roots), normal, -2);
  const eyeSpan = rear ? distance(...ears.roots) : distance(measured.eyes[0].center, measured.eyes[1].center);
  const eyeWidth = rear ? 9 : Math.max(...measured.eyes.map(part => part.bounds[2] - part.bounds[0]));
  const faceWidth = eyeSpan + eyeWidth * 1.4;
  const cheekDepth = measured.cheeks.length ? Math.max(...measured.cheeks.map(part => dot(minus(part.center, face), normal) + Math.sqrt(part.count))) : eyeWidth * 1.4;
  let bodyDepth = -Infinity;
  for (const pixel of parts.body.pixels) bodyDepth = Math.max(bodyDepth, (pixel % cell + .5 - face[0]) * normal[0] + (Math.floor(pixel / cell) + .5 - face[1]) * normal[1]);
  const chestDepth = Math.min(cheekDepth + 3, bodyDepth - 7), sideDepth = Math.min(chestDepth + faceWidth * .25, bodyDepth - 6);
  const chestRange = crossSection(parts.body, face, axis, normal, chestDepth), sideRange = crossSection(parts.body, face, axis, normal, sideDepth);
  const chest = plus(face, normal, chestDepth), sideBody = plus(plus(face, normal, sideDepth), axis, sideRange[1] - faceWidth * .3);
  const sideChest = plus(chest, axis, chestRange[1] - faceWidth * .18);
  const anchor = (p, width, angle = roll) => ({ x: round(p[0] / ratio), y: round(p[1] / ratio), width: round(width / ratio), roll: round(angle) });
  const headWidth = Math.max(1, distance(...ears.roots) - 3);
  const headRoll = rear ? roll : Math.atan2(ears.roots[1][1] - ears.roots[0][1], ears.roots[1][0] - ears.roots[0][0]) * 180 / Math.PI;
  return { physicalIndex, atlas, index, orientation: view, face: anchor(face, faceWidth), head: anchor(head, headWidth, headRoll), chest: anchor(chest, chestRange[1] - chestRange[0]), sideChest: anchor(sideChest, chestRange[1] - chestRange[0]), sideBody: anchor(sideBody, sideRange[1] - sideRange[0]), bodyBounds: point(parts.body.bounds), eyes: measured.eyes.map(part => ({ center: point(part.center), bounds: point(part.bounds) })), evidence: { method: measured.method, sourceKey: `${atlas}:${index}`, eyes: measured.eyes.map(evidencePart), cheeks: measured.cheeks.map(evidencePart), earRoots: ears.roots.map(point), earComponents: ears.components.map(evidencePart), earMethod: ears.method, ...(manual ? { correction: manual.note } : {}) } };
}

const metadataBytes = await Promise.all(metadataPaths.map(name => fs.readFile(path.join(root, name))));
const packs = metadataBytes.map(bytes => JSON.parse(bytes));
const sources = packs.flatMap(pack => pack.atlases), frames = [], rows = [];
for (const pack of packs) {
  const offset = frames.length, atlasOffset = frames.length ? packs.slice(0, packs.indexOf(pack)).reduce((sum, item) => sum + item.atlases.length, 0) : 0;
  frames.push(...pack.frames.map(frame => ({ ...frame, atlas: frame.atlas + atlasOffset })));
  rows.push(...pack.rows.map(row => row.map(index => index + offset)));
}
if (frames.length !== 520 || rows.length !== 41 || sources.length !== 33) throw Error('Unexpected aggregate frame/source/row lineage');
const sourceBytes = await Promise.all(sources.map(source => fs.readFile(path.join(root, `public${source.src}`))));
const sourcePixels = await Promise.all(sourceBytes.map(async (bytes, index) => {
  const source = sources[index], info = await sharp(bytes).metadata();
  if (hash(bytes) !== source.sha256 || bytes.length !== source.bytes || info.width !== cell * 8 || info.height !== cell * 2) throw Error(`Registered source bytes changed: ${source.src}`);
  return sharp(bytes).ensureAlpha().raw().toBuffer();
}));
// A stroke-weight-only correction must not move hats/chest attachments merely
// because its thicker ink changes an eye component's area or bounding box.
// Inherit the measured131 registration only for these exact133 bytes after
// independently proving unchanged alpha/outside-eye pixels and frame mapping.
let eyeWeight133Rig;
if (sources[9].src === '/companion/hd/vitamin-action-09-eye-weight-133-v3.webp') {
  if (sources[9].sha256 !== 'ff8ecc78933a0bd414e7fefa2e682fa1a04da5760e3985e286731d02bd6b1673') throw Error('Unmeasured133 eye-weight source');
  const folder = path.join(root, 'art-src/빅타민/동행/작업회차/20261019-쓰다듬기눈선133/고정입력');
  const rigBytes = await fs.readFile(path.join(folder, 'accessory-anchors.json'));
  if (hash(rigBytes) !== '08463ff882931c2c1fe974774bd4af3d45f2b21180faa1eebc84dfef40a78578') throw Error('Frozen131 registration changed');
  const baseline = JSON.parse(await fs.readFile(path.join(folder, 'hd-motion-sprite.json'), 'utf8'));
  if (JSON.stringify(packs[0].frames) !== JSON.stringify(baseline.frames) || JSON.stringify(packs[0].rows) !== JSON.stringify(baseline.rows)) throw Error('133 changed protected frame registration');
  const oldBytes = await fs.readFile(path.join(root, 'public/companion/hd/vitamin-action-09-happiness-131-v1.webp'));
  if (hash(oldBytes) !== 'eaa134b4001477439dae456989d255e4cf723da31fbc5c3809f6b6d85285fcdb') throw Error('Actual131 parent changed');
  const parent = await sharp(oldBytes).ensureAlpha().raw().toBuffer(), current = sourcePixels[9];
  for (let at = 0; at < parent.length; at += 4) {
    const p = at / 4, x = p % (cell * 8) % cell, y = Math.floor(p / (cell * 8)) % cell;
    const eye = x >= 81 && x < 99 && y >= 117 && y < 134 || x >= 113 && x < 132 && y >= 115 && y < 132;
    if (parent[at + 3] !== current[at + 3]) throw Error('133 alpha conservation failed');
    if (!eye) for (let c = 0; c < 3; c++) if (parent[at + c] !== current[at + c]) throw Error('133 outside-eye conservation failed');
  }
  eyeWeight133Rig = JSON.parse(rigBytes).frames;
}
const registered = [], cells = [], errors = [];
for (let physicalIndex = 0; physicalIndex < frames.length; physicalIndex++) {
  const frame = frames[physicalIndex], packet = sourcePixels[frame.atlas], bytes = Buffer.alloc(cell * cell * 4);
  for (let y = 0; y < cell; y++) packet.copy(bytes, y * cell * 4, ((Math.floor(frame.index / 8) * cell + y) * cell * 8 + frame.index % 8 * cell) * 4, ((Math.floor(frame.index / 8) * cell + y) * cell * 8 + (frame.index % 8 + 1) * cell) * 4);
  try {
    registered.push(eyeWeight133Rig && frame.atlas === 9 ? { ...eyeWeight133Rig[physicalIndex], evidence: { method: 'Exact133 eye-weight-only conservation; original131 eye geometry remains the attachment reference, not the new ink bounds.', sourceKey: `${frame.atlas}:${frame.index}`, parentSha256: 'eaa134b4001477439dae456989d255e4cf723da31fbc5c3809f6b6d85285fcdb' } } : register(bytes, frame, physicalIndex));
    cells.push(bytes);
  }
  catch (error) { errors.push(String(error.message)); }
}
if (errors.length) throw Error(`${errors.length} uncertain frames require explicit source-key inspection:\n${errors.join('\n')}`);
const result = { version: 1, logicalCell, textureCell: cell, frameCount: frames.length, metadata: metadataPaths.map((name, index) => ({ path: name, sha256: hash(metadataBytes[index]) })), sources: sources.map(source => ({ src: source.src, sha256: source.sha256, bytes: source.bytes })), coordinates: 'logical80 cell before frame.x/y; x right/y down; clockwise authored roll in degrees; parent motion/facing chain remains authoritative', bodyBoundsFormat: 'left,top,right,bottom; exclusive far edges', rows, frames: registered.map(({ evidence, ...frame }) => { void evidence; return frame; }) };
const serialized = `${JSON.stringify(result, null, 2)}\n`;
if (check) { if (await fs.readFile(path.join(root, output), 'utf8') !== serialized) throw Error('Accessory anchors differ from deterministic source-bound registration'); }
else await fs.writeFile(path.join(root, output), serialized);

if (sheets) {
  const folder = evidenceFolder; await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(folder, 'accessory-anchor-evidence.json'), `${JSON.stringify({ metadata: result.metadata, sources: result.sources, orientationEvidence: 'Observed source-key yaw, not in-plane roll; no pure anatomical side-only pose is invented.', note: 'Measured anchors and source-key observations are not a visual PASS or owner approval.', corrections: manualKeys, frames: registered.map(frame => ({ physicalIndex: frame.physicalIndex, ...frame.evidence })) }, null, 2)}\n`);
  for (let chunk = 0; chunk < 3; chunk++) {
    const inputs = [];
    for (let atlas = chunk * 11; atlas < Math.min(sources.length, (chunk + 1) * 11); atlas++) {
      for (const frame of registered.filter(frame => frame.atlas === atlas)) {
        const left = frame.index * 96, top = (atlas % 11) * 116;
        const pixels = await sharp(cells[frame.physicalIndex], { raw: { width: cell, height: cell, channels: 4 } }).resize(96, 96).png().toBuffer();
        const marks = ['face', 'head', 'chest', 'sideChest', 'sideBody'].map((name, index) => { const anchor = frame[name], colours = ['#c71934', '#135de6', '#00754b', '#8b1fbe', '#ab6500']; return `<circle cx="${anchor.x * 1.2}" cy="${anchor.y * 1.2}" r="2" fill="${colours[index]}"/>`; }).join('');
        inputs.push({ input: pixels, left, top }, { input: Buffer.from(`<svg width="96" height="116">${marks}<text x="3" y="111" font-size="10" fill="#332b24">${frame.physicalIndex} ${frame.orientation[0]}</text></svg>`), left, top });
      }
    }
    await sharp({ create: { width: 1536, height: 1276, channels: 4, background: '#eee6d7' } }).composite(inputs).png().toFile(path.join(folder, `accessory-anchors-${chunk}.png`));
  }
  const critical = [0, 32, 128, 224, 272, 288, 323, 326, 328, 331, 440, 500, 508, 512, 513, 514, 515, 516, 517, 518, 519], inputs = [];
  for (let i = 0; i < critical.length; i++) {
    const frame = registered[critical[i]], left = i % 7 * cell, top = Math.floor(i / 7) * (cell + 24);
    const marks = ['face', 'head', 'chest'].map((name, index) => {
      const p = frame[name], colour = ['#c71934', '#135de6', '#00754b'][index], radians = p.roll * Math.PI / 180, dx = Math.cos(radians) * p.width * ratio / 2, dy = Math.sin(radians) * p.width * ratio / 2;
      return `<line x1="${p.x * ratio - dx}" y1="${p.y * ratio - dy}" x2="${p.x * ratio + dx}" y2="${p.y * ratio + dy}" stroke="${colour}" stroke-width="1"/><circle cx="${p.x * ratio}" cy="${p.y * ratio}" r="2.5" fill="${colour}"/>`;
    }).join('');
    inputs.push({ input: cells[frame.physicalIndex], raw: { width: cell, height: cell, channels: 4 }, left, top }, { input: Buffer.from(`<svg width="192" height="216">${marks}<text x="3" y="210" font-size="13" fill="#332b24">${frame.physicalIndex} ${frame.orientation}</text></svg>`), left, top });
  }
  await sharp({ create: { width: cell * 7, height: (cell + 24) * 3, channels: 4, background: '#eee6d7' } }).composite(inputs).png().toFile(path.join(folder, 'accessory-anchors-critical.png'));
}
// Reading/measurement cannot silently alter the input during registration.
for (let index = 0; index < sources.length; index++) if (hash(await fs.readFile(path.join(root, `public${sources[index].src}`))) !== sources[index].sha256) throw Error('Source changed during measurement');
console.log(JSON.stringify({ check, output, frames: registered.length, rows: rows.length, sources: sources.length, explicitSourceKeyFrames: registered.filter(frame => frame.evidence.correction).length, sourcePixelsUnchanged: true, visualApproval: false, orientations: Object.fromEntries(['front', 'quarter', 'side', 'back'].map(view => [view, registered.filter(frame => frame.orientation === view).length])) }));
