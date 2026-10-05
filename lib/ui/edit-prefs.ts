// 기기에 남는 작업 설정(2026-10-06) — 설정 창의 '던져서 삭제'·'달력 크기'. 진실의 원천은 localStorage,
// 읽기 실패(사생활 모드 등)는 기본값으로 동작한다.

const FLING_KEY = "vic.flingDelete";
const CAL_SIZE_KEY = "vic.calSize";
/** 달력 크기가 바뀌면 열려 있는 달력이 즉시 따라오도록 알리는 이벤트(detail = 배율). */
export const CAL_SIZE_EVENT = "vic:cal-size";

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

/** 달력 크기 = 달력 확대(--cal-zoom)의 기본값. Ctrl+휠로 잠깐 바꾼 배율과 별개로, 열 때마다 이 크기에서 시작한다. */
export const CAL_SIZES = [1, 1.25, 1.5] as const;
export type CalSize = (typeof CAL_SIZES)[number];

export function calSizePref(): CalSize {
  if (typeof window === "undefined") return 1;
  try {
    const v = Number(window.localStorage.getItem(CAL_SIZE_KEY));
    return (CAL_SIZES as readonly number[]).includes(v) ? (v as CalSize) : 1;
  } catch {
    return 1;
  }
}
export function setCalSizePref(size: CalSize): void {
  try {
    window.localStorage.setItem(CAL_SIZE_KEY, String(size));
  } catch {
    /* 이번 세션만 */
  }
  try {
    window.dispatchEvent(new CustomEvent(CAL_SIZE_EVENT, { detail: size }));
  } catch {
    /* no-op */
  }
}
