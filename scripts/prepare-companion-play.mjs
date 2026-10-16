// Deterministic crop/registration/format derivatives of one36-key native.
// No image generation, redraw, face edit, denoise, rig or existing-asset change.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = 'art-src/빅타민/동행/작업회차/20261016-덤벙놀이';
const source = `${run}/원본/빅타민_덤벙놀이_36키포즈.png`;
const sourceSha256 = '36f27e7187701047706c655c4cd8ea1dc2567fa69affc21593466f3350a106c5';
const output = 'lib/ui/viewer-companion/play-motion-sprite.json';
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(argument => argument !== '--check')) throw Error('Usage: node scripts/prepare-companion-play.mjs [--check]');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const round = value => Math.round(value * 1e6) / 1e6;
const withoutPixels = item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'data'));
const cell = 192, logicalCell = 80, ratio = cell / logicalCell, foot = 180;
const encoding = { quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 };
const definitions = [
  { row: 20, name: 'sprint', keys: [0, 1, 2, 3, 4, 5], loop: true },
  { row: 21, name: 'tumble', keys: [6, 7, 8, 9, 10, 11], loop: false },
  { row: 22, name: 'dizzy', keys: [12, 13], loop: true },
  { row: 23, name: 'recover', keys: [14, 15, 16, 17], loop: false },
  { row: 24, name: 'slip', keys: [18, 19], loop: false },
  { row: 25, name: 'bump', keys: [18, 20], loop: false },
  { row: 26, name: 'lookaround', keys: [21, 22, 23], loop: true },
  { row: 27, name: 'tears', keys: [24, 25, 26], loop: false },
  { row: 28, name: 'sulk', keys: [27, 28], loop: true },
  { row: 29, name: 'bow', keys: [30, 31], loop: false },
  { row: 30, name: 'groom', keys: [32, 33], loop: true },
  { row: 31, name: 'pounce', keys: [34, 35], loop: false },
];

/** Largest alpha>160 component. Other pixels remain in the derived cell;
 * the shared CSS clip hides distant alpha specks, just as for existing HD. */
function measure(data, width, height, all = false) {
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let largest; const components = [];
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
    const body = { left, top, right, bottom, width: right - left, height: bottom - top, pixels: tail };
    if (all && tail > 4000) components.push(body);
    if (!largest || tail > largest.pixels) largest = body;
  }
  if (all) return components;
  if (!largest || largest.pixels < 100) throw Error('Missing connected native body');
  return largest;
}

const native = await fs.readFile(path.join(root, source)), info = await sharp(native).metadata();
if (hash(native) !== sourceSha256 || info.width !== 1254 || info.height !== 1254 || !info.hasAlpha) throw Error('Pinned native bytes/dimensions/alpha changed');
const nativeRgba = await sharp(native).ensureAlpha().raw().toBuffer();
const completeBodies = measure(nativeRgba, info.width, info.height, true);
if (completeBodies.length !== 36) throw Error(`Expected36 complete native bodies, got${completeBodies.length}`);
const byIndex = new Map(completeBodies.map(body => [Math.floor((body.top + body.bottom) / 2 / 209) * 6 + Math.floor((body.left + body.right) / 2 / 209), body]));
if (byIndex.size !== 36 || [...byIndex.keys()].some(index => index < 0 || index >= 36)) throw Error('Ambiguous native six-by-six body mapping');
// Generated bodies cross nominal209px cell lines. Extract each complete
// connected body with one common square crop; never cut at the nominal grid.
const nativeCropCell = Math.max(...completeBodies.map(body => Math.max(body.width, body.height))) + 8;
const nativeCells = [];
for (let index = 0; index < 36; index++) {
  const sourceBody = byIndex.get(index);
  const box = { left: Math.floor((sourceBody.left + sourceBody.right - nativeCropCell) / 2), top: Math.floor((sourceBody.top + sourceBody.bottom - nativeCropCell) / 2), width: nativeCropCell, height: nativeCropCell };
  const data = Buffer.alloc(nativeCropCell * nativeCropCell * 4);
  for (let y = 0; y < nativeCropCell; y++) for (let x = 0; x < nativeCropCell; x++) {
    const xx = x + box.left, yy = y + box.top;
    if (xx >= 0 && yy >= 0 && xx < info.width && yy < info.height) nativeRgba.copy(data, (y * nativeCropCell + x) * 4, (yy * info.width + xx) * 4, (yy * info.width + xx + 1) * 4);
  }
  const body = measure(data, nativeCropCell, nativeCropCell);
  if (body.width !== sourceBody.width || body.height !== sourceBody.height || body.pixels !== sourceBody.pixels) throw Error(`Native body was cut during extraction: ${index}`);
  const nominal = { left: index % 6 * 209, top: Math.floor(index / 6) * 209 };
  nativeCells.push({ index, box, sourceBody, nominalCellCrossing: sourceBody.left < nominal.left || sourceBody.right > nominal.left + 209 || sourceBody.top < nominal.top || sourceBody.bottom > nominal.top + 209, data, body, rgbaSha256: hash(data) });
}
const existingBytes = await fs.readFile(path.join(root, 'lib/ui/viewer-companion/hd-motion-sprite.json'));
const existing = JSON.parse(existingBytes);
// Normalize each complete key with one uniform/aspect-preserving transform.
// Matching the existing HD body width and height ceiling avoids shrinking the
// whole new cast to the widest native tumble pose; no body part moves alone.
const targetBodyWidth = Math.round(Math.max(...existing.frames.map(frame => logicalCell - frame.clip[1] - frame.clip[3] - 4)) * ratio);
const targetBodyHeight = Math.round(Math.max(...existing.frames.map(frame => logicalCell - frame.clip[0] - frame.clip[2] - 4)) * ratio);
const derived = [];
for (const original of nativeCells) {
  const desiredScale = Math.min(1, targetBodyWidth / original.body.width, targetBodyHeight / original.body.height);
  const resizedCell = Math.floor(nativeCropCell * desiredScale), scale = resizedCell / nativeCropCell;
  const resized = await sharp(original.data, { raw: { width: nativeCropCell, height: nativeCropCell, channels: 4 } }).resize(resizedCell, resizedCell, { kernel: 'lanczos3' }).raw().toBuffer();
  const body = measure(resized, resizedCell, resizedCell);
  const dx = Math.round(cell / 2 - (body.left + body.right) / 2), dy = foot - body.bottom;
  const data = Buffer.alloc(cell * cell * 4);
  for (let y = 0; y < resizedCell; y++) for (let x = 0; x < resizedCell; x++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < cell && yy < cell) resized.copy(data, (yy * cell + xx) * 4, (y * resizedCell + x) * 4, (y * resizedCell + x + 1) * 4);
  }
  const registered = measure(data, cell, cell);
  if (registered.width > cell * .76 || registered.height > cell * .82 || registered.left < 5 || registered.top < 5 || registered.right > cell - 5 || registered.bottom > cell - 5) throw Error(`HD body footprint/edge failed: ${original.index}`);
  const frame = { x: round((cell / 2 - (registered.left + registered.right) / 2) / ratio), y: round((cell - registered.bottom) / ratio),
    clip: [registered.top / ratio - 2, (cell - registered.right) / ratio - 2, (cell - registered.bottom) / ratio - 2, registered.left / ratio - 2].map(round) };
  if (frame.clip.some(value => value < 0)) throw Error(`Missing protective clip: ${original.index}`);
  derived.push({ data, frame, body: registered, sourceIndex: original.index, resizedCell, uniformScale: scale,
    edgeContact: original.sourceBody.left === 0 || original.sourceBody.top === 0 || original.sourceBody.right === info.width || original.sourceBody.bottom === info.height, rgbaSha256: hash(data) });
}

const atlases = [], frames = [], rows = [], files = [], packets = [];
for (const [packet, action] of definitions.entries()) {
  // Native keys are held/repeated. Cycles use a bounded ping-pong sequence;
  // finite actions retain their final authored key through their last phase.
  const keys = action.loop && action.keys.length > 2 ? [...action.keys, ...action.keys.slice(1, -1).reverse()] : action.keys;
  const selected = Array.from({ length: 16 }, (_, index) => keys[Math.min(keys.length - 1, Math.floor(index / 16 * keys.length))]);
  const inputs = selected.map((index, column) => ({ input: derived[index].data, raw: { width: cell, height: cell, channels: 4 }, left: column % 8 * cell, top: Math.floor(column / 8) * cell }));
  const width = cell * 8, height = cell * 2;
  const rgba = await sharp({ create: { width, height, channels: 4, background: '#0000' } }).composite(inputs).raw().toBuffer();
  const webp = await sharp(rgba, { raw: { width, height, channels: 4 } }).webp(encoding).toBuffer();
  const decoded = await sharp(webp).ensureAlpha().raw().toBuffer();
  for (let index = 3; index < rgba.length; index += 4) if (rgba[index] !== decoded[index]) throw Error(`WebP changed alpha: ${action.row}`);
  const name = `public/companion/hd/victamin-play-${action.row}.webp`;
  atlases.push({ src: name.slice('public'.length), sha256: hash(webp), bytes: webp.length, width, height });
  rows.push(selected.map((_, index) => packet * 16 + index));
  frames.push(...selected.map((index, column) => ({ atlas: packet, index: column, ...derived[index].frame })));
  packets.push({ ...action, nativeIndicesByColumn: selected, atlas: name }); files.push([name, webp]);
}
const metadata = `${JSON.stringify({ version: 1, cell, logicalCell, grid: 8, gridRows: 2, rowOffset: 20, atlases, frames, rows }, null, 2)}\n`;
const bodySummary = frames => ({ minWidth: round(Math.min(...frames.map(frame => logicalCell - frame.clip[1] - frame.clip[3] - 4))), maxWidth: round(Math.max(...frames.map(frame => logicalCell - frame.clip[1] - frame.clip[3] - 4))), minHeight: round(Math.min(...frames.map(frame => logicalCell - frame.clip[0] - frame.clip[2] - 4))), maxHeight: round(Math.max(...frames.map(frame => logicalCell - frame.clip[0] - frame.clip[2] - 4))) });
const receipt = { source, sourceSha256, nativeBytes: native.length, nativeWidth: info.width, nativeHeight: info.height, newlyGeneratedKeys: 36, reusedDerivedFrameSlots: frames.length,
  generationCallsByThisScript: 0, independentArtReviews: 0, ownerVisualApproval: 'NOT_ESTABLISHED_BY_PACKING',
  method: { nativeGrid: 6, nominalNativeCell: 209, nativeCropCell, extraction: '36 complete alpha>160 connected bodies mapped by centre to nominal6x6 indices; common body-centred square crop prevents nominal-grid clipping', resize: 'one uniform/aspect-preserving Lanczos3 transform per complete key; no redraw/denoise/sharpen/rig', targetBodyWidth, targetBodyHeight, scaleRange: [Math.min(...derived.map(item => item.uniformScale)), Math.max(...derived.map(item => item.uniformScale))], existingHdMetadataSha256: hash(existingBytes), physicalCell: cell, logicalCell, physicalFootBaseline: foot, registration: 'largest alpha>160 connected body centre and foot; logical stroke margin2', disconnectedMarks: 'Preserved inside each derived cell; distant material outside the rectangular CSS body clip remains hidden. Source edge contacts are not repaired.' },
  output: { metadata: output, metadataSha256: hash(metadata), rows: definitions.length, rowOffset: 20, derivedSlots: frames.length, atlases, networkBytes: atlases.reduce((sum, atlas) => sum + atlas.bytes, 0), encoding, alphaChangedPixels: 0, logicalBody: bodySummary(frames), existingHdLogicalBody: bodySummary(existing.frames), decodedBytesPerPacket: cell * 8 * cell * 2 * 4 },
  packets, nativeCells: nativeCells.map(withoutPixels), derivedCells: derived.map(withoutPixels) };
files.push([output, metadata], [`${run}/패킹파생기록.json`, `${JSON.stringify(receipt, null, 2)}\n`]);
files.push([`${run}/패킹기록.md`, `# 덤벙놀이 36키포즈 기술 패킹\n\n원본36그림을 보존하고192물리/80논리 셀의 액션 packet12개·파생슬롯192개로 패킹했다.192새 그림/연속원화가 아니다. 새 생성·전문 미술검수·원화 교정은0회이며 이 기록은 사용자 시각 승인이 아니다.\n\n- 원본 SHA256: ${sourceSha256}\n- 각 완전한 키포즈에 한 번의 aspect고정 균일 Lanczos3 축소. 기존 HD의 실제 몸 폭${targetBodyWidth}px/높이상한${targetBodyHeight}px를 기준으로 화면 크기를 정규화하며 squash의 종횡비는 보존한다. 독립 부위 변환·얼굴 이식·노이즈 제거 없음.\n- 생성 원본의 nominal209px 격자선을 넘는 몸은 전체 원본 연결부위 BCR로 추출해 보존한다. 원본에 없는 부위를 복원하지 않는다.\n- 기존 HD/원본/등록 JSON은 변경하지 않는다. 추가 논리행20–31,1536×384 WebP packet12개, 합${receipt.output.networkBytes}B.\n- alpha>160 주연결 몸 중심·foot 등록, CSS clip여백2논리px, 인코딩 alpha변경0. 분리된 부가표시는 패킹의 미술 판정/복원 범위 밖이다.\n- 재현: \`node scripts/prepare-companion-play.mjs --check\`. [상세 수치/recipe/SHA](패킹파생기록.json). 실제92CSS 시각·동작·브라우저 메모리는 별도 렌더 검사 대상이다.\n`]);
if (hash(await fs.readFile(path.join(root, source))) !== sourceSha256) throw Error('Native changed during packing');
for (const [name, bytes] of files) {
  if (check) { if (hash(await fs.readFile(path.join(root, name))) !== hash(bytes)) throw Error(`Reproducibility mismatch: ${name}`); }
  else { await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true }); await fs.writeFile(path.join(root, name), bytes); }
}
if (!check) {
  const preview = '.scratch-pw/companion-068-play-packing'; await fs.mkdir(path.join(root, preview), { recursive: true });
  for (const row of [20, 21, 23, 27]) {
    const packet = packets[row - 20], selected = packet.nativeIndicesByColumn;
    const inputs = selected.map((index, column) => ({ input: derived[index].data, raw: { width: cell, height: cell, channels: 4 }, left: column % 8 * cell, top: Math.floor(column / 8) * cell }));
    const strip = await sharp({ create: { width: cell * 8, height: cell * 2, channels: 4, background: '#eee5d0' } }).composite(inputs).png().toBuffer();
    await sharp(strip).resize(736, 184).png().toFile(path.join(root, `${preview}/row-${row}-at92.png`));
  }
}
console.log(JSON.stringify({ check, sourceSha256, ...receipt.output }));
