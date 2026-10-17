# 빅타민 습관 설명·빠른 놓기 복구

Status: Local implementation/independent review complete; owner-authorized combined085/086 deployment verification pending.

소유자 요청: 설정의 배운 습관 설명을 잘 보이게 정리하고 ‘손길’을 쓰다듬기 등 구체적인 말로 바꾼다. 매우 빠른 drag/release 뒤 착지하지 못하고 스크롤 중 깜빡이는 현상을 재현·수정한다.

- 동일 설정/renderer를 사용하는 시청자·편집실·미리보기에 함께 적용한다. PC 전용 빅타민, 기존 학습/초기화·저장 취향·활동 기록을 보존한다.
- native pointer 입력·마지막 release 좌표·관성/표시 제한·실제 발판 착지·scroll 추종의 순서를 조사한다. 마지막 좌표를 잃거나 지원 없는 위치에 고정하지 않고 기존 물리·안전 발판 경로를 재사용한다. 새 상시 geometry scan/loop/서버 요청은 추가하지 않는다.
- 공개 DTO/역할/언락·KST·1840 포스터 기하·음식/소파·숨기/최초공개 소유권을 변경하지 않는다. 운영 데이터/계정/플랜에 테스트 쓰기 없음.
- 동시085 귀가 작업과 사용자 아트를 보호하기 위해99ee2a76 기반 별도 작업트리에서 검증한다. 반영 때 겹치는 변경은 diff를 대조하고 보존한다. 최초086 요청에는 배포가 없었으며, 이후 소유자의 ‘설명 어미·좌우 균형을 수정해서 배포’ 요청이 기존 미배포 조항을 대체한다.

후속 범위: 반복되는 문장 어미와 긴 설명 행을 짧고 자연스러운 습관 표현·동일 폭 구성으로 정리한다. 학습 임계값/저장/reset은 유지한다. light/dark·시청자/편집실의 실제 렌더와 주변 설정 조작, 통합 이동 회귀를 확인하고 명시 파일만 커밋/푸시한다. 운영 전체 SHA·배포 상태·원격 quality와 실제 설정창을 확인한 후 배포 완료를 보고한다. 요금제/운영 데이터/사용자 아트는 변경하지 않는다.

회귀 후속: 통합 화면 검사에서 compact 집을 연 직후 실측보다 빠른 귀가 클릭이 유실되는 경쟁 상태를 재현했다. 실제 열린 같은 쿠션의 명령만 기존 측정 완료까지 한 번 보관하고 새 입력/집 닫힘/창 전환에 취소한다. 명시 완료 전달만 동일 기하에서도 한 번 허용하며 일반 추종의 중복 억제/120ms queue는 유지한다. 제한 시간 증설·통과 재시도로 실패를 숨기지 않는다.

검증: 기존 실패를 먼저 기록하고 빠른 한 번 이동/즉시 release·화면 가장자리·연속 반대 방향·scroll 뒤 표시/실제 착지의 회귀를 양쪽 production fixture에서 검사한다. 설정 설명은 light/dark 및 학습ON/OFF/빈 습관/여러 습관을 스냅샷·실제 reset으로 확인한다. 관련 단위 검사·전체 unit·build/typecheck/lint·docs harness, 독립 diff 검토를 수행한다. 모든 기기/OBS 실방송을 검증했다고 확대하지 않는다.

결과: [검증 기록](../verification/COMPANION_HABITS_RELEASE-20261017.md). baseline native67frame 숨김·최종up650px오차를 확인하고 수정했다. 동시085를 보존한 통합 build `8FdhRmZTfwAuGpAy-fTvY`, unit1,932/1,932·rendered22/22·build/typecheck/lint PASS. 최초 하네스 실패/격리 결과와 통합 결과를 구분한다. 실제 안전 바닥이 전혀 없는 geometry의 기존 숨김 게이트는 유지한다.

최종 후속: build `FjBCgLBfH0mm62aMkRKPn`, 전체 unit1,933/1,933·rendered33/33·문제 native 조작 별도5/5·build/typecheck/lint PASS. 재시도/skip/flaky0. crop4장/전체설정창2장 독립 렌더 검수와 통합 코드 리뷰 차단0. 최초32/33·별도재현2/3 실패 증거를 보존하고 실제 경쟁 상태를 수정했다. 운영 결과는 배포 후 별도로 확인한다.
