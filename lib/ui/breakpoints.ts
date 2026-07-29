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

/**
 * 시청자 포스터가 '아젠다(목록)'로 바뀌는 기준 — 모바일 + 태블릿/좁은 창(≤1040px).
 *
 * 포스터 표면은 폭 1840 고정 캔버스라, 좁은 화면에선 통째로 축소(scale)돼 들어간다. 900px 화면이면
 * 배율이 0.49 — 13px 일정 제목이 6px로 찍혀 사실상 못 읽는다. 표면 내부 배치를 화면 폭에 맞춰
 * 바꾸는 건 금지다(스티커 좌표가 어긋난다 — ADR-0004). 그래서 '읽을 수 없을 만큼 작아지는 폭'부터는
 * 표면 대신 모바일과 같은 목록 레이아웃으로 보낸다.
 *
 * 1040px = 표면 배율 ≈ 0.57(본문 13px → 7.4px)로, 이보다 좁으면 목록이 무조건 낫다.
 * 꾸미기(decorate)는 예외 — 편집은 항상 표면 위에서 한다(시청자와 같은 기하를 봐야 하므로).
 */
/**
 * 편집실이 '아젠다(목록)+시트' 토폴로지로 바뀌는 기준 — P1-IPAD-1(L4).
 *
 * 640~999px(아이패드 세로 768, 스플릿뷰 등)은 예전엔 데스크톱 2패널을 압축해 구겨 넣었다 —
 * 터치 타깃이 작아지고 폼이 잘렸다. 계획서 F4대로 1000px 미만은 컨테이너 폭 기준으로
 * 아젠다 토폴로지를 쓴다(포인터 종류로 정보 구조를 가르지 않는다). CSS 쪽 동일 분기는
 * studio-shell.css의 999/1000 미디어쿼리와 맞춘다.
 */
export const STUDIO_AGENDA_MAX = 999;
export const STUDIO_AGENDA_QUERY = `(max-width: ${STUDIO_AGENDA_MAX}px), (max-height: ${BREAKPOINTS.mobile}px) and (pointer: coarse)`;

export const POSTER_AGENDA_MAX = 1040;
export const POSTER_AGENDA_QUERY = `(max-width: ${POSTER_AGENDA_MAX}px), (max-height: ${BREAKPOINTS.mobile}px) and (pointer: coarse)`;
