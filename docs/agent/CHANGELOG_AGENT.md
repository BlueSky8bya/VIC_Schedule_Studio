# Agent Change Log

> git log가 1차 기록이다(한국어로 "왜"까지 적는다). 이 파일은 그 위에 **되돌리는 법과 검증 증거**를
> 남기는 자리다 — 되돌리기 비싼 변경, 마이그레이션, 공개 경계 변경만 적는다.
> 포맷·import 정리·소소한 오타는 적지 않는다.

## v0.1.0 — 2026-08-31

### CHG-20260831-006 — FEATURE — 날짜 창 인라인 플레이어 + 스크롤 잠금 + 타임라인 고속 수집

Problem: ① 창 안 스크롤이 끝에 닿으면 바깥 달력이 흘렀다 ② 챕터 클릭이 새 탭 이동뿐이라
미리보기 영역이 첫 컷 한 장짜리였다 ③ 뱅종 5분 안에 올라오는 팬 타임라인이 최대 30분 늦게 반영.
Change: ① body overflow 잠금 + .dvm-body/.vch-list overscroll-behavior: contain(이중 방어).
② 챕터/썸네일 클릭 = 미리보기 자리에서 **임베드 플레이어**로 그 시점 재생
(`/player/{no}/embed?change_second=` — 실측: 프레임 차단 없음·시킹 반영, 프리롤 광고는 SOOP 정책).
챕터 재클릭 = key 재마운트로 시점 갱신, 우상단 ↗ = 그 시점 새 탭. 모바일 아젠다는 기존 새 탭 유지
(onJump 없음). ③ broadcast-poll 두 단 주기: 뱅종 후 60분 = 5분마다(최신 3개 — 최악 10분 반영),
평시 = 30분마다 14일 스윕(팬의 나중 수정 흡수 — minutesSinceLastBroadcastEnd로 판정).
Files: `components/poster/{public-poster.tsx,public-poster.css,vod-chapters.tsx}`,
`lib/broadcast/vod-timeline.ts`, `app/api/cron/broadcast-poll/route.ts`
Validation: Playwright 실측 — overflow hidden·휠에도 scrollY 0·닫으면 해제, 인라인 iframe
change_second 1024→1948 갱신·실재생(프리롤 표시)·↗ 링크 · tsc/build exit 0.
Rollback: 커밋 revert(스키마 변화 없음).

### CHG-20260831-005 — MIGRATION — 날짜 다시보기 팝오버 → 중앙 '창' 승격 + 썸네일 미리보기(0072)

Problem: 팝오버가 작아 미리보기 없이 텍스트뿐(사용자 요청 — 작은 창 + 미리보기 + 링크 이동 +
스택 관리).
Change: 0072 vod_archive.thumb(SOOP 대표 스냅샷 URL) 저장 + 재백필(377건). 공개 DTO엔
`thumbKey`(rowKey만 — URL 접두 반복 전송 안 함). PC 날짜 클릭 → 화면 중앙 420px 창:
16:9 썸네일(클릭=재생, 재생 오브+길이 배지) + 제목 + 챕터. **히스토리 스택** = '이 달 기록'
시트와 같은 규약(pushState + pushInnerOverlay/popInnerOverlay + 메아리 pop 무시, popstate 한 곳).
Files: `db/migrations/0072_vod_archive_thumb.sql`, `lib/broadcast/vod-archive.ts`,
`scripts/backfill-vod-archive.mjs`, `lib/schedules/public-loader.ts`, `lib/domain/schedule-types.ts`,
`components/poster/public-poster.{tsx,css}`
Validation: Playwright 실측 — 창·썸네일·챕터 105개, 뒤로가기=창만 닫힘(페이지 유지),
백드롭 닫기 후 히스토리 잔여 0(추가 뒤로가기 정상 이탈) · tsc/vitest/build exit 0.
Rollback: 모달 → 이전 팝오버 커밋 revert, thumb 컬럼은 무해하게 잔존 가능.

### CHG-20260831-004 — MIGRATION/BOUNDARY — 팬 타임라인 챕터(0071) — Phase 2 A안 출고

Problem: 다시보기 링크만으론 "그 순간"을 못 찾는다. 팬 타임라인(89% VOD에 존재)이 댓글에 묻혀 있었다.
Change: 0071 `vod_timeline`(anon SELECT — 숲 공개 댓글 파싱본, service_role grant). 파서
`lib/broadcast/vod-timeline.ts`(HH:MM:SS 항목 + [코너] 헤더 정리, 최다 타임스탬프 댓글 선택),
백필 376개 중 335개(89%) 적재, 증분 = broadcast-poll 30분 주기에 최근 14일 8개 재수집.
공개 API: 번들 vods에 chapters/timelineBy 요약, 본문은 `/api/public/[slug]/vod-timeline?titleNo=`
(s-maxage 3600). UI `VodChapters`(팝오버·모바일 공용): 코너 헤더 그룹 + 구간 길이 표기 +
'타임라인 · ○○님' 크레딧, 항목 탭 = `?change_second=초` 점프(**실측 확정** — 구 changeSecond는
무효, 플레이어 번들에서 snake_case 확인). 스틸 트랙(SnapshotLoad 시간 파라미터)은 실측 결과
단일 대표컷뿐이라 보류.
Files: `db/migrations/0071_vod_timeline.sql`, `lib/broadcast/vod-timeline.ts`,
`scripts/backfill-vod-timelines.mjs`, `app/api/public/[calendarSlug]/vod-timeline/route.ts`,
`app/api/cron/broadcast-poll/route.ts`, `lib/schedules/public-loader.ts`,
`lib/domain/schedule-types.ts`, `components/poster/vod-chapters.tsx`,
`components/poster/public-poster.{tsx,css}`, `tests/unit/vod-timeline.test.ts`
Validation: 파서 유닛 6건 · change_second 브라우저 실측(3600 지정→3602 재생) · PC 팝오버(챕터
47개·코너·길이·href)·모바일(128개 리스트) 실측 · tsc/build exit 0.
Note: 작성자 닉 크레딧 공개 표기 — 팬 동의는 토리님 통해 받는 것 권장(미완 항목).
Rollback: UI·라우트 제거 후 `drop table public.vod_timeline`.

### CHG-20260831-003 — MIGRATION — 방송시간 통계에 다시보기(VOD) 폴백(0070) + 보는 달 앵커

Problem: broadcast_session은 2026-06 도입이라 그 이전 달의 방송시간이 모든 인사이트에서 0이었다.
또 시청자 '이 달 기록'의 월별 방송시간이 '오늘' 기준 6개월 고정이라 과거 달을 보면 항상 0.
Change: 0070 — 공개 RPC(get_public_broadcast_stats/daily)를 '세션 없는 날 = vod_archive 길이 합'
폴백으로 교체(세션 있는 날은 세션이 정답 — 이중 집계 금지, 구독 전용 VOD 포함 = 실제 방송 총량).
서버 로더(lib/insights/actions.ts)에도 같은 규칙의 mergeVodFallback — 개발자 트렌드·멤버 인사이트
공용. getPublicBroadcastStats에 anchor(보는 달) 추가 + broadcast 라우트가 year/month를 앵커로 전달
(앵커 달 이후는 잘라냄). 태그 인사이트는 생성된 과거 일정에서 자동 집계(코드 변경 없음).
Files: `db/migrations/0070_broadcast_stats_vod_fallback.sql`, `lib/insights/actions.ts`,
`lib/schedules/public-loader.ts`, `app/api/public/[calendarSlug]/broadcast/route.ts`
Validation: RPC 실측(2024-02 22.6h~2026-08, 월 누락 없음) · 시청자 2024-03 기록 실측(방송 시간
77시간 6분·월 트렌드·일별 막대·콘텐츠별 태그 섹션) · tsc/lint/build exit 0.
Rollback: 0049/0050 원문 재적용 + 로더 merge 제거.

### CHG-20260831-002 — DATA — 과거 일정 카드 자동 생성(≤2025-12, VOD 제목 유추) — v2 168건+태그

Problem: 일정 시스템 이전 시대(2024-02~2025-12)는 다시보기는 있는데 달력이 텅 비어
"그 날 무슨 방송이었나"를 칩 제목 말고는 알 수 없었다(사용자 지시 — VOD 제목으로 유추 생성).
Change: `scripts/backfill-history-events.mjs` — vod_archive의 broadcast_day ≤ 2025-12-31 중
일정 0개인 153일에 events 생성(캘린더 vic). v1(하루 1장·무태그)→v2(제목별 분리+태그)→
**v3(최종)**: '+'로 이어진 활동을 **각각 별도 일정**으로(224건), " - " 소제목 구조는 길 때만
줄바꿈 들여쓰기(main+sub 문법), **제목 키워드 → 태그 자동 부여**(콘텐츠 첫 매치 = 대표,
최대 6개 — 387건, 무태그 0). 사용자 정정 반영: 아르마·60 Minutes to Extinction 등 = 게임
(검색 확인), 빅이봤 = 카페보기(숲 방송국 보기), 괴식 = 소통, 프클 = 게임. "N시 " 접두는 각
VOD 첫 조각에만. 기본값 scheduled/public/stream. 멱등, --dry 미리보기, --purge 롤백.
Files: `scripts/backfill-history-events.mjs`, `db/backfills/2026-08-31-history-events.json`(생성 id 224건)
Validation: --dry 검토(무태그 0 확인) 후 실행, 2024-03·2025-11 그리드 실측(분리 카드·태그
색·2색 그라데이션·칩 공존 확인).
Rollback: `node scripts/backfill-history-events.mjs --purge db/backfills/2026-08-31-history-events.json`
— 전부 ≤2025-12-31 과거 달이라 시청자 실시간 화면 위험 없음.

### CHG-20260831-001 — MIGRATION/BOUNDARY — 숲 다시보기(VOD) 아카이브 + 공개 API `vods` 필드(0068)

Problem: 시청자가 지난 방송을 다시 보려면 숲 방송국을 직접 뒤져야 했다. 날짜↔다시보기 매핑·영상
길이 데이터가 사이트에 없었다(PLAN-20260831-001 Phase 1).
Change: `vod_archive` 테이블(0068, RLS enable + **anon SELECT 허용** — 공개 메타만: 번호·날짜·제목·
길이·조회수, 개인정보 없음. service_role DML grant 포함). 수집기 `lib/broadcast/vod-archive.ts`
(chapi vods/review, rowKey에서 방송 시작일·bno 추출, fail-soft) + broadcast-poll 크론이 오프라인
30분마다 1페이지 증분 동기화(새 행 생기면 revalidatePublicSchedule). 초기 백필
`scripts/backfill-vod-archive.mjs` — prod에 376건 적재 완료(스킵 0). 공개 API(PublicSchedule)에
`vods: {dateKey,titleNo,durationMs}[]` 명시적 DTO 추가(제목 미포함 — payload 절약), 시청자 날짜
상세에 '다시보기 (N시간 M분)' 칩(모바일 알약·PC 파랑 CTA, vod.sooplive.co.kr/player/{titleNo}).
Files: `db/migrations/0068_vod_archive.sql`, `lib/broadcast/vod-archive.ts`,
`app/api/cron/broadcast-poll/route.ts`, `lib/schedules/public-loader.ts`,
`lib/domain/schedule-types.ts`, `components/poster/public-poster.{tsx,css}`,
`scripts/backfill-vod-archive.mjs`, `lib/activity/labels.ts`, `tests/unit/vod-archive.test.ts`
Validation: tsc/lint/prod build exit 0 · vitest 11건(파싱·귀속) 통과 · anon REST 읽기 실측 ·
공개 API 응답 `vods` 376건 확인 · Playwright 실측(모바일 시트+PC 팝오버 칩 렌더, href 정상).
Note: 비공식 API — 실패 시 조용히 스킵, 기존 행 유지. `?changeSecond=` 점프는 Phase 2 검증 항목.
Rollback: 포스터 칩·로더 `vods` 제거 후 `drop table public.vod_archive` (데이터는 백필로 재생 가능).

## v0.1.0 — 2026-08-08

### CHG-20260808-001 — PERF/BOUNDARY — 공개 events API 익명화 + CDN 캐시(s-maxage=300)

Problem: `/api/public/[calendarSlug]/events`가 (a) `myHeartIds`(로그인 사용자 개인 하트 목록)를
싣고 쿠키를 읽어 매 요청 람다+DB 왕복(`Cache-Control: max-age=0`, X-Vercel-Cache 항상 MISS),
(b) 개인 필드 때문에 CDN 캐시를 걸 수도 없는 구조였다. 실측: 웜 ~100-180ms, 콜드 ~2.1s.
Change: `getPublicSchedule(slug, { includeMyHeartIds:false })` 옵션 추가(기본 true — 포스터 SSR
경로는 그대로). 라우트는 false로 호출해 응답을 완전 익명으로 만들고
`Cache-Control: public, s-maxage=300`(방송 라우트와 같은 한 겹 원칙, SWR 없음, Data Cache 300초와 동주기).
Files: `lib/schedules/public-loader.ts`, `app/api/public/[calendarSlug]/events/route.ts`
Validation: tsc/lint/prod build exit 0, `tests/unit/public-boundary.test.ts`·`server-timing.test.ts` 통과.
포스터 SSR은 이 라우트를 쓰지 않음(소비자 grep — e2e 테스트뿐)을 확인.
Note: 이 API만 편집 반영이 최악 CDN 300 + Data Cache 300 = 몇 분 늦을 수 있다(포스터는 revalidateTag로 즉시).
같이 실측한 것: 공개 payload gzip 19KB(events 278건) — 월 분할(Phase 6)은 아직 불필요, 50KB쯤에서 재검토.
Rollback: 라우트에서 옵션·헤더 두 줄 제거.

## v0.1.0 — 2026-08-02

### CHG-20260802-001 — FIX — 방송시간 머리/꼬리 손실 재시도 보정(0059)

Problem: 2026-08-02 4시간 방송(16:00:23~20:00:47)이 3시간 44분으로 과소집계. (a) 머리 ~10분 —
세션 insert 순간 방송국 API 실패로 started_at이 첫 폴링 시각으로 굳고, bno를 이미 알아 기존
머리 보정 분기는 영영 안 탐(보정 기회 1회뿐). (b) 꼬리 ~7분 — 뱅종 감지 순간 VOD가 아직 등록
전이라 last_live_at에서 보수적으로 닫고 재시도 없음.
Change: 0059 — `start_verified`/`vod_verified` boolean 추가. 라이브 tick마다 미확정 시작시각을
broad_start로 재보정, 오프라인 tick마다 최근 6시간 내 닫힌 미확정 세션을 VOD로 재보정. 성공 시
verified로 굳혀 API 호출 중단. 8/2 행은 VOD 정답값으로 백필(4.01h).
Files: `db/migrations/0059_broadcast_session_verify_flags.sql`, `lib/broadcast/session.ts`
Validation: 0059 적용 + 백필 후 실데이터 조회(4.0066h), tsc/lint/prod build OK.
Rollback: 컬럼 2개 drop + session.ts revert. 백필 이전 값은 started 16:10:07/ended 19:53:43.

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

### CHG-20260827-001 — REMOVE — 달력 꾸미기(스티커)·작업자 역할 철수, 테이블 drop (ADR-0015)

Problem: 관리자가 꾸미기를 안 쓰고(스티커 2행·에셋 12행·신뢰 멤버 0명) 작업자는 권한이 0개인 역할이 됐다.
Change: 꾸미기 라우트·팔레트·스티커 레이어·`api/sticker-write`·서버 액션·`public-poster.tsx` 스티커
  상태/좌표 매핑/툴바(~2,800줄)·CSS ~33KB 삭제. **공개 API DTO에서 `stickers`/`stickerAssets` 필드 제거**
  (`GET /api/public/vic/events` 응답 모양 변경 — 외부 소비자 없음). 작업자 역할 제거(매니저만).
  0065: `sticker_instances`·`sticker_assets` drop, 스토리지 정책·빈 버킷 삭제, `is_active_worker()`=false,
  `trusted_members.is_worker` drop. 레거시 `api/trusted-members`·`api/private-layer`·
  `studio/private-layer` 삭제.
Files: `components/poster/public-poster.{tsx,css}`, `lib/schedules/public-loader.ts`, `lib/domain/schedule-types.ts`,
  `lib/permissions/roles.ts`, `lib/auth/actor.ts`, `lib/trusted-members/actions.ts`,
  `components/trusted-members/trusted-members-panel.tsx`, `db/migrations/0065_retire_stickers_and_worker.sql`,
  `scripts/cleanup-sticker-storage.mjs`, 백업 `docs/agent/backups/2026-08-27_*`.
Validation: tsc·lint·build 0, vitest 618, 비주얼 77(지오메트리·포스터 기준선 의도 갱신). 배포 순서: 코드 push →
  Vercel 배포 확인 → 스토리지 비우기 → 0065 적용(옛 코드가 스티커 테이블을 읽으므로 순서 엄수).
Rollback: git 이력 + 백업 JSON/이미지. 스키마는 새 마이그레이션으로 재생성(되돌리기 비쌈 — 감수).

### CHG-20260827-002 — REMOVE — 월드컵/축구 시뮬 전부 삭제 (ADR-0009 Superseded)

Problem: `WORLD_CUP_UI_ENABLED=false`로 런타임 도달 불가인 코드 ≈15,500줄(미니게임·중력공·RL 시뮬·연구 문서)이
  빌드·테스트·검색 노이즈로 남아 있었고, 관리자가 재사용 의사가 없다.
Change: `components/seasonal`, `lib/football`, `tests/unit/football`, `docs/sim`, `lib/calendar/worldcup.ts`,
  `lib/ui/use-worldcup-visibility.ts`, `components/ui/pop-number.tsx` 삭제. `holidays.ts` DayMark에서 월드컵
  필드 제거, 포스터·편집실 토글/자동 테마/경기 칩/공 렌더 제거, CSS 제거. 공개 경계·DB 변경 없음.
Files: 위 + `components/poster/public-poster.{tsx,css}`, `components/studio/studio-shell.{tsx,css}`,
  `lib/calendar/{holidays,month}.ts`, `app/globals.css`.
Validation: tsc·lint 0, vitest 490(축구 테스트 12파일 삭제분 제외), 비주얼 스위트.
Rollback: git 이력(2026-08-27). 다시 넣는다면 dynamic import + opt-in(ADR-0009 원칙)으로.

### CHG-20260827-003 — REMOVE/PERF — 레거시 프레즌스·하트 객체 drop(0066) + 폴링 완화 + 죽은 코드 정리

Problem: 코드 소비자가 0인 DB 객체(visit_log·presence_ping·presence_hourly/peak/active_days·owner_sessions·
  calendar_hearts·add_calendar_heart)와 공개 로더의 `calendar_hearts` 쿼리, 검증용 일회성 스크립트 11개,
  죽은 CSS ~1,100줄이 남아 있었고, soop-live·presence 폴링이 25s로 과했다.
Change: `db/migrations/0066_drop_legacy_presence_and_calendar_hearts.sql`(멱등, 전부 if exists). 공개
  로더 5쿼리로(`PublicSchedule.heartCount` 필드 삭제 — 공개 DTO에서 필드 하나 제거, 값 노출 없음).
  `components/poster/use-soop-live.ts` 60s, `components/presence/presence-beacon.tsx` 60s(체류는 ended_at
  기준이라 정확도 손실 없음). `scripts/_verify_*.mjs` 삭제. CSS 1,101줄 제거.
Files: 위 + `lib/schedules/{public-loader,studio-loader,sample-data,sample-public-data}.ts`,
  `lib/domain/schedule-types.ts`, `components/poster/public-poster.css`, `components/studio/studio-shell.css`,
  `app/globals.css`, `db/migrations/README.md`.
Validation: tsc·lint 0, vitest 490, 비주얼 스위트, 죽은 CSS 재스캔 0(evt-pat 제외).
Rollback: 0011/0023/0024/0025/0026/0027 재적용(빈 객체) + 백업 JSON(`docs/agent/backups/2026-08-27_legacy-presence.json`)
  으로 행 복원. 코드는 git 이력.

### CHG-20260827-004 — DB/AUTH — unlock_sessions drop + has_private_unlock() grants 모델 이식 (0067)

Problem: 0057 이후 잠금해제 정본은 private_unlock_grants인데 RLS 함수 `has_private_unlock()`만 옛 `unlock_sessions`를
  읽어 사실상 항상 false였고(새 행 없음), 코드 3곳이 '혹시 남은 행 지우기'만 호출했다.
Change: 함수를 grants 모델로 이식(같은 사용자 + `auth.jwt()->>'session_id'` 결속 + 비밀번호 버전 + 미만료) 뒤 테이블
  drop. 코드: relockSessions·비밀번호 변경·로그인 콜백의 legacy delete 제거. `db/policies/0001_rls.sql` 함수 본문 동기화.
Files: `db/migrations/0067_drop_unlock_sessions.sql`, `lib/private-layer/{actions,unlock}.ts`, `app/(auth)/auth/callback/route.ts`,
  `db/policies/{0001_rls,0002_grants}.sql`.
Validation: 적용 후 테이블 부재·함수 본문 grants 참조·무인증 호출 false·정책 4개 유지·prod 200. tsc·lint 0, vitest 490.
Rollback: 0001_rls의 옛 함수 본문 + 테이블 재생성(데이터 가치 없음 — 만료 세션 1행뿐이었음).
