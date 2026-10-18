//119: source-masked expression/body repair over the frozen118 packets.
// No generation, facial transplant, full115 repack or anchor regeneration.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import sharp from 'sharp';
import { bakeEyeStyleKey, prepareFamilyKey } from './prepare-companion-eye-style.mjs';
import { clearCompanionExportResidue115 } from './prepare-companion-motion-115.mjs';
import { assertCompanionMetadataOwnership } from './prepare-companion-jump-tuft-117.mjs';

const run = 'art-src/빅타민/동행/작업회차/20261019-표정체적교정119';
const prior = 'art-src/빅타민/동행/작업회차/20261018-동작연결정리115';
const prior118 = 'art-src/빅타민/동행/작업회차/20261019-얼굴정렬교정118';
const names = ['hd-motion-sprite', 'play-motion-sprite', 'living-motion-sprite'];
const targets = new Map([[1, [9, 10]], [64, [356, 357, 358, 359]], [65, [360, 361, 362, 363]], [73, [514]], [67, [496, 497, 498, 499]], [10, [266]]]);
const packetNames = new Map([[0, 'vitamin-action-00'], [16, 'vitamin-action-16'], [22, 'vitamin-play-03'], [31, 'vitamin-play-12'], [32, 'vitamin-episodes-00']]);
const cell = 192, ratio = 192 / 80;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const read = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));
const assert = (condition, message) => { if (!condition) throw Error(message); };
const round = value => Math.round(value * 1e6) / 1e6;

/** Validate all three owners before even one packet/receipt may be written. */
export function assertCompanionMetadataSetOwnership(active, frozen, intended) {
  assert(active.length === 3 && frozen.length === 3 && intended.length === 3, 'Expected three metadata owners');
  for (let index = 0; index < 3; index++) assertCompanionMetadataOwnership(active[index], frozen[index], intended[index]);
}

function components(bytes, width, height, threshold = 200, strict = false) {
  const seen = new Uint8Array(width * height), queue = new Int32Array(seen.length), result = [];
  const opaque = index => strict ? bytes[index * 4 + 3] > threshold : bytes[index * 4 + 3] >= threshold;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || !opaque(start)) continue;
    let head = 0, count = 1, left = width, top = height, right = 0, bottom = 0;
    queue[0] = start; seen[start] = 1;
    while (head < count) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!seen[next] && opaque(next)) { seen[next] = 1; queue[count++] = next; }
      }
    }
    result.push({ left, top, right, bottom, width: right - left, height: bottom - top, pixels: count });
  }
  return result.sort((a, b) => b.pixels - a.pixels);
}

function alphaBounds(bytes, width, height) {
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (bytes[(y * width + x) * 4 + 3]) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  assert(left < right && top < bottom, 'Empty authored alpha');
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

export function shapeFor(proof, rgba) {
  const { box, body: absolute } = proof;
  const body = { ...absolute, left: absolute.left - box.left, right: absolute.right - box.left, top: absolute.top - box.top, bottom: absolute.bottom - box.top };
  const featureBounds = { left: body.left + body.width * .2, right: body.right - body.width * .15, top: body.top + body.height * .35, bottom: body.bottom - body.height * .1 };
  return { rgba, width: box.width, height: box.height, body, alpha: alphaBounds(rgba, box.width, box.height), face: { featureBounds, protected: { left: featureBounds.left - 5, right: featureBounds.right + 5, top: featureBounds.top - 5, bottom: featureBounds.bottom + 5 }, fade: 2 } };
}

async function resizedFamilyBody(shape, fit) {
  const resized = await sharp(shape.rgba, { raw: { width: shape.width, height: shape.height, channels: 4 } }).resize({ width: Math.max(1, Math.floor(shape.width * fit.scale)), kernel: 'lanczos3' }).raw().toBuffer({ resolveWithObject: true });
  const body = components(resized.data, resized.info.width, resized.info.height, 160, true)[0];
  assert(body?.pixels >= 100, 'Missing complete family silhouette');
  return body;
}

export async function bakePair(shape, beforeRaw, afterRaw, slot) {
  if (slot.rig) return {
    before: bakeEyeStyleKey({ ...shape, rgba: beforeRaw }, slot.rig, slot.fit.scale, slot.fit.offset).data,
    after: bakeEyeStyleKey({ ...shape, rgba: afterRaw }, slot.rig, slot.fit.scale, slot.fit.offset).data,
    frozenFit: slot.fit,
  };
  const beforeKey = { ...shape, rgba: beforeRaw }, afterKey = { ...shape, rgba: afterRaw };
  const beforeBody = await resizedFamilyBody(beforeKey, slot.fit), afterBody = await resizedFamilyBody(afterKey, slot.fit);
  const left = Math.round(96 - (beforeBody.left + beforeBody.right) / 2 + slot.fit.offset.x), top = Math.round(180 - beforeBody.bottom + slot.fit.offset.y);
  // prepareFamilyKey normally registers each candidate's new body. Compensate
  // that calculation so the SAME parent resize canvas/placement stays fixed.
  const fixed = { ...slot.fit, offset: { x: left - 96 + (afterBody.left + afterBody.right) / 2, y: top - 180 + afterBody.bottom } };
  return {
    before: (await prepareFamilyKey(beforeKey, slot.fit)).data,
    after: (await prepareFamilyKey(afterKey, fixed)).data,
    frozenFit: slot.fit,
    fixedTemplatePlacement: { left, top, afterOffsetCompensation: { x: fixed.offset.x - slot.fit.offset.x, y: fixed.offset.y - slot.fit.offset.y } },
  };
}

/** Exact115 registration algorithm; call only for the four body67 cells. */
export function registerCompanionBody119(data, atlas, index) {
  const visible = alphaBounds(data, cell, cell), body = components(data, cell, cell)[0];
  assert(body, 'Missing opaque body for registration');
  assert(visible.left >= 4 && visible.top >= 4 && visible.right <= 188 && visible.bottom <= 188 && visible.width <= 146 && visible.height <= 158, 'Body119 escaped protected runtime footprint');
  return { atlas, index, x: round((96 - (body.left + body.right) / 2) / ratio), y: round((192 - body.bottom) / ratio), clip: [visible.top / ratio - 2, (192 - visible.right) / ratio - 2, (192 - visible.bottom) / ratio - 2, visible.left / ratio - 2].map(round) };
}

const offset = (index, x, y) => ((Math.floor(index / 8) * cell + y) * cell * 8 + index % 8 * cell + x) * 4;
function extractCell(packet, index) {
  const result = Buffer.alloc(cell * cell * 4);
  for (let y = 0; y < cell; y++) packet.copy(result, y * cell * 4, offset(index, 0, y), offset(index, 0, y) + cell * 4);
  return result;
}

async function main() {
  const check = process.argv.includes('--check');
  const artifactsOnly = process.argv.includes('--artifacts-only');
  assert(process.argv.slice(2).every(arg => arg === '--check' || arg === '--artifacts-only') && (!artifactsOnly || check), 'Usage: --check [--artifacts-only]; --artifacts-only requires --check');
  const proof = await read(`${prior}/패킹파생기록.json`), proof118 = await read(`${prior118}/패킹파생기록.json`), composite = await read(`${run}/합성파생기록.json`);
  const nativeBytes = await fs.readFile(proof.native.path), generatedBytes = await fs.readFile(composite.nativeRaw);
  assert(hash(nativeBytes) === proof.native.sha256, 'Immutable114 native changed');
  assert(composite.generationCalls === 1 && hash(generatedBytes) === composite.rawSha256, 'Unbound one-call generation');
  assert(Array.isArray(composite.keys) && composite.keys.length === targets.size && new Set(composite.keys.map(key => key.nativeCell)).size === targets.size, 'Expected six unique corrected native keys');
  const parentMetadata = await Promise.all(names.map(name => read(`${run}/고정입력/${name}.json`))), metadata = structuredClone(parentMetadata);
  const parentAnchorsBytes = await fs.readFile(`${run}/고정입력/accessory-anchors.json`);
  const atlasLocations = [], frameLocations = [];
  for (let family = 0; family < metadata.length; family++) {
    for (let local = 0; local < metadata[family].atlases.length; local++) atlasLocations.push({ family, local });
    for (let local = 0; local < metadata[family].frames.length; local++) frameLocations.push({ family, local });
  }
  assert(atlasLocations.length === 33 && frameLocations.length === 520, 'Unexpected frozen metadata topology');
  const packets = new Map(), immutablePackets = [];
  for (let atlas = 0; atlas < atlasLocations.length; atlas++) {
    const { family, local } = atlasLocations[atlas], parent = parentMetadata[family].atlases[local], bytes = await fs.readFile(`public${parent.src}`);
    assert(hash(bytes) === parent.sha256 && bytes.length === parent.bytes, `Immutable parent packet changed: ${parent.src}`);
    immutablePackets.push({ atlas, ...parent });
    if (packetNames.has(atlas)) {
      const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      assert(decoded.info.width === 1536 && decoded.info.height === 384 && decoded.info.channels === 4, 'Unexpected parent packet canvas');
      packets.set(atlas, { parent, decoded: decoded.data, output: Buffer.from(decoded.data), family, local, frames: [] });
    }
  }
  const sources = [], frames = [], targetIndices = [];
  for (const input of composite.keys) {
    const wanted = targets.get(input.nativeCell), keyProof = proof.keys[input.nativeCell];
    assert(wanted && isDeepStrictEqual(input.physicalIndices, wanted), `Wrong exact physical targets: ${input.nativeCell}`);
    assert(input.width === keyProof.box.width && input.height === keyProof.box.height, 'Corrected key canvas changed');
    const [parentPng, correctedPng, maskPng] = await Promise.all([input.parentPath, input.correctedPath, input.maskPath].map(filename => fs.readFile(filename)));
    assert(hash(parentPng) === input.parentSha256 && hash(correctedPng) === input.correctedSha256 && hash(maskPng) === input.maskSha256, 'Source/mask binding changed');
    const parentImage = await sharp(parentPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }), correctedImage = await sharp(correctedPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert([parentImage, correctedImage].every(image => image.info.width === input.width && image.info.height === input.height && image.info.channels === 4), 'Source key dimensions changed');
    const mask = await sharp(maskPng).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
    assert(mask.info.width === input.width && mask.info.height === input.height && mask.info.channels === 1, 'Mask canvas changed');
    const original = await sharp(nativeBytes).extract(keyProof.box).ensureAlpha().raw().toBuffer();
    assert(hash(original) === keyProof.originalCropRgbaSha256, 'Original115 source crop proof changed');
    const cleanedOriginal = clearCompanionExportResidue115(original).rgba;
    assert(hash(cleanedOriginal) === keyProof.cropRgbaSha256, 'Original115 cleaned crop proof changed');
    if (input.nativeCell === 10) {
      const current118Png = await fs.readFile(proof118.correctedKey.path);
      assert(hash(current118Png) === proof118.correctedKey.sha256, 'Immutable118 corrected source changed');
      const current118Raw = await sharp(current118Png).ensureAlpha().raw().toBuffer();
      assert(parentImage.data.equals(current118Raw), '119 yawn parent pixels are not frozen current118 key');
      assert(immutablePackets[16].sha256 === proof118.packet.sha256, '119 yawn packet parent is not118');
    } else assert(parentImage.data.equals(original), `Parent differs from original115 native${input.nativeCell}`);
    let changedPixels = 0, changedChannels = 0, alphaChangedPixels = 0;
    for (let point = 0; point < input.width * input.height; point++) {
      const at = point * 4, changed = !parentImage.data.subarray(at, at + 4).equals(correctedImage.data.subarray(at, at + 4));
      if (!changed) continue;
      assert(mask.data[point] > 0, `Source correction escaped native${input.nativeCell} edit mask`);
      if (parentImage.data[at + 3] !== correctedImage.data[at + 3]) { alphaChangedPixels++; assert(input.nativeCell === 67, 'Face source alpha changed'); }
      changedPixels++; for (let channel = 0; channel < 4; channel++) if (parentImage.data[at + channel] !== correctedImage.data[at + channel]) changedChannels++;
    }
    assert(changedPixels > 0, `No actual correction for native${input.nativeCell}`);
    const parent = clearCompanionExportResidue115(parentImage.data).rgba, corrected = clearCompanionExportResidue115(correctedImage.data).rgba;
    const shape = shapeFor(keyProof, cleanedOriginal);
    sources.push({ ...input, original115CropRgbaSha256: hash(original), original115CleanedRgbaSha256: hash(cleanedOriginal), sourceChangedPixels: changedPixels, sourceChangedChannels: changedChannels, sourceAlphaChangedPixels: alphaChangedPixels });
    for (const physicalIndex of wanted) {
      const slot = proof.slots[physicalIndex], location = frameLocations[physicalIndex];
      assert(slot.nativeCell === input.nativeCell, 'Wrong source-bound physical slot');
      const packet = packets.get(slot.frame.atlas), currentFrame = metadata[location.family].frames[location.local];
      assert(packet && location.family === packet.family && currentFrame.index === slot.frame.index && currentFrame.atlas === packet.local, 'Unexpected frame/atlas ownership');
      const originalPair = await bakePair(shape, cleanedOriginal, cleanedOriginal, slot);
      assert(hash(originalPair.before) === slot.rgbaSha256, `Original115 bake proof cannot reproduce: ${physicalIndex}`);
      const pair = await bakePair(shape, parent, corrected, slot), deltaRows = [];
      let bakeChangedPixels = 0, left = cell, top = cell, right = 0, bottom = 0;
      for (let y = 0; y < cell; y++) {
        let start = -1;
        for (let x = 0; x <= cell; x++) {
          const at = (y * cell + x) * 4;
          const different = x < cell && !pair.before.subarray(at, at + 4).equals(pair.after.subarray(at, at + 4)) && Boolean(pair.before[at + 3] || pair.after[at + 3]);
          if (different) {
            assert(input.nativeCell === 67 || pair.before[at + 3] === pair.after[at + 3], 'Baked face alpha changed');
            pair.after.copy(packet.output, offset(currentFrame.index, x, y), at, at + 4);
            bakeChangedPixels++; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
            if (start < 0) start = x;
          } else if (start >= 0) { deltaRows.push([y, start, x]); start = -1; }
        }
      }
      assert(bakeChangedPixels > 0, `No runtime delta for physical${physicalIndex}`);
      const parentFrame = structuredClone(currentFrame);
      if (input.nativeCell === 67) metadata[location.family].frames[location.local] = registerCompanionBody119(extractCell(packet.output, currentFrame.index), currentFrame.atlas, currentFrame.index);
      const frame = { physicalIndex, nativeCell: input.nativeCell, atlas: slot.frame.atlas, cell: currentFrame.index, parentFrame, frame: metadata[location.family].frames[location.local], registrationChanged: !isDeepStrictEqual(parentFrame, metadata[location.family].frames[location.local]), bakeChangedPixels, changedBounds: { left, top, right, bottom }, deltaRows, frozenFit: pair.frozenFit, ...(pair.fixedTemplatePlacement ? { fixedTemplatePlacement: pair.fixedTemplatePlacement } : {}) };
      packet.frames.push(frame); frames.push(frame); targetIndices.push(physicalIndex);
    }
  }
  assert(targetIndices.length === 16 && new Set(targetIndices).size === 16, 'Expected exact16 corrected physical cells');
  const outputPackets = [], outputs = [];
  for (const [atlas, packet] of [...packets].sort(([a], [b]) => a - b)) {
    const bytes = await sharp(packet.output, { raw: { width: 1536, height: 384, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer(), roundtrip = await sharp(bytes).ensureAlpha().raw().toBuffer();
    let invisibleRgbChannelsNormalized = 0, visibleChangedPixels = 0, alphaChangedPixels = 0;
    for (let at = 0; at < packet.output.length; at += 4) {
      assert(roundtrip[at + 3] === packet.output[at + 3], 'Lossless119 output changed alpha');
      for (let channel = 0; channel < 3; channel++) if (roundtrip[at + channel] !== packet.output[at + channel]) {
        assert(!packet.output[at + 3], 'Lossless119 output changed visible RGB'); invisibleRgbChannelsNormalized++;
      }
      if (roundtrip[at + 3] !== packet.decoded[at + 3]) alphaChangedPixels++;
      if ((roundtrip[at + 3] || packet.decoded[at + 3]) && [0, 1, 2].some(channel => roundtrip[at + channel] !== packet.decoded[at + channel])) visibleChangedPixels++;
    }
    const replacement = { src: `/companion/hd/${packetNames.get(atlas)}-expression-119-v1.webp`, sha256: hash(bytes), bytes: bytes.length, width: 1536, height: 384 };
    metadata[packet.family].atlases[packet.local] = replacement;
    outputPackets.push({ atlas, family: names[packet.family], localAtlas: packet.local, parentPacket: packet.parent, packet: replacement, physicalIndices: packet.frames.map(frame => frame.physicalIndex).sort((a, b) => a - b), visibleChangedPixels, alphaChangedPixels, invisibleRgbChannelsNormalized });
    outputs.push([`public${replacement.src}`, bytes]);
  }
  const registrationChanges = frames.filter(frame => frame.registrationChanged).map(frame => frame.physicalIndex);
  assert(registrationChanges.every(index => index >= 496 && index <= 499), 'Registration changed outside body67');
  for (let family = 0; family < metadata.length; family++) assert(isDeepStrictEqual(metadata[family].rows, parentMetadata[family].rows), 'Logical rows changed');
  const receipt = { version: 1, generationCalls: 1, generationCallsByThisScript: 0, independentArtReviewsByThisScript: 0, ownerApproval: false, parentNative: proof.native, generatedNative: { path: composite.nativeRaw, sha256: hash(generatedBytes) }, compositePath: `${run}/합성파생기록.json`, sources, packets: outputPackets, frames: frames.sort((a, b) => a.physicalIndex - b.physicalIndex), physicalIndices: targetIndices.sort((a, b) => a - b), unchangedOther504VisibleCells: true, allUnaffectedVisibleRgbAndAlphaPreserved: true, transparentRgbNormalization: 'Only alpha0 RGB may normalize under lossless encoding; counted per packet.', registrationChanges, sameOriginalFitAndTemplatePlacement: true, immutableParentPackets: immutablePackets, prior117PacketPreserved: immutablePackets[4], prior118PacketPreserved: immutablePackets[16], frozenAnchors: { path: `${run}/고정입력/accessory-anchors.json`, sha256: hash(parentAnchorsBytes), regeneratedByThisScript: false }, stagedMetadata: Object.fromEntries(names.map(name => [name, `${run}/정리본/${name}.json`])) };
  for (let family = 0; family < metadata.length; family++) outputs.push([`lib/ui/viewer-companion/${names[family]}.json`, json(metadata[family])], [`${run}/정리본/${names[family]}.json`, json(metadata[family])]);
  outputs.push([`${run}/패킹파생기록.json`, json(receipt)]);
  // No mkdir, packet, metadata, snapshot or receipt write precedes this guard.
  // Later scoped repairs own active metadata. Historical artifact checks still
  // reproduce every119 packet, source, staged snapshot and receipt exactly.
  if (!artifactsOnly) {
    const active = await Promise.all(names.map(name => read(`lib/ui/viewer-companion/${name}.json`)));
    assertCompanionMetadataSetOwnership(active, parentMetadata, metadata);
  }
  if (check) {
    for (const [filename, bytes] of outputs) {
      if (artifactsOnly && filename.startsWith('lib/ui/viewer-companion/')) continue;
      assert((await fs.readFile(filename)).equals(bytes), `Derived output differs: ${filename}`);
    }
  } else {
    // Existing named delivery files are never replaced by a different result.
    for (const [filename, bytes] of outputs) {
      if (filename.startsWith('lib/ui/viewer-companion/')) continue;
      try { assert((await fs.readFile(filename)).equals(bytes), `Protected119 output already differs: ${filename}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const [filename, bytes] of outputs) { await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, bytes); }
  }
  console.log(JSON.stringify({ check, ...(artifactsOnly ? { artifactsOnly: true } : {}), packets: outputPackets.length, physicalIndices: receipt.physicalIndices, registrationChanges, parentPacketsPreserved: immutablePackets.length, anchorsRegenerated: false }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
