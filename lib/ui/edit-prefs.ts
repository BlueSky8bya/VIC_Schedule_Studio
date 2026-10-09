// 기기에 남는 작업 설정(2026-10-06) — 설정 창의 '던져서 삭제'·'글씨 크기'. 진실의 원천은 localStorage,
// 읽기 실패(사생활 모드 등)는 기본값으로 동작한다.

const FLING_KEY = "vic.flingDelete";
import { prefSurface, surfaceKey, type PrefSurface } from "@/lib/ui/pref-surface";

const TEXT_KEY = "vic.calText"; // 시청자 화면 계열은 이 키, 편집실은 vic.calText.studio(lib/ui/pref-surface)

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

// 글씨 크기는 화면별로 따로(2026-10-06 소유자: "편집실과 시청자 화면은 카드 폭이 달라 따로 설정") — 화면 판정은
// lib/ui/pref-surface(편집실 안의 시청자 화면 미리보기도 시청자 쪽). 2026-10-10: 편집실 값이 없을 때 시청자 값을 이어받던
// 것을 없앴다 — 시청자 화면에서 바꾸면 편집실도 따라 바뀌었다(소유자 "독립적으로").
export type TextSurface = PrefSurface;
export const textSurface = prefSurface;
export function textPxPref(surface: TextSurface = textSurface()): number {
  if (typeof window === "undefined") return TEXT_PX_BASE;
  try {
    const raw = window.localStorage.getItem(surfaceKey(TEXT_KEY, surface));
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
    window.localStorage.setItem(surfaceKey(TEXT_KEY, surface), String(v));
  } catch {
    /* 이번 세션만 */
  }
  applyTextPx(v);
}
