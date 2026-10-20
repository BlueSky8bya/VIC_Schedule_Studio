# 빅타민 생활·가림·수집 확장143

상태: 로컬 검사·독립3검수·종료기 통과, 운영 배포 확인 중.2026-10-20 KST. 기준은 최신 배포564e9a9이며 a2e6bf2 관찰 중 이미 고친 부분은 재현해 구분한다. 사용자 최신 원문과 첨부 경로는 로컬 `.scratch-pw/companion-143/`에 보존한다. 이전142의 현재 완료 문서 보완·사용자 아트와 무관한 변경을 유지한다.

## 빠짐없는 요청표

| ID | 요청 | 완료 근거 |
|---|---|---|
| A | 집 안 음식·장난감에 실제 방 조명 적용, 밖에서 복원 | 3표면 실제 조명/복원 assertion·PNG·trace 통과; room raw연속시계열0 한계 명시 |
| B | 소파 앞 외곽선/점프 가림, 편집창 레이어, 빠른 스크롤 분리 | 현재110P; compact53px/80표본·editor187프레임 누락0·최대앞면오차0.000388px |
| C | 탐험둥이 등 비집돌이의 실제 달력 외출·걷기·뛰기·점프, 소파 초기화 왕복 제거 | 9성격 실제90초9/9·대표/보조9/9·실제 외부walk/jump; 강제수면/집돌이외출 제외 |
| D | 집은 개인 공간: 자발적 사용자 응원/교감은 밖으로 접근; 집 안 사용자의 직접 교감은 유지 | 실외 자발응원·유한 editor 응원·직접실내쓰담 검사 통과; shared guard 보존 |
| E | 성격별 쓰다듬기 반응, 자연스러움의 음수·프로젝트 재미의 양수 기준 | 실제9성격 pet ACK·첫개별반응9/9; 전체2포즈유한성은 source/model범위 |
| F | 매일 최소3명 다른 관점의 검수, 성격당 새 아이디어1개와 검증된 반영·보고 | 09KST ACTIVE 갱신·3비작성독립검수·9아이디어평가; 별도예약실행 미관측 |
| G | 중복 없는 음식·장난감 추가, 각각12배수, 전수 확률·더 희귀한 계층·국내 유명 장난감 오마주 | 음식240/장난감60·희귀CDF/저장/알파/source stamp 회귀 통과;302art byte보존은 index후검사 |
| H | 첨부 방송 화면의 토리 채널과 총5종의 작은 루프, 자율 시청은 토리 최빈 | 제공화면 채팅제외crop·5로컬루프·자율Tori55%;3표면실제TV/reduced검사P |
| I | 전등/커튼 독립 조작, 커튼 전환 깜빡임 제거 | 3표면 실제 독립제어/저장/복원검사P; 모든compositor프레임관측은 아님 |
| J | 창·봉·커튼 묶음 축소/벽 상단 아래 등록 | .93축소/벽상단아래 등록·3표면실제roomPNG검수P |
| K | 기본 눈과 안경 크기를 기준으로 포즈별 눈/눈 액세서리 일관성 | 24눈overlay/496보존·기본안경투영·27실제PNG검토; 사용자thumbnail픽셀동일성/인간승인 아님 |
| L | 성격 버튼 hover 침범 제거, 태그/계절/집 접기 UI의 공용 명확한 표시 | 공용44px ±/normal-flow action·3표면hover/G22검사P |
| M | 전체 검사·3표면 실제 렌더·서로 다른 검수3명·범위/남은 한계 보고·승인된 반영/실제 배포 확인 | 전체unit5100/마지막회귀175·pure1723/type/lint/build/harness·실제110/27entry/9daily/반납2P;최종3검수종료기/운영배포는 후속기록 |

## 경계·실행

공유 viewer/studio/preview 한 구현, KST, 실제 실물/지지면·욕구·명시 OFF·수동 소유권을 유지한다. 집돌이/필요 수면을 외출 지표로 강요하지 않는다. 개인정보/일정 원문/개별 수집·취향·학습 정보를 활동 분석에 넣지 않는다. 방송 참조는 사용자가 제공한 화면의 시각 입력이며 생방송·외부 영상·채팅/실시간 API를 호출하지 않는다. 기존 식별자/발견/읽음/옷장 저장을 보존하고 새 카탈로그만 추가한다.

root는 원문/요청표·공유 runtime·경계·조사 통합·에셋 생성과 최종검사/반영 담당. 세 독립 역할은 생활/행동·공간/UX·수집/운영으로 분리하며 작성자는 자기 변경의 독립 승인자가 아니다. 먼저 현재 재현과 설계, 다음 원본/SHA 보존 에셋·분리된 패치, 이어 실제 연속 장면·전체 unit/type/lint/build·harness·3표면/G22·최종 독립 검토·배포 proof 순서다. 원본·기존 실패·생성 후보는 삭제/덮어쓰지 않는다.

새 아이디어는 하루9개를 근거와 함께 제안·구현·평가하되 긴급 욕구/자연스러움 음수 결함과 기존 검증을 통과해야 채택한다. 이름만 바꾸거나 포즈를 억지로 재생해 완료로 세지 않는다. 자동 수정은 유한하며 실패/미실행·실제 표본과 전수 모델의 범위를 보고한다. 별도 승인된 일일 heartbeat의 기존09KST/대화/알림을 유지하며 최소3명 검수와 이 기준을 보강한다.

## 중간 검증 — 최종 완료 아님

2026-10-20 11:50 KST. 동결 사본별 SHA guard 후 root 적용영수증은 로컬 `root-apply-1..5/receipt.json`에 보존했다. 음식/장난감은 전체 원본 alpha>0 pixel의 단일 귀속과 실제 runtime decode를 검증했다. 기본 눈과 닫힌 눈 높이를 동일하게 만드는 대신 양눈 간격/안경 명목 크기를 정렬하며, 논리 row9 및24의24정면 셀만 새source로 파생한다. 실제 단일 눈 생성1회와 음식5·장난감3 시트 단일생성을 각각 보존했다.

과거 24장난감 shuffle bag의 보장은 현재 weighted60 계약으로 대체된다. native 특정 장난감 준비는 RNG를 바꾸지 않는 유한 실제320draw까지로 분리하고 이후115초 생활 증거·3초 첫반응·20초 구간·10초 무의미 간격·same-ID 반납 기준은 유지한다. 오래된144/180/24/실내자발응원 기대값을 수정하되 발견한 실제300항목16KiB 저장 초과와 source stamp metadata 누락을 단순 기대값 교정으로 숨기지 않는다.

2026-10-20 12:13 KST 중간 추가. 검토 사본은 root-apply-6..9의 정확 경로/SHA로 통합했다. 전체 unit4806/0failed/0skip 한 차례 통과 뒤 새 검토에서 편집 응원 무한 반복·working actor81/소파76의 충돌·sleep OFF 진입/쓰담 우회·종료기의143raw문맥 재검사 누락을 찾았다. 각각 실제pose2완료 유한 세션(OFF 재마운트 유지), 실제 seat/back의 기존75/76 유지, 깨어있는 대체 반응, 종료기 context/personality 재검사로 보완했다. 80개 종료기/326개 sleep 회귀 및 새18개 유한 응원 검사는 사본/범위 결과이며 최종 전체 검사를 대신하지 않는다.

네이티브110개는 실제 room scroll의 누락/숨김 프레임도 분모에 포함하고, editor+roam:true resident 가림과20초 유한 외부 응원,9성격 실제 안경·쓰담/후속 포즈,3표면 TV의 앱 reduced 정지를 추가 검증한다. 독립3관점 소스 검토와 원 실패를 보존했으며 최종 동결 빌드/실제110·9daily·배포는 아직 대기다. 기존09:00 KST heartbeat 갱신은 도구에서 ACTIVE 확인했고 별도 예약 실행 성공과 구분한다.

2026-10-20 12:40 KST 첫 동결 실행 종료. source7193db9e/build tynVDUk14HIr0EwqIhW2L에서 pure1395/build/type/lint는 통과했지만 실제110개 중89P/21F, entry22/27P, daily6/9P였다. 실패·영상·raw를 보존했으며 release 보류다. 원본 SHA 변화0/소유 프로세스 정리 통과 후 다음 교정을 시작했다. 실제 compact scroll53px/81관측에서는 소파·앞면 차이 최대0.000388px, 몸 발 상대변위0, 누락·숨김0이었고 편집창 resident 가림도 통과했다. 같은 test 후반의 외부 응원은20초 내 미실행으로 실패했으므로 소파 통과를 전체 성공으로 세지 않는다.

원인별로 TV의 바뀐 DOM/채널과 CSSOM 숫자 직렬화, sleepy sleepOFF의 실제 stretch 진입 검수 누락은 검사 사본으로 교정했다. 물리 gap160~330px의 실제 이벤트 준비는 방이 내려간 현재 배치에서 native viewport만 재설계하고 기존 실제 반납·시간 기준은 유지한다. 별도 실제 결함은 탐험둥이 실외0/TV·소파 연쇄, 사고뭉치의 식사 우선과 장난감 예약 충돌, 일부 대표 장면 미완주, editor 재진입 응원 누락이다. 외출은 실제 경로 선행 증명·같은 목표 보존을 보완하며, 연결된 길 자체가 있는지는 유한 익명 진단으로 다음 빌드에서 확인한다. Calendar inert 가설은 실제42일 DOM 복원에서 lock0으로 폐기했고 geometry 보호는 풀지 않는다. 자기 장난감을 안는 실제 행동은 같은 실물의 decode·배치·접촉 증거로만 구분하며 기존 실패를 소급 통과시키지 않는다.


2026-10-20 13:08 KST 중간 검증. 전체 unit4948/0failed/0skip·type/lint/harness는 통과했고 focused-r3 실제6개는2P/4F였다. viewer/preview의5TV는 통과했으며 studioTV의공유닫기선택자는 실제 dialog근거로교정했다. 밤외출의optional전등은실효과ACK뒤OFF로정정했다. 이전실패/영상은보존한다.

143 실제 달력 격자선 이동 — root-apply17 적용/새 native 미검증

focused-r3는 탐험둥이의8개 외출 후보가 상단 헤더124.84375px와 viewport-floor1082px뿐이며 모든 기존 경로가 null임을 확인했다. 편집실 재롱둥이도 grounded·active·geometryReady 상태에서21개 후보가 모두 null이었다. 날짜42개 DOM의 inert 원인은 배제됐지만, 당시 날짜 Range·행 높이·테두리 계산값은 저장하지 않아 ‘축소된 행에서 숫자 위 몸 공간이 충돌한다’는 소스/시각 추론과 분리한다. 기존 실패는 통과로 바꾸지 않는다.

기존133의 ‘칸 아래선은 수동 배치만’ 제한을143의 실제 생활·달력 외출 요구에 맞춰 좁게 대체한다. 실제 보이는 solid 아래 테두리와 정상 날짜 identity가 있고 테두리 자체가 clip 안에 있는 경우에만, 기존 safe petSpans를 같은 높이·같은 ID의 일반 floor로 승격한다. 글자·버튼·집·뷰포트 보호는 동일하며 투명 패널, 새 높이/측정/점프 범위는 만들지 않는다. 음식 tier와 수동 카드 정책은 유지한다.

기존 date/card normal 지지면을 먼저 수집하고200개 예산의 남은 부분만 사용한다. 기존 manual landing과 normal plane은 동일 ID 한 정본으로 교체하며 follow/scroll anchor도 동일하게 갱신한다. 소유권·OFF·수동 입력·학습/활동 계약은 변경하지 않는다.

단위는 기존69+신규30=99 PASS, old source의 대표4회귀4 FAIL 보존, import-only type/lint2파일 PASS다. 공유3표면·테두리 가시성/alpha·테두리만 clip되는 경우·텍스트/컨트롤/집·실모델 BFS walk/jump·200 cap/카드 우선·food tier/측정 횟수 동일성을 확인했다. 실제 밖 연결/편집 응원/실물 반복 회귀는 root의 새 focused/native gate에서 별도로 증명해야 한다.


2026-10-20 13:21 KST. geometry 교정 뒤 fullunit4983/0F/0skip·type/lint/harness 통과, 매일 필수 검사에 geometry99와 goal-continuity 회귀를 추가했다. focused-r4 source da4a1127/build uFMwnl3w8ZGFvEiINlkus의 실제19개는17P/2F, 원본 변화0/소유 프로세스 정리P다. C/A/M 각90초·P/C/A/T 대표/보조·선택된 TV/독립 조작·editor sofa와 유한 외부 응원은P다. C는 decoded1084frames/90.5297초·실제 외부walk41/jump54를 관측했다.
남은 outside 수동 착지는 같은 좌표의 첫 관측31.6ms에서만 support가 비었고81.7ms 이후 card-105-top으로 복원됐다. strict source 확인 전 paint만 숨기는 root-apply18을 통합했다. 검사의 첫 visible frame 조건은 유지한다. G140은primary0/secondary 있음으로 실패했지만 G05는 시작0, X-G-house의 실제watch3.016초는 완료됐다. G05watch 수정 후보를 이번 실패의 수정으로 취급하지 않으며, 실제meal 뒤 필수wash/outing에 의한15초cue 실효와 minor alias의 선행 소비를 조사·교정한다. 최종native/3fresh검사/출시는 미완료다.

2026-10-20 13:30 KST. root-apply19는 식사 뒤 실제 도달 가능한 TV 후속목표가 남으면 선택할 기회를 먼저 주고, 같은 사건을 minor alias가 먼저 소비하는 경계를 보완한다. 원15초TTL/heldBack/급한식사·씻기·수면/수동허가/실물소유권은 유지한다. query와실제선택의 eligible/different/unfinishedReturn을공유해 최근완료목표의phantom외출보류도막는다(r2미적용반례3F보존). G05필수watch의소파접근과유한시청소유권도함께교정하되실제progress나8초budget을충전하지않는다. 99개관련모델P와구제품2F/r2반례3F는사본근거이며 현재원본full/native는재검증한다.

2026-10-20 13:36 KST. root-apply19 뒤 전체unit5057/0F/0skip·type14/lint8/harness5가 통과했다. focused-r5 source dd504002/build 9yFzWdsWSVQxH2tDzY1bP에서 실제3개(G140/T140/바깥수동착지)는3P/재시도0, originalSourceChanged[]/소유프로세스정리P다. G05실제281frames 중 decoded visible watch60관측과 finalbeat→후속G12완주를 확인했다. 바깥첫visible지지면·같은네장난감반납 조건도유지한채통과했다. 이수정본의전체110/9daily·서로다른비작성검수3명·9아이디어실증결정·최종종료기·출시는별도최종gate다.

2026-10-20 14:06 KST. 두 번째 전체 실행(source07e326a1/build5dmQWIeJvCd9nVPt47B_T)은 pure1680/build/type/lint P, 실제110개107P/3F·entry26/27·daily8/9·같은네장난감반납2/2였다. 23.2분 native의 원 실패·영상·증거를 보존했고 소유 프로세스 정리/원본 변화0을 확인했다. 세 실패를 구분해 root-apply20..22로 통합했다.

- A90의 실내 애교 판정은 실제 장난감을 안은25개 프레임 앞의 cold idle pose1 한 프레임만 오탐이었다. 이미 측정하는 실제 sprite source를 matching/other/unmeasured로 구분한다. 명시적 응원·손길 요청과 미측정 후보는 기존 엄격 판정을 유지하고, 새 필드가 없는 구기록은 통과시키지 않는다. 관련124단위 P이며 최초 잘못된 CLI 옵션 실행은 검사 미실행으로 보존했다.
- C140의 C04는 두 번째 실제 시청3033.1ms(등록된 row1의47프레임/2883.2ms)를 마쳤지만 bow 직전에 오래된 TV ACK의3.5초 소유가 끝나 외출이 선점했다. 실제 같은 소유자의 필수 TV 시청만 유한 renderer 완료·기존80%−80ms decoded coverage·현재 소파/TV/사용자 우선 상태로 확인해 짧은 마무리를 닫는다. 실제 진행/학습 보상·8초 장식 예산·7.5초 정체·60초 장면·3.5초 마무리 값은 늘리지 않는다. 관련131단위 P와 수정 전 C04/X-C-house 반례2F를 별도 보존했다.
- preview 깔끔이 선택 검사는 실제 걷기·점프 중10,316.3ms 진행 누락을 냈다. 새 DAY 바닥은 bottom−3인데 관측의 foot+4 hit가 다음 날짜를 읽어 중간 walk의 실제 두 착지 프레임에서 support를 놓쳤다. QA만 foot+2와 실제 topmost solid border를 유한하게 확인하고 검증된 현재 DAY를 출발 anchor에서도 우선한다. 기존 ink/clip/몸·가구·컨트롤 배제, 두 정착 프레임, 같은 이동, 10초/20초 기준은 유지한다. 추가 hit는 경계 관측에서 최대2회이며 새 전체 DOM 스캔은 없다.

세 사본은 서로 다른 작성자 검토와 SHA/기준 일치를 확인했다. 마지막 수정본의 전체 unit/type/lint/harness 및 새 동결110/9daily는 재검증 대기다. 새 제어·서버/권한/저장 데이터·시간대 변경은 없으며 watch 마무리는 자율 행동이어서 G22 사람 활동으로 기록하지 않는다. 이전 전체 실행에서 실제 9종 쓰담/안경, 3표면 조명·TV·독립 제어, 소파·편집 응원·네 장난감 반납은 통과했지만 이번 최종 소스를 대신하지 않는다.

2026-10-20 14:08 KST. 통합 후 전체unit5100/0F/0skip·type15·harness7이 통과했다. lint9는 새 단위 검사의 사용하지 않는 type alias 하나 때문에 실패했고, 그 선언만 제거한 뒤 lint10과 시청/엄격 이동175단위가 통과했다. 테스트·제품 동작을 바꿔 경고를 숨기지 않았다. 새 동결 빌드의 전체110·9daily, 최종 독립3검사·종료기·운영 출시는 아직 별도 대기다.


## 최종 동결 실행 — 2026-10-20 14:30 KST

run `20261020140801-67000-4d1054f6`, source `fe7bffdeeddde8f41901f1afeadc634b9f14697d2ccf5a5250d60d20cf33bd6b`, BUILD_ID `1Dy_mFKNi-EY380rSVIar`. 전체110/110·entry27/27·daily9/9·같은네실물반납2/2, skip/retry/flaky0. pure1723와 11단계 모두 통과, 원본변경0·소유프로세스정리P. 일상9662visible decoded프레임, 153등록모델/54일상/262144정규화는 native전수와 구분한다. 이전89P21F/107P3F는 원형보존한다.

9개D143는 code/model연결과 formal native채택을 구분해 모두보류한다. 일부실행관측이있고 D143-C는 raw finalbeat후 다음생활까지보이지만 frozen completion note가없어 정식채택조건을충족하지못했다. 발생0/미구현으로보고하지않는다. 9pet는첫개별반응, 3room은assertion·PNG·trace범위다. 세새비작성검수의실제호출/최종답변/해시·최종종료기·417literalindex/302artblob·원격CI/실제운영은각후속영수증에기록한다.


2026-10-20 KST 최종 검토. 실제 post-close 세 비작성 검수 living/spatial/boundary 모두 accept·열린 P0/P1/P2 0, 각9아이디어 평가와 실제 호출/완료영수증을 보존했다. 원시 D143-C 완료/후속 관측 누락을 발견해 두 검수의 r1 표현을 정정하고 r1/r2를 모두 남겼다. 정식 note 부재로9deferred 유지다. 실제 종료기 finalization-1은 eligibleForAuthorizedRelease=true/issues[]; 로컬 해시/증거/호출 대조 통과는 인증된 검수자 신원이나 자동 배포를 뜻하지 않는다. 다음은417literalindex/302artblob 검사와 실제 승인 배포/운영 확인이다.
