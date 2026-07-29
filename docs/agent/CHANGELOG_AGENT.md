# Agent Change Log

> git log가 1차 기록이다(한국어로 "왜"까지 적는다). 이 파일은 그 위에 **되돌리는 법과 검증 증거**를
> 남기는 자리다 — 되돌리기 비싼 변경, 마이그레이션, 공개 경계 변경만 적는다.
> 포맷·import 정리·소소한 오타는 적지 않는다.

## v0.1.0 — 2026-07-30

### CHG-20260730-001 — REMOVE — 공개 proposals 엔드포인트·supportCampaigns payload 제거 (P2-PROTO-1)

Problem: `/api/public/[slug]/proposals`는 샘플 배열만 돌려주고 POST는 어디에도 저장 안 하며
202를 반환 — 실기능으로 오인 가능한 가짜 공개 표면. `supportCampaigns`는 public/studio 로더가
매 요청 DB 조회해 실어 보내지만 UI 소비자 0(업 도움 정본은 이벤트 단위 is_support/support_url).
Change: proposals 라우트 삭제(404). Proposal/RequestItem/SupportCampaign 타입,
support_campaigns 쿼리(공개 8→7개·스튜디오 4→3개 병렬), 샘플/테스트 참조 제거.
DB 테이블 `support_campaigns` 자체는 보존(데이터 파괴 없음 — 스키마 정리는 별도 결정).
Validation: 소스 참조 grep 0, vitest 313 전부 통과, prod build OK. 공개 payload는 필드가
줄기만 함(새 노출 없음 — 경계 안전 방향).
Rollback: git revert 한 번(라우트·타입·쿼리 복원). 테이블 안 건드려 데이터 복원 불필요.

## v0.1.0 — 2026-07-26

### CHG-20260726-001 — FIX — 방송 세션 중복 유령 행 차단(bno unique, 0053)

Problem: recordLiveTick 동시 폴링 read-then-insert 레이스로 같은 bno 세션 행이 중복 생성.
자정(KST) 이후 중복은 start_day 다음날 귀속 → 방송 없는 날 "1분" 유령 막대(공개/관리자 인사이트).
Change: 0053 — 기존 중복을 bno별 최초 행으로 병합(last_live/ended 최대값) 후 삭제 + bno unique index.
`lib/broadcast/session.ts` insert 충돌 시 기존 행 잇기(닫혔으면 재개방).
Validation: 마이그레이션 적용 후 실데이터 조회 — 25일 617.8분 1행만 남고 26일 유령 소멸. prod build OK.
Rollback: `drop index broadcast_session_bno_uq` + session.ts 폴백 제거. 병합·삭제된 유령 행은 복원 불가
(전부 진짜 세션 범위 안의 중복이라 정보 손실 없음).
Docs: 커밋 0c10983

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
