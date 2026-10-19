# 성격 실제 실행 전수검증140

2026-10-20 KST. 최신 사용자: 깔끔이가 집 밖 장난감을 두고 달력에서 가만히 애교만 보임.9성격의 주 행동·보조 행동을 실제 완료까지 전수검증하고 결함을 고친다.137의 집 안 정리/짧은 대표 표정 검사만으로 모든 위치·욕구 상태를 검증했다고 확대하지 않는다.

공용 director→delegate jobs→real planner→동작/실물 ACK→완료·취소·후속의144장면 대응표와 우선순위/허기·기력/집 안팎/현재 받침/마우스/직접설정/OFF 경계를 감사한다. 실제 사용자가 꺼내고 집 밖에 놓은 같은 물건을 대상으로 원본139 production fixture에서 재현 증거를 먼저 보존한다. 새 디버그 훅/장면 강제선택/가짜 접촉/물건 삭제로 성공을 만들지 않는다. 기존 단일 세계 시계·성격 수동 기억·로컬 경험·공개 DTO/권한/KST·명시OFF를 유지한다.

원인별 회귀 단위 및 실제9성격 주/보조 조건 행렬을 만들고, 정리는 같은ID 운반/실제 상자 접촉/반납과 음식 먹기·보관·쓰레기통, TV/불/커튼·세면 등 실제 효과를 관찰한다. 모델144경로와 실제 브라우저 완료 증거는 분리해 보고한다. 독립 역할/경계/UX/QA, G22 자동 행동 제외·기존 선택 capture, 전체 unit/type/lint/build/harness 뒤 배포 확인. 운영 mutation/live-state GET/DB fixture는 금지한다. 보호 사용자 제작기록은 그대로 보존한다.

## 재현과 수정

- 원본139 production fixture3140: 실제 상자에서 꺼낸4개를 포인터로 옮기고 배우를 집 밖 받침에 직접 배치했다. 허기 `.05`는20초 동안 실제 운반60프레임·1개 반납/3개 잔여, `.5`는 실제 운반0·4개 잔여/제자리 준비·ready 반복. 기존 중간 허기 거절을 실제 화면에서 재현했다. 첫 준비 시도는 placement 완료 전 platform 검사·드래그 throw 조건 탓에 실패했으며, 실제 held와 착지까지 기다리도록 교정했다. 두 번째 재현에서 물체는 실제 안전 viewport-floor x453/y650에 모였다. 이를 ‘패널 아래 네 지점 분산’ 증거로 확대하지 않는다. 최종 회귀는 실제 달력 바닥 x480/570/660/750에 분산·거리40px 이상도 검사한다.
- 허기/식사 도달성/경로 선택/고정ID/OFF/일회 마우스 접근/B04/음악 의미의 수정과144행 대조는 [독립 감사](../verification/COMPANION_PERSONALITY_EXECUTION-20261020.md)에 기록했다.
- 브라우저 중간 build3에서 추가 결함: P01 끝의 이미 도착한 `go`가 action 없이 종료되면서 같은 decision의 legacy toy job이 끼어들었다.12.506초 P01 뒤12.706초 일반 walk,14.256초 동일 maraca pickup,15.406초 일반 toss가 기록돼 P02가 시작되지 못했다. 현재 bounded handoff는 진행 중 장면의 무동작 전환에서 같은 입력으로 최대1회만 재선택한다. 새 시계/RAF/성공 ACK를 만들지 않는다.
- 자율 toss/nudge가 높은 집 바닥에서 회수 불가한 화면 아래로 물건을 내보낼 수 있었다. 자율 실물 API만 현재 받침의 짧은 실제 포물선 착지·같은ID를 보장하고, 불가한 호는 같은 받침 내려놓기로 양보한다. 사람의 자유로운 drag/drop/throw와 물건을 임의로 없애지 않는 규칙은 유지한다.
- 집 안 몸 안전 바닥은 manual 지원이라 일반 마우스 후보에서 빠져 애교쟁이가 가까운 빈 곳도 찾지 못했다. authored pointer 장면만 실제 집 바닥 후보/왕복 경로를 사용한다. bodyOnly·다른 manual·control/hide는 허용하지 않는다. 버튼 위 포인터 무시와 직접 입력 우선권은 유지한다.
- native2 실제4개에서 X-T-return-time/T01로2개를 반납한 뒤 직전 장면 반복 방지가 남은 T01을 막았다. 실제 필수 반납할 도달 가능한 물건이 남고 다른 후보가 없을 때만 반복을 허용한다. 표정·선택 반납·생성 먼저인 장면·실패TTL/OFF는 예외가 아니다. 실제4-ID 모델에서 결합1회→T01 3회→0개→세면 경로/T07을 확인했다.
- 별도 실제 planner 재현에서 허기 `.5`·도달 가능 음식은1142.86ms walk를 반환했지만 director의 ready가 그 식사를 계속 선점했다. 기본 식사는 기존 실제 planner action으로 우선하고 첫 인사·장면 자체의 inspect/compare/eat·운반/소유 작업은 보존한다.9성격 준비 표현과10개 제한 조건, 원래 음식 장면4개를 포함한23개 단위 회귀를 추가했다.

## 검사 이력과 구분

- 초기 제품 전체 unit3539/305·전체 lint·production fixture build3 PASS. 첫 build는 새 pointer 소유자 TS narrowing, 한 typecheck는 새 unit optional ID, 새 native 작성 중 문법 오류로 실패했다가 교정했다. 마지막 제품 변경 전 결과이므로 최종 PASS 수에 재사용하지 않는다.
- native1은 build3 고정 중 결함을 확인하고 중단했다. G22 처음3건은 기본3100주소를 잘못 써 연결 거절, 음악1건은 dialog에 의해 inert된 집 region을 조회한 검사 오류, 두 native 후처리는 attach의 file stream byte 오류였다. 이들은 제품 행동 PASS가 아니다. 알려진 제품 수정 뒤 전체 선택 집합을 별도 native2로 다시 실행한다.
- native1 조건도 보강: 깔끔이 한 물건이 결합 장면에서 먼저 반납돼 대표 장면을 시험할 대상이 사라졌으므로4개를 준비한다. 애교 포인터는 TV 버튼 위 대신 실제 빈 곳을 사용한다. 보조는 결합36개와 구별해 원본 보조7개 중 하나를 요구한다. 마지막 optional이 대상 부재로 생략된 레시피는 마지막 필수 beat와 다음 장면 전환을 검사한다. 같은ID 실제 운반·상자 접촉·제거와 실제 음식 섭취/TV 효과 검사는 유지한다.
- 최종 실행 결과·실제9성격 행렬·독립 리뷰·공개 배포 증거는 아래 마감 시 기록한다.144개 모델 경로와144개 실제 브라우저 완료는 같은 검사가 아니다.
- native2는 build4에서 실제8성격 대표/원본보조·실물 반납을 확인했지만 tidy4 중2개 잔류를 재현했다. viewer/studio/실제 preview의9성격 즉시 선택27건은 통과했다. 알려진 tidy 반복 결함과 새 기본식사 수정 뒤 검사할 불필요한 나머지 중복 실행은 중단했다. 앞서 같은 config로 실행한 `--list`가 JSON reporter를 덮어쓴 탓에 그 aggregate를 결과 수로 사용하지 않으며 개별 passed JSON/명령 출력을 보존한다.
- build5: 전체3592단위/309파일 PASS, standalone typecheck/lint·production fixture build(metadata111 변경0) PASS, harness341 PASS. 새 meal unit의 readonly 배열 `.push` 타입 오류1개를 새 배열 대입으로 교정한 뒤 typecheck/build와 관련23개 단위 재실행 PASS. 제품 동작 조건은 바꾸지 않았다.
- build5 native-final의 자율활동 G22 검사는 기존 ‘임의 성격이10초 내12px 이동’ 가정으로 실패했다. 새 무선택 랜덤·집 안 시작에서는 제자리 표현도 유효하므로 실제 상자에서 꺼낸1개와 실제깔끔이 선택을 준비하고, 인간 setup 이벤트 수신 뒤 같은ID pickup/return과 추가 인간기록0을 검증하도록 보강했다. 다른 설정/양쪽 개발자 표시와 음악 mute 검사들은 정상이다. 이 후속 시험은 동일 제품 빌드의 별도 evidence로 남긴다.
- build5 native-final은30 PASS/6 FAIL. 위 G22 외 viewer 마지막 반납의40ms 관찰 프레임 race1개, 정리 선택 전 실제 배치 간격3개, 옛 소파 중앙→바닥 walk 경로 강제1개였다. 마지막 실제 반납 뒤의 관찰 프레임도 poll하고, 바닥 아래661px에서 떨어뜨려 회복 배치가 되던 준비를 실제 바닥 위620px·넓은4지점으로 교정했다. 소파의 실제 식사 planner는 음식 쪽 실제 floor로 직접 ballistic jump를 증명했으며 같은 음식 eat·발견은 이미 성공했다. 특정 중앙 waypoint 대신 자식 몸의 실제 도중 paint 위치·이동30px·측정된 바닥 도착을 요구한다. 전부 같은 제품 build5에서 별도7-case 회귀하며 실패 증거는 보존했다.

## 실제9성격 주·보조 결과

build5의9개 고유 native case는 모두PASS. 실제UI로 성격을 고르고 상자 shuffle bag에서 해당 소품을 꺼내는 방식이다. 아래 보조는 원본7개 중 실제 표본이며 X 결합 장면과 구분한다.144개 전체 native 완료로 확대하지 않는다.

| 성격 | 대표 실제 실행 | 원본 보조 실제 실행 | 별도 실물·가구 효과 |
|---|---|---|---|
| 재롱둥이 | P01·P02 | P11 | 원래 마라카스 carry236프레임→실제 상자→50ms 후 제거, P01→P02 직접 인계 |
| 탐험둥이 | C04 | C07 | 원래 만화경 carry61프레임→상자→제거, 실제 TV 비교; X-C-house 별도 |
| 애교쟁이 | A01·A03·A04 | A07 | 실제 빈 곳 포인터 접근·오리 carry191프레임→상자→제거 |
| 잠꾸러기 | S03 | S06 | 물고기 인형 carry28프레임→상자→제거, sleepOFF 기지개/소파 복귀; 실제 수면 주장은 제외 |
| 깔끔이 | T01·T05 | T07 | 네 실제ID 모두 반납→brush1850ms→T07, 정리 중 ask-petting0; X-T-return-time 별도 |
| 사고뭉치 | M01·M04 | M07 | 원래 공 carry63프레임→상자→제거, 실제 놀이; X-M-house/return-time 별도 |
| 먹보 | G05 | G06·G07·G12 | 실제 eat88프레임·요리TV/소파952프레임, 마지막 snack3은 보존; X-G-house 별도 |
| 집돌이 | H01·H05 | H12 | 원래 기차를 실제 상자에 반납, 소파/바닥/창가 연결; H06 반납 beat를 전체H06 완료로 세지 않음 |
| 둥글이 | B01 | B07 | 원래 공의 실제 carry→상자→제거, 일회 인사 뒤 바닥 복귀 |

9건 모두 runtime errors/예상 밖 요청/sleep0. 실제 반납은8성격에서 원ID carry→실제 입구20px 이내→후속 프레임 제거로 확인했고, 먹보는 실제 섭취/TV 가지를 검증했다. root와 독립 agent가 JSON·PNG를 검수했다. 출발 도형/clock/brain/RNG/성공 ACK 주입은 없다. 초기 synthetic care/학습 fixture와 실제로 얻은 발견은 구분한다.

## 먼 왕복에서 추가 발견한 예산 소진

build5 placement 회귀7건은4 PASS/3 FAIL이었다. 자율행동 G22·viewer/studio 네 장난감+실제 brush·소파 실제 식사접근은 통과했다. 밖3건은 준비를 정상화한 뒤 성격 자체의 장거리 결함을 드러냈다. `.05/.5` 모두 처음 실물 pickup3.1초, 세 실제ID 반납12.11/30.36/60.71초. 네 번째는79.26초 집고91.86초 x770까지 운반했으나 seek+return 공용18이동 예산을 다 써 내려놓고93.86초 실패→ready9.2초→같은ID 재집기106.46초→집 도착113.11초였다.110초 완료 제한에1개가 남았다. 단순히 대기시간을 늘려 성공으로 만들지 않았다.

장난감 tidy job은 이미 증명한 approach+return의 합계 step수+4(최소18·최대54)와 기존 실제 이동시간·유한 여유(30~60초)를 최초 한 번 배정한다. 재계산/ACK로 예산을 갱신하지 않으며 director7.5초 무진행/60초·실패TTL·고정ID·OFF·12hop/200node는 유지한다. 실제 toy model/director/jobs에서18단계·30초 초과 왕복도 중간drop/ready/다른ID 없이 상자 접촉·stash까지 검사했다.

음식도 실제10개 받침 왕복에서 pick 뒤31번째decision에 기존32예산이 끝나 put 전 중단되는 같은 결함을 단위 호스트로 재현했다. 실제 같은ID pick ACK에서만 기존45초/32decision을 운반 단계에 새로 배정하고 stale/중복 ACK는 stage+ID guard로 연장하지 않는다. 실제 경로/소유권/도착 ACK 프로토콜 검사이며 DOM/음식 물리 성공 주장은 아니다. 다섯 새 회귀를 포함한 household 관련29개 PASS. 두 수정은 독립 상호 검수했고 최종 build6 전체 검사를 아래에서 새로 기록한다.

build6 준비 전체 단위는 두 번3606 PASS/기존 agent-memory stdin hook1개의5초 timeout(5698/5091ms)이었다. 이 검사의 timeout을 늘리거나 소스를 바꾸지 않았다. 격리18개 PASS, 나머지310파일3589개를 명시적 Node Vitest CLI/maxWorkers4로 분리해PASS하여 현 제품의 총311파일3607개 고유 검사를 통과했다. Windows npm 인자 전달이 일부 runner 옵션을 소비해 해당 명령의 실제 출력으로 실행 범위를 확인했다. 한 번의 전체aggregate PASS로 표기하지 않는다. 별도 전체 type/lint·harness341 PASS. build6/native-release의 새 결과는 아래 마감한다.

## 최종 빌드와 실제 회귀

build6 production fixture·metadata111 변경0 PASS. native-release36건은35 PASS/1 관찰 범위 FAIL이었다. hungry gourmet가 첫 음식을 실제로 먹은 뒤 다음 정상 식사에서 두 번째 음식을 꺼내므로, 전체 trace의 ID 수를1로 고정한 검사가 실패했다. 실제 첫 ID의 마지막 섭취·제거 프레임 이전까지 한 음식이라는 계약으로 범위를 교정했다. 이후 정상 식사 생성을 막거나 첫 음식의 eat/제거 검사를 완화하지 않았다.

build6의9성격 실제 주·원본 보조 모두 PASS. 재롱둥이 P01/P02·P11, 탐험둥이 C04·C07, 애교쟁이 A01/A03/A04·A07, 잠꾸러기 S03·S06, 깔끔이 T01/T05·T07, 사고뭉치 M01/M04·M07, 먹보 G05·G06/G07/G12, 집돌이 H01/H05·H12, 둥글이 B01·B07을 실제UI 선택 뒤 수행했다.8성격의 원래 장난감은 실제 carry→입구20px 이내→후속50ms 프레임 부재로 확인했다. 깔끔이는4개 반납 후 brush1933ms→T07, 먹보는 실제 eat89프레임·요리TV/소파를 확인했다. sleepOFF이므로 잠꾸러기의 실제 수면 완료로 표기하지 않는다. 집돌이 H06 반납 beat와 전체H06 완료도 구분한다. root와 독립 agent가 JSON·PNG를 재검수했다.

build6 집 밖3조건도 PASS. 허기 `.05/.5`의 실제 넓게 분산한 네 물건에서 첫 pickup3.01/3.11초, 전부 반납99.06/98.96초였다. actual card-95-top에서 출발한 경우 첫 pickup7.958초, 반납 접촉11.46/40.66/71.01/109.36초 후50ms 부재였다. 세 조건 모두 각 원ID의 첫 pickup→stash 사이 중간 noncarried/ready/재집기0. 기존 실패의18단계 drop→9초 ready→재집기와 구분된다. 마지막 연속 운반은19.5/19.65초로 정상 진행이며 ‘10초 이내 모든 정리 완료’라는 의미는 아니다. errors/예상 밖 요청0. 증거는 `.scratch-pw/companion-140/native-release-evidence/140-*.json/.png`에 보존했다.

독립 최종 검수에서 새 중간 허기 기본 식사가 curiosity intent를 계산만 하고 원래 식사로 덮는 회귀를 발견했다. 새 양보 meal에서만 계산된 실제 관찰 intent를 사용하고 긴급·authored·운반·기존 owner 가지는 유지했다. 관련16파일445단위, 전체 typecheck/lint, production fixture build7 PASS. build7은 이 가지를 대상으로 식사·tidy/gourmet·수동15초 가구/OFF/G22의13개 native를 별도로 수행한다. build6의 음식 없는9성격·밖3조건에서는 새 flag가 false여서 같은 intent를 유지하지만, 이를 build7 전체36건 재실행으로 표기하지 않는다.

build7 native-meal-release는13/13 PASS(2.0분). 실제 tidy4개 반납·세면/주·보조, gourmet 주·보조, hungry dispenser의 첫 음식 실제 섭취, nonfavorite bin 전달·favorite pantry 보관·중간 허기 식사/보관·배고픈 소파→실제 이동/섭취/발견, 수동15초 TV/전등/커튼, roamOFF/reduced/gfxOFF, 자동 정리의 추가 인간 활동0을 재검사했다. 새 unknown-food 양성은 초기 cat/tidy/허기 `.5`에서 첫 실제 감자는 즉시 수락했고 새 문서의 청포도는 decoded/visible 관찰 동작2프레임 이상→같은 snack-1 eat→실제 제거를 확인했다. 실제 랜덤 추첨을 바꾸지 않았다. errors/예상 밖 요청0. root는 tidy 완료 PNG와 양성 JSON을 직접 읽었다. 증거: `.scratch-pw/companion-140/native-meal-release-report.json`, `native-meal-release-evidence/`, `native-meal-release-household/`, `native-meal-release-activity*`.

최신 검증 범위는 build6의35개 통과 조건과 build7의13개 영향 범위 재실행이다. 실패했던 첫 식사 관찰 범위1건의 재검증과 새 미경험 음식 양성1건을 포함해 고유 UI 조건37개를 다루며, 한 빌드에서37건 aggregate PASS라는 표현은 쓰지 않는다. 전체 단위3607개는 build6의 분할 실행, 최신 관련445개는 build7 회귀다. 마지막 문서 harness341 PASS. 실제144개 완료나 실로그인/RLS/OBS 판정으로 확대하지 않는다.

독립 agent 최종 build7 QA도 차단0. report13 expected/unexpected·flaky·skipped0. 청포도 snack-1은 실제 visible+decoded 관찰64프레임(4.508~8.258초)→같은ID eat44프레임(8.608~10.758초)→10.808초 제거였다. 깔끔이 toy7~10은 네ID 모두 중간drop0·상자 접촉·제거, T01/T05·원본T07과 brush1767ms를 재확인했다. 먹보 G05·G06/G07/G12, 실제 밥통 첫 meal44프레임/7.001초 제거·수동feed0, household 실제 효과/OFF/가구·G22 모두 재검수했다. root는 agent의 제품 변경을 독립 검토했고 agent는 root의 meal/household/최종 intent 변경과 역할/경계/KST·G22를 별도 검토했다.

## 출시 준비

공용 client만 수정했다. 서버 public DTO/owner_private/Google+passcode/권한·KST·DB 경계 변경0. G22 자동 행동 제외와 양쪽 개발자 활동표/최저 사용 기능은 build6 native에서 검증했고 build7 자동 실물 정리의 추가 사람 클릭0도 재확인했다. 새 의도·경로 cache·실물ID·학습 성향을 운영 로그나 API에 추가하지 않았다. 보호 사용자 제작기록 SHA256 `E980005102457E2A02AE318FF7665596E7170D0BFB34A328F64A6EC292C5990B` 유지. 제품·회귀·이번 문서만 정확한 경로로 stage한다. 기존 Git 설정은 바꾸지 않고 이번 commit의 author/committer만 검증된 공개 GitHub noreply로 설정한다. 이전 커밋/이력은 수정하지 않는다.

기존 main push 배포 승인 범위로 제품 릴리스를 진행한다. Vercel 성공 뒤 빈 익명 context에서 실제 전체SHA·정적 chunk digest와 실제 tidy4-ID carry→상자 접촉→부재·수동 기억·책48·전등/TV·다크 요일을 확인한다. 모든 운영 mutation/실제 live-state GET/분석 SDK 실행을 차단한다. 출시 후 문서 결과만 로컬에서 마감하여 문서 단독 재배포는 만들지 않는다.

## 출시 확인

제품 `55e150b99eef6f4354aced76a91a7a0435428f31` main push, Vercel success를2026-10-20 02:29 KST에 확인했다. 새 commit author/committer는 둘 다 검증된 공개 GitHub noreply이며 보호 제작기록 원래 해시 유지. 원격 quality39294277761은02:30 KST in_progress였으므로 성공으로 기록하지 않는다.

02:30~02:31 KST 실제 공개 배포의40자리 SHA·정적 chunk 수신10회 SHA256 일치PASS. 이는 서로 다른10개 chunk라는 뜻이 아니라 reload마다 받은 같은 증명 chunk의10회 검사다. 초기 cookies/origins/localStorage 빈 익명 문서, tastes/collection null에서 시작했고 초기 care/성격/RNG/clock/엔진 상태를 주입하지 않았다. 무선택6문서의 성격은 탐험둥이/애교쟁이/탐험둥이/사고뭉치/먹보/재롱둥이(5종). 실제 radio로 재롱둥이 선택→3회 reload 전부 유지, 책48×48px, decoded 대표 동작·전등 기억·수동TV·다크 요일 cal-head 일치PASS.

같은 공개 context의 실제 깔끔이 선택과 네 번 상자 조작으로 얻은 toy-1~4도 각각 실제 연속carry→실제 상자 입구20px 이내→후속 프레임 부재로 전부PASS. 다른ID 대체·직접 삭제/성공 ACK는 쓰지 않았다. root가 완료 PNG와 실제 다크 요일 PNG를 확인했다. 오류0/예상 밖 요청0/운영 mutation0/live-state GET0/private-manifest0. 알려진 익명 저장하트 read POST10회도 차단했고 분석 SDK는 실행하지 않았다. at-run checker/공개 SHA 증명/actual-tidy140 JSON·캡처/native-production-proof는 `.scratch-pw/companion-140/production/55e150b99eef6f4354aced76a91a7a0435428f31/`에 보존한다. 제품은 배포 확인됐고 사후 증거 문서만 로컬 마감한다. 실로그인/RLS/OBS/전문 아트 판정은 이 검증 범위가 아니다.

독립 agent도 운영 전체SHA literal·실제 수신 JS SHA256·빈 초기저장과 네 same-ID 반납/PNG를 재검수해 차단0. 각 ID는28/38/51/63 carried프레임→실제 입구 접촉→각50ms 뒤 제거였고 중간drop0. 네트워크는 모든 nonGET abort·실제 soop-live GET network전 fulfill·분석 SDK20건 차단을 checker와 결과 양쪽에서 확인했다. 원격 quality39294277761은02:32 KST에도 in_progress로, 배포/로컬검수 성공과 구분해 남긴다. 마감 harness341 PASS, 제품 추가 편집0·보호 제작기록 원래 해시 유지.

141 작업 중2026-10-20 KST 재조회: 원격 quality39294277761 completed/success 확인. 위 당시 pending 기록은 당시 관찰로 유지한다.
