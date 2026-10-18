//120: source-bound eye/contour deltas over the frozen119 packets.
// Reuse the119 eye proposal; only cozy has a new generator source. This
// script neither generates/reviews art nor regenerates accessory anchors.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import sharp from 'sharp';
import { clearCompanionExportResidue115 } from './prepare-companion-motion-115.mjs';
import { assertCompanionMetadataSetOwnership, bakePair, shapeFor } from './prepare-companion-expression-volume-119.mjs';

const run = 'art-src/빅타민/동행/작업회차/20261019-눈매윤곽교정120';
const prior = 'art-src/빅타민/동행/작업회차/20261018-동작연결정리115';
const prior119 = 'art-src/빅타민/동행/작업회차/20261019-표정체적교정119';
const names = ['hd-motion-sprite', 'play-motion-sprite', 'living-motion-sprite'];
const targets = new Map([[1, [9, 10]], [10, [266]], [78, [519]]]);
const packetNames = new Map([[0, 'vitamin-action-00'], [16, 'vitamin-action-16'], [32, 'vitamin-episodes-00']]);
const cell = 192;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const read = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));
const assert = (condition, message) => { if (!condition) throw Error(message); };
const offset = (index, x, y) => ((Math.floor(index / 8) * cell + y) * cell * 8 + index % 8 * cell + x) * 4;

async function main() {
  const check = process.argv.includes('--check');
  assert(process.argv.slice(2).every(arg => arg === '--check'), 'Usage: --check');
  const proof = await read(`${prior}/패킹파생기록.json`), previous = await read(`${prior119}/패킹파생기록.json`), composite = await read(`${run}/합성파생기록.json`);
  const nativeBytes = await fs.readFile(proof.native.path), generatedBytes = await fs.readFile(composite.nativeRaw);
  assert(hash(nativeBytes) === proof.native.sha256, 'Immutable114 native changed');
  assert(composite.generationCalls === 1 && hash(generatedBytes) === composite.rawSha256, 'Unbound one-call cozy generation');
  assert(composite.eyeGenerationCalls120 === 0 && isDeepStrictEqual(composite.reused119EyeRaw, previous.generatedNative), '120 eyes must reuse the frozen119 generator source');
  assert(hash(await fs.readFile(previous.generatedNative.path)) === previous.generatedNative.sha256, 'Immutable119 generator source changed');
  assert(Array.isArray(composite.keys) && composite.keys.length === targets.size && new Set(composite.keys.map(key => key.nativeCell)).size === targets.size, 'Expected three unique corrected native keys');
  const parentMetadata = await Promise.all(names.map(name => read(`${run}/고정입력/${name}.json`))), metadata = structuredClone(parentMetadata);
  for (let family = 0; family < names.length; family++) {
    const frozenBytes = await fs.readFile(`${run}/고정입력/${names[family]}.json`), previousBytes = await fs.readFile(previous.stagedMetadata[names[family]]);
    assert(frozenBytes.equals(previousBytes), 'Frozen120 parent is not exact119 metadata');
  }
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
    let reusedProposal;
    if (input.nativeCell === 78) assert(parentImage.data.equals(cleanedOriginal), 'Cozy parent differs from exact115 cleaned native78');
    else {
      const priorSource = previous.sources.find(source => source.nativeCell === input.nativeCell);
      assert(priorSource, 'Missing119 eye source');
      const priorPng = await fs.readFile(priorSource.correctedPath);
      assert(hash(priorPng) === priorSource.correctedSha256, 'Immutable119 corrected eye source changed');
      assert(parentImage.data.equals(await sharp(priorPng).ensureAlpha().raw().toBuffer()), 'Eye parent is not exact current119 corrected source');
      reusedProposal = await sharp(`${run}/고정입력/119등록후_키${input.nativeCell}_마스크전.png`).ensureAlpha().raw().toBuffer();
      const proposalHash = input.nativeCell === 1 ? 'ede672b073a4473ea2f1e5a595c5aa187e077e3e8ca14d27595b5068a7a065cc' : 'f96282f4ad41b166029de4ab933b369b1e9094c632cc99fb544163fbe61a3bf3';
      assert(hash(reusedProposal) === proposalHash, 'Frozen registered119 eye proposal changed');
    }
    let changedPixels = 0, changedChannels = 0, alphaChangedPixels = 0;
    for (let point = 0; point < input.width * input.height; point++) {
      const at = point * 4;
      if (parentImage.data.subarray(at, at + 4).equals(correctedImage.data.subarray(at, at + 4))) continue;
      assert(mask.data[point] > 0, `Source correction escaped native${input.nativeCell} edit mask`);
      if (reusedProposal) assert(correctedImage.data.subarray(at, at + 3).equals(reusedProposal.subarray(at, at + 3)), 'Eye correction is not exact registered119 proposal RGB');
      if (parentImage.data[at + 3] !== correctedImage.data[at + 3]) { alphaChangedPixels++; assert(input.nativeCell === 78, 'Eye source alpha changed'); }
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
            assert(input.nativeCell === 78 || pair.before[at + 3] === pair.after[at + 3], 'Baked eye alpha changed');
            pair.after.copy(packet.output, offset(currentFrame.index, x, y), at, at + 4);
            bakeChangedPixels++; left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
            if (start < 0) start = x;
          } else if (start >= 0) { deltaRows.push([y, start, x]); start = -1; }
        }
      }
      assert(bakeChangedPixels > 0, `No runtime delta for physical${physicalIndex}`);
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) if (packet.output[offset(currentFrame.index, x, y) + 3]) {
        assert(x >= currentFrame.clip[3] * 2.4 && x < cell - currentFrame.clip[1] * 2.4 && y >= currentFrame.clip[0] * 2.4 && y < cell - currentFrame.clip[2] * 2.4, `Correction escaped retained registration clip: ${physicalIndex}`);
      }
      const frame = { physicalIndex, nativeCell: input.nativeCell, atlas: slot.frame.atlas, cell: currentFrame.index, parentFrame: structuredClone(currentFrame), frame: structuredClone(currentFrame), registrationChanged: false, bakeChangedPixels, changedBounds: { left, top, right, bottom }, deltaRows, frozenFit: pair.frozenFit, ...(pair.fixedTemplatePlacement ? { fixedTemplatePlacement: pair.fixedTemplatePlacement } : {}) };
      packet.frames.push(frame); frames.push(frame); targetIndices.push(physicalIndex);
    }
  }
  assert(targetIndices.length === 4 && new Set(targetIndices).size === 4, 'Expected exact four corrected physical cells');
  const outputPackets = [], outputs = [];
  for (const [atlas, packet] of [...packets].sort(([a], [b]) => a - b)) {
    const bytes = await sharp(packet.output, { raw: { width: 1536, height: 384, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer(), roundtrip = await sharp(bytes).ensureAlpha().raw().toBuffer();
    let invisibleRgbChannelsNormalized = 0, visibleChangedPixels = 0, alphaChangedPixels = 0;
    for (let at = 0; at < packet.output.length; at += 4) {
      assert(roundtrip[at + 3] === packet.output[at + 3], 'Lossless120 output changed alpha');
      for (let channel = 0; channel < 3; channel++) if (roundtrip[at + channel] !== packet.output[at + channel]) {
        assert(!packet.output[at + 3], 'Lossless120 output changed visible RGB'); invisibleRgbChannelsNormalized++;
      }
      if (roundtrip[at + 3] !== packet.decoded[at + 3]) alphaChangedPixels++;
      if ((roundtrip[at + 3] || packet.decoded[at + 3]) && [0, 1, 2].some(channel => roundtrip[at + channel] !== packet.decoded[at + channel])) visibleChangedPixels++;
    }
    const replacement = { src: `/companion/hd/${packetNames.get(atlas)}-eye-contour-120-v1.webp`, sha256: hash(bytes), bytes: bytes.length, width: 1536, height: 384 };
    metadata[packet.family].atlases[packet.local] = replacement;
    outputPackets.push({ atlas, family: names[packet.family], localAtlas: packet.local, parentPacket: packet.parent, packet: replacement, physicalIndices: packet.frames.map(frame => frame.physicalIndex).sort((a, b) => a - b), visibleChangedPixels, alphaChangedPixels, invisibleRgbChannelsNormalized });
    outputs.push([`public${replacement.src}`, bytes]);
  }
  for (let family = 0; family < metadata.length; family++) {
    assert(isDeepStrictEqual(metadata[family].rows, parentMetadata[family].rows), 'Logical rows changed');
    assert(isDeepStrictEqual(metadata[family].frames, parentMetadata[family].frames), 'Runtime registration changed');
  }
  const receipt = { version: 1, generationCalls: 1, generationCallsByThisScript: 0, independentArtReviewsByThisScript: 0, ownerApproval: false, parentNative: proof.native, generatedNative: { path: composite.nativeRaw, sha256: hash(generatedBytes) }, reused119EyeProposal: true, compositePath: `${run}/합성파생기록.json`, sources, packets: outputPackets, frames: frames.sort((a, b) => a.physicalIndex - b.physicalIndex), physicalIndices: targetIndices.sort((a, b) => a - b), unchangedOther516VisibleCells: true, allUnaffectedVisibleRgbAndAlphaPreserved: true, transparentRgbNormalization: 'Only alpha0 RGB may normalize under lossless encoding; counted per packet.', registrationChanges: [], sameOriginalFitAndTemplatePlacement: true, immutableParentPackets: immutablePackets, prior117PacketPreserved: immutablePackets[4], prior119BodyPacketsPreserved: [immutablePackets[22], immutablePackets[31]], frozenAnchors: { path: `${run}/고정입력/accessory-anchors.json`, sha256: hash(parentAnchorsBytes), regeneratedByThisScript: false }, stagedMetadata: Object.fromEntries(names.map(name => [name, `${run}/정리본/${name}.json`])) };
  for (let family = 0; family < metadata.length; family++) outputs.push([`lib/ui/viewer-companion/${names[family]}.json`, json(metadata[family])], [`${run}/정리본/${names[family]}.json`, json(metadata[family])]);
  outputs.push([`${run}/패킹파생기록.json`, json(receipt)]);
  // Read/validate every metadata owner before ANY packet, directory, staged
  // snapshot, receipt or global write; a later owner must never be rolled back.
  const active = await Promise.all(names.map(name => read(`lib/ui/viewer-companion/${name}.json`)));
  assertCompanionMetadataSetOwnership(active, parentMetadata, metadata);
  if (check) {
    for (const [filename, bytes] of outputs) assert((await fs.readFile(filename)).equals(bytes), `Derived output differs: ${filename}`);
  } else {
    for (const [filename, bytes] of outputs) {
      if (filename.startsWith('lib/ui/viewer-companion/')) continue;
      try { assert((await fs.readFile(filename)).equals(bytes), `Protected120 output already differs: ${filename}`); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    for (const [filename, bytes] of outputs) { await fs.mkdir(path.dirname(filename), { recursive: true }); await fs.writeFile(filename, bytes); }
  }
  console.log(JSON.stringify({ check, packets: outputPackets.length, physicalIndices: receipt.physicalIndices, registrationChanges: [], parentPacketsPreserved: immutablePackets.length, anchorsRegenerated: false }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
