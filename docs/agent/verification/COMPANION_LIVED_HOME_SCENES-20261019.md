#121 — 집·성격·연결 장면

2026-10-19 KST. [계획](../plans/PLAN-20261019-121-companion-lived-in-home-and-scenes.md). 최신 요청이116의36장면 제안 전용 상태를 대체한다. 원래 제안은 날짜별 증거로 보존한다. 마지막 배포423692d1과121 작업 검증을 구분한다.

## 변경 계약

- 기존 소파 그림/좌석/앞면 유지. 큰 계절 창문, 책/라디오 선반, 장난감 상자, 떨어진 음식통/휴지통. 물체 전체 hover/focus/press, 감소/OFF 정지. 공통8성격·자동 잠자기·보이는 동안 활동 제어.
- 실제4장난감만 기존 시계에서 움직인다. 사용자 잡기/음식/귀가 우선, 실제 줍기/반납 ACK, 최대30초18단계, 숨김/휴면 시 capture와 물리 시간 정지. 음식과 발견 자료에 복제하지 않는다.
- 날짜·빈 패널·업도움/기간띠의 실제 발판/DOM 상대좌표. 변형/스크롤 중 read→compute→write, 유한 CSS/WAAPI lease. 같은 패널 재마운트만 재결속, 날짜 정체 바뀌면 이전 셀 결속 해제.
-36장면:1–4 실제 만남/시간대/귀가 경험;5–6 못 끝낸 공연/숨기;7–10 실제 안전착지/안심/자리/응답받는 인사;11–15 실제 음식 선택/계열/남겨두기/최애 변경/사고 뒤 재섭취;16–20 정돈/들킨 음식 장난/서로 다른 음식의 공동 청소/중단한 청소/실제 흩어진 음식 수습;21–24 실제 들은 음악과 검증된 악보의3음 경계·다음 응답·같은 곡 복귀·마침;25–28 탐정/선호 소품/주머니/프로펠러;29–30 실제 발견된 추억 회상/첫 경험;31–36 실제 달·날씨·빈 달·공연 복귀·레이아웃·첫맛과 파티 모자 연결. 한 장면씩, 대기열8·25초·18단계, 삭제/안전 실패/직접 입력 취소. 음식 효과는 같은 실제 ID의 성공 ACK 후 진행.
- 로컬 분 단위 만남·시간대24칸과 일자 중복 방지, 분위기3/자리3, 소유27소품·음식180 allowlist, 중단한 일1개.8K문자 입력 상한/명시 정규화/초기화. 부재 중 통계 악화·백그라운드 실행·서버/모델 요청 없음. 원문 일정/사람/곡명 저장 없음.

## 독립 검수와 실패 기록

독립 소스 검수에서 장난감 음식 선점, 마스터OFF 후 장난감 입력, quiet blur 장난감 시간, 오래된 실패의 가짜 회복, 연주 경계 유실, 쓰담 전 인사 취소, 집 거주 월 신호 누락을 발견했다. 이를 실제 소유권/입력/경계에 연결했다. 추가 hover 쓰담·native capture도 같은 경로에 합쳤다. 물리 작성자의 자체 점검과 독립 검수를 별도로 기록한다.

첫 전체 단위:267파일2893통과/1실패. 오래된111 테스트는35%에 휴식을 기대해 최신22% 임계와 충돌했다. 실제20% 피로 fixture로 원래 발판/제거 검사를 보존하고35% 비휴식 부정 검사를 추가했다. 두 번째267파일2895통과. 첫 린트/프로덕션 fixture 빌드 통과. 이후 수정에 대한 최종 gates는 아래 완료 때 기록한다.

실물 첫 실패는 보존: rail 초기 hydration 전에 존재하지 않는 compact launcher를 기다린 fixture race; 준비 후 검사에서 실제 feed43.1875px(1920), toys41.59375px 높이(2400) 발견; toy 최초 DOM 등록 전 paint로 위치0에서 잡힌 문제; 장식용 aria-hidden 앵커를 비가시로 판정해 음식이8초 이상 hidden; 선택적 layout 장면35가 새 커서 반응을 막은 문제. 제품 결함과 테스트 준비 문제를 구분해 고친다. 첫 native 실패도 보존했다. 강아지의 scene7은 무관한 최근 실패를 잘못 귀속한 원인으로, 현재 support/목표/지원대기 또는 실제 최근 사고만 회복으로 한정했다. 패널 검사의1030px는 실제 fixed monthbar로 올라온 첫 viewport 바닥이었으며, 바닥 아래에서 놓도록 입력을 정정했다. 제품의 첫충돌 기대를 약화하지 않았다.

## G-21 / G-22 / 최적화 경계

서버·DTO·역할·인증·DB·운영 데이터·의존성 변경 없음. 모든 표면이 한 구현을 쓴다. 직접 home-toys/toy-grab/drop/return/active-visible/8성격만 고정 의미 라벨·목록·키보드로 갱신하고 타임라인/적게 쓰인 기능을 함께 검증한다. 자율 장면/소품·음식/연주/발견/방문/학습 식별자는 분석에서 제외한다.

기존 단일 표시/결정 시계, 활성4Hz 단서 probe, 최대4경로 후보/2회 epoch 재시도,200발판/4장난감/8음식 상한, 변경 시만 React 갱신·동일 transform 쓰기 생략, 필요할 때 갤러리/옷장·기존3텍스처 디코더 유지. 새 상시 DOM 스캔/RAF/외부 호출/몸통 원본 추가 없음. 실제 숨김/휴면/재개·native screenshot/movie와 최종 수치는 별도 확인한다.

## 최종 검증

- 최신 전체:267파일2904검사 PASS(22.18초). typecheck/lint/세 번째 production fixture build PASS. 병렬 빌드/린트 때 무관한 art-catalog15초 한도1건이 초과했던 실패를 보존하고, 작업을 직렬화한 전체 재실행으로 확인했다. 테스트 시간 한도/assertion은 완화하지 않았다.
-36개 제어기 trigger→실제 효과 ACK→완료/취소 단위 경로와 reset/실제 pet 사회맥락 포함61검사 PASS. 독립 소스 역할/UX/로컬 저장/물리 경계 검수 지적 해소, 추가 확정 결함0. 모든36개를 브라우저에서 직접 발화시켰다는 주장은 하지 않는다.
- home8 native PASS(build2): compact 밝음/어두움·물체 전체 반응/키보드·실제 radio/book/sofa/toys/feed/trash6개 hit·1920/2400 rail·계절 창문·잡아 반납·sleepOFF/8성격. rail native 최소45px, 음식/휴지통 gap8.000/8.010px. 해당 home/source stylesheet는 build3와 동일. 실제 screenshot 직접 열람.
- physical5 native PASS(build3,20.1초): 음식 실제 중력/집 topology, 띠 첫충돌/scroll, 날짜칸 food fraction/FLIP/scroll, 빈 패널 food+pet/동일 floor/좌우 remount. 첫 바닥을 통과시키거나 오차 기대를 완화하지 않았다. trace/video 보존.
- personality6 native PASS: build3 강아지 실제 새 커서→social bow1.858초; build2 애교2.734초, 포만 실제 food carry→put9.4초(미섭취), 허기 실제 bite/nibble2.705초, 실제59.964초83 semantic 전환/571px 이동, sleepOFF 저에너지30.98초542표본/금지 셀·dreaming0.83은 새로운 행동 종류 수가 아니다. 포즈 프레임 자체를 새 행동으로 세지 않았다.
- learned invitation1 native PASS(build3): 실제 환경설정으로 활동 시작→초대→native Enter 쓰담→단계2 기쁜 마무리. 입력 때 진행 단계를 끝내 원래 초대를 재시작하지 않는다.
- Chromium 실제 새 탭 전환이 document.hidden을 주지 않아 hidden/native minimize1건 SKIP. 합성 visibility로 통과시키지 않았다. quiet/hidden 물리 시간과 ownership은 단위 검증과 독립 소스 검토 범위다.
- 도감/옷장/라디오/preview 회귀14 PASS(build3,3분): 밝음/어두움·viewer/studio/preview·부분/전체 소유/선물 대기·한 화면/유한 페이지/미확인 소유·첫 home 라디오 실제 음량/13녹음 디코드. 총34개 native/렌더 시나리오 PASS, actual-hidden1 SKIP. harness307문서 PASS. 사용자 보호 아트 SHA256 E980005102457E2A02AE318FF7665596E7170D0BFB34A328F64A6EC292C5990B 유지. 로컬 최종 gate 완료, 현재 승인된 commit/push/운영 확인으로 진행한다. .scratch-pw/companion-121의 units-quiet-final/typecheck-final/lint-verified-final/build-3/physical-build3-final/invitation-build3 로그와 visible-personality-final-summary가 로컬 근거이며 운영 데이터는 쓰지 않았다.

아직121 배포를 주장하지 않는다. 사용자 요청대로 실제 토리님 PC/OBS는 수행하지 않으며 실제 인증/RLS 검증으로 확대 해석하지 않는다.
