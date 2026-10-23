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

`scoped-native`는 별도 옵션이 없으면 해당 checkout의 `.scratch-pw/site-daily/build-history.json`에서 같은 제품 입력의 검증된 빌드를 먼저 찾는다. `--build-history <pinned receipt 배열 JSON>`으로 후보 목록을 명시할 수 있다. 종료한 실행의 빌드 무결성이 확인되면 이 전용 목록을 원본 compile 영수증으로 접어 원자적으로 갱신하고 최대200개를 유지한다. 테스트 실패와 빌드 실패는 구별한다. 정상 빌드 뒤 테스트가 실패해도 빌드 바이트만 재사용할 수 있고, 실패 사례는 다시 실제 실행한다. 이 목록은 case-history나 PASS 인증이 아니다. 파일·제품 입력·런타임·guard·종료 증명이 맞지 않으면 재사용하지 않는다. CLI의 `buildHistoryUpdate.reason`이 있으면 갱신 누락을 다음 점검에 이월하며 원검사 결과와 구분한다.

## 주간 회전과 이월

`native-catalog.json`은 과거200개 등록과 전등21개·구독 영상 시각 링크4개·승인된 생활 의도/이동의6개 공유 표면 관측과 실제 탐험 도중 실물 조사·원목적 재개1개, 단일 초원 산책5개, 실물 동행/배치 유지3개, 장난감 축/고정 동작2개와 공유 계절 감상 입력/복귀 경계8개를 합친250개의 **등록 목록**이다. 산책5개는 세 표면·사계절·노출된 빅타민의 입장/OFF/reduce를 다룬다. 이전 cold sprite 복구 제목은 현재 입장 조건 검사로 대체됐으며 지금 등록을 cold decode 복구 증거로 표시하지 않는다. 새 동행3개는 viewer/owner/preview에서 집 안 대상 제외·실제 바닥 물체 입장·덮인 배치의 재입장 유지·월 이동/새로고침 초기화를, 장난감2개는84종 정상/reduced 기계 동작을 검사하도록 등록했다. 장난감 fixture는 자율 생활 AI나 수집 완료의 증거가 아니다. 생활 의도6개는 viewer/studio/preview × 탐험둥이/먹보의 실제90초와 중간 새 실물 장난감 입력을 기록하며, 등록만으로 새 자극에 대한 특정 반응·반복 감소·정상속도 영상 승인을 뜻하지 않는다. 기본262px 집의 근거리 좌/우 진입·soft·OS reduce 회귀4개와 줄 hover/제보된 옵션 조합3개도 포함한다. 과거 실제 시간과 신규 동행85초·장난감20초는 선택 비용의 추정값이며 현재 PASS나 실측 절감이 아니다. 긴 순서부터 가장 가벼운 묶음에 배치해7개 묶음을 만들고, 실제 성공 관측이 가장 오래되거나 없는 사례를 우선한다. missed day/실패/예산 초과의 미실행은 이월한다. 필수 위험 사례가42개 상한에 걸리면 `pendingPriorityIds`에 남긴다. 실패가 많은 주에는7일 내 전부 끝난다고 보장하지 않고 실제 고유 관측 수/누락을 보고한다. 7일간 매일 한 영역을 관측했다는 상태도 모든 설정의 안정성 인증이 아니다.

142 daily는 명시된9개 고정 시나리오를 사용해 제목·성격·surface·폭·시간대 등의 등록을 동결한다. 주간 검토에서 필요할 때 설정을 새로 선택하고 등록 ID/시나리오/원증거를 함께 갱신한다. 같은 제목이라도 테스트 소스가 달라지면 기존 PASS를 재사용하지 않는다. 모든 설정의 조합을 매일 실행하거나 계획한 motion을 actual motion으로 세지 않는다. 현재250개 외 새로운 회귀도 등록·비용·선택 사유를 갱신해 편입한다.

공유 감상 경계8개는 기존과 같은 ID·제목으로 정식 등록해, 산책/생활 검사와 섞인 원 영수증의 검증된 투영을 그대로 수입한다. 별도 미등록 항목 필터를 만들지 않는다. 비용 추정8·17·6·8·8·16·16·16초는 2026-10-23의 이전 원13건 실행에서 관측한 해당8개 시간을 올림한 값이다. 이 과거 시간이나 등록 자체는 현재 제품의 PASS가 아니며 원 report·PASS·관측일을 바꾸지 않는다.

제목/계약을 의도적으로 폐기할 때는 `retiredRegistrations`에 이전 id/file/title·새 replacementId·이유를 명시한다. planner는 이미 검증된 영수증 투영 중 이 정확한 이전 id만 회전 대상에서 제외하고 `selection.retiredObservations`에 이전 결과·제외 이유·`passTransferred:false`를 남긴다. 원 영수증·실패는 보존하며 새 id는 미관측으로 남는다. 미등록 unknown id, 검증되지 않은 폐기 관측, 잘못된 선언·미래 날짜는 계속 오류다. 등록에 없는 과거 관측을 일반적으로 조용히 버리는 필터는 없다.

영역 history는 검수자가 원run/reporter/source digest를 확인한 뒤 투영한 ledger다. planner 자체가 파일 진정성을 보증하지 않는다. case-history는 `[{"receipt":"<절대 result.json>","sha256":"<고정 SHA256>"}]` 형식이며 실제 원증거를 다시 해시 검증한다. 재사용은 실제 관측일을 늘리지 않는다. 중복 영수증이나 오래된 입력이 최신 관측일을 덮지 않으며 같은 날 PASS 뒤 FAIL도 위험 우선으로 돌아간다. 단위 PASS는 native 날짜가 아니다.

## 실행·재사용 경계

`scoped-native.mjs`는 `.env/.git/비공개 원화`를 제외한 별도 source snapshot, 기존18개 고정 machine JSON 검증, 허용된 설치 dependency junction, 최소 child env, Node 네트워크 guard와 기존 브라우저 fixture guard를 사용한다. 원 작업 트리에 빌드하지 않으며 운영 DB/실제 auth/API를 시험 데이터로 쓰지 않는다. 자기 소유의 loopback 서버/PID만 만들고 원 child의 close까지 기다린 뒤 정리 완료를 기록한다. 사용자의3194 등 기존 서버는 건드리지 않는다.

source freeze, 제품/자산/스타일/빌드 입력, 정확한 테스트·공통 helper/oracle/guard, 명시 시나리오·viewport/DPR·worker·retry, Node/Next/Playwright/실제 Chromium 실행파일을 fingerprint로 묶는다. 빌드 파일집합과 각 SHA, reporter·raw/영상/trace도 고정한다. 빌드는 관련 입력이 같은 경우 한 번만 만들고 확인된 파일만 복사한다. 같은 BUILD_ID와 전체 case fingerprint가 같은 원래 실제 PASS receipt만 재사용한다. 원 receipt chain을 검증하므로 여러 번 이어해도 성공 사례를 다시 실행할 필요가 없다. 원 report가 일부 실패여도 정상 종료·guard·동결·개별 PASS가 유효한 다른 항목은 보존한다.

현재 구현은 보수적으로 동일 불변 빌드의 PASS만 재사용한다. 제품 변경/의존성 불명/테스트·도구 수정은 관련 증거를 무효화하며 **이 때문에 전체200을 다시 실행하지 않는다.** 교차 빌드 native 재사용은 구현하지 않았다. 동시 변경을 포괄적인 git-state 동결 실패로 취급하지 않고 검사하는 snapshot만 동결한다. 이후 새 변경의 출시에는 별도 영향 검증이 필요하다.

각 attempt는 새 경로에 저장한다. `scopeSatisfied`는 선택 항목만의 결과이며 `fullCertification:false`, `normal36:UNVERIFIED`를 유지한다. 재시도/skip/누락/expected-failure/불완전 reporter는 PASS가 아니다. 새 report는 원본을 수정하지 않으며 결과 SHA를 별도 ledger에 고정한다. 이 무결성 검사는 서명·검수자 신원 인증·자동 출시 승인이 아니다.

### 큰 성공 trace의 중복 수집 방지

2026-10-23 남은 QA 실측에서 ZIP이44.61GB였다. 전역 `retain-on-failure`를14개 긴 검사 파일의 `trace:on`이 덮어쓰고 있었다. 이제 scoped runner만 `VIC_QA_EVIDENCE_MODE=scoped-retain-failures-v1`을 명시해 공통 helper로 성공 trace를 폐기하고 실패 trace를 보존한다. 정상속도 영상과 별도 관측 JSON/판정은 그대로 남긴다. 수동·전체 검사의 기존 trace 저장과 명시된 capture OFF는 유지하며, 알 수 없는 mode는 기존 on으로 보수적으로 돌아간다. 부모 환경의 mode를 full runner로 전달하지 않는다.

helper·검사·scoped source 변경은 기존 fingerprint 입력이므로 변경된 캡처 조건에서 과거 case PASS를 재사용하지 않는다. 제품 입력이 같으면 빌드 바이트는 별도 검증 후 재사용한다. 실제 작은 PASS/의도적 FAIL/수동 PASS/OFF 표본의 산출물로 보존 정책을 확인했고14개 검사 본문·영상·판정 및121개 등록은 동일했다. 이는 생활 AI 관측이 아니다. 기존 ZIP/영상/원실패를 삭제하거나 과거 report를 다시 쓰지 않는다.

## QA 저장공간 관리

2026-10-23 사용자 승인으로 일일 점검 뒤 **원경로 유지 무손실 압축**을 수행한다. 상세 계약은 [저장공간·발견 표시 계획](../../docs/agent/plans/PLAN-20261023-qa-storage-and-unread-hover.md)에 있다. 과거 별도 retention의 삭제·하드링크 정책을 이 승인으로 재실행하지 않는다. ZIP으로 옮기고 원본을 지우거나 영상 화질을 낮추지 않는다.

`qa-storage.mjs`는 기본적으로 계획만 생성한다. 명시한 한 프로젝트의 `.scratch-pw`/`.scratchNN`에서 최소24시간 지난 압축 가능한 파일을 선별하고, `--apply --plan <plan.json> --plan-sha <SHA256>`로 그 계획만 적용한다. Windows NTFS의 `compact.exe /EXE:LZX`를 파일별로 사용하며 전후 SHA256·원경로·참조 파일을 검사한다. 하드링크, junction/symlink, 원본 자산, 비공개 설정, 진행 중인 검사·빌드·활성 state는 제외한다. 적용은 기존 PASS·관측일·정상속도 검수 상태를 바꾸지 않는다.

```powershell
node scripts/site-daily/qa-storage.mjs --root <확인한 프로젝트> --state <현재 primary state.json> --reference <보존할 원영수증> --minutes 3 --max-bytes 2147483648 --max-files 1000
node scripts/site-daily/qa-storage.mjs --root <같은 프로젝트> --state <같은 state.json> --apply --plan <출력 plan.json> --plan-sha <출력 SHA256> --minutes 3 --max-bytes 2147483648 --max-files 1000
```

일일 기본은3분·2GiB·1000파일이며 원본을 전부 다시 복사하지 않는다. 현재 state의 작업·native·build가 실제 종료한 뒤 실행한다. 프로젝트별 작은 cursor/미완료 목록과 `.scratch-pw/site-daily/qa-storage-schedule.json`의 명시 루트 순환을 사용한다. 매일 모든 QA JSON/영상 내용을 다시 읽지 않으며, 예산 초과·잠김·작업 중인 항목은 다음 실행으로 이월한다. 전체 저장공간 집계는 주간 또는 용량 급증 때 한정한다.

결과에는 경로별 논리 크기, 처리한 단일 링크 파일의 실제 할당량 전후 차이, 처리·생략·실패·이월을 기록한다. 기존 하드링크 때문에 경로별 합산을 물리적 고유 점유량으로 표현하지 않는다. ZIP·영상·이미지는 이미 압축되어 추가 절감이 작을 수 있으며, 절감률을 미리 보장하지 않는다. 원 report/receipt와 실패 증거를 보존하고 과거부터 없던 참조는 새로운 압축 회귀와 구분한다. 상태 변화 없는 반복 결과는 조용히 유지하며 큰 용량 증가·무결성 오류·의미 있는 절감·사용자 판단이 필요한 내용만 알린다.

2026-10-23 추가 승인으로 [캐시 회수 계획](../../docs/agent/plans/PLAN-20261023-qa-reclaim.md)의 **종료된 QA snapshot의 검증에서 제외된 재생성용 `.next/cache`만** 삭제할 수 있다. 위의 삭제 금지 제한은 이 범위에서만 대체된다. 전체 snapshot, runtime 빌드, `.next/types`, 원본 영상·trace·실패, 소스·자산과 현재 작업 checkout의 빌드는 보존한다. 크기·이름·날짜가 비슷한 ZIP을 중복으로 취급하지 않는다.

`qa-reclaim.mjs`는 기본적으로 계획만 생성한다. 정확한 `result/build/source-freeze` 바인딩, 단일 링크·안전 경로·파일 SHA와 실제 할당량, 종료 state/프로세스와 문서 참조를 확인한다. 해당 root 및 primary의 reports/plans/state/history를 제한된 크기로 자동 보호하며 추가 `--reference`도 합친다. 직접/상대 링크, 보호 파일집합·해시·활성 상태가 달라지면 적용을 중단한다. 세부 native 작업 영수증과 삭제 전후 참조/제어 해시를 남긴다. 원본 증거를 다시 복사해 용량을 늘리지 않는다.

```powershell
node scripts/site-daily/qa-reclaim.mjs --root <확인한 프로젝트> --state <현재 primary state.json> --minutes 3 --max-bytes 2147483648 --max-files 1000
node scripts/site-daily/qa-reclaim.mjs --root <같은 프로젝트> --state <같은 state.json> --minutes 3 --max-bytes 2147483648 --max-files 1000 --apply --plan <출력 plan.json> --plan-sha <출력 SHA256>
```

일일 저장공간 관리의 **계획+적용 합계3분·2GiB·1000파일** 안에서 캐시 회수를 우선하고 남은 예산에 기존 무손실 압축을 수행한다. 최소24시간 지난 종료 자료만 순환하며 시간/파일/바이트를 잔여 예산으로 전달한다. 선택 캐시보다 한도가 작거나 보호·무결성 증명이 부족하면 보류/이월한다. 새 QA 실행이나 docs/state 변경과 동시에 적용하지 않는다. 실제 유지 중인 case-history 원증거의 무결성 검사는 이미 수행한 같은 실행 결과를 재사용하고, 회수 후 영향을 받은 retained 증거를 확인한다. 매일 전체 원영상/300GB를 다시 해시하지 않는다. 주간 인벤토리에서 실제 절감·누락·보호된 고유 증거와 성장률을 비교한다.

[추가 정밀 분석](../../docs/agent/plans/PLAN-20261023-qa-deep-storage.md)에서 현재9개 VIC 작업폴더 전체는92.88GB, QA·빌드19곳은81.46GB의 고유 할당량으로 측정됐다. 검증되지 않은300GB를 현용량으로 반복하지 않는다. 이번35개 재생성 바이너리 정리와145개 무손실 압축으로 기존 집계 QA는72.10GB가 됐다. 생성한 분석 자료는 별도이며 기존 QA 절감에 합산하지 않는다. 종료 HF 실험은 로컬 원wheel·복원 지침을 보존한 offline-restore-required 상태다. 이를 일반적인 venv 삭제나 자동 추론·재설치 허가로 확대하지 않는다.

전체 용량 집계는 주간/급증 때 수행하되 평소에는 작은 변경·할당량 요약을 남긴다. 경로합·하드링크 고유 논리량·실제 할당량, 측정 범위/시각을 구분한다. 정밀 파일목록이 새 정리에 필요할 때만 만들고 원경로 NTFS 압축 후 별도 증가량을 기록한다. 같은 거대 인벤토리를 일일마다 복사하지 않는다. 기존 원영수증·링크가 붙은 자료를 나이만으로 지우지 않는다.

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
