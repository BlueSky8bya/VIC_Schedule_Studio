// 글꼴·글씨 굵기(2026-10-06 소유자: 후보 19개 중 동글·주아·개구·나눔손글씨 펜만 빼고 전부) — 기기에 남는 화면 설정.
// 진실의 원천은 localStorage. 적용은 <html style="--app-font: …; --cal-weight: …">: body가 --app-font를 쓰고,
// 일정 카드 글자 굵기(--evt-weight, lib/calendar/month.ts)에 --cal-weight를 더한다.
// 글꼴 파일은 고른 것만 내려받는다 — @font-face(app/fonts.css)와 next/font(app/layout.tsx, preload: false)는
// 선언만 있고, 브라우저는 그 글꼴로 실제 글자를 그릴 때 받는다. 페인트 전 적용은 app/layout.tsx 스크립트가
// 아래 FONT_STACKS를 그대로 받아 한다(처음 열 때 글꼴이 한 번 바뀌어 튀지 않게).

const FONT_KEY = "vic.font";
const WEIGHT_KEY = "vic.calWeight";

export type FontKind = "고딕" | "둥근" | "명조" | "손글씨";
export type FontOption = { id: string; label: string; kind: FontKind; stack: string };

const FALLBACK = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", Arial, sans-serif';

/** 순서 = 설정 창 순서. 'base'는 지금까지의 글꼴(--app-font를 비운다). var(--font-*)는 next/font 변수(app/layout.tsx). */
export const FONT_OPTIONS: FontOption[] = [
  { id: "base", label: "기본", kind: "고딕", stack: "" },
  { id: "noto", label: "본고딕", kind: "고딕", stack: `var(--font-noto), ${FALLBACK}` },
  { id: "nanumgothic", label: "나눔고딕", kind: "고딕", stack: `var(--font-nanumgothic), ${FALLBACK}` },
  { id: "plex", label: "IBM Plex", kind: "고딕", stack: `var(--font-plex), ${FALLBACK}` },
  { id: "gowun", label: "고운돋움", kind: "고딕", stack: `var(--font-gowun), ${FALLBACK}` },
  { id: "nsround", label: "나눔스퀘어라운드", kind: "둥근", stack: `"VIC NanumSquareRound", ${FALLBACK}` },
  { id: "tmoney", label: "티머니 둥근바람", kind: "둥근", stack: `"VIC TmoneyRoundWind", ${FALLBACK}` },
  { id: "binggrae", label: "빙그레체", kind: "둥근", stack: `"VIC Binggrae", ${FALLBACK}` },
  { id: "cookierun", label: "쿠키런체", kind: "둥근", stack: `"VIC CookieRun", ${FALLBACK}` },
  { id: "maple", label: "메이플스토리체", kind: "둥근", stack: `"VIC Maplestory", ${FALLBACK}` },
  { id: "cafe24air", label: "카페24 써라운드 에어", kind: "둥근", stack: `"VIC Cafe24SsurroundAir", ${FALLBACK}` },
  { id: "sunflower", label: "해바라기", kind: "둥근", stack: `var(--font-sunflower), ${FALLBACK}` },
  { id: "myeongjo", label: "나눔명조", kind: "명조", stack: `var(--font-myeongjo), ${FALLBACK}` },
  { id: "omyu", label: "오뮤 다예쁨체", kind: "손글씨", stack: `"VIC omyu", ${FALLBACK}` },
  { id: "gamja", label: "감자꽃", kind: "손글씨", stack: `var(--font-gamja), ${FALLBACK}` }
];
export const FONT_BASE = "base";

/** 페인트 전 스크립트용 — id → 글꼴 목록. */
export const FONT_STACKS: Record<string, string> = Object.fromEntries(FONT_OPTIONS.map((f) => [f.id, f.stack]));

export function fontPref(): string {
  if (typeof window === "undefined") return FONT_BASE;
  try {
    const v = window.localStorage.getItem(FONT_KEY);
    return v && FONT_STACKS[v] !== undefined ? v : FONT_BASE;
  } catch {
    return FONT_BASE;
  }
}
/** 글꼴을 바로 입힌다(저장 없음) — 설정 창에서 마우스를 올려 보는 미리보기도 이것을 쓴다. */
export function applyFont(id: string): void {
  try {
    const stack = FONT_STACKS[id];
    if (stack) document.documentElement.style.setProperty("--app-font", stack);
    else document.documentElement.style.removeProperty("--app-font");
  } catch {
    /* no-op */
  }
}
export function setFontPref(id: string): void {
  const v = FONT_STACKS[id] !== undefined ? id : FONT_BASE;
  try {
    window.localStorage.setItem(FONT_KEY, v);
  } catch {
    /* 이번 세션만 */
  }
  applyFont(v);
}

// 글씨 굵기 — 일정 카드 글자(제목·세부)의 굵기에 더하는 값. 카드 굵기는 바탕색 대비로 700~900을 고르고
// (inkStyleFor), 여기서 그 위에 한 단계를 얹거나 뺀다. 굵기가 하나뿐인 글꼴은 브라우저가 굵게 흉내 낸다.
export const WEIGHT_STEPS = [-200, 0, 100] as const;
export type WeightStep = (typeof WEIGHT_STEPS)[number];

export function weightPref(): WeightStep {
  if (typeof window === "undefined") return 0;
  try {
    const v = Number(window.localStorage.getItem(WEIGHT_KEY));
    return (WEIGHT_STEPS as readonly number[]).includes(v) ? (v as WeightStep) : 0;
  } catch {
    return 0;
  }
}
export function setWeightPref(step: WeightStep): void {
  try {
    window.localStorage.setItem(WEIGHT_KEY, String(step));
  } catch {
    /* 이번 세션만 */
  }
  try {
    if (step) document.documentElement.style.setProperty("--cal-weight", String(step));
    else document.documentElement.style.removeProperty("--cal-weight");
  } catch {
    /* no-op */
  }
}
