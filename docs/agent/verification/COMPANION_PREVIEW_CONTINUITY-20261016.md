# 편집실·시청자 미리보기 빅타민 위치 연결 검증

2026-10-16 KST. [PLAN-065](../plans/PLAN-20261016-065-companion-preview-continuity.md). 최종 단위·타입·린트·빌드 완료, UI 검증 진행 중·운영 배포 대기. 이전063/064의 PASS를 이번 수정의 실행 근거로 재사용하지 않는다.

## 범위와 경계

실제 owner/developer의 StudioShell이 가진 client-only ref 하나를 편집실과 서버에서 공개 전용 snapshot을 받은 시청자 미리보기의 같은 엔진에 전달한다. 화면 전환 시 위치·viewport·월과 집/집바닥 또는 명시적인 현재 공개 일반 카드의 상대 위치만 잇는다. 역할 미리보기는 실제 권한을 바꾸지 않는다.

본문·제목·태그·인증/계정 정보·비공개/미공개 카드 ID·DOM·brain/행동·음식·숨기/모달/최초공개 상태는 handoff 대상이 아니다. 새 전역 상태·브라우저 storage·서버/DB·공개 DTO·상시 관측/프레임 loop·자율 스크롤을 추가하지 않는다. 공개 카드 ID는 기존 공개 일반 카드 allowlist의 DOM으로만 증명하며 임시 card-N 번호는 정체성으로 쓰지 않는다. KST·92px·1840 표면·모바일 전체 제외·기본OFF 정책은 유지한다.

## 구현 검토

- `position-memory.ts`는 viewport 상대 검색점의 유한값/전체 셀 경계를 검사하고, 같은 월의 실제 집/집바닥 또는 같은 공개 카드 후보만 선택한다. 수동 card-top과 자율 text span을 구별하며, 없는 지원이나 coarse 검색점에서 발판을 만들지 않는다. 입력 snapshot·기하 배열도 변경하지 않는다.
- renderer는 DOM 삭제 전 layout cleanup에서 포착한다. 늦은 passive cleanup은 기존 엔진 내부 lastPose만 기록하므로 다음 화면의 공유 기억을 덮지 않는다. 새 화면의 첫 기하 실측에서 현재 안전 후보로 재연결하고 성공한 handoff만 소비한다.
- 카드가 사라지거나 월/공개 상태가 달라지면 가까운 실제 지원으로 복구한다. 접힘/미마운트/화면 밖 집은 기존 resident 가림을 유지하며 다른 카드로 강제 이주하지 않는다. 최초공개 진입/반환과 상세창 밖 배치의 기존 우선순위가 위치 handoff보다 앞선다. 무paint reduced/late 최초공개 진입도 pending handoff를 폐기한다.
- 독립 검토에서 카드 비율의 clipped rect 사용을 발견했다. 기존 hide-target collector의 visible rect는 viewport/ancestor clipping 교집합이므로 다른 레이아웃에서 상대 위치가 달라질 수 있었다. 공개 allowlist는 유지하면서 capture/restore의 비율 범위를 실제 카드 `getBoundingClientRect()`로 바꿨다. 기존 유한 capture/geometry 경로에서만 읽는다.
- 도착 화면의 `.public-calendar-area`는 유한 `poster-slide-next` 진입 중 opacity0이라 첫 실측에 공개 카드0개·발판1개만 남을 수 있다. 후보가 없을 때만 기다린 v2도 fit 중간 기하를 조기 소비해 상대 위치 오차4.538px가 발생했다. 최종 v3는 후보 복원 여부와 관계없이 이미 실행 중인 유한 진입 animation의 `finished`를 `Promise.allSettled`로 한 번 기다린 뒤 기존 geometry 구독을 재연결한다. 반복 polling이나 새 상시 timer는 없다. 임시 진단 console은 제거했다.
- handoff 대기 중 paint는 pet/앞면을 숨기고 tick은 재예약 없이 끝난다. 실제 후보를 얻어 소비할 때 동작·욕구·돌봄의 세 시계를 현재 시각으로 다시 맞추고 기존 scheduler만 한 번 깨운다. 따라서 전환 대기시간을 활동/욕구 경과로 누적하지 않는다. 접힌 집은 pending을 유지하며 기존 실제 layout 변경을 기다린다. 최종 v3의 owner/developer 공개 카드 왕복은 기존 x오차3px 미만·y오차2px 미만 단언을 그대로 통과했다.

## 실행 결과와 남은 검증

| 범위 | 상태·근거 |
| --- | --- |
| 순수 위치 단위 | 12/12 PASS, child exit0(09:29 KST). viewport 정규화·경계/invalid·실제 cushion 범위·home-floor 조각/가림·같은 공개 카드/삭제·잘린 카드의 전체 범위·수동 top 구별·월/seed·실측 후보·오염 범위·입력 불변성. |
| scoped lint | helper와 전용 단위 파일 exit0. 전체 lint 결과와 구별한다. |
| 관련 통합 단위 | 최종 root 실행 45파일457개 PASS(09:39 KST). 순수 위치12개를 포함한 관련 범위이며 실제 UI 성공 횟수와 합치지 않는다. |
| 독립 소스 검토 | layout/passive cleanup 소유권, 실제 카드 BCR, 기하 후보 재연결, 집 가림과 공연 우선순위를 읽었다. 이 기록은 렌더 검증을 대신하지 않는다. |
| 문서 하네스 | exit1: 기존 Active rule IDs inventory/mapping 불일치2건. 단위·lint 성공과 구별한다. |
| 전체 type/lint/build | 최종 전체 type/lint exit0, production build27914 exit0. 세 시계 재기준화와 조건 없는 유한 진입 대기를 포함한다. |
| 새 실제 입력 fixture6 | 최종 v3 6/6 PASS, child exit0·실패/skip/flaky0·50.21초. owner/developer 공개 카드 왕복, 실제 쿠션/집바닥, 접힌 집 대기/복구, 닫힌 집 상태 실제 floor 배치, 모바일 owner/developer 전환 제외를 포함한다. 공개 snapshot 읽기 POST13회는 정확히 가로채고 실제 mutation/pageerror0·중복 pet 프레임0. 독립 QA가 PNG6장을 직접 검수했다. |
| 기존 공유 회귀22 | 최종 빌드 첫 실행20/22, 동일 빌드·단언 변경 없이 실패2개 별도 실행2/2 PASS(child exit0·18.6초). 정상22/22 단일 실행으로 쓰지 않는다. 이전 조건부 intro 빌드에서는22/22였다. 아래 실패 근거를 보존한다. |
| 운영·배포 | 대기. 실제 로그인 편집실 확인, 배포 SHA/결과, 운영 데이터 쓰기0 여부는 확보한 뒤 기록한다. |

```text
node node_modules/vitest/vitest.mjs run tests/unit/viewer-companion-position-memory.test.ts
node node_modules/eslint/bin/eslint.js lib/ui/viewer-companion/position-memory.ts tests/unit/viewer-companion-position-memory.test.ts --max-warnings=0
node scripts/agent-harness/verify-harness.mjs
```

v3 프레임 수는 owner101·developer 빠른 왕복342·집 쿠션/바닥246·접힌 집226·닫힌 집 floor133이며 중복 pet 프레임0이다. 앞의 네 실행에서 정확히 가로챈 공개 snapshot 읽기 POST는 각각2/4/2/1회, 닫힌 집 floor는2회, 모바일 전환은2회로 총13회다. 실제 쓰기 POST와 pageerror는 각 실행0이다. 접힌 집은66개 숨김 프레임과 대기 중 DOM writes0을 확인했다. 이 수치는 DOM 읽기 횟수나 실제 서버 전달 횟수가 아니다. raw는 `.scratch-pw/companion-065-continuity-v3-report.json`에 보존한다.

기존 회귀의 첫 실패는 cold-held 검사가 probe450ms 이후를 정지 구간으로 간주한 것이다. 실제 로그에서는458→491ms x1273.854,508ms부터 x1276.104로 마지막 스크립트 이동 한 단계(2.25px)가 그 구간에 포함됐다. 둘째는 최초공개 진입/반환·care 단언까지 끝난 뒤 teardown 중 진행 중인 `route.fetch`가 page close를 만난 오류다. 별도 재실행은 두 검사 모두 통과했다. 제품/단언을 수정하거나 실패 raw를 덮지 않았다. `companion-065-integration-settled-*`와 `-targeted-*`에 각각 보존했으며221개 기존 아티팩트의 원본 SHA도 유지했다.

물리 OBS·실기기 smoothness·실제 RLS/인증 커버리지는 위 순수 검사나 fixture로 증명하지 않는다. 사용자 미술26줄·보류 자산과 이전 raw/PNG 증거는 보존한다.
