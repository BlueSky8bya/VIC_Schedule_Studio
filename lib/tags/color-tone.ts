// 태그 커스텀 색 보조 — 톤 프리셋(같은 색조를 파스텔~깊게로) + 대비(가독성) 정보.
// 무늬가 없어진 뒤 카드는 단색이라, 색을 고를 때 '색조는 유지하고 톤만' 바꾸는 프리셋이 편하다.
//
// ── 톤을 '지각 균일' 색공간(OKLCH)에서 정의한다 (Björn Ottosson, 2020 · CSS Color 4 채택) ──
// 왜: HSV/HSL은 지각적으로 불균일하다. 같은 V/L·S라도 색조마다 눈에 보이는 밝기·채도가 크게
// 다르다(노랑 V100은 거의 흰데 파랑 V100은 진하다 — Helmholtz–Kohlrausch, CIELAB L*로 확인됨).
// 그래서 HSV로 톤을 잡으면 '무한한 색상'에서 파스텔이 색조마다 들쭉날쭉했다(노랑 파스텔은 너무
// 밝고 파랑 파스텔은 안 연하고). OKLCH는 L(지각 밝기)·C(채도)·H(색조)를 분리해, L·C를 고정하면
// 모든 색조에서 '지각적으로 같은' 파스텔/부드럽게/선명/깊게가 나온다. 이게 연구적으로 타당한 근거.
//
// 색이론 근거(tint/tone/shade + pure hue)를 OKLCH 좌표로:
//  · 파스텔 = pale tint: 지각 밝기 아주 높고(L↑) 채도 낮게(C↓).           (고정 L·C → 균일한 연함)
//  · 부드럽게 = muted tone: 밝되 채도 중간.
//  · 선명 = pure hue: 그 색조가 낼 수 있는 '최대 채도'(sRGB 가무트 cusp) → 색조별로 가장 쨍한 점.
//  · 깊게 = shade: 지각 밝기 낮고(L↓) 채도는 가무트 한도까지(탁하지 않게 깊게).
// L 고정으로 파스텔>부드럽게>깊게가 모든 색조에서 같은 지각 밝기 단계를 갖는다(선명은 cusp이라 색조별).
export type ToneKey = "pastel" | "soft" | "vivid" | "deep";

export const TONE_PRESETS: { key: ToneKey; label: string }[] = [
  { key: "pastel", label: "파스텔" },
  { key: "soft", label: "부드럽게" },
  { key: "vivid", label: "선명" },
  { key: "deep", label: "깊게" }
];

// 톤별 OKLCH 타깃 — L,C는 OKLab 스케일(L 0~1, C ~0~0.37). seed(미세조정색)의 L·C를 일부 블렌드해
// 반영하되, 톤 정체성이 무너지지 않게 밴드로 클램프한다. vivid는 cusp(최대 채도)라 별도 처리.
type ToneSpec = { L: number; C: number; Lband: [number, number]; Cband: [number, number] };
const TONE_SPEC: Record<Exclude<ToneKey, "vivid">, ToneSpec> = {
  pastel: { L: 0.9, C: 0.055, Lband: [0.86, 0.94], Cband: [0.035, 0.08] },
  soft: { L: 0.8, C: 0.09, Lband: [0.73, 0.86], Cband: [0.055, 0.12] },
  deep: { L: 0.47, C: 0.15, Lband: [0.4, 0.56], Cband: [0.1, 0.4] }
};
// seed 반영 강도 — 채도는 눈에 띄게, 밝기는 톤이 주도하되 살짝(지각 균일성을 크게 흔들지 않게).
const TONE_SEED_L_WEIGHT = 0.2;
const TONE_SEED_C_WEIGHT = 0.38;

function clampNum(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// hex → 색조(hue, 0~360). 무채색이면 0.
export function hexToHue(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return ((h * 60) % 360 + 360) % 360;
}

export function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// ── HSV(색 영역 피커용) — 채도(S)×명도(V) 사각형 + 색조(H) 슬라이더 ──
export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, v: 80 };
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = ((h * 60) % 360 + 360) % 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s: Math.round(s * 100), v: Math.round(max * 100) };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const sN = s / 100;
  const vN = v / 100;
  const c = vN * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vN - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (val: number) =>
    Math.round((val + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// ── OKLab / OKLCH (Ottosson 2020) — 지각 균일 색공간. 톤을 여기서 정의해 색조와 무관하게 균일하게. ──
function srgbChToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgbCh(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}
// 감마 sRGB(0~1) → OKLab {L,a,b}
function linRgbToOklab(r: number, g: number, b: number): { L: number; a: number; b: number } {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  };
}
// OKLab → 선형 sRGB(0~1, 가무트 밖이면 0~1 범위를 벗어난 값이 나온다)
function oklabToLinRgb(L: number, a: number, bb: number): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  ];
}
function hexToOklch(hex: string): { L: number; C: number; h: number } {
  const rgb = hexToRgb(hex) ?? [0, 0, 0];
  const [r, g, b] = rgb.map((v) => srgbChToLinear(v / 255));
  const { L, a, b: bb } = linRgbToOklab(r, g, b);
  return { L, C: Math.hypot(a, bb), h: (Math.atan2(bb, a) * 180) / Math.PI };
}
// 주어진 L,C,h(도)가 sRGB 가무트 안인가.
function oklchInGamut(L: number, C: number, hDeg: number): boolean {
  const hr = (hDeg * Math.PI) / 180;
  const lin = oklabToLinRgb(L, C * Math.cos(hr), C * Math.sin(hr));
  return lin.every((c) => c >= -0.0001 && c <= 1.0001);
}
// L,C,h → hex. 가무트 밖이면 색조·밝기는 유지하고 채도(C)만 이진탐색으로 줄여 안으로 넣는다.
function oklchToHex(L: number, C: number, hDeg: number): string {
  let lo = 0;
  let hi = C;
  if (!oklchInGamut(L, C, hDeg)) {
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (oklchInGamut(L, mid, hDeg)) lo = mid;
      else hi = mid;
    }
    C = lo;
  }
  const hr = (hDeg * Math.PI) / 180;
  const lin = oklabToLinRgb(L, C * Math.cos(hr), C * Math.sin(hr));
  const to = (v: number) =>
    Math.round(clampNum(linearToSrgbCh(clampNum(v, 0, 1)), 0, 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(lin[0])}${to(lin[1])}${to(lin[2])}`;
}
// 주어진 색조·밝기(L)에서 sRGB 가무트가 허용하는 최대 채도(C)를 이진탐색으로 구한다.
function maxChromaAtL(hDeg: number, L: number): number {
  let lo = 0;
  let hi = 0.45;
  for (let i = 0; i < 22; i++) {
    const mid = (lo + hi) / 2;
    if (oklchInGamut(L, mid, hDeg)) lo = mid;
    else hi = mid;
  }
  return lo;
}
// 그 색조가 낼 수 있는 최대 채도점(가무트 cusp) — '선명'이 색조별로 가장 쨍한 점이 되게. L을 훑어
// 각 L의 최대 in-gamut C를 이진탐색으로 구하고, 그중 C가 최대인 (L,C)를 반환.
function oklchCusp(hDeg: number): { L: number; C: number } {
  let best = { L: 0.7, C: 0 };
  for (let L = 0.35; L <= 0.95; L += 0.025) {
    let lo = 0;
    let hi = 0.45;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (oklchInGamut(L, mid, hDeg)) lo = mid;
      else hi = mid;
    }
    if (lo > best.C) best = { L, C: lo };
  }
  return best;
}

// 톤 코어 — seed의 지각밝기(L)·채도(C)와 '적용할 OKLCH 색조'로 톤 hex를 만든다. 파스텔/부드럽게/
// 깊게는 L·C 타깃에 seed L·C를 일부 블렌드 후 밴드+가무트 클램프. 선명은 그 색조의 cusp(최대 채도).
function toneFromOklch(seedL: number, seedC: number, oklchHue: number, tone: ToneKey): string {
  if (tone === "vivid") {
    // 선명 = '그 밝기에서 최대 채도'. 밝기(L)는 seed 쪽으로 당겨 미세조정을 반영하되(밝은 seed→밝은
    // 선명), cusp 근처 밴드로 제한해 너무 연해(파스텔처럼)지거나 너무 어두워지지 않게 한다. 채도는
    // 항상 그 L의 가무트 최대라 늘 가장 쨍하다(vivid 정체성 유지). 예전엔 cusp만 써서 seed와 무관해
    // 미세조정해도 선명이 거의 안 변했다.
    const cusp = oklchCusp(oklchHue);
    const L = clampNum(
      lerp(cusp.L, seedL, 0.55),
      Math.max(0.4, cusp.L - 0.22),
      Math.min(0.92, cusp.L + 0.16)
    );
    return oklchToHex(L, maxChromaAtL(oklchHue, L), oklchHue);
  }
  const spec = TONE_SPEC[tone];
  const L = clampNum(lerp(spec.L, seedL, TONE_SEED_L_WEIGHT), spec.Lband[0], spec.Lband[1]);
  const C = clampNum(lerp(spec.C, seedC, TONE_SEED_C_WEIGHT), spec.Cband[0], spec.Cband[1]);
  return oklchToHex(L, C, oklchHue);
}

// hex 기준 톤 적용(색조는 hex에서 뽑는다).
export function applyTone(hex: string, tone: ToneKey): string {
  const seed = hexToOklch(hex);
  return toneFromOklch(seed.L, seed.C, seed.h, tone);
}

// HSV(피커의 h·s·v) 기준 톤 적용 — 색조는 '슬라이더 h'에서 가져온다. SV 영역의 가장자리(무채색:
// 흰/검/회색)에선 hex에 색조 정보가 사라져(atan2(0,0)=0°=빨강) 슬라이더가 파랑이라도 엉뚱한
// 빨강/노랑 톤이 나왔다. 순수색(h,100,100)의 OKLCH 색조를 써서 무채색에서도 슬라이더 색조를 지킨다.
export function applyToneHsv(h: number, s: number, v: number, tone: ToneKey): string {
  const seed = hexToOklch(hsvToHex(h, s, v)); // L·C(밝기·채도)는 현재 색에서
  const oklchHue = hexToOklch(hsvToHex(h, 100, 100)).h; // 색조는 슬라이더 h(무채색에서도 유지)
  return toneFromOklch(seed.L, seed.C, oklchHue, tone);
}

// ── 기본 색상 18(색 팝오버 트레이 + 새 태그 기본색) ── 색조를 [0,350)으로 18등분(≈19.4°).
// 색환은 0°=360°(빨강)이 겹치므로 겹치는 뒷구간을 빼 처음·끝(빨강↔자주)이 또렷하다. 피커와 새
// 태그 추가가 '같은 18색'을 쓰도록 여기 한 곳에서 만든다(색 팝오버와 TagLegendEditor 공유).
export const SPECTRUM_HUES = Array.from({ length: 18 }, (_, i) => (i * 350) / 18);

// kind별 톤을 render에 맞춘다: 콘텐츠=칸 배경이라 '연하게'(밝은 파스텔), 형식=점이라 '진하게'.
// 형식 톤은 s60/l50 → s72/l58로 상향(2026-07-31, 사용자 피드백 "전체적으로 너무 어두워") —
// 탁기가 빠지고 쨍해지되, 밝은 카드 위 점 대비는 유지되는 범위.
export function spectrumColors(isModifier: boolean): string[] {
  const s = isModifier ? 72 : 72;
  const l = isModifier ? 58 : 82;
  return SPECTRUM_HUES.map((h) => hslToHex(h, s, l));
}

// 색조 원형 거리(0~180). 예: 350°와 10°는 20° 차이로 본다.
export function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

// ── 대비(가독성) — WCAG 2.1 상대휘도. 자동 잉크(흑/백) 기준 AA(4.5:1) 통과 여부. ──
function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function relLuma(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
}
function ratio(a: string, b: string): number {
  const la = relLuma(a);
  const lb = relLuma(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// 배경 hex 위에 자동으로 올릴 글자(흑/백 중 대비 높은 쪽)와 그 대비비·AA 통과 여부.
export function inkContrast(bgHex: string): { ink: "#0a0a0a" | "#ffffff"; ratio: number; passesAA: boolean } {
  const rBlack = ratio(bgHex, "#0a0a0a");
  const rWhite = ratio(bgHex, "#ffffff");
  const useBlack = rBlack >= rWhite;
  const r = useBlack ? rBlack : rWhite;
  return { ink: useBlack ? "#0a0a0a" : "#ffffff", ratio: Math.round(r * 10) / 10, passesAA: r >= 4.5 };
}
