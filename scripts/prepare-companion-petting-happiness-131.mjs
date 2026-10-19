// One131 native -> mechanical uniform normalization and row9 registration.
// Never draws, composites faces, removes alpha noise, or replaces old packets.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import sharp from 'sharp';

const run = 'art-src/빅타민/동행/작업회차/20261019-쓰다듬기행복131';
const names = ['hd-motion-sprite', 'play-motion-sprite', 'living-motion-sprite'];
const sourcePath = `${run}/원본/쓰다듬기행복_단일생성.png`;
const sourceSha = '41ea00d7053dbbc9532c728d9710ada2f51e37b7be698b3efd304bebeace29f9';
const src = '/companion/hd/vitamin-action-09-happiness-131-v1.webp';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const read = async name => JSON.parse(await fs.readFile(name, 'utf8'));
const assert = (condition, message) => { if (!condition) throw Error(message); };
const round = n => Math.round(n * 1e6) / 1e6;
const bounds = (rgba, threshold) => {
  let left = 192, top = 192, right = 0, bottom = 0, pixels = 0;
  for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) if (rgba[(y * 192 + x) * 4 + 3] >= threshold) {
    left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1); pixels++;
  }
  assert(pixels > 0, 'Empty source cell');
  return { left, top, right, bottom, pixels };
};
function largestBody(rgba) {
  const seen = new Uint8Array(192 * 192), queue = new Int32Array(seen.length); let best;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || rgba[start * 4 + 3] < 200) continue;
    let head = 0, count = 1, left = 192, top = 192, right = 0, bottom = 0; queue[0] = start; seen[start] = 1;
    while (head < count) {
      const p = queue[head++], x = p % 192, y = Math.floor(p / 192);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(191, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(191, x + 1); xx++) {
        const next = yy * 192 + xx;
        if (!seen[next] && rgba[next * 4 + 3] >= 200) { seen[next] = 1; queue[count++] = next; }
      }
    }
    if (!best || count > best.pixels) best = { left, top, right, bottom, pixels: count };
  }
  assert(best, 'No opaque body'); return best;
}
function cell(rgba, index) {
  const result = Buffer.alloc(192 * 192 * 4);
  for (let y = 0; y < 192; y++) {
    const from = ((Math.floor(index / 8) * 192 + y) * 1536 + index % 8 * 192) * 4;
    rgba.copy(result, y * 192 * 4, from, from + 192 * 4);
  }
  return result;
}
function mouth(rgba, index) {
  const points = [];
  // New source-bound U mouth ROI, excluding both smiling eye arches/cheeks.
  for (let y = 128; y < 146; y++) for (let x = 97; x < 117; x++) {
    const at = (y * 192 + x) * 4;
    if (rgba[at + 3] > 200 && rgba[at] < 240 && rgba[at + 1] < 170 && rgba[at + 2] < 150) points.push([x, y]);
  }
  assert(points.length >= 10, `Unmeasured mouth ${index}`);
  const box = [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])) + 1, Math.max(...points.map(p => p[1])) + 1];
  return { index: 144 + index, atlas: 1, cell: index, x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, bounds: box };
}

const check = process.argv.includes('--check');
assert(process.argv.slice(2).every(arg => arg === '--check'), 'Only --check is supported');
const native = await fs.readFile(sourcePath); assert(hash(native) === sourceSha, '131 native changed');
const nativeInfo = await sharp(native).metadata(); assert(nativeInfo.width === 2172 && nativeInfo.height === 724, 'Unexpected131 native canvas');
const frozen = await Promise.all(names.map(name => read(`${run}/고정입력/${name}.json`)));
const frozenMouth = await read(`${run}/고정입력/mouth-anchors.json`);
assert(isDeepStrictEqual(frozen[0].rows[9], Array.from({ length: 16 }, (_, i) => 144 + i)), 'Row9 identity changed');
const immutablePackets = frozen.flatMap(pack => pack.atlases);
for (const packet of immutablePackets) assert(hash(await fs.readFile(`public${packet.src}`)) === packet.sha256, `Old packet changed: ${packet.src}`);
// Actual square8x2 art lies in this integer rectangle. Uniform resize only.
const normalized = await sharp(native).extract({ left: 0, top: 91, width: 2172, height: 543 }).resize(1536, 384, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
const png = await sharp(normalized, { raw: { width: 1536, height: 384, channels: 4 } }).png().toBuffer();
const webp = await sharp(normalized, { raw: { width: 1536, height: 384, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer();
const decoded = await sharp(webp).ensureAlpha().raw().toBuffer(); let invisibleRgbNormalized = 0;
for (let at = 0; at < normalized.length; at += 4) {
  assert(normalized[at + 3] === decoded[at + 3], 'WebP alpha changed');
  for (let c = 0; c < 3; c++) if (normalized[at + c] !== decoded[at + c]) {
    assert(normalized[at + 3] === 0, 'WebP visible RGB changed'); invisibleRgbNormalized++;
  }
}
const intended = structuredClone(frozen), packet = { src, sha256: hash(webp), bytes: webp.length, width: 1536, height: 384 };
intended[0].atlases[9] = packet;
const frames = [], mouths = [];
for (let index = 0; index < 16; index++) {
  const rgba = cell(decoded, index), body = largestBody(rgba), visible = bounds(rgba, 8);
  assert(visible.left >= 4 && visible.top >= 4 && visible.right <= 188 && visible.bottom <= 188 && visible.right - visible.left <= 146 && visible.bottom - visible.top <= 158, `131 visible frame overflow ${index}`);
  const frame = { atlas: 9, index, x: round((96 - (body.left + body.right) / 2) / 2.4), y: round((192 - body.bottom) / 2.4), clip: [visible.top / 2.4 - 2, (192 - visible.right) / 2.4 - 2, (192 - visible.bottom) / 2.4 - 2, visible.left / 2.4 - 2].map(round) };
  intended[0].frames[144 + index] = frame; mouths.push(mouth(rgba, index));
  frames.push({ physicalIndex: 144 + index, previousFrame: frozen[0].frames[144 + index], frame, body, clipAlphaThreshold: 8, visibleBounds: visible, alphaBounds: bounds(rgba, 1), rgbaSha256: hash(rgba) });
}
const intendedMouth = structuredClone(frozenMouth);
intendedMouth.evidence = `${run}/식사입계측.json`;
intendedMouth.atlases[1] = { src, sha256: packet.sha256 };
intendedMouth.frames = intendedMouth.frames.map(frame => frame.index >= 144 && frame.index <= 159 ? mouths[frame.index - 144] : frame);
// Historical131 remains reproducible after the exact eye-weight-only133
// successor. WRITE still cannot roll a later active source back to131.
let successorHd, successorMouth;
const currentHd = await read('lib/ui/viewer-companion/hd-motion-sprite.json');
if (check && currentHd.atlases[9].src === '/companion/hd/vitamin-action-09-eye-weight-133-v3.webp') {
  const nextRun = 'art-src/빅타민/동행/작업회차/20261019-쓰다듬기눈선133';
  const next = await read(`${nextRun}/패킹파생기록.json`);
  assert(next.parent.sha256 === packet.sha256 && next.packet.sha256 === 'ff8ecc78933a0bd414e7fefa2e682fa1a04da5760e3985e286731d02bd6b1673', 'Unbound133 successor');
  assert(isDeepStrictEqual(await read(`${nextRun}/고정입력/hd-motion-sprite.json`), intended[0]), '133 did not derive from exact131 registration');
  const bytes = await fs.readFile(`public${next.packet.src}`); assert(hash(bytes) === next.packet.sha256, '133 packet changed');
  const after = await sharp(bytes).ensureAlpha().raw().toBuffer();
  for (let at = 0; at < decoded.length; at += 4) {
    const p = at / 4, x = p % 1536 % 192, y = Math.floor(p / 1536) % 192;
    const eye = x >= 81 && x < 99 && y >= 117 && y < 134 || x >= 113 && x < 132 && y >= 115 && y < 132;
    assert(decoded[at + 3] === after[at + 3], '133 changed protected131 alpha');
    if (!eye) for (let c = 0; c < 3; c++) assert(decoded[at + c] === after[at + c], '133 changed protected131 outside-eye pixels');
  }
  successorHd = structuredClone(intended[0]); successorHd.atlases[9] = next.packet;
  successorMouth = structuredClone(intendedMouth); successorMouth.atlases[1] = { src: next.packet.src, sha256: next.packet.sha256 };
}
// Fail closed BEFORE ANY derivative/public/metadata write if another owner changed.
for (let i = 0; i < names.length; i++) {
  const active = await read(`lib/ui/viewer-companion/${names[i]}.json`);
  assert(isDeepStrictEqual(active, frozen[i]) || isDeepStrictEqual(active, intended[i]) || i === 0 && successorHd && isDeepStrictEqual(active, successorHd), `Unowned metadata: ${names[i]}`);
}
const activeMouth = await read('lib/ui/viewer-companion/mouth-anchors.json');
assert(isDeepStrictEqual(activeMouth, frozenMouth) || isDeepStrictEqual(activeMouth, intendedMouth) || successorMouth && isDeepStrictEqual(activeMouth, successorMouth), 'Unowned mouth registration');
const receipt = { version: 1, generationCalls: 1, generationCallsByThisScript: 0, faceCompositing: false, alphaCleanup: false, professionalArtReview: 'NOT_REQUESTED', ownerVisualApproval: false, creatorFindingsPath: `${run}/제작기록/생성자관찰.json`, native: { path: sourcePath, sha256: sourceSha, width: 2172, height: 724 }, normalization: { crop: [0, 91, 2172, 634], output: [1536, 384], uniformScale: 1536 / 2172, kernel: 'lanczos3', alphaNoiseNotErased: true, metadataClipAlphaThreshold: 8, clipReason: 'Keep low-alpha export color residue in asset while registering visible silhouette with2logical-pixel margin; opaque200 body owns centre/foot.' }, packet, normalizedRgbaSha256: hash(normalized), invisibleRgbChannelsNormalized: invisibleRgbNormalized, physicalIndices: frames.map(f => f.physicalIndex), frames, oldPacket: frozen[0].atlases[9], immutableParentPackets: immutablePackets, unchangedOther504Frames: true, unchangedOther32Packets: true, stagedMetadata: Object.fromEntries(names.map(name => [name, `${run}/정리본/${name}.json`])) };
const outputs = new Map([[`public${src}`, webp], [`${run}/정리본/쓰다듬기행복_192셀.png`, png], [`${run}/패킹파생기록.json`, json(receipt)], [`${run}/식사입계측.json`, json({ version: 1, source: packet, method: 'Actual decoded source-bound U mouth ink bounds; no runtime analysis or face editing.', frames: mouths })], ['lib/ui/viewer-companion/hd-motion-sprite.json', json(intended[0])], ['lib/ui/viewer-companion/mouth-anchors.json', json(intendedMouth)]]);
for (let i = 0; i < names.length; i++) outputs.set(`${run}/정리본/${names[i]}.json`, json(intended[i]));
for (const [name, bytes] of outputs) {
  if (check) {
    const expected = successorHd && name === 'lib/ui/viewer-companion/hd-motion-sprite.json' ? json(successorHd)
      : successorMouth && name === 'lib/ui/viewer-companion/mouth-anchors.json' ? json(successorMouth) : bytes;
    assert((await fs.readFile(name)).equals(expected), `131 deterministic output changed: ${name}`);
  }
  else await fs.writeFile(name, bytes);
}
console.log(JSON.stringify({ status: check ? 'CHECK_PASS' : 'WRITTEN', packet, frames: frames.length, firstMouth: mouths[0], immutablePackets: immutablePackets.length, invisibleRgbNormalized }));
