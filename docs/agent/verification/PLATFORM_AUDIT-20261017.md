# 서비스 전체 운영·비용·신뢰성 감사 — 2026-10-17

Status: 조사 완료, 개선 미적용. 기준 소스 `965cc950` / 제품 `887f6d4b`. 관측 시각은 별도 표시하며 문서 날짜는 KST.

## 판단

현재 우선순위는 **검색어 원문 로그 차단 → 공개 일정 오류 캐시 수정 → warm timeout 원인 계측 → 중복 수집·검색 재빌드 억제**다. Vercel의 선택 기간 CPU·메모리는 Hobby 포함량을 초과했다. DB는 약272MB이며, 공간 정리보다 반복 파생 계산과 요청 증폭을 먼저 줄일 근거가 있다. 관측값만으로 현재 서비스 중단·추가 청구·실제 개인정보 유출·전체 용량 안전을 선언하지 않는다.

조사는 Vercel 로그인된 dashboard, Supabase 읽기 전용 집계/카탈로그, 코드, 공식 문서, 격리된 결함 재현을 결합했다. **제품·의존성·운영 설정·DB 데이터는 수정하지 않았다.** 운영 부하 시험, 삭제, 마이그레이션, 재색인, VACUUM, 플랜 변경도 하지 않았다. Supabase dashboard는 로그아웃 상태여서 실제 플랜·계정 한도·전송량·백업/PITR 설정은 미확인이다.

세부 근거: [Vercel/Next](PLATFORM_AUDIT_VERCEL-20261017.md), [Supabase/DB](PLATFORM_AUDIT_DB-20261017.md), [보안·복구·클라이언트](PLATFORM_AUDIT_RELIABILITY-20261017.md), [의존성](PLATFORM_AUDIT_DEPENDENCIES-20261017.md). 각 항목의 소스 확정, 운영 관측, 가설, 미실행 검증을 구분한다.

## 1. Vercel 실제 관측

Hobby 확인. Usage의 **Last 30 Days** 선택, UI 표시 기간은 `Sep 16, 오후 06:00 – Oct 16, 오후 06:00`. UI에 표시된 기간을 그대로 기록하며 KST로 재해석하거나 청구 주기라고 부르지 않는다. 팀 전체와 프로젝트 수치가 거의 같았고, 아래는 먼저 읽은 프로젝트 집계다. 포함량은 같은 UI와 [공식 Hobby 한도](https://vercel.com/docs/plans/hobby)를 대조했다. Hobby에는 청구 주기가 없으며, 자원별 제한 방식은 같지 않다.

| 지표 | 프로젝트 사용량 | 표시된 포함량 | 해석 |
|---|---:|---:|---|
| Active CPU | 6시간47분 | 4시간 | 초과. 팀 후속 관측은6시간48분 |
| Fluid Provisioned Memory | 460.1GB-hours | 360GB-hours | 초과. 실제 heap 사용량과 다른 계량 |
| Function invocations | 135,884 | 1,000,000 | 횟수보다 실행 비용 우선 |
| Function timeout | 2,442 / 1.8% | — | 전체 선택 기간. 최근 창의 비율과 구분 |
| CDN requests | 183,161 | 1,000,000 | 현재 여유가 미래 동시 접속 보장은 아님 |
| Fast Data Transfer | 3.83GB | 100GB | 팀 후속3.84GB |
| Fast Origin Transfer | 1.3GB | 10GB | 이미지 전송이 현재 최우선 병목이라는 근거 없음 |
| Speed Insights | 9,578 | 10,000 | 포함량에 근접 |
| Web Analytics | 3,022 | 50,000 | 자체 방문/행동 DB 기록과 별개 |
| Build Time | 약10시간 | 100시간 | Build CPU33시간58분과 직접 비교 금지 |
| Data Cache | 읽기939,766 / 쓰기450,863 | 이 화면에서 미표시 | 전송7.32GB / 쓰기3.45GB; 사용자 수·DB 쿼리 수와 동일하지 않음 |
| Images / Middleware·Edge | 각 표시 사용량0 | — | 정적 이미지·모든 middleware 비용이 없다는 증명은 아님 |
| Vercel cron | 30회 | — | DB pg_cron과 다른 실행원 |

Functions 설정 UI에서 **Fluid ON, 서울icn1, Standard1vCPU/2GB** 확인. MaxDuration 입력은 빈 값·placeholder300초였다. 명시된 프로젝트 override는 보이지 않았으며, 배포 함수별 유효 설정/실제 timeout 지속 시간은 별도 확인이 필요하다. 설정을 저장하지 않았다.

Production Observability **Last12h, UI 10월16일21:20–17일09:20** 관측: 약2.2K invocations, Timeout10.5%, Error0%, CPU P75 591ms, 사용 메모리 평균242MB/할당2.05GB, CPU throttle P75 6.9%, TTFB P75 212ms, cold start17.8%.

| 화면에 보인 주요 경로 | 호출 | Active CPU 합 | 행 Error Rate |
|---|---:|---:|---:|
| `/api/warm` | 152 | 2분 | 41.4% |
| `/_not-found` | 268 | 1분 | 0% |
| `/` | 254 | 1분 | 0% |
| `/api/soop-live` | 364 | 33초 | 0% |
| `/studio` | 97 | 22초 | 0% |
| `/api/cron/vod-chat` | 148 | 15초 | 0% |
| `/api/presence` | 309 | 11초 | 0% |
| `/api/activity` | 181 | 7초 | 0% |
| 공개 teaser-state | 137 | 4.53초 | 0% |
| 공개 clock | 325 | 4.52초 | 0% |

전체30행 가운데 당시 보인10행이다. warm 상세를 조금 뒤에 열었을 때149회/Timeout37.9%/Error0%로 표시됐다. 서로 다른 이동 시간창·집계를 섞어 정확한 건수로 역산하지 않는다. 행 Error Rate를 HTTP500 비율이라고 부르지 않는다. **Duration 차트는 Pro 안내와 함께 Demo Data로 표시되어 실측에서 제외했다.**

warm은 전체 공개 로더를 기다리고 자체 전체 deadline이 없으며 catch 뒤 항상204다(`app/api/warm/route.ts:9–26`). 플랫폼 timeout이 집중하는 것은 확인했으나 어느 단계가 원인인지는 미확정이다. 다음 조사는 원문 없는 route/stage/timeout-code 집계와 배포별 유효 duration이다. 인증 middleware, DB 재시도, Data Cache 대기, 외부 워밍 주기는 후보이며 확정 원인으로 쓰지 않는다.

[Fluid 과금 규칙](https://vercel.com/docs/functions/usage-and-pricing)상 I/O 대기와 Active CPU, 공유 인스턴스의 할당 메모리 시간은 다르다. `timeout 수 × 300초 × 2GB`는 실제 메모리 비용 분해가 아니다. CPU 상위 경로와 장기 점유 경로를 따로 계측해야 한다. 현재 수치만으로 유료 전환 필요 여부나 개선 후 절감률을 확정하지 않는다.

## 2. Supabase 실제 관측

10월17일09:16·09:20KST, 인증서/호스트 검증 TLS + READ ONLY transaction. 각 쿼리5초/lock500ms 상한, 순차 카탈로그·집계만 실행하고 rollback했다. 이5초는 **조사용 세션 설정**이며 운영 기본값이 아니다. SQL 통계문은 서버 내부의 고정 RPC 분류에만 사용하고 원문을 응답·로그·자료로 반환하거나 보관하지 않았다. 일정/채팅 본문, 계정·세션·이메일, Vault/cron command/HTTP headers는 조회·보관하지 않았다. 연결 자격증명은 로컬 환경에서 읽어 연결에만 사용했으며 출력·보관하지 않았다.

| 지표 | 관측 | 범위/한계 |
|---|---|---|
| DB 크기 | 272,256,147bytes =272.26MB /259.64MiB | Postgres가 보고한 현재 DB 파일 크기; dead/free 페이지 포함. 전체 provisioned disk/WAL 여유와 다른 값 |
| 큰 relation | terms46.47MB, relations46.08MB, bins45.38MB, chapter index31.69MB, chat job24.29MB | relation 합계는 heap/index/TOAST 포함. 크기만으로 삭제·인덱스 제거 결정 금지 |
| 방문/기록 | activity20.06MB, visit10.54MB, perf9.76MB | 대략 행 수는 통계 추정치. 목적·보존 정책 함께 검토 |
| 접속 | 17 / max_connections60 | idle client14, 조사 active1, background2. 짧은 순간 관측이며 최대 부하 여유 증명 아님 |
| 잠금/교착 | 대기 잠금0, 누적deadlock0 | 관측 순간/통계 기간 한정 |
| 임시 파일 | 누적2,981개 /23.59GB | stats reset 불명; 현재 디스크 점유·하루 발생량 아님 |
| pg_stat_statements reset | 9월28일11:34:36KST | 아래 함수 통계의 누적 기준. p95/현재 TPS/일일 비용 아님 |
| 공개 범위 원본 이벤트 행 | 641개, teaser 이력 필드 해당0개 | 삭제/초안 포함 가능, 반환 후보는 이 이하. 현재1,000행 제한 아래지만 미래 누락 위험은 남음 |
| 체크포인트 | 미완료135개 중134개 state있음, 합18.28MB | 완료268개는 state모두NULL. 큰 TOAST를 모두 찌꺼기라고 부르면 안 됨 |
| 보존 | activity의 가장 이른 날짜8월4일 | 정상90일 내. cleanup flag ON이나 진단3일 정책 준수 증명 아님 |

동일 누적 기간의 named RPC 집계는 `synonyms_rebuild`1,722회/총67.18분, `game_refresh`1,503회/38.90분, `nightly`36회/39.36분, `timeline_ingest`12,024회/13.20분, 사용자 `search_public`106회/49.84초였다. 유지보수 계산을 먼저 살필 근거다. 내부 중첩 집계 가능성을 고려해 합산 총 DB CPU나 Vercel CPU로 환산하지 않는다. 처음 보인 평균112초는 nightly 일부 statement 집계이며 **사용자 검색 응답 시간이 아니다.**

활성 pg_cron: graph03:20KST+05:20/07:20 retry, teaser 정산5분, chat trigger5분. 최근7일 cron wrapper는 성공으로 표시됐다. chat cron 성공은 HTTP 작업 enqueue 성공일 수 있다. pg_net의 실제 TTL은6시간, 보존된 약5시간55분 **72개 응답만** HTTP200/timeout0이었다. 이를24시간 전체 성공률 또는 내부 파생 계산 성공으로 확대하지 않는다.

민감 raw activity/perf/visit/unlock relation은 anon/authenticated SELECT가 닫혀 있고 RLS가 켜져 있었다. 반면 net schema/queue grants는 넓어 별도 검토 대상이다. 후속 **익명 zero-row REST**는 net406/PGRST106(노출 schema 아님), activity401/42501(거부), 공개 view200/빈배열을 반환했다. 민감 행/headers는 받지 않았다. 이 경로가 닫힌 증거이며 실제 로그인 역할·RPC bridge·storage·과거 유출 전체 검증은 아니다. [Supabase pg_net 공식 주의사항](https://supabase.com/docs/guides/troubleshooting/database-roles-can-read-request-headers-queued-by-pg_net-ad6357)과 대조했다.

진단/visit/perf 보존 범위 추가 쿼리는 컬럼 불일치42703으로 실패했다. 실패 원본을 보존했고 해당 보존 범위는 미확인으로 남긴다. [DB disk 안내](https://supabase.com/docs/guides/platform/compute-and-disk), [백업 안내](https://supabase.com/docs/guides/platform/backups)는 일반 기준이며 현재 계정 설정의 증거가 아니다.

## 3. 중복 제거한 개선 목록

P1은 우선 수정/원인 계측, P2는 다음 묶음. 운영 발생 빈도나 악용이 미확인인 항목은 그대로 명시한다. 상세 변경안과 추가 소스는 각 분야 보고서에 있다.

| ID/우선 | 확인한 경로·근거 | 개선과 합격 기준 |
|---|---|---|
| 01/P1 | 검색 RPC 실패 시 raw `q`와 error.message를 console에 전달. `public-loader.ts:741–744` | 고정 오류 분류만 기록. 실패 경로의 오류 응답·운영 로그·telemetry에 합성 민감 canary 원문 없음. 실제 과거 유출은 조사하지 않음 |
| 02/P1 | critical DB 오류를 정상 빈 일정/태그로 반환, outer cache300초. `public-loader.ts:265–295,365–368,399–400,440–450` | 실제 부재와 장애를 구분, 정상 snapshot을 장애 빈 값으로 덮지 않음. 실패 no-store/재검증과 복구, teaser fail-closed 함께 검증 |
| 03/P1 조사 | warm 최근 timeout 집중, 자체 전체 budget없음. `app/api/warm/route.ts:15–24` | 고정 stage·배포·timeout-code 집계로 병목 확인 후 bounded 처리. warm을 끄거나 duration만 늘려 해결했다고 하지 않음 |
| 04/P1 | 완료값만 캐시해 cold/만료 동시 miss마다 외부 조회·기록·after 시작. `soop-live/route.ts:18–35`, `vod-timeline.ts:149–157,196–204` | 실패 finally까지 in-flight 공유, 성공 완료 기준 TTL. 모의1/100/1000요청·2인스턴스 비교, 원자 lease는 실제 중복 필요 확인 후 검토 |
| 05/P1 | 변경 없는 timeline ingest도 true→5개 global refresh. `vod-timeline.ts:111–128`, `0124:59–87`, `0076:100–103` | distinct-content gate/파생 계산 묶음. bool RPC 계약·moderation·동시성 보존. unchanged 입력은 global rebuild0, 실제 변경은 필요한 항목만 갱신 |
| 06/P1 | graph retry는 trends 날짜를 확인하지만 별도 collector도 trends갱신; nightly는 일부실패 catch. `0129:146–160`, `0148:14–53`, cron/vod-chat:39–43 | graph 성공 marker 독립. graph실패+trends성공 때 retry가 실행되어야 함. 현 graph가 stale하다는 실측은 없음 |
| 07/P1/P2 | 저장 A실패→B성공 시 전체 상태 failed→saved. `use-write-queue.ts:80–103` | 미해결 실패 상태 의미 정의, 명시 재시도/개별rollback 보존. 실제 헤더 fixture로 확인. 데이터가 항상 조용히 유실된다는 뜻은 아님 |
| 08/P2 | live60초 hidden/offline gate없음; teaser15초 discovery·clock복귀3회. `use-soop-live.ts:19–43`, `use-teaser-premiere.ts:178–208`, `synced-clock.ts:65–85` | hidden/offline 중지, 무떡밥 느린 discovery·임박 fast lane 유지. OFF에서도 공개 변경 감지 계약 보존, 10분 request counter 비교 |
| 09/P2 | 온라인 navigation 뒤 별도 익명SSR snapshot, 진행promise없음. `public/sw.js:27,34–47,140–143` | single-flight·지속 freshness·waitUntil. 로그인 HTML 재사용 금지. 다중 탭/오프라인/개인 canary 검사 |
| 10/P2 | SSR perf insert2개, presence heartbeat60초, 개발자15초마다 count8개. `app/page.tsx:18–25`, `perf/record.ts:14–18`, `presence-beacon.tsx:128`, developer/presence:22–36 | 표본/집계 정책과 정확도 함께 결정. 1개 grouping snapshot 후보. 방문1000탭의 heartbeat는 약16.7update/s라는 모델이며 실측 아님 |
| 11/P2 | collector35초+후처리5/15초+선행시간, deep sweep무상한. cron/vod-chat:11,31,40–45; archive:273–308 | 공통 monotonic absolute deadline·재개 cursor·부분 성공. 미완료 sweep은 삭제용 complete로 취급 금지 |
| 12/P2 | 임의 slug/query로 cache key 분산, 전체 일정 pagination없음. public events:11–19; search:15–22; public-loader:334–342; studio-loader:112–125 | 외부 계약 확인 후 canonical allowlist/limit, 합성1001행 pagination·private/teaser 경계 검사. 현재 공개 범위 원본641행이라 누락 발생 주장은 아님 |
| 13/P2 | activity cleanup opt-in defaultOFF, visit/cron history TTL미정. `activity/retention.ts:8–15` | production flag boolean·실제 cutoff 증거와 복구/최소수집 정책 확보. 조사만으로 삭제/cleanup ON하지 않음 |
| 14/P2 | legacy 운영 스크립트 TLS검증해제, middleware의 auth 네트워크에 guardedFetch/deadline미적용. `verify-db.mjs:17` 등 DB보고서DB-13; `middleware.ts:16–36` | 검증 CA 공통 연결·네트워크guard 재사용. 기존 auth권한/쿠키/Edge호환 검증. 현재 middleware Node메모리 비용 원인 단정 금지 |
| 15/P2 | warm204인데 workflow200만 정상, 실패warning-only. `.github/workflows/warm.yml:32–38` | 204/503/network fail 계약 검사. 품질 gate workflow추가 시 기존 실패 정리와 분리 |
| 16/P2 | IPv6 loopback host split오류, activity byte/rate상한 보강 후보. `analytics/guard.ts:28–31`, activity/route:9–35 | 순수Headers 검사·격리 payload/rate검사. 운영 통계 오염/악용 발생을 확인한 것은 아님 |
| 17/P2 | 월toast 정렬 transform을 animation이 덮음. `month-picker.css:134–140,464–481` | 정렬/animation transform 소유권 분리, 기존 회귀검사와 실제 모바일 등장/종료 캡처 |
| 18/P2 | 양쪽 popover idle에도 매rAF 위치측정. public-poster:1275–1310; studio-shell:3171–3218 | scroll/resize/FLIP 활성 lease 기반 전환 후보. 두 화면 anchor/drag/월이동 동등 검사, 전체 UI idle비용 계측 |
| 19/P2 | production dependency advisory 조건 일치 버전, 실제 도달 조건은 제한적 | Next15.5.27/sharp0.35.5/source-map-js1.2.2 이상 검토. 아래 조건·재검사 포함 별도 유지보수 변경 |
| 20/P2 검증 | unit8/harness2 기존FAIL, CI는 운영cron3개만 | 실제 결함/오래된 oracle/생성inventory 구분. 규칙 삭제·정책 회귀·테스트 무력화 없이 품질 gate 구축 |

공개 DTO·개인 하트 비캐시 분리, DB now() teaser 가림, server role/unlock 검증, 직렬 쓰기, POST 자동 재시도 금지, 소규모 decoded sprite pool·hidden/gfx gate는 유지할 방어다. 비용 절감을 이유로 권한 검사·KST·관측 전체를 제거하지 않는다.

## 4. 요청량 예산과 개선 순서

**가정 예시**: 하루4시간 보이는100탭,30일 =12,000 viewer-hours. live60초는72만요청, presence60초는72만update, teaser15초는288만요청이다. 임박1초100탭×3분은행사당18,000요청이며 그 시간의 기본15초 요청을 대체한다. CDN hit은 DB를 줄이지만 edge request 자체를 없애지 않는다. 이는 현재 트래픽 예측이 아니라 구조적 비용 계수다.

1. 원문 로그·오류 캐시·저장 실패 표시를 작은 회귀검사와 수정. 보안/정확성 먼저.
2. warm stage/유효duration 계측과 process single-flight, 변경 없는 ingest 차단. 실제 before/after 함수 시간·RPC수 측정. 분산 KV/Redis나 상향 플랜부터 도입하지 않음.
3. graph 성공 marker/공통deadline/재개, 불필요한 SW SSR·hidden polling·관찰 쓰기 묶기. freshness·복구·통계 품질 보존.
4. 의존성 patch·운영 TLS·품질CI·기존FAIL 정리. 보호 장치가 green인 뒤 배포별 짧은 운영 집계와 이후 일일 변화 비교.
5. retention/추가 index/DB compute 변경은 실제 플랜·비용·보존 목적·실행 계획을 확인한 다음 결정. 추가 부하·삭제·유료 변경은 이번 감사에 포함하지 않음.

절감량은 아직 미측정이다. 각 수정은 기능이 같거나 더 정확해졌다는 증거와 함께 비용이 줄었는지 판단한다. 전체 서비스에 같은 cache TTL을 적용하지 않는다.

## 5. 의존성·검사 결과

`npm audit --omit=dev --json` exit1: high로 분류된 패키지3개, unique advisory4개(Next moderate2, sharp high1, source-map-js high1). **실제 악용 가능한 취약점3개가 확인됐다는 뜻은 아니다.** 설치 트리는 Next15.5.24 /override sharp0.35.4 /Next PostCSS 경유 source-map-js1.2.1이다. `npm ls` exit0. fix/install은 하지 않았다.

Next 두 권고의 patch는15.5.27. 하나는 self-hosted Pages Router SSG/ISR만이며 Vercel은 영향 없음, 다른 하나는 root catch-all+SSG/ISR 조건이다. 저장소는 App Router이며 해당 pages/catch-all 구성이 없다. sharp0.35.5는 특정 glibc Linux runtime+SVG decode 조건의 수정이다. 기본 Next optimizer는 SVG를 거부하고 현재 Images 사용량0이나, 모든 입력 경로의 안전을 대신 증명하지 않는다. source-map-js1.2.2는 신뢰할 수 없는 indexed source map의 동기 DoS 수정이며 현재 발견 경로는 PostCSS build다. 상세 primary advisory와 조건은 [의존성 보고서](PLATFORM_AUDIT_DEPENDENCIES-20261017.md) 참조.

| 이번에 실행한 검사 | 결과 | 증명 범위 |
|---|---|---|
| 실제 loader/soop 함수 격리 진단 | 7/7 PASS | **결함 재현 성공**, 수정 아님. 정상control1, DB실패4, cold/expired 동시8요청2 |
| 실제 search/queue 함수 격리 진단 | 2/2 PASS | 합성검색어 log sink 전달, A실패→B성공 saved 재현. React DOM은 mock |
| DB 집계·카탈로그 | 2회 읽기 전용 | 각 metric 성공/실패별 해석. 보존 추가조회42703 미확인 |
| 익명 zero-row REST | net거부/activity거부/publicview허용 | 요청한 경로만. 전체 로그인RLS PASS아님 |
| npm audit/installed tree | audit exit1 / tree exit0 | 현재 registry advisory·설치 버전. 외부 공격 시험 없음 |
| 문서/harness 검사 | 관련unit43/43 PASS, harness exit1 | rule inventory/hash의 기존2FAIL. 최종 broken link0, git diff --check exit0 |

격리 진단은 Supabase/외부 fetch/after 작업을 stub하고 실제 네트워크0이었다. Next cache adapter는 fulfilled 결과 보관 모형이므로 **운영 cache 지속시간을 재현했다는 주장은 하지 않는다.** 실제 제품 callback이 DB오류를 성공값으로 반환하는 것과 soop 함수의 작업 중복은 실행으로 확인했다. 첫 cache 진단의 잘못된 oracle에 의한1FAIL도 원본 보존 후 수정했다.

이번은 문서·읽기 전용 감사이므로 전체 product type/lint/build/UI suite를 다시 실행하지 않았다. 직전078 기록의 unit1,701PASS/8FAIL은 역사적 baseline이며 이번 PASS가 아니다. 분류: toast실결함1, public invalidation정책1, timelineTTL정책1, chat재검사기간정책2, scrollanchor문자열oracle1, marine정적컨셉2. harness2는 rule inventory/hash 불일치다. 어떤 것도 이번에 고쳤다고 표기하지 않는다.

## 6. 남은 실제 검증

| 분야 | 다음 검사 | 현재 한계 |
|---|---|---|
| Supabase 계정/복구 | 실제 플랜/디스크계량·egress/storage/auth/realtime/connectionpool·backup/PITR/복구 리허설 | dashboard로그인 필요. 폰에서 따로 로그인해도 PCChrome세션으로 이어지지 않음 |
| 개인정보/권한 | 실제 anon/authenticated/owner/developer·grant만료/철회/다른기기·storage/RPC canary | fixture/service-role/zero-row 일부만으로 전체RLS나 과거노출 판정 불가 |
| OBS/SOOP | 실제 방송PC에서 달력+ambient+companion+popover+캡처/인코딩 동시, idle/drag/scroll frame cadence·앱지연·드롭프레임 | native fixture나 CPU throttle이 실제 방송 장비 증명은 아님 |
| 장시간/복구 | 20회 창왕복, hidden/복귀·오프라인·decode실패·느린읽기/저장응답유실, heap/decoded참조/리스너 | 실제 장시간 memory plateau와 write종료 보장 미검증 |
| 모바일/접근성 | 320/390px·1040/999경계·coarse landscape·dark·reduced/gfxOFF, keyboard/focus/screen reader | companion/ambient미마운트·요청0, 설정/로그인/뒤로가기·안전영역 실제기기 확인 필요 |
| 최초공개 | 다중/시각변경/0초지연/늦은입장/복귀·10초집중·합성휘도·reader·점유시간 | 기존 fixture증거는 있음. 전체duration·formalflash·멀티리전nano용량을 닫지 않음 |
| 배포 안전 | quality gate·정상204와실패분리·stage관측·롤백·공개DTO회귀 | 운영 cron workflow가 전체 품질 gate를 대신하지 않음 |

## 7. 증거 보존과 마무리

로컬 원본 `.scratch-pw/platform-079-*`: `db-metrics.json`, `db-extra.json`, `schema-probe.json`, `cache-race-vitest.json`, `cache-race-observations.json`, `reliability-repro-report.json`, `reliability-repro.json`, `npm-audit-production.json`, `dependency-tree.json`. 실제 자격증명/원문 사용자 행 없이 집계·합성 canary 결과만 보존했다. browser 관측은 이 문서의 표시 기간·값·해석 한계로 정리했다.

문서만 변경했다. 감사 완료와 개선 완료는 다르다. 미적용 수정과 외부 검증은 [Open checks](OPEN_CHECKS.md)의 PLATFORM-AUDIT-079에서 이어간다.

문서 마무리: `agent-memory.test.ts`·`rule-migration.test.ts` **43/43 PASS**, `harness:verify`는 **기존 rule inventory/hash2FAIL**로 exit1이며 전체PASS로 보고하지 않는다. 작성 중이던 의존성 링크는 완료 후 재검사해 broken link0. `git diff --check` exit0. 제품/의존성/DB 변경0이며 사용자 미커밋 art/preview 작업은 보존했다. 새 감사 문서는 로컬에 저장했으며 commit/push/새 배포는 하지 않았다.

독립 Vercel·DB·신뢰성/의존성 검토를 받았다. DB파일 크기 의미, SQL 원문의 내부 분류와 비출력 경계, 공개범위 원본행수, pagination 근거, auth 네트워크guard와권한검사 구별, 검색 실패 경로의 canary 기준을 보정했다. 원인 미확정·재현mock·설정 미확인 범위는 유지한다. 로컬 검사 로그는 `platform-079-harness-final.log`·`platform-079-harness-unit.json`에 있다.
