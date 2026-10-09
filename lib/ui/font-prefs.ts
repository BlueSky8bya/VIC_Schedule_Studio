// 글꼴·글씨 굵기(2026-10-06 소유자: 후보 19개 중 동글·주아·개구·나눔손글씨 펜만 빼고 전부) — 기기에 남는 화면 설정.
// 진실의 원천은 localStorage. 적용은 <html style="--app-font: …; --cal-weight: …">: body가 --app-font를 쓰고,
// 일정 카드 글자 굵기(--evt-weight, lib/calendar/month.ts)에 --cal-weight를 더한다.
// 글꼴 파일은 고른 것만 내려받는다 — @font-face(app/fonts.css)와 next/font(app/layout.tsx, preload: false)는
// 선언만 있고, 브라우저는 그 글꼴로 실제 글자를 그릴 때 받는다. 페인트 전 적용은 app/layout.tsx 스크립트가
// 아래 FONT_STACKS를 그대로 받아 한다(처음 열 때 글꼴이 한 번 바뀌어 튀지 않게).

import { migratePrefSplit, prefSurface, surfaceKey } from "@/lib/ui/pref-surface";

// 화면별 키(2026-10-10): 시청자 화면 계열 = vic.font·vic.calWeight, 편집실 = 뒤에 '.studio'(lib/ui/pref-surface).
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
  // 2026-10-10 소유자: "빈칸 두지 말고 고딕 3개·둥근 1개·명조 손글씨 1개 더 — 4열 다 맞춰서"
  { id: "suit", label: "SUIT", kind: "고딕", stack: `"VIC SUIT", ${FALLBACK}` },
  { id: "scdream", label: "에스코어드림", kind: "고딕", stack: `"VIC SCoreDream", ${FALLBACK}` },
  { id: "gmarket", label: "지마켓 산스", kind: "고딕", stack: `"VIC GmarketSans", ${FALLBACK}` },
  { id: "nsround", label: "나눔스퀘어라운드", kind: "둥근", stack: `"VIC NanumSquareRound", ${FALLBACK}` },
  { id: "tmoney", label: "티머니 둥근바람", kind: "둥근", stack: `"VIC TmoneyRoundWind", ${FALLBACK}` },
  { id: "binggrae", label: "빙그레체", kind: "둥근", stack: `"VIC Binggrae", ${FALLBACK}` },
  { id: "cookierun", label: "쿠키런체", kind: "둥근", stack: `"VIC CookieRun", ${FALLBACK}` },
  { id: "maple", label: "메이플스토리체", kind: "둥근", stack: `"VIC Maplestory", ${FALLBACK}` },
  { id: "cafe24air", label: "써라운드 에어", kind: "둥근", stack: `"VIC Cafe24SsurroundAir", ${FALLBACK}` },
  { id: "cafe24", label: "써라운드", kind: "둥근", stack: `"VIC Cafe24Ssurround", ${FALLBACK}` },
  { id: "sunflower", label: "해바라기", kind: "둥근", stack: `var(--font-sunflower), ${FALLBACK}` },
  { id: "myeongjo", label: "나눔명조", kind: "명조", stack: `var(--font-myeongjo), ${FALLBACK}` },
  { id: "gowunbatang", label: "고운바탕", kind: "명조", stack: `var(--font-gowunbatang), ${FALLBACK}` },
  { id: "omyu", label: "오뮤 다예쁨체", kind: "손글씨", stack: `"VIC omyu", ${FALLBACK}` },
  { id: "gamja", label: "감자꽃", kind: "손글씨", stack: `var(--font-gamja), ${FALLBACK}` }
];
export const FONT_BASE = "base";

/** 페인트 전 스크립트용 — id → 글꼴 목록. */
export const FONT_STACKS: Record<string, string> = Object.fromEntries(FONT_OPTIONS.map((f) => [f.id, f.stack]));

export function fontPref(): string {
  if (typeof window === "undefined") return FONT_BASE;
  migratePrefSplit();
  try {
    const v = window.localStorage.getItem(surfaceKey(FONT_KEY, prefSurface()));
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
    window.localStorage.setItem(surfaceKey(FONT_KEY, prefSurface()), v);
  } catch {
    /* 이번 세션만 */
  }
  applyFont(v);
}

// 글씨 굵기 — 일정 카드 글자(제목·세부)의 굵기에 더하는 값. 카드 굵기는 바탕색 대비로 700~900을 고르고
// (inkStyleFor), 여기서 그 위에 한 단계를 얹거나 뺀다.
//   굵게 +100 + 얇은 외곽선(--cal-stroke) — 이미 가장 굵은 파일인 글꼴에서도 한 단계 더 굵어 보이게.
// '가늘게'(−300)는 2026-10-10 폐지: 제목 = 굵은 파일, 세부 = 보통 파일로 위계를 잡으면 굵기 파일이 둘뿐인 글꼴에서
// 가늘게와 보통이 같은 파일로 그려져 구분되지 않았다(소유자 "차이가 없으면 2단계로"). 옛 저장값(−300·−200)은 보통으로 읽는다.
export const WEIGHT_STEPS = [0, 100] as const;
export type WeightStep = (typeof WEIGHT_STEPS)[number];

export function weightPref(): WeightStep {
  if (typeof window === "undefined") return 0;
  migratePrefSplit();
  try {
    const v = Number(window.localStorage.getItem(surfaceKey(WEIGHT_KEY, prefSurface())));
    return (WEIGHT_STEPS as readonly number[]).includes(v) ? (v as WeightStep) : 0;
  } catch {
    return 0;
  }
}
export function setWeightPref(step: WeightStep): void {
  try {
    window.localStorage.setItem(surfaceKey(WEIGHT_KEY, prefSurface()), String(step));
  } catch {
    /* 이번 세션만 */
  }
  applyWeight(step);
}
/** 굵기를 바로 입힌다(저장 없음) — 화면을 옮길 때(편집실 ↔ 미리보기) 그 화면 값으로 다시 입힐 때도 쓴다. */
export function applyWeight(step: WeightStep): void {
  try {
    const d = document.documentElement.style;
    if (step) d.setProperty("--cal-weight", String(step));
    else d.removeProperty("--cal-weight");
    if (step > 0) d.setProperty("--cal-stroke", "0.35px");
    else d.removeProperty("--cal-stroke");
  } catch {
    /* no-op */
  }
}
