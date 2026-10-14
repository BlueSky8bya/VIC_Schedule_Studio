# 최초공개 함께 기다리기 — PLAN-034

2026-10-14 KST. 코드 검증은 아래 명시된 빌드 기준. 운영 배포와 실제 스피커/실계정 검증은 분리한다.

## 변경과 경계

토리님 기대 ON/OFF의 짧은 표정 반응, 빅타민 응원→착석, 로컬 응원봉, 선택형 합성 BGM. 기존 공유 무대/시계/고조 곡선/FLIP/서버 공개 경로 유지. native 1회 생성, WebP 4장 195,376 bytes(무대가 열릴 때만 사용), 원본·prompt·파생 SHA는 [제작 기록](../../../art-src/최초공개/응원단/제작기록.md). 별도 음원/라이브러리/마이그레이션/DB 폴링 추가 없음.

주변 actor·글·버튼은 T−18~10.5에 퇴장, 마지막 10초는 숫자와 상시 종료 동작만 남는다. 링 소멸·숫자 확대 10→2초 유지. 0초 뒤 DB 지연의 ‘공개 확인 중’은 기능 상태이므로 표시한다. 연쇄 공개의 먼저 공개된 글은 다음 초읽기 동안 잠시 물러났다가 읽기로 복귀한다.

음악: stage 음악 버튼으로만 시작, 기존 master/celebrate/volume 준수. 숨김·시각 변경·종료·10.5초에 정지하고 자동 재개 없음. AudioContext 차단이면 연주/재생중 표시/자동 재시도 없음. YouTube 녹음/멜로디를 사용하지 않은 코드 합성 패턴이다.

## 실제 실행

- typecheck, lint, production fixture build: PASS.
- 관련 단위/메모리 119: PASS(제품 76, 메모리/규칙 43).
- 이전 중간 빌드 기능/회귀 79: PASS. 이후 UI 겹침과 공개 article 관리 보완으로 새 빌드 전체 재검사 진행.
- 중간 40 재검사: 29 PASS/11 FAIL. 퇴장 article의 inert를 관측 신호로 읽어 공개 후 읽기를 누락하는 회귀를 발견했다. 실제 표시 중인 shared countdown의 pending UUID로 관측을 연결하고 return/hidden을 제외하도록 수정. 이 실패를 최종 PASS로 재사용하지 않는다.
- 최종 fresh-build 브라우저 **86 PASS**(3.5분). 신규 회사/오디오 12건 포함: PC/agenda 반응, 취소 표정, 음악 제스처·음소거·숨김·시각 변경·종료·브라우저 차단·10초 정지, 응원 재진입 초기화, 연쇄 읽기 복원, 재잠금 inert 복원, 터치 가로 화면 이름/44px/숫자 비중첩. 기존 제목/부제·동시 공개·읽기 유지·다시 보기·기능 OFF/동작 줄이기·1840 기하·미리보기/리허설 권한 회귀도 통과.
- 일반 `/` PC1440/agenda390 합성 smoke: 수정 전 공개 읽기 누락 FAIL; 수정 후 PASS. 각 환경 public tag 2개, 차단 POST 1건/전송 0건/page error 0건. 무대 진입·개별 응원·음악 제스처·숨김 후 재클릭 요구·숫자 집중·공개 후 수동 종료 검증. 실제 테스트 일정 생성 없음.
- 시각: 실제 PC/agenda 대기·표정 두 가지·착석·고요 캡처를 열람. 하단 actor/음악 컨트롤 겹침을 발견해 위쪽 여백으로 이동. 의도된 baseline 3장 변경(초대 PC/agenda, fluid agenda), PC fluid는 그대로. 최종 suite의 baseline 비교 PASS.
- G-21 독립 코드 검토: 숨김/재예약 음악 중단, waiting 안내, gfx 광채, 연쇄/재잠금 inert 복원, wave 초기화 지적을 반영. 중앙 countdown 관측 수정까지 재검토, 남은 확정 release blocker 없음. 검토자는 테스트를 직접 실행하지 않음.
- 전역 `harness:verify`: 기존 RULE_MIGRATION active IDs/inventory 불일치 2건 FAIL. 이 작업은 규칙 ID를 신설/삭제하지 않음. 관련 메모리 단위 43건 통과와 전역 harness 실패를 구별한다.

## 검증 범위의 한계

브라우저 trace는 note scheduling/중단/설정/상태를 검증한다. 물리 스피커 음량·음색, Safari/iOS 장치별 interruption/자동재생, 실제 스크린리더·햅틱·광도 분석·주관적 재미는 미확인. 생성자는 native 전체와 UI 축소 결과를 관찰했으며 사용자 시각 승인/독립 전문 동일인 검수/정밀 비율 인증을 주장하지 않는다. 실제 로그인 studio preview/RLS/provider/다지역 nano 비용 부하/전체 저장소 테스트는 별도 기존 공백 유지.

## 배포

아직 이 기록 기준 배포 미확인. 승인된 main push 후 Vercel 성공, 실제 build SHA, 일반 공개 페이지 PC/agenda 합성 smoke와 runtime 자산 해시를 확인한다.
