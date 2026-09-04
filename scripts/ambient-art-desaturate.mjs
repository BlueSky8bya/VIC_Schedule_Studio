// 아트 붉은 기 탈색(2026-09-04) — 붉은 갈색(hue 0~45°/340°~, 채도 .25↑) 픽셀만 채도를 낮추고 hue를 회갈색 쪽으로 민다. 눈(흰·청회색)·
// 초록·투명은 손대지 않는다. 오행 규칙(밝은 바탕에 서는 줄기는 회갈색)을 이미 받은 그림에 적용할 때 쓴다 — 겨울 참나무 줄기가
// 눈밭에서 제일 튀어(hue 8°·채도 .62) 이걸로 hue 15°·채도 .44로 낮췄다(소유자 승인 2026-09-04).
//   node scripts/ambient-art-desaturate.mjs <입력.png> <출력.png> [남길채도=0.45] [목표hue=28]
// 되돌릴 수 있게 원본을 먼저 복사해 둘 것.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");
const [src, dst, amountArg, hueToArg] = process.argv.slice(2);
const amount = Number(amountArg ?? 0.45);
const hueTo = Number(hueToArg ?? 28);

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
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return [h, s, l];
};
const hsl2rgb = (h, s, l) => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
let touched = 0;
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] < 8) continue;
  const [h, s, l] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
  if (s < 0.25 || !(h <= 45 || h >= 340)) continue; // 눈·청회색은 통과
  const k = Math.min(1, (s - 0.25) / 0.35); // 진한 빨강일수록 더 세게
  const ns = s * (1 - (1 - amount) * k);
  const nh = h + (hueTo - (h > 180 ? h - 360 : h)) * 0.55 * k; // 붉은 쪽 → 회갈색 쪽
  const [r, g, b] = hsl2rgb((nh + 360) % 360, ns, l);
  data[i] = r; data[i + 1] = g; data[i + 2] = b;
  touched++;
}
await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
  .png({ compressionLevel: 9, palette: true, quality: 90, effort: 9, dither: 0.6 })
  .toFile(dst);
console.log(`${src} → ${dst}: 손댄 픽셀 ${touched.toLocaleString()} / ${(info.width * info.height).toLocaleString()} (채도 ×${amount}, hue→${hueTo}°)`);
