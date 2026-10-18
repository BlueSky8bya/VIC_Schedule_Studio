// Deterministic alpha-preserving packing of additive106/107 collection cutouts.
// No image generation, color-keying, redraw, opacity repair or source edits.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const edition = process.argv.includes('--edition=107') ? 107 : 106;
const runs = { 106: 'art-src/빅타민/수집/작업회차/20261018-도감과선물', 107: 'art-src/빅타민/수집/작업회차/20261018-먹거리와추억' };
const run = runs[edition];
const destination = 'public/companion/collection';
const registryPath = 'lib/ui/viewer-companion/collection-art.ts';
const receiptPath = run + '/정리본/패킹기록.json';
const check = process.argv.includes('--check');
const available = process.argv.includes('--available');
if (process.argv.slice(2).some(arg => !['--check', '--available', '--edition=107'].includes(arg))) throw Error('Usage: node scripts/prepare-companion-collection.mjs [--edition=107] [--available] [--check]');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const round = value => Math.round(value * 1e6) / 1e6;
const behaviorIds = ['ask-petting', 'lean-nuzzle', 'paper-knead', 'paper-nest', 'cheer-rehearsal', 'doze-curl', 'groom', 'bow', 'pounce', 'tumble', 'dizzy', 'stretch'];
const accessoryIds = edition === 107 ? ['pixel-sunglasses', 'baseball-cap', 'party-hat', 'scarf', 'bell-pendant', 'leaf-umbrella'] : ['sunglasses', 'beret', 'bow', 'star-pin', 'flower-crown', 'satchel'];
const situationIds = ['hide-found', 'heart-blocked', 'run-tumble', 'food-trip', 'landing-mishap', 'card-bump', 'meal-finished', 'home-rested', 'petting-comfort', 'gift-arrival', 'gift-opened', 'accessory-trick'];
const foodIds107 = ['bread', 'croissant', 'baguette', 'bagel', 'pretzel', 'sandwich', 'toast', 'pancake', 'waffle', 'doughnut', 'muffin', 'cupcake', 'rice-ball', 'rice-cake', 'dumpling', 'pizza', 'pasta', 'omelet', 'soup', 'curry', 'sushi', 'pudding', 'cookie', 'macaron'];
const views = ['front', 'quarter', 'side', 'back'];
const bookGiftIds = ['book-closed', 'book-open', 'gift-wrapped', 'gift-open', 'gift-bag', 'discovery-seal'];
const editions = {
  106: [
    { id: 'food', kind: 'food', file: 'foods-106-v1.webp', cell: 96, columns: 8, rows: 5 },
    { id: 'food-stamp', kind: 'food-stamp', file: 'food-stamps-106-v1.webp', cell: 128, columns: 8, rows: 5 },
    { id: 'behavior-stamp', kind: 'behavior-stamp', file: 'behavior-stamps-106-v1.webp', cell: 128, columns: 4, rows: 3 },
    { id: 'accessory', kind: 'accessory', file: 'accessories-106-v1.webp', cell: 128, columns: 6, rows: 4 },
    { id: 'book-gift', file: 'book-gifts-106-v1.webp', cell: 128, columns: 3, rows: 2 },
  ],
  107: [
    { id: 'food-107', kind: 'food', file: 'foods-107-v1.webp', cell: 96, columns: 8, rows: 3 },
    { id: 'food-stamp-107', kind: 'food-stamp', file: 'food-stamps-107-v1.webp', cell: 128, columns: 8, rows: 3 },
    { id: 'situation-stamp', kind: 'situation-stamp', file: 'situation-stamps-107-v1.webp', cell: 128, columns: 4, rows: 3 },
    { id: 'accessory-107', kind: 'accessory', file: 'accessories-107-v1.webp', cell: 128, columns: 6, rows: 4 },
  ],
};
const definitions = editions[edition], foodAtlas = edition === 107 ? 'food-107' : 'food', stampAtlas = edition === 107 ? 'food-stamp-107' : 'food-stamp', accessoryAtlas = edition === 107 ? 'accessory-107' : 'accessory';
const buckets = Object.fromEntries(definitions.map(item => [item.id, []]));
const sources = [], cells = [];
const read = relative => fs.readFile(path.join(root, relative));
const exists = async relative => Boolean(await fs.stat(path.join(root, relative)).catch(() => null));
const writeOrCheck = async (relative, bytes) => {
  const target = path.join(root, relative);
  if (check) {
    if (!(await fs.readFile(target)).equals(Buffer.from(bytes))) throw Error('Reproduction differs: ' + relative);
  } else {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
  }
};
const previous = await read(receiptPath).then(bytes => JSON.parse(bytes)).catch(() => null);

function bounds(data, width, height, threshold = 0) {
  let left = width, top = height, right = 0, bottom = 0, pixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > threshold) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); pixels++;
  }
  if (!pixels) throw Error('Empty native cutout');
  return { x: left, y: top, width: right - left, height: bottom - top, pixels };
}

// Alpha>16 locates complete source objects only; it NEVER changes their pixels.
// All RGBA pixels, including faint antialiasing, remain in each actual gap crop.
function sourceGroups(data, width, height, columns, rows) {
  const visited = new Uint8Array(width * height), queue = new Int32Array(visited.length);
  const groups = Array.from({ length: columns * rows }, () => []);
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] <= 16) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    visited[start] = 1; queue[0] = start;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!visited[next] && data[next * 4 + 3] > 16) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    // Tiny disconnected antialias specks do not move the segmentation seam;
    // they are still preserved by the surrounding full RGBA source crop.
    if (tail < 16) continue;
    const column = Math.min(columns - 1, Math.floor((left + right) / 2 / (width / columns)));
    const row = Math.min(rows - 1, Math.floor((top + bottom) / 2 / (height / rows)));
    groups[row * columns + column].push({ left, top, right, bottom, pixels: tail });
  }
  return groups.map((parts, index) => {
    if (!parts.length || Math.max(...parts.map(part => part.pixels)) < 200) throw Error('Missing complete native cell: ' + index);
    return { left: Math.min(...parts.map(part => part.left)), top: Math.min(...parts.map(part => part.top)), right: Math.max(...parts.map(part => part.right)), bottom: Math.max(...parts.map(part => part.bottom)) };
  });
}

// Some diagonally separated whole objects have overlapping rectangular bounds.
// In that one native sheet, attribute complete alpha>0 connected components to
// their actual cell. Every nontransparent source pixel is copied exactly once;
// no alpha threshold, color key or repaired pixels enter the cutout itself.
function disjointCutouts(data, width, height, columns, rows, groups) {
  const visited = new Uint8Array(width * height), queue = new Int32Array(visited.length);
  const parts = [], assigned = Array.from({ length: columns * rows }, () => []);
  let sourcePixels = 0;
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] === 0) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    visited[start] = 1; queue[0] = start;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!visited[next] && data[next * 4 + 3] > 0) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    const center = { x: (left + right) / 2, y: (top + bottom) / 2 };
    // Small detached antialias components follow the nearest complete object;
    // this retains their original RGBA rather than discarding faint pixels.
    const distances = groups.map(group => Math.hypot(Math.max(group.left - center.x, 0, center.x - group.right), Math.max(group.top - center.y, 0, center.y - group.bottom)));
    const cell = tail >= 200 ? Math.min(rows - 1, Math.floor(center.y / (height / rows))) * columns + Math.min(columns - 1, Math.floor(center.x / (width / columns))) : distances.indexOf(Math.min(...distances));
    const part = { left, top, right, bottom, pixels: queue.slice(0, tail) };
    parts.push(part); assigned[cell].push(part); sourcePixels += tail;
  }
  let copiedPixels = 0;
  const cutouts = assigned.map((entries, index) => {
    if (!entries.length || !entries.some(part => part.pixels.length >= 200)) throw Error('Missing complete disjoint native cell: ' + index);
    const left = Math.min(...entries.map(part => part.left)), top = Math.min(...entries.map(part => part.top));
    const right = Math.max(...entries.map(part => part.right)), bottom = Math.max(...entries.map(part => part.bottom));
    const crop = { left, top, width: right - left, height: bottom - top }, raw = Buffer.alloc(crop.width * crop.height * 4);
    for (const part of entries) for (const pixel of part.pixels) {
      const target = ((Math.floor(pixel / width) - top) * crop.width + pixel % width - left) * 4;
      data.copy(raw, target, pixel * 4, pixel * 4 + 4); copiedPixels++;
    }
    return { crop, raw };
  });
  if (copiedPixels !== sourcePixels) throw Error('Incomplete native alpha-component attribution');
  return { cutouts, sourcePixels, copiedPixels, components: parts.length };
}

async function sheet(relative, columns, rows, disjoint = false) {
  if (!await exists(relative)) { if (available) return null; throw Error('Missing native sheet: ' + relative); }
  const bytes = await read(relative), info = await sharp(bytes).metadata();
  if (!info.hasAlpha || !info.width || !info.height) throw Error('Native transparency required: ' + relative);
  const digest = hash(bytes), old = previous?.sources.find(item => item.path === relative);
  if (old && old.sha256 !== digest) throw Error('Preserve previously packed native bytes: ' + relative);
  const data = await sharp(bytes).ensureAlpha().raw().toBuffer();
  let zero = 0, visible = 0;
  for (let at = 3; at < data.length; at += 4) { if (data[at] === 0) zero++; if (data[at] > 160) visible++; }
  if (!zero || !visible) throw Error('Missing genuinely transparent gutter/visible artwork: ' + relative);
  const groups = sourceGroups(data, info.width, info.height, columns, rows);
  if (disjoint) {
    const separated = disjointCutouts(data, info.width, info.height, columns, rows, groups);
    if (separated.sourcePixels !== info.width * info.height - zero) throw Error('Native alpha pixels were not completely attributed');
    sources.push({ path: relative, sha256: digest, width: info.width, height: info.height, columns, rows, transparentPixels: zero, visiblePixels: visible, sourceBytesUnchanged: true, cutoutMethod: 'Complete alpha>0 connected components; all nontransparent pixels attributed exactly once, unchanged RGBA.', sourceNontransparentPixels: separated.sourcePixels, copiedNontransparentPixels: separated.copiedPixels, components: separated.components });
    return { bytes, crops: separated.cutouts.map(item => item.crop), cutouts: separated.cutouts, path: relative };
  }
  const crops = groups.map((group, index) => {
    const column = index % columns, row = Math.floor(index / columns);
    const left = column ? Math.floor((groups[index - 1].right + group.left) / 2) : 0;
    const right = column + 1 < columns ? Math.floor((group.right + groups[index + 1].left) / 2) : info.width;
    // A tall pineapple can rise above another column's previous-row fruit.
    // Split each actual same-column gap instead of cutting a global grid line.
    const top = row ? Math.floor((groups[index - columns].bottom + group.top) / 2) : 0;
    const bottom = row + 1 < rows ? Math.floor((group.bottom + groups[index + columns].top) / 2) : info.height;
    if (left > group.left || right < group.right || top > group.top || bottom < group.bottom) throw Error('Native cells overlap: ' + relative + ' cell' + index);
    return { left, top, width: right - left, height: bottom - top };
  });
  sources.push({ path: relative, sha256: digest, width: info.width, height: info.height, columns, rows, transparentPixels: zero, visiblePixels: visible, sourceBytesUnchanged: true });
  return { bytes, crops, path: relative };
}

async function add(source, sourceIndex, atlasId, id, index) {
  const atlas = definitions.find(item => item.id === atlasId), sourceBox = source.crops[sourceIndex];
  const raw = source.cutouts ? source.cutouts[sourceIndex].raw : await sharp(source.bytes).extract(sourceBox).ensureAlpha().raw().toBuffer();
  const trim = bounds(raw, sourceBox.width, sourceBox.height);
  const padding = 8, limit = atlas.cell - padding * 2;
  const resized = await sharp(raw, { raw: { width: sourceBox.width, height: sourceBox.height, channels: 4 } }).extract({ left: trim.x, top: trim.y, width: trim.width, height: trim.height }).resize({ width: limit, height: limit, fit: 'inside', kernel: source.pixel ? 'nearest' : 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const left = Math.floor((atlas.cell - resized.info.width) / 2), top = Math.floor((atlas.cell - resized.info.height) / 2);
  const packed = await sharp({ create: { width: atlas.cell, height: atlas.cell, channels: 4, background: '#0000' } }).composite([{ input: resized.data, raw: { width: resized.info.width, height: resized.info.height, channels: 4 }, left, top }]).raw().toBuffer();
  const content = bounds(packed, atlas.cell, atlas.cell, 16);
  const cell = { id, atlas: atlasId, index, x: index % atlas.columns * atlas.cell, y: Math.floor(index / atlas.columns) * atlas.cell, width: atlas.cell, height: atlas.cell, content: { x: content.x, y: content.y, width: content.width, height: content.height } };
  buckets[atlasId].push({ ...cell, data: packed });
  cells.push({ ...cell, source: source.path, sourceIndex, sourceBox, alphaTrim: { x: trim.x, y: trim.y, width: trim.width, height: trim.height }, resized: { width: resized.info.width, height: resized.info.height }, scale: round(Math.min(limit / trim.width, limit / trim.height)), padding: { left, top }, rgbaSha256: hash(packed), ...(source.pixel ? { resizeKernel: 'nearest', construction: 'New code-native flat stepped SVG; no source photo pixels.' } : {}) });
}

async function pixelSource(relative) {
  if (!await exists(relative)) { if (available) return null; throw Error('Missing authored pixel view: ' + relative); }
  const original = await read(relative), digest = hash(original), old = previous?.sources.find(item => item.path === relative);
  if (old && old.sha256 !== digest) throw Error('Preserve previously packed pixel source: ' + relative);
  if (/<(?:script|image|filter|animate)|(?:xlink:)?href\s*=/i.test(original.toString('utf8'))) throw Error('Pixel SVG must be original flat paths/rectangles only');
  const raster = await sharp(original).ensureAlpha().png().toBuffer(), info = await sharp(raster).metadata();
  if (info.width !== 128 || info.height !== 64 || !info.hasAlpha) throw Error('Expected transparent128x64 authored pixel view');
  sources.push({ path: relative, sha256: digest, width: info.width, height: info.height, sourceBytesUnchanged: true, format: 'svg', construction: 'User-provided visual guide interpreted as new original flat vector; no photo/background/footer copied.' });
  return { bytes: raster, crops: [{ left: 0, top: 0, width: info.width, height: info.height }], path: relative, pixel: true };
}

const foodIds = [], batches = edition === 107 ? [4, 5] : [1, 2, 3];
for (const [batch, number] of batches.entries()) {
  const label = String(number).padStart(2, '0');
  const source = await sheet(run + '/원본/먹거리' + label + '_생성과도장.png', 6, 4);
  if (!source) continue;
  const request = JSON.parse(await read(run + '/먹거리' + number + '요청.json'));
  if (request.orderedFoodIds.length !== 12) throw Error('Exactly twelve ordered food/stamp pairs required');
  if (edition === 107 && (JSON.stringify(request.requestedFoodIds) !== JSON.stringify(foodIds107.slice(batch * 12, batch * 12 + 12)) || JSON.stringify(request.observedCellFoodIds) !== JSON.stringify(request.orderedFoodIds))) throw Error('Keep requested domain order separate from actual observed source-cell mapping');
  for (let index = 0; index < 12; index++) {
    const id = request.orderedFoodIds[index], slot = edition === 107 ? foodIds107.indexOf(id) : batch * 12 + index;
    if (slot < 0) throw Error('Observed food is outside the immutable107 domain: ' + id);
    if (foodIds.includes(id)) throw Error('Duplicate food ID: ' + id);
    foodIds.push(id);
    await add(source, index * 2, foodAtlas, id, slot);
    await add(source, index * 2 + 1, stampAtlas, id, slot);
  }
}
const behaviorSheet = await sheet(run + (edition === 107 ? '/원본/추억도장_열두상황.png' : '/원본/행동도장_열두행동.png'), 4, 3);
if (behaviorSheet) for (const [index, id] of (edition === 107 ? situationIds : behaviorIds).entries()) await add(behaviorSheet, index, edition === 107 ? 'situation-stamp' : 'behavior-stamp', id, index);
const accessorySheet = await sheet(run + (edition === 107 ? '/원본/새장신구_여섯종네시점.png' : '/원본/장신구_여섯종네시점.png'), edition === 107 ? 5 : 6, 4);
if (edition === 107) for (const [row, view] of views.entries()) {
  const source = await pixelSource(run + '/원본/픽셀선글라스_' + ['정면', '사선', '옆면', '뒷면'][row] + '.svg');
  if (source) await add(source, 0, accessoryAtlas, 'pixel-sunglasses:' + view, row * 6);
}
if (accessorySheet) for (const [row, view] of views.entries()) for (const [column, id] of (edition === 107 ? accessoryIds.slice(1) : accessoryIds).entries()) await add(accessorySheet, row * (edition === 107 ? 5 : 6) + column, accessoryAtlas, id + ':' + view, row * 6 + column + (edition === 107 ? 1 : 0));
if (edition === 106) {
  const bookGiftSheet = await sheet(run + '/원본/수집책과선물_여섯그림.png', 3, 2, true);
  if (bookGiftSheet) for (const [index, id] of bookGiftIds.entries()) await add(bookGiftSheet, index, 'book-gift', id, index);
}
if (!available && foodIds.length !== batches.length * 12) throw Error('All requested food/stamp pairs required');

const atlases = {};
for (const definition of definitions) {
  const entries = buckets[definition.id];
  if (!entries.length) continue;
  const width = definition.cell * definition.columns, height = definition.cell * definition.rows;
  const bytes = await sharp({ create: { width, height, channels: 4, background: '#0000' } }).composite(entries.map(entry => ({ input: entry.data, raw: { width: definition.cell, height: definition.cell, channels: 4 }, left: entry.x, top: entry.y }))).webp({ lossless: true, effort: 6 }).toBuffer();
  await writeOrCheck(destination + '/' + definition.file, bytes);
  atlases[definition.id] = { src: '/companion/collection/' + definition.file, width, height, cell: definition.cell, columns: definition.columns, rows: definition.rows, sha256: hash(bytes) };
}
const receipt = { version: 1, method: 'Complete alpha-gap source crops, or complete alpha>0 connected components where rectangular bounds overlap; trim only alpha0; preserve all nontransparent RGBA exactly once before isotropic Lanczos resize; center in transparent cells; lossless WebP. Alpha>16 is segmentation/measurement only, never a pixel deletion rule.' + (edition === 107 ? ' Four original pixel SVG views use nearest-neighbor resizing to preserve exact flat black/white square edges.' : ''), sources, atlases, cells };
const otherEdition = edition === 107 ? 106 : 107;
const other = await read(runs[otherEdition] + '/정리본/패킹기록.json').then(bytes => JSON.parse(bytes)).catch(error => { if (error.code === 'ENOENT' && edition === 106) return null; throw error; });
if (other) for (const atlas of Object.values(other.atlases)) {
  if (!atlas.src.startsWith('/companion/collection/') || hash(await read('public' + atlas.src)) !== atlas.sha256) throw Error('Previously registered atlas bytes changed: ' + atlas.src);
}
const combinedAtlases = {}, frames = { food: {}, 'food-stamp': {}, 'behavior-stamp': {}, accessory: {}, book: {}, gift: {}, 'situation-stamp': {} };
for (const item of (edition === 106 ? [receipt, other] : [other, receipt]).filter(Boolean)) {
  for (const [id, atlas] of Object.entries(item.atlases)) {
    if (combinedAtlases[id]) throw Error('Duplicate immutable atlas ID: ' + id);
    combinedAtlases[id] = atlas;
  }
  for (const cell of [...item.cells].sort((left, right) => left.index - right.index)) {
    const definition = [...editions[106], ...editions[107]].find(row => row.id === cell.atlas);
    if (!definition || !item.atlases[cell.atlas]) throw Error('Unregistered receipt cell atlas: ' + cell.atlas);
    const kind = definition.kind ?? (cell.id.startsWith('book-') ? 'book' : 'gift');
    if (frames[kind][cell.id]) throw Error('An additive edition cannot replace a previous collection ID: ' + cell.id);
    frames[kind][cell.id] = Object.fromEntries(['id', 'atlas', 'index', 'x', 'y', 'width', 'height', 'content'].map(key => [key, cell[key]]));
  }
}
const registry = [
  '// Generated by scripts/prepare-companion-collection.mjs; source cutouts remain unchanged.',
  'export type CompanionCollectionArtKind = "food" | "food-stamp" | "behavior-stamp" | "accessory" | "book" | "gift" | "situation-stamp";',
  'export type CompanionAccessoryView = "front" | "quarter" | "side" | "back";',
  'type AtlasId = Exclude<CompanionCollectionArtKind, "book" | "gift"> | "book-gift" | "food-107" | "food-stamp-107" | "accessory-107";',
  'export type CompanionCollectionAtlas = Readonly<{ src: string; width: number; height: number; cell: number; columns: number; rows: number; sha256: string }>;',
  'export type CompanionCollectionFrame = Readonly<{ id: string; atlas: AtlasId; index: number; x: number; y: number; width: number; height: number; content: Readonly<{ x: number; y: number; width: number; height: number }> }>;',
  'export type CompanionCollectionArtFrame = CompanionCollectionFrame & Readonly<{ src: string; atlasWidth: number; atlasHeight: number }>;',
  'export const COMPANION_COLLECTION_ATLASES: Readonly<Partial<Record<AtlasId, CompanionCollectionAtlas>>> = ' + JSON.stringify(combinedAtlases, null, 2) + ';',
  'export const COMPANION_COLLECTION_FRAMES: Readonly<Record<CompanionCollectionArtKind, Readonly<Record<string, CompanionCollectionFrame>>>> = ' + JSON.stringify(frames, null, 2) + ';',
  'const presented: Readonly<Record<string, CompanionCollectionArtFrame>> = Object.fromEntries(Object.entries(COMPANION_COLLECTION_FRAMES).flatMap(([kind, entries]) => Object.entries(entries).map(([id, frame]) => { const atlas = COMPANION_COLLECTION_ATLASES[frame.atlas]!; return [kind + ":" + id, { ...frame, src: atlas.src, atlasWidth: atlas.width, atlasHeight: atlas.height }]; })));',
  '/** Stable metadata only; no decoding, network, DOM measurements or frame loop. */',
  'export function getCompanionCollectionArtFrame(kind: CompanionCollectionArtKind, id?: string, view: CompanionAccessoryView = "front"): CompanionCollectionArtFrame | undefined {',
  '  let key = id ?? (kind === "book" ? "book-closed" : kind === "gift" ? "gift-wrapped" : "");',
  '  if (kind === "accessory" && !key.includes(":")) key += ":" + view;',
  '  return presented[kind + ":" + key];',
  '}',
  '',
].join('\n');
await writeOrCheck(registryPath, registry);
await writeOrCheck(receiptPath, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ status: check ? 'REPRODUCED' : 'PACKED', edition, stagedAvailableOnly: available, sources: sources.length, foods: foodIds.length, atlases: Object.keys(atlases), cells: cells.length, registry: registryPath, receipt: receiptPath }));
