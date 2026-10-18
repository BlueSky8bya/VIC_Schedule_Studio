// Read-only QA: the product's real placement function, source RGBA and CSS
// inverse sampling. Output only scratch contact sheets; no artwork redraw.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import ts from 'typescript';
import sharp from 'sharp';

const root = process.cwd(), output = path.join(root, '.scratch-pw/companion-107');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const nativeRequire = createRequire(import.meta.url), modules = new Map(), moduleSources = new Map();
async function compile(name) {
  const bytes = await fs.readFile(name, 'utf8');
  moduleSources.set(name, bytes);
  return ts.transpileModule(bytes, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
}
const names = ['lib/ui/viewer-companion/accessory.ts', 'lib/ui/viewer-companion/collection-art.ts', 'lib/ui/viewer-companion/sofa-pose.ts', 'lib/ui/viewer-companion/accessory-motion.ts', 'lib/ui/viewer-companion/gifts.ts', 'lib/ui/viewer-companion/collection-texture.ts'];
const compiled = new Map(await Promise.all(names.map(async name => [path.resolve(root, name), await compile(path.resolve(root, name))])));
const anchorPath = path.resolve(root, 'lib/ui/viewer-companion/accessory-anchors.json'), anchorsBytes = await fs.readFile(anchorPath), anchors = JSON.parse(anchorsBytes);
const mouthPath = path.resolve(root, 'lib/ui/viewer-companion/mouth-anchors.json'), mouthBytes = await fs.readFile(mouthPath);
const jsonModules = new Map([[anchorPath, anchors], [mouthPath, JSON.parse(mouthBytes)]]);
function load(name) {
  name = path.resolve(name);
  if (modules.has(name)) return modules.get(name);
  if (jsonModules.has(name)) return jsonModules.get(name);
  const source = compiled.get(name);
  if (!source) throw Error(`Unregistered QA module ${name}`);
  const qaModule = { exports: {} }; modules.set(name, qaModule.exports);
  const require = request => request.startsWith('.') ? load(path.resolve(path.dirname(name), request.endsWith('.json') ? request : `${request}.ts`)) : nativeRequire(request);
  new Function('require', 'exports', 'module', source)(require, qaModule.exports, qaModule);
  return qaModule.exports;
}
const { companionAccessoryPlacement, companionGiftAnchor, createCompanionAccessoryPainter } = load(path.resolve(root, names[0]));
const { projectCompanionSpritePoint } = load(path.resolve(root, names[2]));
const packs = await Promise.all(['hd-motion-sprite', 'play-motion-sprite', 'living-motion-sprite'].map(async name => JSON.parse(await fs.readFile(path.join(root, `lib/ui/viewer-companion/${name}.json`)))));
const metadata = { atlases: [], frames: [] };
for (const pack of packs) { const offset = metadata.atlases.length; metadata.atlases.push(...pack.atlases); metadata.frames.push(...pack.frames.map(frame => ({ ...frame, atlas: frame.atlas + offset }))); }
const sources = new Map(), sourceHashes = new Map();
async function pixels(src) {
  if (!sources.has(src)) {
    const bytes = await fs.readFile(path.join(root, `public${src}`));
    sourceHashes.set(src, hash(bytes)); sources.set(src, await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true }));
  }
  return sources.get(src);
}
const { COMPANION_ACCESSORY_IDS: ids } = load(path.resolve(root, names[4]));
const { sampleCompanionAccessoryMotion, COMPANION_ACCESSORY_MOTION_MS, canStartCompanionAccessoryMotion } = load(path.resolve(root, names[3]));
if (ids.length !== 12 || anchors.frameCount !== 520) throw Error('Expected actual107 twelve-item/520-pose domain');
const critical = [0, 32, 128, 224, 272, 288, 323, 326, 328, 331, 440, 500, 508, 512, 513, 514, 515, 516, 517, 518, 519];
const cell = 192, ratio = 2.4, padding = 24, tile = cell + padding * 2, samples = [];
const makeLayerHost = () => {
  const values = new Map();
  return { hidden: true, values, style: { setProperty(key, value) { values.set(key, value); } } };
};
const layerHosts = { back: makeLayerHost(), front: makeLayerHost(), gift: makeLayerHost() };
const layerPainter = createCompanionAccessoryPainter(layerHosts);
const blank = () => Buffer.alloc(tile * tile * 4);
function over(target, index, source, at) {
  const alpha = source[at + 3] / 255, prior = target[index + 3] / 255, next = alpha + prior * (1 - alpha);
  if (!next) return;
  for (let channel = 0; channel < 3; channel++) target[index + channel] = Math.round((source[at + channel] * alpha + target[index + channel] * prior * (1 - alpha)) / next);
  target[index + 3] = Math.round(next * 255);
}
function wearable(target, placement, selected, artPixels) {
  const { art, width, x, y, rotation } = placement, scale = width * ratio / art.content.width;
  const origin = { x: (x + selected.frame.x) * ratio, y: (y + selected.frame.y) * ratio };
  const cx = art.content.x + art.content.width / 2, cy = art.content.y + art.content.height / 2, angle = rotation * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  for (let yy = 0; yy < tile; yy++) for (let xx = 0; xx < tile; xx++) {
    const dx = xx + .5 - padding - origin.x, dy = yy + .5 - padding - origin.y;
    const u = Math.floor(cx + (dx * cos + dy * sin) / scale), v = Math.floor(cy + (-dx * sin + dy * cos) / scale);
    if (u < 0 || u >= art.width || v < 0 || v >= art.height) continue;
    over(target, (yy * tile + xx) * 4, artPixels.data, ((art.y + v) * artPixels.info.width + art.x + u) * 4);
  }
}
function body(target, selected, packet) {
  const index = selected.index, clip = selected.frame.clip;
  for (let yy = 0; yy < tile; yy++) for (let xx = 0; xx < tile; xx++) {
    const u = Math.floor(xx + .5 - padding - selected.frame.x * ratio), v = Math.floor(yy + .5 - padding - selected.frame.y * ratio);
    if (u < 0 || u >= cell || v < 0 || v >= cell || u < clip[3] * ratio || u >= (80 - clip[1]) * ratio || v < clip[0] * ratio || v >= (80 - clip[2]) * ratio) continue;
    over(target, (yy * tile + xx) * 4, packet.data, ((Math.floor(index / 8) * cell + v) * packet.info.width + index % 8 * cell + u) * 4);
  }
}
// Heuristic candidate masks come from unchanged body pixels and measured
// axes. They flag review work, never certify anatomy or owner approval.
function occlusionCandidates(selected, pose, bodyPixels, frontPixels, id) {
  const angle = pose.face.roll * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const headAngle = pose.head.roll * Math.PI / 180, hc = Math.cos(headAngle), hs = Math.sin(headAngle);
  const eyewear = id === 'sunglasses' || id === 'pixel-sunglasses';
  const counts = { eyes: [0, 0], mouth: [0, 0] }, ears = [[], []];
  for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
    const at = (y * tile + x) * 4;
    if (bodyPixels[at + 3] <= 160) continue;
    const xx = (x + .5 - padding) / ratio - selected.frame.x, yy = (y + .5 - padding) / ratio - selected.frame.y;
    const dx = xx - pose.face.x, dy = yy - pose.face.y, horizontal = dx * cos + dy * sin, vertical = -dx * sin + dy * cos;
    const dark = bodyPixels[at] < 120 && bodyPixels[at + 1] < 100 && bodyPixels[at + 2] < 90;
    const covered = frontPixels[at + 3] > 160 ? 1 : 0;
    if (pose.orientation !== 'back' && dark && Math.abs(horizontal) < pose.face.width * .6 && Math.abs(horizontal) > pose.face.width * .12 && Math.abs(vertical) <= 2.4) { counts.eyes[0]++; counts.eyes[1] += covered; }
    if (pose.orientation !== 'back' && dark && Math.abs(horizontal) <= pose.face.width * .18 && vertical >= 2 && vertical <= 7) { counts.mouth[0]++; counts.mouth[1] += covered; }
    const hx = xx - pose.head.x, hy = yy - pose.head.y, along = hx * hc + hy * hs, up = -hx * hs + hy * hc;
    if (up < -5 && Math.abs(along) < Math.max(18, pose.head.width * 1.6)) ears[along < 0 ? 0 : 1].push({ up, covered });
  }
  const measured = values => values[0] >= 5 ? { sourcePixels: values[0], coveredPixels: values[1], fraction: values[1] / values[0] } : { sourcePixels: values[0], status: 'UNMEASURED_CANDIDATE' };
  const result = { intentionalEyeOcclusion: eyewear, eyes: measured(counts.eyes), mouth: measured(counts.mouth), earTips: ears.map(points => { const end = Math.min(...points.map(point => point.up)); const tip = points.filter(point => point.up <= end + 2); return measured([tip.length, tip.reduce((sum, point) => sum + point.covered, 0)]); }) };
  result.reviewFlags = [...(!eyewear && result.eyes.fraction > .15 ? ['eye-candidate-covered'] : []), ...(result.mouth.fraction > .15 ? ['mouth-candidate-covered'] : []), ...(result.earTips.some(tip => tip.fraction > .5) ? ['ear-tip-candidate-covered'] : [])];
  return result;
}
let allPosePlacements = 0;
for (let physicalIndex = 0; physicalIndex < metadata.frames.length; physicalIndex++) for (const id of ids) {
  const frame = metadata.frames[physicalIndex], selected = { atlas: 'hd', index: frame.index, physicalIndex, src: metadata.atlases[frame.atlas].src, grid: 8, gridRows: 2, frame };
  const placement = companionAccessoryPlacement(selected, id);
  if (!placement || ![placement.x, placement.y, placement.width, placement.rotation].every(Number.isFinite) || placement.width <= 0) throw Error(`Missing/nonfinite actual placement ${id}:${physicalIndex}`);
  if (companionAccessoryPlacement({ ...selected, src: '/unadopted-packet.webp' }, id) !== null) throw Error('Unadopted source accepted');
  allPosePlacements++;
}
const motionSamples = [];
for (const id of ids) {
  if (canStartCompanionAccessoryMotion({ id, stable: true, safe: false, headroom: 300, edgeClearance: 100, energy: 1 })) throw Error('Unsafe motion accepted');
  for (const elapsed of [0, 100, 250, 500, 800, 1100, 1400, 1700, 2000, 2300, COMPANION_ACCESSORY_MOTION_MS]) {
    const sample = sampleCompanionAccessoryMotion(id, elapsed);
    if (![sample.row, sample.frame, sample.bodyLift, sample.bodyLean, sample.squash, ...Object.values(sample.accessory)].every(Number.isFinite)) throw Error('Nonfinite product gesture');
    if (elapsed === COMPANION_ACCESSORY_MOTION_MS && (!sample.done || sample.bodyLift || sample.bodyLean || sample.squash || sample.accessory.lift || sample.accessory.shift || sample.accessory.roll || sample.accessory.scale !== 1)) throw Error('Gesture failed to settle');
    motionSamples.push({ id, elapsed, ...sample });
  }
}

await fs.mkdir(output, { recursive: true });
for (const id of ids) {
  const tiles = [];
  for (const [at, physicalIndex] of critical.entries()) {
    const frame = metadata.frames[physicalIndex], src = metadata.atlases[frame.atlas].src, pose = anchors.frames[physicalIndex];
    const selected = { atlas: 'hd', index: frame.index, physicalIndex, src, grid: 8, gridRows: 2, frame };
    const placement = companionAccessoryPlacement(selected, id);
    if (!placement) throw Error(`Missing actual placement ${id}:${physicalIndex}`);
    layerPainter.paint(selected, id, false);
    const renderedLayers = Object.fromEntries(['back', 'front'].map(name => {
      const host = layerHosts[name], clip = host.values.get('clip-path') ?? 'none';
      if (!host.hidden && clip !== 'none') throw Error(`Unsupported actual painter clip ${clip}`);
      return [name, { visible: !host.hidden, clip }];
    }));
    const art = await pixels(placement.art.src), packet = await pixels(src), rgba = blank();
    if (renderedLayers.back.visible) wearable(rgba, placement, selected, art);
    body(rgba, selected, packet);
    if (renderedLayers.front.visible) wearable(rgba, placement, selected, art);
    const bodyPixels = blank(), frontPixels = blank(); body(bodyPixels, selected, packet); if (renderedLayers.front.visible) wearable(frontPixels, placement, selected, art);
    const occlusion = occlusionCandidates(selected, pose, bodyPixels, frontPixels, id);
    const label = Buffer.from(`<svg width="240" height="24"><text x="5" y="18" font-size="13" fill="#3b3329">${physicalIndex} ${pose.orientation} ${id}</text></svg>`);
    tiles.push({ input: rgba, raw: { width: tile, height: tile, channels: 4 }, left: at % 7 * tile, top: Math.floor(at / 7) * (tile + 24) }, { input: label, left: at % 7 * tile, top: Math.floor(at / 7) * (tile + 24) + tile });
    samples.push({ id, physicalIndex, orientation: pose.orientation, source: src, ...placement, renderedLayers, occlusion, art: { src: placement.art.src, index: placement.art.index, content: placement.art.content } });
  }
  await sharp({ create: { width: tile * 7, height: (tile + 24) * 3, channels: 4, background: '#eee6d7' } }).composite(tiles).png().toFile(path.join(output, `wear-${id}.png`));
}
const host = () => ({ hidden: true, writes: 0, style: { setProperty() { this.owner.writes++; }, owner: undefined } });
const hosts = { back: host(), front: host(), gift: host() };
for (const value of Object.values(hosts)) value.style.owner = value;
const painter = createCompanionAccessoryPainter(hosts), selected = { atlas: 'hd', index: metadata.frames[0].index, physicalIndex: 0, src: metadata.atlases[0].src, grid: 8, gridRows: 2, frame: metadata.frames[0] };
painter.paint(selected, 'sunglasses', true);
const firstWrites = Object.values(hosts).reduce((sum, node) => sum + node.writes, 0);
for (let count = 0; count < 120; count++) painter.paint(selected, 'sunglasses', true);
let repeatedWrites = Object.values(hosts).reduce((sum, node) => sum + node.writes, 0) - firstWrites;
for (const id of ids.slice(1)) { painter.paint(selected, id, true); const before = Object.values(hosts).reduce((sum, node) => sum + node.writes, 0); for (let count = 0; count < 120; count++) painter.paint(selected, id, true); repeatedWrites += Object.values(hosts).reduce((sum, node) => sum + node.writes, 0) - before; }
painter.paint(selected, null, false);
if (repeatedWrites !== 0 || Object.values(hosts).some(node => !node.hidden)) throw Error('Painter repeat/clear cache mismatch');
let maxGiftProjectionError = 0;
for (const physicalIndex of critical) for (const scale of [.5, 1, 1.4]) for (const facing of [-1, 1]) {
  const frame = metadata.frames[physicalIndex], selected = { atlas: 'hd', index: frame.index, physicalIndex, src: metadata.atlases[frame.atlas].src, grid: 8, gridRows: 2, frame };
  const gift = companionGiftAnchor(selected), size = 92, display = { x: 500, y: 600, scale };
  const point = projectCompanionSpritePoint({ size, display, cell: frame, shape: { bob: 1.2, tilt: -13, scaleX: 1.03, scaleY: .96 }, pressure: { x: 2, y: -1, tilt: 4, squash: .03 }, response: { lift: -1, squash: .01 }, facing, sway: { tilt: 11, stretch: .04 }, chew: .005 }, gift);
  if (!point) throw Error('Missing projected gift point');
  const left = (point.x - display.x) / scale + size / 2, top = (point.y - display.y + size / 2) / scale + size / 2;
  const projected = { x: display.x + (left - size / 2) * scale, y: display.y - size / 2 + (top - size / 2) * scale };
  maxGiftProjectionError = Math.max(maxGiftProjectionError, Math.hypot(projected.x - point.x, projected.y - point.y));
}
for (const [src, before] of sourceHashes) if (hash(await fs.readFile(path.join(root, `public${src}`))) !== before) throw Error(`Input changed ${src}`);
if (!(await fs.readFile(anchorPath)).equals(anchorsBytes)) throw Error('Anchor input changed');
if (!(await fs.readFile(mouthPath)).equals(mouthBytes)) throw Error('Mouth anchor input changed');
for (const [name, source] of moduleSources) if (await fs.readFile(name, 'utf8') !== source) throw Error('Product module changed during QA');
await fs.writeFile(path.join(output, 'wearable-qa.json'), `${JSON.stringify({ method: 'Exact product placement and painter visibility/clip; CSS inverse sampling; nearest source RGBA sampling; actual back/body/front layer order; static parent transforms only', limitation: 'No browser pixel comparison, dynamic parent deformation, anatomical certification or owner approval is claimed; candidate overlap flags require visual review and missing masks remain unmeasured', sourcesUnchanged: true, allPosePlacements, motionSamples, candidateMaskMethod: 'Unchanged dark source pixels in measured face-axis ROIs and source-alpha ear extrema; intentionally worn eyewear is exempt from eye-only occlusion', reviewQueue: samples.filter(sample => sample.occlusion.reviewFlags.length).map(sample => ({ id: sample.id, physicalIndex: sample.physicalIndex, flags: sample.occlusion.reviewFlags })), repeatedPainterCssWrites: repeatedWrites, maxGiftProjectionError, productModules: names.map(name => ({ path: name, sha256: hash(Buffer.from(moduleSources.get(path.resolve(root, name)))) })), anchorsSha256: hash(anchorsBytes), mouthAnchorsSha256: hash(mouthBytes), sources: Object.fromEntries(sourceHashes), samples }, null, 2)}\n`);
console.log(JSON.stringify({ sheets: ids.length, posesPerSheet: critical.length, samples: samples.length, allPosePlacements, motionSamples: motionSamples.length, reviewFlags: samples.filter(sample => sample.occlusion.reviewFlags.length).length, repeatedPainterCssWrites: repeatedWrites, maxGiftProjectionError, sourcePixelsUnchanged: true }));
