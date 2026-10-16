// Selective whole-pose derivative. The original36-key native, recipe and all
// twelve original WebPs remain immutable; this script never generates artwork.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const originalRun = 'art-src/빅타민/동행/작업회차/20261016-덤벙놀이';
const run = 'art-src/빅타민/동행/작업회차/20261016-귀두개교정';
const source = `${run}/원본/빅타민_네포즈_귀교정.png`;
const output = 'lib/ui/viewer-companion/play-motion-sprite.json';
const replacementIndices = [10, 19, 25, 27], affectedRows = [21, 24, 27, 28];
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(argument => argument !== '--check')) throw Error('Usage: node scripts/prepare-companion-ear-repair.mjs [--check]');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const round = value => Math.round(value * 1e6) / 1e6;
const read = name => fs.readFile(path.join(root, name));
const json = async name => JSON.parse(await read(name));
const cell = 192, logicalCell = 80, ratio = cell / logicalCell, foot = 180;

function components(data, width, height) {
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height), found = [];
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] <= 160) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    visited[start] = 1; queue[0] = start;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!visited[next] && data[next * 4 + 3] > 160) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    found.push({ left, top, right, bottom, width: right - left, height: bottom - top, pixels: tail });
  }
  return found.sort((a, b) => b.pixels - a.pixels);
}
const union = boxes => ({ left: Math.min(...boxes.map(box => box.left)), top: Math.min(...boxes.map(box => box.top)), right: Math.max(...boxes.map(box => box.right)), bottom: Math.max(...boxes.map(box => box.bottom)) });
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const gap = (a, b) => Math.hypot(Math.max(0, a.left - b.right, b.left - a.right), Math.max(0, a.top - b.bottom, b.top - a.bottom));

// Reconstruct the exact original metadata from its immutable derivation receipt,
// instead of running the historical recipe against intentionally updated output.
const originalReceipt = await json(`${originalRun}/패킹파생기록.json`);
if (hash(await read(originalReceipt.source)) !== originalReceipt.sourceSha256) throw Error('Protected36-key original changed');
const baseline = { version: 1, cell, logicalCell, grid: 8, gridRows: 2, rowOffset: 20,
  atlases: originalReceipt.output.atlases,
  frames: originalReceipt.packets.flatMap((packet, atlas) => packet.nativeIndicesByColumn.map((sourceIndex, index) => ({ atlas, index, ...originalReceipt.derivedCells.find(item => item.sourceIndex === sourceIndex).frame }))),
  rows: originalReceipt.packets.map((_, packet) => Array.from({ length: 16 }, (_, index) => packet * 16 + index)) };
if (hash(`${JSON.stringify(baseline, null, 2)}\n`) !== originalReceipt.output.metadataSha256) throw Error('Original metadata reconstruction differs');
if (hash(await read('lib/ui/viewer-companion/hd-motion-sprite.json')) !== originalReceipt.method.existingHdMetadataSha256) throw Error('Protected established HD metadata changed');
for (const atlas of baseline.atlases) if (hash(await read(`public${atlas.src}`)) !== atlas.sha256) throw Error(`Protected original packet changed: ${atlas.src}`);

const registration = await json(`${run}/생성등록.json`);
const native = await read(source), sourceSha256 = hash(native), info = await sharp(native).metadata();
if (registration.status !== 'DRAFT_DELIVERED_FOR_USER_REVIEW' || registration.sha256.toLowerCase() !== sourceSha256 || hash(await fs.readFile(registration.path)) !== sourceSha256) throw Error('Correction native must match the actually registered one-call draft');
if (!info.hasAlpha || !info.width || !info.height || info.width < 400 || info.height < 400) throw Error('A complete transparent2x2 native is required');
const rgba = await sharp(native).ensureAlpha().raw().toBuffer(), parts = components(rgba, info.width, info.height);
const bodies = parts.filter(part => part.pixels > 4000);
if (bodies.length !== 4) throw Error(`Expected4 complete connected main bodies, got${bodies.length}`);
const quadrant = box => Math.floor((box.top + box.bottom) / 2 / (info.height / 2)) * 2 + Math.floor((box.left + box.right) / 2 / (info.width / 2));
const ordered = new Map(bodies.map(body => [quadrant(body), body]));
if (ordered.size !== 4 || [0, 1, 2, 3].some(index => !ordered.has(index))) throw Error('Ambiguous2x2 whole-pose mapping');
const bounds = replacementIndices.map((_, slot) => {
  const body = ordered.get(slot), reach = Math.max(body.width, body.height) * .18;
  // Keep nearby tears/comic marks with their whole pose; no painting, erasing or
  // component masking. The eventual crop still copies its entire original RGBA.
  const marks = parts.filter(part => part.pixels >= 24 && part !== body && !bodies.includes(part) && quadrant(part) === slot && gap(body, part) <= reach);
  return { body, marks, bounds: union([body, ...marks]) };
});
const cropCell = Math.max(...bounds.map(item => Math.max(item.bounds.right - item.bounds.left, item.bounds.bottom - item.bounds.top))) + 8;
const derived = [];
for (const [slot, item] of bounds.entries()) {
  const { body, marks, bounds: visible } = item;
  const box = { left: Math.floor((visible.left + visible.right - cropCell) / 2), top: Math.floor((visible.top + visible.bottom - cropCell) / 2), width: cropCell, height: cropCell };
  if (bodies.some(other => other !== body && overlaps({ ...box, right: box.left + cropCell, bottom: box.top + cropCell }, other))) throw Error(`Crop would include adjacent main pose: ${slot}`);
  const crop = Buffer.alloc(cropCell * cropCell * 4);
  for (let y = 0; y < cropCell; y++) for (let x = 0; x < cropCell; x++) {
    const xx = x + box.left, yy = y + box.top;
    if (xx >= 0 && yy >= 0 && xx < info.width && yy < info.height) rgba.copy(crop, (y * cropCell + x) * 4, (yy * info.width + xx) * 4, (yy * info.width + xx + 1) * 4);
  }
  const croppedBody = components(crop, cropCell, cropCell)[0];
  if (croppedBody.pixels !== body.pixels || croppedBody.width !== body.width || croppedBody.height !== body.height) throw Error(`Complete native body clipped: ${slot}`);
  const scale = Math.min(1, originalReceipt.method.targetBodyWidth / (visible.right - visible.left), originalReceipt.method.targetBodyHeight / (visible.bottom - visible.top));
  const resizedCell = Math.floor(cropCell * scale), uniformScale = resizedCell / cropCell;
  const resized = await sharp(crop, { raw: { width: cropCell, height: cropCell, channels: 4 } }).resize(resizedCell, resizedCell, { kernel: 'lanczos3' }).raw().toBuffer();
  const resizedParts = components(resized, resizedCell, resizedCell), resizedBody = resizedParts[0];
  const visibleParts = resizedParts.filter(part => part.pixels >= 8 && gap(resizedBody, part) <= Math.max(resizedBody.width, resizedBody.height) * .2);
  const measured = union(visibleParts), dx = Math.round(cell / 2 - (measured.left + measured.right) / 2), dy = foot - measured.bottom;
  const data = Buffer.alloc(cell * cell * 4);
  for (let y = 0; y < resizedCell; y++) for (let x = 0; x < resizedCell; x++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < cell && yy < cell) resized.copy(data, (yy * cell + xx) * 4, (y * resizedCell + x) * 4, (y * resizedCell + x + 1) * 4);
  }
  const registered = { left: measured.left + dx, top: measured.top + dy, right: measured.right + dx, bottom: measured.bottom + dy };
  if (registered.left < 5 || registered.top < 5 || registered.right > cell - 5 || registered.bottom > cell - 5) throw Error(`Registered whole pose/marks approach cell edge: ${slot}`);
  const frame = { x: round((cell / 2 - (registered.left + registered.right) / 2) / ratio), y: round((cell - registered.bottom) / ratio), clip: [registered.top / ratio - 2, (cell - registered.right) / ratio - 2, (cell - registered.bottom) / ratio - 2, registered.left / ratio - 2].map(round) };
  derived.push({ slot, sourceIndex: replacementIndices[slot], originalCell: [Math.floor(replacementIndices[slot] / 6) + 1, replacementIndices[slot] % 6 + 1], body, marks, box, cropRgbaSha256: hash(crop), completeBodyPreserved: true, cropCell, resizedCell, uniformScale, registeredBounds: registered, rgbaSha256: hash(data), frame, data });
}

const result = structuredClone(baseline), files = [], packets = [];
for (const row of affectedRows) {
  const atlasIndex = row - 20, originalAtlas = baseline.atlases[atlasIndex];
  const original = await sharp(await read(`public${originalAtlas.src}`)).ensureAlpha().raw().toBuffer();
  const patched = Buffer.from(original), definition = originalReceipt.packets[atlasIndex], changedColumns = [];
  for (const [column, sourceIndex] of definition.nativeIndicesByColumn.entries()) {
    const replacement = derived.find(item => item.sourceIndex === sourceIndex);
    if (!replacement) continue;
    changedColumns.push(column);
    const xx = column % 8 * cell, yy = Math.floor(column / 8) * cell;
    for (let y = 0; y < cell; y++) replacement.data.copy(patched, ((yy + y) * originalAtlas.width + xx) * 4, y * cell * 4, (y + 1) * cell * 4);
    result.frames[atlasIndex * 16 + column] = { atlas: atlasIndex, index: column, ...replacement.frame };
  }
  const webp = await sharp(patched, { raw: { width: originalAtlas.width, height: originalAtlas.height, channels: 4 } }).webp({ lossless: true, exact: true, effort: 6 }).toBuffer();
  const decoded = await sharp(webp).ensureAlpha().raw().toBuffer();
  // exact:true also retains invisible RGB where alpha=0, protecting every
  // original decoded channel rather than accepting alpha-only equivalence.
  let transparentRgbChangedPixels = 0;
  for (let pixel = 0; pixel < patched.length; pixel += 4) {
    if (decoded[pixel + 3] !== patched[pixel + 3]) throw Error(`Lossless alpha integrity failed: ${row}`);
    if (decoded[pixel] !== patched[pixel] || decoded[pixel + 1] !== patched[pixel + 1] || decoded[pixel + 2] !== patched[pixel + 2]) {
      if (patched[pixel + 3] !== 0) throw Error(`Lossless visible RGB integrity failed: ${row}`);
      transparentRgbChangedPixels++;
    }
  }
  if (transparentRgbChangedPixels !== 0) throw Error(`Exact transparent RGB integrity failed: ${row}`);
  for (let column = 0; column < 16; column++) if (!changedColumns.includes(column)) {
    for (let y = 0; y < cell; y++) {
      const start = ((Math.floor(column / 8) * cell + y) * originalAtlas.width + column % 8 * cell) * 4;
      if (!decoded.subarray(start, start + cell * 4).equals(original.subarray(start, start + cell * 4))) throw Error(`Unaffected decoded pose changed: ${row}/${column}`);
    }
  }
  const name = `public/companion/hd/victamin-play-${row}-ear-v2.webp`;
  result.atlases[atlasIndex] = { ...originalAtlas, src: name.slice('public'.length), sha256: hash(webp), bytes: webp.length };
  packets.push({ row, sourceIndex: derived.find(item => definition.keys.includes(item.sourceIndex)).sourceIndex, original: originalAtlas, replacement: result.atlases[atlasIndex], changedColumns, unchangedColumnsRgbaEqual: true, completeDecodedRgbaSha256: hash(decoded), alphaChangedByEncoding: 0, visibleRgbChangedByEncoding: 0, transparentRgbChangedPixels });
  files.push([name, webp]);
}
const metadata = `${JSON.stringify(result, null, 2)}\n`;
const receipt = { version: 1, source, sourceSha256, nativeBytes: native.length, nativeWidth: info.width, nativeHeight: info.height, generationCallsByThisScript: 0, automaticPostRepairArtReviews: 0, ownerVisualApproval: 'NOT_ESTABLISHED_BY_PACKING', originalRecipe: 'scripts/prepare-companion-play.mjs', originalReceipt: `${originalRun}/패킹파생기록.json`, originalMetadataSha256: originalReceipt.output.metadataSha256, protectedOriginalPacketCount: 12, replacementIndices, affectedRows, untouchedRows: Array.from({ length: 12 }, (_, i) => i + 20).filter(row => !affectedRows.includes(row)), physicalCell: cell, logicalCell, foot, encoding: { lossless: true, exact: true, effort: 6 }, method: 'Four complete connected bodies mapped to2x2 slots; original whole RGBA square crops including associated nearby comic/tear marks; uniform aspect-preserving Lanczos3 normalization. Decode immutable original packet and patch only the selected source-key columns. Lossless exact-RGBA output preserves every unaffected decoded pixel, including other poses sharing a replaced packet.', derived: derived.map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'data'))), packets, output: { metadata: output, metadataSha256: hash(metadata), atlases: result.atlases, networkBytes: result.atlases.reduce((sum, atlas) => sum + atlas.bytes, 0) } };
files.push([output, metadata]);
files.push([`${run}/패킹파생기록.json`, `${JSON.stringify(receipt, null, 2)}\n`]);
files.push([`${run}/패킹기록.md`, `# 네 포즈 두 귀 교정 기술 패킹\n\n원본36키·기존12packet·068기록은 읽기 전용. 교정native4포즈를 전체RGBA로 추출해 원래인덱스10·19·25·27에 연결했다. 독립 부위 합성/귀그리기/추가생성/미술PASS는 하지 않았다.\n\n- 새 packet21·24·27·28에만 \`-ear-v2\` 경로. 다른8atlas·나머지frame객체·rows 보존.\n- 192물리/80논리·공통foot180, 균일 aspect고정 축소. 같은 교정packet의 비요청column도 기존decodeRGBA 그대로 보존하는 losslessWebP.\n- 원본 alpha/보호packet SHA와 068원본metadata 재구성SHA를 먼저 검사. \`node scripts/prepare-companion-ear-repair.mjs --check\`가 역사068baseline과 이번 선택교정을 함께 재현한다. 역사스크립트의 출력대상metadata가 바뀐 것은 의도된 것으로,068스크립트/기록은 수정하지 않는다.\n- [세부 기록](패킹파생기록.json). 사용자 시각 승인과 실제브라우저 메모리/동작 검증은 별도.\n`]);
for (const [name, bytes] of files) {
  if (check) { if (hash(await read(name)) !== hash(bytes)) throw Error(`Reproducibility mismatch: ${name}`); }
  else { await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true }); await fs.writeFile(path.join(root, name), bytes); }
}
if (!check) {
  const preview = path.join(root, '.scratch-pw/companion-069-art'); await fs.mkdir(preview, { recursive: true });
  await sharp({ create: { width: cell * 2, height: cell * 2, channels: 4, background: '#eee5d0' } }).composite(derived.map((item, index) => ({ input: item.data, raw: { width: cell, height: cell, channels: 4 }, left: index % 2 * cell, top: Math.floor(index / 2) * cell }))).resize(368, 368).png().toFile(path.join(preview, 'four-repaired-poses-at92.png'));
}
console.log(JSON.stringify({ check, sourceSha256, affectedRows, newPackets: packets.map(packet => packet.replacement), unchangedOriginalPackets: 12, outputSha256: receipt.output.metadataSha256 }));
