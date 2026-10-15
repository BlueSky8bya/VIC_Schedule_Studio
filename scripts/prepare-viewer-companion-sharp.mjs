// Engineering derivation only: format-level RGB encoding and one uniform
// downsample from the preserved keypose native. No repaint/new artwork/upscale.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacyRun = 'art-src/빅타민/동행/작업회차/20261015-살아있는연속동작';
const run = 'art-src/빅타민/동행/작업회차/20261015-큰그림선명도';
const archivePath = `${legacyRun}/보존본/최초무손실_272셀.webp`;
const nativePath = 'art-src/빅타민/동행/작업회차/20261015-깔끔한키포즈/원본/빅타민_16키포즈.png';
const fluidNativePath = `${legacyRun}/원본/빅타민_256연속동작.png`;
const legacyReceiptPath = `${legacyRun}/파생기록.json`;
const previousOutputPath = 'public/companion/victamin-fluid.webp';
const previousMetadataPath = 'lib/ui/viewer-companion/fluid-sprite.json';
const fluidOutput = 'public/companion/vitamin-fluid-q95.webp';
const keyposeOutput = 'public/companion/vitamin-keyposes-2x.webp';
const metadataOutput = 'lib/ui/viewer-companion/keypose-sprite.json';
const encoder = { quality: 95, alphaQuality: 100, smartSubsample: true, effort: 6 };
const pins = new Map([
  [archivePath, 'cb9eb5ac98d41677f687db2e37e8fd90490e71996f1897dba5af2d54bd5799c2'],
  [nativePath, 'd303c111b3671dffe1b7bcd529c900f63c4d54f178c4bbd097ab2f8c8603ef47'],
  [fluidNativePath, '96c56a8437d20029020159ace7109dc94ff826cc38cfa4409ccb68ecc6999f68'],
  [previousOutputPath, '140a2485bd3afbdcd072c6456146ea9b7074d9c71bafe1fbd01241b38aed2ef9'],
]);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const absolute = name => path.join(root, name);
const round = value => Math.round(value * 1e6) / 1e6;
if (process.argv.slice(2).some(arg => arg !== '--check')) throw Error('Usage: node scripts/prepare-viewer-companion-sharp.mjs [--check]');
const check = process.argv.includes('--check');
const preserved = new Map(await Promise.all([...pins.keys(), legacyReceiptPath, previousMetadataPath].map(async name => [name, await fs.readFile(absolute(name))])));
for (const [name, pin] of pins) if (hash(preserved.get(name)) !== pin) throw Error(`Pinned source changed: ${name}`);
const legacyReceipt = JSON.parse(preserved.get(legacyReceiptPath).toString('utf8'));
const cleanRecipe = legacyReceipt.sources.find(source => source.id === 'clean');
if (cleanRecipe?.scaledCell !== 59 || cleanRecipe.uniformScale !== 236 / 1254) throw Error('Expected the preserved 59px keypose recipe');

function measureBody(data, width, height) {
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let main;
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] <= 160) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    queue[0] = start; visited[start] = 1;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!visited[next] && data[next * 4 + 3] > 160) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    if (!main || tail > main.pixels) main = { left, top, right, bottom, width: right - left, height: bottom - top, pixels: tail };
  }
  if (!main || main.pixels < 100) throw Error('Missing/sparse body component');
  return main;
}

async function verifyAlpha(reference, encoded, label) {
  const decoded = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (reference.info.width !== decoded.info.width || reference.info.height !== decoded.info.height || reference.data.length !== decoded.data.length) throw Error(`Geometry changed during ${label} encoding`);
  for (let index = 3; index < reference.data.length; index += 4) if (reference.data[index] !== decoded.data[index]) throw Error(`Alpha changed during ${label} encoding`);
  return { width: decoded.info.width, height: decoded.info.height, decodedRgbaBytes: decoded.data.length, decodedMiB: decoded.data.length / 1048576, alphaChangedPixels: 0 };
}

const archive = preserved.get(archivePath);
const fluidReference = await sharp(archive).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
if (fluidReference.info.width !== 1280 || fluidReference.info.height !== 1360) throw Error('Expected the 272-cell 1280x1360 lossless archive');
const fluid = await sharp(archive).webp(encoder).toBuffer();
const fluidMetrics = await verifyAlpha(fluidReference, fluid, 'fluid Q95');

const native = preserved.get(nativePath);
const nativeInfo = await sharp(native).metadata();
if (nativeInfo.width !== 1254 || nativeInfo.height !== 1254 || !nativeInfo.hasAlpha) throw Error('Expected the 1254-square RGBA keypose native');
const grid = 4, cell = 160, logicalCell = 80, ratio = cell / logicalCell, margin = 2 * ratio;
const side = Math.round(nativeInfo.width * cleanRecipe.uniformScale * ratio);
if (side !== 472 || side > nativeInfo.width || side % grid) throw Error('Keypose derivation must be one native downsample to472x472');
const scaledCell = side / grid, padding = (cell - scaledCell) / 2;
const scaled = await sharp(native).resize(side, side, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
const frames = [], records = [], composites = [];
for (let index = 0; index < grid * grid; index++) {
  const column = index % grid, row = Math.floor(index / grid);
  const nativeBox = { left: Math.round(column * nativeInfo.width / grid), top: Math.round(row * nativeInfo.height / grid), width: Math.round((column + 1) * nativeInfo.width / grid) - Math.round(column * nativeInfo.width / grid), height: Math.round((row + 1) * nativeInfo.height / grid) - Math.round(row * nativeInfo.height / grid) };
  const nativeRgba = await sharp(native).extract(nativeBox).ensureAlpha().raw().toBuffer();
  const nativeBody = measureBody(nativeRgba, nativeBox.width, nativeBox.height);
  const png = await sharp(scaled, { raw: { width: side, height: side, channels: 4 } })
    .extract({ left: column * scaledCell, top: row * scaledCell, width: scaledCell, height: scaledCell })
    .extend({ left: padding, right: padding, top: padding, bottom: padding, background: '#0000' }).png().toBuffer();
  const rgba = await sharp(png).ensureAlpha().raw().toBuffer();
  const body = measureBody(rgba, cell, cell);
  const frame = { x: round((cell / 2 - (body.left + body.right) / 2) / ratio), y: (cell - body.bottom) / ratio,
    clip: [body.top - margin, cell - body.right - margin, cell - body.bottom - margin, body.left - margin].map(value => value / ratio) };
  if (frame.clip.some(value => value < 0) || frame.clip[0] + frame.clip[2] >= logicalCell || frame.clip[1] + frame.clip[3] >= logicalCell) throw Error(`Invalid protective clip: ${index}`);
  const anchor = { centerX: (body.left + body.right) / 2 / ratio + frame.x, footY: body.bottom / ratio + frame.y };
  if (anchor.centerX !== 40 || anchor.footY !== 80) throw Error(`Bad logical registration: ${index}`);
  frames.push(frame);
  records.push({ index, nativeBox, nativeRgbaSha256: hash(nativeRgba), nativeBody, nativeEdgeContact: nativeBody.left === 0 || nativeBody.top === 0 || nativeBody.right === nativeBox.width || nativeBody.bottom === nativeBox.height,
    packedPngSha256: hash(png), body, bodyLogical: { width: body.width / ratio, height: body.height / ratio }, anchor, registration: frame });
  composites.push({ input: png, left: column * cell, top: row * cell });
}
const keyposeReference = await sharp({ create: { width: cell * grid, height: cell * grid, channels: 4, background: '#0000' } }).composite(composites).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const keyposes = await sharp(keyposeReference.data, { raw: { width: keyposeReference.info.width, height: keyposeReference.info.height, channels: 4 } }).webp(encoder).toBuffer();
const keyposeMetrics = await verifyAlpha(keyposeReference, keyposes, 'keypose2x');
if (new Set(records.map(record => record.nativeRgbaSha256)).size !== 16) throw Error('Expected16 distinct preserved native cells');
const metadata = `${JSON.stringify({ grid, cell, logicalCell, frames }, null, 2)}\n`;
const outputSummary = (name, bytes, metrics) => ({ path: name, sha256: hash(bytes), bytes: bytes.length, ...metrics });
const record = {
  purpose: 'Engineering derivatives of preserved artwork only. No new generation, repaint, retouch, denoise, mirrored drawings or source overwrite. Measurements are not owner visual acceptance.',
  sources: [...pins].map(([name, sha256]) => ({ path: name, sha256, bytes: preserved.get(name).length })),
  recipe: { path: legacyReceiptPath, sha256: hash(preserved.get(legacyReceiptPath)), preservedUniformScale: cleanRecipe.uniformScale, multipliedDensity: ratio,
    nativeGeometry: [nativeInfo.width, nativeInfo.height], sourceScaledGeometry: [side, side], sourceUniformScale: side / nativeInfo.width, upscale: false, resizePasses: 1, resizeKernel: 'lanczos3', scaledCell, packedCell: cell, logicalCell, padding, grid, threshold: 160, connected: 8, clipMarginLogical: 2 },
  encoding: { options: encoder, documentation: 'https://sharp.pixelplumbing.com/api-output/#webp', sharp: sharp.versions.sharp, vips: sharp.versions.vips, webp: sharp.versions.webp },
  outputs: [outputSummary(fluidOutput, fluid, fluidMetrics), outputSummary(keyposeOutput, keyposes, keyposeMetrics)],
  metadata: { path: metadataOutput, sha256: hash(metadata), frames: frames.length },
  textureBudget: { existingFluidRgbaBytes: fluidMetrics.decodedRgbaBytes, addedKeyposeRgbaBytes: keyposeMetrics.decodedRgbaBytes, combinedRgbaBytes: fluidMetrics.decodedRgbaBytes + keyposeMetrics.decodedRgbaBytes, addedMiB: keyposeMetrics.decodedMiB, combinedMiB: fluidMetrics.decodedMiB + keyposeMetrics.decodedMiB },
  limitations: 'The16-keypose native has313/314px cells and is downsampled once to118px before160px padding. The256-fluid source remains78/79px per native cell; Q95 changes RGB compression only and creates no additional detail or frames. Original edge contacts and CSS clipping remain explicit.',
  cells: records,
};
const receipt = `${JSON.stringify(record, null, 2)}\n`;
const readme = `# 큰 그림 선명도 · 파생 기록\n\n2026-10-15 KST. PLAN-050의 기존 원본 재사용. 새 원화·AI 생성·시각 승인 교체가 아니다.\n\n- 기존 무손실272셀 archive를 Q95/alpha100으로 인코딩한 별도 파일: \`${fluidOutput}\` (${fluid.length.toLocaleString('en-US')}B). 기존 runtime/receipt는 보존한다.\n- 기존16키포즈 native를 전체472×472로 한 번 Lanczos3 다운샘플하고118px 셀을160px로 투명 패딩: \`${keyposeOutput}\` (${keyposes.length.toLocaleString('en-US')}B). 원본1254²보다 작으며 업스케일/재그림이 아니다.\n- 등록은 largest8-connected alpha>160 몸의 중심40/발80, clip여백2인80 논리단위다. 새 메타: \`${metadataOutput}\`. 두 인코딩 모두 decoded alpha변경0을 검사한다.\n- 추가 decoded RGBA는1,638,400B(1.5625MiB), 두 atlas 합8.203125MiB. GPU/mipmap/브라우저 중복 버퍼 비용의 실측치는 아니다. OFF 때 로드하지 않는 연결은 renderer가 책임진다.\n- fluid256 원본은 셀78~79px라 압축 완화만으로 고해상도 디테일이 생기지 않는다. native가 잘린 셀·CSSclip과16개의 서로 다른 정지 포즈라는 한계는 보존한다.\n\n원본 경로·SHA·크기·각 셀 측정과 파생 SHA는 [파생기록](파생기록.json)에 있다. 기존 source bytes는 읽기 전용이다.\n\n재현: \`node scripts/prepare-viewer-companion-sharp.mjs --check\`.\n`;
for (const [name, before] of preserved) if (hash(await fs.readFile(absolute(name))) !== hash(before)) throw Error(`A preserved input changed: ${name}`);
for (const [name, bytes] of [[fluidOutput, fluid], [keyposeOutput, keyposes], [metadataOutput, metadata], [`${run}/파생기록.json`, receipt], [`${run}/README.md`, readme]]) {
  if (check) { if (hash(await fs.readFile(absolute(name))) !== hash(bytes)) throw Error(`Reproducibility mismatch: ${name}`); }
  else { await fs.mkdir(path.dirname(absolute(name)), { recursive: true }); await fs.writeFile(absolute(name), bytes); }
}
console.log(JSON.stringify({ check, inputsUnchanged: true, outputs: record.outputs, textureBudget: record.textureBudget, metadata: record.metadata, sourceScaledGeometry: [side, side], sourceUniformScale: side / nativeInfo.width, maxAnchorErrorLogical: 0 }));
