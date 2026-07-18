// 태그 색 생성 — 기존 색들과 색조(hue)·무늬가 충분히 다른 연한 파스텔을 만든다.
// 서버(tag-actions)와 클라이언트(TagLegendEditor 드래프트 추가) 양쪽에서 쓰려고 분리했다.
// ("use server"가 아닌 순수 모듈이라 클라이언트에서도 import 가능.)

export type GeneratedColor = {
  key: string;
  name: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
};

type Pat = "plain" | "diag" | "dots" | "grid" | "cross" | "dash";
// 생성에 쓰는 무늬 종류(민무늬 제외).
const DECO_PATS: Pat[] = ["diag", "dots", "grid", "cross", "dash"];

// hex(#rrggbb) → HSL hue(0~360). 파싱 실패 시 null.
function hexToHue(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  return (h + 360) % 360;
}

// 색 key로 무늬 종류를 추정한다(생성색 gen-* 접두사 + 기본색 중 무늬 있는 것).
export function patternOf(key: string): Pat {
  if (key.startsWith("gen-diag-")) return "diag";
  if (key.startsWith("gen-dots-")) return "dots";
  if (key.startsWith("gen-grid-")) return "grid";
  if (key.startsWith("gen-cross-")) return "cross";
  if (key.startsWith("gen-dash-")) return "dash";
  if (key === "indigo" || key === "mint") return "diag";
  if (key === "sky") return "dots";
  return "plain";
}

// 무늬 있는 색인가? 콘텐츠=무늬 색, 방식=단색으로 풀을 가르는 기준.
export function isPatternColor(key: string): boolean {
  return patternOf(key) !== "plain";
}

// 두 hue의 원형 거리(0~180).
function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

function pickFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function hslToHex(h: number, s: number, l: number): string {
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

// 큐레이트 팔레트(Open Color) — 새 태그도 기존 태그와 같은 결의 색을 받게 한다(즉석 HSL이 아니라).
// 콘텐츠는 연한 카드(shade-2 bg + shade-8 글씨 + shade-4 보더), 방식은 점이라 진한 shade-6 bg로.
// 같은 패밀리라도 콘텐츠(연한 카드)와 방식(진한 점)은 명도가 갈려 함께 써도 헷갈리지 않는다.
type Family = {
  hue: number;
  content: { bg: string; text: string; border: string };
  mod: { bg: string; text: string; border: string };
};
// content: 연한 카드(shade-2) + 아주 진한 글씨(대비≥4.5) + shade-4 보더.
// mod: 점/칩이라 진한 shade-8 bg + 흰 글씨(대비 확보). 모두 audit-colors.mjs로 검증된 톤.
const FAMILIES: Family[] = [
  { hue: 131, content: { bg: "#b2f2bb", text: "#14532d", border: "#69db7c" }, mod: { bg: "#2b7a3b", text: "#fff", border: "#14532d" } },
  { hue: 162, content: { bg: "#96f2d7", text: "#075e48", border: "#38d9a9" }, mod: { bg: "#087f5b", text: "#fff", border: "#075e48" } },
  { hue: 187, content: { bg: "#99e9f2", text: "#094a56", border: "#3bc9db" }, mod: { bg: "#0c6170", text: "#fff", border: "#094a56" } },
  { hue: 208, content: { bg: "#a5d8ff", text: "#0f4c81", border: "#4dabf7" }, mod: { bg: "#1864ab", text: "#fff", border: "#0f4c81" } },
  { hue: 226, content: { bg: "#bac8ff", text: "#283a94", border: "#748ffc" }, mod: { bg: "#2c3d9b", text: "#fff", border: "#283a94" } },
  { hue: 255, content: { bg: "#d0bfff", text: "#3a228f", border: "#9775fa" }, mod: { bg: "#6741d9", text: "#fff", border: "#4a2da3" } },
  { hue: 288, content: { bg: "#eebefa", text: "#6b1485", border: "#da77f2" }, mod: { bg: "#9c36b5", text: "#fff", border: "#862e9c" } },
  { hue: 339, content: { bg: "#fcc2d7", text: "#8a1a40", border: "#f783ac" }, mod: { bg: "#a61e4d", text: "#fff", border: "#8a1a40" } },
  { hue: 0, content: { bg: "#ffc9c9", text: "#991b1b", border: "#ff8787" }, mod: { bg: "#c92a2a", text: "#fff", border: "#991b1b" } },
  { hue: 32, content: { bg: "#ffd8a8", text: "#9a3412", border: "#ffa94d" }, mod: { bg: "#c2410c", text: "#fff", border: "#9a3412" } },
  { hue: 47, content: { bg: "#ffec99", text: "#6b4e00", border: "#ffd43b" }, mod: { bg: "#6b4e00", text: "#fff", border: "#5a4100" } },
  { hue: 85, content: { bg: "#d8f5a2", text: "#365314", border: "#a9e34b" }, mod: { bg: "#3f6212", text: "#fff", border: "#365314" } }
];

// 콘텐츠 카드에 쓸 무늬 하나 — 같은 무늬가 몰리지 않게 기존 콘텐츠 색들에서 가장 적게 쓴 무늬를 고른다.
function pickPattern(existing: { key: string }[]): Pat {
  const counts = (p: Pat) =>
    existing.filter((e) => patternOf(e.key ?? "") === p).length;
  const min = Math.min(...DECO_PATS.map(counts));
  const candidates = DECO_PATS.filter((p) => counts(p) === min);
  return pickFrom(candidates);
}

// 기존 팔레트(키 + 배경색)를 받아 겹치지 않는 '랜덤' 새 색을 하나 만든다.
// 항상 무작위 — 추가했다 지우고 다시 추가하면 매번 다른 구분색이 나오게(리세마라). 같은 종류
// (콘텐츠 무늬카드 / 방식 단색점)끼리만 hue 충돌을 본다(둘은 명도가 갈려 같은 hue도 무방).
//  1) 큐레이트 Open Color 패밀리 중 기존과 ≥28° 떨어진(안 겹치는) 것 → 그 중 무작위.
//  2) 패밀리가 다 찼다 → 빈 hue(기존과 가장 먼 상위 40%) 중 무작위로 HSL 생성.
export function generateTagColor(
  existing: { key: string; bgColor: string }[],
  // opts: plain=방식, preferPattern=콘텐츠(기본). 항상 랜덤이므로 random 플래그는 무시(호환용).
  opts?: { plain?: boolean; preferPattern?: boolean; random?: boolean }
): GeneratedColor {
  const wantPlain = Boolean(opts?.plain);
  const sameKind = existing.filter((p) => isPatternColor(p.key) === !wantPlain);
  const usedHues = sameKind
    .map((p) => hexToHue(p.bgColor))
    .filter((h): h is number => h !== null);
  const minSepTo = (h: number) =>
    usedHues.length ? Math.min(...usedHues.map((u) => hueDist(h, u))) : 360;
  const rand = Math.random().toString(36).slice(2, 8);
  const patOf = () =>
    wantPlain ? "plain" : pickPattern(existing.filter((p) => isPatternColor(p.key)));

  // 1) 안 겹치는 큐레이트 패밀리 중 무작위.
  const free = FAMILIES.filter((f) => minSepTo(f.hue) >= 28);
  if (free.length > 0) {
    const f = pickFrom(free);
    const v = wantPlain ? { ...f.mod, text: "#ffffff" } : f.content;
    return { key: `gen-${patOf()}-${rand}`, name: "새 색", bgColor: v.bg, textColor: v.text, borderColor: v.border };
  }
  // 2) 패밀리가 다 찼다 → 빈 hue 중 무작위(가장 먼 상위 40%)로 HSL 생성.
  const grid: { h: number; sep: number }[] = [];
  for (let h = 0; h < 360; h += 4) grid.push({ h, sep: minSepTo(h) });
  grid.sort((a, b) => b.sep - a.sep);
  const hue = pickFrom(grid.slice(0, Math.max(1, Math.ceil(grid.length * 0.4)))).h;
  if (wantPlain) {
    // 방식: 진한 단색 + 흰 글씨.
    return {
      key: `gen-plain-${rand}`,
      name: "새 색",
      bgColor: hslToHex(hue, 68, 45),
      textColor: "#ffffff",
      borderColor: hslToHex(hue, 72, 34)
    };
  }
  // 콘텐츠: 연한 카드 + 진한 동색 글씨 + 무늬.
  const warm = hue >= 32 && hue <= 72;
  return {
    key: `gen-${patOf()}-${rand}`,
    name: "새 색",
    bgColor: hslToHex(hue, 78, warm ? 88 : 86),
    textColor: hslToHex(hue, 62, 30),
    borderColor: hslToHex(hue, 60, 72)
  };
}
