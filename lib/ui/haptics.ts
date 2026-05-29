// 진동(햅틱) "두꺼비집" — 앱의 모든 진동은 여기 한 곳을 거친다.
// 방침: 진동은 "있으면 좋은 보너스". Android(Chrome/삼성 등)에서만 실제로 울리고,
// iOS Safari·미지원 기기·끈 사용자에게는 조용히 무시된다(에러 없음, 화면 동작 동일).
// 자세한 배경/계획: docs/진동기능-구현계획.md, docs/motion-haptics-immersion-report.md
//
// 통과해야 울리는 "자물쇠 3개":
//   1) 이 기기가 navigator.vibrate를 지원하나? (iOS 등은 미지원 → 무시)
//   2) 사용자가 진동을 켜뒀나? (기본 ON, 끄면 off 저장 — 토글 UI는 추후 단계)
//   3) (호출부에서) 짧은 패턴만, 꼭 필요할 때만.

const HAPTICS_PREF_KEY = "vic.haptics"; // localStorage: "off"면 끔, 그 외엔 켬(기본 ON)

// [자물쇠 1·2] 기기 지원 + 사용자 설정. SSR(navigator 없음)에서도 안전하게 false.
export function hapticsEnabled(): boolean {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return false;
  try {
    return window.localStorage.getItem(HAPTICS_PREF_KEY) !== "off";
  } catch {
    return true; // localStorage 접근 불가(사생활 모드 등)면 기본 ON으로 본다
  }
}

// 추후 "진동 켜기/끄기" 설정 토글에서 호출(현재는 코드상 준비만, UI 미노출).
export function setHapticsEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(HAPTICS_PREF_KEY, on ? "on" : "off");
  } catch {
    /* 저장 실패는 무시 — 진동은 보너스라 앱 동작에 영향 없음 */
  }
}

// 실제로 모터를 켜는 단 한 군데. 미지원/끔이면 그냥 끝.
function buzz(pattern: number | number[]): void {
  if (!hapticsEnabled()) return;
  try {
    navigator.vibrate(pattern); // 예외는 안 던지지만 만약을 대비해 감싼다
  } catch {
    /* no-op */
  }
}

// 상황별 "느낌"에 이름을 붙여 둔다 — 호출부는 의미 있는 이름만 부른다.
export const hapticTick = () => buzz(12); // 가벼운 톡: 하트, 카드 탭, 드래그 집기
export const hapticSuccess = () => buzz([12, 40, 12]); // 톡-쉼-톡: 저장·잠금 해제 성공
export const hapticDelete = () => buzz(24); // 또렷한 한 번: 삭제(되돌리기 어려운 동작)
export const hapticWarn = () => buzz([20, 60, 20]); // 경고(추후 단계용)
export const hapticError = () => buzz([30, 40, 30, 40, 30]); // 다다닥: 비밀번호 틀림 등(추후)
