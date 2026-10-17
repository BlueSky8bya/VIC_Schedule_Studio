# PLAN-080 — 플랫폼·빅타민 안정화 적용 기록

Date: 2026-10-17 KST. Baseline: HEAD965cc950 / 제품887f6d4b. [079 감사](PLATFORM_AUDIT-20261017.md)의 코드로 해결할 항목을 구현했다. 최종 품질 검사·배포 증거는 아래에서 갱신한다. 실제 방송 장비/계정 설정과 합성 검사를 구분한다.

## 변경과 감사 연결

| 감사 ID | 적용 | 의미·한계 |
|---|---|---|
|01|검색 오류는 고정 분류만 기록|검색어·DB error.message를 로그에 싣지 않는다. 과거 노출 여부의 증거가 아님|
|02/12|공개·편집실 전체 일정 페이지 조회, DB 오류 전파, 공개 API 입력 검증|1,000행 단위, date_key/created_at/id 안정 정렬·중복 거절. 실제 부재는 기존 빈 정상 응답. 동시 편집의 원자 snapshot까지 보장하지 않음|
|03/15|warm을 5초 abortable 공개 readiness 조회로 전환|id-only/public query, 프로세스 single-flight·성공60초/실패1초 재사용, stage/reuse/ms만 기록. 204/503/504 계약과 실패하는 workflow. 전체 Data Cache/모든 Fluid 인스턴스 워밍 보장이 아님|
|04|live/timeline/archive 진행 promise 공유, 완료 기준 TTL|같은 프로세스 중복 억제. Redis/분산 compute lease 추가 없음; DB advisory/CAS로 쓰기 보호|
|05|projection distinct gate·dirty revision·성공 후 CAS ack|동일 입력의 불필요한 물리 UPDATE와 5개 파생 계산 생략. moderation도 공통 project에서 dirty. xlit 실패/새 변경/부분 계산은 재시도 가능|
|06|graph swap 성공 marker와 KST trends 신선도 분리|둘 다 성공해야 retry 생략. 어느 한쪽 성공으로 다른 실패를 숨기지 않음|
|07|직렬 쓰기 batch 실패 latch|A실패 뒤 B성공이 전체 saved로 표시되지 않음. 다음 실제 batch로 회복 가능. 기존 rollback·keepalive/순서 유지|
|08|공통 foreground poll·live 구독/clock 표본 재사용|숨김/offline abort, 빠른 복귀는 이전 요청 종료 후 재개. 무대OFF/다른 달 discovery 유지. clock no-store/DB 공개 판정 유지|
|09|익명 offline snapshot의 single-flight·지속60초 freshness·waitUntil|계정 clear→writer종료→삭제→익명 refill 정렬, 중단 asset 재개·동시4개. 로그인 HTML 재사용 없음|
|10|perf 기본10% 균등 표본, 개발자8 HEAD→1 집계 RPC|표본 수≠총 요청. developer-only/no-store 유지. 방문 heartbeat의 의미·주기는 유지|
|11|공통 monotonic deadline·archive 8페이지/호출·CAS 재개|미완료 scan을 완료/삭제로 처리하지 않음. 실제 DB가 abort를 받은 즉시 SQL까지 중단됨을 보장하지 않음|
|12|단일 vic slug·쿼리 allowlist·범위/중복 검증·검색 진행 키128개 제한|실제 클라이언트 계약 대조. 동일 검색100개→각 로더1회. 진행 promise만 보관하며 완료·부분 실패 후 제거. 분산 rate limit 아님|
|13|현재 보존 범위 재조회·복원 백업 준비|진단14,209행 삭제 승인 대기. 일반 이용기록90일 밖0행. 방문 TTL 미정·production flag 미확인. 삭제/상시 cleanup ON 안 함|
|14|legacy9 DB 도구 공통 검증 TLS·auth guardedFetch|CA 오류 fail closed. 운영 일회성 도구 재실행 없음. 기존 auth 권한·쿠키 유지|
|16|IPv6 loopback/forwarded host guard·activity64KiB stream 상한|허위/누락 content-length도 제한, oversize413. 기존 이벤트 allowlist 유지. 새 전역/분산 rate limiter 도입 없음|
|17|월 toast 중앙 정렬과 animation transform 분리|모바일 폭 제한·기존 회귀 유지|
|18|시청자·편집실 공통 유한 popover 추적|scroll/resize/FLIP/card-play 때만 추적, 정착 뒤 측정0. 빅타민/타이머 자체 transition이 상시 RAF를 살리지 않음|
|19|Next15.5.28·sharp0.35.5·source-map-js1.2.2·PostCSS8.5.28, Vitest4.1.11/Vite6.4.3|production npm audit0. 개발 braces advisory는 패치 없음으로 영향 패키지5 high가 남음. 아래 도달 조건 참조|
|20|기존 실패 분류·규칙 inventory 보존 갱신·품질 CI|규칙 삭제·skip/검사 기준 완화로 green 처리하지 않음. startup 예산 그대로 두고 원문 snapshot 보존|

## 빅타민·방송 파이프라인

새 companion 엔진/pose/상시 프레임 루프는 추가하지 않았다. PC 기본ON(저장 선택 우선), 모바일 제외,92px 전체 pose·bounded decoded pool·실제 하트와 장난 하트 분리·같은 개체가 창 뒤에 남기·소파 단일 앞면·quiet tail0 정책을 유지한다. 이번에는 그 엔진 주변의 중복 요청과 idle geometry 측정을 줄였다.

[클라이언트 기록](PLATFORM_CLIENT-20261017.md): 첫 실제 Next production fixture **28/28 PASS**, 모바일 제외·편집실 일정/업도움/기간 drag·숨기→내용칸 발견→밖으로 꺼내기·집 FLIP/소파·음식·창 뒤 유지·긴 frame을 검사했다. PNG6개를 직접 검수했다. 마지막 클라이언트 변경은 build `KajseOEke8jVPoFqlncHp`에서 팝오버 **2/2 PASS**로 재확인하고 추가 PNG2개도 직접 검수했다. 실제 Chromium service worker **3/3 PASS**는 별도 합성 HTTP server에서 cookie 없는 snapshot·worker restart·clear/refill·진짜 HTTP abort를 확인했다. UI28개는 SW를 차단한 검사이며 결과를 섞지 않는다.

실제 OBS/GPU/동시 인코딩 PC의 frame cadence·장시간 memory plateau와 실제 모바일/screen reader/formal flash는 미검증이다. fixture PASS를 방송 무끊김 보증으로 쓰지 않는다.

## DB 적용·복구·보존

`0151_broadcast_work_bounds.sql`은 격리 PostgreSQL 동작/권한·독립 리뷰 뒤 **10:25KST 적용 완료**. 적용 당시 로컬 파일 SHA256 `4871f2599a1501306dbf0b415f4ceb292a1c0e43ff32661452d2c16a5d708301`, Git LF 정규화본 `1a7ab1cecbd513c69f5af5244ed7babdf59857330dd70b9b35b13b2f9f1f493a`(행끝만 다름). 검증 CA/TLS, 기존 함수 정의 백업, pg_cron 불변, 새 service-only 권한 확인. 수집 실행·source 행 삭제·대량 UPDATE는 하지 않았다. 응용 reader 배포보다 먼저 적용했다. 자세한 SQL 전이·경계·되돌림은 [backend 기록](BROADCAST_WORK_BOUNDS-20261017.md), [함수 rollback](ROLLBACK-0151-broadcast-work.sql). rollback은 이전 앱부터 배포하고 additive 상태는 in-flight 종료까지 보존한다. 과거 migration 전체 재실행 금지.

10:30KST read-only 집계: 일반 activity44,412행 중90일 밖0, 진단14,209행이 모두 `diag=true AND day<'2026-10-14'`에 해당했다. 방문 최초6월2일은 TTL 미정이라 삭제 후보로 정하지 않았다. perf 정확30일 밖358행은 야간 prune 이후 경과 시간일 수 있어 실패로 단정하지 않는다. 원42703 조회 실패도079 증거에 남겼다.

진단 후보만 repeatable-read로 암호화·압축 백업했다. Windows 현재 사용자/SYSTEM 전용 ACL, 키는 사용자 DPAPI, AES-256-GCM 복호화→압축해제→원문/14,209행 round-trip 일치. 암호문299,439bytes, SHA256 `e21b7683f85c76dfcb88503ba75a5ec34edeb7083e380710ff4fd75f73a1d441`. 원문/키/식별자는 ignored 제한 디렉터리에만 있고 커밋·보고서에 없음. **삭제0, 별도 승인 대기**. 상시 pruning flag를 켜는 승인과 혼동하지 않는다.

## 의존성·개인정보·검사 해석

Production audit0은 모든 개발 도구 취약점0이나 과거 침해 없음의 뜻이 아니다. Vitest4로 tinypool을 제거하고 Vite6.4.3·PostCSS8.5.28로 dev 경로를 함께 패치했다. 잔존 `braces3.0.3`는 공식 patched version이 없고 eslint-config-next→fast-glob→micromatch 경로의5 high 영향 패키지로 집계된다. 사용자 일정/검색어를 glob으로 넘기는 제품 경로는 없다. 불신 ESLint 설정/패턴을 실행하면 조건이 달라진다. 권고 downgrade/임의 override 대신 추적한다. [공식 advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [Vitest4 migration](https://v4.vitest.dev/guide/migration.html).

기존 unit8FAIL은 VOD chat의 이미 적용된3일/365일 정책, developer-only preview cache invalidation 예외, zero-height scroll anchor, 정적 marine3 concept 정책, timeline 오류/캐시 계약 등의 오래된 oracle과 실제 결함을 구별했다. marine 정책은 concept/asset 존재도 별도로 검사한다. 테스트 skip/낮은 기준/무더기 snapshot 갱신 없음. Vitest mock cleanup 반환 실수도 block body로 수정했다.

기존 harness inventory2FAIL은 UI38–44 추가7규칙만 반영했다(101→108, 삭제0). 발견된 oversized AGENTS/CURRENT_STATE는 제한6144/8192bytes를 그대로 유지하며 압축했다. G20 원문은 SECURITY에 보존, 원AGENTS7,595bytes·작업 직전 state109,376bytes는 byte-exact snapshot으로 보존한다. source589line/기존 mapping163개 불변을 독립 검토했다. 역사 snapshot은 현 지시가 아니다.

공개 route 자동 탐색/직접·동적·상대 import 검사와 민감 합성 canary로 loader 실패/DTO를 검사했다. 실제 로그인·grant 만료/철회/기기별 세션·RLS 전체, Supabase 실제 플랜/egress/WAL/backup/PITR/복구 설정은 [Open checks](OPEN_CHECKS.md)에 남는다. dashboard 로그아웃은 코드 수정을 막지 않았으며 플랜 변경도 하지 않았다.

## 최종 검증·배포

최종 소스 동결 후 Vitest4.1.11 **1894/1894 PASS**, pending/failed0. `.scratch-pw/platform-080-unit-release.json`. Next15.5.28 production build **PASS**, Build_ID `Zs5cIlJvmS3fdbVqFDS9u`; 이후 typecheck·전체 ESLint **PASS**. 격리 SQL4종(privacy/timeline/chat/0151) **전부 PASS**, 실제 새 마이그레이션 동작·RLS/grant·복구 전이 포함. harness **PASS**,217문서·brief5725bytes(뒤 문서 변경은 커밋 전 다시 검사). 배포 결과는 뒤에 갱신한다.

첫 최종 unit은 build/lint 동시 실행 중1855PASS/1FAIL(문서 훅 stdin 테스트5.216초)였고, 해당 검사만 그대로 재실행18/18PASS(문제 테스트1.391초)였다. timeout을 늘리거나 assertion을 바꾸지 않았으며, build 종료 뒤 최종 전체1894PASS로 재검증했다. 초기에 build/tsc를 동시에 실행해 생성 중 `.next/types` 누락으로 실패한 것도 build 뒤 순차 typecheck에서 통과했다. 원 실패 로그는 보존한다. CI도 build→typecheck 순서를 명시한다.

커밋 대상105파일에서 사용자 art/preview/.vscode/표정 문서 포함0·제한 백업/키 포함0·비밀키 패턴0을 확인했다. 원문 snapshot의 CRLF는 해당 archive attribute로만 보존하며 일반 코드 whitespace 검사를 끄지 않았다. 권한·오류 응답·RPC 실제 계약·archive 복구와 최종 추가 공개 경로까지 독립 리뷰했고 차단 사항0. 이 정적 검사는 모든 비밀/PII 부재나 과거 보안사고 없음의 증명이 아니다.

Vercel 감사 사용량 CPU6시간47분/4시간·Fluid Memory460.1/360GB-hours는 과거30일 관측이다. 배포 직후 요청 몇 개로 한도 해소/절감률을 주장하지 않는다. 새 warm은 bounded readiness이며 수집/RPC 비용은 동일 기간·분모로 후속 비교해야 한다.

### 원격 CI 후속

첫 원격 quality `38991999277`은 unit/SQL/harness PASS 뒤 실제 Google font fetch의 `ECONNREFUSED`로 build FAIL했다. 같은 제품의 Vercel build는 Ready였다. 다음 `38992101389`는 기존 art CLI 통합 테스트1개가5초를 넘어1893PASS/1FAIL이었다. 두 실패는 원본 로그로 보존한다. Google 동시 연결이 원인이라는 것은 아직 가설이다. Next15.5.28의 font loader는 한글 subset을 Promise.all로 받고 Node globalAgent를 사용한다.

CI만 worker1개로 CPU 경쟁을 제한하고 build에 Node agent origin4/프로토콜8 연결 상한을 적용한다. assertion/5초 timeout·실제 Google CSS/woff2·TLS·운영 글꼴/앱은 그대로다. font mock·오류 무시로 gate를 통과시키지 않는다. preloader runtime 상한 검사와 scoped lint PASS; 수정한 원격 CI 결과는 이어서 기록한다.
