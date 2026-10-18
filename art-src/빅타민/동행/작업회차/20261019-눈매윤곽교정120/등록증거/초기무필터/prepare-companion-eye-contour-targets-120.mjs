// Source-bound120 derivation only. Eye RGB comes from the already generated119
// proposal; a single new120 provider supplies the cozy contour. No art is drawn
// by this script and no active runtime packet/metadata is written.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const run = 'art-src/빅타민/동행/작업회차/20261019-눈매윤곽교정120';
const fixed = `${run}/고정입력`;
const output = `${run}/정리본`;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const assert = (value, message) => { if (!value) throw Error(message); };
const read = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));

export const eyeContacts120 = Object.freeze({
  1: Object.freeze([[39, 64], [39, 65], [39, 66], [73, 63], [74, 64], [70, 66]]),
  10: Object.freeze([[45, 58], [46, 59], [78, 57], [79, 57], [78, 58]]),
});

// The allowed coordinates are independent specialist findings, not inferred
// from a broad orange mask. Only these existing registered RGB samples change.
export function restoreEyeContacts120(parent, registered, width, height, mouth, nativeCell) {
  assert(Buffer.isBuffer(parent) && Buffer.isBuffer(registered), 'RGBA buffers required');
  assert(parent.length === width * height * 4 && registered.length === parent.length && mouth.length === width * height, 'Eye buffer canvas mismatch');
  const contacts = eyeContacts120[nativeCell];
  assert(contacts, 'Only requested native1/native10 eye contacts are allowed');
  const corrected = Buffer.from(parent), effective = Buffer.alloc(width * height);
  for (const [x, y] of contacts) {
    assert(x >= 0 && x < width && y >= 0 && y < height, 'Eye contact escaped native canvas');
    const point = y * width + x, at = point * 4;
    assert(!mouth[point], 'Actual mouth protection overlaps an eye contact');
    assert(registered[at + 3] > 150 && registered[at] < 150 && registered[at + 1] < 125 && registered[at + 2] < 105, 'Confirmed source eye sample is no longer a dark stroke');
    registered.copy(corrected, at, at, at + 3);
    effective[point] = 255;
  }
  let changedPixels = 0, changedChannels = 0;
  for (let point = 0; point < width * height; point++) {
    const at = point * 4;
    assert(parent[at + 3] === corrected[at + 3], 'Eye alpha changed');
    if (mouth[point]) assert(parent.subarray(at, at + 4).equals(corrected.subarray(at, at + 4)), 'Actual mouth changed');
    if (!parent.subarray(at, at + 4).equals(corrected.subarray(at, at + 4))) {
      assert(effective[point], 'Eye restoration escaped confirmed coordinates');
      changedPixels++;
      for (let channel = 0; channel < 3; channel++) if (parent[at + channel] !== corrected[at + channel]) changedChannels++;
    }
  }
  assert(changedPixels === contacts.length, 'Expected all eleven confirmed missing-contact pixels to be restored');
  return { corrected, effective, changedPixels, changedChannels };
}

// A continuous visual scope may contain already unchanged dark stroke pixels.
// It never expands the set of RGB samples actually adopted by the function above.
function continuousEyeScope(registered, width, height, mouth, nativeCell, effective) {
  const boxes = nativeCell === 10 ? [[35, 44, 62, 67], [61, 44, 90, 67]] : [[30, 50, 58, 74], [58, 50, 84, 74]];
  const mask = Buffer.from(effective), seen = new Uint8Array(width * height);
  const accepts = point => {
    const x = point % width, y = Math.floor(point / width), at = point * 4;
    return !mouth[point] && boxes.some(([l, t, r, b]) => x >= l && x < r && y >= t && y < b) && registered[at + 3] > 150 && registered[at] < 150 && registered[at + 1] < 125 && registered[at + 2] < 105;
  };
  const queue = eyeContacts120[nativeCell].map(([x, y]) => y * width + x);
  for (const point of queue) seen[point] = 1;
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i], x = point % width, y = Math.floor(point / width);
    if (!accepts(point)) continue;
    mask[point] = 255;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
      const next = yy * width + xx;
      if (!seen[next] && accepts(next)) { seen[next] = 1; queue.push(next); }
    }
  }
  return mask;
}

function components(data, width, height, accepts) {
  const seen = new Uint8Array(width * height), result = [];
  for (let seed = 0; seed < seen.length; seed++) {
    if (seen[seed] || !accepts(seed * 4)) continue;
    const queue = [seed]; seen[seed] = 1;
    let left = width, top = height, right = 0, bottom = 0, sx = 0, sy = 0;
    for (let i = 0; i < queue.length; i++) {
      const point = queue[i], x = point % width, y = Math.floor(point / width);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); sx += x + .5; sy += y + .5;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const next = yy * width + xx;
        if (!seen[next] && accepts(next * 4)) { seen[next] = 1; queue.push(next); }
      }
    }
    result.push({ count: queue.length, center: [sx / queue.length, sy / queue.length], box: [left, top, right, bottom] });
  }
  return result;
}

export function measureCozyCheeks120(data, width, height) {
  assert(data.length === width * height * 4, 'Cozy RGBA canvas mismatch');
  const candidates = components(data, width, height, at => data[at + 3] > 150 && data[at] > 200 && data[at + 1] > 85 && data[at + 1] < 195 && data[at] - data[at + 1] > 45 && data[at + 1] - data[at + 2] > 15 && data[at + 2] < 165)
    .filter(part => part.count > width * height * .0008 && part.box[2] - part.box[0] < width * .22 && part.box[3] - part.box[1] < height * .24 && part.center[1] > height * .32 && part.center[1] < height * .88);
  let best;
  for (const a of candidates) for (const b of candidates) {
    if (a.center[0] >= b.center[0]) continue;
    const span = b.center[0] - a.center[0];
    if (span < width * .22 || span > width * .65 || Math.abs(a.center[1] - b.center[1]) > height * .15) continue;
    if ([a, b].some(part => { const ratio = (part.box[2] - part.box[0]) / (part.box[3] - part.box[1]); return ratio < .5 || ratio > 1.9; })) continue;
    const score = Math.abs(a.count - b.count) / Math.max(a.count, b.count) + Math.abs((a.center[0] + b.center[0]) / 2 - width * .55) / width + Math.abs((a.center[1] + b.center[1]) / 2 - height * .64) / height;
    if (!best || score < best.score) best = { score, a, b };
  }
  assert(best, `Uncertain two actual orange cheek components in ${width}x${height}`);
  return [best.a, best.b];
}

export function registerCozy120(data, width, height, targetWidth, targetHeight, sourceCheeks, targetCheeks) {
  const [s0, s1] = sourceCheeks.map(part => part.center), [t0, t1] = targetCheeks.map(part => part.center);
  const sx = s1[0] - s0[0], sy = s1[1] - s0[1], tx = t1[0] - t0[0], ty = t1[1] - t0[1];
  const scale = Math.hypot(tx, ty) / Math.hypot(sx, sy), angle = Math.atan2(ty, tx) - Math.atan2(sy, sx), a = Math.cos(angle) * scale, b = Math.sin(angle) * scale;
  assert(Number.isFinite(scale) && scale > 0 && Number.isFinite(angle), 'Invalid uniform cozy registration');
  const registered = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y++) for (let x = 0; x < targetWidth; x++) {
    const vx = x + .5 - t0[0], vy = y + .5 - t0[1], px = (a * vx + b * vy) / (scale * scale) + s0[0] - .5, py = (-b * vx + a * vy) / (scale * scale) + s0[1] - .5;
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy, at = (y * targetWidth + x) * 4;
    let alpha = 0; const rgb = [0, 0, 0];
    for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
      const xx0 = ix + xx, yy0 = iy + yy;
      if (xx0 < 0 || yy0 < 0 || xx0 >= width || yy0 >= height) continue;
      const q = (yy0 * width + xx0) * 4, gain = (xx ? fx : 1 - fx) * (yy ? fy : 1 - fy), weight = data[q + 3] / 255 * gain;
      alpha += weight;
      for (let channel = 0; channel < 3; channel++) rgb[channel] += data[q + channel] * weight;
    }
    for (let channel = 0; channel < 3; channel++) registered[at + channel] = alpha ? Math.round(rgb[channel] / alpha) : 0;
    registered[at + 3] = Math.round(alpha * 255);
  }
  return { data: registered, transform: { kind: 'uniform_similarity_no_nonuniform_warp', scale, angle, sourceCheeks: sourceCheeks.map(part => part.center), targetCheeks: targetCheeks.map(part => part.center) } };
}

// Fixed native-space mask is the complete adoption boundary. No global alpha
// cleanup or automatic extra-colour replacement is performed.
export function compositeCozy120(parent, registered, width, height, allowed) {
  assert(parent.length === width * height * 4 && registered.length === parent.length && allowed.length === width * height, 'Cozy buffer canvas mismatch');
  const corrected = Buffer.from(parent), effective = Buffer.alloc(width * height);
  let changedPixels = 0, changedChannels = 0, alphaChangedPixels = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const point = y * width + x, at = point * 4;
    if (!allowed[point]) continue;
    assert(y >= 34 && !(x >= 37 && x < 96 && y >= 38 && y < 66), 'Cozy mask includes protected ears/face');
    registered.copy(corrected, at, at, at + 4);
    effective[point] = 255;
    if (!parent.subarray(at, at + 4).equals(corrected.subarray(at, at + 4))) {
      changedPixels++;
      for (let channel = 0; channel < 4; channel++) if (parent[at + channel] !== corrected[at + channel]) changedChannels++;
      if (parent[at + 3] !== corrected[at + 3]) alphaChangedPixels++;
    }
  }
  assert(changedPixels > 0, 'No actual cozy contour delta');
  return { corrected, effective, changedPixels, changedChannels, alphaChangedPixels };
}

async function source(filename, expected, width, height, mask = false) {
  const bytes = await fs.readFile(filename);
  assert(hash(bytes) === expected.toLowerCase(), `Wrong frozen120 source: ${filename}`);
  const decoded = mask ? await sharp(bytes).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true }) : await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert(decoded.info.width === width && decoded.info.height === height && decoded.info.channels === (mask ? 1 : 4), `Wrong120 source canvas: ${filename}`);
  return { bytes, data: decoded.data };
}

async function main() {
  const args = process.argv.slice(2), check = args.includes('--check'), eyesOnly = args.includes('--eyes-only');
  let nativeRaw, rawSha;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--raw') nativeRaw = args[++i];
    else if (args[i] === '--raw-sha') rawSha = args[++i];
    else assert(['--check', '--eyes-only'].includes(args[i]), 'Usage: [--check] [--eyes-only | --raw PATH --raw-sha SHA256]');
  }
  assert(eyesOnly ? !nativeRaw && !rawSha : nativeRaw && /^[0-9a-f]{64}$/i.test(rawSha ?? ''), 'Use eyes-only or bind the single cozy raw path and SHA');
  if (nativeRaw) assert(path.resolve(nativeRaw).startsWith(path.resolve(`${run}/원본`) + path.sep), 'Generated120 raw must be frozen inside this run/원본');
  const facePath = `${run}/검수/얼굴검수결과.json`, scenePath = `${run}/검수/윤곽검수결과.json`;
  for (const [filename, expected] of [[facePath, 'c328581525e03e46d8c57e4429cc62004ffc66523b9b8c6740522b1b9df43834'], [scenePath, '53a8896c0c3f8e431b4a16615e8c644e8cb6aeaa38f923843029dddc68409581']]) assert(hash(await fs.readFile(filename)) === expected, 'Immutable requested120 specialist report changed');
  const face = await read(facePath), scene = await read(scenePath);
  assert(face.status === 'FAIL' && scene.status === 'FAIL', 'Source findings must remain current-parent FAIL, not a new approval');
  const provenance = await read(`${run}/검수/119기존눈등록_재현계보.json`), records = [], pending = [], decodedKeys = [];
  const specs = [
    { native: 10, width: 108, height: 100, offset: [18, 22], parent: `${fixed}/하품_현재119.png`, sha: '7661015edb0d67f298c469b1509ee51faf87090a961654f301e7c890adb1abb2', regSha: '15060d8568f0ca60d9121299280e7ab1c77c66b297b15dbbfd4da757f858c11c', mouthSha: 'dd45c957b94a92b4cbd21fa453371ed6eb223befef4998821040436072804f5b', mouthCount: 80, physical: [266] },
    { native: 1, width: 104, height: 106, offset: [164, 19], parent: `${fixed}/깜빡임_현재119.png`, sha: '0e678a9ac430994ed20c647065763c4943d19ea2463add3cbefacb57a07beecb', regSha: 'd6de4037cf8e1fff3ec58d5cae62173072ccaecc95740f9b025951701d1ef9b2', mouthSha: '4b9c2b1d7e81b62f718db2a7c063a5b81785353b9e77af95ecddad5e8e820423', mouthCount: 17, physical: [9, 10] },
  ];
  for (const spec of specs) {
    const registeredPath = `${fixed}/119등록후_키${spec.native}_마스크전.png`, mouthPath = `${fixed}/키${spec.native}_기존실제입보호.png`;
    const parent = await source(spec.parent, spec.sha, spec.width, spec.height), registered = await source(registeredPath, spec.regSha, spec.width, spec.height), mouth = await source(mouthPath, spec.mouthSha, spec.width, spec.height, true);
    assert(mouth.data.filter(value => value > 0).length === spec.mouthCount, 'Actual-mouth protection bitmap changed');
    const result = restoreEyeContacts120(parent.data, registered.data, spec.width, spec.height, mouth.data, spec.native);
    const continuousMask = continuousEyeScope(registered.data, spec.width, spec.height, mouth.data, spec.native, result.effective);
    const correctedPath = `${output}/빅타민_120_키${spec.native}.png`, maskPath = `${output}/키${spec.native}_실효편집영역.png`, strokeScopePath = `${output}/키${spec.native}_연결눈선범위.png`;
    const correctedPng = await sharp(result.corrected, { raw: { width: spec.width, height: spec.height, channels: 4 } }).png().toBuffer(), maskPng = await sharp(result.effective, { raw: { width: spec.width, height: spec.height, channels: 1 } }).png().toBuffer(), strokeScope = await sharp(continuousMask, { raw: { width: spec.width, height: spec.height, channels: 1 } }).png().toBuffer();
    pending.push([correctedPath, correctedPng], [maskPath, maskPng], [strokeScopePath, strokeScope]);
    records.push({ nativeCell: spec.native, parentPath: spec.parent, parentSha256: hash(parent.bytes), correctedPath, correctedSha256: hash(correctedPng), maskPath, maskSha256: hash(maskPng), width: spec.width, height: spec.height, physicalIndices: spec.physical, sourceChangedPixels: result.changedPixels, sourceChangedChannels: result.changedChannels, sourceAlphaChangedPixels: 0, alphaPreserved: true, protectedMouthPixels: spec.mouthCount, mouthProtection: { path: mouthPath, sha256: spec.mouthSha }, registration: { ...provenance.records.find(record => record.native === spec.native).transform, reused119ExistingRegisteredPixels: true, new120ImagegenCalls: 0 }, registeredSource: { path: registeredPath, sha256: spec.regSha }, adoptedEyeCoordinates: eyeContacts120[spec.native], adoption: 'Direct RGB copy at reviewer-confirmed contact pixels only; current alpha and every other RGBA sample preserved.', continuousExistingStrokeScope: { path: strokeScopePath, sha256: hash(strokeScope), unchangedConnectorsAdopted: false }, outsideEffectiveMaskRgbaIdentical: true });
    decodedKeys.push({ ...spec, data: result.corrected });
  }
  const cozyParent = `${fixed}/포근잠_현재115입력.png`, cozy = await source(cozyParent, 'c1edc19c958adf87370bc2475dbca77abf66ad5fde753a8d773bfc2ede6e8aac', 119, 85);
  if (!eyesOnly) {
    const raw = await fs.readFile(nativeRaw);
    assert(hash(raw) === rawSha.toLowerCase(), 'Wrong single120 generated cozy raw');
    const allowedPath = `${fixed}/포근잠_검수반영_최종편집영역.png`, allowed = await source(allowedPath, 'e7da3152ae778c7d2c6f29dfd6be57bfea8155dc040391bdc80bbfce2bbaf05b', 119, 85, true);
    const provider = await sharp(raw).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const targetCheeks = measureCozyCheeks120(cozy.data, 119, 85), sourceCheeks = measureCozyCheeks120(provider.data, provider.info.width, provider.info.height);
    const registered = registerCozy120(provider.data, provider.info.width, provider.info.height, 119, 85, sourceCheeks, targetCheeks), result = compositeCozy120(cozy.data, registered.data, 119, 85, allowed.data);
    const correctedPath = `${output}/빅타민_120_키78.png`, maskPath = `${output}/키78_실효편집영역.png`, registeredPath = `${output}/포근잠_등록후마스크전.png`;
    const correctedPng = await sharp(result.corrected, { raw: { width: 119, height: 85, channels: 4 } }).png().toBuffer(), maskPng = await sharp(result.effective, { raw: { width: 119, height: 85, channels: 1 } }).png().toBuffer(), registeredPng = await sharp(registered.data, { raw: { width: 119, height: 85, channels: 4 } }).png().toBuffer();
    pending.push([correctedPath, correctedPng], [maskPath, maskPng], [registeredPath, registeredPng]);
    records.push({ nativeCell: 78, parentPath: cozyParent, parentSha256: hash(cozy.bytes), correctedPath, correctedSha256: hash(correctedPng), maskPath, maskSha256: hash(maskPng), width: 119, height: 85, physicalIndices: [519], sourceChangedPixels: result.changedPixels, sourceChangedChannels: result.changedChannels, sourceAlphaChangedPixels: result.alphaChangedPixels, alphaPreserved: result.alphaChangedPixels === 0, registration: registered.transform, registeredSource: { path: registeredPath, sha256: hash(registeredPng) }, rawSource: { path: nativeRaw, sha256: hash(raw) }, adoption: 'New120 cozy pixels inside narrow specialist-bound contour/material mask only; parent ears/complete face retained byte-exact.', outsideEffectiveMaskRgbaIdentical: true, foldedEarsAndFaceRgbaIdentical: true, noGlobalAlphaThresholdOrColorReplacement: true });
    decodedKeys.push({ native: 78, width: 119, height: 85, offset: [300, 29], data: result.corrected });
  } else decodedKeys.push({ native: 78, width: 119, height: 85, offset: [300, 29], data: cozy.data });
  const sheet = Buffer.alloc(432 * 144 * 4);
  for (const key of decodedKeys) for (let y = 0; y < key.height; y++) key.data.copy(sheet, ((key.offset[1] + y) * 432 + key.offset[0]) * 4, y * key.width * 4, (y + 1) * key.width * 4);
  const finalPath = `${output}/${eyesOnly ? '눈복원_포근잠대기120' : '빅타민_눈매윤곽120'}.png`, finalPng = await sharp(sheet, { raw: { width: 432, height: 144, channels: 4 } }).png().toBuffer();
  pending.push([finalPath, finalPng]);
  const receipt = { version: 1, status: eyesOnly ? 'EYES_RESTORED_COZY_PROVIDER_PENDING' : 'SCOPED_DERIVATION_AWAITING_CREATOR_OBSERVATION_AND_USER_FEEDBACK', generationCalls: eyesOnly ? 0 : 1, generationCallsByThisScript: 0, eyeGenerationCalls120: 0, reused119EyeRaw: { path: 'art-src/빅타민/동행/작업회차/20261019-표정체적교정119/원본/표정체적6키_생성원본.png', sha256: 'ec389e3364a77ddb4f6999a8b94087544b9543a731d0b4af04947f84ed638682' }, ...(eyesOnly ? {} : { nativeRaw, rawSha256: rawSha.toLowerCase() }), requestedSpecialistReviews: 2, independentArtReviewsByThisScript: 0, postGenerationArtReviews: 0, ownerApproval: false, requestedReports: [{ path: facePath, sha256: hash(await fs.readFile(facePath)) }, { path: scenePath, sha256: hash(await fs.readFile(scenePath)) }], final: { path: finalPath, sha256: hash(finalPng), width: 432, height: 144, composition: 'Exact RGBA row copies; no alpha compositing or resampling of native crops.' }, keys: records };
  pending.push([`${run}/${eyesOnly ? '눈복원파생기록' : '합성파생기록'}.json`, json(receipt)]);
  // All source validation and calculation completes before any output. Check
  // mode never creates a directory or writes; output stays inside this run.
  for (const [filename, bytes] of pending) {
    assert(path.resolve(filename).startsWith(path.resolve(run) + path.sep), 'Output escaped120 run');
    if (check) assert((await fs.readFile(filename)).equals(bytes), `Derived120 output differs: ${filename}`);
  }
  if (!check) {
    await fs.mkdir(output, { recursive: true });
    for (const [filename, bytes] of pending) await fs.writeFile(filename, bytes);
  }
  console.log(JSON.stringify({ check, eyesOnly, generationCalls: receipt.generationCalls, keys: records.map(record => ({ native: record.nativeCell, changed: record.sourceChangedPixels, alphaChanged: record.sourceAlphaChangedPixels })), final: receipt.final }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
