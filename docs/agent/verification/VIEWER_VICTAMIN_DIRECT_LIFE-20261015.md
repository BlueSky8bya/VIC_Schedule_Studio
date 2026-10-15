# 빅타민 직접 교감·집·월 이동 검증

2026-10-15 KST. [PLAN-047](../plans/PLAN-20261015-047-victamin-direct-life-and-home.md). 사용자 최신 요청으로 꾹 누르는 집기와 돌봄 메뉴·두 과일 선택·설명 중심 집을 대체한다. 이전 결과는 현재 검사 통과로 재사용하지 않는다.

## 구현

- 월이 바뀔 때 저장 좌표를 버리던 runtime 초기화를 고쳤다. viewport 위치를 이어받고 달력의 약340ms 전환 동안 잠깐 들린 뒤 새 달의 가까운 안전 발판으로 연결한다. 옛 일정/anchor/action은 폐기하며 연속 이동은 새 generation이 소유한다. 실제 지지면이 없는 위치를 허공 발판으로 만들지 않으므로 정확히 같은 픽셀을 보장하지 않는다. 집 주민은 월이 바뀌어도 쿠션을 우선한다.
- 일정/날짜에서 스크롤에 따라 실제 anchor를 추종하고, 별도 `vc-reaction` 채널로 들림/눌림 spring을 합친다. 논리 좌표·달력 레이아웃·박자와 분리한다. 최대14px/.1 squash,600–900ms 유한 tail 후 exact0. 집·집기·비행·동작 줄이기/gfxOFF에서는 반응을 지운다. parked는 실제 이벤트 뒤만 유한 추적하고 다시 JS0으로 돌아간다.
- 집 주민은 실제 쿠션에 밀착한다. 쿠션이 clipped/offscreen이어도 다른 일정/바닥으로 옮기지 않고 보이지 않는 프레임만 숨긴다. 집이 실제 사라지면 안전 지지면으로 돌아간다.
- 6px 초과 이동부터 즉시 drag, 제자리 누름은 pet, 취소/다중 포인터/캡처 소실은 안전 해제. 키보드 Enter/Space/방향키/P/N과 더블클릭 후 위치 선택 대안은 hidden 접근성 설명으로 남겼다. 화면의 장문 사용법·진행 링은 제거했다.
- 집은186px의 하나의 재질, 무문자 쿠션·출구·쓰레기통으로 정리했다. 공용 패널/compact가 같은 컴포넌트·폭·모션/재질 토큰을 쓰며 접근성 이름/44px targets/친밀도 meter는 유지한다.
- 13종 과일을 code-native SVG로 만들고 직전 추첨 과일을 제외해 랜덤 배출한다. 캐릭터 raster 원화/atlas는 재생성·변경하지 않는다. 먹이는 입 앞으로 올라가 기울고 줄어들며 몸이 작게 오물거린다. 논리 먹이 좌표와 presentation은 분리하고 재집기 시 식사를 중단한다. 쓰레기통에320ms hover하면 뚜껑·진행 반응 뒤180ms 들어가며, 선택 후 클릭/키보드 Delete 대안과 실제 달력 클릭 소비를 보존한다.
- 실제 입력으로 발견한 공통 버튼 효과 충돌도 수정했다. 먹이의 world transform은 transition 없이 즉시 갱신하고 출현 scale은 내부 그림에만 적용한다. 먹이 버튼의 선택 상태 재탭은 놓기로 바꿨다. 쿠션 outer의 공통 press scale을 취소하고 속천만 눌러 실제 landing anchor를 보존한다. 이벤트 추적의 마지막 spring paint도 안전 발판0 숨김 규칙을 지킨다.

## 근거

[Apple Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/)의 즉각 반응·직접 조작·중단 가능성과 [Animate with springs](https://developer.apple.com/videos/play/wwdc2023/10158/)의 위치/속도 연속성, [HIG motion](https://developer.apple.com/design/human-interface-guidelines/motion)·[buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)·[materials](https://developer.apple.com/design/human-interface-guidelines/materials)를 참고했다. [W3C Pointer Events](https://www.w3.org/TR/pointerevents3/)의 capture/cancel·클릭/키보드 구분을 적용했다. 구체6px/340/320/180/900ms·진폭과 시각 디자인은 프로젝트 판단이며 연구가 입증한 최적값이라고 주장하지 않는다.

## 검증 상태

최종 source typecheck·lint·production fixture build 통과. `npm run test -- viewer-companion agent-memory rule-migration`: companion161 + 문서/harness43 =204개 통과. `npm run harness:verify`는 기존 두 실패 그대로: active rule IDs inventory와 RULE_MIGRATION live mapping 불일치. 전체 harness PASS로 표시하지 않는다.

| 검사 | 결과·범위 |
|---|---|
| 집9 + 기본9 | 최종 쿠션 수정 후18개 통과. native press에서 실제 쿠션 top/폭/높이 변화0px, 속천만 반응. PC/390 직접 객체·44px target·반응형 같은 개체·touch/다중 포인터 검사. |
| 직접 동작9 + 기존 scroll4 | 고유13개 통과. 전체12개 통과 후 모바일 준비 조건을 정정한1개 별도 통과. PC 월 이동·연속 변경·도중 resize의 실제 위치/접지, 집 스크롤·clipping·월 이동, 양방향 body 반응, 즉시 drag/실제 capture 손실, parked 반응 종료 뒤 Range/DOM write0. |
| 돌봄8 + 직접 먹이6 | 14개 통과. PC/390 trusted touch, cat/dog, 연속3 배출·선택 재탭·한 개 폐기·식사/입 위치·pointer/keyboard 재집기·취소/blur·달력 클릭0·상태 정산. 과일13 종류의 먹기 허용은 별도 unit13으로 검사했다. |
| 하트·중단·절전·존재·설정 | 고유27개 통과: 첫 실행25 통과/2실패 후 원인 수정, 중단4+절전6 전체10 재통과. 실제 food capture/좌표와 안전 발판0의 모든 수면 frame 숨김 단언 유지. |
| 기존 motion4 | 마지막 빌드에서4개 통과. 양방향 이동/방향·제어부 반전 없음, full/lite의 위치와 그림 갱신 분리·도착 감속, 하트 geometry 갱신 중 행동 유지. |
| 실제 anonymous `/` | 1920 PC/390 touch 모두 통과. 기본OFF atlas 요청0, 즉시 drag/tap/먹기/쿠션/반응형 동일 개체/설정OFF, export 내부 요소0·pageerror0. 과거2025-09, 기존 초기 POST1/화면은 차단·전송0. |

렌더는 실제 PC/390 집과 식사 화면,13과일 SVG gallery를 열어 확인했다. 독립 검토는 집/먹이/런타임을 교차 검토하고 근거가 있는 좌표·초점·capture·빈 기하 결함을 수정한 뒤 관련 단언을 재실행했다. 최종 쿠션 CSS는 기능별 테스트 실행 이후 추가됐으며, 영향받은 집 검사와 motion/실제 운영 확인에서 별도로 검증한다.

모바일 fixture의 인접7월은 normal/small 모두 현재 화면에 안전 span0이었다. 그 사례는 강제로 보이게 하지 않고 숨김→실제6월 복귀→같은 개체/가까운 좌표·실제 접지 회복을 검증했다. 모바일 visible→visible 월 이동 자체는 이 fixture로 검증하지 못했다. 좁은 화면에 실제 안전 지지면이 없으면 빅타민을 숨기며 가짜 발판은 만들지 않는다.

브라우저 회귀는 위 고유76개 통과이며 하나의 전체 실행으로 표시하지 않는다. 이후 쿠션 CSS 수정의 영향은 마지막 집18/native press·motion4에서 재검사했다.

## 비용·배포

다른 검사 브라우저를 모두 닫은 뒤 `node scripts/measure-viewer-companion.mjs`로 기존 production fixture를 측정했다. 각 상태3회×5초, 실행 순서를 회전했다. AMD Ryzen5 7500F/Windows/Chromium148 headless의 한 로컬 실험이다. 여기서 awake는 roam/jump를 끈 살아 있는 대기이며 화면 전체 탐험·식사·드래그·실제 OBS 부하를 대표하지 않는다. 수치는 companion만의 CPU 점유율이 아닌 페이지 renderer task 시간/경과시간이다.

| 상태 | renderer task 중앙값 | script ms/s | layout ms/s |
|---|---:|---:|---:|
| OFF |0.221%|0.997|0|
| 깨어 있는 대기 |1.528%|3.952|0|
| visible blur 뒤 parked |0.368%|1.126|0|

9표본 모두 POST0/layout0. parked의 자율 companion timer/brain/Range/DOM write0은 별도 상호작용 검사로 확인했으며 CSS 호흡/꿈과 페이지의 기존 작업이 완전히 무비용이라는 뜻은 아니다. 원자료는 ignored `.scratch-pw/companion-direct-metrics.json`에 둔다.

배포 확인 진행 중. 실제 OBS/GPU·OS focus·Safari·스크린리더 장비는 별도 미검증이다. 이벤트로 만든 blur 검사는 실제 운영체제의 창 전환/브라우저 throttling을 증명하지 않는다.

범위: public viewer/anonymous/studio viewer preview 공용 client feature. 서버 공개 DTO/권한/unlock/DB/KST/1840 표면 변경0, 외부 추론/모델/DB polling0. fixture 또는 과거 월·모든 POST 차단, 실제 DB 시험 데이터0. 기존 harness rule inventory/migration mapping2실패를 이번 기능 결과로 덮지 않는다.
