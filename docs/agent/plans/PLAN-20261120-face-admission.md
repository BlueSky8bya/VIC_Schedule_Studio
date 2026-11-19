# 표정 합성의 최종 픽셀 허용 영역 복원

2026-11-20 사용자 visual-suite handoff의 직접 요청. 기준 main `cc29e2242e7bb26fa4bd3aa649361664673f21ea`이며 앞선 점프·수면 입 묶음은 Cloudflare 배포와 CI 성공을 확인했다. 새 지적은 a240f745 이후 일반 표정의 눈·입 union 복원 뒤 잉크 합성이 검증된 개별 patch 밖의 RGB를 바꾸는 회귀다. 수면 입 전용 경로만 마지막 복원을 하고 일반 표정 경로에는 그 단계가 빠져 있다. 사용자가 보고한 163 outside=7과 paintedSource 기반 TV/생활 관측 실패를 실제 현재 소스에서 다시 확인하고 고친다.

## 범위·보호

- 눈·입 잉크와 나선/눈물 복원을 마친 뒤, 최종 putImageData 직전에 검증된 allowed mask 밖의 RGB를 같은 원본으로 복원한다. 전체alpha는 원본과 정확히 같게 한다. 수면 입 전용 경로는 기존처럼 mouth=2만 허용한다.
- 검증된 mask 기하·compareExpressionPixels157의 zero-outside 판정·허용오차를 넓히지 않는다. 실제 일반 표정이 오프라인용 cream-ring을 빌려 입장하던 조건은 native 전용으로 좁힌다. 새 타이머/상태/서버/DTO/권한/DB/KST/의존성 변경 없이 같은 공통 painter를 쓴다. 승인 눈·수면 입·기본 원본·패킷과 점프 교정은 보존한다. 자율 잉크 수정이므로 G22 사람 행동 기록을 추가하지 않는다.
- `C:/Projects/VIC-worktrees/20261118-crown-nudge`의 사용자가 지정한 최신 fixture/163 spec와 필요한 QA helper 세 개를 읽기 전용 원본으로 고정해 임시 QA overlay로 사용한다. 다른 채팅의 미커밋 작업은 편집·커밋하지 않는다. 기존 expression comparator 함수 본문이 byte-identical임을 확인했다. provenance: `.scratch-pw/face-admission-20261120/qa-overlay.json`.

## 검증·출시

최신 fixture를 넣은 production build로 현재 main의163 실패와 전 그림을 먼저 보존한다. 수정 뒤163(두 검사)와TV comparison(viewer/studio/preview 세 검사), 관련 픽셀·얼굴 단위검사, typecheck/엄격lint/build/harness를 확인한다. API/쓰기/외부fetch를 거절하는 loopback fixture와 dummy 환경만 사용한다. 실제기기·로그인RLS·자연생활36의 전체 인증으로 확대하지 않는다. 독립 비작성자 코드 검수 뒤 원래 출시 작업의 후속 교정으로 커밋·푸시·Cloudflare 배포와 운영 소스 확인을 마친다. 원프로젝트 dirty main과 다른 worktree는 보존한다.

이전 점프·수면 보고는 `C:/Projects/context-hub/out/vic/20261120-contact-sleep-01a1f30e/`에 그대로 남긴다. 새 결과·실패·동일 화면 전후와 정확한 검증 범위는 하위 `runs/20261120-face-admission/`에 보존한다.

## 재현·허용 조건 일치

`before-runtime.json`은 최신 고정 fixture를 넣은 수정 전 production build에서163의1PASS/1FAIL을 재현했다. 첫 실패는 cell0 sour의7픽셀이며 실제 JSON 필드는 `cheek=7, outside=0`이었다. 사용자가 전달한 outside7 분류와 구분한다. 986개 painted 결과 중954개에 볼 보호 위반이 있었고 alpha는0이었다. 넓은 얼굴 상자와 실제 개별 patch의 엄격한 mask는 서로 다른 검사다.

첫 후보는 마지막 allowed/보호 픽셀 복원을 추가해 넓은163의986개 모두 alpha/cheek/outside0을 만들었다. 그러나 TV3건은 검출 후보/시간 제한으로 실패했다. 실패 로그·trace·원래 전후 및 `first-candidate-*` 결과를 유지했다. 동일 strict expression factory로 추가 검사해 첫 후보의852/986만 통과한 것을 확인했다. 이 중102건은 런타임이 오프라인용 주변 cream-ring을 사용해 strict가 거절한 primary patch를 허용한 문제였다. native/offline/수면 입 전용 복구는 유지하고 실제 일반 표정은 patch 자체 샘플과 기존 bounded fallback만 허용하도록 좁혔다. 마스크 기하·엄격 비교 함수는 확대하지 않았다.

추가 strict-rig의32건은 QA 입력에서416..431의 실제 mouth override를 누락한 것이었다. 검증 함수는 그대로 두고 painter·지정163 fixture와 같은 base+override 포즈를 입력하도록 고쳤다. 잘못된 입력의 실패 로그도 따로 남겼다. 최종 standalone strict 결과는509 eligible ×2표정 중 의도된 spiral16×2를 제외한986/986 PASS, patch 밖 RGB/보호 RGB/alpha 변화0이다. 이는 production-build 실물 검사와 별도 근거다. 단위 검증기도 실제 original source가 있도록 보강했고, 유효 모서리2개와 cream ring이 있는 cell144형 primary를 거절하고 검증된 fallback만 쓰는 회귀 검사를 추가했다. 관련 단위75건 통과.

## 인계 시점 · 최신 TV 재검사는 남음

최종 production build의163은2/2 PASS(`final-face-runtime.json`), 승인 수면 입90샘플은PNG바이트동일(`sleep-unchanged.json`)이다. 제품build/typecheck/lint도exit0이다. 두 번째 TV 실행은0/3 PASS이며 일반 생활 진단 후보로 실패했다(`final-tv-runtime.json`,698.12초). 직접 TV 비교·소파 복귀 attachment와 충분한 관측은 남겼다. 최신 helper 의존성 한 파일(`companion-curious-completion-144.ts`)을 빠뜨려 구 전역8행을 실제3/4행 패킷에 적용한 QA 입력 오류가 있었다. 지정한 원본 파일까지 SHA 고정해 총5개 overlay를 완성했고, 기존 raw 관측의 진단 재분석에서 no-visible-progress 후보가 사라짐을 확인했다. 이 재분석을 새 테스트 PASS로 바꾸지 않는다. 완전한 최신 의존성을 쓴 새 TV 실행이 필요하다.

viewer의 남은 awake-confined-home 후보는 비작성자 검토에서 새 제품 결함으로 확정되지 않았다. 105803–128718.7ms는 실제 TV 비교·집 안 이동, 128768.7–134085.2ms는 외출 준비,135735.1ms는 실제 밖으로 도약이었다. 지적136851.7ms에 인증된 그림/도약이 있고 출발지platform만 집바닥으로 유지됐으며,450ms 뒤 date75에 착지했다. 후보/실패를 보존하고 규칙 완화나 별도 행동 수정 없이 새 실행으로 확인한다. 제품 코드는 마지막 tightening 이후 그대로다. 아직 새 교정을 커밋·푸시·배포하지 않았고 기존cc29e224 배포는 성공 상태다.

## 완전한 QA 의존성으로 새 실행

`fresh-tv-runtime.json`은 455.37초, viewer/preview 2 PASS와 studio 1 FAIL이다. 세 표면 모두 생활 진단 후보0·충분한 관측·contextComplete이며 API/쓰기/외부 요청은 실행하지 않았다. studio는 C04 자체0프레임으로 첫 실제 TV 시청 assertion이 실패했다. 이는 통과로 바꾸지 않는다. studio 3614프레임 중3589개는 sourceClipMeasured이며, 수면519의25프레임은 unproved-expression-plane으로 미인증이다. 미인증을 픽셀 통과로 합산하지 않는다.

비작성자가 원기록을 검토해40초 때 집바닥이면 장난감 이동을 건너뛰고80초 뒤에도 새 장난감이 집에 남는 입력 누락을 확인했다. C01/실제 반납 없이3개가 끝까지 남아, 최근 실제 반납 뒤8초의 실내 TV 기회가 성립하지 않았다. 제품의 표정 admission이나 TV 동작 결함 근거는 아니다. 원검사·실패를 보존하고 별도 보강 검사는 실제 바깥 발판→새 장난감 native drag→동일 발판 착지·100px 이내→같은 물건의 실제 carry·반납을 먼저 증명하도록 준비했다. 그 뒤 원래 C04 두 시청·소파 복귀 assertion과 일반 진단을 그대로 적용한다. oracle suffix는 byte-identical이며 난수·시계·제품·원래 제한시간을 바꾸지 않는다. 원본 검사 재시도나 원실패의 승격과 구분한다.

새 독립 코드 검수는 제품2파일·단위2파일에서 지적0. 눈물/잉크/나선 뒤 final admission, 보호 RGB/전체alpha, 이중blend 없음, paint마다mask초기화, native 전용cream-ring과승인수면경로를 확인했다. 서버/DTO/권한/KST/G22 변경은 없다.

## 최종 로컬 결과와 출시 기록

별도 native-return 입력 보강 검사는405.43초,3/3 PASS·실패/skip/flaky0이다. 세 표면 모두 같은 toy-1의 실제 C01 beat7 집바닥 반납과 다음 관측의 제거를 확인했다. viewer35069→35119ms(serial3), studio42263.3→42313.2ms(serial5), preview38110.6→38160.6ms(serial3)이며 모두 decoded/sourceClipMeasured이다. 이어 C04 serial4/6/4에서 nature 채널의 집바닥 첫 시청→tori 채널→소파 두 번째 시청을 확인했고 중간 소파 방문0이다. 생활 진단 지적0, 충분한 관측/context 완료, API/쓰기/telemetry 실행0, 제공chunk와로컬SHA일치를 비작성자가 독립 확인했다. 원본 새 검사2/3 및 모든 이전 실패는 그대로다. 보강 검사도 studio3512중3487 source로 수면519의25프레임은 미인증이다.

원격main이cc29e224인 것을 다시 확인하고,5개 QA overlay가 고정SHA 그대로이며 backup이HEAD와 바이트 동일한 것을 검증한 뒤 우리 임시 복사만 원복했다. 지정 원본 worktree는 수정하지 않았다. 보강 spec·원본 spec·적용한5개 QA 소스·인계 파일은 Hub 증거에 보존하며 제품 커밋에 포함하지 않는다. 원복 후 관련6개 단위 파일82개가 통과했다. 실제기기·로그인RLS·자연생활36 및 수면source관측 한계는 [OPEN_CHECKS](../verification/OPEN_CHECKS.md#companion-face-admission--수면-source-plane-관측-한계)에 남긴다.

QA 원복 후 최종 `npm run typecheck`, 엄격 `npm run lint`, dummy fixture 환경의 `npm run build`, `npm run harness:verify` 모두 실제exit0이다. 문서 하네스 단위18개도 통과했고 Harness는455문서·8093byte startup brief를 검증했다. 제품2파일·관련단위2파일 외 그림 패킷·점프/수면 제어·TSX/CSS 변경은 없다. 새 완료 기록은 이 dated plan에만 남기고 임시 FACE 행은 CURRENT_STATE/ACTIVE_PLAN에서 제거했다.

제품 교정과 같은 화면 전후·전체 실패 증거는 `C:/Projects/context-hub/out/vic/20261120-contact-sleep-01a1f30e/runs/20261120-face-admission/`에 보존한다. 후속 커밋의 CI·정확한 Workers Builds 배포·100% Worker version·운영 확인 정본은 같은 Hub의 `release.json`과 `evidence/face-admission/`이다. 이전cc29 점프·수면 출시 증거도 유지한다.

## 달력 main 통합 뒤 검증

푸시 직전 달력5317f3c0이 올라와 정상 rebase한 제품 후보24389e2b에서 같은 production fixture를 다시 빌드했다. 표정 화면 PNG와986개 anchor JSON은 이전 최종본과 SHA 바이트 동일하며2개 얼굴 검사가 통과했다. 통합 첫5검사는3PASS/2FAIL이다. studio TV는 통과했고 viewer/preview는 C04 자체가 실행되지 않아 실패했다. 실제 장난감 반납은 있었지만 첫 D157-C의 마지막 stretch 도중 장난감 입력이 들어가 소개가 미완료였다. 반납 뒤 소개가 다시 우선되어8초의 TV 기회를 소비한 것을 비작성자가 독립 확인했다. 난수 재시도나 제품 결함으로 처리하지 않았다.

원래181초·제품·난수·시계·TV oracle suffix를 그대로 두고, 첫 소개의 decoded 마지막 stretch 종료와 후속 상태를 실제 관측한 뒤 장난감을 처음 투입하는 별도 viewer/preview 검사만 각1PASS로 확인했다. 최종 표면 근거는 통합 studio와 이 두 별도 검사이며 단일5PASS 실행으로 표기하지 않는다. 세 표면에서 실제 같은 toy-1 C01 집바닥 반납·제거 뒤 같은 C04의 nature→tori, 집바닥 첫 시청→소파 두 번째 시청, 중간 소파 방문0을 확인했다. 지적0·충분한 관측/context·API/쓰기/telemetry 실행0·제공chunk 일치도 독립 검수했다. source 미인증은 studio27·preview161프레임이며 [OPEN_CHECKS](../verification/OPEN_CHECKS.md#companion-face-admission--수면-source-plane-관측-한계)에 구분했다.

임시 QA를 복원한 뒤 얼굴·수면·달력 관련11개 단위113개 통과. QA overlay의 새 atlas행과 기존 단위 dummy8행이 달랐던 앞선1FAIL/112PASS도 `integration-unit.log`에 보존하며 원복 후 통과와 구분한다. 이후 원격f9ef99e7의 최초공개 종료 복귀6행도 정상 rebase로 보존했다. 해당 분기는 최초공개를 끈 일반 TV 관측의 실행 경로 밖이고 얼굴 소스는 그대로다. 최신 통합의 최종 build/typecheck/lint/harness·CI·실배포 정본은 Hub에 남긴다. 실제기기/RLS/자연생활36은 계속 미확인이다.
