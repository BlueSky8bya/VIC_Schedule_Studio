//115: technical reuse of114 native, whole authored keys only. No generation,
// eye transplant, runtime pixel analysis or changes to historical art bytes.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { bakeEyeStyleKey, prepareFamilyKey } from './prepare-companion-eye-style.mjs';

export const run114 = 'art-src/빅타민/동행/작업회차/20261018-동작연결정리115';
const prior114 = 'art-src/빅타민/동행/작업회차/20261018-포즈통일114';
const source = `${prior114}/원본/빅타민_통일80키.png`;
const sourceSha256 = '8cfa1fd98c63eff8b06dba9d0950391509e60d194c878b5881a16176be245ba4';
const oldRun = 'art-src/빅타민/동행/작업회차/20261018-체형외곽선통일';
const names = ['hd-motion-sprite', 'play-motion-sprite', 'living-motion-sprite'];
const cell = 192, ratio = 192 / 80, foot = 180;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const readJson = async name => JSON.parse(await fs.readFile(name, 'utf8'));
const round = number => Math.round(number * 1e6) / 1e6;
const alphaHash = bytes => hash(Buffer.from(bytes.filter((_, index) => index % 4 === 3)));

export function sourceCellFor114(identity, keys) {
  let cellIndex = keys.find(item => item.family === identity.family && item.key === identity.key)?.cell;
  if (!Number.isInteger(cellIndex)) throw Error(`Unmapped whole key: ${identity.family}:${identity.key}`);
  // The model ignored several negative-expression instructions. Use another
  // complete authored pose from this same single native, never a facial part.
  if (identity.family === 'mood') cellIndex = identity.key < 8 ? 27 + identity.key % 2 : 62;
  if (identity.family === 'play' && [24, 26].includes(identity.key) || identity.family === 'ear' && identity.key === 2) cellIndex = 51;
  if (identity.family === 'play' && identity.key === 28 || identity.family === 'ear' && identity.key === 3) cellIndex = 62;
  if (identity.family === 'throw' && identity.key === 2) cellIndex = 68;
  // A wink on every second half-stride reads as an intermittent missing eye.
  // Keep the actual open-eye walking whole pose through the existing two
  // half-stride rigs. Idle's independently authored blink remains unchanged.
  if (identity.family === 'clean' && identity.key === 3) cellIndex = 2;
  return cellIndex;
}

/** Remove only1/255 alpha export residue, preserving every RGB byte and
 * every stronger alpha byte. This is not inpainting or semantic masking. */
export function clearCompanionExportResidue115(rgba) {
  const output = Buffer.from(rgba); let cleared = 0;
  for (let index = 3; index < output.length; index += 4) if (output[index] === 1) { output[index] = 0; cleared++; }
  return { rgba: output, cleared };
}

function components(bytes, width, height, threshold = 200) {
  const seen = new Uint8Array(width * height), queue = new Int32Array(seen.length), result = [];
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || bytes[start * 4 + 3] < threshold) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    queue[0] = start; seen[start] = 1;
    while (head < tail) {
      const current = queue[head++], x = current % width, y = Math.floor(current / width);
      left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!seen[next] && bytes[next * 4 + 3] >= threshold) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    result.push({ left, top, right, bottom, width: right - left, height: bottom - top, pixels: tail });
  }
  return result.sort((a, b) => b.pixels - a.pixels);
}
function alphaBounds(bytes, width, height) {
  let left = width, top = height, right = 0, bottom = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (bytes[(y * width + x) * 4 + 3]) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); }
  if (left >= right) throw Error('Empty whole key');
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}
const gap = (a, b) => Math.hypot(Math.max(0, a.left - b.right, b.left - a.right), Math.max(0, a.top - b.bottom, b.top - a.bottom));
const union = boxes => ({ left: Math.min(...boxes.map(box => box.left)), top: Math.min(...boxes.map(box => box.top)), right: Math.max(...boxes.map(box => box.right)), bottom: Math.max(...boxes.map(box => box.bottom)) });

// Unlike101's native-downsample-only fit,114 explicitly reports the smaller
// model output and permits isotropic packing enlargement. This creates no
// additional source detail and is not a high-DPI source-resolution claim.
export function fitUnifiedKey114(key, requestedScale, rig) {
  if (!Number.isFinite(requestedScale) || requestedScale <= 0 || requestedScale > 2) throw Error('Invalid finite whole-key packing scale');
  const alpha = key.alpha, body = key.body;
  const extents = scale => {
    if (!rig) { const cx = (body.left + body.right) / 2; return { left: 96 + (alpha.left - cx) * scale - 2, right: 96 + (alpha.right - cx) * scale + 2, top: foot + (alpha.top - body.bottom) * scale - 2, bottom: foot + (alpha.bottom - body.bottom) * scale + 2 }; }
    const cosine = Math.cos(rig.tilt), sine = Math.sin(rig.tilt), xs = [], ys = [];
    for (const rigid of [false, true]) for (const x of [-alpha.width / 2 * scale + (rigid ? 0 : Math.min(0, ...rig.ears.map(ear => ear.x))), alpha.width / 2 * scale + (rigid ? 0 : Math.max(0, ...rig.ears.map(ear => ear.x)))]) for (const y of [-alpha.height * scale + (rigid ? 0 : Math.min(0, ...rig.ears.map(ear => ear.y))), rigid ? 0 : Math.max(0, ...rig.ears.map(ear => ear.y))]) {
      const dx = x * (rigid ? 1 : rig.sx), dy = y * (rigid ? 1 : rig.sy); xs.push(96 + rig.sway + cosine * dx - sine * dy); ys.push(foot + sine * dx + cosine * dy);
    }
    return { left: Math.min(...xs) - 2, right: Math.max(...xs) + 2, top: Math.min(...ys) - 2, bottom: Math.max(...ys) + 2 };
  };
  const safe = scale => { const box = extents(scale); return box.right - box.left <= 145 && box.bottom - box.top <= 157; };
  if (!safe(0)) throw Error('Rig offsets exceed whole-key footprint');
  let scale = requestedScale;
  if (!safe(scale)) { let low = 0, high = scale; for (let n = 0; n < 36; n++) { const middle = (low + high) / 2; if (safe(middle)) low = middle; else high = middle; } scale = low; }
  const predicted = extents(scale), offset = { x: Math.max(5 - predicted.left, Math.min(0, 187 - predicted.right)), y: Math.max(5 - predicted.top, Math.min(0, 187 - predicted.bottom)) };
  return { requestedScale, scale, safetyCapped: scale < requestedScale, offset, protectedBounds: { left: predicted.left + offset.x, top: predicted.top + offset.y, right: predicted.right + offset.x, bottom: predicted.bottom + offset.y } };
}

async function extractKeys(native) {
  const { data, info } = await sharp(native).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 1122 || info.height !== 1402) throw Error('Unexpected original native dimensions');
  const parts = components(data, info.width, info.height), bodies = parts.filter(part => part.pixels > 3000).sort((a, b) => (a.top + a.bottom) - (b.top + b.bottom));
  if (bodies.length !== 80) throw Error(`Expected80 main authored silhouettes, got${bodies.length}`);
  const ordered = []; for (let row = 0; row < 10; row++) ordered.push(...bodies.slice(row * 8, row * 8 + 8).sort((a, b) => a.left - b.left));
  const keys = [];
  for (const [index, body] of ordered.entries()) {
    const marks = parts.filter(part => !bodies.includes(part) && part.pixels >= 12 && gap(body, part) <= 8);
    const visible = union([body, ...marks]), box = { left: visible.left - 3, top: visible.top - 3, width: visible.right - visible.left + 6, height: visible.bottom - visible.top + 6 };
    const originalRgba = await sharp(data, { raw: info }).extract(box).raw().toBuffer(), cleanup = clearCompanionExportResidue115(originalRgba), rgba = cleanup.rgba, localBody = { ...body, left: body.left - box.left, right: body.right - box.left, top: body.top - box.top, bottom: body.bottom - box.top };
    const alpha = alphaBounds(rgba, box.width, box.height);
    // One central face region stays rigid as a group under the existing rig.
    // This is sampling geometry; original eyes/mouth are never separated.
    const featureBounds = { left: localBody.left + body.width * .2, right: localBody.right - body.width * .15, top: localBody.top + body.height * .35, bottom: localBody.bottom - body.height * .1 };
    const face = { featureBounds, protected: { left: featureBounds.left - 5, right: featureBounds.right + 5, top: featureBounds.top - 5, bottom: featureBounds.bottom + 5 }, fade: 2 };
    keys.push({ rgba, width: box.width, height: box.height, body: localBody, alpha, face, record: { cell: index, box, body, marks, originalCropRgbaSha256: hash(originalRgba), cropRgbaSha256: hash(rgba), opacity1NoiseCleared: cleanup.cleared, allRgbBytesPreserved: true, strongerAlphaBytesPreserved: true, completeHighAlphaBodyPreserved: components(rgba, box.width, box.height)[0]?.pixels === body.pixels, rgbaPixelsRepainted: 0 } });
  }
  return { keys, info };
}

function register(data, atlas, index) {
  const visible = alphaBounds(data, cell, cell), body = components(data, cell, cell)[0];
  if (visible.left < 4 || visible.top < 4 || visible.right > 188 || visible.bottom > 188 || visible.width > 146 || visible.height > 158) throw Error(`Out of protected frame: ${atlas}:${index}`);
  return { frame: { atlas, index, x: round((96 - (body.left + body.right) / 2) / ratio), y: round((192 - body.bottom) / ratio), clip: [visible.top / ratio - 2, (192 - visible.right) / ratio - 2, (192 - visible.bottom) / ratio - 2, visible.left / ratio - 2].map(round) }, body, allAlphaBounds: visible, alphaSha256: alphaHash(data), rgbaSha256: hash(data) };
}

async function main() {
  const check = process.argv.includes('--check'), native = await fs.readFile(source);
  if (hash(native) !== sourceSha256) throw Error('Native source changed');
  const guide = await readJson(`${run114}/포즈매핑.json`), previous = await readJson(`${oldRun}/패킹파생기록.json`);
  const packs = await Promise.all(names.map(name => readJson(`${run114}/고정입력/${name}.json`)));
  for (const protectedAsset of guide.protectedAssets) if (hash(await fs.readFile(protectedAsset.path)) !== protectedAsset.sha256) throw Error(`Historical bytes changed: ${protectedAsset.path}`);
  const priorReceipt = await readJson(`${prior114}/패킹파생기록.json`);
  for (const packet of priorReceipt.packets) if (hash(await fs.readFile(`public${packet.src}`)) !== packet.sha256) throw Error(`Protected114 packet changed: ${packet.src}`);
  const extracted = await extractKeys(native), { keys } = extracted, requestedScale = 130 / keys[0].body.width;
  const slots = [...previous.slots, ...Array.from({ length: 8 }, (_, index) => ({ index: 512 + index, family: 'living', key: index, live: true, activeLive: true }))];
  const outputs = [], records = [], packets = [], metadata = packs.map(pack => ({ ...pack, atlases: [], frames: [] }));
  const write = (name, bytes) => outputs.push([name, bytes]);
  const drawn = [];
  for (const slot of slots) {
    const nativeCell = sourceCellFor114(slot, guide.keys), key = keys[nativeCell], fit = fitUnifiedKey114(key, requestedScale, slot.rig);
    const prepared = slot.rig ? bakeEyeStyleKey(key, slot.rig, fit.scale, fit.offset) : await prepareFamilyKey(key, fit);
    const registered = register(prepared.data, Math.floor(slot.index / 16), slot.index % 16);
    drawn.push(prepared.data);
    records.push({ index: slot.index, family: slot.family, key: slot.key, activeLive: slot.activeLive, nativeCell, source, sourceSha256, cropRgbaSha256: key.record.cropRgbaSha256, ...(slot.rig ? { rig: slot.rig, faceProtection: prepared.faceProtection } : {}), fit, ...registered });
  }
  while (drawn.length % 16) drawn.push(Buffer.alloc(cell * cell * 4));
  for (let packet = 0; packet < 33; packet++) {
    const family = packet < 19 ? 0 : packet < 32 ? 1 : 2, localPacket = packet - [0, 19, 32][family];
    const src = `/companion/hd/vitamin-${['action', 'play', 'episodes'][family]}-${String(localPacket).padStart(2, '0')}-motion-115-v1.webp`;
    const atlasRaw = await sharp({ create: { width: 1536, height: 384, channels: 4, background: '#0000' } }).composite(drawn.slice(packet * 16, packet * 16 + 16).map((input, index) => ({ input, raw: { width: cell, height: cell, channels: 4 }, left: index % 8 * cell, top: Math.floor(index / 8) * cell }))).raw().toBuffer();
    const bytes = await sharp(atlasRaw, { raw: { width: 1536, height: 384, channels: 4 } }).webp({ quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 }).toBuffer(), decoded = await sharp(bytes).ensureAlpha().raw().toBuffer();
    if (alphaHash(atlasRaw) !== alphaHash(decoded)) throw Error('WebP changed alpha');
    const atlas = { src, sha256: hash(bytes), bytes: bytes.length, width: 1536, height: 384 };
    metadata[family].atlases.push(atlas); packets.push({ index: packet, ...atlas, alphaSha256: alphaHash(decoded) }); write(`public${src}`, bytes);
    for (const record of records.slice(packet * 16, packet * 16 + 16)) metadata[family].frames.push({ ...record.frame, atlas: localPacket });
  }
  for (const [i, name] of names.entries()) { if (JSON.stringify(metadata[i].rows) !== JSON.stringify(packs[i].rows)) throw Error('Logical action topology changed'); write(`${run114}/정리본/${name}.json`, json(metadata[i])); write(`lib/ui/viewer-companion/${name}.json`, json(metadata[i])); }
  const receipt = { version: 1, native: { path: source, sha256: sourceSha256, width: extracted.info.width, height: extracted.info.height, originalPreserved: true }, generationCallsForRun: 0, generationCallsByThisScript: 0, ownerVisualApproval: 'NOT_ESTABLISHED', review: 'TECHNICAL_MOTION_DERIVATION_NO_NEW_GENERATION', baseline: names.map(name => `${run114}/고정입력/${name}.json`), packing: { cell, logicalCell: 80, columns: 8, rows: 2, sourceFigureWidthRange: [Math.min(...keys.map(key => key.body.width)), Math.max(...keys.map(key => key.body.width))], requestedWholeKeyScale: requestedScale, enlargementCreatesNewDetail: false }, coverage: { originalNativeKeys: 80, requestedUsedWorldKeys: 79, distinctWholeKeysUsed: new Set(records.map(record => record.nativeCell)).size, physicalSlots: records.length, logicalRows: metadata.reduce((total, pack) => total + pack.rows.length, 0), fallbackOldRgbSlots: 0, audiencePreserved: true }, wholeKeyRemaps: records.filter(record => record.nativeCell !== guide.keys.find(key => key.family === record.family && key.key === record.key)?.cell).map(({ index, family, key, nativeCell }) => ({ index, family, key, nativeCell })), keys: keys.map(key => key.record), slots: records, packets, stagedMetadata: Object.fromEntries(names.map(name => [name, `${run114}/정리본/${name}.json`])) };
  write(`${run114}/패킹파생기록.json`, json(receipt));
  // Review sheets show actual decoded output at the default92px cell and2x.
  for (const size of [92, 184]) {
    const inputs = [], stride = size + 26, rowHeight = size + 35;
    for (const item of guide.keys.slice(0, 79)) {
      const record = records[item.representative], image = await sharp(drawn[record.index], { raw: { width: cell, height: cell, channels: 4 } }).resize(size, size).png().toBuffer();
      inputs.push({ input: image, left: item.cell % 8 * stride + 13, top: Math.floor(item.cell / 8) * rowHeight });
      const label = `<svg width="${stride}" height="30"><text x="${stride / 2}" y="13" text-anchor="middle" fill="#594a3b" font-size="10">${item.family}:${item.key} →${record.nativeCell + 1}</text><text x="${stride / 2}" y="25" text-anchor="middle" fill="#756a5e" font-size="9">#${record.index}</text></svg>`;
      inputs.push({ input: Buffer.from(label), left: item.cell % 8 * stride, top: Math.floor(item.cell / 8) * rowHeight + size });
    }
    write(`${run114}/정리본/검토/전체79키_${size}.png`, await sharp({ create: { width: stride * 8, height: rowHeight * 10, channels: 4, background: '#efede8' } }).composite(inputs).png().toBuffer());
  }
  for (const [name, bytes] of outputs) {
    if (check) { if (!(await fs.readFile(name)).equals(bytes)) throw Error(`Reproducibility mismatch: ${name}`); }
    else { await fs.mkdir(path.dirname(name), { recursive: true }); await fs.writeFile(name, bytes); }
  }
  console.log(JSON.stringify({ check, ...receipt.coverage, bytes: packets.reduce((total, packet) => total + packet.bytes, 0), suffix: 'motion-115-v1' }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
