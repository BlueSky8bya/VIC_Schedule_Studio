// 기간 안내·업 도움 띠의 세로 치수 **한 벌**(2026-09-19 소유자: "시청자 화면이랑 편집실이랑 통일").
//
// 여태 두 화면이 각자 숫자를 들고 있었다 — 편집실은 레인 26·여유 8, 시청자는 24·2. 그래서 같은 띠인데
// 띠와 첫 카드 사이가 편집실 8px, 시청자 4.3px로 달랐다(실측). 세 숫자가 서로를 전제하므로
// (하나만 어긋나면 띠끼리 겹치거나 카드가 띠를 덮는다) 여기 한 곳에 둔다.
//
//  · BAR_H   = 띠 높이. 근거는 app/globals.css `.support-bar` 주석(WCAG 2.5.8 · Fitts · 달력 벤치마크).
//  · LANE_STEP = 레인 간격 = 높이 + 띠 사이 틈 2. 24는 WCAG 2.2 SC 2.5.8 Spacing 예외의 하한이기도 하다.
//  · CARD_GAP = 마지막 띠 아래 첫 일정 카드까지의 틈. 카드끼리 간격(3px)과 한 식구로 4px.
//
// CSS 쪽 높이(globals.css · studio-shell.css · public-poster.css)도 같은 값이어야 한다.
export const SUPPORT_BAR_H = 22;
export const SUPPORT_LANE_STEP = 24;
export const SUPPORT_CARD_GAP = 4;

/**
 * 일정 목록이 띠 아래로 비워야 하는 여백. 두 조각으로 돌려준다 —
 *  · scaled = 확대 배율(--cal-zoom)을 곱할 몫. 띠 높이·레인 간격이 배율을 따르므로 같이 커져야 한다.
 *  · fixed  = 배율과 무관한 몫(마지막 띠 아래 숨 + 띠 원점이 목록 원점보다 아래인 만큼).
 * @param depth 그 칸의 레인 수(0이면 띠 없음)
 * @param barTopOffset 띠의 top 원점 − 목록의 top 원점(px). 편집실 4, 시청자 0.
 */
export function supportListPad(
  depth: number,
  barTopOffset = 0
): { fixed: number; scaled: number } | null {
  if (depth <= 0) return null;
  // 마지막 띠 바닥 = (depth-1)*STEP + BAR_H(배율을 따른다). 목록은 그보다 CARD_GAP만큼 아래에서.
  return {
    fixed: SUPPORT_CARD_GAP + barTopOffset,
    scaled: (depth - 1) * SUPPORT_LANE_STEP + SUPPORT_BAR_H
  };
}
