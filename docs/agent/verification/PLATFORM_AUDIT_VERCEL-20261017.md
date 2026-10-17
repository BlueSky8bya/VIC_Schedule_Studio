# Vercel / Next.js 운영 비용·신뢰성 감사 — 2026-10-17

Status: Reviewed audit — 제품 수정 없음.
Plan: [PLAN-079](../plans/PLAN-20261017-079-platform-audit.md). 통합 관찰은 [전체 감사](PLATFORM_AUDIT-20261017.md).

저장소·공식 최신 문서와 scratch-only 오프라인 진단7개를 조사했다. 이 문서 작성자는 제품 변경·브라우저·Vercel CLI·Supabase/외부 서비스 호출을 하지 않았다. 운영 UI 관찰은 주 담당의 읽기 전용 결과를 전달받았으며 직접 확인한 소스/격리 진단과 구분한다. 원시 계정·팀·프로젝트 식별자·자격 증명·개인 데이터는 보존하지 않는다.

## 운영 관찰의 범위

주 담당이 Hobby, Fluid Enabled, 배포 지역 icn1, Standard1vCPU/2GB를 실제 UI에서 확인했다. Advanced Settings의 Max Duration 값은 빈칸이며 기본 안내 placeholder300초였다. **프로젝트 명시 override는 보이지 않았으나 배포 함수별 effective duration·실제 timeout duration은 미확인**이다. 과거 코드 주석의 Hobby기본10초를 현재 장애 원인으로 삼지 않는다. 설정 저장/변경 없음.

선택된 Usage Last30Days에서 compute 포함량을 넘는 관찰이 있어 CPU·메모리·timeout 상위 경로가 우선이다. 선택기간과 billing cycle은 구분하며 현재 청구/중단을 단정하지 않는다. 사용량·라우트 전체 표는 통합 감사에 둔다.

워밍 경로의 첫 route-table 관찰은152calls/rowErrorRate41.4%, 후속 별도 rolling 상세는149calls/Timeout37.9%/Error0이었다. 두 관찰창을 합치거나 rowErrorRate를 HTTP500 비율로 읽지 않는다. Duration 차트는 **Demo Data**이므로 실측으로 사용하지 않았다. 익명 root/동기화 작업까지 폭넓게 줄이기 전에 warm의 실제 timeout code·stage·수명부터 확인할 가치가 높다.

소스상 warm은 getPublicSchedule 전체를 기다리고(app/api/warm/route.ts:15) 자체 maxDuration·전체 deadline은 없다. 실패를 catch한 뒤에도 status204(:20)이다. Next DataCache 대기·네트워크·middleware·외부 warm 잡의 설정은 원인후보이며 이번 진단으로 실제 warm timeout 원인을 확정하지 않았다.

## 먼저 볼 항목

1. **공개 일정 실패가 정상 빈 데이터로 캐시됨**: DB 일시 실패를 throw 대신 빈 일정/태그로 반환하여 Data Cache가 300초 보존할 수 있다. 외부 events API에는 CDN 300초도 있다. 비용 최적화 전에 정상/장애 의미를 분리할 것.
2. **라이브 상태 miss의 동시 작업 중복**: `/api/soop-live` 캐시가 완료 값만 보유한다. 동시 miss N개는 SOOP 조회·방송 기록·after 동기화 N개를 시작할 수 있다. DB의 SELECT 기반 간격 확인은 원자적 작업 claim이 아니다.
3. **기본 요청량을 만드는 폴링+스냅샷**: 라이브 훅은 숨김 탭에서도 60초마다 요청. 최초공개 discovery는 떡밥/무대 OFF와 무관하게 보이는 탭마다 기본 15초, 복귀 때 clock 3회. SW는 온라인 navigation 뒤 별도 익명 `/` SSR을 다시 수행한다. CDN 적중이 DB를 줄여도 CDN 요청 수 자체는 시청자 수에 비례한다.
4. **middleware의 자체 auth 대기 상한 누락 후보**: 앱 auth/public/admin 클라이언트와 달리 middleware는 guardedFetch 미적용. 아래 V-10. 관찰된 운영 timeout과 연결되는지는 route/duration 분포 확인 전 가설이다.

## 현재 배치 지도

| 경로/기능 | 소스·설정 | 비용/경계 의미 |
|---|---|---|
| Next/React | package.json next ^15.5.24, React ^19 | 최신 Next16의 use-cache 지침을 그대로 이식하지 말고 15 규약으로 검증 |
| 함수 위치 | vercel.json:3 `icn1` | 실제 배포 설정에서도 서울을 주 담당이 확인. Supabase region과의 근접성·지연은 별도 확인 필요 |
| 공식 Vercel cron | vercel.json:4–9 broadcast-poll 하루1회 | GitHub broadcast-poll 5분 표기와 별도. GitHub 실행은 실제 cadence 보장 아님 |
| vod-chat 정기 수집 | .github/workflows/vod-chat-backfill.yml:10–15는 dispatch only | 코드상 정기 실행은 DB pg_cron이라는 기록. 현재 cron.job/외부 잡 동작은 이 감사에서 미확인 |
| warm | app/api/warm/route.ts:9–26, .github/workflows/warm.yml:16–37 | Data Cache만 읽는 204. 온전한 SSR을 warm 대신 쏘는 문제는 코드에서는 교정됨. 외부 cron-job.org URL은 미확인 |
| 공개 일정 Data Cache | public-loader.ts:253–450, 300초 | 공개 DTO만 저장. 개인 하트 목록은 별도 비캐시 경로. 전체 calendar history 반환 |
| 하트 집계 | public-loader.ts:185–205, cache.ts:13–19 | 60초 Data Cache, 실제 vote 변경마다 별도 태그 무효화. 일정 전체 태그와 분리한 점 유지 |
| 최초공개 상태 | public-loader.ts:30–61 + teaser-state route | Data Cache1초 + origin/outer single-flight. canonical vic/UUID·query 거절·오류 no-store. 이 경로 보호 장치를 다른 비용 경로의 참고로 사용 가능 |
| 공개 SSR | app/page.tsx:18–25, cookies/headers | auth/개인 초기 상태 때문에 전체 페이지를 공개 CDN 캐시하면 안 됨. 개인 경계를 지키면서 공개 데이터만 캐시 |
| 관찰 도구 | layout.tsx 마지막 Analytics/SpeedInsights, perf/perf.ts, presence beacon | 공급자 관찰과 자체 DB 성능/행동/방문 기록은 별도 비용. 하나의 숫자로 합치면 안 됨 |

## 확인한 결함/비용 경로

### V-01 / 높음 — DB 실패를 성공한 빈 일정으로 캐시

근거 `lib/schedules/public-loader.ts:266–295`: loadPublicCalendarId의 오류를 catch하고 emptySchedule 반환. `:365–368` calendarRes.data가 없으면 오류와 부재를 구별하지 않고 empty 반환. `:399–400,440` tagsRes/eventsRes 오류를 확인하지 않고 `data ?? []`. 함수 자체가 `:450` revalidate300인 unstable_cache 안이다.

따라서 실패 응답을 정상 캐시 값으로 승인하는 경로는 소스상 확정. loadPublicCalendarId는 `:173`에서 오류를 throw해 1시간 false-negative 저장을 막지만 외부300초 wrapper가 다시 오류를 삼킨다. 기존 성공 캐시를 유지하는 Next의 실패 revalidation 경로를 쓰려면 이 레벨도 실제 실패를 reject해야 한다. 사건 발생/장애 지속 시간은 미측정. 외부 events route `:29` CDN300초를 합치면 별도 stale 기간이 생길 수 있음(코드 주석에도 허용된 지연으로 기록되어 있어 그 정책 자체를 새 결함으로 세지 않음).

안전 검증: 모의 public client로 calendar lookup/calendar/events/tags 각각 한 번 실패 → 기존 성공 snapshot 보존/실패 no-store, 다음 성공 복구; '실제 없는 캘린더'만 정상 빈 값. 공개 전 떡밥 canary도 같은 테스트에서 유지. 변경 시 실패 UI/503 계약 검토 필요.

### V-02 / 높음 — 라이브 miss single-flight 부재와 작업 중복

`app/api/soop-live/route.ts:18–24`의 cache는 완료 값뿐. cache가 null/만료된 상태에서 A/B가 :23 await에 들어가면 둘 다 fetchSoopLive를 시작하고 각자 :26 recordLiveTick, :35 after를 예약한다. process-local cache라 여러 함수 인스턴스/콜드 스타트 간 공유도 안 됨. CDN은 평시 감소책이지만 cache miss·다른 key·다른 POP/배포·내부 직접 호출의 원자적 보장은 아님.

`lib/broadcast/vod-timeline.ts:149–157,196–204`는 synced_at SELECT 후 작업. 두 요청이 같은 old timestamp를 보면 동시에 작업한다. 주석의 'DB 스로틀로 과다 실행 없음'은 cross-request claim 보장보다 강한 표현. 그 뒤 ingest의 DB advisory lock은 결과 순서를 보호할 수 있어도 이미 시작한 외부 다운로드/CPU를 되돌리지 못함.

안전 개선 순서: (a) soop route의 in-flight Promise를 실패 finally까지 공유, TTL은 성공 완료 시각 기준. (b) 동기화 entry에도 동일 process single-flight. (c) 스텁 동시1/100/1000·두 인스턴스 측정 후 필요할 때에만 DB 원자적 lease/claim 검토. Redis/KV부터 추가하지 않음. source race는 확정이나 운영 stampede 규모는 미측정.

추가 수명 이슈: :26 `void recordLiveTick`는 after와 달리 요청 수명에 명시적으로 묶이지 않는다. Vercel 실행 종료 시 누락 가능성은 가설이며 실측 필요. 기록과 sync를 중복되지 않는 하나의 after 소유자로 묶되 기록 순서/뱅종 판정 보존 검토.

### V-03 / 중간~높음 — 시청자 요청량에 비례하는 불필요한 네트워크

- `components/poster/use-soop-live.ts:19,27–43`: 60초 setInterval, visibility/online 검사·in-flight/AbortController 없음. 숨김 탭과 장기간 연결 장애에도 요청을 계속 시도한다. cleanup은 state 갱신만 막고 진행 fetch는 취소 안 함. 실제 브라우저 timer throttling 후 빈도는 미측정.
- `lib/ui/premiere/use-teaser-premiere.ts:178–208`: 보이는/온라인 탭에서 상태 목록을 기본15초/near1초. 이 effect에는 options.enabled/records 비어 있음에 따른 중지가 없음. 무대 OFF에서도 공개 시각 변경·실제 공개 감지를 위해 일부 discovery는 필요하므로 무작정 끄면 안 됨. '떡밥 없음'의 느린 discovery와 '공개 임박'의 fast lane을 보존하는 방식으로 비용 목표를 정할 것.
- 같은 파일 :200,208에서 복귀/초기 진입마다 synchronizeClock. `lib/ui/synced-clock.ts:65–85`가 no-store clock endpoint를 순차3회 호출. 해당 클라이언트에서 진행 중인 sync만 coalesce; 최근 유효 표본 TTL 없음. 숨김 탭마다 재보정 품질과 요청 수를 함께 측정할 것.

안전 검증: 브라우저 fixture request counter로 무떡밥/먼떡밥/임박/OFF/숨김/복귀/오프라인 각각 10분; 변경 전후 공개전 DTO·시각변경 전파·0초 지연·late arrival 동일성. clock은 DB 공개판정 권한을 절대 대신하지 않음.

### V-04 / 중간 — SW 공개 스냅샷이 별도 SSR을 추가

`public/sw.js:140–143` 온라인 navigation fetch 후 `void refreshSnapshot()`. `:34–47` 스냅샷이 없거나60초 지나면 `fetch('/',credentials:omit,cache:no-store)`로 익명 포스터를 다시 SSR한다. :27 activate도 수행. 이 인증 없는 요청이 개인 데이터 섞임을 막는 점은 유지해야 한다.

즉 공개 화면 이동 자체의 문서 SSR + 익명 스냅샷 SSR 두 번 경로가 소스상 존재. lastSnapshotAt은 성공 후에만 갱신하고 진행 Promise가 없으므로 여러 탭의 가까운 navigation에서는 중복 snapshot request도 가능. SW가 종료/재시작하면 메모리의 lastSnapshotAt은0으로 초기화됨. :143 background 작업은 event.waitUntil과 연결되지 않아 유실 가능성도 있음(후자는 운영 미측정).

안전 검증: 실제 SW를 사용하는 격리 fixture에서 anonymous/studio navigation 동시 요청 수와 스냅샷 저장 횟수 측정. 진행 Promise + persistent freshness + lifecycle waitUntil 우선. 응답 재사용은 로그인 HTML/이메일·개인 하트가 섞이지 않음을 검증하기 전 금지. 오프라인 공개 열람은 유지.

### V-05 / 중간 — 성능 관찰 자체의 DB write가 방문 수에 비례

`app/page.tsx:18,25`의 page:publicSchedule/page:actor timed 각각 `lib/perf/perf.ts:55` → `lib/perf/record.ts:14–18` after insert1행. 샘플 확률/배치/빈도 제한 없음. `PERF_LOG=off`는 console만 끄고 insert는 끄지 않음. SW snapshot도 같은 SSR 경로이므로 똑같이 표본을 생성한다. 내부 wrapper/ServerTiming이 추가 표본을 생성하는 경로도 있음. 실제 현재 월 표본 수/보존 job은 DB 담당 확인.

안전 개선: 라벨별 확률 표본+일관된 sampling metadata, 서버측 짧은 batch/버퍼(유실 허용 범위) 또는 롤업 중 선택. 현재 진단 통계의 대표성/오류 표본 보존과 충돌하므로 무작정 표본 모두 제거하지 않음. warm은 익명 로더 안의 cold miss db timed 때문에 항상 '표본0'이라는 주석도 조건에 따라 부정확할 수 있다.

### V-06 / 중간 — 공개 key/검색 cardinality가 CDN/DB 비용을 우회할 수 있음

- `app/api/public/[calendarSlug]/events/route.ts:11–19`: 임의 slug를 cached loader 인자로 전달, unused query도 거절 안 함. 존재하지 않는 slug마다 calendar lookup와 Next cache entry가 생길 수 있다.
- `broadcast/route.ts:13`는 slug를 무시하고 year/month별 RPC2회, `vod-chat/route.ts:9–15`도 slug 무시. 서로 다른 가짜 slug로 동일 데이터의 CDN key가 나뉨.
- `search/route.ts:15–22` arbitrary q/limit 및 unused query를 가진 URL마다 CDN key가 갈리고 DB RPC3회, latin typo면 searchPublic 내부2회여서 총4회. 공개 검색이라는 특성상 q cardinality는 정상 사용에도 높다. 실제 과도 트래픽/공격 발견 주장은 아님.
- teaser routes는 이와 달리 `vic`, UUID, query 없음으로 key를 제한한다. 좋은 현행 사례.

개선 전 실제 외부 소비자 계약 확인. 단일 calendar slug 검증·인식하는 query allowlist·limit canonical 값/범위·순서 정규화·같은 q in-flight/coalescing·배포 WAF 비용 제한을 단계적으로 검토. 임의 calendar API 계약을 조용히 끊거나 검색어 원문을 로그로 남기지 말 것. 로그는 route/count/고정 분류만.

### V-07 / 낮음~중간 — middleware 범위와 auth 중복

`middleware.ts:36,49–51`: api/public, api/soop-live, api/presence와 image/_next/static을 제외하지만 api/activity, api/warm, api/cron, /sw.js, manifest 등에는 실행한다. 로그인 쿠키 있는 요청은 middleware getUser 뒤 핸들러/actor의 getUser가 별도 요청 컨텍스트에서 다시 일어날 수 있다. `lib/auth/server.ts:40–53` React cache는 해당 render 안 중복을 줄이는 것이며 middleware의 별도 작업과 공유되지 않음.

주의: **익명에서 getUser가 언제나 GoTrue 네트워크 왕복한다는 주장은 하지 않음**. SDK는 세션 없음에서 로컬 종료할 수 있다. 다만 middleware 자체 invocation은 남는다. 인증 갱신이 필요 없는 static/전용 cron endpoint만 선택 제외 검토. auth/private 권한 검사를 빼는 최적화 금지. root dashboard의 Middleware invocation/CPU 비중이 낮으면 우선순위 낮춤.

### V-08 / 중간 — 60초 cron의 전체 deadline 없음

`app/api/cron/vod-chat/route.ts:11` max60. :31 syncVodChat 기본35초(`lib/broadcast/vod-chat.ts:233–238`)에 앞선 auth/target 선택 시간과 :40–45의 순차 synonym5초+trending15초가 합산된다. RPC별 timeout은 있어도 전체 deadline의 남은 예산으로 보정하지 않음. DB 지연이 겹치면 maxDuration보다 큰 합산 상한 경로가 있다.

`lib/broadcast/vod-timeline.ts:96` 20초 deadline은 반복의 시작 검사이며 그 뒤 DB 호출/댓글/5개 rebuild(:124–127)/syncXlit이 전체 남은 budget을 받지 않는다. `lib/broadcast/vod-archive.ts:273–308` deep sweep은 모든 source page를 도는 for(;;), 페이지당8초+200ms, 전체 deadline/재개 cursor 없음. 함수60초 안에 항상 끝난다는 보장은 없음. 현행 동기화 결과/재시도는 DB 담당과 함께 검토. 운영 timeout 확인 전 실제 장애로 단정하지 않음.

안전 검증: fake monotonic clock+가짜 slow RPC/페이지로 전체 budget/마지막 저장/재개 가능성 검증. 한 개 absolute deadline(응답/cleanup 여유 포함)을 call chain에 전달. 완료되지 않은 deep sweep은 삭제 동기화의 complete=true로 취급하지 않음. timeout만 늘리는 해결은 nano 작업량을 줄이지 못함.

### V-09 / 낮음 — warm 성공 응답 오판

`app/api/warm/route.ts:20` 성공 응답204. `.github/workflows/warm.yml:37`은200이 아니면 warning. 정상 워밍이 매번 경고로 나타난다. 상태 whitelist200/204로 보정하는 작은 검증 가치 있음. 비용 자체보다 관찰 신뢰도 문제.

### V-10 / 조사 우선 — middleware auth 네트워크 상한 누락

`middleware.ts:16–33` createServerClient의 options는 cookie handler만 있고 global.fetch/AbortSignal 상한 없음. :36 `await supabase.auth.getUser()`를 직접 기다린다. 반면 `lib/auth/server.ts:19–21`·`lib/auth/admin.ts:25`·`public-loader.ts:117–120`은 guardedFetch로10초+읽기1회 재시도를 적용한다. 이 적용 불일치는 소스상 확정이다. 세션이 있는 요청의 GoTrue stalled connection은 보호 밖에 남는다. 세션 없는 익명 호출은 네트워크 없이 끝날 수 있어 모든 middleware 요청이 문제라는 뜻은 아니다.

**middleware와 Node function 계량을 분리할 것**: 현재 middleware에 runtime:nodejs 선언이 없어 Next15의 기본 Edge runtime에 해당한다([공식 Next15](https://nextjs.org/docs/15/pages/api-reference/file-conventions/middleware)). 이 middleware의 대기를 Node의2GB·300초로 직접 계산하면 틀린다. 실제 timeout code/route/runtime/duration/할당/concurrency는 확인하지 않았으며 운영 compute 사용량의 원인·분해를 추정하지 않는다. I/O 대기는 CPU 과다를 직접 설명하지 못하므로 ActiveCPU 상위route는 따로 분석해야 한다.

안전 검증: middleware의 가짜 auth fetch가 무응답일 때 기존 세션 갱신/Set-Cookie 보존과 결정된 시간 상한, 10초/최종20초의 동작을 재현. 로그인 보호 경로는 실패 시 안전하게 닫고 공개 경로의 정상 익명 열람 보존. 외부 auth 서비스를 실제로 지연시키거나 부하를 주지 않음. 기존 guard를 재사용하되 middleware 번들/Edge 호환성 확인. 수정 전 timeout이 해당 경로에 집중하는지 aggregate logs로 확인.

## 수량 모델(실제 계정/사용량 추정 아님)

`viewer-hours = 평균 동시 보이는 탭 수 × 하루 보이는 시간 × 30일`.

예시 100탭×하루4시간×30일 =12,000 viewer-hours:

| 반복 | 요청 수 예시 | DB/함수와의 관계 |
|---|---:|---|
| soop-live 60초 |720,000 /월|CDN hit이면 origin 호출은 적어도 CDN request는 발생. hidden 탭까지 있으면 추가|
| presence heartbeat60초 |720,000 /월|POST, CDN으로 합칠 수 없음. 시작/종료 별도|
| teaser far discovery15초 |2,880,000 /월|CDN/DataCache가 DB read를 완화. 각 URL요청은 남음|
| teaser near1초 |동시탭100×3분=18,000 /회|이 시간대가 기존15초를 대체. 행사 빈도에 따라 달라짐|
| clock |초기/유효한 복귀1회당3요청|no-store function path. visibility event 수 미측정|
| SW snapshot SSR |60초gate 이후 navigation/activate당 최대별도1회|동시/workerrestart에서 더 생길 수 있음|

공개 실제 방문 수·visible 시간·WAF/CDN hit/POP·origin invocation·DB 쿼리·CPU초·memoryGB시간은 **각기 다른 분모**다. 'CDN1초이니 DB초당1회'나 '오픈소켓/지역 하나니 인스턴스1개'로 전체 한도를 계산하면 안 됨. 이번 lane은 계산 예시만 제공함.

## 자산/빌드 관찰(새 결함 아님)

현재 public은208개 파일/158,825,361 bytes. 이는 배포 디스크상의 전체 자산이며 한 방문자가 전부 받는다는 뜻이 아니다. 큰 파일은 forest-ground-detail-winter-v2.png 3,868,366B, 여름3,677,561B 등 ambient PNG. companion/premiere는 일부 webp를 unoptimized로 직접 사용하여 image transformation 횟수 대신 원본 CDN transfer를 사용한다. 기존 승인된 선명도·art 정체성·그래픽 등급을 깨는 일괄압축은 비추천. 실제 cold/warm Network transferred bytes·필요 계절만 로드하는지를 먼저 측정해야 함.

`next.config.ts`의 serverActions4MB는 요청 허용 상한이며 모든 요청이4MB라는 뜻이 아님. 그림판 저장 등 실제 호출부 사용량·유효 max payload는 별도검증. 큰 이미지 해상도만 바꿔서는 서버 폴링/SSR/DB 작업량 문제가 해결되지 않음.

## 최신 공식 자료(2026-10-17 조회)

- [Vercel Hobby 포함량](https://vercel.com/docs/plans/hobby): 문서상 CDN Requests1M, Function Invocations1M, Active CPU4h, Provisioned Memory360GBh, Fast Data Transfer100GB/Fast Origin10GB, Speed Insights10k/30일, Web Analytics50k/월. 이 수치는 공식 기본 포함량이며 계정 잔여 한도·실제 적용 기간의 증거가 아니다. 프로젝트의 Hobby 플랜은 주 담당이 UI에서 별도 확인했다. 실제 usage period/credits는 dashboard가 정본. 한도 초과의 일부 리소스는 다음 이용기간까지 제한될 수 있음.
- [Functions limits](https://vercel.com/docs/functions/limitations): Fluid 활성 프로젝트의 문서상 Hobby duration300초, Pro 기본300/최대800초(특정 beta1800초). 저장소 cron의 명시 maxDuration60은 여전히 그보다 짧은 자체 상한. 과거 주석의 'Hobby기본10초'를 현재 Fluid 기본으로 인용하지 말 것.
- [Fluid billing](https://vercel.com/docs/functions/usage-and-pricing): Active CPU와 Provisioned Memory가 분리되며 I/O 대기에는 CPU 대신 실행중 메모리 시간이 남는다. 프로젝트의 Fluid Enabled·Standard 할당은 주 담당이 UI에서 별도 확인했고 배포 함수별 effective runtime/duration은 아직 미확인이다.
- [CDN usage](https://vercel.com/docs/manage-cdn-usage), [CDN Cache](https://vercel.com/docs/caching/cdn-cache), [Cache-Control](https://vercel.com/docs/caching/cache-control-headers): CDN 적중/브라우저 캐시/함수 invocation/transfer는 다름. 개인화 응답을 shared public 캐시에 넣지 않음. hashed asset은 framework가 immutable 정책 처리.
- [Next15 cache semantics](https://nextjs.org/docs/15/app/guides/caching): 시간 만료 뒤 stale을 먼저 제공하며 background refresh, 실패하면 이전성공값 유지. 그러므로 V-01의 throw→[] 변환은 정상 stale-on-error 보호를 무력화하는 방향.
- [Cron pricing/limits](https://vercel.com/docs/cron-jobs/usage-and-pricing): cron 실행도 underlying Function 사용량을 소비. 실제 플랜·스케줄 제한을 확인하고 중복외부trigger부터 대조.

## root에게 필요한 dashboard 증거(값/비밀 복제하지 말 것)

1. 실제 Vercel plan/Fluid on/off/기간별 limit, function ActiveCPU·ProvisionedMemory·invocations, CDN Requests·FastData·OriginTransfer top route.
2. 서울 function과 실제 DB region 지연, cold/warm p50/p95, maxDuration timeout/5xx route.
3. soop/teaser/clock/presence/activity/warm/SSR 별 request volume·CDN hit 비율. 개별계정/헤더/쿼리 검색어·토큰/IP는 보고서에 보존하지 않음.
4. pg_cron/Vercel/GitHub/cron-job.org 실제 스케줄·최근 성공 gap을 이름+aggregate count로 대조. 현재 살아있는 trigger만 정리대상으로 선정.

## 우선 검증/수정 순서

1. V-01 오류 캐싱 unit 재현, V-02 동시miss N회 모의 읽기. 제품 수정은 작은 실패/동시성 경계부터.
2. V-03 hidden/offline poll 정지·resume1회·실제 reveal freshness 회귀. 실제 request counters와 dashboard 전후비교.
3. V-04 SW single-flight/수명/빈도와 V-05 관찰 sampling을 따로 측정. 개인화 캐시 경계 회귀 반드시 포함.
4. V-06 canonical key/검색 비용과 V-08 공통 deadline. 실제 계약/DB job와 겹치는 변경은 lane 간 통합.
5. V-07 middleware, V-09 warning, 필요한 자산의 cold transfer는 측정된 비중에 맞춰 적용.

모든 결과는 source-backed candidate 또는 확인한 제어흐름이다. 이 문서 작성만으로 실제 서비스 부하검사·누출검사·운영 성능 PASS라고 보고하지 않는다.

## 추가 오프라인 runtime 진단 — 7/7 PASS(현재 결함 재현, 수정 PASS 아님)

`node node_modules/vitest/vitest.mjs run --config .scratch-pw/platform-079-cache-race.config.ts --reporter=default --reporter=json --outputFile=.scratch-pw/platform-079-cache-race-vitest.json`

2026-10-17 실행, Vitest2.1.9, worker1/file1, 테스트202ms/전체423ms. 실제 `getPublicSchedule`·실제 soop `GET` 함수 본문을 실행했다. source regex를 runtime 증거로 사용하지 않았다. DB/외부 SOOP/after queue/성능 기록/Next cache는 로컬 mock. global fetch도 throw로 막고 각 테스트0호출 확인. 이 파일은 결함이 나타나야 PASS인 **diagnostic**이다.

| 진단 | 실제 관찰 |
|---|---|
| healthy control | 실제 DTO 함수에서 합성 일정1/태그1. 빈 fixture 때문에 통과하는 검사 아님 |
| calendar ID 조회 실패 | 공개 schedule callback은 reject하지 않고 일정0/태그0으로 fulfill. 등록 TTL300 |
| calendar 행 조회 실패 | 일정0/태그0으로 fulfill. 등록 TTL300 |
| events 조회 실패 | 일정0/태그1로 fulfill. 등록 TTL300 |
| tags 조회 실패 | 일정1/태그0으로 fulfill. 등록 TTL300 |
| cold soop 동시8 GET | upstream8·record8·after8. after를 실제 호출하면 timeline8/archive8. 그다음 warm GET은 upstream 추가0 |
| expired soop 동시8 GET | 같은8/8/8/8/8. 그다음 warm GET 추가0 |

cache adapter는 fulfilled 결과만 보관하는 최소 모형이며 실제 Next/Vercel 저장을 실행하지 않았다. callback 성공값이 오류 손실 상태라는 부분은 실제 제품 함수의 runtime 증거. 해당 값의 실제 Next DataCache300초·CDN 지속은 공식 규약+정적 설정에 대한 추론으로 구분한다. adapter에서 실패를 제거한 뒤 다시 요청해도 schedule callback은1회로 남고 손실된 payload가 유지됐다. ID lookup 실패의 경우 별도 heart-count 경로가 lookup을 한 번 재시도할 수 있지만 schedule은 계속 빈 cached 결과였다.

첫 시도6PASS/1FAIL은 '모든 DB lookup도 재시도0이어야 한다'라는 너무 강한 오라클이었다. 실제 별도 heart-count 복구 lookup이1회 일어나는 것을 확인하여 schedule callback 횟수와 실제 events query 횟수로 scope를 수정했다. 첫 JSON을 `platform-079-cache-race-first-attempt.json`·`*-first-attempt-observations.json`에 보존했다. 제품 수정 없음.

최종 증거: `.scratch-pw/platform-079-cache-race.test.ts`, `platform-079-cache-race.config.ts`, `platform-079-cache-race-vitest.json`, `platform-079-cache-race-observations.json`. 운영 CDN·다중 프로세스·실제 DB stampede 빈도나 현재 timeout 원인까지 증명하는 검사는 아니다.
