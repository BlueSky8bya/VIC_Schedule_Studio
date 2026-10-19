# 집·스크롤·성격138

시작2026-10-19, 완료2026-10-20 KST. 상태: 구현·로컬·실제 배포 검증 완료. 최신 요청: 빠른 스크롤 중 소파와 배우 분리 수정, 고정 요일 바 다크 조화, 소파·TV·밥통·장난감 상자·패드·쓰레기통을 함께 조금 내리기, 매 새로고침9종 무작위 성격.137의 성격 저장 유지 조항만 새 문서 추첨으로 대체하고 같은 문서 수동 선택·화면 전환 유지/기존OFF·안전·단일 시계는 보존한다.

## 범위·검증

공용 viewer/studio/preview의 기존 몸/소파 깊이·스크롤 추종·실제 앵커를 확인한다. UI 색은 공용 테마 토큰, 가구는 같은 하향 기준과 실제 출구/패드/반납 측정으로 유지한다. 새 이미지/물리 장식벽/서버·DB·권한 변경은 없다. 성격 자동 추첨은 사용자 활동으로 기록하지 않으며 직접 선택 target은 timeline/least-used 기존 capture를 보존한다. 명시OFF·모바일 제외·KST·학습 로컬 경계 유지.

빠른 실제 휠/화면 전환/수동 소파 입장·깜빡임/다크 대비·가구 레이아웃·같은 문서 유지와 새로고침 추첨을 production fixture로 검사하고 full unit/type/lint/build/harness, 독립 경계/UX/QA 검수 뒤 scoped 배포·실제 공개 full SHA를 확인한다. 운영 API 쓰기는 차단한다. 보호 사용자 제작기록은 수정/커밋하지 않는다. 미실행은PASS로 쓰지 않는다.

## 재현·구현

기존137 production-build fixture에서 실제 native Ctrl+휠 확대·휠 왕복으로17.55~18.41px의 소파 앞 천/배우 지연을 측정했다. 기존 공개 레일은 스크롤 후 rAF에서 transform을 쓰지만 고정 주민은 그 다음 프레임까지 기다렸다. 실제 scroll과 기존 소유 layout-motion 이벤트에서 즉시 현재 anchor delta를 소비·paint하고 기존 유한 follower를 유지한다. 공개 레일의 실제 번역 직후 같은 layout-motion에 DOM element+180ms만 알린다. 새 상시 RAF/타이머/서버·분석값은 없다.

고정 weekday-stick은 다크에서도rgb(251,247,238), 기대cal-head는#23211d였음을 보존했다. viewer/studio 모두 공용cal-head/grid-line/ink와 다크 주말 의미색을 사용한다. 가구는 공통2.4cqw 하향값으로 실제 button/그림/출구/수납 바닥/패드 중앙을 함께 이동한다. 바닥 평면/창문/선반/전등/크기/가로 간격은 유지한다.

문서 Window별 최초9종 균등 추첨, 같은 문서 수동 변경·preview/재마운트 유지, 다음 전체 reload에서 새 추첨이다. 기존 저장된 enabled/OFF/기타설정은 그대로 읽고 성격만 덮는다. SSR/normalize에 RNG가 없고 새 저장키/자동쓰기/자동 이벤트/인간 활동은 없다. 기존 고정 선택 capture를 재사용한다. 새 단위는9개 정확한 추첨과 문서/SSR/저장 실패·이벤트를 검사한다. 기존 성격 fixture는 저장 seed 대신 실제 radio로 전제 성격을 정하도록 수정한다.

독립 읽기 검토는 public/private/역할/KST·G18·G22·명시OFF/모달 tail·같은 anchor 중복 소비·공통 하향기준·dark 의미색을 확인해 현재 차단 이슈 없음. 실제 새 빌드 수치와 최종검사는 아직 진행 중이다. baseline3의 코드는 기존137 빌드이며 위치/색 실패를 새 기능PASS로 쓰지 않는다.

## 새 빌드 실제 검증

전체 unit3458/303 PASS, typecheck와 fixture production build/lint PASS, harness338 PASS. 새7개 native 전용 검사는 native-3에서7/7 PASS: viewer/studio/실제 preview × dark/light6회 실제 휠 왕복에서 소파 앞 천/실제 배우의 최대 정렬 오차0.0002442px, 각8 scroll 전달을 관찰했다. viewer 같은 폭의6가구는 전후7.71875~7.734375px 아래로 이동했고 너비 변화0이었다. 새로고침8회는 실제9종 중 서로 다른6종을 확인했고 수동 사고뭉치는 같은 문서 preview에서도 유지됐다. 성격 추첨은 반복 가능하며 테스트는 RNG/시계/brain/geometry를 주입하지 않는다.

baseline-1의 weekday 미진입은 달력 확대1단계만 적용한 테스트 준비 오류로 보존했다. native-1/2는 스튜디오의 실제 배우가 소파 중앙 클릭을 가린 준비 실패, window가 아닌 내부 grid 스크롤을 읽은 판정 실패, 일정이 없는2025 달 preview에서 bar가 화면 밖으로 나가지 않은 준비 실패였다. 기존 native 키보드 소파 진입·실제 샘플이 있는2026-06 달·실제 scroll target의 scrollTop으로 교정했다. 제품 코드/정렬2px 허용을 느슨하게 바꾸지 않았고 같은 빌드 native-3에서 모두 재검증했다. `.scratch-pw/companion-138/baseline-3-evidence/`, `native-1/2/3-evidence/`와 영상/JSON을 구분해 보존했다. 기존 집 조작·인격·성격 선택·먹기/정리·활동 capture 회귀는 추가 진행 중이다.

기존135의 상자 바닥=뒤 벽선 단언은 이번에 승인된 공통 하향과 충돌해 regression-1에서3회 실패했다. 실제 alpha 그림의 상자/밥통 바닥 일치1.5px 및 실제 바닥 내부로 대체하고 기존8개44px 조작·비중첩·출구·패드 중앙·TV/커튼 검사는 보존했다. regression-2의 새 밥통 selector는 img 자체에 자식 img를 찾은 검사 오류3회로 수정했다. 제품은 이 두 회차 사이에 바꾸지 않았고 실패 JSON/영상/trace는 보존한다. 독립 재검토에서도 제품 범위/역할/OFF/G22 차단 문제나 검사 약화는 없었다. 새138은 앞 천이 보이는 프레임의 정렬 검사이며 모든 순간의 무깜빡임까지 증명한다고 확대 해석하지 않는다.

회귀3은38/39 PASS,136 소파 준비에서 바닥에 놓인 실제 배우가 중앙 포인터를 가려90초 timeout1회였다. 준비만 실제 focus+Enter로 교정하고 같은 빌드 회귀4에서1/1 PASS; 앞뒤 재질·커튼 밝기·hover·전등3상태 검사는 그대로다. 최종 고유 native55종(새7+회귀48) 모두PASS.9성격 선택 직후와20초 의미행동, viewer/studio 같은ID 장난감4개 운반·반납, 실제 밥통→같은 음식 먹기, 사용자의15초 수동 우선과 TV/커튼/영속 전등, 세면, 배출8/4개 상한·1440/1920/2400 실제 바닥·비중첩, 편집 focus/서버ACK/OFF·감소 모션·gfx OFF를 확인했다. G22 고정 선택·TV/전등 pointer/keyboard 단일capture와 개발자 timeline/least-used 양쪽 표시5검사도PASS. 자동 추첨은 기록하지 않는다.

최종 full lint/typecheck와 수정136 scoped lint PASS, unit3458/303·fixture build PASS, harness338·diff check PASS. 독립 검토 차단0. 보호 사용자 제작기록SHA256 E980005102457E2A02AE318FF7665596E7170D0BFB34A328F64A6EC292C5990B 유지. 실로그인/RLS/OBS·화면 낭독기와 전문 아트 판정은 이번 fixture 결과에 포함하지 않는다. 운영 확인은 새 익명 context·실제 fullSHA/chunk digest·native 조작으로 수행하고 POST/운영 live-state GET은 차단한다.

## 출시 확인

제품 커밋 `41e73e05904d60b7effea1a70a6d141ad71376fd` main push/Vercel success.2026-10-20 00:30 KST 실제 공개 HTML/정적 chunk의40자리 SHA 및 브라우저가 받은8개 chunk digest 일치PASS. 빈 익명 cookies/origins/localStorage에서 실제9종 선택·재롱둥이 decoded 대표 동작, native 움직임OFF 뒤 전등 변경→reload 유지·TV 수동 우선·가구 이미지 decode를 확인했다. 성격6회 실제 reload에서 사고뭉치/잠꾸러기/먹보/탐험둥이/둥글이/먹보(5종), 실제 설정의 다크 선택 뒤 native Ctrl+휠 확대/스크롤의 고정요일rgb(35,33,29)=cal-head#23211d PASS. 최종 화면 직접 검수. 오류0/예상 밖 요청0/운영 mutation0/live-state GET0/private manifest0. 알려진 익명 저장하트 read POST8회도 실제로 보내지 않고 차단했다. `.scratch-pw/companion-138/production/41e73e05904d60b7effea1a70a6d141ad71376fd/`에 at-run checker/증거 JSON/실제 캡처를 보존했다. 원격 quality39277952042는 진행 중이며 성공으로 미리 기록하지 않는다.
