# 일일 점검: 위험 우선 + 주간 분산

2026-10-22 사용자 지시로 매일200·한 실패마다 전체 재시작·모든 수정에3명 전영상 심사를 폐기했다. 기존09:00 KST 예약 `automation`을 수정하며 새 예약은 만들지 않는다. 전체 인증기는 보존하지만 매일 또는 긴급 수정의 필수 관문으로 호출하지 않는다. 선택 검사의 결과를 과거 full200/정상속도36 승인으로 올리지 않는다.

## 하루 흐름

1. 현재 지시·활성 작업·승인 backlog와 `.scratch-pw/site-daily/state.json`을 확인한다. 같은 작업이 진행 중이면 중복 서버/빌드/검사를 시작하지 않는다.
2. 기본20분을 진단 목표로 둔다. 짧은 공통 공개/인증/KST 단위검사 + 위험1영역 + 오래 관측하지 않은1영역을 고른다. 다른 사이트 영역도 fixture 상호작용·소스 검토로 순환하며 오프라인 단위만으로 실제 UI 완료라 하지 않는다.
3. 최근 변경/실제 실패/신고 사례 우선으로 native를 선택하고 남는 예산에서 주간 회전을 채운다. 기본 최대42건/1500 worker초 추정,3workers이며 native 실행 상한15분이다. 전체 진단20분은 에이전트가 관리하고 수정/출시 시간과 분리한다. 긴급 버그는 관련 단위+대표 화면 몇 건부터 수정·배포한다.
4. 실패를 제품/검사·fixture/관측 경합/환경/증거 부족/미실행으로 분리한다. 원실패를 보존하고 실패·미실행·무효화된 사례만 이어간다.3개 실패 또는 시간 상한에서 새 실행을 멈추고 원인과 남은 항목을 기록한다. 반복 실패를 통과로 바꾸는 무한 재시도는 없다.
5. 실제 결과·비작성 독립 검수·영향 경계로 출시 여부를 결정한다. 선택 검사에는 전체 인증기의200/27entry/9daily/전영상 gate를 적용하지 않는다. 미해결 중대 결함은 영향 범위 출시를 막는다.

```powershell
node scripts/site-daily/runner.mjs --day 2026-10-23 --base <마지막 검사 ref> --history <확인된 영역 ledger> --case-history <focused receipt 목록> --run-offline
node scripts/site-daily/scoped-native.mjs --plan <새 출력>/plan.json
node scripts/site-daily/scoped-native.mjs --plan <동일 계획>/plan.json --continue-from <이전>/result.json --receipt-sha <이전 result SHA256>
```

`runner`의 기본은 계획만 생성한다. `--changed <경로 배열 JSON>`, `--signals <허용 집계 JSON>`, `--ideas <목록 JSON>`도 지원한다. `--base` 없이 HEAD만 비교하면 그동안 커밋한 변경을 놓칠 수 있으므로 마지막 검사 ref를 전달한다. `--list-only`는 현재 exact 등록만 대조하며 실제 실행/PASS가 아니다. `--reuse-build <result.json> --build-receipt-sha <SHA>`는 입력이 같은 검증된 빌드만 복사하고 native는 새로 실행한다.

## 주간 회전과 이월

`native-catalog.json`은 과거200개 등록과 신규 전등21개를 합친221개의 **등록 목록**이다. 기본262px 집의 근거리 좌/우 진입·soft·OS reduce 회귀4개와 줄 hover/제보된 옵션 조합3개도 포함한다. 과거 실제 시간은 선택 비용의 추정값이며 현재 PASS나 실측 절감이 아니다. 긴 순서부터 가장 가벼운 묶음에 배치해7개 묶음을 만들고, 실제 성공 관측이 가장 오래되거나 없는 사례를 우선한다. missed day/실패/예산 초과의 미실행은 이월한다. 필수 위험 사례가42개 상한에 걸리면 `pendingPriorityIds`에 남긴다. 실패가 많은 주에는7일 내 전부 끝난다고 보장하지 않고 실제 고유 관측 수/누락을 보고한다. 7일간 매일 한 영역을 관측했다는 상태도 모든 설정의 안정성 인증이 아니다.

142 daily는 명시된9개 고정 시나리오를 사용해 제목·성격·surface·폭·시간대 등의 등록을 동결한다. 주간 검토에서 필요할 때 설정을 새로 선택하고 등록 ID/시나리오/원증거를 함께 갱신한다. 같은 제목이라도 테스트 소스가 달라지면 기존 PASS를 재사용하지 않는다. 모든 설정의 조합을 매일 실행하거나 계획한 motion을 actual motion으로 세지 않는다.221개 외 새로운 회귀도 등록·비용·선택 사유를 갱신해 편입한다.

영역 history는 검수자가 원run/reporter/source digest를 확인한 뒤 투영한 ledger다. planner 자체가 파일 진정성을 보증하지 않는다. case-history는 `[{"receipt":"<절대 result.json>","sha256":"<고정 SHA256>"}]` 형식이며 실제 원증거를 다시 해시 검증한다. 재사용은 실제 관측일을 늘리지 않는다. 중복 영수증이나 오래된 입력이 최신 관측일을 덮지 않으며 같은 날 PASS 뒤 FAIL도 위험 우선으로 돌아간다. 단위 PASS는 native 날짜가 아니다.

## 실행·재사용 경계

`scoped-native.mjs`는 `.env/.git/비공개 원화`를 제외한 별도 source snapshot, 기존18개 고정 machine JSON 검증, 허용된 설치 dependency junction, 최소 child env, Node 네트워크 guard와 기존 브라우저 fixture guard를 사용한다. 원 작업 트리에 빌드하지 않으며 운영 DB/실제 auth/API를 시험 데이터로 쓰지 않는다. 자기 소유의 loopback 서버/PID만 만들고 원 child의 close까지 기다린 뒤 정리 완료를 기록한다. 사용자의3194 등 기존 서버는 건드리지 않는다.

source freeze, 제품/자산/스타일/빌드 입력, 정확한 테스트·공통 helper/oracle/guard, 명시 시나리오·viewport/DPR·worker·retry, Node/Next/Playwright/실제 Chromium 실행파일을 fingerprint로 묶는다. 빌드 파일집합과 각 SHA, reporter·raw/영상/trace도 고정한다. 빌드는 관련 입력이 같은 경우 한 번만 만들고 확인된 파일만 복사한다. 같은 BUILD_ID와 전체 case fingerprint가 같은 원래 실제 PASS receipt만 재사용한다. 원 receipt chain을 검증하므로 여러 번 이어해도 성공 사례를 다시 실행할 필요가 없다. 원 report가 일부 실패여도 정상 종료·guard·동결·개별 PASS가 유효한 다른 항목은 보존한다.

현재 구현은 보수적으로 동일 불변 빌드의 PASS만 재사용한다. 제품 변경/의존성 불명/테스트·도구 수정은 관련 증거를 무효화하며 **이 때문에 전체200을 다시 실행하지 않는다.** 교차 빌드 native 재사용은 구현하지 않았다. 동시 변경을 포괄적인 git-state 동결 실패로 취급하지 않고 검사하는 snapshot만 동결한다. 이후 새 변경의 출시에는 별도 영향 검증이 필요하다.

각 attempt는 새 경로에 저장한다. `scopeSatisfied`는 선택 항목만의 결과이며 `fullCertification:false`, `normal36:UNVERIFIED`를 유지한다. 재시도/skip/누락/expected-failure/불완전 reporter는 PASS가 아니다. 새 report는 원본을 수정하지 않으며 결과 SHA를 별도 ledger에 고정한다. 이 무결성 검사는 서명·검수자 신원 인증·자동 출시 승인이 아니다.

## 아이디어·프라이버시·검수

영역+problemKey로 제안/승인/완료/거절을 합친다. 사용자 이득×근거 신뢰도 대비 구현+토큰+유지 비용으로 제안 최대3개, 승인 후 동시 구현2개를 기본으로 한다. 승인받은1·2번과 버그 수정은 계속하고 실행취소/다시실행 버튼 제안은 재추진하지 않는다. 기존 완료된156/157의9개를 재등록하지 않는다. 새 기능은 채택받되 기존 승인을 반복 확인하지 않는다.

원문/개인 식별자/취향·수집·학습 정보·운영DB를 새로 수집하지 않는다. 기존 권한이 확인된 목적 제한 고정 분류 집계만 투영하고 자료 없음과0을 구별한다. 합성 자료는 실제 불편 근거가 아니며 소수 표본 억제는 익명성 보장이 아니다. 삭제 부수효과 있는 getActivityDayAction/pruneActivity를 읽기 수집으로 호출하지 않는다. 운영 DB setup/삭제 통합검사는 자동 실행하지 않는다. 일반 UI 변경은 G22 기존 고정 target/타임라인/최소사용 항목을 감사하고 자율행동을 사람의 사용으로 기록하지 않는다.

독립 검수는 변경의 역할/경계/UX/증거를 담당한다. 모든 항목에3명의 전영상 반복 심사를 요구하지 않는다. 원본 실패·증거·사용자 자산은 보존한다.36개 정상속도는 두 검수자의32B 기술 검증이 모두 실패한 뒤 계속 미검증이며, 새 모델/유료API를 시작하지 않는다. 상태 변화가 없으면 반복 보고하지 않고 새 결함·완료·판단할 제안만 알린다.

## 공신력 있는 근거와 적용 한계

- [Google Research, Regression Test Selection at Scale (2026)](https://research.google/pubs/regression-test-selection-at-scale-4/): 의존성과 위험을 기준으로 비용 내에서 검사 대상을 고르는 근거. 이 연구의0.9%비용/실패 커밋40% 검출은 모든 회귀 보장이 아니며 우리 사이트의 실측 절감률로 전용하지 않는다. 이 구현은 ML/call graph 예측기를 도입하지 않고 명시 위험+누락 회전으로 시작한다.
- [Playwright CLI](https://playwright.dev/docs/test-cli): exact grep/list, 실패 제한, last-failed 등 부분 실행 지원. Git 변경 test 파일만 고르면 제품 의존성 영향을 전부 알 수 있다는 뜻은 아니다.
- [Playwright Retries](https://playwright.dev/docs/test-retries): 실패 worker를 분리하고 다음 시험을 계속할 수 있다. 한 실패가 이전 성공 전체를 재실행할 기술적 이유는 없다. 자동 retry는 끄고 원실패를 보존한다.
- [Google Testing Blog, Flaky Tests (2016)](https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html): 동시성/비결정성/환경 원인을 구별하고 재시도 성공으로 원결함을 숨기지 않는 근거. Google의 과거 비율을 현재 사이트의 flake율로 쓰지 않는다.
- [Google SRE, Testing for Reliability](https://sre.google/sre-book/testing-reliability/): 변경과 요구 신뢰도에 맞는 검사로 불확실성을 줄인다. 좁은 검사 결과를 미관측 로그인·RLS·기기·OBS·전체 영상 검증으로 확장하지 않는다.

오늘의 실제 원인·긴급 수정·시간·검사 결과는 [focused QA plan](../../docs/agent/plans/PLAN-20261022-focused-qa.md)에 보존한다. 선택/회전의 비용 효과는 다음7일 실제 완료 기록으로 평가한다.
