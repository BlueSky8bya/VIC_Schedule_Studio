// Whole-key crop/registration and existing offline rigs only. No generation,
// eye repaint, facial transplant, old native overwrite or runtime inference.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cell = 192, unit = 80, ratio = cell / unit, foot = 180;
const families = { clean: [4, 16], mood: [4, 16], play: [6, 36], ear: [2, 4], recovery: [2, 4], throw: [2, 4], audience: [4, 16] };
const lineagePaths = {
  hd: 'art-src/빅타민/동행/작업회차/20261015-전동작고해상도/파생기록.json',
  play: 'art-src/빅타민/동행/작업회차/20261016-덤벙놀이/패킹파생기록.json',
  ear: 'art-src/빅타민/동행/작업회차/20261016-귀두개교정/패킹파생기록.json',
  recovery: 'art-src/빅타민/동행/작업회차/20261017-어지럼회복/패킹파생기록.json',
  throw: 'art-src/빅타민/동행/작업회차/20261017-관성비행/패킹파생기록.json',
  audience: 'art-src/최초공개/응원단/작업회차/20261014-움직이는응원단/파생기록.json',
};
const encoding = { quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const alphaHash = rgba => {
  const alpha = Buffer.alloc(rgba.length / 4);
  for (let index = 3; index < rgba.length; index += 4) alpha[(index - 3) / 4] = rgba[index];
  return hash(alpha);
};
const round = value => Math.round(value * 1e6) / 1e6;
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const resolveRepo = name => {
  if (typeof name !== 'string' || !name || path.isAbsolute(name)) throw Error('A repository-relative path is required');
  const result = path.resolve(root, name);
  if (!result.startsWith(`${root}${path.sep}`)) throw Error(`Outside repository: ${name}`);
  return result;
};
const read = name => fs.readFile(resolveRepo(name));
const readJson = async name => JSON.parse(await read(name));
const requireArtPath = name => {
  const absolute = resolveRepo(name), archive = path.join(root, 'art-src');
  if (!absolute.startsWith(`${archive}${path.sep}`)) throw Error(`Outside the source-art archive: ${name}`);
  return absolute;
};

/** Preserve the established slot map, applying selective whole-pose lineage
 * in chronological precedence without running scripts that restore old JSON. */
export function createEyeStyleMap(base, play, receipts) {
  if (base.frames.length !== 304 || play.frames.length !== 208 || base.rows.length !== 20 || play.rows.length !== 13 || base.atlases.length !== 19 || play.atlases.length !== 13) throw Error('Expected established304+208 slots/20+13 rows/19+13 packets');
  const slots = receipts.hd.cells.map((item, index) => ({ index, family: item.rig.sourceId, key: item.rig.sourceIndex, rig: item.rig }));
  if (slots.length !== 304 || slots.some(slot => !['clean', 'mood'].includes(slot.family) || !Number.isInteger(slot.key) || slot.key < 0 || slot.key >= 16)) throw Error('Missing/invalid established HD rig records');
  for (let index = 0; index < play.frames.length; index++) {
    const packet = Math.floor(index / 16), column = index % 16;
    let family = 'play', key = receipts.play.packets[packet]?.nativeIndicesByColumn[column];
    if (packet === 12) { family = 'throw'; key = receipts.throw.columns[column]; }
    else if (packet === 3) { family = 'recovery'; key = receipts.recovery.columns[column]; }
    else {
      const replacement = receipts.ear.replacementIndices.indexOf(key);
      if (replacement >= 0) { family = 'ear'; key = replacement; }
    }
    if (!families[family] || !Number.isInteger(key) || key < 0 || key >= families[family][1]) throw Error(`Invalid whole-key lineage at play${index}`);
    slots.push({ index: base.frames.length + index, family, key });
  }
  const rows = [...base.rows, ...play.rows.map(row => row.map(index => index + base.frames.length))];
  const live = new Set(rows.flat());
  if ([...live].some(index => !Number.isInteger(index) || index < 0 || index >= slots.length)) throw Error('Logical row references an absent slot');
  // Logical row7 is retained compatibility metadata, not an active clip.
  // Its112..126 frames remain used by16/17; only127 is compatibility-only.
  const active = new Set(rows.flatMap((row, index) => index === 7 ? [] : row));
  return { slots: slots.map(slot => ({ ...slot, live: live.has(slot.index), activeLive: active.has(slot.index) })), rows, liveSlots: live.size, activeLiveSlots: active.size, compatibilityOnlySlots: [...live].filter(index => !active.has(index)),
    liveKeys: [...new Set([...live].map(index => `${slots[index].family}:${slots[index].key}`))].sort(),
    deadSlots: slots.filter(slot => !live.has(slot.index)).map(slot => slot.index) };
}

function components(bytes, width, height, dark = false) {
  const seen = new Uint8Array(width * height), queue = new Int32Array(width * height), found = [];
  const matches = index => bytes[index * 4 + 3] > (dark ? 200 : 160) && (!dark || bytes[index * 4] < 150 && bytes[index * 4 + 1] < 115 && bytes[index * 4 + 2] < 105);
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || !matches(start)) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    seen[start] = 1; queue[0] = start;
    while (head < tail) {
      const at = queue[head++], x = at % width, y = Math.floor(at / width);
      left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!seen[next] && matches(next)) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    found.push({ left, top, right, bottom, width: right - left, height: bottom - top, pixels: tail });
  }
  return found.sort((a, b) => b.pixels - a.pixels);
}
const union = boxes => ({ left: Math.min(...boxes.map(box => box.left)), top: Math.min(...boxes.map(box => box.top)), right: Math.max(...boxes.map(box => box.right)), bottom: Math.max(...boxes.map(box => box.bottom)) });
const gap = (a, b) => Math.hypot(Math.max(0, a.left - b.right, b.left - a.right), Math.max(0, a.top - b.bottom, b.top - a.bottom));
const intersects = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
function copyCrop(bytes, width, height, box) {
  const output = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const yy = y + box.top;
    if (yy < 0 || yy >= height) continue;
    const from = Math.max(0, box.left), to = Math.min(width, box.left + box.width);
    if (to > from) bytes.copy(output, (y * box.width + from - box.left) * 4, (yy * width + from) * 4, (yy * width + to) * 4);
  }
  return output;
}
const bounds = (bytes, width, height) => {
  const result = components(bytes, width, height)[0];
  if (!result || result.pixels < 100) throw Error('Missing complete primary silhouette');
  return result;
};
function faceGroup(bytes, width, height, body) {
  // Registration evidence only. Protect all eligible authored dark features
  // together, including larger eyes; never extract or move one eye alone.
  const parts = components(bytes, width, height, true).filter(part => part.pixels >= 3 && part.width < body.width * .65 && part.height < body.height * .35 && part.left > body.left && part.right < body.right && part.top > body.top + body.height * .25 && part.bottom < body.bottom);
  if (parts.length < 2) throw Error('Cannot register the new authored face as one rigid group');
  const featureBounds = union(parts);
  return { featureBounds, protected: { left: featureBounds.left - body.width * .1, right: featureBounds.right + body.width * .1, top: featureBounds.top - body.height * .08, bottom: featureBounds.bottom + body.height * .08 }, fade: body.height * .035 };
}
async function extractSource(id, definition) {
  const [grid, count] = families[id];
  if (definition.grid !== grid || definition.count !== count || !/^[a-f0-9]{64}$/i.test(definition.sha256 ?? '') || !definition.path?.startsWith('art-src/') || !definition.provenance || typeof definition.provenance === 'string' && !definition.provenance.trim()) throw Error(`Explicit source path/SHA/grid/count/provenance required: ${id}`);
  requireArtPath(definition.path);
  const native = await read(definition.path);
  if (hash(native) !== definition.sha256.toLowerCase()) throw Error(`New native SHA mismatch: ${id}`);
  if (typeof definition.provenance !== 'string') throw Error(`Pinned registration receipt path required: ${id}`);
  const registrationBytes = await read(definition.provenance), registration = JSON.parse(registrationBytes);
  if (registration.sha256?.toLowerCase() !== hash(native)) throw Error(`New native differs from its actual generation registration: ${id}`);
  const { data, info } = await sharp(native).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const nativeMetadata = await sharp(native).metadata();
  if (!nativeMetadata.hasAlpha || info.width < 400 || info.height < 400) throw Error(`Transparent native source required: ${id}`);
  const parts = components(data, info.width, info.height), bodies = parts.slice(0, count);
  if (bodies.length !== count || bodies.at(-1).pixels < Math.max(500, bodies[0].pixels * .15) || parts[count]?.pixels > bodies.at(-1).pixels * .35) throw Error(`Ambiguous${count}-body native: ${id}`);
  const cuts = definition.cuts ?? { x: Array.from({ length: grid + 1 }, (_, i) => Math.round(i * info.width / grid)), y: Array.from({ length: grid + 1 }, (_, i) => Math.round(i * info.height / grid)) };
  for (const [axis, length] of [['x', info.width], ['y', info.height]]) if (cuts[axis]?.length !== grid + 1 || cuts[axis][0] !== 0 || cuts[axis].at(-1) !== length || cuts[axis].some((value, i) => !Number.isInteger(value) || i > 0 && value <= cuts[axis][i - 1])) throw Error(`Invalid actual grid cuts: ${id}:${axis}`);
  const cellAt = body => {
    const x = (body.left + body.right) / 2, y = (body.top + body.bottom) / 2;
    return cuts.y.findIndex((edge, i) => i < grid && y >= edge && y < cuts.y[i + 1]) * grid + cuts.x.findIndex((edge, i) => i < grid && x >= edge && x < cuts.x[i + 1]);
  };
  const mapped = new Map(bodies.map(body => [cellAt(body), body]));
  if (mapped.size !== count || Array.from({ length: count }, (_, i) => i).some(i => !mapped.has(i))) throw Error(`Ambiguous whole-pose grid mapping: ${id}`);
  const keys = [];
  for (let key = 0; key < count; key++) {
    const body = mapped.get(key), marks = parts.filter(part => !bodies.includes(part) && part.pixels >= 24 && cellAt(part) === key && gap(body, part) <= Math.max(body.width, body.height) * .18);
    const visible = union([body, ...marks]);
    // A tight rectangular crop preserves the entire pose without borrowing a
    // neighbouring row simply because this authored tumble is extra wide.
    const box = { left: visible.left - 4, top: visible.top - 4, width: visible.right - visible.left + 8, height: visible.bottom - visible.top + 8 };
    if (bodies.some(other => other !== body && intersects({ ...box, right: box.left + box.width, bottom: box.top + box.height }, other))) throw Error(`Whole-pose crop would include another mascot: ${id}:${key}`);
    const rgba = copyCrop(data, info.width, info.height, box), cropped = bounds(rgba, box.width, box.height);
    if (cropped.pixels !== body.pixels || cropped.width !== body.width || cropped.height !== body.height) throw Error(`Whole silhouette clipped during crop: ${id}:${key}`);
    const record = { key, box, body, marks, nativeCellCrossing: body.left < cuts.x[key % grid] || body.right > cuts.x[key % grid + 1] || body.top < cuts.y[Math.floor(key / grid)] || body.bottom > cuts.y[Math.floor(key / grid) + 1], nativeEdgeContact: body.left === 0 || body.top === 0 || body.right === info.width || body.bottom === info.height, rgbaSha256: hash(rgba), completeBodyPreserved: true };
    const localVisible = { left: visible.left - box.left, top: visible.top - box.top, right: visible.right - box.left, bottom: visible.bottom - box.top, width: visible.right - visible.left, height: visible.bottom - visible.top };
    keys.push({ rgba, width: box.width, height: box.height, body: cropped, visible: localVisible, alpha: allAlphaBounds(rgba, box.width, box.height), record, ...(id === 'clean' || id === 'mood' ? { face: faceGroup(rgba, box.width, box.height, cropped) } : {}) });
  }
  return { native, keys, record: { ...definition, sha256: hash(native), bytes: native.length, width: info.width, height: info.height, provenanceSha256: hash(registrationBytes), registrationStatus: registration.status, approvalAtPacking: registration.approval, artReviewAtPacking: registration.full_review, actualCuts: cuts, keys: keys.map(key => key.record) } };
}

function register(data, atlas, index) {
  const body = bounds(data, cell, cell), marks = union(components(data, cell, cell).filter(part => part.pixels >= 8 && gap(body, part) <= Math.max(body.width, body.height) * .2));
  const wholeMarksVisibleBounds = { ...marks, width: marks.right - marks.left, height: marks.bottom - marks.top };
  // Fit, registration and clipping include every anti-aliased alpha pixel.
  // Keep solid pose/mark bounds separately for lineage inspection.
  const visible = allAlphaBounds(data, cell, cell);
  if (visible.width > cell * .76 || visible.height > cell * .82 || visible.left < 5 || visible.top < 5 || visible.right > cell - 5 || visible.bottom > cell - 5) throw Error(`Whole-pose runtime footprint/edge failed: ${atlas}:${index}`);
  const frame = { atlas, index, x: round((cell / 2 - (visible.left + visible.right) / 2) / ratio), y: round((cell - visible.bottom) / ratio), clip: [visible.top / ratio - 2, (cell - visible.right) / ratio - 2, (cell - visible.bottom) / ratio - 2, visible.left / ratio - 2].map(round) };
  if (frame.clip.some(value => value < 0)) throw Error('Negative protective clip');
  return { frame, body, wholeMarksVisibleBounds, allAlphaBounds: visible, visibleBounds: visible, anchor: { centerX: round((visible.left + visible.right) / 2 / ratio + frame.x), footY: round(visible.bottom / ratio + frame.y) }, rgbaSha256: hash(data) };
}

/** Existing bounded inverse rig. All colour samples come from the new whole
 * key. The central authored face stays rigid together while ears/paper move. */
export function bakeEyeStyleKey(key, rig, textureScale) {
  const output = Buffer.alloc(cell * cell * 4), body = key.body, face = key.face;
  const visible = key.alpha ?? key.visible ?? body;
  const cx = (visible.left + visible.right) / 2, bottom = visible.bottom, cosine = Math.cos(rig.tilt), sine = Math.sin(rig.tilt);
  let sampled = 0, minimumRigidWeight = 1, maximumFeatureDeviation = 0;
  for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
    const dx = x + .5 - cell / 2 - rig.sway, dy = y + .5 - foot;
    let ux = (cosine * dx + sine * dy) / rig.sx, uy = (-sine * dx + cosine * dy) / rig.sy;
    const upper = 1 - smooth(((uy / textureScale + bottom - body.top) / body.height - .25) / .25), leftWeight = 1 - smooth((ux + 12) / 24);
    ux -= upper * (rig.ears[0].x * leftWeight + rig.ears[1].x * (1 - leftWeight));
    uy -= upper * (rig.ears[0].y * leftWeight + rig.ears[1].y * (1 - leftWeight));
    let px = ux / textureScale + cx - .5, py = uy / textureScale + bottom - .5;
    const protectedFace = face.protected;
    const rigid = (1 - smooth((protectedFace.left - px) / face.fade)) * (1 - smooth((px - protectedFace.right) / face.fade)) * (1 - smooth((protectedFace.top - py) / face.fade)) * (1 - smooth((py - protectedFace.bottom) / face.fade));
    const rx = (cosine * dx + sine * dy) / textureScale + cx - .5, ry = (-sine * dx + cosine * dy) / textureScale + bottom - .5;
    px += (rx - px) * rigid; py += (ry - py) * rigid;
    if (rx >= face.featureBounds.left && rx < face.featureBounds.right && ry >= face.featureBounds.top && ry < face.featureBounds.bottom) { sampled++; minimumRigidWeight = Math.min(minimumRigidWeight, rigid); maximumFeatureDeviation = Math.max(maximumFeatureDeviation, Math.abs(px - rx), Math.abs(py - ry)); }
    // The crop already contains the whole pose and its retained nearby marks.
    // Sampling only bodyBCR±4 here would erase authored tears/emotion marks.
    if (px < 0 || py < 0 || px >= key.width - 1 || py >= key.height - 1) continue;
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    const offsets = [(iy * key.width + ix) * 4, (iy * key.width + ix + 1) * 4, ((iy + 1) * key.width + ix) * 4, ((iy + 1) * key.width + ix + 1) * 4], weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
    let alpha = 0; const rgb = [0, 0, 0];
    for (let n = 0; n < 4; n++) { const a = key.rgba[offsets[n] + 3] / 255 * weights[n]; alpha += a; for (let channel = 0; channel < 3; channel++) rgb[channel] += key.rgba[offsets[n] + channel] * a; }
    if (alpha > 0) { const to = (y * cell + x) * 4; for (let channel = 0; channel < 3; channel++) output[to + channel] = Math.round(rgb[channel] / alpha); output[to + 3] = Math.round(alpha * 255); }
  }
  if (!sampled || minimumRigidWeight !== 1 || maximumFeatureDeviation > 1e-10) throw Error('Authored large eyes/mouth left their shared rigid region');
  return { data: output, faceProtection: { sampled, minimumRigidWeight, maximumFeatureDeviation } };
}

async function prepareKey(key, targetWidth, targetHeight) {
  const visible = key.alpha ?? allAlphaBounds(key.rgba, key.width, key.height);
  const scale = Math.min(1, targetWidth / (visible.right - visible.left), targetHeight / (visible.bottom - visible.top));
  const resized = await sharp(key.rgba, { raw: { width: key.width, height: key.height, channels: 4 } }).resize(Math.floor(key.width * scale), Math.floor(key.height * scale), { fit: 'fill', kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const body = bounds(resized.data, resized.info.width, resized.info.height), left = Math.round(cell / 2 - (body.left + body.right) / 2), top = foot - body.bottom;
  if (left < 0 || top < 0 || left + resized.info.width > cell || top + resized.info.height > cell) throw Error('Whole-key padding exceeds runtime cell');
  const data = await sharp({ create: { width: cell, height: cell, channels: 4, background: '#0000' } }).composite([{ input: resized.data, raw: { width: resized.info.width, height: resized.info.height, channels: 4 }, left, top }]).raw().toBuffer();
  return { data, uniformScale: scale };
}

async function encodePacket(raw, width, height) {
  const webp = await sharp(raw, { raw: { width, height, channels: 4 } }).webp(encoding).toBuffer(), decoded = await sharp(webp).ensureAlpha().raw().toBuffer();
  for (let index = 3; index < raw.length; index += 4) if (raw[index] !== decoded[index]) throw Error('Encoding changed alpha');
  return webp;
}

function allAlphaBounds(bytes, width, height) {
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (bytes[(y * width + x) * 4 + 3] > 0) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); }
  if (right <= left || bottom <= top) throw Error('Empty authored alpha');
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}
async function prepareAudience(source, previous) {
  const side = 256, margin = 4, oldBodies = [];
  for (let index = 0; index < 16; index++) {
    const oldCell = await sharp(previous.data, { raw: { width: 1024, height: 1024, channels: 4 } }).extract({ left: index % 4 * side, top: Math.floor(index / 4) * side, width: side, height: side }).raw().toBuffer();
    oldBodies.push(bounds(oldCell, side, side));
  }
  // One shared scale for the cast preserves the new source's relative pose
  // sizes. Original centre/foot are targets; no authored alpha may be cut to
  // force a source-edge old anchor onto a newly complete drawing.
  const scale = Math.min(1, ...source.keys.flatMap((key, index) => [oldBodies[index].width / key.visible.width, oldBodies[index].height / key.visible.height, (side - margin * 2) / key.width, (side - margin * 2) / key.height]));
  const keys = [], records = [];
  for (const [index, key] of source.keys.entries()) {
    const scaled = await sharp(key.rgba, { raw: { width: key.width, height: key.height, channels: 4 } }).resize(Math.floor(key.width * scale), Math.floor(key.height * scale), { kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
    const body = bounds(scaled.data, scaled.info.width, scaled.info.height), alpha = allAlphaBounds(scaled.data, scaled.info.width, scaled.info.height), oldBody = oldBodies[index];
    const wantedLeft = Math.round((oldBody.left + oldBody.right - body.left - body.right) / 2), wantedTop = oldBody.bottom - body.bottom;
    const left = Math.max(margin - alpha.left, Math.min(side - margin - alpha.right, wantedLeft)), top = Math.max(margin - alpha.top, Math.min(side - margin - alpha.bottom, wantedTop));
    const trimmed = await sharp(scaled.data, { raw: { width: scaled.info.width, height: scaled.info.height, channels: 4 } }).extract({ left: alpha.left, top: alpha.top, width: alpha.width, height: alpha.height }).raw().toBuffer();
    const rgba = await sharp({ create: { width: side, height: side, channels: 4, background: '#0000' } }).composite([{ input: trimmed, raw: { width: alpha.width, height: alpha.height, channels: 4 }, left: left + alpha.left, top: top + alpha.top }]).raw().toBuffer();
    const finalBody = bounds(rgba, side, side), finalAlpha = allAlphaBounds(rgba, side, side);
    if (finalAlpha.width !== alpha.width || finalAlpha.height !== alpha.height || finalAlpha.left < margin || finalAlpha.top < margin || finalAlpha.right > side - margin || finalAlpha.bottom > side - margin) throw Error(`Whole audience alpha clipped: ${index}`);
    keys.push(rgba); records.push({ key: index, oldBody, commonScale: scale, transparentPaddingOnlyTrimmed: true, visibleAlphaPixelsClipped: 0, alphaBounds: finalAlpha, body: finalBody, anchorDelta: { x: round((finalBody.left + finalBody.right - oldBody.left - oldBody.right) / 2), y: finalBody.bottom - oldBody.bottom }, boundaryTranslation: { x: left - wantedLeft, y: top - wantedTop }, rgbaSha256: hash(rgba), alphaSha256: alphaHash(rgba) });
  }
  return { keys, records, scale };
}

async function contactSheets(config, manifestPath, check) {
  const receiptPath = `${config.run}/패킹파생기록.json`, receipt = await readJson(receiptPath);
  if (receipt.manifest !== manifestPath || receipt.manifestSha256 !== hash(await read(manifestPath))) throw Error('Contact sheet must use the actual matching packing receipt');
  const packets = new Map();
  for (const packet of receipt.packets) {
    const bytes = await read(`public${packet.src}`);
    if (hash(bytes) !== packet.sha256) throw Error(`Contact packet changed: ${packet.src}`);
    packets.set(packet.index, await sharp(bytes).ensureAlpha().raw().toBuffer());
  }
  const audienceBytes = await read(receipt.audience.output);
  if (hash(audienceBytes) !== receipt.audience.sha256) throw Error('Contact audience packet changed');
  const audienceRaw = await sharp(audienceBytes).ensureAlpha().raw().toBuffer();
  const keys = [];
  for (const identity of receipt.coverage.liveKeys) {
    const slot = receipt.slots.find(item => item.activeLive && `${item.family}:${item.key}` === identity);
    if (!slot) throw Error(`No actually active contact representative: ${identity}`);
    const index = slot.index % 16, rgba = await sharp(packets.get(Math.floor(slot.index / 16)), { raw: { width: 1536, height: 384, channels: 4 } }).extract({ left: index % 8 * cell, top: Math.floor(index / 8) * cell, width: cell, height: cell }).resize(92, 92).png().toBuffer();
    keys.push({ label: `${identity} #${slot.index}`, rgba, slot: slot.index, packet: Math.floor(slot.index / 16), frame: slot.frame });
  }
  const audience = [];
  for (let index = 0; index < 16; index++) audience.push({ label: `audience:${index}`, rgba: await sharp(audienceRaw, { raw: { width: 1024, height: 1024, channels: 4 } }).extract({ left: index % 4 * 256, top: Math.floor(index / 4) * 256, width: 256, height: 256 }).resize(92, 92).png().toBuffer() });
  const outputs = [], records = [];
  for (const [name, items, columns] of [['등록71키', keys, 8], ['응원16키', audience, 4]]) for (const [tone, background] of [['투명', '#0000'], ['중성', '#ecebea']]) {
    const width = columns * 128, height = Math.ceil(items.length / columns) * 124, inputs = [];
    for (const [index, item] of items.entries()) {
      const left = index % columns * 128, top = Math.floor(index / columns) * 124;
      inputs.push({ input: item.rgba, left: left + 18, top: top + 3 });
      const label = `<svg width="128" height="22"><text x="64" y="15" fill="#35313b" font-size="10" font-family="monospace" text-anchor="middle">${item.label}</text></svg>`;
      inputs.push({ input: Buffer.from(label), left, top: top + 99 });
    }
    const bytes = await sharp({ create: { width, height, channels: 4, background } }).composite(inputs).png().toBuffer(), output = `${config.run}/정리본/검토/${name}_${tone}.png`;
    outputs.push([output, bytes]); records.push({ output, sha256: hash(bytes), width, height, keyCount: items.length, actualDisplayCell: 92 });
  }
  outputs.push([`${config.run}/정리본/검토/미리보기기록.json`, jsonBytes({ packingReceipt: receiptPath, packingReceiptSha256: hash(await read(receiptPath)), purpose: 'Technical whole-packet crop/downsample contact sheets only. No new artwork, eye editing, art approval or specialist review.', keys: keys.map(({ rgba, ...key }) => { void rgba; return key; }), audienceKeys: 16, outputs: records })]);
  for (const [name, bytes] of outputs) {
    if (check) { if (!(await read(name)).equals(bytes)) throw Error(`Contact reproducibility mismatch: ${name}`); }
    else { await fs.mkdir(path.dirname(resolveRepo(name)), { recursive: true }); await fs.writeFile(resolveRepo(name), bytes); }
  }
  console.log(JSON.stringify({ contactsOnly: true, check, outputs: records }));
}

async function run() {
  const args = process.argv.slice(2), check = args.includes('--check'), describe = args.includes('--describe'), validateInputs = args.includes('--validate-inputs'), contacts = args.includes('--contacts');
  const configIndex = args.indexOf('--manifest'), manifestPath = configIndex >= 0 ? args[configIndex + 1] : undefined;
  if (args.some((arg, index) => !['--check', '--describe', '--validate-inputs', '--contacts', '--manifest'].includes(arg) && !(configIndex >= 0 && index === configIndex + 1)) || !describe && !manifestPath || check && validateInputs) throw Error('Usage: node scripts/prepare-companion-eye-style.mjs --describe | --manifest <repo-relative.json> [--check | --validate-inputs | --contacts [--check]]');
  const receipts = {}, receiptHashes = {};
  for (const [id, name] of Object.entries(lineagePaths)) { const bytes = await read(name); receipts[id] = JSON.parse(bytes); receiptHashes[id] = { path: name, sha256: hash(bytes) }; }
  if (describe) {
    const map = createEyeStyleMap(await readJson('lib/ui/viewer-companion/hd-motion-sprite.json'), await readJson('lib/ui/viewer-companion/play-motion-sprite.json'), receipts);
    console.log(JSON.stringify({ slots: map.slots.length, rows: map.rows.length, rawLogicalReferencedSlots: map.liveSlots, actualActionReferencedSlots: map.activeLiveSlots, compatibilityOnlySlots: map.compatibilityOnlySlots, liveKeys: map.liveKeys.length, keys: map.liveKeys, sourceSchema: Object.fromEntries(Object.entries(families).map(([id, [grid, count]]) => [id, { path: '<art-src/...png>', sha256: '<64hex>', grid, count, provenance: '<registered generation receipt/reference>' }])) }, null, 2)); return;
  }
  const manifestBytes = await read(manifestPath), config = JSON.parse(manifestBytes), suffix = config.suffix ?? 'big-eyes-v1';
  if (config.version !== 1 || !config.run?.startsWith('art-src/') || !/^[a-z][a-z0-9-]*$/.test(suffix) || Object.keys(config.sources ?? {}).sort().join() !== Object.keys(families).sort().join()) throw Error('Explicit version/run/seven sources/safe new suffix required');
  requireArtPath(config.run);
  if (contacts) { await contactSheets(config, manifestPath, check); return; }
  const outputs = [], baselines = {};
  for (const id of ['hd', 'play']) {
    const definition = config.baseline?.[id], frozen = `${config.run}/고정입력/기존등록/${id}-motion-sprite.json`;
    if (!definition?.path || !/^[a-f0-9]{64}$/i.test(definition.sha256 ?? '')) throw Error(`Pinned baseline required: ${id}`);
    let bytes;
    try { bytes = await read(frozen); } catch (error) { if (error.code !== 'ENOENT' || check) throw error; bytes = await read(definition.path); outputs.push([frozen, bytes]); }
    if (hash(bytes) !== definition.sha256.toLowerCase()) throw Error(`Protected baseline SHA mismatch: ${id}`);
    baselines[id] = { bytes, metadata: JSON.parse(bytes), path: frozen, sha256: hash(bytes) };
  }
  const map = createEyeStyleMap(baselines.hd.metadata, baselines.play.metadata, receipts);
  const oldAudienceDefinition = config.baseline?.audience;
  if (!oldAudienceDefinition?.path?.startsWith('public/premiere/') || !/^[a-f0-9]{64}$/i.test(oldAudienceDefinition.sha256 ?? '')) throw Error('Pinned original audience packet required');
  const oldAudience = await read(oldAudienceDefinition.path);
  if (hash(oldAudience) !== oldAudienceDefinition.sha256.toLowerCase()) throw Error('Protected original audience packet changed');
  const oldAudienceRaw = await sharp(oldAudience).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (oldAudienceRaw.info.width !== 1024 || oldAudienceRaw.info.height !== 1024) throw Error('Expected established1024-square audience packet');
  const oldPackets = [...baselines.hd.metadata.atlases, ...baselines.play.metadata.atlases];
  const protectedPackets = await Promise.all(oldPackets.map(async atlas => { const name = `public${atlas.src}`, bytes = await read(name); if (hash(bytes) !== atlas.sha256) throw Error(`Protected old packet changed: ${name}`); return { path: name, sha256: hash(bytes) }; }));
  protectedPackets.push({ path: oldAudienceDefinition.path, sha256: hash(oldAudience) });
  const oldSourceHashes = new Set([...receipts.hd.sources.map(source => source.sha256), receipts.play.sourceSha256, receipts.ear.sourceSha256, receipts.recovery.sourceSha256, receipts.throw.sourceSha256, receipts.audience.sha256]);
  const oldSourceDefinitions = [...receipts.hd.sources.map(source => ({ path: source.path, sha256: source.sha256 })), ...['play', 'ear', 'recovery', 'throw'].map(id => ({ path: receipts[id].source, sha256: receipts[id].sourceSha256 })), { path: receipts.audience.native, sha256: receipts.audience.sha256 }];
  for (const source of oldSourceDefinitions) if (hash(await read(source.path)) !== source.sha256) throw Error(`Protected historical native changed: ${source.path}`);
  const sources = {};
  for (const id of Object.keys(families)) {
    if (oldSourceHashes.has(config.sources[id].sha256?.toLowerCase())) throw Error(`An old native cannot silently supply a new-style source: ${id}`);
    sources[id] = await extractSource(id, config.sources[id]);
  }
  if (validateInputs) {
    console.log(JSON.stringify({ validationOnly: true, filesWritten: 0, physicalSlots: map.slots.length, rawLogicalReferencedSlots: map.liveSlots, actualActionReferencedSlots: map.activeLiveSlots, compatibilityOnlySlots: map.compatibilityOnlySlots, liveKeys: map.liveKeys.length, sources: Object.fromEntries(Object.entries(sources).map(([id, source]) => [id, source.record])) }, null, 2)); return;
  }
  // Validate spectator boundary placements before the expensive32 encodes.
  const preparedAudience = await prepareAudience(sources.audience, oldAudienceRaw);
  const rawFrames = [], slotRecords = [], nextBase = structuredClone(baselines.hd.metadata), nextPlay = structuredClone(baselines.play.metadata), originalFrames = [...baselines.hd.metadata.frames, ...baselines.play.metadata.frames];
  const normalizedKeys = new Map();
  for (const slot of map.slots) {
    const key = sources[slot.family].keys[slot.key];
    let prepared;
    if (slot.rig) {
      const original = receipts.hd.cells[slot.index].texture;
      // Fit the complete authored pose/marks to the established whole-body
      // envelope before sampling, instead of clipping its newly retained marks.
      const textureScale = .54 * Math.min(original.genuineNativeBodyWidth / key.alpha.width, original.genuineNativeBodyHeight / key.alpha.height);
      prepared = { ...bakeEyeStyleKey(key, slot.rig, textureScale), textureScale };
    } else {
      const identity = `${slot.family}:${slot.key}`;
      if (!normalizedKeys.has(identity)) {
        const references = map.slots.filter(other => other.family === slot.family && other.key === slot.key).map(other => originalFrames[other.index]);
        const targetWidth = Math.round(Math.max(...references.map(frame => unit - frame.clip[1] - frame.clip[3] - 4)) * ratio), targetHeight = Math.round(Math.max(...references.map(frame => unit - frame.clip[0] - frame.clip[2] - 4)) * ratio);
        normalizedKeys.set(identity, await prepareKey(key, targetWidth, targetHeight));
      }
      prepared = normalizedKeys.get(identity);
    }
    const previous = originalFrames[slot.index], registration = register(prepared.data, previous.atlas, previous.index);
    if (registration.anchor.centerX !== 40 || registration.anchor.footY !== 80) throw Error(`Semantic registration anchor changed: ${slot.index}`);
    const selected = slot.index < 304 ? nextBase : nextPlay, index = slot.index < 304 ? slot.index : slot.index - 304;
    selected.frames[index] = registration.frame;
    rawFrames.push(prepared.data); slotRecords.push({ ...slot, source: sources[slot.family].record.path, sourceSha256: sources[slot.family].record.sha256, cropRgbaSha256: key.record.rgbaSha256, ...registration, alphaSha256: alphaHash(prepared.data), textureScale: prepared.textureScale, uniformScale: prepared.uniformScale, faceProtection: prepared.faceProtection });
  }
  const packetRecords = [];
  for (let packet = 0; packet < 32; packet++) {
    const previous = oldPackets[packet], name = `public${previous.src.replace(/\.webp$/, `-${suffix}.webp`)}`;
    if (protectedPackets.some(item => item.path === name)) throw Error('New packet path aliases a protected old packet');
    const raw = await sharp({ create: { width: cell * 8, height: cell * 2, channels: 4, background: '#0000' } }).composite(rawFrames.slice(packet * 16, packet * 16 + 16).map((input, index) => ({ input, raw: { width: cell, height: cell, channels: 4 }, left: index % 8 * cell, top: Math.floor(index / 8) * cell }))).raw().toBuffer();
    const bytes = await encodePacket(raw, cell * 8, cell * 2), atlas = { src: name.slice('public'.length), sha256: hash(bytes), bytes: bytes.length, width: cell * 8, height: cell * 2 };
    (packet < 19 ? nextBase : nextPlay).atlases[packet < 19 ? packet : packet - 19] = atlas;
    outputs.push([name, bytes]); packetRecords.push({ index: packet, previous, ...atlas, rgbaSha256: hash(raw), alphaSha256: alphaHash(raw), alphaChangedPixels: 0, slots: Array.from({ length: 16 }, (_, i) => packet * 16 + i) });
  }
  const audienceName = `public/premiere/victamin-audience-${suffix}.webp`, audienceKeys = preparedAudience.keys, audienceRecords = preparedAudience.records;
  const audienceRaw = await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#0000' } }).composite(audienceKeys.map((input, index) => ({ input, raw: { width: 256, height: 256, channels: 4 }, left: index % 4 * 256, top: Math.floor(index / 4) * 256 }))).raw().toBuffer(), audience = await encodePacket(audienceRaw, 1024, 1024);
  outputs.push([audienceName, audience]);
  const metadataPaths = { hd: `${config.run}/정리본/hd-motion-sprite.json`, play: `${config.run}/정리본/play-motion-sprite.json` };
  outputs.push([metadataPaths.hd, jsonBytes(nextBase)], [metadataPaths.play, jsonBytes(nextPlay)]);
  if (JSON.stringify(nextBase.rows) !== JSON.stringify(baselines.hd.metadata.rows) || JSON.stringify(nextPlay.rows) !== JSON.stringify(baselines.play.metadata.rows)) throw Error('Existing logical row map changed');
  const record = { version: 1, manifest: manifestPath, manifestSha256: hash(manifestBytes), generationCallsByThisScript: 0, automaticArtReviews: 0, ownerVisualApproval: 'NOT_ESTABLISHED_BY_PACKING', method: 'Whole newly generated RGBA key crops; aspect-preserving registration; existing bounded inverse ear/paper rigs with one rigid authored face group; no repaint/transplant/old-packet RGB sampling', cell, logicalCell: unit, physicalFoot: foot, lineage: receiptHashes, baseline: { ...Object.fromEntries(Object.entries(baselines).map(([id, item]) => [id, { path: item.path, sha256: item.sha256 }])), audience: oldAudienceDefinition }, protectedSources: oldSourceDefinitions, protectedPackets, sources: Object.fromEntries(Object.entries(sources).map(([id, item]) => [id, item.record])), coverage: { physicalSlots: map.slots.length, logicalRows: map.rows.length, packetCount: packetRecords.length, rawLogicalReferencedSlots: map.liveSlots, actualActionReferencedSlots: map.activeLiveSlots, compatibilityOnlySlots: map.compatibilityOnlySlots, liveKeyCount: map.liveKeys.length, liveKeys: map.liveKeys, deadSlots: map.deadSlots, allSlotsHaveNewSource: slotRecords.length === 512, fallbackOldRgbSlots: 0 }, slots: slotRecords, packets: packetRecords, audience: { source: sources.audience.record.path, sourceSha256: sources.audience.record.sha256, output: audienceName, sha256: hash(audience), bytes: audience.length, width: 1024, height: 1024, grid: 4, keys: 16, frames: audienceRecords, runtimeExclusionsPreserved: [9, 10] }, stagedMetadata: metadataPaths, metadataApplication: 'Staged only. Copy to runtime metadata and change the audience consumer only after explicit integration; historical output files are never overwritten.' };
  outputs.push([`${config.run}/패킹파생기록.json`, jsonBytes(record)]);
  for (const [name, bytes] of outputs) {
    if (check) { if (!(await read(name)).equals(bytes)) throw Error(`Reproducibility mismatch: ${name}`); }
    else { await fs.mkdir(path.dirname(resolveRepo(name)), { recursive: true }); await fs.writeFile(resolveRepo(name), bytes); }
  }
  for (const [id, source] of Object.entries(sources)) if (hash(await read(source.record.path)) !== source.record.sha256) throw Error(`New source changed during packing: ${id}`);
  for (const protectedPacket of protectedPackets) if (hash(await read(protectedPacket.path)) !== protectedPacket.sha256) throw Error('Protected old packet changed during packing');
  for (const source of oldSourceDefinitions) if (hash(await read(source.path)) !== source.sha256) throw Error('Protected historical native changed during packing');
  console.log(JSON.stringify({ check, ...record.coverage, stagedMetadata: metadataPaths, audience: record.audience, networkBytes: packetRecords.reduce((sum, item) => sum + item.bytes, 0) + audience.length }));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await run();
