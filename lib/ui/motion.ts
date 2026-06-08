// "동작 줄이기"(reduce motion) 설정 — 앱의 장식용 애니메이션을 한 곳에서 켜고 끈다.
// 방침: 진동(haptics)과 같은 결의 "편의 설정". 켜면 <html data-reduce-motion="1">가 붙어
// CSS가 '장식용' 무한 애니메이션(제목 반짝임·오늘 강조 호흡·불꽃 깜빡임·스티커 흔들림 등)을
// 끈다. 스피너·저장 점·드래그 안내선 같은 '의미 있는' 모션은 유지한다(상태를 알려주므로).
// OS의 prefers-reduced-motion은 별도로 CSS @media가 이미 존중한다 — 이 토글은 그 위에 얹는
// 사용자 명시 설정(OS 설정과 무관하게 끄고 싶은 사람용). 기본 OFF.
//
// 페인트 전 적용은 app/layout.tsx의 인라인 스크립트가 담당(FOUC 방지). 여기 함수는 설정 화면
// (역할 배지 "?" 팝오버의 토글)에서 즉시 반영/저장하는 용도.

const REDUCE_MOTION_KEY = "vic.reduceMotion"; // localStorage: "on"이면 켬, 그 외 끔(기본 OFF)

export function reduceMotionEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(REDUCE_MOTION_KEY) === "on";
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
