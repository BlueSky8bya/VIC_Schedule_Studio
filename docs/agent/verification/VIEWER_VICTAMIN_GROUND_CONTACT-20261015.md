# 빅타민 바닥·잡힘 연속성·교감·먹이 추적·일정 숨바꼭질

2026-10-15 KST. [PLAN-057](../plans/PLAN-20261015-057-companion-ground-and-contact.md), 기준 `7a015c6e`, 제품 `f264537f8e4546b529825242a7989dedeaea9ac3` 배포/운영 확인 완료.

집 바닥이 음식32px 낙하 후보에서 빠져 있었다. 실제 바닥−6px의 안전한44px 조작 구간을 제공하고, 첫 충돌 뒤 같은 floor source로 붙여 기존 중력/접기/재배치 경로를 사용한다.200개 후보 예산에서도 집 바닥을 보존한다. 실제 업 도움/기간 띠 위와 요일 헤더 아래쪽의 안전한 빈 구간은 같은 DOM/Range/control 측정으로 보행 후보가 된다.92px 공간이 없는 상단 크롬에는 가짜 발판/강제 축소를 만들지 않는다.

일반 깨어남800ms 분기가 집기보다 앞서 실행되어 이전 발판을 떠난 캐릭터를 숨길 수 있었다. 이전 빌드에 명시적 fixture focus flag/blur·focus와 실제 경과 시간을 준 검사에서76rAF 중41개 hidden을 재현했다. headless 가상 창의 활성화만으로는 OS의 visible-unfocused 조건이 재현되지 않았으므로 실제 OS 검증으로 부르지 않는다. 직접 집기는 즉시 active로 전환하고 captured 위치는 기하 갱신/quiet 분기에 양도하지 않는다. 아직 decode 중인 HD 포즈 대신 기존 선명한 그림을 유지한다. 포인터 focus 링은 숨기되 문서의 키보드 입력은 표시를 복구한다.

기존 whole-body 범위 안에서 실제 움직임이 시작되면 각 방향92px의30%(27.6px)까지 쓰다듬기 손/커서를 유지한다. 바깥에서 시작하거나 정지한 채900ms를 넘기면 유지되지 않는다.2D 왕복은 첫 유효 축을 고정하고 보상4초 예산/조작 버튼 양보를 유지한다. 잡힌 몸은 실제 grip을 중심으로 세로로 늘어나며 수평으로 조금 좁아진다. 발버둥과 입력 관성은 기존 시계를 사용한다. 놓기100ms pose mixer와 origin 복귀를 같은 첫 nonheld presentation 시각에 맞췄다.

먹이는36px 근처에서만 섭취하지만 접근 경로는 멀리서도 탐색한다. 기존3점프 제한을 현재 안전한 그래프의12점프/200노드로 바꾸고180px씩 걷고 재검증한다. 먹이 ID 하나/예산32회/활성 시간4초 휴식을 유지하며 일시적으로 잡거나 가려진 먹이는 삭제로 취급하지 않는다. 숨긴 위치로 이동/자동 스크롤하지 않고 실제 안전한 구간이 다시 보이면 재탐색한다. 독립 검토에서 같은 실제 삭제를 goal/action 양쪽에서 두 번 감정에 반영하던 결함도 발견해 한 번만 기록하도록 고쳤다.

최신 사용자 사진이 PLAN-056의 길쭉한 자두를 대체한다. 통통한 붉은 윤곽·한쪽의 노랑/주황빛 면·얕은 골을 공유 SVG 음식 계열로 다시 그렸다.36px/256px 렌더를 직접 비교했다. 자두 SHA256 `122354ab1ec58276e0b2f9b24419c135a3fd32871742ab82e8212c9d55a7e1dc`, 다른12과일/라이선스·이전3버전 계보 보존. 사진 복사/래스터 생성/캐릭터 자산 변경0.

최신 숨바꼭질 요청은 실제 공개 일정 안으로 들어가 그 일정의 공유 상세창을 열면 발견하는 방식이다. 이후 요청에 따라 무기한 숨기 대신12~28초 활성 대기 뒤 스스로 나온다. 같은 현재 카드의 수동 착지점에서도 제자리 숨기는 허용하지만 수동 발판의 자율 경로 제한은 유지한다. 떡밥/실제 가림/삭제는 제외하고, 다른 창/숨김 탭은 대기 시계를 멈춘다. 숨은 동안 한 만료 timeout과 source 취소 감시만 유지하고 두뇌/프레임/생활 저장 루프는 멈춘다. 발견 시 상세창의 실제 글자/전체 조작 영역에서 떨어진 빈자리를92→44px로 찾아 쓰며 공간이 없으면 기존 외부 자리로 연결한다. 찾은 상태는 클릭/키보드 초점을 빼앗지 않는다. 독립 검토에서 상세창 소유자 변경 잔류·blur 휴식 전달·재등장 기하 중복 이동·취소 뒤 하트 감시 재개를 보완했다. 이 경로의 실제 렌더 검증은 아래 최종 결과로 갱신한다.

공유 viewer/anonymous/preview·기본OFF·92px HD·1840 포스터·공개 DTO/권한/언락·KST·서버/DB·생산 의존성 유지. 검사 POST 전부 차단, 실제 DB 시험 데이터0. 운영 smoke는 과거2025-09 읽기만 쓴다. 사용자 미술 기록26행·보류 파일은 보존한다.

| 검증 | 결과 |
|---|---|
| 관련 단위 | 숨바꼭질 포함32파일380/380 PASS, public DTO/rule migration 포함 |
| build·전체 lint·build 후 typecheck | 숨바꼭질 교차 검토 보완 포함 최종 모두 child exit0. 검증 중 제품19파일 hash 변경0 |
| 새 교감/집기 | 이전 범위 최종8/8 PASS.30% x/y118rAF 손실0, 실제 HD 요청350ms 지연 중 유지, min scaleY PC1.0278/native1.042·grip0, 포인터 링 없음/키보드 복구. controlled visible-focus PC92/native96rAF hidden/MO0. 실제 OS focus는 별도. PNG4 직접 열람 |
| 새 실제 바닥/생활 영역 | 이전 범위 최종3/3 PASS. PC23/native28rAF 약38px 낙하 후 실제 바닥 착지·접기/위치/compact 보존·버튼 겹침0. 실제 기간 띠1/헤더6 안전 구간과 경로 확인. 자동 방문 성공으로 과장하지 않음 |
| 새 먼 먹이 | 이전 범위 최종1/1 PASS. 실제440px 떨어진 음식으로 접근→같은 먹이 재집기 중1100ms 대기/무섭취·낙담0→같은 ID 재놓기 후180px 이상 접근/36px 안 도착·섭취/허기<.5. 실제 DOM·입력 사용, 포스터1840 유지 |
| 기존 상호작용 | 숨바꼭질 포함 최종53/53 한 회차 PASS. 헤더를 포함한 실제 텍스트/조작 보호 oracle로 보완. 모바일 음식 reflow의 최초1회 실패는 원인 확정/기저 결함으로 부르지 않으며3회 진단 통과 후 착지 종료 조건을 확인하도록 보완했다. compact 집이 처음 pet을 가리는 테스트 setup은 위쪽 실제 발판에 놓은 뒤 집을 열도록 수정했다 |
| 새 검사 최종 회귀 | 교감8+실제바닥/영역3+먼먹이1=12/12 한 회차 PASS. 위 수치는 해당 개별 회차 근거이며 최종 controlled-focus PC91/native94rAF hidden0 |
| 일정 숨바꼭질 | PC/native390 발견2+자동 등장1=3/3 PASS, 자동 등장은 실제 휠 스크롤을 추가한 강화본1/1도 PASS. 숨은 source−16px 이동 후 같은 발판 유지·착지 y오차0.000031/x0.000290px(<3 유지)·실제 글자/전체 버튼 비가림. 실제 카드 입력/동일 DOM/잘못된 창32초 보존/일치 발견/기존 귀환/정지 중1000ms mutation0/POST0.45초 유예·12~28초 대기·32초 다른 창 대기는 제어 시계·결정적 RNG로 검사했으며 실제 OS 배경 타이머 검사로 부르지 않음. PC·모바일 PNG 직접 열람 |
| 과거 달 실제 공개 경로 | 최종 PC/native390 각1회 PASS. 실제38px above-floor 낙하/compact·접기/8개 제한/왕복/관성·잡힘 min scaleY>1.027·POST전달0/오류0. 시계/난수/포커스 주입 없음. 최종 운영은 별도 |
| 운영 | GitHub/Vercel success 및 실제 API build SHA `f264537f` 일치. PC1920 DPR2/native390 각1회 PASS: min scaleY>1.027·16포즈·관성 종료0·실제38px 바닥 낙하·8개/9번째 보존·whole-body 교감·접기/compact·동일 DOM·예상치 못한 낙하0. 각 live GET1 stub/POST1 차단·전달0·오류0, 과거2025-09만 읽음. PNG2 직접 열람. 배포 자두 hash도 일치 |

기존 harness inventory2 실패는 같은 문구로 재현됐다. 이전 전체 단위9·구형 확장15는 이번 관련 검사로 덮어쓰지 않는다. 물리 OBS/기기·실제 로그인/RLS는 미검증이다. 복구는 기기 빅타민 OFF 또는 별도 revert 배포 후 재확인으로 가능하며 실행하지 않았다.

근거(ignored): `.scratch-pw/companion-057-{unit-hide-reviewed,build-hide-reviewed2,lint-release,type-release,harness-release,regression-hide,new-release,hide-final-all,hide-auto-scroll-native,public-production}.log`, 같은 prefix의 contact/physical/pursuit/hide JSON·영상/PNG, `companion-057-wake-controlled-baseline.{log,json}`, `plum-056/{before-057,final-057}.png`, `companion-057-release-hashes.json`, `companion-057-public-production.json`, `companion-057-production-deploy.json`.
