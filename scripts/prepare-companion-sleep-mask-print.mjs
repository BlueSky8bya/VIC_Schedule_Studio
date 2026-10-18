// User-requested literal original-eye print on an accessory, never a body
// eye transplant or generated reconstruction. Source screenshot is read-only.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
const folder = 'art-src/빅타민/동행/작업회차/20261018-수면안대115';
const source = `${folder}/고정입력/토리님정면_REF001.png`;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const expected = '4ef27d4b570013701f34d7db0e55628b29defc1b8cd548ecbfb6bb9d76f3f87e';
const input = await fs.readFile(source);
if (sha(input) !== expected) throw Error('Read-only REF001 input changed');
const crop = { left: 284, top: 410, width: 416, height: 126 };
// Integer native coordinates observed directly on REF001. One common print
// projection keeps both source eyes together; only outside-eye alpha changes.
const polygons = [
  [[7,60],[17,45],[32,35],[55,28],[83,27],[109,31],[132,37],[150,48],[161,69],[145,73],[142,97],[120,108],[86,117],[52,119],[25,108],[11,88]],
  [[250,43],[266,27],[286,17],[314,11],[340,10],[366,15],[386,22],[403,39],[407,63],[394,85],[372,96],[345,101],[316,99],[291,92],[272,80],[264,59]],
];
const nativeCrop = await sharp(input).extract(crop).ensureAlpha().raw().toBuffer();
const mask = Buffer.from(`<svg width="416" height="126">${polygons.map(points => `<polygon points="${points.map(point => point.join(',')).join(' ')}" fill="white"/>`).join('')}</svg>`);
const alpha = await sharp(mask).ensureAlpha().raw().toBuffer();
const clipped = Buffer.from(nativeCrop);
for (let pixel = 0; pixel < crop.width * crop.height; pixel++) clipped[pixel * 4 + 3] = alpha[pixel * 4 + 3];
const nativePng = await sharp(nativeCrop, { raw: { width: crop.width, height: crop.height, channels: 4 } }).png().toBuffer();
const print = await sharp(clipped, { raw: { width: crop.width, height: crop.height, channels: 4 } }).png().toBuffer();
const decoded = await sharp(print).ensureAlpha().raw().toBuffer();
for (let offset = 0; offset < decoded.length; offset += 4) for (let rgb = 0; rgb < 3; rgb++) if (decoded[offset + rgb] !== nativeCrop[offset + rgb]) throw Error('Original eye RGB was changed');
const receipt = { version: 1, purpose: 'Literal eye print on an opaque sleep-mask accessory; never editing the companion body eyes', user: '빅토리 레퍼런스 정면 사진에서 그대로 따오면 될듯', source: { id: 'REF-001', path: source, sha256: expected, original: 'G:/내 드라이브/01_TMP/VIC/일러스트/AI/레퍼런스/02_헤어스타일/01_만두머리/01_정면·작은번/11511791191662240.png', readOnly: true }, crop, alphaPolygons: polygons, projection: { irisCentersNative: [[383, 492], [596, 478]], commonRotationDegrees: 3.760057, targetIrisSpan: 48, scale: 48 / Math.hypot(213, 14), sourceMidpointInCrop: [205.5, 75], targetMidpoint: [64, 64], uniformScale: true }, nativeCrop: { path: `${folder}/원본/REF001_양눈_기계크롭.png`, sha256: sha(nativePng) }, print: { path: `${folder}/정리본/토리님_눈프린트_RGBA.png`, sha256: sha(print), width: crop.width, height: crop.height, sourceRgbPreserved: true }, imagegenCalls: 0, bodyArtworkChanged: false, ownerVisualApproval: 'NOT_ESTABLISHED' };
const outputs = [[receipt.nativeCrop.path, nativePng], [receipt.print.path, print], [`${folder}/원본프린트_출처기록.json`, Buffer.from(JSON.stringify(receipt, null, 2) + '\n')]];
for (const [file, bytes] of outputs) {
  if (process.argv.includes('--check')) { if (!(await fs.readFile(file)).equals(bytes)) throw Error(`Original print derivative differs: ${file}`); }
  else { await fs.mkdir(file.slice(0, file.lastIndexOf('/')), { recursive: true }); await fs.writeFile(file, bytes); }
}
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Prepared'} REF001 literal accessory print; source RGB preserved; imagegen0`);
