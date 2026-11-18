// Independent decoded-pixel regression against the immutable running304 eyes.
// No renderer injection, synthetic glyph bitmap, network, app or database.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { createProductReader } from './product-module.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = async name => JSON.parse(await fs.readFile(name, 'utf8'));
const editionPath = 'lib/ui/viewer-companion/appearance-edition.json';
const anchorsPath = 'lib/ui/viewer-companion/expression-anchors-161.json';
const policyPath = 'lib/ui/viewer-companion/appearance-policy.json';
const accessoryAnchorsPath = 'lib/ui/viewer-companion/accessory-anchors.json';
const [edition, anchors, policy] = await Promise.all([editionPath, anchorsPath, policyPath].map(read));
const accessoryAnchors = await read(accessoryAnchorsPath);
const product = createProductReader();
const { companionAppearanceEyes } = product('lib/ui/viewer-companion/appearance.ts');
const { companionFaceLayout } = product('lib/ui/viewer-companion/face-layout.ts');
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replaceAll('-', '');
const out = path.join('.scratch-pw/companion-consistency/eyes/runs', day);
await fs.mkdir(out, { recursive: true });
assert.equal(policy.eye.referencePhysicalIndex, 304, 'The approved immutable running drawing is physical304');
const reference = anchors.frames.find(frame => frame.physicalIndex === 304);
assert(reference, 'Running304 calibration is required');
const referenceSource = anchors.sources[reference.source];
assert.equal(referenceSource.src, policy.eye.referenceSrc);
assert.equal(referenceSource.sha256, policy.eye.referenceSha256);
const referenceBytes = await fs.readFile('public' + referenceSource.src);
assert.equal(hash(referenceBytes), referenceSource.sha256, 'The immutable reference bytes must remain pinned');
const decodedReference = await sharp(referenceBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const scale = 192 / 80;
const failures = [], rows = [], provenance = { [referenceSource.src]: hash(referenceBytes) };
for (const name of [editionPath, anchorsPath, policyPath, accessoryAnchorsPath, 'lib/ui/viewer-companion/expression-painter.ts', 'lib/ui/viewer-companion/appearance.ts', 'lib/ui/viewer-companion/face-layout.ts']) provenance[name] = hash(await fs.readFile(name));

function cellImage(decoded, index) {
  const data = Buffer.alloc(192 * 192 * 4), ox = index % 8 * 192, oy = Math.floor(index / 8) * 192;
  for (let y = 0; y < 192; y++) decoded.data.copy(data, y * 192 * 4, ((oy + y) * decoded.info.width + ox) * 4, ((oy + y) * decoded.info.width + ox + 192) * 4);
  return data;
}

// The closest connected dark component in a local eye corridor excludes the
// mouth, brows, hair/ear outlines and detached marks. Extents are projected
// onto the face axis, so a rolled pose does not masquerade as a larger eye.
function measureEye(data, center, angle) {
  const cx = center[0] * scale, cy = center[1] * scale, radius = 4.8 * scale;
  const left = Math.max(0, Math.floor(cx - radius)), right = Math.min(191, Math.ceil(cx + radius));
  const top = Math.max(0, Math.floor(cy - radius)), bottom = Math.min(191, Math.ceil(cy + radius));
  const seen = new Uint8Array(192 * 192), found = [];
  const dark = at => { const i = at * 4; return data[i + 3] >= 220 && data[i] < 170 && data[i + 1] < 135 && data[i + 2] < 110 && data[i] >= data[i + 1] && data[i + 1] >= data[i + 2]; };
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
    const start = y * 192 + x;
    if (seen[start] || !dark(start)) continue;
    const queue = [start]; seen[start] = 1;
    for (let n = 0; n < queue.length; n++) {
      const px = queue[n] % 192, py = Math.floor(queue[n] / 192);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = px + dx, yy = py + dy, next = yy * 192 + xx;
        if (xx < left || yy < top || xx > right || yy > bottom || seen[next] || !dark(next)) continue;
        seen[next] = 1; queue.push(next);
      }
    }
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity, nearest = Infinity, sumX = 0, sumY = 0;
    for (const at of queue) {
      const px = at % 192 + .5, py = Math.floor(at / 192) + .5, dx = px - cx, dy = py - cy;
      const u = cosine * dx + sine * dy, v = -sine * dx + cosine * dy;
      uMin = Math.min(uMin, u); uMax = Math.max(uMax, u); vMin = Math.min(vMin, v); vMax = Math.max(vMax, v);
      nearest = Math.min(nearest, Math.hypot(dx, dy)); sumX += px; sumY += py;
    }
    // Include the projected square pixel support, not just pixel centres.
    const support = Math.abs(cosine) + Math.abs(sine);
    const fringe = new Set();
    for (const at of queue) {
      const x = at % 192, y = Math.floor(at / 192);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (x + dx >= left && x + dx <= right && y + dy >= top && y + dy <= bottom) fringe.add((y + dy) * 192 + x + dx);
    }
    let contrastMass = 0;
    for (const at of fringe) { const i = at * 4; if (data[i + 3] >= 220 && data[i] < 230 && data[i + 1] < 205 && data[i + 2] < 180 && data[i] >= data[i + 1] && data[i + 1] >= data[i + 2]) contrastMass += Math.max(0, Math.min(1, (240 - data[i + 1]) / 180)); }
    found.push({ pixels: queue.length, area: queue.length / scale ** 2, width: (uMax - uMin + support) / scale, height: (vMax - vMin + support) / scale,
      contrastMass: contrastMass / scale ** 2,
      halfWidth: (uMax - uMin + support) / scale / 2, nearest: nearest / scale,
      centroidDistance: Math.hypot(sumX / queue.length - cx, sumY / queue.length - cy) / scale,
      touchesCorridor: queue.some(at => at % 192 === left || at % 192 === right || Math.floor(at / 192) === top || Math.floor(at / 192) === bottom) });
  }
  found.sort((a, b) => a.centroidDistance - b.centroidDistance || b.pixels - a.pixels);
  return found.find(component => component.pixels >= 8 && component.nearest < 1.5) ?? null;
}

// Two authored tumble keys lack expression anchors. This independent probe
// checks the existing accessory calibration against actual isolated pupils.
function tumbleProbe(data, native) {
  if (![39, 59].includes(native)) return null;
  const seen = new Uint8Array(192 * 192), candidates = [];
  const dark = at => { const i = at * 4; return data[i + 3] >= 220 && data[i] < 170 && data[i + 1] < 135 && data[i + 2] < 110 && data[i] >= data[i + 1] && data[i + 1] >= data[i + 2]; };
  for (let i = 0; i < seen.length; i++) {
    if (seen[i] || !dark(i)) continue;
    const queue = [i]; seen[i] = 1;
    for (let n = 0; n < queue.length; n++) {
      const x = queue[n] % 192, y = Math.floor(queue[n] / 192);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, next = yy * 192 + xx;
        if (xx < 0 || yy < 0 || xx >= 192 || yy >= 192 || seen[next] || !dark(next)) continue;
        seen[next] = 1; queue.push(next);
      }
    }
    const xs = queue.map(at => at % 192 + .5), ys = queue.map(at => Math.floor(at / 192) + .5);
    const width = Math.max(...xs) - Math.min(...xs) + 1, height = Math.max(...ys) - Math.min(...ys) + 1;
    if (queue.length < 40 || queue.length > 300 || width < 8 || height < 8 || width > 26 || height > 26) continue;
    candidates.push({ center: [xs.reduce((sum, x) => sum + x, 0) / queue.length / scale, ys.reduce((sum, y) => sum + y, 0) / queue.length / scale], pixels: queue.length });
  }
  if (candidates.length !== 2) return null;
  candidates.sort((a, b) => native === 39 ? b.center[1] - a.center[1] : a.center[0] - b.center[0]);
  const distance = Math.hypot(candidates[1].center[0] - candidates[0].center[0], candidates[1].center[1] - candidates[0].center[1]);
  if (distance < 8 || distance > 19) return null;
  return { orientation: 'quarter', eyes: candidates, mouth: null, probe: 'audit-only source-pose side ordering:39 orange below yellow;59 orange left of yellow' };
}

const originalCell = cellImage(decodedReference, reference.index);
const referenceAngle = companionFaceLayout(reference).angle;
const referenceWidths = reference.eyes.map(eye => eye.bounds[2] - eye.bounds[0]);
const sharedWidth = Math.max(...referenceWidths), sharedHeight = Math.max(...reference.eyes.map(eye => eye.bounds[3] - eye.bounds[1]));
const referenceMeasures = reference.eyes.map(eye => measureEye(originalCell, eye.center, referenceAngle));
assert(referenceMeasures.every(Boolean), 'Both original running eye components must be measurable');
// Isolate browser decoding, subpixel placement, rotation and clipping. This
// diagnostic is not a waiver for a smaller eye or a visual approval.
const browser = await chromium.launch();
let samplingControl;
try {
  const page = await browser.newPage();
  const samples = await page.evaluate(async ({ encoded, reference, scale, angle }) => {
    const image = new Image(); image.src = 'data:image/webp;base64,' + encoded; await image.decode();
    const result = [];
    for (const mode of ['browser-original', 'crop-identity', 'recentered', 'rotated', 'rotated-clipped']) {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 192;
      const ctx = canvas.getContext('2d');
      if (mode === 'browser-original') ctx.drawImage(image, reference.index % 8 * 192, Math.floor(reference.index / 8) * 192, 192, 192, 0, 0, 192, 192);
      else {
        ctx.fillStyle = '#fff4d3'; ctx.fillRect(0, 0, 192, 192); ctx.scale(scale, scale);
        for (const eye of reference.eyes) {
          const [left, top, right, bottom] = eye.bounds, width = right - left, height = bottom - top;
          const sx = (left - .3) * scale, sy = (top - .65) * scale, sw = (width + .6) * scale, sh = (height + 1.3) * scale;
          ctx.save();
          if (mode === 'crop-identity') ctx.drawImage(image, sx, sy, sw, sh, left - .3, top - .65, width + .6, height + 1.3);
          else {
            ctx.translate(...eye.center);
            if (mode.startsWith('rotated')) ctx.rotate(angle);
            if (mode === 'rotated-clipped') { ctx.beginPath(); ctx.rect(-width / 2 - .3, -height / 2 - .65, width + .6, height + 1.3); ctx.clip(); }
            ctx.drawImage(image, sx, sy, sw, sh, -width / 2 - .3, -height / 2 - .65, width + .6, height + 1.3);
          }
          ctx.restore();
        }
      }
      result.push({ mode, png: canvas.toDataURL().split(',')[1] });
    }
    return result;
  }, { encoded: referenceBytes.toString('base64'), reference, scale, angle: referenceAngle });
  samplingControl = [];
  for (const sample of samples) {
    const bytes = Buffer.from(sample.png, 'base64'), decoded = await sharp(bytes).ensureAlpha().raw().toBuffer();
    const measured = reference.eyes.map(eye => measureEye(decoded, eye.center, referenceAngle));
    samplingControl.push({ mode: sample.mode, eyes: measured });
    await fs.writeFile(path.join(out, 'sampling-' + sample.mode + '.png'), bytes);
  }
} finally { await browser.close(); }
const snapshots = [{ label: 'immutable original304', data: originalCell }];
const coverage = { anchored: anchors.frames.length, measuredFrames: 0, measuredEyes: 0, excludedByState: {}, auditOnlyProbes: [], missingAnchors: [], nativeStates: new Map() };

for (let atlas = 0; atlas < edition.packets.length; atlas++) {
  const packet = edition.packets[atlas], bytes = await fs.readFile('public' + packet.src);
  assert.equal(hash(bytes), packet.sha256, 'Edition packet changed during audit: ' + packet.src);
  provenance[packet.src] = hash(bytes);
  const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let parentDecoded;
  for (const frame of edition.frames.filter(frame => frame.atlas === atlas)) {
    const state = frame.eyeState;
    if (!['open', 'wink-orange', 'wink-yellow'].includes(state)) { coverage.excludedByState[state] = (coverage.excludedByState[state] ?? 0) + 1; continue; }
    const sourcePose = anchors.frames.find(anchor => anchor.physicalIndex === frame.physicalIndex), data = cellImage(decoded, frame.index);
    const accessoryPose = !sourcePose && [39, 59].includes(frame.nativeCell) ? accessoryAnchors.frames.find(anchor => anchor.physicalIndex === frame.physicalIndex) : null;
    const calibration = sourcePose ?? accessoryPose;
    const pose = calibration ? { ...calibration, eyes: companionAppearanceEyes(frame.physicalIndex, calibration.eyes), mouth: sourcePose?.mouth ?? null } : null;
    if (!pose) { coverage.missingAnchors.push({ physicalIndex: frame.physicalIndex, native: frame.nativeCell, state }); continue; }
    if (!sourcePose) {
      // The old calibration describes the immutable source, rather than the
      // restyled glyph's subpixel centroid. Validate it against those bytes.
      if (!parentDecoded) {
        const parentBytes = await fs.readFile('public' + packet.parentSrc);
        assert.equal(hash(parentBytes), packet.parentSha256, 'Special-roll parent source changed');
        provenance[packet.parentSrc] = hash(parentBytes);
        parentDecoded = await sharp(parentBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      }
      const detected = tumbleProbe(cellImage(parentDecoded, frame.index), frame.nativeCell);
      assert(detected, 'Special-roll source must contain exactly two reliable isolated eye components');
      const deviations = accessoryPose.eyes.map(eye => Math.min(...detected.eyes.map(found => Math.hypot(eye.center[0] - found.center[0], eye.center[1] - found.center[1]))));
      assert(deviations.every(value => value < .25), 'Accessory eye anchors must agree with actual decoded eye components');
      coverage.auditOnlyProbes.push({ physicalIndex: frame.physicalIndex, native: frame.nativeCell, probe: 'Existing accessory eye anchors, checked against independently detected immutable-parent components', deviationsLogical: deviations, eyes: pose.eyes });
    }
    const angle = companionFaceLayout(pose).angle;
    coverage.measuredFrames++;
    coverage.nativeStates.set(`${frame.nativeCell}:${state}`, true);
    for (let side = 0; side < 2; side++) {
      if (state === (side === 0 ? 'wink-orange' : 'wink-yellow')) continue;
      const measured = measureEye(data, pose.eyes[side].center, angle), view = pose.orientation === 'quarter' ? referenceWidths[side] / sharedWidth : 1;
      const originalView = referenceWidths[side] / sharedWidth;
      const expected = { width: referenceMeasures[side].width * view / originalView, height: referenceMeasures[side].height, area: referenceMeasures[side].area * view / originalView, contrastMass: referenceMeasures[side].contrastMass * view / originalView };
      const row = { physicalIndex: frame.physicalIndex, native: frame.nativeCell, state, side: side === 0 ? 'orange' : 'yellow', orientation: pose.orientation, rollRemovedRadians: angle, perspectiveWidth: view,
        glyph: { halfWidth: sharedWidth * view / 2, width: sharedWidth * view, height: sharedHeight, rectangleArea: sharedWidth * view * sharedHeight }, measured, expected };
      if (!measured) row.failure = 'No open-eye dark component near the calibrated centre';
      else {
        row.ratios = { width: measured.width / expected.width, height: measured.height / expected.height, area: measured.area / expected.area, contrastMass: measured.contrastMass / expected.contrastMass };
        // One source-pixel quantisation plus rotation/resampling allowance.
        // The former .83 quarter shrink compounds to .69 area and fails.
        if (measured.width < expected.width - .65 || measured.height < expected.height - .65 || row.ratios.area < .8) row.failure = 'Open eye materially smaller than immutable running304 after roll/view correction';
        if (measured.touchesCorridor) row.failure = 'Eye component touches measurement corridor; cannot claim an isolated eye';
      }
      rows.push(row); coverage.measuredEyes++;
      if (row.failure) failures.push(row);
    }
    if ([0, 304, 160, 323, 331].includes(frame.physicalIndex)) snapshots.push({ label: `${frame.physicalIndex} ${state}`, data });
  }
}
assert(rows.some(row => row.physicalIndex === 0), 'Idle0 is included');
assert.equal(rows.filter(row => row.physicalIndex === 304).length, 2, 'Both current running304 eyes are included');
const worst = [...rows.filter(row => row.ratios)].sort((a, b) => a.ratios.area - b.ratios.area).slice(0, 12);
for (const frame of coverage.missingAnchors) failures.push({ ...frame, failure: 'Open-eye pixel audit has no reliable calibration/probe' });
const summary = { scope: 'Actual encoded appearance packets, immutable original running304 reference, connected dark eye ink only. Face roll removed by projection; quarter width normalised to original304 perspective. Closed/squeeze/cry/spiral/back and closed wink sides excluded. No live-app, accessory, animation or GPU performance claim.',
  passed: failures.length === 0, reference: { physicalIndex: 304, source: referenceSource, bounds: reference.eyes.map(eye => eye.bounds), measured: referenceMeasures },
  quantisationAllowance: { extentLogical: .65, minimumAreaRatio: .8 },
  metricDefinition: { darkInk: 'alpha>=220,R<170,G<135,B<110,R>=G>=B; nearest connected component', contrastMass: 'Within a 2px fringe of that component, alpha>=220,R<230,G<205,B<180,R>=G>=B; sum clamp((240-G)/180,0,1)', units: 'logical sprite-plane pixels (192 raster pixels / 80 logical pixels)' },
  samplingControl,
  glyph: { front: [sharedWidth, sharedHeight], quarter: referenceWidths.map(width => [width, sharedHeight]), pettingStrokeGain: policy.eye.pettingStrokeGain },
  coverage: { ...coverage, nativeStates: [...coverage.nativeStates.keys()].sort() }, provenance, failures, worst, rows };
for (const name of [editionPath, anchorsPath, policyPath, accessoryAnchorsPath, 'lib/ui/viewer-companion/expression-painter.ts', 'lib/ui/viewer-companion/appearance.ts', 'lib/ui/viewer-companion/face-layout.ts']) {
  assert.equal(hash(await fs.readFile(name)), provenance[name], 'Audit input changed during measurement: ' + name);
}
await fs.writeFile(path.join(out, 'proof.json'), JSON.stringify(summary, null, 2) + '\n');
await fs.writeFile(path.join(out, 'eyes.tsv'), 'frame\tnative\tstate\tside\tview\tglyphHalfWidth\tinkWidth\tinkHeight\tinkArea\tareaRatio\tfailure\n' + rows.map(row => [row.physicalIndex, row.native, row.state, row.side, row.orientation, row.glyph.halfWidth.toFixed(4), row.measured?.width.toFixed(4) ?? '', row.measured?.height.toFixed(4) ?? '', row.measured?.area.toFixed(4) ?? '', row.ratios?.area.toFixed(4) ?? '', row.failure ?? ''].join('\t')).join('\n') + '\n');
const images = [];
const columns = 3;
for (let i = 0; i < snapshots.length; i++) {
  const left = i % columns * 384, top = Math.floor(i / columns) * 414;
  images.push({ input: await sharp(snapshots[i].data, { raw: { width: 192, height: 192, channels: 4 } }).resize(384, 384, { kernel: 'nearest' }).png().toBuffer(), left, top });
  images.push({ input: Buffer.from(`<svg width="384" height="30"><text x="12" y="22" font-size="18" fill="#49392f">${snapshots[i].label}</text></svg>`), left, top: top + 384 });
}
await sharp({ create: { width: columns * 384, height: Math.ceil(snapshots.length / columns) * 414, channels: 4, background: '#efede8' } }).composite(images).png().toFile(path.join(out, 'decoded-eyes.png'));
console.log(JSON.stringify({ passed: summary.passed, glyph: summary.glyph,
  coverage: { ...summary.coverage, auditOnlyProbes: summary.coverage.auditOnlyProbes.map(probe => ({ frame: probe.physicalIndex, native: probe.native, maximumAnchorDeviation: Math.max(...probe.deviationsLogical) })), nativeStates: summary.coverage.nativeStates.length },
  failures: failures.length, worst: worst.map(row => ({ frame: row.physicalIndex, side: row.side, width: row.measured.width, height: row.measured.height, area: row.measured.area, ratios: row.ratios })), proof: path.join(out, 'proof.json') }, null, 2));
if (failures.length) process.exitCode = 1;
