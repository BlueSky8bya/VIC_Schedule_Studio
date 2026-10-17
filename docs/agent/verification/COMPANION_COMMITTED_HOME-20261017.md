# 부른 빅타민의 귀가 완료 검증

Status: Complete — deployed in later owner-authorized089 combined releaseb21afb8e. [PLAN-088](../plans/PLAN-20261017-088-companion-committed-home.md), [release record](COMPANION_SHAKE_RELEASE-20261017.md). Original local evidence below predates that authorization.

## 원인

087을 포함한 production fixture build `7EVIm2i3tgVWfqs-bJMVK`에서 두 실패를 실제 입력으로 확인했다.

- 귀가 이동 중 visible blur:850→670으로 한 구간을 이동한 뒤 바닥에서 resting→yawning→parked/sleep로 멈췄다. 종료 표본8,803ms에도 `homeJourney=true`, support=`viewport-floor`, state=`sleep`이었다. 명령은 남았지만 실행 시계가 멈췄다. 집 도착 단언 FAIL.
- 이미 parked인 상태의 호출: 소파를 눌러도 깨우지 않아5,083ms 후에도 x850의 바닥에서 잠들었다. 명령 시작 단언 FAIL.

당시 `viewer-companion.tsx:1033`의 presence busy에는 귀가 전체 의도가 없었고, 실행은 active만 허용했다. 구간 완료 뒤100ms 대기와180px 보행 분할이 매번 정지/재가속을 만들었다. 일시적 blocked/missing도 귀가를 취소하여 일반 AI로 돌아갈 수 있었고, 모든 동물이 amble이었다.

## 변경 계약

공유 `viewer-companion.tsx:221`에서 직접 호출(called)과 자동 귀가(automatic)를 구분했다. 직접 호출은 잠든 상태를 깨우며 도착까지 목표를 유지한다. 일반 AI의 먹이/장난/낮잠을 새로 고르지 않고, 보이는 비활성 창에서도 이 유한 명령을 마친 뒤 실제 focus 상태의 rest/yawn/CSS 수면으로 인계한다. 자동 귀가의 비활성 정책은 유지한다. 최신 소유자 요청이 바꾸는 범위는 [UI 규칙](../../ux/UI_RULES.md)의 직접 귀가 예외에 기록했다.

- `home-route.ts:85`: 현재 몸 전체가 안전한 실제 span 끝까지 한 번에 걷는다. 기존 속도 선택을 유지하며 강아지1.8배+scoot 달리기, 기본 빅타민1.2배+amble, 고양이1.0배+amble을 사용한다. 발판/도약 증명은 동일하고 공중 발판·워프는 없다.
- `viewer-companion.tsx:975`: 완료 프레임에 다음 실제 구간을 연결한다. 기본 빅타민의 눈치는 명령당320ms 최대1회이며 감소/OFF에서는 억제한다. 도착 전에 일반 수면으로 이탈하지 않는다.
- 명시 호출 전 live geometry를 연결한다. parked에서 닫아 둔 구독을 다시 사용하지 않는다. 일시적 경로 누락은 목표를 유지하고 최대1회 강제 검증 뒤 실제 geometry 변경에서 재개한다. 새 상시 폴링/타이머 종류/루프는 없다. 집이 실제 닫혔으면 취소하며, 기존 scheduler로 착지/일반 행동의 소유권을 넘긴다.
- 자율 이동/점프/낮잠OFF여도 직접 호출은 가능하다. 설정을 켜거나 저장값을 바꾸지 않는다. 낮잠OFF이면 도착 뒤 idle, 감소 동작은 기존 조용한 직접 도착을 유지한다.
- 일반 창은 현재 구간을 마친 뒤 조용히 기다리고 닫히면 목표를 재개한다. 숨김 탭·공연·모바일 제외·직접 집기/다른 명시 이동·실제 집 닫기가 우선한다. hover/Enter 쓰다듬기는 짧게 반응한 뒤 called 목표를 이어 간다.
- 즉시/초기 실측 대기 호출 모두 기존 `companion-home-call`을1회 기록한다. callback 재개가 중복 기록하지 않는다. 제목·계정 등 새 메타데이터/서버 요청을 추가하지 않았다.

이번 제품 변경은 renderer·기존 순수 home planner·소파 버튼의 disabled 조건뿐이다.087 복구, 집/음식 기하, 공개 DTO/권한/언락/KST/1840 포스터는 유지했다. 새 아트나 의존성 변경은 없다.

## 검증

최종 격리 production fixture build `iO4EbmMY2wYPLOX8gLAbh`, Windows Chromium,1920×1100. 저장 취향·기력.08·잠꾸러기·자율 이동/점프OFF를 seed하고 실제 P 배치·소파 클릭·집 제목 접기를 사용했다. `document.hasFocus` 환경값과 blur 이벤트만 모형화했으며 제품 상태/좌표/callback/시계는 주입하지 않았다. POST와 root/studio prefetch를 차단했다.

| 검사 | 결과 | 범위 |
|---|---|---|
| 새 명령 회귀 |8/8 PASS |편집실 중간 blur, 시청자/편집실 parked 호출, dog/cat/default, lite/off/reduced, 자율 낮잠OFF, parked 호출 후 실제 집 접기 |
| 전체 unit |1,934/1,934 PASS, skip0 |같은 실제 span의 단일 보행·종별 gait/속도 순서, 기존 도약·경로·발판 계약 유지 |
| 정적 검사 |build·typecheck·전체 lint PASS |독립 지적 보완 후 최종 build와 후속 typecheck·대상 lint 확인 |
| 기존 화면 회귀 |21/21 PASS |기존 귀가/중단/설정13,087 닫힘6, 일반 창 소유권2 |
| 독립 검토 |blocking0 |parked 구독 재연결 P1과 blocked 취소 후 scheduler 인계 P2를 반영한 뒤 재검토 |
| 문서 harness |PASS |237개 문서 링크·활성 수명주기·메모리 예산 검증 |

정상 귀가7개는 화면 안의 실제 `companion-home`에 도착해 명령을 해제했다. 감소1개는 조용히 도착하고, 나머지6개는 도착까지 명령·동일 노드를 유지하며 중간 수면/parked 진입이 없었다. 실제 집 접기1개는 사용자의 새 조작에 따라 명령을 취소하고 집 밖에 남았다. 모든 취향 저장 bytes는 동일했다. 기본 빅타민의 full 눈치는 각1회, dog/cat/off/reduced는0회였다. 중간 blur 기본 빅타민은 약11.95초에 도착한 뒤 parked 수면으로 인계됐다. 이 시간은 해당 fixture 경로의 관측값이며 모든 위치의 귀가 제한시간은 아니다. 새8개 모두 POST0/pageerror0. 강아지 이동/도착한 소파/고양이 상태 PNG를 직접 확인했으며 독립 QA도8종 PNG/JSON을 검토했다.

기존 검사 일부의 읽기 전용 public prefetch까지 DB 요청0이라고 주장하지 않는다. 운영 DB 쓰기나 실제 일정/설정 변경은 하지 않았다. 두 중간 build는 소스 검토의 P1/P2 보완 전 정적 결과로만 남기며 최종 화면 증거와 구분한다. 새 명령/모바일/권한의 실제 운영 로그인·RLS·OBS 장비 증거로 확대하지 않는다.

원본은 작업트리 `.scratch-pw/088-*`의 전후 JSON/PNG/trace/report다. 메인 `.scratch-pw/companion-088/`에 전후 관측·report·대표 trace를 복사했다. 제품3개·unit1개·새 화면 검사1개만 메인에 통합했고, 이전 배포와 격리 작업트리의 차이 및 새 파일까지17개 바이트 일치를 확인했다(`build-source-equivalence.json`). 087과 사용자 아트/미리보기/사후 문서 작업은 보존했다. 새8개와 기존21개 모두 retry/skip/flaky0이다.

## 한계와 전달 상태

실제 측정 경로가 전혀 없는 세계는 강제 이동하지 않고 환경 변경을 기다린다. blocked→집 닫힘의 scheduler 인계는 독립 소스 검토로 보완했으며 새 접기 검사는 정상 이동 중 직접 취소를 다룬다. 모든 blocked 기하 순열을 브라우저로 재현한 것은 아니다. 유한 직행 뒤 실제 OBS 프레임/OS 비활성/모든 화면 비율의 무끊김까지 보장하지 않는다.

별도 커밋/푸시/배포는 하지 않았다. 운영 버전은 `ecaa940f`다.
