# 음식 낙하·종/성향/걸음·덤벙 놀이·야간 가독성

2026-10-16 KST. [PLAN-068](../plans/PLAN-20261016-068-companion-character-and-play.md). 구현·검증·운영 배포 확인 완료. 제품 `ceaefc3a28757b29b9f354ddd91d08591c1e00ca`. 보호된 기존 미술26줄과 보류 자산은 보존하며 DB/권한/공개 DTO/KST/1840 poster/모바일 빅타민 제외는 변경하지 않는다.

## 원인과 구현

- 음식은 아래 지원을 찾지 못하면 release 좌표/지원 없음으로 배치됐고, 지원 ID가 있는 경우만 gravity를 시작했다. 이제 실제 최초 lower support→기존 glyph/control 보호가 적용된 viewport food floor→화면 아래 document 바닥 순서로 유한 낙하한다. 후자의 음식도 보관하며 실제 지원이 없으면 식사 후보로 쓰지 않는다. 가시성은 최종 목표가 아니라 실제 낙하 presentation을 따른다. 중간에 잡았다가 움직임 없이 놓아도 낙하를 재개한다. 집 음식은 계속 실제 집바닥만 사용한다.
- 기존 종/성향 차이는 일부 utility 가산뿐이고 다단계 planner가 성향보다 먼저 실행됐다. 공유 `behavior-profile.ts`에서 종의 고도/사회접근/관찰·놀이, 성향의 동기/휴식, 걸음의 속도/보폭/도약/휴식/빠른 달리기 빈도를 독립 합성한다. 일반 선택·먹이 이동·다단계 planner가 같은 profile을 쓴다. 애교는 보라 하트 OFF여도 접근/기쁨으로 보이며, 잠꾸러기도 수면 OFF는 존중한다. 기본 빅타민 모드는 이동 가중치와 cartoon clumsiness를 강화하되 사용자의 기존 gait 선택은 보존한다.
- 새 finite `play`는 달리기 뒤 덤벙거림, 실제 옆/뒤 구르기, 어지럼·고개 털기, 미끄러짐·눈물, 눈치 보기, 놀이 자세/몸단장/짧은 pounce를 같은 renderer/mixer로 잇는다. 실제 안전 support 안의 작은 이동만 허용하고 사고는 최소 이동 burst+조건부 확률+20초 cooldown으로 제한한다. 짧은 클릭은 톡 치기이며 최근 사고 뒤엔 시무룩, 평소엔 놀라 울먹임이다. hover 왕복/Enter는 계속 쓰다듬기이고 한 번 drag/cancel한 포인터가 click 반응으로 바뀌지 않는다. 직접 집기·창/공연·숨김 탭 우선순위는 유지한다.
- 일정 장난은 공개 일반 카드만 허용된 local individual-rotate이다. 실제 일정/하트/저장/FLIP transform은 변경하지 않는다. 220ms 움직임→고정 각도→클릭 또는6500ms 뒤220ms 원복이며, 두 움직임만 기존 pet/food의 finite anchor follower를 깨운다. 카드 click의 원래 상세/편집 동작은 그대로 통과한다. 장면 중단은 대기 timeout/원복 animation도 회수한다. 가까운 음식 최대3개는 내부 그림만420ms 튀고 실제 위치/식사/바닥 소유권은 바뀌지 않는다.
- 야간 필터의 새 `PanelSection` 제목·인기도·미정은 기존 보정 selector에서 빠졌고 방제는 어두운 glass 위에 밝은 테마 갈색 리터럴을 유지했다. scope를 해당 필터/방제로 한정해 ink/accent/night-hover token을 연결하고 야간 inactive filter opacity만 .4→.72로 조정했다. 밝은 모드·semantic tag색·전역 filter는 그대로다.

## 행동과 아트 근거

2026-10-16 후속 소유자 지적: 전달36키포즈의1-based5행2열·5행4열·2행5열·4행2열에 두 귀가 분명하지 않다. 당시 패킹/단위/렌더 통과는 귀 형상 검수나 사용자 미술 승인이 아니며 이 결함을 걸러내지 못했다. 원본·생성 요청·기존 판정은 보존하고 [PLAN-069](../plans/PLAN-20261016-069-companion-ears-and-window-ownership.md)에서 지정 네 포즈의 귀/연결부만 별도 교정한다. 아래 ‘정확히 두 귀’는 요청한 설계 기준이며 모든 생성 칸의 충족 판정으로 읽지 않는다.

고양이의 높은 안전자리·짧은 사냥놀이·개체가 선택하는 접촉은 [AAFP/ISFM 환경 가이드](https://catvets.com/wp-content/uploads/2024/01/Environmental%20GuidelinesEViewFinal.pdf), 강아지의 냄새 탐색·사람과 놀이·개체차는 [RSPCA DogKind](https://www.rspca.org.uk/documents/1494939/0/Being%2B%23DogKind%2Breport%2B(PDF%2B1.20MB).pdf/e5bf9429-44fd-4f71-08e6-58eab6f1aabc?download=true&t=1564054690195&version=1.0)를 행동 모티브로 삼았다. [Apple의 유동적 인터페이스](https://developer.apple.com/videos/play/wwdc2018/803/)의 즉각 반응/중단·전환 원칙에 맞춰 기존 단일 clock과 pose mixer를 재사용한다. 이 근거가 가상 펫의 HCI 효과나 진짜 동물의 죄책감/눈물을 인증하지는 않는다. 후자는 소유자가 요청한 만화적 반응이다.

실제 원본 REF016/017의 무사지·두 귀·직사각 폼폼 구조를 열고 builtin imagegen1회로36개 키포즈를 생성했다. 새 회차는 `art-src/빅타민/동행/작업회차/20261016-덤벙놀이/`이며 실제 원문/cycle/계약/args/preflight/claim/native/생성자 관찰/초안 등록을 보존했다. 이미지 도구 결과를 사용자에게 표시했고 사용자 시각 승인·독립 전문 PASS는 주장하지 않는다. 명목6×6 경계를 넘는 몸은 실제 alpha 연결체36개로 온전히 추출해 aspect 고정 정규화했다. 실제 새 그림36개→12 action packet/192 hold slots이며192개 새 손그림이라고 하지 않는다. 기존19 HD packet은 변경0이다. 전 동작192px 물리/80px 논리·기존 lazy decode/LRU를 공유한다.

## 검증 기록과 한계

기존 생산 빌드의 야간 baseline은 인기도/미정2.63:1, 방제1.05:1을 재현했다. 새 unit은27개 종/성향/걸음 조합의 결정성·로컬 지원·설정 gate, 실제 식사/수동 발판 우선, bounded 사고/cooldown, finite pose/click 판별과 card recovery lifetime을 검사한다. 첫 전체 unit 실행 중 패킹 recipe가 아직 갱신 중이어서 provenance assertion1개 실패가 있었으며 source 동결 뒤 전부 다시 실행한다. 실제 코드 결함과 setup/동시 작성 문제는 섞어 PASS 처리하지 않는다.

실제 OBS 송출·GPU/encoder 품질·학습 모델/동물 인격의 검증이 아니다. 새로운 외부 모델·네트워크·DB writes는 없고 모든 상품 상호작용은 동일 local brain/renderer로 제한한다. 최종 type/lint/unit/build·실제 렌더/운영 결과는 아래에 남긴다.

첫 생산 fixture37개 추가 전36개는33통과/3실패였다(`vv2XG-xG6TAwpKYln1N6N`). 음식 viewer setup은160ms Ctrl+wheel이 실제220ms zoom cooldown에 걸려 목표200%에 도달하지 않은 준비 오류였고, settings는 상시 마운트된 숨김 Studio editor를 열린 창으로 센 oracle 오류였다. 실제 사용자에게도 영향을 주는 나머지 경계는 착지 중 짧은 click이 `supportedNow()`를 만족하지 못해 예전 affection으로 빠지는 것이었다. 이제 즉각 만화 반응을 시작하며 같은 유한 action 안에서 첫 실제 lower support까지650ms 중력 낙하를 마치고 연결한다. 이 비행은 집 주민/overlay/handoff/스크롤 carry/pause에도 명시해 공중에서 소파로 snap하지 않게 한다. 독립 검토의 카드 복귀 추종/중단과 이 비행 경계를 보완했다. Setup은 실제 허용 zoom과 실제 안정된 좌석을 준비하고, 별도 native midair click 회귀를 추가한다. 낙하/정렬/가시성 임계값을 완화하지 않는다. 첫 실패 raw/PNG는 보존한다.

최종 제품 빌드 `xivTKFE8Iv3WgBJPihdAz`는 typecheck/lint/build exit0, 관련42파일462unit 통과다. 이 빌드의37개 첫 실행은33통과/4실패였으며 새4개는 실제 단언 전 집/음식 준비 조건 문제였다. 집 명령은 sleep OFF이면 의도대로 실행되지 않는데 새 harness가 sleep:false를 넣었고, viewer의 늦게 마운트된 집 entrance/geometry 안정 전 입력도 구별해야 했다. 음식 준비에서는 viewport를 줄여 source tray가 화면 밖에 나간 상태를 요구한 오류와 기존 fixed monthbar가 floor를52px 위로 올리는 계약을 oracle이 반영하지 않은 오류를 분리했다. 관련6개 재검사는4통과/2준비·oracle실패였다. 제품 변경 없이 실제 BCR/허용 설정/고정 바닥 계약으로 준비·측정을 보완한 뒤 남은 범위를 재검증한다. 성공·실패 모두 원래 raw를 남기며 숫자를 완화하지 않는다.

동일 빌드에서 준비를 바로잡은 viewer play1개(9.9초)와 음식 양쪽2개(12.7초)가 최종 통과했다. 최종 대상37개는 각 시나리오의 통과를 확인했으나 한 배치37/37·retry0으로 표현하지 않는다. Native viewer click은73.6ms/거리0,236프레임에서 숨김/DOM 교체/POST/pageerror0, 실제 울먹임27→회복23 packet과 잡기 전환을 확인했다. 새 Studio midair case도 실제 drag/up→이동 중 native click→중력 지속→실제 seat 접촉→표정 종료가 통과했다. 음식 viewer/Studio는 각각24/25개 공중 프레임과 제자리 중간 catch 뒤 낙하 재개, 실제730/782px 안전 바닥 정착, 스크롤 뒤 document 위치<2px·정지 DOM 쓰기0을 확인했다. 태그/계절의 실제 접기 뒤 source가 보이는지와 fixed monthbar BCR까지 raw에 보존했다.

야간 익명/로그인/미리보기/Studio/agenda와 밝은 viewer6개 통과. 검사한 야간 텍스트 대비 최저5.3818:1(Studio9.0039:1)로4.5:1 기준을 만족했다. 기존 집 앞면6·소파3·프레임4·모바일 헤더4·모바일 제외8도 같은 빌드에서 통과했다. 개인정보/실DB 시험 생성·쓰기는0이며 정확한 공개 preview read만 synthetic 응답했다. 문서 unit43개 통과. Harness는 기존 rule inventory2건 실패를 그대로 기록하며 PASS로 합치지 않는다.

원래 전체 보고서는 `.scratch-pw/companion-068-final-report.json`, 최종 빌드 첫37개는 `companion-068-final-v2-report.json`, 관련6개는 `companion-068-interactions-report.json`, 최종 viewer1개는 `companion-068-viewer-seat-final-report.json`, 음식2개는 `companion-068-food-final-report.json`이다. 소스13파일의 정규화 SHA/build는 `companion-068-final-source.json`이다. 각 prefix의 raw/PNG/실패 context를 보존한다. 세 독립 담당의 코드 검토 지적(카드 finite 원복/중단·비행 carry/집 주민 경계)을 통합한 뒤 추가 차단 이슈0이며 미술 전문 검수나 실제 OBS 송출 합격으로 부르지 않는다.

## 운영 확인과 상태 복원

제품 commit `ceaefc3a28757b29b9f354ddd91d08591c1e00ca`의 [Vercel 배포](https://vercel.com/bluesky-s-project3/vic-schedule-studio/Hbf8j77odruDSsnuwjxfNQu22Xcd)가 success이며 운영 `/api/soop-live`의 build도 같은 전체 SHA였다(`.scratch-pw/companion-068-production-deploy.json`). 운영 새 packet12개 모두 HTTP200이며 로컬 파일 SHA와 일치했다(`companion-068-operating-assets.json`). 최종 소스13파일의 commit 일치는 `companion-068-commit-source-proof.json`, 같은 제품 빌드에서37개 고유 시나리오의 실제 통과 합집합/미해결0은 `companion-068-final-coverage.json`에 기록했다. 앞선 실패를 지우거나 단일 무실패 실행으로 합치지 않았다.

실제 로그인된 개발자 편집실의 build 배지 `ceaefc3`와 새 native 짧은 클릭 반응 `bonk-tears`/checking 및 울먹이는 그림을 확인했다. 해당 편집실의 실제 미리보기 메뉴로 시청자 화면을 연 뒤 설정에서 야간 모드를 골라 필터와 실제 생방송 방제를 확인했다. 필터 제목은 `rgb(255,216,115)`, 인기도/미정은 `rgb(201,197,188)`, 실제 보이는 생방송 caption은 `rgb(236,233,226)`였고 BCR은357.778×34.653px였다. 시청자 미리보기에서도 native 클릭의 `bonk-tears` 반응과 새 그림을 직접 확인했다. 운영 screenshot은 `.scratch-pw/companion-068-operating-studio-tears.jpg`, `companion-068-operating-viewer-dark-play.jpg`이다. 운영에서 특정 packet27을 기다린 단일 wait는 timeout이었으므로 연속 packet27→23/236프레임 증거는 위 local fixture 검사로만 한정한다.

실제 일정 생성/편집·음식 배치·역할 변경 없이 확인했다. 확인 뒤 화면 모드를 원래 밝게, 설정 탭을 원래 글자로, 태그 필터 접힘/계절 펼침/빅타민 집 펼침을 원래 false/true/true로 돌리고 실제 편집실 돌아가기 버튼으로 preview 모드도 종료했다. 최종 DOM은 theme 속성 없음·viewer fullscreen0·열린 dialog0이었다. master/종/성향/걸음 설정은 변경하지 않았다. 운영 음식 낙하/OBS 녹화/개인정보 RLS 감사까지 실행한 것으로 주장하지 않는다. 음식의 실제 중간 잡기·양쪽 낙하와 제자리 보관은 쓰기 차단된 production-build fixture 근거다.
