/**
 * 반응형 breakpoint 정책 (단일 출처).
 *
 * 화면 비율 대응 보고서(docs/responsive-design-audit-report.md) 기준으로,
 * JS(matchMedia)와 CSS breakpoint가 어긋나지 않도록 한곳에서 관리한다.
 *
 *   mobile        <= 640px  : 모바일 정식 UX (agenda/list + bottom sheet)
 *   compact       <= 860px  : 좁은 태블릿/분할 화면 (단일 컬럼, 툴바 여유)
 *   studioNarrow  <= 1180px : 태블릿 가로/작은 노트북 (달력 + 일부 패널 접힘)
 *   (그 이상)               : 데스크톱 스튜디오
 *
 * (대형 화면 zoom(1700/2400px)은 studio-shell.css에서 유지 — Phase 4에서 제거 시도했으나
 *  밀도가 너무 커져 되돌렸다. zoom이 이 앱에선 실제 문제를 안 일으킴.)
 *
 * CSS 쪽 동일 분기점은 각 CSS 파일 상단의 "Responsive policy" 주석과 맞춘다.
 */

export const BREAKPOINTS = {
  mobile: 640,
  compact: 860,
  studioNarrow: 1180,
} as const;

/** 모바일 정식 UX 진입 기준. JS matchMedia에서 이 상수만 사용한다. */
export const MOBILE_QUERY = `(max-width: ${BREAKPOINTS.mobile}px)`;
