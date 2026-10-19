// One133 imagegen native, whole-cell registration, source-bound eye selection.
// No eye drawing, stroke dilation, alpha cleanup, old-packet overwrite or runtime inference.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import sharp from 'sharp';

const run = 'art-src/빅타민/동행/작업회차/20261019-쓰다듬기눈선133';
const src = '/companion/hd/vitamin-action-09-eye-weight-133-v3.webp';
const names = ['hd-motion-sprite', 'play-motion-sprite', 'living-motion-sprite'];
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const read = async name => JSON.parse(await fs.readFile(name, 'utf8'));
const assert = (value, message) => { if (!value) throw Error(message); };
const rawSha = '2e58c84c2530bbb41e640a8f8db0148b5269dc3ac3d5d34c4fb5c808db424a2d';
const parentSha = 'eaa134b4001477439dae456989d255e4cf723da31fbc5c3809f6b6d85285fcdb';
const check = process.argv.includes('--check');
assert(process.argv.slice(2).every(v => v === '--check'), 'Only --check is supported');
const size = 192, width = 1536, height = 384;
const offset = (cell, x, y) => ((Math.floor(cell / 8) * size + y) * width + cell % 8 * size + x) * 4;
function cellPixels(packet, index) {
  const bytes = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) packet.copy(bytes, y * size * 4, offset(index, 0, y), offset(index, 0, y) + size * 4);
  return bytes;
}
function components(bytes, predicate, box = [0, 0, size, size]) {
  const seen = new Uint8Array(size * size), queue = new Int32Array(size * size), result = [];
  for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
    const start = y * size + x;
    if (seen[start] || !predicate(bytes, start * 4)) continue;
    let head = 0, count = 1; queue[0] = start; seen[start] = 1;
    const pixels = [], bounds = [size, size, 0, 0];
    while (head < count) {
      const p = queue[head++], xx = p % size, yy = Math.floor(p / size); pixels.push(p);
      bounds[0] = Math.min(bounds[0], xx); bounds[1] = Math.min(bounds[1], yy);
      bounds[2] = Math.max(bounds[2], xx + 1); bounds[3] = Math.max(bounds[3], yy + 1);
      for (let ny = Math.max(box[1], yy - 1); ny < Math.min(box[3], yy + 2); ny++) for (let nx = Math.max(box[0], xx - 1); nx < Math.min(box[2], xx + 2); nx++) {
        const next = ny * size + nx;
        if (!seen[next] && predicate(bytes, next * 4)) { seen[next] = 1; queue[count++] = next; }
      }
    }
    result.push({ pixels, bounds, center: [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2] });
  }
  return result.sort((a, b) => b.pixels.length - a.pixels.length);
}
const opaque = (b, at) => b[at + 3] >= 200;
const ink = (b, at) => b[at + 3] > 200 && b[at] < 180 && b[at + 1] < 140 && b[at + 2] < 120;
function eyes(bytes) {
  const parts = components(bytes, ink, [73, 110, 141, 145]).filter(p => p.pixels.length >= 8);
  const eye = x => parts.filter(p => p.center[1] < 129).sort((a, b) => Math.hypot(a.center[0] - x, a.center[1] - 125) - Math.hypot(b.center[0] - x, b.center[1] - 125))[0];
  const pair = [eye(90), eye(122)];
  assert(pair.every(Boolean) && pair[0] !== pair[1], 'Two separate complete eye arches required');
  assert(pair[0].center[0] < 101 && pair[1].center[0] > 110, 'Eye component confused with mouth');
  return pair;
}
function measure(pair) {
  const axis = Math.atan2(pair[1].center[1] - pair[0].center[1], pair[1].center[0] - pair[0].center[0]) * 180 / Math.PI;
  return { eyePairAngleDegrees: axis, eyes: pair.map(p => ({ bounds: p.bounds, center: p.center, darkPixels: p.pixels.length, meanVerticalInkRun: p.pixels.length / new Set(p.pixels.map(pixel => pixel % size)).size })) };
}
const frozen = await Promise.all(names.map(n => read(`${run}/고정입력/${n}.json`)));
const frozenMouth = await read(`${run}/고정입력/mouth-anchors.json`), frozenRig = await read(`${run}/고정입력/accessory-anchors.json`);
const parentPacket = frozen[0].atlases[9]; assert(parentPacket.sha256 === parentSha, '133 must bind the actual131 parent');
const immutable = frozen.flatMap(p => p.atlases);
for (const source of immutable) assert(hash(await fs.readFile(`public${source.src}`)) === source.sha256, `Historical packet changed: ${source.src}`);
const nativePath = `${run}/원본/쓰다듬기눈선_단일생성.png`, native = await fs.readFile(nativePath);
assert(hash(native) === rawSha, '133 actual native changed');
const info = await sharp(native).metadata(); assert(info.width === 2172 && info.height === 724, 'Unexpected actual native dimensions');
const parent = await sharp(`public${parentPacket.src}`).ensureAlpha().raw().toBuffer();
const generated = await sharp(native).extract({ left: 0, top: 91, width: 2172, height: 543 }).resize(width, height, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
const declaredMaskPath = `${run}/고정입력/눈선_명시편집영역.png`;
const declared = await sharp(declaredMaskPath).greyscale().raw().toBuffer(); assert(declared.length === width * height, 'Binary mask dimensions');
const allowed = Buffer.from(declared);
const final = Buffer.from(parent), effective = Buffer.alloc(width * height), frames = [];
for (let i = 0; i < 16; i++) {
  const before = cellPixels(parent, i), input = cellPixels(generated, i), body = components(before, opaque)[0], newBody = components(input, opaque)[0];
  const dx = Math.round(body.center[0] - newBody.center[0]), dy = body.bounds[3] - newBody.bounds[3];
  assert(Math.abs(dx) <= 5 && Math.abs(dy) <= 3, `Unexpected whole-cell registration drift${i}`);
  const aligned = Buffer.alloc(input.length);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (x - dx >= 0 && x - dx < size && y - dy >= 0 && y - dy < size) input.copy(aligned, (y * size + x) * 4, ((y - dy) * size + x - dx) * 4, ((y - dy) * size + x - dx) * 4 + 4);
  const oldEyes = eyes(before), newEyes = eyes(aligned), selected = new Set(), eyeInk = new Set(newEyes.flatMap(p => p.pixels));
  const mouthBounds = frozenMouth.frames.find(frame => frame.index === 144 + i)?.bounds;
  assert(mouthBounds?.length === 4, 'Actual131 mouth calibration required');
  const mouthGuard = [mouthBounds[0] - 1, mouthBounds[1] - 1, mouthBounds[2] + 1, mouthBounds[3] + 1];
  for (let y = mouthGuard[1]; y < mouthGuard[3]; y++) for (let x = mouthGuard[0]; x < mouthGuard[2]; x++) allowed[offset(i, x, y) / 4] = 0;
  const foreignInk = new Set(components(aligned, ink, [73, 110, 141, 145]).filter(p => p.pixels.length >= 8 && !p.pixels.some(pixel => eyeInk.has(pixel))).flatMap(p => p.pixels));
  // Select existing generated samples plus their one-pixel AA neighborhood.
  // This expands the selection, never draws/dilates the artwork's strokes.
  for (const p of [...oldEyes.flatMap(e => e.pixels), ...eyeInk]) {
    const x = p % size, y = Math.floor(p / size);
    for (let yy = y - 1; yy <= y + 1; yy++) for (let xx = x - 1; xx <= x + 1; xx++) {
      if (xx < 0 || xx >= size || yy < 0 || yy >= size) continue;
      const pos = yy * size + xx, packetPixel = offset(i, xx, yy) / 4;
      if (allowed[packetPixel] && !foreignInk.has(pos)) selected.add(pos);
    }
  }
  let changedPixels = 0;
  for (const p of selected) {
    const x = p % size, y = Math.floor(p / size), at = offset(i, x, y);
    // Three131 cells have a genuine mouth edge at x98. Their per-cell
    // measured bounds, rather than a shared x99 approximation, stay exact.
    assert(!(x >= mouthGuard[0] && x < mouthGuard[2] && y >= mouthGuard[1] && y < mouthGuard[3]), 'Mouth or adjacent guard entered eye selection');
    let changed = false;
    for (let c = 0; c < 3; c++) { if (final[at + c] !== aligned[p * 4 + c]) changed = true; final[at + c] = aligned[p * 4 + c]; }
    if (changed) { effective[at / 4] = 255; changedPixels++; }
  }
  const after = cellPixels(final, i), post = measure(eyes(after)), pre = measure(oldEyes);
  assert(post.eyes.every((e, n) => e.meanVerticalInkRun > pre.eyes[n].meanVerticalInkRun), `Eye not thicker${i}`);
  assert(post.eyes.every(e => e.darkPixels < 110), `Unexpected eye component growth${i}`);
  for (let y = mouthGuard[1]; y < mouthGuard[3]; y++) for (let x = mouthGuard[0]; x < mouthGuard[2]; x++) assert(before.subarray((y * size + x) * 4, (y * size + x) * 4 + 4).equals(after.subarray((y * size + x) * 4, (y * size + x) * 4 + 4)), 'Actual mouth/adjacent RGBA changed');
  frames.push({ physicalIndex: 144 + i, wholeCellTranslation: [dx, dy], protectedMouthBounds: mouthBounds, protectedMouthGuard: mouthGuard, changedPixels, before: pre, after: post });
}
let changedPixels = 0, changedChannels = 0;
for (let at = 0; at < parent.length; at += 4) {
  assert(final[at + 3] === parent[at + 3], 'Parent alpha changed');
  let changed = false;
  for (let c = 0; c < 4; c++) if (final[at + c] !== parent[at + c]) { assert(allowed[at / 4] === 255 && effective[at / 4] === 255, 'Pixel changed outside explicit eye scope'); changedChannels++; changed = true; }
  if (changed) changedPixels++;
}
const png = await sharp(final, { raw: { width, height, channels: 4 } }).png().toBuffer();
const webp = await sharp(final, { raw: { width, height, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer();
const decoded = await sharp(webp).ensureAlpha().raw().toBuffer(); let invisibleRgbNormalized = 0;
for (let at = 0; at < final.length; at += 4) {
  assert(final[at + 3] === decoded[at + 3], 'Encoded alpha changed');
  for (let c = 0; c < 3; c++) if (final[at + c] !== decoded[at + c]) { assert(final[at + 3] === 0, 'Lossless visible RGB changed'); invisibleRgbNormalized++; }
}
const packet = { src, sha256: hash(webp), bytes: webp.length, width, height }, intended = structuredClone(frozen);
intended[0].atlases[9] = packet;
const intendedMouth = structuredClone(frozenMouth); intendedMouth.atlases[1] = { src, sha256: packet.sha256 };
const intendedRig = structuredClone(frozenRig); intendedRig.sources[9] = { src, sha256: packet.sha256, bytes: packet.bytes };
intendedRig.metadata[0].sha256 = hash(json(intended[0]));
// Fail closed for all three datasets and both rigs BEFORE any output write.
for (let i = 0; i < names.length; i++) { const active = await read(`lib/ui/viewer-companion/${names[i]}.json`); assert(isDeepStrictEqual(active, frozen[i]) || isDeepStrictEqual(active, intended[i]), `Unowned metadata: ${names[i]}`); }
for (const [name, before, after] of [['mouth-anchors', frozenMouth, intendedMouth], ['accessory-anchors', frozenRig, intendedRig]]) { const active = await read(`lib/ui/viewer-companion/${name}.json`); assert(isDeepStrictEqual(active, before) || isDeepStrictEqual(active, after), `Unowned rig: ${name}`); }
const allowedPng = await sharp(allowed, { raw: { width, height, channels: 1 } }).png().toBuffer();
const receipt = { version: 3, previousIntermediateArtifacts: { policy: 'Local-only rejected derivations; not reproduction inputs or public assets.', v1PacketSha256: '2e68316af3cd87f7a2c88963a92e49234cedfa9f08e0b58edbbce4cd24f093f8', v2PacketSha256: '72d1f0494882a9d51c21aa7d8fcc5940ce2532b69b30bb19fb50b66b58c5bdd9', failure: 'The shared x99 mouth approximation missed actual x98 edges; v3 protects every recorded mouth and1px guard.' }, generationCalls: 1, callsByThisScript: 0, independentArtReviews: 0, ownerApproval: false, native: { path: nativePath, sha256: rawSha, width: 2172, height: 724 }, parent: parentPacket, normalization: { crop: [0, 91, 2172, 634], output: [width, height], kernel: 'lanczos3', wholeCellIntegerTranslations: true, localEyeWarpOrDrawing: false, originalAlphaRetained: true }, declaredMask: { path: declaredMaskPath, sha256: hash(await fs.readFile(declaredMaskPath)) }, effectiveAllowedMask: { path: `${run}/정리본/눈선133_최종허용영역.png`, sha256: hash(allowedPng), mouthExclusion: 'All16 actual131 mouth bounds plus1px neighboring guard.' }, packet, changedPixels, changedChannels, unchangedOutsideEyeRgba: true, unchangedAllAlpha: true, unchangedAll16MouthGuardsRgba: true, invisibleRgbChannelsNormalized: invisibleRgbNormalized, unchanged520FrameRegistrations: true, unchanged520AccessoryAnchors: true, unchangedMouthAnchorFrames: true, immutableParentPackets: immutable, frames };
const maskPng = await sharp(effective, { raw: { width, height, channels: 1 } }).png().toBuffer();
const outputs = new Map([[`public${src}`, webp], [`${run}/정리본/눈선133_눈영역보존합성.png`, png], [`${run}/정리본/눈선133_실효변경영역.png`, maskPng], [`${run}/패킹파생기록.json`, json(receipt)], ['lib/ui/viewer-companion/hd-motion-sprite.json', json(intended[0])], ['lib/ui/viewer-companion/mouth-anchors.json', json(intendedMouth)], ['lib/ui/viewer-companion/accessory-anchors.json', json(intendedRig)]]);
outputs.set(`${run}/정리본/눈선133_최종허용영역.png`, allowedPng);
for (let i = 0; i < names.length; i++) outputs.set(`${run}/정리본/${names[i]}.json`, json(intended[i]));
for (const [name, bytes] of outputs) { if (check) assert((await fs.readFile(name)).equals(bytes), `133 deterministic output changed: ${name}`); else await fs.writeFile(name, bytes); }
console.log(JSON.stringify({ status: check ? 'CHECK_PASS' : 'WRITTEN', packet, changedPixels, changedChannels, invisibleRgbNormalized, frames: frames.length }));
