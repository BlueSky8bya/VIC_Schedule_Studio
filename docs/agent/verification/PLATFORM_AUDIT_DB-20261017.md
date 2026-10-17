# 서비스 전반 감사 — Supabase·데이터 경로

Updated: 2026-10-17 KST
Scope: PLAN-079의 DB 읽기·쓰기·캐시·집계·수집기·보존·운영 도구 조사. **조사 완료, 개선 미구현.**

저장소 소스와 공식 Supabase 문서를 검토했다. 운영 접근은 주 에이전트가 검증된 TLS·읽기 전용 트랜잭션과 제한된 익명 조회로 수행했다. 이 문서를 작성한 독립 조사자는 주 에이전트의 민감정보 없는 집계 결과만 읽었다. 제품 코드·스키마·환경·운영 데이터는 변경하지 않았다. 삭제·재빌드·부하 검사·유지보수 명령도 실행하지 않았다.

프로젝트 식별자·접속 호스트·계정/세션 식별자·자격증명·사용자 내용·원문 쿼리는 기록하지 않는다. 소스에서 확인한 제어 흐름, 실제 운영 집계, 아직 검증하지 못한 인과를 구분한다. 로컬 모의 검사나 서비스 역할 조회를 실제 로그인·RLS 증명으로 확대하지 않는다.

## 핵심 판단

먼저 고칠 곳은 **실패를 정상 빈 데이터로 캐시하는 경로**, **동일한 내용에도 전역 검색 파생 작업을 다시 수행하는 경로**, **다른 작업의 갱신 시각으로 그래프 재시도를 생략하는 경로**다. Redis 추가·연결 수 확대·일괄 인덱스 생성·대량 정리보다 원인과 결과를 분리하는 수정이 우선이다.

현재 DB는 **272.26MB / 259.64MiB**다. 과거 494MB 한도 사고를 현재 용량으로 인용하면 안 된다. 다만 실제 Supabase 요금제·전체 디스크/WAL 여유·백업 복구 가능성·보존 환경변수 상태는 이번 증거로 확정하지 못했다.

## 운영에서 확인한 사실과 한계

관측: 2026-10-17 09:16–09:20 KST. 집계·카탈로그 자료만 수집했다. 두 번째 익명 스키마 점검은 아래 접근 결과만 보존한다.

| 항목 | 확인한 값 | 해석의 한계 |
|---|---|---|
| DB 크기 | 272,256,147 bytes = 272.26MB / 259.64MiB. public 관계 합계 249,708,544 bytes | 실제 요금제 확인 없이 한도 사용률을 단정하지 않는다. DB 크기와 전체 디스크·WAL은 다르다. |
| 큰 관계 | 채팅 낱말 46.47MB, 낱말 관계 46.08MB, 채팅 구간 45.38MB, 챕터 색인 31.69MB, 채팅 작업 24.29MB, 행동 기록 20.06MB, 방문 구간 10.54MB, 성능 표본 9.76MB | 합계 크기는 인덱스·TOAST를 포함한다. 구성 요소를 다시 합쳐 중복 계산하지 않는다. |
| 실행 환경 | PostgreSQL 17.6, pg_cron 1.6.4, pg_net 0.20.0, pg_stat_statements 1.11. autovacuum ON, max_connections 60 | 측정에 나온 5000ms timeout과 읽기 전용 상태는 **감사 트랜잭션의 제한**이다. 운영 기본 timeout이나 DB 전체 읽기 전용 상태의 증거가 아니다. |
| 순간 연결·잠금 | 전체 backend 17개. client idle 14 / active 1, cron·net worker 각 1. 대기 잠금 없음 | 관측 순간의 상태다. 피크 연결·장애 시간의 잠금이 없었다는 뜻은 아니다. |
| 방문 UPDATE | 누적 7,324 UPDATE 중 HOT 7,211, 약 98.5% | last_seen_at 인덱스를 추가하면 현재 저렴한 UPDATE를 더 비싸게 만들 수 있다. 조회 비용을 먼저 측정한다. |
| RPC 누적 기준 | pg_stat_statements reset: **2026-09-28T02:34Z** | 아래 호출 수·시간은 그 이후 누적이다. 오늘의 요청률·p95·현재 지연이나 Vercel CPU가 아니다. 중첩 실행 시간도 단순 합산하지 않는다. |
| 주요 파생 RPC | 동의어 재빌드 1,722회 / 평균 2.34초 / 총 약 67.2분. 게임 분류 1,503회 / 평균 1.55초 / 총 약 38.9분. 야간 그래프 묶음 36회 / 평균 65.59초 / 총 약 39.4분 | 파생 작업이 빈번하다는 증거다. 모든 호출이 불필요했다는 증거는 아니다. 앞선 개별 집계의 21회·평균112초는 사용자 검색 지연으로 해석하지 않는다. |
| 사용자 검색 RPC | 공개 검색 106회 / 평균 470.16ms. 제안 363회 / 평균 242.79ms | 누적 평균이며 현재 p95나 개별 사용자의 체감 성능을 보장하지 않는다. |
| 임시 IO | DB 통계 temp bytes 약 23.59GB, 해당 통계 reset 시각은 null | 누적량이다. 일일 IO나 현재 디스크 점유량으로 바꾸어 말하지 않는다. |
| 채팅 체크포인트 | 미완료 135개 중 상태 보유 134개. 상태 저장 크기 합계 18,279,006 bytes, 최대 431,220 bytes. 완료 268개는 상태 없음 | 채팅 작업 테이블 24.29MB 전부가 찌꺼기라는 주장은 틀리다. 상당 부분은 복구에 필요한 미완료 상태다. |
| 체크포인트 TOAST | 24,125,440 bytes. 추정 live tuple 8,869 / dead 691. 최근 autovacuum 확인 | 상태 크기와 총 할당량 차이에는 TOAST·인덱스·페이지 여유 등이 섞인다. 단순 차감으로 회수 가능 용량을 추산하지 않는다. |
| 7일 cron | 야간 7회 성공, 최대 107.98초. 재시도 각각 7회 성공. 기대 정산·채팅 깨우기 각각 2,016회 성공 | 함수 내부에서 잡은 오류도 바깥 작업은 성공할 수 있다. pg_net의 요청 등록 성공은 HTTP 수집 완료와 다르다. 현재 최대 약108초는 공식 10분 권고 이내다. |
| 보존된 HTTP 응답 | pg_net TTL 6시간. 약 5시간55분 구간에 보존된 응답 72개, 모두 HTTP 200, timeout 0 | 보존 구간만 확인했다. 하루·7일 전체 성공률, 응답 본문의 수집 완료 여부는 증명하지 않는다. |
| 현재 행 규모 | 공개 범위 원본 이벤트 행 641개(삭제·초안 포함 가능). 아카이브 추정 415개 | 공개 반환 후보는 이 이하. 현재 기본 1,000행 경계 초과는 확인되지 않았다. 미래 성장 시 잘림 경로는 별도 결함 후보다. |
| 행동 보존 | 일반 행동 기록의 가장 오래된 날은 2026-08-04 KST | 관측일 기준 90일 이내이므로 정리 ON/OFF를 판정할 수 없다. **추가 보존 조회는 42703으로 실패했다.** 진단3일·방문 보존 검증 완료로 표시하지 않는다. |
| 내부 자료 권한 | 행동·일별 행동 집계·성능·방문·언락 테이블은 RLS ON, anon/authenticated SELECT 없음 | 권한 카탈로그의 일부 증거다. 실제 로그인과 전체 정책 동작을 모두 검증한 것은 아니다. |

### 익명 Data API 스키마 점검

내용을 요청하지 않는 `limit=0` 점검만 수행했다.

- `net` 스키마 선택: **406 / PGRST106**. 관측 시 해당 익명 Data API 경로는 net 스키마를 허용하지 않았다. 이는 앞선 빈 역할 GUC 조회보다 직접적인 증거다. 임의 SQL/RPC 우회 경로나 직접 DB 로그인 역할까지 안전하다고 확대하지 않는다.
- `activity_event` 직접 조회: **401 / 42501**. 익명 직접 읽기가 거부됐다. 실제 로그인한 시청자·개발자 흐름의 전수 검증을 대신하지 않는다.
- `public_schedule_events` 공개 뷰: **200 / 빈 배열**. limit=0의 의도한 응답이다. 공개 전 제목·태그·시간 가림을 실데이터로 재검증했다는 뜻이 아니다.
- net queue/response의 객체 SELECT 권한은 anon/authenticated에도 있지만 두 역할은 NOLOGIN이다. 공개 HTTP 노출과 직접 DB 접근을 구분한다. Vault에서 읽은 토큰도 pg_net 요청 헤더 안에서는 DB 접근 역할이 읽을 수 있다는 플랫폼 제약을 유지한다. 원본 헤더·명령·Vault 값은 수집하지 않았다.
- 공개 뷰의 `rls=false`는 뷰 메타데이터이므로 그 자체를 테이블 RLS 누락으로 분류하지 않는다. 실제 보호는 뷰 보안 모드·기본 테이블 정책·명시적 DTO와 가림 경로를 함께 봐야 한다.

## 소스 조사 결과 16개

P1/P2/P3는 개선 우선순위다. “소스 확인”은 현재 운영 사고 발생·빈도까지 확인했다는 뜻이 아니다. 아래 file:line은 조사 시점 소스 기준이다.

| ID · 우선순위 | 확인한 경로와 근거 | 개선안 · 검증 |
|---|---|---|
| **DB-01 · P1** 실패가 빈 일정으로 캐시 | `lib/schedules/public-loader.ts:266`–`:294`는 calendar-ID 조회 오류를 잡고 empty 반환. `:366`은 calendar data 부재를 오류와 구별하지 않는다. `:399`, `:440`은 tags/events data 부재를 빈 배열로 대체. 전체가 `:450`의 300초 캐시 안이다. | DB 오류는 실패로 전파하고 확인된 부재만 정상 빈 값으로 취급. 기존 성공 캐시 유지·복구 동작 검사. 모의 calendar/events/tags 오류를 각각 재현하고 공개 가림·DTO canary를 함께 확인. 실제 발생 여부는 미확인. |
| **DB-02 · P1** 동일 내용에도 파생 재빌드 | `lib/broadcast/vod-timeline.ts:111`–`:128`: ingest true면 saved 증가 후 전역 RPC 5종과 xlit. `db/migrations/0124_vod_timeline_variants.sql:59`–`:63`, `:67`–`:87`: 동일 내용도 projection UPDATE 후 true. `0076_public_search.sql:100`–`:103`은 entries 갱신 시 재색인. | 수집 시도 성공과 내용 변경을 구분. 동일 projection UPDATE·전역 재빌드 생략. RPC 계약은 버전/적용 순서·롤백을 갖춰 변경. 동일 내용·변경된 대표/대안·수동 고정/숨김·뒤늦은 수집기·채팅 revision을 합성 SQL fixture로 검증. 실제 절약 비율은 미산정. |
| **DB-03 · P1** 그래프 재시도 기준 오류 | `0129_search_graph_nightly_scale.sql:146`–`:160`은 trends가 오늘이면 재시도 생략. `app/api/cron/vod-chat/route.ts:39`–`:43`은 trends만 독립 갱신. 최신 nightly `0148_search_song_acronyms_retire.sql:14`–`:53`은 graph 오류를 잡고 trends 진행 가능. 운영 함수 구조의 제한된 카탈로그 점검도 이 조건을 확인. | 그래프 생성·swap 성공의 독립 마커 도입. graph 실패+trends 성공이면 재시도는 살아 있어야 하고, 성공 swap이면 충족돼야 함. 현재 graph가 실제로 낡았다는 증거는 없다. |
| **DB-04 · P1** 보존 운영 증거 미완료 | `lib/activity/retention.ts:8`–`:15`: 명시적 환경 플래그 때만 일반90일/진단3일 삭제. `PRIVACY-20260921.md:73`–`:77`의 방문 TTL 미설정 기록. 방문·cron 실행기록 자동 TTL은 소스에서 찾지 못함. | 플래그는 비밀 없는 enabled/disabled 여부만 확인. 최소 목적 보존 기간·제한된 백업·복구·별도 삭제 승인 확보. 실패42703 및 미검증 상태 유지. 자동으로 정리를 켜거나 데이터를 지우지 않는다. |
| **DB-05 · P2** 실시간 접속 조회 8회 | `app/api/developer/presence/route.ts:22`–`:36`: 같은 조건의 역할4·기기4 exact count. `lib/presence/live-types.ts:3`의 15초 poll. 개발자 탭1개당 최대32조회/분. | 같은 관측 시점의 역할·기기 집계를 서비스 전용 RPC1회로 통합 후보. 현재 비용을 먼저 측정. 401/403·private/no-store·정적 집계 DTO·실제 행 비노출 유지. 새 last_seen 인덱스의 HOT 비용도 평가. |
| **DB-06 · P2** 방문 쓰기는 탭 수에 비례 | `components/presence/presence-beacon.tsx:19`, `:128`–`:132`의 60초 heartbeat. `lib/insights/actions.ts:197`–`:226`의 UUID UPDATE. 행동 배치 `lib/activity/client.ts:16`–`:24`, `record.ts:108`–`:127`. | 보이는 탭 V개면 touch는 V/60회/초. 1,000탭이24시간 보인다는 가정은 약144만 UPDATE/일이며 신규행 수가 아니다. 실제 WAL·활성 시간·집계 정확도를 보고 간격/업데이트 정책 결정. 공개 캐시만으로 줄어드는 부하는 아님. |
| **DB-07 · P2** 전체 이력 조회의 행 상한 | 공개 events `public-loader.ts:334`–`:342`, studio events `studio-loader.ts:112`–`:125`는 날짜 제한·페이지 처리 없음. 공개 VOD `public-loader.ts:350`–`:355`는 최신1,000, 요약 `:358`–`:361`은 정렬 없는1,000. | 현재641일정·추정415VOD로 잘림 확인 없음. 향후 안정 정렬 페이지 처리 또는 의도한 조회 범위 정의. 기간 안내·잇기·다른 달 탐색 보존. VOD 요약은 실제 반환 아카이브와 범위 일치 검토. API max_rows 일괄 확대는 피함. |
| **DB-08 · P2** 일부 페이지만 받고 성공 | `lib/db/paginate.ts:21`–`:32`는 페이지 오류 시 누적분 반환, 50,000 hard cap도 무표시. `lib/activity/query.ts:101`–`:109`, `:228`–`:241`, `:364`–`:382`는 이를 정상 결과로 응답. 일부 페이지 경로는 고유 안정 정렬 없음. | completeness/오류/상한 상태와 안정된 고유 순서 제공. 실패 때 이전 화면 유지 또는 명시적 재시도. 페이지2 오류·중복 경계·hard cap 검사. 현재 특정 조회가 잘렸다는 주장은 아님. |
| **DB-09 · P2** 숨김 상태의 내부 재조회 | `components/developer/insights-dashboard.tsx:426`–`:434`는 월별 방문20초 갱신에 hidden 검사 없음. `day-visit-modal.tsx:88`–`:94`는 hidden 검사가 있으나 detail·timeline·usage 원본을30초마다 다시 요청. | 기존 visibility 규약 재사용, hidden/unmount 취소·single-flight. 합산이 필요하면 서비스 전용 RPC 검토. 보이는/숨김/복귀 요청 횟수·이전 화면 보존 검사. 개인 자료를 공개 집계 API에 옮기지 않음. |
| **DB-10 · P2** 라이브 miss·동기화 중복 | `app/api/soop-live/route.ts:23`–`:44`는 완료값 캐시만 있고 진행 Promise 없음. `vod-timeline.ts:143`–`:174`, `:197`–`:204`는 시각 SELECT 후 실행하므로 원자적 작업 claim 아님. | 같은 프로세스의 진행 작업을 먼저 합침. 동시 호출·실패 후 복구·TTL 검사. 여러 인스턴스의 실제 중복이 확인될 때만 짧은 DB claim 검토. CDN/프로세스 캐시를 전역 잠금으로 설명하지 않는다. |
| **DB-11 · P2** 채팅 CAS는 사전 연산 중복을 막지 않음 | `0127_vod_chat_pick_recent_first.sql:9`–`:28`은 due 목록을 lease 없이 선택. `0126_vod_chat_recovery.sql:48`–`:71`과 현재 `0130:19`–`:43`은 commit에서 revision 잠금/검증. `vod-chat.ts:233`–`:337`의 외부 수집은 그 전에 수행. | CAS의 정합성 보호 유지. cron·강제·수동 실행 겹침이 실제로 있는지 측정 후 claim 판단. `.github/workflows/vod-chat-backfill.yml:9`–`:12`에서 중복 정기 GH 실행은 이미 제거됨. 과거 구조를 현재 중복 runner로 세지 않음. |
| **DB-12 · P2** 기록 저장 성공의 과대 보고 | `lib/activity/record.ts:111`–`:128`은 PostgREST 반환 error를 확인하지 않고 `:168`에서 rows.length 반환. `app/api/activity/route.ts:34`–`:35`은 이를 saved로 응답. | 수락/확인된 저장을 구분하고 정적 오류코드·집계만 관측. payload·계정 식별자 기록 금지. 실패가 제품 조작을 막지 않는 원칙 유지. 모의 권한/쿼터 오류에서 nominal saved가 실제 저장 증거로 쓰이지 않도록 검사. |
| **DB-13 · P2** 이전 운영 도구의 TLS 우회 | 현재 `scripts/apply-db.mjs:50`은 검증. 이전 `verify-db.mjs:17`, `verify-seed.mjs:17`, `backfill-secret-cipher.mjs:102`, `backfill-broadcast-times.mjs:44`, `taxonomy-probe.mjs:24`, `audit-colors.mjs:51`, `recolor-tags.mjs:50`, `darken-tag-text.mjs:42`, `sort-tags-by-usage.mjs:13`은 인증서 검증 해제. | 검증된 TLS/공식 CA 공통 도구로 통합하는 별도 수정 후보. 이 감사에서 이전 도구 실행·자격증명 출력 없음. 모의 인증서 오류 때 연결 거부 계약 검증. |
| **DB-14 · P2** pg_net 자격증명 접근 조건 | `0128_pg_cron_vod_chat_trigger.sql:35`–`:46`이 Vault Bearer를 pg_net 헤더에 넣음. 객체 SELECT 권한 존재, anon/authenticated NOLOGIN. 이번 익명 net 요청은406/PGRST106. | 해당 Data API 스키마 경로 차단은 확인. 직접 DB 로그인 역할·SQL/RPC 우회는 별도 검토. 헤더·작업 명령·Vault 원문 수집 금지. 권한을 임의 변경하거나 실제 유출/무유출을 단정하지 않음. |
| **DB-15 · P3** 관측 자체의 쓰기 비용 | `lib/perf/perf.ts:55`, `:75` → `record.ts:10`–`:18`은 production 측정 구간마다 INSERT. PERF_LOG=off는 console만 끔. 공통 SSR은 actor·schedule 구간, miss는 내부 DB 구간도 발생. | 라벨별 표본/배치 후보를 실제 비용으로 판단. 오류 표본·대표성 보존. 브라우저 쓰기를 가로채도 서버 after 쓰기까지 차단됐다고 주장하지 않음. 기존 sample fixture 자체에는 timed 호출이 없어 과거 특정 검사가 DB에 썼다고 단정하지도 않음. |
| **DB-16 · P3** warm 성공 상태 오판 | `app/api/warm/route.ts:20`의 의도한204와 `.github/workflows/warm.yml:37`–`:38`의200기대가 불일치. cold cache에서는 loader의 내부 timed가 실행돼 무조건 성능표본0이라는 설명도 정확하지 않음. | 정상204 허용, 실제 비정상 응답 경고 보존. 모의204/200/실패 상태 검사. 경고가 있었다고 워밍 자체가 실패했다는 뜻은 아님. |

## 비용 경로와 유지할 방어

- 공개 일정: 익명 데이터300초, calendar ID3,600초, 하트 집계60초 캐시. 일정 miss는8개 병렬조회. 로그인 사용자의 myHeartIds는 별도 비캐시이고 익명은 세션 쿠키가 없으면 생략한다(`public-loader.ts:125`–`:196`, `:309`–`:362`, `:454`–`:473`). 개인 응답을 공유 CDN 캐시에 넣지 않는다.
- 최초공개: masked view 기반 canonical RPC, CDN 평시15초/임박1초, Data Cache1초·진행 요청 합치기128key(`public-loader.ts:29`–`:61`, `teaser-state-cache.ts:1`–`:17`). 변경 전파와 공개 경계를 유지한다. 기대 정산은5분 cron에만 있으며 시청자 요청에 다시 붙이지 않는다(`teaser-actions.ts:14`, `0140:75`–`:115`).
- 방문·행동: 보이는 콘텐츠부터 기록, 숨김/이탈 종료·KST 자정 분리. 행동은20건/5초 유휴/15초 상한 배치, 시청자·비로그인 일별 개수 집계. 포인터·프레임·자율 빅타민 동작을 사용자 사용량으로 늘리지 않는다.
- VOD: 타임라인 선택은 전체 archive/timeline 메타를500행씩 읽어8개 고름(`vod-timeline.ts:247`–`:263`). 현재 규모는 작아 두 메타 페이지가 핵심 병목이라는 증거는 없다. 전역 파생 작업·복구 상태·전체 deadline이 우선이다.
- 채팅: 35초 시간 예산·chunk 상한·실패 backoff·완료 상태 null·revision CAS가 이미 있다. 실제 채팅 원문이나 발화자 ID는 저장하지 않는 설계를 유지한다. 관측한18.28MB 미완료 상태를 지워서 절감하지 않는다.
- 서비스 클라이언트는 쿠키 없는 process singleton(`lib/auth/admin.ts:10`–`:28`), 쿠키 클라이언트는 요청마다 생성(`server.ts:7`–`:40`)한다. HTTP 클라이언트 객체 생성 횟수를 직접 Postgres 연결 수로 계산하지 않는다.
- `guardedFetch`는10초 상한과 GET/HEAD1회 재시도, POST 재시도 금지(`lib/net/guarded-fetch.ts:15`–`:43`). 재시도 포함 읽기 상한은 약20.15초일 수 있다. 바깥 timeout15초가 안쪽 요청을15초까지 늘려주는 것은 아니다.
- 기존 색인·상위K 관계·16bucket 집계·옆 표 swap·30일 perf 정리가 있다(`0137_search_relations_swap.sql:117`–`:219`, 최신 묶음0148). 출력 topK가 중간 문서별 낱말쌍 연산량까지 제한하는 것은 아니다.
- 새 인덱스는 실행계획·현재 크기·쓰기/HOT 비용 확인 후 제안한다. 최신/최장 synced_at, live last_seen_at, events 정렬 suffix 후보가 있지만 일괄 DDL을 권장하지 않는다.

## 개선·검증 순서

1. **작은 실패 경계:** DB-01 오류/부재 분리, DB-10 진행 작업 공유, DB-09 hidden 갱신, DB-16 warm 상태. 모의 실패·동시 요청·복귀·공개 canary로 확인.
2. **파생 수집기:** DB-02 내용 변경 gate, DB-03 그래프 성공 마커, 전체 call chain deadline·재개. 적용 순서·롤백을 갖춘 추가 마이그레이션 후 합성 과거 fixture로 정합성·숨김/대표/채팅 revision 검증. 운영 현재·미래 달 시험자료 금지.
3. **집계와 완전성:** DB-05 서비스 전용 grouped RPC, DB-07/08 안정 페이지·완전성 상태, DB-12 실제 저장 확인. 익명/권한 없음 거절과 명시 DTO 유지.
4. **용량·운영:** 실제 요금제·디스크·WAL·백업·보존 플래그·작업 성공 시각을 별도 확인. 누적 통계는 재설정하지 않고 두 시점 차이로 비교. 원문 쿼리 없이 고정 RPC 이름·카운터만 사용.
5. **실행하지 않은 것:** 대량 DELETE/TRUNCATE, VACUUM FULL, stats reset, work_mem/max_connections 확대, cron 해제, 키 변경·전체 인덱스 생성. 별도 영향·백업·권한·복구 검토가 필요하다. 관측된 숫자만으로 정리 완료나 필요성을 선언하지 않는다.

## 공식 자료와 증거 해석

- [Database and Disk Size](https://supabase.com/docs/guides/platform/database-size): DB와 디스크/WAL은 다르다. 삭제 뒤 물리 공간이 바로 줄지 않으며 FULL vacuum은 잠금·일시 부하가 따른다. 요금제별 한도를 실제 계정에 확인하기 전 적용하지 않는다.
- [Connection management](https://supabase.com/docs/guides/database/connection-management), [pooling limits](https://supabase.com/docs/guides/database/connecting-to-postgres/pooling-and-limits): PostgREST·Auth 등도 연결 자원을 쓴다. 순간 연결 수와 실제 피크를 구분한다.
- [Index guidance](https://supabase.com/docs/guides/database/postgres/indexes): 색인은 읽기 이득과 쓰기·저장 비용을 함께 평가한다.
- [pg_stat_statements](https://supabase.com/docs/guides/database/extensions/pg_stat_statements), [Inspect](https://supabase.com/docs/guides/observability/inspect): 누적 카운터와 순간 상태는 임의 과거 기간의 통계가 아니다.
- [Data API row limit](https://supabase.com/docs/reference/python/select): 기본 최대1,000행과 페이지 조회를 설명한다. 현재 프로젝트의 실제 max_rows는 별도 설정이다.
- [Cron](https://supabase.com/docs/guides/cron): 권고는 동시8개 이하·작업10분 이내다. 소스의20분 상한만으로 현재 실행이 권고를 초과한다고 하지 않는다.
- [pg_net](https://supabase.com/docs/guides/database/extensions/pg_net), [queued headers 제약](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357): 응답 기본6시간 보존과 DB 접근 역할의 헤더 읽기 제약. 이번 스키마 점검의 제한된 결과와 함께 해석한다.

이 문서는 조사·집계 확인 기록이다. 079의 제품 수정 검사 PASS, 실제 로그인 전수 검사, 과거 유출 부재, 백업/정리 완료를 주장하지 않는다. 실패한 보존 조회와 외부 설정 미검증 항목은 계속 열린 상태다.
