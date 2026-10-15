# 빅타민 연속 동작·스크롤·작은 집 검증

2026-10-15 KST. [PLAN-046](../plans/PLAN-20261015-046-victamin-fluid-life-and-compact-home.md). 현재 사용자 요청으로 PLAN-045의16키포즈·8Hz 정지 표현과 스크롤 교정 방식을 대체한다. 기능 기본OFF, 사람 하트 우선·로컬 데이터, 행동 완료 후 비활성 수면은 보존한다.

## 원인과 변경

- 기존 geometry의120ms 재측정마다1px 위치 변화도 행동 취소·650ms 착지 재시작으로 처리했다. 화면 스크롤과 발판 삭제를 혼동했다. 실제 support/target anchor최대2개 rect만 유한 이벤트 루프에서 추적해 origin/target/효과 좌표를 같이 옮기고 시작 시각을 유지한다. full Range 스캔은120ms coalesce, scrollend에 최종 검증. fixed floor와 실제 쿠션 rect를 구별한다. 스크롤 이동량은 보행 위상/방향 판단에서 뺀다.
- safe-span 재클리핑과 실제 anchor 이동을 분리한다. 비행 출발점이 viewport 밖으로 가도 연결된 anchor를 최대2개 보존해 carry한다. 동일 익명 anchor의 줄 ID 재사용은 y 근접성으로 검증하고, 삭제/실제 지지면 상실 때만 안전 착지한다. 중간 unsafe viewport 프레임은 그리지 않는다.
- 이동 full60/lite30, 반복 그림<=14Hz(단발 동작은 진행률 기반). 거리 기반 보행·도착 가감속·100ms scalar 관성 연결, 낮은 hop·기지개·몸 털기·방향 기억·짧은 탐험과 회복을 추가했다. 단순 랜덤 방향 전환/연속 질주를 피한다.
- 집은 작은 방116px와 짧은 상태 줄. 쿠션/사과/레몬 직접 조작, 나머지4조작은 하나의 키보드·터치 돌봄 메뉴로 접는다. 공용 패널/compact에서 같은 구현·상태·폭 토큰을 쓴다.

## 원화와 비용

단일 생성256셀과 보존16셀을272슬롯 atlas로 묶고18 logical clip에211개 서로 다른 그림을 선택했다(새207+보존4). 단발 동작은 실제 실행 시간/표시 cadence에 따라 일부 프레임을 건너뛴다. 모든 셀이 새 그림이거나 완벽한 loop라는 주장은 하지 않는다. native 수면/하단 문제는 기존 온전한 포즈로 대체하고 원본을 고치지 않았다. [제작·프롬프트·인코딩 기록](../../../art-src/빅타민/동행/작업회차/20261015-살아있는연속동작/제작기록.md).

runtime WebP1280×1360,987,198bytes, SHA256 `140a2485bd3afbdcd072c6456146ea9b7074d9c71bafe1fbd01241b38aed2ef9`. Q90/alpha100은 첫 무손실1,843,134bytes 대비46.44% 감소, decoded alpha 전픽셀 동일.200–500KB 목표는 미달이다. 비압축 RGBA 계산량은6,963,200bytes(실제 GPU 메모리 측정 아님). 기본OFF 때 lazy atlas 요청0, ON 뒤 동일한 한 atlas 경로를 쓴다. 원본256/16과 이전 public atlas는 보존했다.

## 근거와 적용 범위

[Apple WWDC23](https://developer.apple.com/videos/play/wwdc2023/10158/)의 위치·속도 연속성, [Reynolds](https://www.red3d.com/cwr/steer/gdc99/)의 도착 감속·방향 유지, [Valve AI 원자료](https://cdn.akamai.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)의 활동/휴식 리듬, [CSSOM View](https://drafts.csswg.org/cssom-view-1/#dom-element-getclientrects)의 실제 viewport rect 의미를 참고했다. 구체 가중치/시간은 제품 설계 판단이며 HCI 효과를 입증한 실험 결과가 아니다.

순수 시뮬레이션10seed×120초(동일3발판/normal·curious/장난OFF, 실제jump시간 근사): 이동시간30.27→48.09%, 이동행동 평균20→48.1회, 등장kind5→7. 실사용자 재미/렌더 성능 지표와 구별한다.

## 검증 상태

- 단위129 + 문서43(18 agent-memory/25 rule-migration), typecheck/lint/production fixture build PASS. `vitest`에 PowerShell wildcard문자열을 직접 넘긴 첫 시도는 파일0개로 실패했으며 `viewer-companion` filter로 수정해 실행했다. 그 첫 실패를 통과로 세지 않는다.
- scroll 실제 렌더4개 PASS: 78표본/96px native window scroll에서 문자 발 p95=1px/max2px, floor 걷기59.71px 이동·시계 동일·높이오차0px. parked는 p95≈0/max1px, 멈춘 뒤800ms Range0/actor write0. clipping 비행은 출발점이 안전 viewport 밖에 있는300ms/19표본 동안 시계 유지 후 실제 쿠션<2px 착지. 마지막 하네스는 충분한 clipping 관측을 위해 tail80→260ms로 늘렸고 관측 조건은>200ms로 강화했다.
- 집 PC·touch는 약206/214px, normal/large 같은 방 높이. 메뉴를 열어도 높이 불변, 키보드·44px 터치·포커스/월 이동 차단 확인. 실제 캡처를 열어 확인했다. motion 표본은 full60/lite30 위치 갱신과1초12회 그림 변경·13개 그림을 구별해 측정했다.
- 독립 제품 코드 검토에서 출발 anchor 보존·줄 y 재식별·viewport 보호·키보드 경계4개 지적을 수정했다. 재검토 잔여 차단0. 검토자 본인 작성 atlas/script와 전문 미술 평가는 검토 범위에서 제외했다.
- 최종 production fixture의 기존56개 rendered 회귀 PASS(4.7분), 별도 scroll4 PASS, 합계60개. POST0. 포함: 직접/키보드 집기와 좌상단 안전 경계, 먹이/친밀도, 사람 빨강·보라 첫 클릭/장난, 설정·modal·showcase·최초공개 중단, passive·재연결·동작 줄이기, PC/agenda/크기·확대·반응형 집.
- 동시 브라우저 작업 없이 CPU창5초×3회×3조건 측정 완료. headless 전체 renderer task 중앙값 OFF0.239%, 활성1.627%, parked0.403%; script1.092/4.069/1.164ms/s, layout 세 조건 모두0. `.scratch-pw/companion-fluid-metrics.json`. 활성 조건은 roam/jump OFF지만 자연스러운 제자리 포즈가 재생된다. PLAN-045의 정적인 키포즈보다 활성 비용이 늘었고 더 빠르다고 주장하지 않는다. 수면 시 자율 JS0은 별도 Range/actor-write·observer 해제 검사와 구별한다. 이 수치는 전체 PC CPU·실제 OBS/GPU 성능 보장이 아니다.
- 실제 anonymous `/` PC1920×1080/모바일390×844 PASS. 과거2025-09 쿠키, 실제 tap/hold-drag(터치는CDP touch), 먹이 배치/섭취/친밀도·쿠션 복귀·반응형 동일 creature·OFF 정리·defaultOFF atlas0 확인. POST는 기존 bootstrap1건씩 차단, 실제 전송0/오류0. Playwright routing으로 HTTP cache를 끈 전체 시나리오 atlas 요청은PC2/모바일1이었으므로 모든 재배치에서 네트워크 요청이 항상1회라고 주장하지 않는다. `.scratch-pw/companion-home-root-local.json`/화면 캡처.

- 운영 `592c801fef5d631b53e16651174be2ac569a43bc` push 후 Vercel success와 실제 API build SHA 동일 확인. `/companion/victamin-fluid.webp` HTTP200/987,198bytes/SHA 동일. 운영 anonymous `/` PC1920/모바일390에서 local과 같은 실제 tap·hold/touch drag·먹이·쿠션·resize 동일 creature·OFF 정리 재검증 PASS, defaultOFF atlas0, POST bootstrap1건씩 차단/실제전송0/오류0. 전체 시나리오 atlas 요청PC2/모바일1. `.scratch-pw/companion-fluid-production-deploy.json`, `companion-home-root-production.json`와 캡처.

요청 범위 구현·배포 완료. 수면/동작 원화의 제작 관찰, 더 큰 활성 비용, 아래 장비/기존 harness 제한을 결과와 구별한다. 실행하지 않은 검사를 PASS로 세지 않는다.

공개 DTO/서버 권한/unlock/KST/DB/1840 export 기하 변경0. UI검사는 stub fixture 또는 과거2025-09/10 달, 모든 POST 차단. 기존 실제 root의 bootstrap POST는 차단 수와 실제 전송0을 구별한다. 실제 OBS 송출·GPU·OS focus·Safari·스크린리더 장비는 별도 미검증이다. 기존 harness의 rule inventory/migration mapping2실패를 이번 기능 성공으로 덮지 않는다.
