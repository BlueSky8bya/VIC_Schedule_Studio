# 마지막 행동 전송 경계 — 2026-10-17

Status: Verified locally — 로그아웃 ID·20건 임계값 보강 후 격리 production fixture20/20 PASS. 운영 배포·실제 인증/DB 증명은 별도.
Plan: [PLAN-082](../plans/PLAN-20261017-082-provider-and-lifecycle-validation.md)

## 기존 근거와 빈칸

[078 기록](ACTIVITY_COVERAGE-20261017.md)의17/17 활동 검사는 실제 hover·키보드·드래그를 수집했다. 그러나 `tests/visual/companion-activity.spec.ts:95`의 공통 helper는 조작 뒤 합성 `blur`를 보내 전송을 완료한다. 해당 파일의 쓰다듬기 검사(`:183`)도 이 helper를 사용한다. 새로고침·실제 로그아웃·문서 이동·탭 닫기·통신 지연 자체가 마지막 행동을 보내는지는 이 근거로 확인되지 않았다. 당시 PASS를 종료 경계 PASS로 확대하지 않는다.

## 이번 실제 브라우저 실행

- 수정 전 production fixture: Next15.5.28, build `Zs5cIlJvmS3fdbVqFDS9u`. 기존3100 서버를 재사용했으며 이 lane은 빌드하지 않았다.
- 1차 수정 후 root가 한 번 빌드한 production fixture `cD7GpusKUktHwYtvsBye4`에서20개 전체를 실행했다. worker1·재시도0·skip0·flaky0,51.5초였다. Node 수집 payload20개도 모두 이 build ID와 일치했다. 이후 발견한20번째 이벤트 임계값의 보강은 이 빌드에 포함되지 않는다.
- 임계값 보강 후 최종은 `RG5zhm6oK09zKo0-1ZaCq`에서20/20 PASS,52.0초였다. 별도083 작업을 제외한 root의 명시적081/082 snapshot에서 빌드·서버를 실행했다. 테스트가 각 실제 HTTP HTML의 build ID까지 확인했다. 원 작업트리의 `.next`나083 컴포넌트에 이 PASS를 적용하지 않는다.
- 전용 검사: `tests/visual/activity-lifecycle.spec.ts`. 시청자·편집실의 실제 빅타민에 키보드 Enter 또는 포인터 왕복으로 쓰다듬기를 완료한다. `companion-pet` 기록 함수나 DOM 상태를 직접 주입하지 않는다.
- 로컬 HTTP 수집기 `127.0.0.2:3101`은 fixture/정적 파일 GET만3100으로 전달한다. 모든 API·쓰기·로그아웃은 로컬에서 응답하고 알 수 없는 요청은 차단한다. 실제 계정·운영 DB·사용자 아트는 사용하지 않는다. 별칭 호스트와 해당 격리 context의 WebDriver getter만 조절해 실제 client queue를 실행한다.
- 준비 기록만 먼저 합성 `blur`로 비운다. 마지막 쓰다듬기 뒤에는 테스트가 합성 종료 이벤트를 보내지 않는다. 실제 `reload`, 새 문서로 `goto`, 실제 로그아웃 form 클릭, `page.close({runBeforeUnload:true})`를 사용한다. 지연 검사는 활동 응답을1.8초 늦춘 상태에서 새로고침한다.
- 각 경계에서 마지막 쓰다듬기 payload가1회 도착하고 중복이 없는지, 고정 target·빈 metadata인지 확인한다. 탭을 닫은 뒤에도 Node 수집기가 요청을 관측한다. 로그아웃은 합성 cookie의 삭제 전 값이 해당 활동 요청에 붙었는지 확인한다. 실제 인증 토큰을 쓰지 않는다.

| 실행 | 관측 |
|---|---|
| 수정 전 키보드:2화면×5경계 |9 PASS /1 FAIL. PC 편집실 로그아웃에서만 활동 요청의 합성 session marker가 이미 삭제됨 |
| 수정 전 hover:2화면×새로고침/탭 닫기/지연 새로고침 |6/6 PASS |
| 수정 전 hover 편집실 로그아웃 |같은 삭제 후 전송 결함 재현. 초기 착지 중 조준하던 검사1건은 착지 대기를 추가한 뒤 분리 재검사 |
| 1차 수정 후 단위 |새3+기존 수동계측3 =6/6 PASS |
| scoped lint |수정한 client와 새 unit/visual 파일 PASS |
| 1차 수정 후 production20개 |20/20 PASS. 마지막 쓰다듬기 모두1회 수신·처리, 네 로그아웃 case 모두 cookie 삭제 전 전송. page error·미상 요청·외부 요청0 |
| 추가 임계값 회귀 |기존19건+로그아웃20번째의 두 ID 모두 keepalive=false로2 FAIL 재현. 보강 후 새5+기존 수동계측3=8/8 PASS |
| 임계값 보강 후 production20개 |20/20 PASS, worker1·재시도0·skip0·flaky0. 네 로그아웃 모두 삭제 전 cookie, 모든 쓰다듬기1회, page error·미상/외부 요청0 |

## 결함과 수정

`components/studio/studio-shell.tsx:7467`의 PC 버튼은 `data-act="io-logout"`이다. `lib/activity/client.ts`의 위임 클릭은 이전에 `logout`만 즉시 flush했다. 실제 PC 편집실에서는 pending 쓰다듬기·로그아웃이 form 응답으로 cookie가 제거된 다음 문서 종료 경계에서 전송됐다. 어떤 종료 리스너가 먼저 flush했는지는 계측하지 않았다. 시청자/모바일의 `logout` 버튼과 달랐다. 마지막 기록의 도착 자체보다 **로그아웃 전 신원으로 보내는 순서**가 실패했다.

처음에는 두 기존 ID 모두 클릭 기록 뒤 `flush(true)`를 호출하도록 수정했다. root 최종 리뷰에서 기존19건+로그아웃20번째이면 `logActivity`의 일반 크기 임계값이 먼저 `flush(false)`를 실행하고 뒤의 keepalive flush는 빈 배치가 된다는 경계를 추가 발견했다. 두 ID에서 실제 단위 RED를 먼저 보존했다.

최종 보강은 `logActivity`에 전송 전용 `flush:"keepalive"` 옵션을 전달하고, 명시적인 Pending 필드만 추가한 다음 크기/나이 판정보다 먼저 `flush(true)`를 실행한다. 이 옵션은 기록 payload에 들어가지 않는다. 새 `tests/unit/activity-logout-lifecycle.test.ts`는 두 ID의 즉시 keepalive·20번째 로그아웃의20건/keepalive=true/전송 옵션 미수집·응답 없는 요청에 뒤따르는 hidden/pagehide/blur의 중복0·일반 배치를 검사한다. 새 DB·수집 필드·저장 정책·매 클릭 요청은 추가하지 않는다.

## 원본과 재실행

로컬 원본(커밋 제외): `.scratch-pw/activity-lifecycle-before-report.json`(9/1), `activity-lifecycle-before-studio-logout.json`, `activity-lifecycle-before-hover-logout-report.json`, `activity-lifecycle-before-studio-hover-logout.json`, 별도 `activity-lifecycle-before-*-trace.zip`.1차 cD7 빌드의20 PASS는 `activity-lifecycle-first-fix-cD7-report.json`/`activity-lifecycle-first-fix-cD7-summary.json`에 보존했다. 최종 RG5는 `activity-lifecycle-report.json`, `activity-lifecycle-final-summary.json`, 두 입력×두 화면×다섯 경계의 `activity-lifecycle-{surface}-{input}-{transition}.json`이다. 원 실패와 이후 결과를 구별한다.

첫 hover 조준 실패는 초기 착지 완료를 기다리도록 보완했다. 최종 build 첫 실행은 엄격해진 GET allowlist가 Vercel analytics script2개를 미상으로 처리하여 첫3개가 실패했고 중단했다(`activity-lifecycle-proxy-allowlist-report.json`). 이를 운영에 전달하지 않는 명시적 로컬 빈 JS 응답으로 보완한 뒤20개를 모두 재실행했다. 두 harness 실패를 제품 종료 결함으로 세지 않는다.

제품 client 변경은 root 독립 리뷰, 검사/수집기는 다른 입력 lane의 독립 읽기 리뷰를 거쳤으며 blocking finding은 없었다. 임계값 보강의 diff/신규5개 단위 회귀도 작성자 외 입력 lane이 재검토해 blocking0을 확인했다. 실제 로그아웃 API의 SDK 실패 처리 변경은 별도 security lane의 수정이며, 이 문서의 HTTP 수집기는 그 API를 대체하므로 해당 서버 수정의 검증으로 세지 않는다.

추가 임계값 원본은 `activity-logout-threshold-before.json`(3 PASS/2 FAIL), `activity-logout-threshold-after.json`(8/8 PASS)이다.20번째 이벤트의 정확한 keepalive 플래그·20개 순서·전송 옵션 미수집은 이 실제 client 함수 단위 회귀에서 확인한다. 브라우저20개는 native 쓰다듬기1건 뒤 종료를 검사하므로, 브라우저에서19개 대기 이벤트를 만든 검사로 부르지 않는다. 별도083 채팅의 빅타민 컴포넌트 변경은 이번082 build/commit 범위에서 제외한다.

일반 단독 실행은 `npm run test:visual -- tests/visual/activity-lifecycle.spec.ts`로 production fixture 서버를 준비한다. 이번 공유 서버에서는 로컬 전용 config에 `webServer: undefined`를 사용해 빌드를 재생성하지 않았다.

```powershell
$env:VISUAL_TEST_BUILD_DIR = 'C:/Projects/VIC Schedule studio/.scratch-pw/release-082/.next'
npx playwright test --config .scratch-pw/activity-lifecycle.config.ts
npx vitest run tests/unit/activity-logout-lifecycle.test.ts tests/unit/activity-manual-controls.test.ts
npx eslint lib/activity/client.ts tests/unit/activity-logout-lifecycle.test.ts tests/visual/activity-lifecycle.spec.ts --max-warnings=0
```

## 확인하지 않은 것

- 로컬 수집기의 수신은 실제 `/api/activity` 권한·Supabase 저장·실제 owner/developer 세션의 증명이 아니다. 합성 cookie는 브라우저 요청 시점의 순서만 증명한다.
- 20개는 쓰다듬기의 두 입력×두 화면×다섯 경계다. 옮기기·딱밤·음식·모든 설정의 종료 경계를 전수 검증한 수치가 아니다.
- 문서 이동은 fixture에서 로컬 새 문서로 이동한 것이며 편집실↔시청자 preview의 전체 라우팅 순열을 뜻하지 않는다. Android/iOS·실제 브라우저 전체 종료·OS 강제 종료·오프라인·패킷 손실·64KiB keepalive 예산 초과는 미검증이다.
- 지연 검사는 응답1.8초 지연이다. 운영 DB 지연이나 실제 네트워크 단절을 재현한 것으로 부르지 않는다.
- 기록은 기존 best-effort 정책이다. client는 전송 전에 메모리 buffer를 비우고 실패를 재시도하지 않는다(`lib/activity/client.ts:60`, `:71`). 관측한 각 case의1회 전송은 모든 실패에서의 영구 저장·exactly-once 보장이 아니다. durable retry/idempotency 정책은 이번 최소 수정에 추가하지 않았다.
