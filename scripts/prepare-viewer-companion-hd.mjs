// Offline mechanical animation, not new hand-drawn frames or neural upscaling.
// Every RGB sample comes from a pinned native high-resolution key pose. The
// small continuous sheet supplies bounded motion measurements only.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = 'art-src/빅타민/동행/작업회차/20261015-전동작고해상도';
const definitions = [
  { id: 'clean', path: 'art-src/빅타민/동행/작업회차/20261015-깔끔한키포즈/원본/빅타민_16키포즈.png', sha256: 'd303c111b3671dffe1b7bcd529c900f63c4d54f178c4bbd097ab2f8c8603ef47', grid: 4 },
  { id: 'phase', path: 'art-src/빅타민/동행/작업회차/20261015-살아있는연속동작/원본/빅타민_256연속동작.png', sha256: '96c56a8437d20029020159ace7109dc94ff826cc38cfa4409ccb68ecc6999f68', grid: 16 },
  { id: 'mood', path: `${run}/원본/빅타민_실망삐짐_16키포즈.png`, sha256: '5c4d081baefcf66c2ec8255d214c447b345aafa098eeac4c78a6dabfea0fddc7', grid: 4 },
];
const output = 'lib/ui/viewer-companion/hd-motion-sprite.json';
const physicalCell = 192, logicalCell = 80, ratio = physicalCell / logicalCell;
const textureScale = .54, maximumWidth = physicalCell * .76, maximumHeight = physicalCell * .82;
const options = { quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const round = v => Math.round(v * 1e6) / 1e6;
const smooth = v => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const range = (start, count = 16) => Array.from({ length: count }, (_, i) => start + i);
const check = process.argv.includes('--check');
if (process.argv.slice(2).some(arg => arg !== '--check')) throw Error('Usage: node scripts/prepare-viewer-companion-hd.mjs [--check]');

/** Largest alpha>160 component; bounds are exclusive pixel edges. */
function measure(data, width, height, includeFace = false) {
  const seen = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let largest;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3] <= 160) continue;
    let head = 0, tail = 1, left = width, right = 0, top = height, bottom = 0;
    seen[start] = 1; queue[0] = start;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!seen[next] && data[next * 4 + 3] > 160) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    if (!largest || tail > largest.pixels) largest = { left, right, top, bottom, width: right - left, height: bottom - top, pixels: tail };
  }
  if (!largest || largest.pixels < 60) throw Error('Missing main body');
  // Ear centres are independent first moments in the upper40% of the body.
  const center = (largest.left + largest.right) / 2, ceiling = largest.top + largest.height * .4;
  const ears = [{ n: 0, x: 0, y: 0 }, { n: 0, x: 0, y: 0 }];
  for (let y = largest.top; y < ceiling; y++) for (let x = largest.left; x < largest.right; x++) if (data[(y * width + x) * 4 + 3] > 160) {
    const ear = ears[x < center ? 0 : 1]; ear.n++; ear.x += x; ear.y += y;
  }
  return { ...largest, ears: ears.map(ear => ear.n ? { x: (ear.x / ear.n - center) / largest.width, y: (ear.y / ear.n - largest.top) / largest.height } : { x: 0, y: .2 }),
    ...(includeFace ? { face: measureFace(data, width, height, largest) } : {}) };
}

/** Small dark connected features locate the existing eyes/mouth as a group.
 * Their coordinates are registration evidence only: no feature is cut out,
 * painted, mirrored, separately transformed or substituted. A wide protected
 * rectangle includes the orange cheeks around the measured dark features. */
function measureFace(data, width, height, body) {
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height), parts = [];
  const matches = index => data[index * 4 + 3] > 200 && data[index * 4] < 150 && data[index * 4 + 1] < 115 && data[index * 4 + 2] < 105;
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || !matches(start)) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    visited[start] = 1; queue[0] = start;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!visited[next] && matches(next)) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    if (tail > 5 && right - left < body.width * .24 && bottom - top < body.height * .22 && left > body.left && right < body.right && top > body.top + body.height * .35 && bottom < body.top + body.height * .88) parts.push({ left, top, right, bottom, pixels: tail });
  }
  if (parts.length < 2) throw Error('Cannot register existing eye/mouth group');
  const dominant = [...parts].sort((a, b) => b.pixels - a.pixels)[0];
  const centerY = (dominant.top + dominant.bottom) / 2;
  const features = parts.filter(part => Math.abs((part.top + part.bottom) / 2 - centerY) < body.height * .15);
  if (features.length < 2) throw Error('Missing grouped face registration');
  const featureBounds = { left: Math.min(...features.map(p => p.left)), top: Math.min(...features.map(p => p.top)), right: Math.max(...features.map(p => p.right)), bottom: Math.max(...features.map(p => p.bottom)) };
  return { features, featureBounds,
    protected: { left: featureBounds.left - body.width * .10, right: featureBounds.right + body.width * .10, top: featureBounds.top - body.height * .055, bottom: featureBounds.bottom + body.height * .055 },
    fadeNativePixels: body.height * .035, protection: 'One rigid eyes/mouth/cheek region centred on actual native dark-feature components, not an assumed body-centred face.' };
}

async function source(definition) {
  const bytes = await fs.readFile(path.join(root, definition.path));
  if (hash(bytes) !== definition.sha256) throw Error(`Pinned original changed: ${definition.path}`);
  const info = await sharp(bytes).metadata();
  if (info.width !== 1254 || info.height !== 1254 || !info.hasAlpha) throw Error(`Unexpected native dimensions: ${definition.id}`);
  const cells = [];
  for (let index = 0; index < definition.grid ** 2; index++) {
    const left = Math.round(index % definition.grid * info.width / definition.grid), top = Math.round(Math.floor(index / definition.grid) * info.height / definition.grid);
    const box = { left, top, width: Math.round((index % definition.grid + 1) * info.width / definition.grid) - left, height: Math.round((Math.floor(index / definition.grid) + 1) * info.height / definition.grid) - top };
    const data = await sharp(bytes).extract(box).ensureAlpha().raw().toBuffer();
    cells.push({ data, width: box.width, height: box.height, box, body: measure(data, box.width, box.height, definition.id !== 'phase'), sha256: hash(data) });
  }
  return { ...definition, bytes, cells, width: info.width, height: info.height };
}

const [clean, phaseSource, mood] = await Promise.all(definitions.map(source));
const phaseRows = Array.from({ length: 16 }, (_, row) => {
  const cells = phaseSource.cells.slice(row * 16, row * 16 + 16);
  return { width: median(cells.map(c => c.body.width)), height: median(cells.map(c => c.body.height)), ears: [0, 1].map(i => ({ x: median(cells.map(c => c.body.ears[i].x)), y: median(cells.map(c => c.body.ears[i].y)) })) };
});
const cleanByRow = [0, 0, 2, 4, 5, 6, 7, 12, 8, 9, 10, 11, 12, 13, 14, 15];

function recipe(index) {
  const row = Math.floor(index / 16), column = index % 16, angle = column / 16 * Math.PI * 2;
  let sourceId = 'clean', sourceIndex = row < 16 ? cleanByRow[row] : column;
  let sx = 1, sy = 1, tilt = 0, sway = 0;
  const ear = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  if (row < 16) {
    const measured = phaseSource.cells[index].body, base = phaseRows[row];
    // Bounded measurements retain each authored phase without reproducing the
    // low-resolution sheet's pixel noise, translation or accidental size jumps.
    sx = 1 + clamp(measured.width / base.width - 1, -.25, .25) * .12;
    sy = 1 + clamp(measured.height / base.height - 1, -.25, .25) * .14;
    sway = Math.sin(angle) * (row === 2 ? 1.4 : .45);
    tilt = Math.sin(angle) * (row === 2 ? .026 : row === 8 ? .035 : .009);
    sy += Math.cos(angle * (row === 2 ? 2 : 1)) * (row === 2 ? .018 : .006);
    for (let side = 0; side < 2; side++) {
      ear[side].x = clamp((measured.ears[side].x - base.ears[side].x) * 60, -2, 2) + Math.sin(angle + side * .8) * (row === 8 ? 2.2 : .9);
      ear[side].y = clamp((measured.ears[side].y - base.ears[side].y) * 45, -1.5, 1.5) + Math.cos(angle + side) * .7;
    }
    // Clean blink and a distinct second walking key retain real expression and
    // paper-layer changes. Only contiguous half-cycles change texture; there
    // is no cross-fade or facial mixing/double-eye interpolation.
    if (row === 0 && (column === 9 || column === 10)) sourceIndex = 1;
    if (row === 2 && column >= 8) sourceIndex = 3;
    if (row === 7 && column >= 8) sourceIndex = 0;
  } else if (row >= 17) {
    sourceId = 'mood';
    const key = column / 15 * 7;
    // Eight newly drawn mood keys, with two mechanically animated samples per
    // key. Texture switches are explicit new drawings, never invented detail.
    sourceIndex = (row - 17) * 8 + Math.round(key);
    sy = 1 + Math.sin(column / 15 * Math.PI) * -.012;
    tilt = Math.sin(column / 15 * Math.PI) * (row === 18 ? -.012 : .006);
    ear[0].y = Math.sin(angle) * .45; ear[1].y = Math.sin(angle + .5) * .45;
  }
  const selected = (sourceId === 'clean' ? clean : mood).cells[sourceIndex];
  // All source bodies exceed140 genuine native pixels. Density checks below
  // use the actual body, not the192px transparent packing cell.
  sx = Math.min(sx, (maximumWidth - 5) / (selected.body.width * textureScale));
  sy = Math.min(sy, (maximumHeight - 5) / (selected.body.height * textureScale));
  return { sourceId, sourceIndex, sx, sy, tilt, sway, ears: ear, measuredPhase: row < 16 ? index : null, originalNativeBody: selected.body };
}

/** One inverse sample of the original highres texture. Ear handles have a
 * compact smooth influence; the central face/cheek region is rigid as a whole.
 * This is a bounded 2D free-form rig, not optical flow or ARAP certification. */
function bake(cell, rig) {
  const output = Buffer.alloc(physicalCell * physicalCell * 4), body = cell.body;
  const sourceCX = (body.left + body.right) / 2, sourceBottom = body.bottom;
  const face = body.face.protected, faceFade = body.face.fadeNativePixels;
  const featureBounds = body.face.featureBounds;
  const faceProtection = { sampledPixels: 0, minimumRigidWeight: 1, maximumFeatureDeviationNativePixels: 0 };
  const cosine = Math.cos(rig.tilt), sine = Math.sin(rig.tilt);
  const highWidth = cell.width, highHeight = cell.height;
  for (let y = 0; y < physicalCell; y++) for (let x = 0; x < physicalCell; x++) {
    const dx = x + .5 - physicalCell / 2 - rig.sway, dy = y + .5 - 180;
    let ux = (cosine * dx + sine * dy) / rig.sx, uy = (-sine * dx + cosine * dy) / rig.sy;
    // The inverse rig works in HD output units, then reads native pixels once.
    const normalizedY = (uy / textureScale + sourceBottom - body.top) / body.height;
    const upper = 1 - smooth((normalizedY - .25) / .25);
    const leftWeight = 1 - smooth((ux + 12) / 24), rightWeight = 1 - leftWeight;
    ux -= upper * (rig.ears[0].x * leftWeight + rig.ears[1].x * rightWeight);
    uy -= upper * (rig.ears[0].y * leftWeight + rig.ears[1].y * rightWeight);
    let px = ux / textureScale + sourceCX - .5, py = uy / textureScale + sourceBottom - .5;
    // Preserve all face and cheek pixels under one common rigid transform.
    // Only surrounding paper/ears deform; eyes are never independently moved.
    const rigidFace = (1 - smooth((face.left - px) / faceFade)) * (1 - smooth((px - face.right) / faceFade)) * (1 - smooth((face.top - py) / faceFade)) * (1 - smooth((py - face.bottom) / faceFade));
    const rx = (cosine * dx + sine * dy) / textureScale + sourceCX - .5;
    const ry = (-sine * dx + cosine * dy) / textureScale + sourceBottom - .5;
    if (rigidFace > 0) {
      px += (rx - px) * rigidFace; py += (ry - py) * rigidFace;
    }
    if (rx >= featureBounds.left && rx < featureBounds.right && ry >= featureBounds.top && ry < featureBounds.bottom) {
      faceProtection.sampledPixels++;
      faceProtection.minimumRigidWeight = Math.min(faceProtection.minimumRigidWeight, rigidFace);
      faceProtection.maximumFeatureDeviationNativePixels = Math.max(faceProtection.maximumFeatureDeviationNativePixels, Math.abs(px - rx), Math.abs(py - ry));
    }
    // A rectangular component crop protects the entire artwork plus native
    // edge antialiasing. No hand-painted erasure or colour replacements.
    if (px < body.left - 4 || px > body.right + 4 || py < body.top - 4 || py > body.bottom + 4 || px < 0 || py < 0 || px >= highWidth - 1 || py >= highHeight - 1) continue;
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    const offsets = [(iy * highWidth + ix) * 4, (iy * highWidth + ix + 1) * 4, ((iy + 1) * highWidth + ix) * 4, ((iy + 1) * highWidth + ix + 1) * 4];
    const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
    let alpha = 0; const rgb = [0, 0, 0];
    for (let n = 0; n < 4; n++) {
      const a = cell.data[offsets[n] + 3] / 255 * weights[n]; alpha += a;
      for (let channel = 0; channel < 3; channel++) rgb[channel] += cell.data[offsets[n] + channel] * a;
    }
    const to = (y * physicalCell + x) * 4;
    if (alpha > 0) { for (let channel = 0; channel < 3; channel++) output[to + channel] = Math.round(rgb[channel] / alpha); output[to + 3] = Math.round(alpha * 255); }
  }
  if (!faceProtection.sampledPixels || faceProtection.minimumRigidWeight !== 1 || faceProtection.maximumFeatureDeviationNativePixels > 1e-10) throw Error('Existing eye/mouth region left the rigid protection');
  return { data: output, faceProtection };
}

const rawFrames = [], frames = [], records = [];
for (let index = 0; index < 304; index++) {
  const rig = recipe(index), native = (rig.sourceId === 'clean' ? clean : mood).cells[rig.sourceIndex];
  if (native.body.width < 140) throw Error(`Insufficient genuine native body detail: ${index}`);
  const { data, faceProtection } = bake(native, rig), body = measure(data, physicalCell, physicalCell);
  if (body.width > maximumWidth || body.height > maximumHeight) throw Error(`Rig exceeded footprint: ${index},${body.width}x${body.height}`);
  if (body.left < 5 || body.top < 5 || body.right > physicalCell - 5 || body.bottom > physicalCell - 5) throw Error(`Rig clipped at frame edge: ${index}`);
  const frame = { atlas: Math.floor(index / 16), index: index % 16, x: round((physicalCell / 2 - (body.left + body.right) / 2) / ratio), y: round((physicalCell - body.bottom) / ratio),
    clip: [body.top / ratio - 2, (physicalCell - body.right) / ratio - 2, (physicalCell - body.bottom) / ratio - 2, body.left / ratio - 2].map(round) };
  if (frame.clip.some(value => value < 0)) throw Error(`Unprotected clip: ${index}`);
  rawFrames.push(data); frames.push(frame);
  records.push({ index, texture: { sourceId: rig.sourceId, sourceIndex: rig.sourceIndex, nativeBox: native.box, nativeRgbaSha256: native.sha256, genuineNativeBodyWidth: native.body.width, genuineNativeBodyHeight: native.body.height, nativeFace: native.body.face,
    edgeContact: native.body.left === 0 || native.body.top === 0 || native.body.right === native.width || native.body.bottom === native.height }, rig: { ...rig, originalNativeBody: undefined }, body, rgbaSha256: hash(data),
    registration: frame, faceProtection, densityAt92Dpr2: round(physicalCell / (92 * 2)), logicalBodyWidth: round(body.width / ratio) });
}

const legacyRows = JSON.parse(await fs.readFile(path.join(root, 'lib/ui/viewer-companion/fluid-sprite.json'), 'utf8')).rows;
const rows = [...legacyRows, range(272), range(288)];
const atlases = [], files = [];
for (let atlas = 0; atlas < 19; atlas++) {
  const width = physicalCell * 8, height = physicalCell * 2;
  const inputs = rawFrames.slice(atlas * 16, atlas * 16 + 16).map((data, index) => ({ input: data, raw: { width: physicalCell, height: physicalCell, channels: 4 }, left: index % 8 * physicalCell, top: Math.floor(index / 8) * physicalCell }));
  const raw = await sharp({ create: { width, height, channels: 4, background: '#0000' } }).composite(inputs).raw().toBuffer();
  const webp = await sharp(raw, { raw: { width, height, channels: 4 } }).webp(options).toBuffer();
  const decoded = await sharp(webp).ensureAlpha().raw().toBuffer();
  for (let i = 3; i < raw.length; i += 4) if (raw[i] !== decoded[i]) throw Error(`WebP alpha changed: ${atlas}`);
  const name = `public/companion/hd/victamin-action-${String(atlas).padStart(2, '0')}.webp`;
  atlases.push({ src: name.slice('public'.length), sha256: hash(webp), bytes: webp.length, width, height }); files.push([name, webp]);
}
const metadata = `${JSON.stringify({ version: 1, cell: physicalCell, logicalCell, grid: 8, gridRows: 2, atlases, frames, rows }, null, 2)}\n`;
const record = { purpose: 'All304 runtime frame slots are procedurally rendered from pinned genuine high-resolution textures. Not304 new hand-drawn frames, not neural upscaling and not an approved art replacement.',
  sources: definitions.map(d => ({ ...d, bytes: (d.id === 'clean' ? clean : d.id === 'phase' ? phaseSource : mood).bytes.length })),
  designReferences: [ { id: 'REF-016', sha256: 'f2b29fbb9d09efb4156a7fa23eb9a43fc59f950fe372e6bd3e1d408f9cefada4' }, { id: 'REF-017', sha256: 'f7680ae6be7c38498a4c08eb2746d7329c714b018c47caf2c71c2eae4a0baa e5'.replaceAll(' ', '') } ],
  generation: { calls: 1, nativeMoodKeyposes: 16, originalDesignReferencesOnly: true, generatedSha256: mood.sha256, status: 'DRAFT_DELIVERED_FOR_USER_REVIEW', approval: 'NONE', independentReviews: 0,
    privateCycle: 'VICTAMIN-COMPANION-HD-20261015/cycle_8437C0F20F3065B96F82', userCapture: 'PLAN-20261015-052-latest-user.json', userCaptureSha256: '10439afc6c772d8a453ed9d36f5b3c6b9818739f05df608f5bdb1776c8c40ce5' },
  method: { type: 'bounded inverse free-form 2D mechanical rig', textureScale, resizeSamplingPasses: 1, premultipliedAlphaBilinear: true, faceCheekRigidProtection: true, rgbFromLowResolutionPhaseSource: false, independentEyeWarp: false, generatedNewLimbs: false,
    measuredInputs: 'Per-frame original256 alpha bbox and upper ear centroids, bounded relative to each action median. Original16 high-resolution action textures supply every colour sample; new16 mood drawings supply emotion texture keys.',
    temporalLimits: 'Continuous mechanical deformation between explicit high-resolution texture keys. No crossfade/double eyes. Different key drawings remain discrete, and old256 RGB/expression details are not exactly reconstructed.' },
  output: { metadata: output, metadataSha256: hash(metadata), frames: frames.length, logicalRows: rows.length, atlases, encoding: options, alphaChangedPixelsDuringEncoding: 0, sourceBytesUnchanged: true,
    physicalCell, logicalCell, maximumBodyWidth: Math.max(...records.map(r => r.body.width)), minimumGenuineNativeBodyWidth: Math.min(...records.map(r => r.texture.genuineNativeBodyWidth)), maximumDimension: physicalCell * 8,
    decodedBytesPerStrip: physicalCell * 8 * physicalCell * 2 * 4, threeStripWorkingSetMiB: physicalCell * 8 * physicalCell * 2 * 4 * 3 / 1048576,
    totalNetworkBytes: atlases.reduce((n, a) => n + a.bytes, 0), allNineteenDecodedMiB: physicalCell * 8 * physicalCell * 2 * 4 * 19 / 1048576,
    cacheLimitScope: 'Three strongly-held decoded Image objects is a renderer target; browser image decode/texture caches, CSS-backed resources and transition buffers can exceed this and need runtime observation.' },
  limitations: ['No new hand-drawn continuous304-frame animation. Every frame is a deterministic native-texture rig derivative.', 'Original16 texture source has pre-existing edge contacts in poses4/7/10/11; no missing source anatomy is painted back.', 'The new mood sheet has uneven native key spacing and a small surprise accent in one key; connected-body rectangular crop/registration does not certify visual approval.', 'The RGBA original files are byte-preserved. Only offline derived assets are rasterized; no remote inference/runtime network API.'], cells: records };
files.push([output, metadata], [`${run}/파생기록.json`, `${JSON.stringify(record, null, 2)}\n`]);
const readme = `# 전 동작 고해상도 · 기계적 파생\n\nPLAN052. 기존 원본과 이전 공개 파일은 보존한다. 새로운 감정 원화는 원본 REF016/017만 입력으로 builtin imagegen 한 번 생성한16키포즈이며 사용자 시각 승인은 아직 없다.\n\n- 기존 고해상도16키포즈의 실제 몸 폭243–265px와 새 감정 원화를 텍스처로 쓴다. 작은256셀 원본은 움직임 폭·높이·귀 중심의 측정값만 제공하며 RGB를 확대하지 않는다.\n-304런타임 슬롯/20논리 행을 오프라인 유한2D rig로 생성했다. 이는304새 손그림이나 원본256그림의 정확한 복원이 아니다. 얼굴·볼은 함께 rigid 변환하고 귀와 주변 종이층만 제한된 연속 변형한다. 서로 다른 키 그림의 표현은 이산 전환한다.\n-192물리/80논리 셀,1536×384 액션 strip19개. strip별2.25MiB RGBA, 현재/다음/이전3개 목표6.75MiB;19개 모두 디코드하면42.75MiB. 브라우저 캐시/GPU 중복은 이 수치 밖이다. 네트워크 합${record.output.totalNetworkBytes}B.\n-원본 alpha1 RGB 점의 검은/흰 프리뷰는 불투명 찌꺼기라고 단정하지 않는다. alpha>160 주연결 몸 등록, 논리 clip여백2, 인코딩 alpha변경0. 원본에 이미 닿은 경계와 새 감정 키의 작은 부가 표시를 새 해부학으로 복원/삭제하지 않는다.\n\n재현: \`node scripts/prepare-viewer-companion-hd.mjs --check\`. 원본 SHA·샘플링·프레임별 텍스처/rig/등록/밀도·한계는 [파생기록](파생기록.json). 최종92CSS·DPR2 시각/브라우저 메모리/실제 기기 검증은 별도이며 이 스크립트가 승인하지 않는다.\n`;
files.push([`${run}/README.md`, readme]);
for (const d of definitions) if (hash(await fs.readFile(path.join(root, d.path))) !== d.sha256) throw Error(`Original changed during bake: ${d.id}`);
for (const [name, bytes] of files) {
  if (check) { if (hash(await fs.readFile(path.join(root, name))) !== hash(bytes)) throw Error(`Reproducibility mismatch: ${name}`); }
  else { await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true }); await fs.writeFile(path.join(root, name), bytes); }
}
if (!check) {
  await fs.mkdir(path.join(root, '.scratch-pw/hd052'), { recursive: true });
  for (const row of [0, 2, 4, 8, 9, 11, 17, 18]) {
    const input = rawFrames.slice(row * 16, row * 16 + 16).map((data, i) => ({ input: data, raw: { width: physicalCell, height: physicalCell, channels: 4 }, left: i % 8 * physicalCell, top: Math.floor(i / 8) * physicalCell }));
    await sharp({ create: { width: physicalCell * 8, height: physicalCell * 2, channels: 4, background: '#303039' } }).composite(input).png().toFile(path.join(root, `.scratch-pw/hd052/row-${row}.png`));
  }
}
console.log(JSON.stringify({ check, ...record.output, metadataSha256: hash(metadata), sourceBytesUnchanged: true }));
