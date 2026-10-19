# 133 — 빅타민 허공 받침·도감 방향 탐색·쓰다듬기 눈선

2026-10-19 KST. 상태: 구현·검증·출시 완료. 최신 사용자 세 가지 수정 요청에 한정한다. 132의 새 성격·집 생활 제안은 별도 검토 상태로 유지하며 구현하지 않는다.

## 범위와 경계

1. 음식·장난감에는 없는 투명 패널의 가짜 받침이 본체에는 남는 원인을 재현하고 제거한다. 실제 날짜칸·일정·띠·집·화면 바닥과 스크롤 추종은 보존한다.
2. 모든 도감의 숫자 범위·중앙 새 발견 표시를 공용 도트/바로 대체한다. 이전·다음에 방향별 미확인 표시와 빠른 이동을 연결한다. 수동 페이지 탐색·좌우키·발견/읽음 ACK·44px 입력·고정 레이아웃을 유지한다.
3. 쓰다듬기16프레임의 행복 표정은 유지하고 눈선만 다른 닫힌 눈과 어울리는 무게로 교정한다. 단일 생성과 명시 범위 파생을 기록하고 눈 밖·입·볼·몸·귀·등록값을 보존한다. 기존131·099/원본과 사용자 그림 작업은 덮어쓰지 않는다.

공유 viewer/studio/preview 구현만 변경한다. 역할·서버·DTO·DB·KST·기존 사용자 설정은 바꾸지 않는다. 생산 DB·live state·실제 로그인 없이 격리된 fixture와 네이티브 입력을 사용한다.

## 진행

- 본체 geometry/재고정 경로, 공용 도감 UI/활동 제어, 눈선 단일 생성·패킹을 분리한다.
- 통합 전 작성자가 아닌 담당자의 코드·역할/경계·UX/QA 검토를 받는다. 미술 전문 검수를 자동 추가하지 않는다.
- 변경된 제어의 semantic target·포인터/키보드·중복 방지·timeline/least-used 표시를 함께 검사한다. 음식·장난감·도감 ID/발견/취향은 분석 메타데이터로 보내지 않는다.
- 129의 '본체 수동 패널-floor 유지'는 이번 허공 정지 수정에 한해 대체한다. 실제 DOM 날짜/일정/집 앵커 보존은 유지한다.

## 검증 계획

- 131 실제 생산 빌드에서 본체 허공 정지를 네이티브 배치로 먼저 기록한다.
- geometry·도감 방향/미확인·G22·눈 밖 픽셀/alpha 보존 회귀와 typecheck/lint/full units/build/harness를 실행한다.
- 수정 생산 빌드의 viewer/studio, 도감3종·옷장, 긴15페이지·작은 화면·키보드·읽음 처리·실제 낙하/스크롤·집/소파·쓰다듬기 연속 영상을 확인한다.
- 실제 broadcaster PC/OBS·연속 OS unfocused 입력은 별도이며 fixture로 인증하지 않는다. 미실행은 PASS로 표기하지 않는다.

## 결과

### 수정 전 증거와 준비 오류

- 기존 로컬 생산 빌드 `rEYa5res65NRvfBhhp6Aj`의 native studio1920×1100 P배치로 재현: panel rect `(10,514.046875,340,283.953125)`, bottom798; 몸 발795, support `companion-panel-floor`. 내려놓은 점 `(197,733)` 아래의 투명 박스 끝에서 정지한다. `.scratch-pw/companion-133/before-3/studio-1920-place.{png,json}`와 원영상 보존. 이 로컬 빌드의 badge는131 커밋 전3968a51이며 현재 배포 SHA와 같은 빌드라고 주장하지 않는다.
- 같은 viewer1920에서는 panel bottom1084가 실제 viewport floor1030보다 아래라 먼저 실제 바닥에 닿는다. 표면별 레이아웃 차이로 재현 여부가 다름을 유지한다.
- 준비 중 npm의 PowerShell 인자 전달, native probe baseURL 누락을 바로잡았다. 첫 viewer1440은 숨겨진 패널 rect를 고른 부적절한 관측이었고 viewer1920만 먼저 검사했을 때도 재현을 강제하지 않았다. 실패 출력·별도 before/before-2 결과를 보존하고 실제 studio 사례를 근거로 사용한다. geometry/style/RNG/clock/가짜 집중·실제 care·소장 경험 주입0.
- geometry 회귀는 이전 코드에서 새 기대3개 실패→수정 뒤 관련119개 통과. 도감·이미지·전체 제품 검사 결과는 통합 후 추가한다.

### 구현과 통합 검사

- 본체에도 남아 있던 `companion-panel-floor` 생성을 제거하고, 오래된 앵커의 재고정·추종·대기 경로에서 같은 ID를 거부한다. 실제 날짜/일정/띠/집/viewport 지지는 유지한다. 최종 빌드 `qlm7DqO-91vFmr6UiO__l`의 동일 studio1920 네이티브 배치 `(197,733)`는 panel bottom798을 지나 실제 viewport-floor 발1082에 도착한다. viewer1920 P배치·실제 드래그도 viewport-floor 발1030에 도착한다. 세 관측 모두 오류·금지 요청0, `.scratch-pw/companion-133/after/` 원자료 보존. 전후 스크린샷을 직접 비교했다.
- 공용 pager를 음식/장난감/추억/옷장에 적용했다. 점·바와44px native range, 방향별 `!`를 사용한다. 표시가 있는 방향 버튼은 선택항목 기준 가장 가까운 미확인 항목(같은 페이지 포함)을 골라 그 항목1개만 ACK한다. 표시가 없는 방향은 한 페이지 이동한다. 바·페이지 키·Home/End는 일반 탐색이므로 ACK0이다. 항목 좌우키의 기존 검사 의미는 유지한다.15페이지 음식은 전체 점, 더 긴 목록은9점 창과 전체 바를 사용한다.
- 쓰다듬기 단일 생성1회를 명시 눈 영역에만 파생해 최종 `vitamin-action-09-eye-weight-133-v3.webp`를 연결했다(SHA `FF8ECC78933A0BD414E7FEFA2E682FA1A04DA5760E3985E286731D02BD6B1673`,368600B).16개 입의 원본 bounds+1px guard 전체 RGBA·눈 밖 RGBA·전체 alpha·520프레임/rig·다른504프레임/32패킷과 보존된131 부모를 보존한다. eye ink-run proxy 중앙값2.76→4.79px로 두 닫힌눈 비교 기준 사이에 놓인다. 이는 같은 펜의 정확한 굵기 인증이 아니다. 전문 미술 검수/추가 생성/사용자 승인0, 공식 draft 기록은 별도 보존한다.
- 처음 v1은 입 주변4픽셀 변경을 놓쳤다.16개 입별 guard 직접 비교를 추가한 v3에서 수정했다. 초기 실패와 v1/v2는 로컬에 보존하고 최종 패킷만 runtime 배포 대상으로 둔다. 공개 재현14파일+납품4파일은 독립 해시/크기/개인정보 검사로 확인했다. `/art-src/`는 Vercel 입력에서 제외된다.
- focused gallery78개/8파일, art29개/4파일 통과. 최종 전체 단위3,190개/294파일, typecheck/lint/build, harness331문서 통과. 초기 전체6실패(옛131 successor 기대/입 픽셀), 수정 후 동시 실행 중 agent-memory hook5초 제한1실패를 보존했다. 빌드 종료 뒤 단독 전체 실행에서3,190개 모두 통과했으며 timeout을 늘리지 않았다.
- 독립 geometry→gallery UX/역할·경계/QA 검토, gallery→art 파생·해시/리그 코드 검토, 별도 공개 재현 화이트리스트/배포 경로 검토에서 신규P1/P2 발견0. 이는 전문 미술 판정이나 실제 로그인/RLS/OBS 검증을 대신하지 않는다.

### 실제 화면과 연속 녹화

- 동일 최종 빌드의 viewer1050×640 수첩/light, viewer1440×900 설정/dark, studio1920×1100 수첩/dark에서 도감3종·옷장 고정 비율, 바 pointer/Home/End/좌우키, 미확인 방향 이동/ACK1와 일반 탐색/ACK0을 검증했다. 양쪽 `!`가 있는 화면과 작은 수첩·어두운 장난감·옷장 화면을 직접 열어 확인했다. 발견 상태를 심은 탐색 fixture이며 실제 획득 이력이라고 주장하지 않는다.
- 실제 쓰다듬기/탭 전환 native 케이스는 사전 care/taste/discovery·가짜 clock/RNG/geometry/focus/callback 없이 통과했다. 관측457프레임 중 petted290프레임, 최종 row9의16포즈를 실제 decode했고 decode 실패0이다. 실제 focus가 false인 peer 탭에서 돌아온 첫 stroke는 대상 pointerdown 없이 반응했다. 마우스 전송은 탭을 활성화할 수 있어 지속 OS 비활성 입력을 인증하지 않는다.
- 원영상19.96초와6–9초의 실제3초/25fps/75프레임 clip,75개 전 프레임 시트를 보존하고 직접 확인했다: `.scratch-pw/companion-133/petting-final-native.mp4`, `petting-native-all75frames.png`. 실제 상태 전환의 기본 표정 복귀도 그대로 남기며 합성 재생·보간 생성이 아니다. 소파 천 앞/뒤 이동·회수와 resident strokes도 함께 검사했다.
- 최초 native 실행은 activity 전용 loopback alias가 기본3100을 가리켜 중단했다.3117 alias로 수정한25케이스 실행은17통과/8실패였다. 실패8개는 기존110의 도감 분류2개 기대(실제3개)와112의 퇴역 프로필 region 선택자였고 제품 동작 실패로 숨기지 않았다. 현재3개 분류명/성격 카드/옷장 버튼을 검증하는 하네스로 고쳐 동일 빌드에서 해당8케이스를 재검사한다. 원래 실패 trace·video·report는 `final-native-v2`에 보존한다.
- 같은 빌드 재검사 `final-native-v3`는110 viewer/studio2개 통과,112의 옛 짧은 화면8개 tile 상한 때문에6개 실패했다.131부터 보장한2행·최대6열의 실제12칸을 기준으로 computed2행/2..6열/실제 칸 수와 기존44px·비넘침·선택/ACK·키보드 검사를 함께 유지했다. 최종 `final-native-v4`의112 viewer/studio/preview×light/dark6개 모두 통과(재시도0), 제품 수정0이다.25개 고유 native 시나리오가 같은 최종 빌드에서 모두 통과했고, 별도 실제 본체 낙하3개도 통과했다.
- G22는 실제 포인터/키보드에 대한 고정 page prev/next·inspection category·book open/close 캡처와 developer timeline/least-used 표시까지 통과했다. 메타데이터에 음식/장난감/발견/개인 취향 ID를 추가하지 않았다. 모든 실패·교정 전 자료와 최종28개 고유 native 결과를 별도로 남겼다.

### 출시와 실제 공개 검증

- 승인 범위57경로만 커밋 `bfab6e6cb3be9d7ed9b2c2899a0be434d10e1d13`으로 main에 반영했다. 작성자/커미터는 공개 noreply identity이며 관련 없는 사용자 그림 기록은 제외했다. 필수 재현14파일은 Git index에서도 원본 해시와 정확히 일치했다. 새 runtime 파일은 최종v3 하나이고 중간v1/v2·원문/계약·개인 경로·132 미승인 이미지·무관한 untracked 파일은 제외했다. `.vercelignore`는 source/review archive를 배포 입력에서 제외한다.
- [Vercel 배포5wyHGH7aiLv2A13TucagQWZwQvGT](https://vercel.com/bluesky-s-project3/vic-schedule-studio/5wyHGH7aiLv2A13TucagQWZwQvGT)는2026-10-19 17:06:38 KST에 success/Deployment has completed로 확인했다. 실제 공개 클라이언트 전체 SHA와98개 committed runtime 파일의 원격 바이트 해시, 실제 로드된 청크도 일치했다.
- 첫 공개 검사17:08:04.637 KST 실패를 `.scratch-pw/companion-133/production/`에 보존했다. 새 toy tab mount 직후 max3을 읽은 다음 ResizeObserver가 실제 max2를 전달한 것이었다. 검사만 실제 grid BCR/CSS rows·columns/range max가4연속 native rAF에서 일치하고 총수/실제 pageSize가 맞는 뒤 기준값을 잡도록 고쳤다. 제품·스타일·상태·clock/RNG를 변경하거나 원 실패를 덮어쓰지 않았다.
- 두 번째 실제 익명 공개 검사는17:10:15.392 KST 통과했다(`production-2/`). 음식15·장난감2·추억3·옷장5페이지의 pointer/좌우키/Home/End, 점·바/방향 badge와 일반 탐색 ACK불변, 프로필·전체상자 반환·실제 음식/장난감 source→floor·hover/selection·모바일 제외·404를 확인했다. 실제 페이지의 새 도감과 쓰다듬기 스크린샷을 직접 열었다. care/preferences/tastes/discovery 주입0, 실제 live-state GET·private manifest 읽기·서버 mutation 전달0, 브라우저 오류·예상 밖 요청0이다.
- 실제 공개 쓰다듬기는 sofa Enter 회수 뒤96회 native pointer 왕복만으로 finalv3의16개 physical pose144–159/decoded261프레임을 관측했다. keyboard affection fallback은 사용하지 않았다. 실제 자동 graphics 정책은soft였으며 이를 full-motion/OBS 성능 증거로 바꾸지 않는다. full graphics의 연속 동작은 위 동일 소스 최종 fixture 녹화/75프레임에서 별도로 확인했다.
- [원격 quality39220175711](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39220175711)은17:10:13 KST success다. 새 checkout의 단위·격리 SQL 계약·harness·production build·generated-route/source typecheck·lint를 통과했다. 실제 로그인/RLS/계속 비활성인 OS 창/방송자PC·OBS 및 동기간 provider quota 회복은 이번 증거가 아니다.
- 보호된 사용자 그림 기록 SHA `E980005102457E2A02AE318FF7665596E7170D0BFB34A328F64A6EC292C5990B`와 기존 캐릭터/장난감 원본은 보존했다. 출시 완료 bookkeeping은 로컬 문서에 남겨 별도 docs-only 배포를 추가하지 않는다.
