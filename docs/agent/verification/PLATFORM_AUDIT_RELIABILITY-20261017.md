# 전체 서비스 신뢰성·경계·프런트엔드 조사 — 2026-10-17

Plan: [PLAN-079](../plans/PLAN-20261017-079-platform-audit.md)
Status: Investigation complete; findings below are not implementation or release completion.

## 조사와 증거 구분

이 lane은 저장소 소스·현재 규칙·로컬 검증 로그만 읽었다. root 요청으로 작은 오프라인 결함 재현2개를 실행했으며 제품·lockfile·추적된 테스트는 바꾸지 않았다. 브라우저·운영 요청·직접 DB 호출은 하지 않았다. root가 별도로 수행한 새 DB 집계·npm audit·배포 조사는 [DB 기록](PLATFORM_AUDIT_DB-20261017.md)과 [Vercel 기록](PLATFORM_AUDIT_VERCEL-20261017.md)의 해당 시점 증거다. 이 lane의 미실행 범위를 프로젝트 전체 미실행으로 확대하지 않는다.

최초 소스 관측 HEAD는 `965cc950`이다. 아래 file:line은 조사 당시 소스이며 후속 수정이 있으면 검증 결과를 별도로 기록해야 한다. 실제 개인정보·비밀·원본 이용기록을 읽거나 복사하지 않았다. canary는 합성값만 사용했다.

## 재현 또는 정적으로 확인한 수정 후보

| 우선 | 발견·조건 | 근거 | 다음 검증 |
|---|---|---|---|
| P1 | 검색 RPC 오류에서 자유 검색어가 서버 로그로 전달됨. 실제 과거 노출 발생을 확인한 것은 아님 | `lib/schedules/public-loader.ts:741–744`의 raw q/error.message 경고. 공개 search route `:8,15`는 미저장을 표방하지만 입력은100자 자르기뿐. 실제 함수 오프라인 canary 재현 성공 | raw query·오류 원문 대신 고정 종류/코드만 남기고 실패 경로의 오류 응답·운영 로그·활동 metadata로 민감 canary가 새지 않는지 검증. 기존503/no-store 유지 |
| P1 | DB 실패가 정상 빈 일정으로 바뀌어300초 캐시에 들어갈 수 있음 | `public-loader.ts:265–295,365–368`은 lookup 오류/부재를 같은 빈 스케줄로 반환. `:399–400,440–445`는 critical `.data ?? []`. 함수 전체 `:253,449–450` unstable_cache300초 | 정상→critical query 실패→복구 주입. 실제 빈 달·공개 종료·일시 DB 오류를 구분하고 이전 정상값 보존/재검증/오류 UI 검증. 이번 lane에서는 cache runtime 재현 미실행 |
| P1/P2 | 한 저장 묶음의 A실패를 뒤 B성공이 공유 저장 상태 saved로 덮음 | `lib/studio/use-write-queue.ts:80–103`. 실제 hook 오프라인 상태 쓰기 `[failed,saved]` 재현. `studio-shell.tsx:721–732` 같은 개별 호출부에 rollback/에러가 있어 모든 실패가 조용히 유실된다고 단정하지 않음 | A실패→B성공·역순·명시 재시도 성공의 fixture 상태 검사. 실제 헤더 렌더는 미검증. 실패 latch 범위를 정하고 미해결 실패와 전체 성공을 혼동하지 않게 처리 |
| P2 | 월 점프 toast의 가운데 정렬 transform을 등장 애니메이션이 덮음 | `components/shared/month-picker.css:464–481` left50%/translateX(-50%) + fill both. 같은 파일 `:134–140` mp-sheet-up은 translateY→none | 실제 toast 등장/종료/감소 동작/모바일 캡처. 정렬과 애니메이션 소유권 분리 후 기존 검사 유지 |
| P2 | 정상 워밍이204인데 workflow는200만 정상으로 검사. HTTP 실패도 warning-only | `.github/workflows/warm.yml:32–38`, `app/api/warm/route.ts:19–24` | 정상204/503/timeout 합성 검사. 실제 외부 cron 설정은 별도 운영 증거 필요 |
| P2 | 서버 analytics guard의 IPv6 Host 파싱 오류 | `lib/analytics/guard.ts:28–31` `.split(":")[0]`는 `[::1]:3000`을 `[`로 변환. 클라이언트가 별도로 제외하므로 실제 운영 오염 발생을 뜻하지 않음 | IPv6·localhost·정상 production host 순수 단위 검사. 정상 사용자 트래픽과 프록시 권한은 유지 |

## 오프라인 결함 재현2개

`.scratch-pw/platform-079-reliability-repro.test.ts`와 전용 config만 사용했다. 전용 Vitest 실행 exit0, **2/2 PASS, skip0**. 여기서 PASS는 **현재 결함을 재현했다는 뜻이며 수정 PASS가 아니다**.

- 실제 `searchPublic()`을 호출하고 calendar/RPC/Next cache만 mock했다. RPC 오류 반환, 경고1개, 합성 민감 검색 canary의 console sink 전달을 관측했다. console spy가 실제 출력을 차단했다.
- 실제 `useStudioWriteQueue()`의 enqueue2개를 실행했다. 순서A→B, A실패/B성공,700ms timer 소비 후 상태 쓰기 `[failed,saved]`, 최종 saved/inflight0. React useState/useRef는 상태 sink로 mock했으므로 실제 DOM 헤더/개별 rollback UX까지 증명하지 않는다.
- fetch 금지 mock·network attempt0, auth/DB 격리. 두 제품 소스 SHA256과 관측 결과는 `.scratch-pw/platform-079-reliability-repro.json`, 전체 결과는 `...-repro-report.json`이다. 소스 정규식만 보고 동작 재현이라 부르지 않았다.

## 확인한 경계 방어

- `lib/auth/actor.ts:35–90`: 실제 Supabase user+Google provider+owner/developer 판정. developer 조회 오류는 최소 viewer 권한과 roleUncertain이며 상승하지 않는다. `lib/permissions/roles.ts:9–48`은 일반 편집 owner/developer, owner_private owner만 구분한다.
- `lib/schedules/studio-loader.ts:21–39`, `event-actions.ts:117–140`: 서버에서 grant/owner 전용/편집 권한을 다시 검사. client role preview가 서버 권한을 올리는 경로를 이 조사에서 찾지 못했다.
- `lib/private-layer/unlock-grant.ts:8–25`, `unlock.ts:42–90`:256-bit opaque token/SHA256/HttpOnly/SameSite/Secure, user/calendar/passcode_version/auth_session_id/expiry 결속. `unlock-private-layer/route.ts:78–91,114–124`는 원자적 시도 예약 뒤 검증하며 verifyOnly에는 grant가 없다.
- `db/migrations/0125_privacy_boundary.sql:7–31,40–57,67–108`, `0138_public_events_tentative_teaser.sql:9–33`: 민감 테이블·관리 RPC grant 제한, public event RLS, DB now() 가림 view. `public-loader.ts:504–551`은 명시 DTO와 DB hidden/legacy 빈 내용에 fail closed. `0142_public_teaser_state.sql:7–22`는 invoker+기존 가림 view만 사용한다.
- `public-loader.ts:122–157`, 공개 events route `:15–29`: 캐시된 공개 묶음과 개인 하트 분리, 공유 API includeMyHeartIds:false. `lib/broadcast/timeline-public.ts:4–23`은 공개 작성자 닉만 명시 projection하며 인증 identity fallback이 없다.
- `lib/activity/kinds.ts:12–17,172–205`, `record.ts:45–80,106–126`: 고정 ID/meta allowlist, 서버 actor 재판정, viewer/anon의 account_hash는 쓰기부터null·일별 집계. 개발자 전용 조회는 `query.ts:85–99,348–350`에 있다. 일반90일/진단3일 cleanup은 `retention.ts:6–20`의 opt-in이며 실제 삭제 완료를 뜻하지 않는다.

## 경계·실패 상태의 추가 검증 공백

1. fixture/고정 owner service-role 검사는 실제 anon/authenticated RLS, Google 세션 갱신, 다른 기기 grant 복사 거절, 만료/철회를 대신하지 않는다. `tests/sql/privacy-boundary.mjs:13–37,58–110`은 in-memory PG + stub role helpers +0125 canary다. 이후0138/0140/0142와 실제 적용 grants는 별도 검증해야 한다.
2. `tests/unit/public-boundary.test.ts:13–18`은 loader/events/broadcast3파일만 static imports 검사. 새 검색/clock/teaser/timeline/chat 경로를 자동 발견하는 guard는 아니다. `lib/auth/admin.ts:1–3`의 server-only build fence 부재는 hardening 후보이며 실제 client secret 번들을 발견했다는 뜻은 아니다.
3. `app/api/activity/route.ts:9–35`의50개 제한은 JSON parse 뒤 적용, endpoint 내부 byte cap/빈도 예약은 없다. nano DB에 대한 실제 고빈도 비용/범위는 별도 측정 대상이며 악용을 관측하지 않았다. 기록은 보조 경로라 client 전송 실패 시 일부 유실되므로 원장처럼100% 정확하다고 표현하지 않는다.
4. `lib/studio/editor-model.ts:124–137`은 keepalive+실패 반환, `use-write-queue.ts:51–73,110–130`은 직렬 실행/temp ID/inflight를 보유한다. request ID/영속 offline queue가 없다는 사실만으로 즉시 인프라를 추가할 근거는 없다. 적용 후 응답 유실·중복 submit·떠나기 직전 대기 작업을 먼저 주입 검증해야 한다. 아직 요청되지 않은 후속 promise까지 keepalive가 보장한다는 주석은 과장이다.
5. `lib/net/guarded-fetch.ts:14–39`는 GET/HEAD network/timeout만1회 재시도, POST는 중복 위험으로 재시도하지 않는다. HTTP5xx·읽기 RPC POST까지 모두 재시도하는 구조가 아니다. 변경 시 원자성/중복 방지를 검증해야 한다.
6. `lib/schedules/teaser-state-cache.ts:1–18`은 process single-flight일 뿐 분산 lock 아님. CDN miss·instance/지역 수·실제 원본 RPC 수 없이 시청자 수와 무관한 DB 비용이나 절감률을 주장하지 않는다.

## 기존 unit8 / harness2 분류

**이 lane은 전체 unit/harness를 새로 실행하지 않았다.** 077 역사 로그는1681 PASS/8 FAIL이며, 최신078 root 기록은 [ACTIVITY_COVERAGE](ACTIVITY_COVERAGE-20261017.md)의1701 PASS/기존8 FAIL이다. 둘을 이번079 새 실행 결과로 표시하지 않는다.

| 기존 실패 | 소스 대조 | 처리 방향 |
|---|---|---|
| centering-vs-animation1 | 위 toast transform 충돌 | 실제 수정+기존 검사+실물 |
| public-cache-revalidate1 | `calendar-actions.ts:18–39` 생일 미리보기는 개발자 studio 전용·공개응답 무관 명시 | public 영향 없는 action을 정규식 전수 검사에서 명시 분류. 공개 캐시 검사는 유지 |
| timeline-route1 | 공개 vod-timeline route `:22–23`에 CDN60초 비용정책 명시, 옛 unit은 no-store | 받아들인 TTL 정책/실패 no-store 검증. 비용 정책을 무조건 되돌리지 않음 |
| vod-chat-recovery2 | `vod-chat.ts:321–324` 완료 재점검3일/365일 정책, 옛 unit1일/30일 | 현재 정책과 KST14일 경계 검증. timeline 수정 trigger의 재처리 enqueue는 별도 확인 |
| scroll-position-wiring1 | 위치 측정 anchor를 계속 유지, 실제 rail만 pos 조건부 | 문자열 `if (!pos) return null` 강제 대신 overflow0→양수·빈 rail 미표시 동작. anchor 제거 금지 |
| ambient-codex2 | 모든 biome 최소 종 요구와 R80 static marine/old fauna 미렌더 결정 차이 | static/pending 생태를 명시하고 승인 없이 아트·동물을 복원해 test만 맞추지 않음 |
| harness2 | `rule-migration.mjs:157,202` active rule inventory hash/table 불일치 | 현 규칙 ID inventory/mapping 재생성·검토. 규칙을 삭제해 녹색으로 맞추지 않음 |

## 프런트엔드·OBS·모바일·접근성

`public-poster.tsx:1275–1310`는 상세창이 열려 있는 동안 매rAF 위치 측정을 반복한다. `studio-shell.tsx:3171–3218`도 panel/row/workspace BCR를 반복한다. 이는077의 editor 자체 read attribution과 일치한다. 빅타민 quiet0과 전체 UI quiet0은 다르다. event/ResizeObserver/finite FLIP lease로 바꿀 때는 두 화면의 실제 팝오버 drag/scroll/fold를 함께 검증해야 한다.

공유 companion은 lazy import(`public-poster.tsx:141`, `studio-shell.tsx:216`), decoded image는 최대3·동시2(`sprite-quality.ts:47–109`), display cadence와 bounded follower를 유지한다. 디스크에2.5–3.9MB급 ambient PNG가 있는 것은 파일 크기 관측일 뿐 실제 initial transfer/GPU 메모리 증거가 아니다. 고정 build/seed의 waterfall·decoded canvas·longtask·heap을 따로 측정해야 한다.

권장 QA는 다음과 같다. 이 목록 자체는 실행 결과가 아니다.

- 1920 화면에서 season+companion+popover 동시 사용, idle/drag/scroll/20회 열기닫기의 layout/longtask/heap/reference 해제. visible→blur→hidden→복귀 및 이미지 slow/failure 포함.
- 모바일320/390, viewer1040/studio999 경계·coarse landscape, 앱/OS reduced motion·gfx off·dark. companion/ambient canvas는 미마운트·무요청인지 검사. `capability.ts:7–42` 공유 gate가 있어도 PC 폭 축소 캡처만으로 실제 기기 증명은 안 됨.
- Tab/ShiftTab/Escape·focus 복원·중첩 dialog·portal aria-owns·소프트키보드·safe area. `use-focus-trap.ts:14–40`의 rect 필터만으로 inert/다중 창/스크린리더를 증명하지 못함.
- 긴 제목/여러 부제/태그·빈 데이터/오류/재시도, 최초공개 마지막10초 장식·섬광·숫자 집중·지연 데이터. timer aria-live off와 완료 polite status(`premiere-stage.tsx:193,265`)가 유지되는지 확인. 서버 카운트다운 hydration과 fake clock 혼합 금지.
- 실제 OBS/SOOP 송출 PC에서 앱 지연·송출 drop frame 별도 측정. CPU throttle/fixture 검사는 대리지표이며 실제 무끊김 보증이 아니다.

## root DB 집계 독립 해석과 의존성 후속

root의 `.scratch-pw/platform-079-db-extra.json`은 직접 DB 요청 없이 검토했다. 이 extra 파일 단독에는 named RPC reset 기준이 없다. root의 별도 db-metrics.json/DB 기록은 pg_stat_statements reset을9월28일11:34KST로 제시하며, 해당 누적 기준으로 함께 읽어야 한다. 누적값을 현재 TPS·p95·현재 트래픽의 일당 비용·절감률로 환산할 수는 없다. WAL/temp 누적은 현재 disk가 아니고, TOAST size는 bloat 비율이 아니다. incomplete135는 retry/age가 없어 고착이라 단정 못 하며 complete268의 checkpoint null은 정리 방어의 긍정 증거다. 최근72개 HTTP 성공은 약6시간 전달 범위이며 내부 graph catches 분기의 부분 실패까지 보증하지 않는다. events SELECT+RLS/view rlsfalse는 그 자체 유출 증거가 아니다. retention query42703은 미확인으로 유지한다.

root production audit와 설치 트리에는 **high 패키지3개/고유 advisory4개**가 있다. Next15.5.24의 직접2개는 Pages self-host 또는 root catch-all+SSG/ISR 조건이며 현재 App Router/Vercel/무catch-all 구조에는 조건이 맞지 않거나 공격 경로가 확인되지 않았다. [Next 공식15.5.27 보안 릴리스](https://github.com/vercel/next.js/releases/tag/v15.5.27)에 수정이 포함된다. sharp0.35.4 override는 SVG/glibc 조건의 librsvg 위험에 대해 [공식0.35.5 patch](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w) 검토가 필요하다. source-map-js1.2.1은 PostCSS를 통해 설치되며 악의적인 indexed map 입력에 대해 [공식1.2.2 수정](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2)이 있다. 해당 입력이 운영 사용자에게서 decoder/map consumer까지 도달함을 재현하지 않았으므로 네 건 모두 실제 운영 악용 가능하다고 확인한 것은 아니다.

실제 경로·버전별 상세 대조와 권장 최소 patch는 [의존성 보고서](PLATFORM_AUDIT_DEPENDENCIES-20261017.md)에 남겼다. 이 lane은 설치/업데이트/운영 공격 요청을 하지 않았다. 알려진 advisory 검사·RLS 카탈로그·fixture PASS를 전체 무취약/과거 침해 없음 선언으로 확대하지 않는다.
