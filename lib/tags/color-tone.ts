// 태그 커스텀 색 보조 — 톤 프리셋(같은 색조를 파스텔~깊게로) + 대비(가독성) 정보.
// 무늬가 없어진 뒤 카드는 단색이라, 색을 고를 때 '색조는 유지하고 톤만' 바꾸는 프리셋이 편하다.
// (HSLuv가 지각적으로 더 균일하지만 의존성 없이 HSL로 충분히 실용적 — 톤 프리셋 용도.)

export type ToneKey = "pastel" | "soft" | "vivid" | "deep";

export const TONE_PRESETS: { key: ToneKey; label: string; s: number; l: number }[] = [
  { key: "pastel", label: "파스텔", s: 70, l: 88 },
  { key: "soft", label: "부드럽게", s: 66, l: 78 },
  { key: "vivid", label: "선명", s: 76, l: 62 },
  { key: "deep", label: "깊게", s: 58, l: 42 }
];

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

// 현재 색의 색조를 유지하며 톤(파스텔~깊게)만 바꾼 hex.
export function applyTone(hex: string, tone: ToneKey): string {
  const p = TONE_PRESETS.find((t) => t.key === tone) ?? TONE_PRESETS[1];
  return hslToHex(hexToHue(hex), p.s, p.l);
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
