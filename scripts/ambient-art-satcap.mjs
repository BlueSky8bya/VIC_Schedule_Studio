// 아트 채도 압축(2026-09-06 라운드 8, 검토 A) — **한 세트로 보이게** 채도의 위쪽만 눌러 준다.
// 봄 참나무가 최대 채도 .92 · 픽셀 57%가 .35 초과로 같은 자리 여름(.59 / 28.7%)·가을(.55 / 16.1%)·겨울(.35 / 6.6%)과
// 다른 세계였다(오행: 밝은 원색 금지). 무릎 knee 아래는 손대지 않고 위쪽만 비율 k로 눌러 계조는 유지한다.
//   node scripts/ambient-art-satcap.mjs <파일.png> [knee=0.30] [k=0.45]
// 파일을 제자리에서 바꾼다 — git으로 되돌릴 수 있을 때만 쓸 것.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const [src, kneeArg, kArg] = process.argv.slice(2);
const knee = Number(kneeArg ?? 0.3);
const k = Number(kArg ?? 0.45);
if (!src) {
  console.error("usage: node scripts/ambient-art-satcap.mjs <파일.png> [knee] [k]");
  process.exit(1);
}
const rgb2hsl = (r, g, b) => {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  const l = (mx + mn) / 2;
  return [h, d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)), l];
};
const hsl2rgb = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const t = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return t.map((v) => Math.round((v + m) * 255));
};
const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let touched = 0;
let maxBefore = 0;
let maxAfter = 0;
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] < 8) continue;
  const [h, s, l] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
  if (s > maxBefore) maxBefore = s;
  const s2 = s <= knee ? s : knee + (s - knee) * k;
  if (s2 > maxAfter) maxAfter = s2;
  if (s2 === s) continue;
  const [r2, g2, b2] = hsl2rgb(h, s2, l);
  data[i] = r2; data[i + 1] = g2; data[i + 2] = b2;
  touched++;
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(src + ".tmp");
const fs = await import("node:fs");
fs.renameSync(src + ".tmp", src);
console.log(`${src}: touched ${touched}px · maxSat ${maxBefore.toFixed(2)} → ${maxAfter.toFixed(2)}`);
