// "동작 줄이기"(reduce motion) 설정 — 앱의 장식용 애니메이션을 한 곳에서 켜고 끈다.
// 방침: 진동(haptics)과 같은 결의 "편의 설정". 켜면 <html data-reduce-motion="1">가 붙어
// CSS가 '장식용' 무한 애니메이션(제목 반짝임·오늘 강조 호흡·불꽃 깜빡임·스티커 흔들림 등)을
// 끈다. 스피너·저장 점·드래그 안내선 같은 '의미 있는' 모션은 유지한다(상태를 알려주므로).
// 기본 OFF. 이 토글이 유일한 결정권 — CSS는 OS 미디어쿼리가 아니라 항상 html[data-reduce-motion]만
// 본다(OS 설정과 무관하게 앱 모션을 그대로 보고 싶은 사람이 다수라는 사용자 결정, 2026-08-27).
//
// 페인트 전 적용은 app/layout.tsx의 인라인 스크립트가 담당(FOUC 방지). 여기 함수는 설정 화면
// (역할 배지 "?" 팝오버의 토글)에서 즉시 반영/저장하는 용도.
//
// (P1-MOTION-1의 OS prefers-reduced-motion 시딩은 2026-08-27 철회 — 미설정=OFF.)

// ── 설정 세대(epoch) — 배포 후 첫 방문 1회 기본값 복원(2026-09-03 관리자 결정) ──
// 처음에 실수로 '동작 줄이기'를 켜 두고는 설정의 존재를 잊은 채 "이 사이트는 움직임이 없다"고
// 아는 시청자가 있는 듯해서, 이 세대 값이 바뀐 배포를 처음 열 때 기기 저장값과 무관하게
// 동작 줄이기 OFF · 눈 편한 테마 ON(둘 다 '미설정' 상태로 지움)으로 한 번 되돌리고 세대를 기록한다.
// 그 뒤로는 사용자가 고른 값이 그대로 이어진다. 다시 한 번 전체 복원이 필요하면 값만 올린다.
// 적용 지점 = app/layout.tsx 페인트-전 스크립트(설정을 읽기 **전에** 실행돼야 한다).
// 비주얼 테스트는 playwright.visual.config.ts의 storageState로 현재 세대를 미리 심어 둔다
// (안 그러면 테스트가 켜 둔 '동작 줄이기'가 첫 로드에서 지워진다).
// 2026-09-04 세대(관리자 결정): 생동감 있는 동작·눈 편한 테마·차분한 편집실·계절 배경 **네 키 전부** 지워 기본 ON으로.
// 그 뒤 만진 값만 남는다. (기기 판정 vic.gfx는 세대가 아니라 판정 버전(lib/ui/gfx.ts v3)으로 다시 잰다.)
export const SETTINGS_EPOCH = "2026-09-04";
export const SETTINGS_EPOCH_KEY = "vic.settingsEpoch";

import { eyeComfortAttrValue } from "@/lib/ui/gfx";

const REDUCE_MOTION_KEY = "vic.reduceMotion"; // localStorage: "on"/"off"/미설정(=off)
export const REDUCE_MOTION_EVENT = "vic:reduce-motion";

export function reduceMotionEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = window.localStorage.getItem(REDUCE_MOTION_KEY);
    return v === "on"; // 미설정·off 모두 OFF
  } catch {
    return false;
  }
}

export function setReduceMotion(on: boolean): void {
  try {
    window.localStorage.setItem(REDUCE_MOTION_KEY, on ? "on" : "off");
  } catch {
    /* 저장 실패는 무시 — 설정은 보너스라 앱 동작에 영향 없음 */
  }
  try {
    const root = document.documentElement;
    if (on) root.setAttribute("data-reduce-motion", "1");
    else root.removeAttribute("data-reduce-motion");
  } catch {
    /* no-op (SSR 등) */
  }
  // Same-window finite renderers re-read the established preference/attribute.
  // This carries no value, identity or activity metadata and creates no clock.
  try { window.dispatchEvent(new Event(REDUCE_MOTION_EVENT)); } catch { /* SSR */ }
}

// Personal stage preference; the production release flag is a separate gate.
export const PREMIERE_STAGE_KEY = "vic.premiereStage";
export const PREMIERE_STAGE_EVENT = "vic:premiere-stage";
export function premiereStageEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(PREMIERE_STAGE_KEY) !== "off"; }
  catch { return true; }
}
export function setPremiereStageEnabled(on: boolean): void {
  try { window.localStorage.setItem(PREMIERE_STAGE_KEY, on ? "on" : "off"); }
  catch { /* Keep the current tab usable when storage is unavailable. */ }
  window.dispatchEvent(new CustomEvent(PREMIERE_STAGE_EVENT, { detail: on }));
}

// #28 눈 편한 테마(eye comfort) — 방송 전후 오래 보는 작업자용. 켜면 <html data-eye-comfort>가
// 붙어 CSS가 **UI 토큰 팔레트**를 크림 톤으로 바꾼다(글자 대비는 유지). reduce-motion과 같은 결의 설정.
// 2026-09-06부터 루트 filter는 쓰지 않는다 — 계절 배경 캔버스까지 물들이기 때문(소유자 지시).
const EYE_COMFORT_KEY = "vic.eyeComfort"; // localStorage: 미설정이면 기본 ON, "off"만 끔

export function eyeComfortEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    // 기본 ON — 사용자가 명시적으로 끄지(off) 않았으면 켠 상태.
    return window.localStorage.getItem(EYE_COMFORT_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setEyeComfort(on: boolean): void {
  try {
    window.localStorage.setItem(EYE_COMFORT_KEY, on ? "on" : "off");
  } catch {
    /* 무시 */
  }
  try {
    const root = document.documentElement;
    // 값 "1"·"lite" 모두 같은 토큰 팔레트 — 값은 기기 등급 구분용으로만 남았다(lib/ui/gfx.ts).
    if (on) root.setAttribute("data-eye-comfort", eyeComfortAttrValue());
    else root.removeAttribute("data-eye-comfort");
  } catch {
    /* no-op */
  }
}

// ── 차분한 편집실(studio calm, 2026-09-03) ────────────────────────────────
// (차분한 편집실 — 편집실 전용 물·은 톤 층은 스위치 없이 기본 모습이다. 2026-09-04 토글 제거, 2026-11-17
//  `data-studio-calm` 속성 조건까지 걷음. 규칙은 studio-shell.css·studio-calm-layer.css의 `html:root …` 블록.)

// ── 계절 배경(2026-09-04, ADR-0017) — 물결 위의 계절 레이어(components/shared/ambient) ON/OFF ──
// **기본 OFF(2026-09-04 소유자)** — 처음 오는 사람은 조용한 화면에서 시작하고, 켜기/흐리게/끄기 중 고른 값이
// 기기에 남아(localStorage vic.ambient) 다음 방문에 그대로 복원된다. OFF면 `<html data-ambient="off">`가 붙어 계절 레이어만 숨긴다 —
// 물결(.gs-tide)은 이 스위치와 무관하게 '생동감 있는 동작'이 단독으로 쥔다(사철 상수). 페인트 전 적용은
// app/layout.tsx 스크립트(같은 줄). 시청자 화면엔 설정 UI가 없어 늘 ON(기기 저장값이 있으면 그것).
const AMBIENT_KEY = "vic.ambient"; // localStorage: 미설정이면 기본 OFF. 값은 "on" | "dim" | "off"

// 세 상태(2026-09-04 사용자: "흐려진 배경만 원하는 사람도 있을 것"): on 켜짐 · dim 흐리게(배경 레이어 opacity .28 + 엔진 절반
// 프레임 — 편집 집중 모드와 같은 모습이 늘) · off 끔. 저장값 "on"/"dim"/"off"(미설정 = off). 속성: dim → `data-ambient="dim"`,
// off → `data-ambient="off"`, on → 없음. 감상 모드(html[data-showcase])에선 흐림을 잠시 걷는다(app/ambient.css).
export type AmbientMode = "on" | "dim" | "off";

export function ambientMode(): AmbientMode {
  if (typeof window === "undefined") return "off";
  try {
    const v = window.localStorage.getItem(AMBIENT_KEY);
    return v === "on" || v === "dim" ? v : "off"; // 미설정·이상값 = 끔
  } catch {
    return "off";
  }
}

export function setAmbientMode(mode: AmbientMode): void {
  try {
    window.localStorage.setItem(AMBIENT_KEY, mode);
  } catch {
    /* 무시 */
  }
  try {
    const root = document.documentElement;
    if (mode === "on") root.removeAttribute("data-ambient");
    else root.setAttribute("data-ambient", mode);
  } catch {
    /* no-op */
  }
}

