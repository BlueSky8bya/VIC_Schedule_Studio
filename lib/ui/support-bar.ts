// 기간 안내·업 도움 띠의 세로 치수 **한 벌**(2026-09-19 소유자: "시청자 화면이랑 편집실이랑 통일").
//
// 여태 두 화면이 각자 숫자를 들고 있었다 — 편집실은 레인 26·여유 8, 시청자는 24·2. 그래서 같은 띠인데
// 띠와 첫 카드 사이가 편집실 8px, 시청자 4.3px로 달랐다(실측). 세 숫자가 서로를 전제하므로
// (하나만 어긋나면 띠끼리 겹치거나 카드가 띠를 덮는다) 여기 한 곳에 둔다.
//
//  · BAR_H     = 띠 높이. 근거는 app/globals.css `.support-bar` 주석(WCAG 2.5.8 · Fitts · 달력 벤치마크).
//  · LANE_STEP = 레인 간격 = 높이 + 띠 사이 틈 2. 24는 WCAG 2.2 SC 2.5.8 Spacing 예외의 하한이기도 하다.
//  · HEAD_GAP  = 날짜 머리줄 바닥 → 첫 띠. 머리줄은 숫자 잉크 아래에 ~3px 여유를 두므로 1px이면
//                숫자 잉크→띠가 띠→카드(CARD_GAP 4)와 같아진다(실측 4.5 / 4.0, 2026-10-10).
//  · CARD_GAP  = 마지막 띠 아래 첫 일정 카드까지의 틈. 카드끼리 간격(3px)과 한 식구로 4px.
//
// **기준점은 머리줄 바닥(= 일정 목록 원점)이다**(2026-10-10 소유자: "띠가 숫자를 먹고, 아래로는 너무 떨어진다").
// 예전엔 띠를 칸 꼭대기에서 고정 px로 내렸는데, 머리줄 높이가 글씨 크기·확대에 따라 자라서(22→28.5px)
// 띠는 숫자를 먹고 목록 원점만 내려가 띠→카드 틈이 4px에서 15px까지 벌어졌다. 이제 두 화면 모두
// 머리줄 높이를 CSS 변수(--day-head-h)로 못박고, 띠 top = 머리줄 + 틈, 목록 paddingTop = 틈 + 띠 + 틈.
// 모든 값은 CSS의 --cal-zoom을 곱한다(띠 높이도 그 값을 쓴다 — JS 배율과 섞으면 어긋났다).
export const SUPPORT_BAR_H = 22;
export const SUPPORT_LANE_STEP = 24;
export const SUPPORT_HEAD_GAP = 1;
export const SUPPORT_CARD_GAP = 4;

/** 띠의 top(CSS calc 문자열) — 칸 원점 기준. 머리줄 높이는 각 화면 CSS의 --day-head-h. */
export function supportBarTop(lane: number): string {
  return `calc(var(--day-head-h) + ${SUPPORT_HEAD_GAP + lane * SUPPORT_LANE_STEP}px * var(--cal-zoom, 1))`;
}

/**
 * 일정 목록이 띠 아래로 비워야 하는 paddingTop(CSS calc 문자열). 목록 원점 = 머리줄 바닥이라 머리줄 높이와 무관하다.
 * @param depth 그 칸의 레인 수(0이면 띠 없음 → null)
 */
export function supportListPad(depth: number): string | null {
  if (depth <= 0) return null;
  const px = SUPPORT_HEAD_GAP + (depth - 1) * SUPPORT_LANE_STEP + SUPPORT_BAR_H + SUPPORT_CARD_GAP;
  return `calc(${px}px * var(--cal-zoom, 1))`;
}
