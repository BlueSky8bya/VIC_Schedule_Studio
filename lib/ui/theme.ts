// 다크 모드(2026-09-19 소유자) — 켜면 <html data-theme="dark">가 붙고 CSS가 **토큰 팔레트 한 벌**을
// 어둡게 갈아입는다. 눈 편한 테마(data-eye-comfort)와 같은 결의 설정이고, 같은 이유로 **루트 filter는
// 쓰지 않는다**: <html>에 filter를 걸면 그 아래 계절 배경 캔버스까지 물들고(빠져나갈 방법이 없다)
// 매 프레임 전 화면을 재합성해 프레임이 끊긴다(lib/ui/motion.ts의 폐지 기록 참조).
// 기본 OFF — 'on'을 고른 경우에만 켠다. 페인트 전 적용은 app/layout.tsx 스크립트가 한다(FOUC 방지).
const DARK_KEY = "vic.dark";

export function darkEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DARK_KEY) === "on";
  } catch {
    return false;
  }
}

export function setDarkMode(on: boolean): void {
  try {
    window.localStorage.setItem(DARK_KEY, on ? "on" : "off");
  } catch {
    /* 저장소 불가 — 이번 세션만 */
  }
  try {
    const root = document.documentElement;
    if (on) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
  } catch {
    /* no-op */
  }
}
