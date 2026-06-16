/**
 * 반응형 breakpoint 정책 (단일 출처).
 *
 * 화면 비율 대응 보고서(docs/ux/responsive/responsive-design-audit-report.md) 기준으로,
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

/**
 * 모바일 정식 UX 진입 기준. JS matchMedia에서 이 상수만 사용한다.
 *
 * 폭(세로 모드)뿐 아니라 "터치 기기가 가로로 누웠을 때"도 모바일로 잡는다 — 휴대폰을 가로로
 * 돌리면 폭이 640을 넘어 데스크톱 레이아웃으로 둔갑하던 문제를 구조적으로 막는다. 가로 휴대폰은
 * 짧은 변(높이)이 작고 포인터가 coarse라 `(max-height) and (pointer: coarse)`로 식별된다.
 * 콤마(OR)라 휴대폰은 세로(첫 절)·가로(둘째 절) 어느 방향에서도 항상 매치 → 회전해도 절대
 * 웹으로 안 넘어간다. 태블릿(짧은 변 > 640)·마우스 데스크톱은 그대로 웹 레이아웃 유지.
 */
export const MOBILE_QUERY = `(max-width: ${BREAKPOINTS.mobile}px), (max-height: ${BREAKPOINTS.mobile}px) and (pointer: coarse)`;
