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
export const SETTINGS_EPOCH = "2026-09-03";
export const SETTINGS_EPOCH_KEY = "vic.settingsEpoch";

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
    if (on) root.setAttribute("data-eye-comfort", "1");
    else root.removeAttribute("data-eye-comfort");
  } catch {
    /* no-op */
  }
}
