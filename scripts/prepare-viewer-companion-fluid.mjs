// Engineering derivation only. Preserve both source natives; uniformly resize
// each source with Lanczos3, pad cells and register their primary alpha body.
// Never repaint, denoise, mirror, synthesize frames or erase stray pixels.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = 'art-src/빅타민/동행/작업회차/20261015-살아있는연속동작';
const output = 'public/companion/victamin-fluid.webp';
const metadata = 'lib/ui/viewer-companion/fluid-sprite.json';
const receipt = `${run}/파생기록.json`;
const losslessArchive = `${run}/보존본/최초무손실_272셀.webp`;
// The alpha layer is exact. Only format-level RGB compression is selected;
// source pixels and the first lossless derivation remain archived unchanged.
const encoderOptions = { quality: 90, alphaQuality: 100, smartSubsample: true, effort: 6 };
const grid = 16, gridRows = 17, cell = 80, threshold = 160, margin = 2;
const maximumBody = { width: 55, height: 60 };
const sourceDefinitions = [
  { id: 'fluid', path: `${run}/원본/빅타민_256연속동작.png`, sha256: '96c56a8437d20029020159ace7109dc94ff826cc38cfa4409ccb68ecc6999f68', grid: 16, count: 256, offset: 0 },
  { id: 'clean', path: 'art-src/빅타민/동행/작업회차/20261015-깔끔한키포즈/원본/빅타민_16키포즈.png', sha256: 'd303c111b3671dffe1b7bcd529c900f63c4d54f178c4bbd097ab2f8c8603ef47', grid: 4, count: 16, offset: 256 },
];
const range = (start, length = 16) => Array.from({ length }, (_, index) => start + index);
// Logical clips remain a single explicit recipe. Clip selection can change
// without editing either native or silently changing its pinned source SHA.
const rows = Array.from({ length: 16 }, (_, row) => range(row * 16));
rows[10] = [266];
rows[11] = [267];
rows[12] = [268, ...range(193, 15)];
rows[15] = [271];
rows.push(range(112, 8), range(120, 7));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const round = number => Math.round(number * 1e6) / 1e6;
const absolute = name => path.join(root, name);
const median = values => { const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
if (process.argv.slice(2).some(arg => arg !== '--check')) throw Error('Usage: node scripts/prepare-viewer-companion-fluid.mjs [--check]');
const check = process.argv.includes('--check');

/** Largest8-connected alpha>160 component. Pixel-edge right/bottom exclusive. */
function measureBody(data, width, height) {
  const visited = new Uint8Array(width * height), queue = new Int32Array(width * height);
  let main = null, secondaryPixels = 0;
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] <= threshold) continue;
    let head = 0, tail = 1, left = width, top = height, right = 0, bottom = 0;
    queue[0] = start; visited[start] = 1;
    while (head < tail) {
      const point = queue[head++], x = point % width, y = Math.floor(point / width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!visited[next] && data[next * 4 + 3] > threshold) { visited[next] = 1; queue[tail++] = next; }
      }
    }
    const component = { left, top, right, bottom, width: right - left, height: bottom - top, pixels: tail };
    if (!main || tail > main.pixels) { if (main) secondaryPixels = Math.max(secondaryPixels, main.pixels); main = component; }
    else secondaryPixels = Math.max(secondaryPixels, tail);
  }
  if (!main || main.pixels < 100) throw Error('Missing/sparse main component');
  return { ...main, secondaryPixels };
}

async function readSource(definition) {
  const raw = await fs.readFile(absolute(definition.path));
  if (hash(raw) !== definition.sha256) throw Error(`Preserved${definition.id} native changed`);
  const info = await sharp(raw).metadata();
  if (info.width !== 1254 || info.height !== 1254 || !info.hasAlpha) throw Error(`Expected1254-square RGBA${definition.id} native`);
  const nativeCells = [];
  for (let index = 0; index < definition.count; index++) {
    const column = index % definition.grid, row = Math.floor(index / definition.grid);
    const left = Math.round(column * info.width / definition.grid), top = Math.round(row * info.height / definition.grid);
    const box = { left, top, width: Math.round((column + 1) * info.width / definition.grid) - left, height: Math.round((row + 1) * info.height / definition.grid) - top };
    const rgba = await sharp(raw).extract(box).ensureAlpha().raw().toBuffer();
    const body = measureBody(rgba, box.width, box.height);
    nativeCells.push({ index, nativeBox: box, nativeRgbaSha256: hash(rgba), nativeBody: body,
      nativeBodyTouchesCellEdge: body.left === 0 || body.top === 0 || body.right === box.width || body.bottom === box.height });
  }
  return { definition, raw, info, nativeCells };
}

async function scaleSource(source, targetIdleWidth) {
  const { definition, raw, info, nativeCells } = source;
  // Common scaling preserves pose-specific proportions. The fallback source
  // matches the new source's median idle width, not an independently fitted
  // width for every frame. No upscale is needed for either native.
  let limit = Math.min(1, ...nativeCells.flatMap(item => [
    (cell - 2 * margin) / item.nativeBox.width,
    (cell - 2 * margin) / item.nativeBox.height,
    maximumBody.width / item.nativeBody.width,
    maximumBody.height / item.nativeBody.height,
  ]));
  if (targetIdleWidth !== undefined) limit = Math.min(limit, targetIdleWidth / median(nativeCells.slice(0, 2).map(item => item.nativeBody.width)));
  const initialCell = Math.floor(limit * info.width / definition.grid);
  for (let scaledCell = initialCell; scaledCell >= 1; scaledCell--) {
    const side = scaledCell * definition.grid;
    const scaled = await sharp(raw).resize(side, side, { fit: 'fill', kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
    const prepared = [];
    let valid = true;
    for (const item of nativeCells) {
      const rgba = await sharp(scaled, { raw: { width: side, height: side, channels: 4 } })
        .extract({ left: item.index % definition.grid * scaledCell, top: Math.floor(item.index / definition.grid) * scaledCell, width: scaledCell, height: scaledCell }).raw().toBuffer();
      const padLeft = Math.floor((cell - scaledCell) / 2), padTop = padLeft;
      const png = await sharp(rgba, { raw: { width: scaledCell, height: scaledCell, channels: 4 } })
        .extend({ left: padLeft, right: cell - scaledCell - padLeft, top: padTop, bottom: cell - scaledCell - padTop, background: '#0000' }).png().toBuffer();
      const packedRgba = await sharp(png).ensureAlpha().raw().toBuffer();
      const body = measureBody(packedRgba, cell, cell);
      const clip = [body.top - margin, cell - body.right - margin, cell - body.bottom - margin, body.left - margin];
      if (body.width > maximumBody.width || body.height > maximumBody.height || clip.some(value => value < 0) || clip[0] + clip[2] >= cell || clip[1] + clip[3] >= cell) { valid = false; break; }
      const frame = { x: round(cell / 2 - (body.left + body.right) / 2), y: cell - body.bottom, clip };
      const anchor = { centerX: round((body.left + body.right) / 2 + frame.x), footY: body.bottom + frame.y };
      if (anchor.centerX !== 40 || anchor.footY !== 80) throw Error(`Bad registration${definition.id}:${item.index}`);
      prepared.push({ ...item, index: definition.offset + item.index, sourceId: definition.id, sourceIndex: item.index,
        resized: [scaledCell, scaledCell], padding: [padLeft, padTop], packedPngSha256: hash(png), body, anchor, registration: frame, png });
    }
    if (valid) return { source, scaledCell, scale: side / info.width, resizedSide: side, scaleRoundingRetries: initialCell - scaledCell, prepared };
  }
  throw Error(`No safe shared scale for${definition.id}`);
}

const [fluidSource, cleanSource] = await Promise.all(sourceDefinitions.map(readSource));
const fluid = await scaleSource(fluidSource);
const fluidIdleWidth = median(fluid.prepared.slice(0, 16).map(item => item.body.width));
const clean = await scaleSource(cleanSource, fluidIdleWidth);
const cleanIdleWidth = median(clean.prepared.slice(0, 2).map(item => item.body.width));
if (Math.abs(fluidIdleWidth - cleanIdleWidth) > 2) throw Error(`Fallback idle width mismatch:${fluidIdleWidth}/${cleanIdleWidth}`);
const prepared = [...fluid.prepared, ...clean.prepared];
if (prepared.length !== 272 || rows.length !== 18 || rows.some(row => !row.length || row.some(index => !Number.isInteger(index) || index < 0 || index >= prepared.length))) throw Error('Invalid272-cell/18-logical-row topology');
const composites = prepared.map((item, index) => ({ input: item.png, left: index % grid * cell, top: Math.floor(index / grid) * cell }));
const lossless = await sharp({ create: { width: grid * cell, height: gridRows * cell, channels: 4, background: '#0000' } }).composite(composites).webp({ lossless: true, effort: 6 }).toBuffer();
if (hash(await fs.readFile(absolute(losslessArchive))) !== hash(lossless)) throw Error('The archived first lossless derivation differs');
const derived = await sharp(lossless).webp(encoderOptions).toBuffer();
const [baselineRgba, runtimeRgba] = await Promise.all([sharp(lossless).ensureAlpha().raw().toBuffer(), sharp(derived).ensureAlpha().raw().toBuffer()]);
if (baselineRgba.length !== runtimeRgba.length) throw Error('Encoding changed atlas geometry');
for (let index = 3; index < baselineRgba.length; index += 4) if (baselineRgba[index] !== runtimeRgba[index]) throw Error('Encoding changed alpha/registration geometry');
const table = `${JSON.stringify({ grid, gridRows, frames: prepared.map(item => item.registration), rows }, null, 2)}\n`;
const summaries = [fluid, clean].map(item => ({ ...item.source.definition, bytes: item.source.raw.length, geometry: [item.source.info.width, item.source.info.height],
  resizeKernel: 'lanczos3', uniformScale: item.scale, scaledNativeGeometry: [item.resizedSide, item.resizedSide], scaledCell: item.scaledCell, scaleRoundingRetries: item.scaleRoundingRetries,
  uniqueNativeCellRgbaHashes: new Set(item.source.nativeCells.map(cell => cell.nativeRgbaSha256)).size,
  uniquePackedCellPngHashes: new Set(item.prepared.map(cell => cell.packedPngSha256)).size,
  nativeEdgeContactCells: item.source.nativeCells.filter(cell => cell.nativeBodyTouchesCellEdge).map(cell => cell.index),
}));
const cellRecords = prepared.map(item => Object.fromEntries(Object.entries(item).filter(([key]) => key !== 'png')));
const record = `${JSON.stringify({ sources: summaries, newNativeCells: 256, reusedNativeCells: 16, packedCells: prepared.length,
  output, outputSha256: hash(derived), bytes: derived.length, geometry: [grid * cell, gridRows * cell], grid, gridRows, cell, metadata, metadataSha256: hash(table),
  encoding: { options: encoderOptions, documentation: 'https://sharp.pixelplumbing.com/api-output/#webp', losslessArchive, losslessSha256: hash(lossless), losslessBytes: lossless.length, alphaChangedPixels: 0, rendererGeometryFromLossless: true, comparison: `${run}/인코딩비교.json`, target200to500KBMet: false },
  threshold, connected: 8, clipMarginPixels: margin, maximumBodyUnits: maximumBody,
  actualBodyUnits: { maxWidth: Math.max(...prepared.map(item => item.body.width)), maxHeight: Math.max(...prepared.map(item => item.body.height)) },
  idleBodyWidthUnits: { fluid: fluidIdleWidth, reusedClean: cleanIdleWidth, difference: round(Math.abs(fluidIdleWidth - cleanIdleWidth)) }, rows,
  process: 'One Lanczos3 uniform scale per preserved source; whole-source resizing, fixed cell extraction and transparent80px padding. Preserve first losslessWebP; runtimeWebP RGBquality90/alphaQuality100 keeps every decoded alpha unchanged. Largest alpha>160 connected bbox centre40/foot80. No manual stray-pixel erasure; CSS clips only. No repaint, denoise, mirror or interpolated drawings.272slots are256new native cells plus16reused native cells, not272new drawings.',
  cells: cellRecords, approval: 'Engineering measurements only. Known source edge contacts and selected fallback clips are preserved; no independent art review or owner visual acceptance inferred.' }, null, 2)}\n`;
for (const item of [fluid, clean]) if (hash(await fs.readFile(absolute(item.source.definition.path))) !== item.source.definition.sha256) throw Error('A preserved native changed during derivation');
for (const [name, bytes] of [[output, derived], [metadata, table], [receipt, record]]) {
  if (check) { if (hash(await fs.readFile(absolute(name))) !== hash(bytes)) throw Error(`Reproducibility mismatch:${name}`); }
  else { await fs.mkdir(path.dirname(absolute(name)), { recursive: true }); await fs.writeFile(absolute(name), bytes); }
}
console.log(JSON.stringify({ check, output, outputSha256: hash(derived), bytes: derived.length, geometry: [grid * cell, gridRows * cell], frames: prepared.length, rows: rows.length,
  sources: summaries, idleBodyWidthUnits: { fluid: fluidIdleWidth, reusedClean: cleanIdleWidth }, actualBodyUnits: { maxWidth: Math.max(...prepared.map(item => item.body.width)), maxHeight: Math.max(...prepared.map(item => item.body.height)) } }));
