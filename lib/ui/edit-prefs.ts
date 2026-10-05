// 기기에 남는 작업 설정(2026-10-06) — 설정 창의 '던져서 삭제'·'글씨 크기'. 진실의 원천은 localStorage,
// 읽기 실패(사생활 모드 등)는 기본값으로 동작한다.

const FLING_KEY = "vic.flingDelete";
const TEXT_KEY = "vic.calText";

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

export function textPxPref(): number {
  if (typeof window === "undefined") return TEXT_PX_BASE;
  try {
    const v = Number(window.localStorage.getItem(TEXT_KEY));
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
export function setTextPxPref(px: number): void {
  const v = Math.min(TEXT_PX_MAX, Math.max(TEXT_PX_MIN, Math.round(px * 2) / 2));
  try {
    window.localStorage.setItem(TEXT_KEY, String(v));
  } catch {
    /* 이번 세션만 */
  }
  applyTextPx(v);
}
