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
}

// #28 눈 편한 테마(eye comfort) — 방송 전후 오래 보는 작업자용. 켜면 <html data-eye-comfort>가
// 붙어 CSS가 전체 채도·눈부심을 살짝 낮춘다(글자 대비는 유지). reduce-motion과 같은 결의 설정.
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
    // 값 "1" = 루트 filter, "lite" = 토큰 팔레트(약한 기기 판정, lib/ui/gfx.ts).
    if (on) root.setAttribute("data-eye-comfort", eyeComfortAttrValue());
    else root.removeAttribute("data-eye-comfort");
  } catch {
    /* no-op */
  }
}

// ── 차분한 편집실(studio calm, 2026-09-03) ────────────────────────────────
// 편집실 전용 테마 레이어 — 소유자가 매일 쓰는 화면을 '물·은' 톤으로 식힌다(docs/ux/
// saju-redesign-direction.md). 콘텐츠(달력 카드·태그·의미색 8종)는 그대로 두고 **구조만**:
// 저장·달 이동 = 물빛, 좌측 필터 패널 = 은백 카드, 달력 칸 = 반 단계 냉각, 관리 칩 = 고스트,
// 제목 ✨ 반짝임 정지. CSS는 studio-shell.css의 `html[data-studio-calm]` 블록에만 산다 —
// 시청자 포스터(.public-*)는 이 속성을 안 본다. 기본 ON(소유자 결정, 2026-09-03) — 'off'만 끈다.
// 페인트 전 적용은 app/layout.tsx 스크립트(눈 편한 테마와 같은 줄).
// 2026-09-04 사용자: "끄면 색감이 살짝 어두워질 뿐 뭐가 차분한지 모르겠다 — ON을 기본으로 하고 토글은 지워도 된다"
// → 스위치 제거, **항상 ON**. 페인트-전 스크립트가 `data-studio-calm`을 무조건 붙이고(옛 vic.studioCalm 키는 세대
// 재시딩 때 지운다), CSS(`html[data-studio-calm]`)는 그대로 — 되돌리려면 이 함수와 스크립트 조건만 살리면 된다.
export function studioCalmEnabled(): boolean {
  return true;
}

// ── 계절 배경(2026-09-04, ADR-0017) — 물결 위의 계절 레이어(components/shared/ambient) ON/OFF ──
// 기본 ON('off'만 끔). OFF면 `<html data-ambient="off">`가 붙어 app/ambient.css가 계절 레이어만 숨긴다 —
// 물결(.gs-tide)은 이 스위치와 무관하게 '생동감 있는 동작'이 단독으로 쥔다(사철 상수). 페인트 전 적용은
// app/layout.tsx 스크립트(같은 줄). 시청자 화면엔 설정 UI가 없어 늘 ON(기기 저장값이 있으면 그것).
const AMBIENT_KEY = "vic.ambient"; // localStorage: 미설정이면 기본 ON, "off"만 끔

// 세 상태(2026-09-04 사용자: "흐려진 배경만 원하는 사람도 있을 것"): on 켜짐 · dim 흐리게(배경 레이어 opacity .28 + 엔진 절반
// 프레임 — 편집 집중 모드와 같은 모습이 늘) · off 끔. 저장값 "on"/"dim"/"off"(미설정 = on). 속성: dim → `data-ambient="dim"`,
// off → `data-ambient="off"`, on → 없음. 감상 모드(html[data-showcase])에선 흐림을 잠시 걷는다(app/ambient.css).
export type AmbientMode = "on" | "dim" | "off";

export function ambientMode(): AmbientMode {
  if (typeof window === "undefined") return "on";
  try {
    const v = window.localStorage.getItem(AMBIENT_KEY);
    return v === "off" || v === "dim" ? v : "on";
  } catch {
    return "on";
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

/** 켜짐/흐리게 = true, 끔 = false(옛 호출부 호환). */
export function ambientEnabled(): boolean {
  return ambientMode() !== "off";
}

export function setAmbient(on: boolean): void {
  setAmbientMode(on ? "on" : "off");
}
