// 아트 윤곽선 순검정 제거(2026-09-06) — 확정 픽셀 규칙 "outline = a much darker shade of the same hue, **never pure black**"
// (CLAUDE.md)를 이미 납품된 PNG에 적용한다. 라운드 6 검토 A 실측: `tree-oak-*.png`의 최암 픽셀이 rgb 1~9(순검정급)라
// 밝은 지면(언덕 L 77~81) 위에서 그 나무 한 그루만 ΔL −25로 튀고, 대기 원근(원경일수록 옅다)이 뒤집혔다.
//
// 하는 일: 불투명 픽셀 중 **아주 어두운 것**만 (a) 명도를 바닥에서 들어 올리고 (b) 그림의 지배 색조를 입힌다.
// 중간·밝은 톤은 손대지 않으므로 그림의 인상은 그대로다.
//   node scripts/ambient-art-outline.mjs <입력.png> <출력.png> [명도바닥=0.13] [경계=0.28]
// 원본은 먼저 복사해 둘 것(되돌리기).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const [src, dst, floorArg, kneeArg] = process.argv.slice(2);
if (!src || !dst) {
  console.error("사용: node scripts/ambient-art-outline.mjs <입력.png> <출력.png> [명도바닥] [경계]");
  process.exit(1);
}
const FLOOR = Number(floorArg ?? 0.13); // HSL L의 하한(0~1)
const KNEE = Number(kneeArg ?? 0.28); // 이 아래만 건드린다

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
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
};

const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const ch = info.channels;

// ① 지배 색조 — 채도로 가중한 평균(원형 평균). 어두운 픽셀은 hue가 못 미더워서 그림 전체에서 빌려온다.
let sx = 0;
let sy = 0;
for (let i = 0; i < data.length; i += ch) {
  if (data[i + 3] < 200) continue;
  const [h, s, l] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
  if (l < 0.12 || l > 0.9) continue; // 검정·흰색은 색조 표본이 아니다
  const wgt = s;
  sx += Math.cos((h * Math.PI) / 180) * wgt;
  sy += Math.sin((h * Math.PI) / 180) * wgt;
}
const domHue = ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360;

// ② 어두운 픽셀만 들어 올린다 — 바닥 FLOOR, KNEE까지 부드럽게 이어 붙여 계단이 안 생기게.
let touched = 0;
let minBefore = 1;
let minAfter = 1;
for (let i = 0; i < data.length; i += ch) {
  if (data[i + 3] < 8) continue;
  const [h, s, l] = rgb2hsl(data[i], data[i + 1], data[i + 2]);
  minBefore = Math.min(minBefore, l);
  if (l >= KNEE) {
    minAfter = Math.min(minAfter, l);
    continue;
  }
  const t = l / KNEE; // 0(검정) ~ 1(경계)
  const l2 = FLOOR + (KNEE - FLOOR) * t;
  // 색조: 원래 채도가 거의 없으면(순검정) 지배 색조를 입힌다. 채도는 최소 .14를 준다 — "같은 색조의 더 어두운 단계".
  // 붉은 띄(340~40°)는 회갈색 쪽(22°)으로 밀고 채도를 더 조인다 — 밝은 바닥(눈·모래)에 서는 줄기는
  // 회갈색이지 붉은 갈색이 아니다(CLAUDE.md 아트 규칙, 2026-09-04 소유자).
  const hRaw = s < 0.08 ? domHue : h;
  const reddish = hRaw >= 340 || hRaw <= 40;
  const h2 = reddish ? 22 : hRaw;
  const s2 = reddish ? Math.min(Math.max(s, 0.1), 0.16) : Math.max(s, 0.14);
  const [r2, g2, b2] = hsl2rgb(h2, s2, l2);
  data[i] = r2;
  data[i + 1] = g2;
  data[i + 2] = b2;
  minAfter = Math.min(minAfter, l2);
  touched += 1;
}

await sharp(data, { raw: { width: info.width, height: info.height, channels: ch } }).png().toFile(dst);
console.log(
  `${src} → ${dst} · 지배 색조 ${domHue.toFixed(0)}° · 손댄 픽셀 ${touched} · 최저 L ${(minBefore * 100).toFixed(1)} → ${(minAfter * 100).toFixed(1)}`
);
