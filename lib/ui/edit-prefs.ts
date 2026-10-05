// 기기에 남는 작업 설정(2026-10-06) — 설정 창의 '던져서 삭제'·'글씨 크기'. 진실의 원천은 localStorage,
// 읽기 실패(사생활 모드 등)는 기본값으로 동작한다.

const FLING_KEY = "vic.flingDelete";
const TEXT_KEY = "vic.calText"; // 시청자 화면(로그인·비로그인 같은 기기면 같은 값)
const TEXT_KEY_STUDIO = "vic.calText.studio"; // 편집실(개발자·관리자) — 편집실 카드 폭이 달라 따로 고른다

/** 던져서 삭제 — 기본 켜짐(지금까지의 동작). 'off'면 빠르게 던져도 지우지 않고 제자리로 돌아간다. */
export function flingDeleteEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(FLING_KEY) !== "off";
  } catch {
    return true;
  }
}
export function setFlingDelete(on: boolean): void {
  try {
    window.localStorage.setItem(FLING_KEY, on ? "on" : "off");
  } catch {
    /* 이번 세션만 */
  }
}

// 글씨 크기(2026-10-06 소유자: "달력 크기 설정은 없애고, 글씨를 px로 미리보며 고르고, 그걸 기본으로 휠 확대") —
// 달력 글자(일정 제목·세부·날짜·요일·기념일) 크기의 기본값. 기준은 일정 제목 px(원래 14px). 나머지 글자는 같은 비율로
// 따라간다: <html style="--cal-text: px/14">. Ctrl+휠 확대(--cal-zoom)는 이 크기에 곱해진다 — 고른 크기가 100%.
// 페인트 전 적용은 app/layout.tsx 스크립트가 같은 키로 한다(처음 열 때 글씨가 한 번 튀지 않게).
export const TEXT_PX_BASE = 14;
export const TEXT_PX_MIN = 12;
export const TEXT_PX_MAX = 20;

// 글씨 크기는 화면별로 따로(2026-10-06 소유자: "편집실과 시청자 화면은 카드 폭이 달라 따로 설정") — 지금 있는 화면을
// 주소로 가른다(/studio… = 편집실). 편집실 값이 없으면 시청자 값을 이어받는다(분리 전 저장값 호환).
export type TextSurface = "studio" | "viewer";
export function textSurface(): TextSurface {
  if (typeof window === "undefined") return "viewer";
  return /(^|\/)studio(\/|$)/.test(window.location.pathname) ? "studio" : "viewer";
}
export function textPxPref(surface: TextSurface = textSurface()): number {
  if (typeof window === "undefined") return TEXT_PX_BASE;
  try {
    const raw = surface === "studio" ? (window.localStorage.getItem(TEXT_KEY_STUDIO) ?? window.localStorage.getItem(TEXT_KEY)) : window.localStorage.getItem(TEXT_KEY);
    const v = Number(raw);
    return Number.isFinite(v) && v >= TEXT_PX_MIN && v <= TEXT_PX_MAX ? v : TEXT_PX_BASE;
  } catch {
    return TEXT_PX_BASE;
  }
}
export function applyTextPx(px: number): void {
  try {
    document.documentElement.style.setProperty("--cal-text", String(px / TEXT_PX_BASE));
  } catch {
    /* no-op */
  }
}
export function setTextPxPref(px: number, surface: TextSurface = textSurface()): void {
  const v = Math.min(TEXT_PX_MAX, Math.max(TEXT_PX_MIN, Math.round(px * 2) / 2));
  try {
    window.localStorage.setItem(surface === "studio" ? TEXT_KEY_STUDIO : TEXT_KEY, String(v));
  } catch {
    /* 이번 세션만 */
  }
  applyTextPx(v);
}
