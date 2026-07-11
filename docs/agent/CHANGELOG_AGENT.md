# Agent Change Log

> git log가 1차 기록이다(한국어로 "왜"까지 적는다). 이 파일은 그 위에 **되돌리는 법과 검증 증거**를
> 남기는 자리다 — 되돌리기 비싼 변경, 마이그레이션, 공개 경계 변경만 적는다.
> 포맷·import 정리·소소한 오타는 적지 않는다.

## v0.1.0 — 2026-07-12

### CHG-20260712-003 — FEAT — 시청자 '이 달 기록'(공개 인사이트)

Problem: 시청자·비로그인은 방송/일정 기록을 볼 방법이 없었다.
Change: 공개 인사이트 시트 + 집계 전용 RPC 2개. 관리자 인사이트의 차트 컴포넌트를 그대로 재사용하고,
차트 CSS를 `components/studio/insights-charts.css`로 분리해 편집실·시청자가 공유.
Files: `components/poster/public-insights.tsx`, `app/api/public/[calendarSlug]/broadcast/route.ts`,
`lib/schedules/public-loader.ts`, `db/migrations/0049_*.sql`, `0050_*.sql`, `components/studio/insights-charts.css`
Validation: prod build + Playwright — API가 집계만 반환, 시트에 하트 개수·방문 지표 없음.
Related: [ADR-0008](decisions/ADR-0008-public-insights-aggregate-rpc.md)
Rollback: 시트/버튼/라우트 제거 + `drop function get_public_broadcast_stats/get_public_broadcast_daily`.
테이블은 애초에 deny-all이라 데이터 노출 잔재 없음.
Docs: CURRENT_STATE, DECISION_INDEX

### CHG-20260712-002 — FIX — 시즌 장난감이 포스터를 덮던 문제

Problem: 미니게임이 데스크톱 기본 ON + 딤이 클릭 차단 → 첫 방문자가 일정표를 읽지도 누르지도 못함.
월드컵 달엔 오너가 고른 테마를 강제로 덮어씀(내보낸 PNG까지).
Change: 미니게임 opt-in, 딤은 켠 동안만, 시즌 테마는 오너 미선택 시에만, 미니게임 ON이면 중력공 언마운트.
Files: `components/seasonal/worldcup-ball-goal.{tsx,css}`, `components/poster/public-poster.tsx`
Validation: prod build + 실제 클릭(켜기 → 경기장·HUD 표시, 중력공 1→0).
Related: [ADR-0009](decisions/ADR-0009-seasonal-toys-are-opt-in.md)
Rollback: 기본값 플래그 되돌리기(`let en = !rotated.current`) — 권장하지 않음.

### CHG-20260712-001 — FIX — 태블릿에서 포스터 표면이 뷰포트로 재배치되던 문제

Problem: `@media (max-width:1040px)`가 폭 1840 고정 캔버스의 내부 그리드를 1컬럼으로 바꿔,
같은 스티커가 시청자 화면 폭에 따라 다른 콘텐츠 위에 얹혔다(ADR-0004 위반). 게다가 0.49배 축소로 본문 6px.
Change: 표면 재배치 규칙 삭제, 641~1040px는 아젠다(목록) 레이아웃으로(`POSTER_AGENDA_QUERY`).
Files: `components/poster/public-poster.{tsx,css}`, `lib/ui/breakpoints.ts`
Validation: Playwright 900px → `layout: agenda` 확인.
Rollback: 미디어쿼리 복구(스티커 드리프트가 되살아남 — 하지 말 것).
