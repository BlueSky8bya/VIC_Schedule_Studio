// 화면 모드(2026-09-19 다크 모드 → 2026-10-06 세 상태: 밝게 / 어둡게 / 기기 따라).
// 어두우면 <html data-theme="dark">가 붙고 CSS가 **토큰 팔레트 한 벌**을 어둡게 갈아입는다. 눈 편한 테마
// (data-eye-comfort)와 같은 결의 설정이고, 같은 이유로 **루트 filter는 쓰지 않는다**: <html>에 filter를 걸면
// 그 아래 계절 배경 캔버스까지 물들고 매 프레임 전 화면을 재합성해 프레임이 끊긴다(lib/ui/motion.ts 폐지 기록).
// 저장값(vic.dark): 'on' = 어둡게, 'system' = 기기 따라, 그 외(없음·'off') = 밝게 — 옛 'on'/'off'가 그대로 읽힌다.
// 기본은 밝게(옛 기본 OFF 유지). 페인트 전 적용은 app/layout.tsx 스크립트가 같은 규칙으로 한다(FOUC 방지).
const DARK_KEY = "vic.dark";

export type ThemeMode = "light" | "dark" | "system";

export function themeMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(DARK_KEY);
    return v === "on" ? "dark" : v === "system" ? "system" : "light";
  } catch {
    return "light";
  }
}

export function systemPrefersDark(): boolean {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** 지금 화면이 어두워야 하나(기기 따라면 기기 설정으로 판정). */
export function resolvedDark(mode: ThemeMode = themeMode()): boolean {
  return mode === "dark" || (mode === "system" && systemPrefersDark());
}

/** 저장값은 건드리지 않고 <html>에만 반영한다 — '기기 따라'에서 기기 설정이 바뀔 때 쓴다. */
export function applyThemeMode(mode: ThemeMode): void {
  try {
    const root = document.documentElement;
    if (resolvedDark(mode)) root.setAttribute("data-theme", "dark");
    else root.removeAttribute("data-theme");
  } catch {
    /* no-op */
  }
}

export function setThemeMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(DARK_KEY, mode === "dark" ? "on" : mode === "system" ? "system" : "off");
  } catch {
    /* 저장소 불가 — 이번 세션만 */
  }
  applyThemeMode(mode);
}
