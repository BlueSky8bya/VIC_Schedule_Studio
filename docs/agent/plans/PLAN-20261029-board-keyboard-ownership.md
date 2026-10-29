# P-20261029-04 — 그림판 키 입력 소유권

2026-10-29 텔레그램2286 비서 완전한 채택 줄에 따른 범위. P-05/06은 보류. 원제안·비작성 검수·실물 원실패/좁은 재현은 local pipeline `runs/20261029-review-r2/`에 보존한다. 원본을 수정 통과로 바꾸지 않는다.

## 문제와 구현 범위

owner/developer의 시청자 모드에서 그림판 날짜에 포커스를 두고 방향키를 누르면, 부모 PublicPoster의 window 키 리스너가 달을 넘기고 그림판의 날짜·포커스를 잃는다. 1440 밝음·1920 어두움 실제 fixture 재현. 단독 공개 달력에는 그림판 진입이 없으며 그 단축키는 유지한다.

StudioShell이 기존 broadcastOpen을 공용 PublicPoster의 선택적 client-only 키 차단 prop으로 전달한다. 차단 중에는 달력 월/오늘 단축키 리스너만 해제하고 닫으면 복구한다. 그림판 내부 키 리스너·도구·카드/획 이동·월 버튼·그림 데이터는 바꾸지 않는다. 새 날짜 방향키 탐색·월 선택창·버튼·저장소 없음.

공개 DTO/API/서버 로더·역할·owner_private·해금·Asia/Seoul 날짜 계산 변경 없음. G22: 기존 단축키의 입력 소유권만 교정한다. 새 행동/target/계측 없이 기존 그림판·월 버튼의 고정 label/target과 자동화 guard를 유지하고 개발자 활동 타임라인/최소 사용 통계 대상 계약은 보존한다.

## 검증과 출시

typecheck/lint/관련 unit/build, production fixture owner/developer×1440/1920 실제 키 입력, 단독 공개 달력 회귀. 날짜 포커스·월 유지, 도구와 카드 1px·Shift10px 이동, 그림판 월 버튼, 닫기 후 기존 달력 키 복귀를 확인한다. 기존 획은 포인터 이동이며 방향키 이동 기능은 없다. 새 획 방향키 기능을 추가하지 않고 펜/형광펜/지우개 실물 회귀로 기존 동작을 확인한다. 보드 쓰기는 메모리 fixture에만 하며 운영 DB/실제 auth/RLS/OBS 보증은 하지 않는다. 비작성 독립 검수 후 관련 파일만 commit·origin/main 반영하고 CI/provider/실제 공개 fullSHA를 대조한다. fullCertification=false; 생활36 미검증 유지.

현재 단계: 구현·실제 검증·비작성 독립 검수 완료, 관련 범위 출시 진행. P-05/06 보류 유지.

## 실제 검증 결과

- typecheck exit0, 전체 lint exit0와 최종 변경 테스트 lint exit0, 관련 unit44/44. 제품 빌드 `TA5FhKy-z1EYc3UIUjNxD` 1회 성공 후 같은 입력으로 재사용. 문서 harness442 통과·brief8048bytes. 이관 뒤 제품/테스트 입력이 검증 checkpoint467과 동일함을 대조했고 문서 변경에는 harness만 다시 실행한다.
- production fixture8/8: owner/developer×1440밝음/1920어두움의 날짜 포커스·좌우/T 입력 시 월 유지, 그림판 자체 월 버튼, 닫기 후 포커스·달력 키 복귀, 도구 키·카드1px/Shift10px 이동4건; 단독 공개 anonymous 달력 키 회귀2건; 기존 펜/형광펜/지우개 포인터 획 회귀2건. 실제 운영 DB 쓰기 없음.
- 비작성 독립 검수: 두 제품 파일·8건 receipt·대표 렌더 대조, No issues. G22 기존 고정 target/label·키보드/포인터·개발자 활동 타임라인과 최소 사용 통계 계약·자동화 guard 보존 확인. 새 수집/행동 추가 없음.
- 원관찰 실패와 첫 시도3실패/3미실행 보존. 같은 월 판정에서 `innerText`/`textContent` 관찰 표현만 교정했으며 제품 판정 기준을 낮추지 않았다. 실제 auth/RLS·OBS·실기기·모바일·생활36은 미검증, fullCertification=false.

절대 결과 경로: `C:/Users/im917/.codex/vic-pipeline/runs/20261029-adopted-board-keyboard/`. 원검사 `checks-summary.json`, 최종 실물 `native-summary.json`, 독립 검수 `independent-review.md`, 실제 완료 화면 `after-P-20261029-04.png`, 완료보고서 `report-1440.png`. 원제안의 변경 후 가상 그림과 실제 완료 화면은 별도 자료다. CI/provider/공개 fullSHA 출시 증거는 같은 경로의 `release-record.json`에 실제 확인 후 기록한다.

## 사장 확인 체크리스트

- P-20261029-04: 시청자 모드에서 그림판 날짜에 포커스를 두고 ←/→/T를 눌러도 선택 날짜·포커스와 배경 달력이 유지되는지 확인.
- P-20261029-04: 그림판 자체 월 버튼·도구 키·카드 방향키1px/Shift10px·기존 펜/형광펜/지우개가 그대로 작동하는지 확인.
- P-20261029-04: 그림판을 닫으면 포커스가 돌아오고 원래 달력의 ←/→/T 단축키가 다시 작동하는지 확인.

각 항목의 답은 확인/나중에/고침으로 받는다. 비서 원기록에 아직 없는 사장 답·메시지 번호를 만들어 넣지 않는다.
