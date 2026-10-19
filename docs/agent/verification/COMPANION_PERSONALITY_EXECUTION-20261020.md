# 빅타민 성격 실행 경로 감사140

2026-10-20 KST. 독립 검토 범위:9성격의 대표45·보조63·결합36, 총144개 실행 레시피의 조건→선택→명령→실제 효과→종료. 원본은 [136 보고서](../reports/REPORT-20261019-136-personality-scenes.html), 기존 구현 설명은 [137 대응표](COMPANION_PERSONALITY_SCENES-20261019.md), 현재 재현·출시 결과는 [140 계획](../plans/PLAN-20261020-140-personality-execution-audit.md)에 둔다. 이 문서는144개를 브라우저에서 전부 완료했다는 증거가 아니다.

## 확인 수준과 과거 검사 사각지대

- **정적144행**: 원본 의미·현재 카탈로그·디렉터 guard/대상 고정·jobs 위임·실물 planner·렌더러 ACK와 후속을 대조했다.9성격마다 대표5·보조7·결합4가 존재한다. 아래 각 행은 실행 연결을 설명하며 성공 횟수를 뜻하지 않는다.
- **프로토콜 모델144행**: director137 matrix는 조건·순서·제한·완료 ACK 계약을 검사한다. 시험 호스트가 delegate 성공 ACK를 공급하므로 실제 장난감 물리·상자 접촉·브라우저 가시 완료의 증거로 확대하지 않는다.
- **실물 모델 회귀**: admission140/jobs137은 실제 `createCompanionToys`·planner·jobs·director를 함께 사용한다. 몸 이동은 반환된 유효 받침의 경로 끝점을 소비하며, 반납은 같은 carried ID의 실제 상자 입구 전달 뒤 stash 성공으로만 ACK한다. DOM·그림의 사람 인식·실기기 성능은 증명하지 않는다.
- **과거 브라우저137**: 깔끔이를 집 바닥에 둔 뒤 상자에서 꺼낸 집 안 장난감, 허기 `.05`에서4개 반납을 검증했다. 달력 받침 위 배우→집 밖 패널 바닥의 물체와 중간 허기 `.35~.65`는 그 사례에 포함되지 않았다. 짧은 대표 표정이 보였다는 검사는 실제 정리 완료와 다르다.
- **과거 jobs 호스트**: 기본 허기 `.1`, 같은 높이·범위의 집/바깥 받침 fixture였다. 이름이 `outside`인 받침만으로 실제 화면의 긴 우회·날짜 받침·집 밖 운반을 검증했다고 볼 수 없다.
- **현재 실제 브라우저**: 루트가 고정 production build에서 사용자의 실제 외부 장난감 배치를 재현하고9성격 주·보조 행렬을 수행한다. 결과·증거·실행한 고유 사례 수는140 계획에 별도 기록한다. 여기의 정적/모델 PASS를 미실행 native 장면으로 늘리지 않는다.

## 발견한 결함과 수정

| 결함 | 원인과 영향 | 현재 수정·회귀 |
|---|---|---|
| 중간 허기의 정리 공백 | tidy toy planner가 허기 `.35` 이상을 거절하고 보통 음식 공급은 `.65`부터 시작해, 음식0일 때 정리가 사라졌다. authored return도 임시 tidy 설정을 써9성격의 소품 반납에 영향을 줬다. | `.8`의 긴급 허기·기력 `.25`·실제 식사 소유권을 유지하며 공백 제거. `.35/.4/.5/.64/.79` 회귀,9성격 실제 소품 동일 ID 반납 회귀. |
| 갈 수 없는 음식이 모든 장난감 차단 | 음식 배열 존재만으로 식사 우선권을 줬다. 예산이 끝난 foodGoal/intention도 소유권으로 남았다. | 현재 살아 있는 소유권만 보존. 최대8개 음식의 실제 식사 경로를 증명해 접근 불가 음식은 양보. feedingOFF·허기·기력 우선권 별도 회귀. |
| 경로 검사 반복 비용 | 매 decision의 새 world 객체와 notice 반복에서 최대8개 음식 경로를 다시 찾을 수 있었다. | 기존 활성 시계6초·최대8항목 cache. 실제 출발 좌표/받침, jump, 음식 ID/좌표/받침, 전체 받침 기하/종류/bodyOnly/manualOnly를 key로 사용해 바뀌면 즉시 재검사. 거절 가능한 notice cheap guard를 먼저 검사. 새 시계/타이머 없음. |
| 가장 가까운 불가 물체가 나머지를 가림 | 디렉터가 경로 증명 전에 가까운 ID를 고정해 planner의 대체 가능 물체 탐색을 막았다. | 미예약 후보 최대4개에서 접근·필요한 상자 귀환 양쪽을 증명한 뒤 고정. 미경험·선호 종류·집 밖 최애라는 원본 선택 의미 보존. 예약 뒤 실종은 다른 ID/생성으로 대체하지 않음. |
| 깔끔이의 애교 fallback | legacy fallback에 ask-petting이 있었고 pettingOFF 필터가 없었다. 허용 clip1개일 때 직전 동작 제외로 undefined가 될 수도 있었다. | 깔끔이는 groom/bow. 준비·fallback·authored pose가 같은 petting/jump 허용 필터를 사용하며 유효 clip만 반환. 준비 표현을 실물 정리 성공으로 기록하지 않음. |
| T07 몸단장이 실제 정리를 선점 | 실제 정리 가능한 물건이 있어도 free 몸단장을 선택했다. | 접근·귀환 가능한 장난감/집 안 보관 가능한 외부 음식/식사 소유권이 있으면 T07 제외. 분리 보관된 음식은 다시 정리할 일로 계산하지 않음. |
| 포인터 조건 누락·일회 접근 추적화 | 일부 go(pointer) 장면이 pettingOFF/불안정 포인터를 피하지 않았고 A07/B07의 한 번 접근이 포인터를 계속 따라갔다. | 모든 go(pointer) 장면에 공통 pettingON·포인터·안정200ms guard. A07/B07의 받침+비율 목적지는 고정하고 레이아웃만 따라감. A01은 원래의 실시간 추적 유지. |
| 짧은 밀기가 던지기로 연결 | P07/H06/C06이 일반 play를 통해 toss로 바뀌었다. | 실제 nudge 효과와 같은 ID의 지지면 물리 재사용. P07/H06 real-model 회귀, 나머지 source mapping/실제 실행은 루트 검증에 포함. |
| B04 한 개 정리 후 창가 취소 | 최대2개 반납 명령에서 첫 stash 뒤 두 번째 대상이 없으면 mandatory 실패했다. | 실제 count>0·새 ID 미예약·도달 가능한 다음 대상 없음에 한해서 창가 단계로 진행. 둘째 ID가 이미 예약된 뒤 사용자 held/removed이면 유한 취소·추가 성공0. 실제1개 반납→커튼 열기→창가 감상 회귀. |
| 음악 조건의 내용 소실 | 이벤트만 전달해 잔잔함/경쾌함·듣기 친숙함이 실제 음악 상태와 분리됐다. | 현재 허용된 실제 라디오/악기 소스와 mood를 전달. X-S calm/X-M lively, H10/X-H learnON+실제 mood3회 경험을 요구. 소리 중지/조건 소멸은 성공 없이 취소. 음식·장난감 발견을 음악 친숙함으로 사용하지 않음. |
| 장면 마지막 이동 뒤 legacy 선점 | P01 마지막 go가 실제 도착해 완료되는 호출은 proposal 없이 끝났다. 같은 decision에서 legacy planner가 마라카스를 pick/toss하고, 그 소유권이 다음 P02 입장을 막았다. native1의12.506초 P01 종료→12.706초 scene 없는 walk→14.256초 원ID pick→15.406초 toss가 이 순서를 보였다. | 공용 `nextCompanionPersonalityScene`이 기존 의도를 처리한 actionless 전환에서 같은 snapshot으로 최대1회 더 선택한다. 최대2call·새 RAF/시계0·실제 ACK 불변. 순수 full-catalog 재현에서 P01 도착→P02의 동일 마라카스 inspect로 바로 인계한다. |
| 자율 toss/nudge가 높은 집 밖으로 유실 | 자율 put(toss)의 고정 ±160 속도와 nudge의 ±120 속도는 집의 짧은 실제 바닥 너비를 고려하지 않았다. 소품이 아래 viewport로 떨어지면 배우의 귀환 경로가 없고 다른 물건을 꺼내는 루프가 생길 수 있었다. | 실제 현재 받침/같은 높이 집 접지 후보의 첫 물리 접촉과 몸48px 회수 범위를 먼저 증명한다. 같은 ID의 짧은 포물선·기존 유한 flight 예약으로 착지하고, 불가능하면 같은 받침에 gentle 유지한다. 유효 받침이 없으면 carried ID를 보존하고 실패한다. 사용자 drop/throw의 자유 궤적은 그대로다. controller의5번째 `asPlay`는 기존 경험 pending 용도이며 삭제·무의미 처리하지 않는다. |
| 집 안 포인터 목적지 후보 제외 | 일반 포인터 helper는 모든 manual 받침을 후보에서 제외했다. manual 출발을 항상 거절하는 것은 아니지만, 집 안 blank나 집 아래 포인터의 가장 가까운 body-safe home-floor가 빠져 A01 같은 대표 장면이 시작되지 않았다. | authored pointer 대상 선택에 한해서 실제 non-bodyOnly `companion-home-floor` 받침을 우선 보존·통행 허용한다. 다른 manual/control/bodyOnly와 일반 reactive roaming 정책은 그대로다. 실제 이동은 원본 geometry의 공용 toy route로 다시 증명한다. pettingOFF·안정 포인터 guard와 A07/B07 일회 목적지 고정도 유지한다. |
| 반복 방지가 남은 정리까지 차단 | native2에서 X-T-return-time/T01으로 두 개를 치운 뒤, 남은 두 개를 처리할 유일한 T01이 직전 완료와 같아 후보에서 빠졌다. T07도 실제 작업 때문에 제외돼 ready 표정만 남았다. | 다른 유효 장면이 없고 실제 접근·귀환 가능한 물건이 남은 필수 반납 장면만 재선택한다. 종류·고정ID·허기·기력·소유권·실패TTL은 유지하며 표정/optional-only/spawn-first는 예외가 아니다. 실제4-ID 모델에서 결합1회→T01 3회→0개→세면 경로/T07까지 회귀. |
| 준비 장면이 중간 허기의 기본 식사를 차단 | 허기 `.5`·실제 reachable food에서 getFoodAction은 식사 경로를 반환하지만, director의 ready/비식사 proposal이 우선해 eat까지 못 갔다. | 기존 실제 식사 planner의 유효 action만 우선한다. 첫 인사·계획 중 inspect/compare/eat·운반 물건·이미 소유한 작업은 보존한다.9성격 ready와 OFF/포만/경로불가/소유권 회귀. 장면 취소를 식사 성공으로 세지 않는다. |
| 장난감의 먼 왕복에서 운반 예산 소진 | 실제 집 밖 네 장난감 회귀에서 마지막 ID를 집고 귀환 중 seek+return 공용18이동 한도를 다 써 내려놓았다. 실패TTL로 ready9.2초 뒤 다시 집었다. | 증명된 접근·귀환 route step수와 실제 이동시간을 최초1회 사용해18~54이동/30~60초를 배정한다. replan/ACK로 재충전하지 않고12hop·200node/고정ID/OFF·director7.5초·60초를 보존한다. 실제 model+jobs+director의18단계/30초 초과 same-ID 반납 회귀. |
| 음식의 접근이 운반 예산까지 소진 | 실제10받침의 pantry 왕복 호스트가 pick 후31번째decision에서32한도를 다 써 put 전 중단됐다. | 실제 같은ID pick ACK에서만 기존45초/32decision을 운반에 새로 배정. serial·stage·ID guard로 중복/늦은 ACK가 기한을 연장하거나 운반을 취소하지 않음. 재경로/먹이OFF·기한·집 실종은 기존 실패. 실물 DOM과 구분한 경로·ACK 회귀. |
| 기본 식사 양보 뒤 첫 음식 관찰 누락 | 새 기본 식사 우선권이 기존 curiosity planner의 실제 sniff/play/look 결과를 계산한 뒤 원래 식사 intent를 골랐다. 경험만 쌓이고 화면에는 관찰이 표시되지 않을 수 있었다. | 새 중간 허기 기본 식사에만 계산된 관찰 intent를 실제 실행한다. 긴급 식사·authored 식사·운반/기존 소유권은 원래 선택을 유지한다. 실제 미경험 음식 관찰 표시→같은 ID 섭취 native 회귀로 확인하며 RNG/성공 ACK를 주입하지 않는다. |

### native1에서 드러난 추가 근거와 검사의 범위

실패 원본은 `.scratch-pw/companion-140/native-1-evidence/140-performer-native-primary-and-secondary-sequences-finish-with-real-object-or-room-effects.json`에 보존한다. 소품은 실제 shuffle bag에서 나온 `toy-5`였고 초기 배우/소품 모두 집 바닥에 있었다. P01·P11 표정/마지막 단계만 관찰된 것을 P02 소품 공연·반납 성공으로 확대하지 않는다. 실패 뒤 다른 물건 `toy-6`이 생긴 것도 원래 소품의 완료가 아니다.

새 native 조건은 깔끔이 실물4개, 애교쟁이의 실제 버튼 아닌 blank 포인터, 명시된 optional 뒤의 required 마지막 단계, 원본 보조7개와 결합4개 구분으로 보강했다.131 household 회귀의 성격도 출처 불명의 저장 personality 값에 기대지 않고 실제 설정 radio로 깔끔이를 선택한다. 초기 care/taste fixture와 실제 선택을 구분한다. 운영 쓰기 차단·허용 font 제한은 유지한다.

`finishedRecipes`의 마지막 required beat 관찰+후속 scene만으로는 director 내부의 모든 성공 ACK를 증명하지 못한다. 최신 native 판정은 pose/watch의 실제 재생80%-80ms, sleepOFF 대체 stretch1초, wash 칫솔500ms, terminal return의 carried→실제 상자 접촉→제거, terminal go의 실제 이동·집 받침을 추가 요구한다. 음식 섭취/TV 상태와 원래 같은ID 운반은 별도 assertion으로 계속 확인한다.144 모델과 native 장면 완료를 구분하며 최신 브라우저 결과는140 계획을 따른다.

## 공통 실행·완료 계약

1. 마스터OFF·roamOFF·숨김/비활성 정책·감소모션/gfxOFF·직접 들기·실제 조작·보통 모달/공연이 먼저다. 불안정하거나 사라진 받침에서 대표 행동을 강제하지 않는다. jumpOFF는 같은 받침 경로를 막지 않으며 다른 높이에 순간 이동하는 권한도 만들지 않는다.
2. 준비 `entry-*`, 조건 부재의 `ready-*`, 보조 표정은 실제 장면 완료와 구분한다. 살아 있는 식사·운반 소유자를 애교/마우스 접근으로 덮어쓰지 않는다. runtime 긴급 식사는 `.78`, 정리 금지는 `.8`부터다. `.35` 이상에서 기본 실제 식사 경로가 있으면 비식사 준비 장면이 양보한다. 기력 `.25` 미만에서 정리 출장을 강요하지 않는다.
3. 미예약 대상은 종류·미경험·최애·실제 경로를 함께 만족해야 한다. 예약 ID는 접근→들기→운반→상자/음식 종착 효과까지 유지한다. 사용자 선점/삭제·경로 소실·상태 변경은 취소 또는 명시된 optional 생략이며 다른 물체/새 생성으로 완료하지 않는다.
4. `go`는 실제 받침과 목적지 도착, `pose/watch`는 유한 실제 동작 완료를 사용한다. 이동 메타의 시간 경과는 물건 효과 ACK가 아니다. `toy return`은 실제 상자 입구 전달→같은 ID stash, `food tidy`는 실제 집 빈 자리 또는 허용된 쓰레기통 전달, `eat`는 실제 섭취 ID 제거가 필요하다.
5. TV/전등/커튼은 기존 공용 상태 owner의 실제 승인만 사용한다. 수동15초 우선권을 침범하지 않는다. 패드 씻기는 실제 패드 위치와 등록 입 접촉500ms가 필요하다. 선택적 가지를 건너뛴 것을 실제 효과로 기록하지 않는다.
6. 무진행7.5 활성 초·의도 전체60초·실패 후8초 보류·직전/최근3장면 제외가 유한성을 유지한다. 실제 남은 필수 반납 작업만 위의 제한된 반복 예외를 쓴다. 실패는 완료 목록에 넣지 않는다. B04의 최대2개 한도는 실제 stash 횟수만 센다.
7. 실제 도착/이미 만족한 가구 상태처럼 proposal이 없는 전환도 같은 유한 decision 안에서 최대1회 더 authored 선택에 양보한다. 이 재선택은 기존 실제 음식·장난감 소유자를 새로 선점하는 권한이나 성공 ACK를 만들지 않는다. 자율 작은 물건의 짧은 arc는 실제 받침의 이동을 같은 flight 시간으로 따라가며, 숨김 pause 중 시간을 건너뛰지 않는다.

## 역할·정보 경계·활동 감사

- 이번 변경은 공용 client ambient 엔진이다. public DTO/서버 로더/인증/Google·passcode/권한/RLS·DB 쓰기·날짜 함수를 바꾸지 않는다. 계절/시간은 기존 표시 월과 KST 환경을 받는다. 역할은 owner/developer/viewer 그대로다.
- 새 음식/장난감/포인터/경로 cache·음악 mood는 내부 실행 상태다. public API/HTML 메타데이터/작업 신호/활동 로그로 보내지 않는다. 새 localStorage 키·타이머·분석 이벤트를 추가하지 않는다. 기존 학습OFF는 새 회상/친숙함을 사용하지 않는다.
- 성격·밥통·상자·라디오·TV·전등·커튼의 기존 사람이 누른 고정 target capture는 유지한다. 자동 nudge/정리/마우스 접근/음악 반응을 사람 활동으로 합성하지 않는다. 양쪽 개발자 활동표/최저 사용 기능 UI의 기존 표시 검사는 루트 native 회귀 범위다. 자동 장면 ID·음식/장난감 ID·배운 성향은 G22 수집에서 제외한다.
- 공개 일반 편집 응원은 기존 coarse 상태/성공 kind만 사용한다. 제목·본문·비공개·teaser 내용/이력을 음악·성격 조건에 섞지 않는다.

## 수행한 좁은 검사

- 01:09 KST: admission140/director137/jobs137/toys122/toys121/catalog137,6파일335개 PASS. 이후 B04와 음악 연결이 추가됐으므로 이 수를 최신 전체 결과로 쓰지 않는다.
- 01:14 KST: B04 실물 회귀와 음악 양성 fixture를 반영한 admission140/jobs137/director137/catalog137,4파일267개 PASS. 실행은 unit clock만 사용했다.
- 01:25~01:26 KST: safe-toss140/toys121/toys122/jobs137/admission140,5파일146개 PASS. 새11개는 양쪽 끝 toss/nudge·실제 arc·같은 ID·회수 경로·coarse/fine tick·받침 이동·hidden pause·blocker/유효하지 않은 source·사용자 throw 원래 수치의 보존을 확인한다. 이 변경의 scoped lint PASS, 소유파일+imports TypeScript 진단0.
- 01:28 KST: handoff140/safe-toss140,2파일14개 PASS. 실제 P01 마지막 이동→동일 마라카스 P02 인계,2call 상한/OFF·입력 불변, 집 안 blank 포인터의 안전 이동과 다른 manual/bodyOnly 제외를 추가 확인했다.
- 소유3개 제품파일 및2개 단위파일 scoped lint PASS. 타입검사 최초 전체 시도는 루트가 작성 중이던 native spec의 문법 오류로 중단됐고, 소유파일+imports를 대상으로 한 TypeScript program은 진단0이었다. 최신 전체 lint/type/build/unit/harness와 실제 브라우저는 루트140 계획의 실행 결과를 따른다.

## 실제 브라우저에서 별도로 필요한 확인

- 9성격 주 행동1개 이상과 보조 행동1개 이상을 실제 UI 조건으로 시작하고 실제 효과/종료까지 확인한다. viewer/studio/preview 공용 동작과9성격 선택 즉시 준비 표현을 각각 구분한다. seed/장면 ID 주입·fake clock·직접 성공 콜백을 사용하지 않는다.
- 상자에서 실제 꺼낸 물건을 집 밖 패널 바닥으로 drag하고 배우는 날짜 받침 위에 둔다. 허기 `.1/.35/.5/.64/.65/.79/.8`, 기력 `.24/.25`, 음식0/도달 가능/도달 불가를 나눠 첫 실제 pickup·운반·same-ID 상자 접촉·반납을 본다.
- 가장 가까운 물체의 경로가 막혔어도 다른 도달 가능한 물체를 처리해야 한다. 접근 가능/귀환 불가, 고정 ID를 사용자가 들거나 없앤 경우는 성공으로 바뀌지 않아야 한다.4장난감/8음식 상한과 새 물체 대체0을 확인한다.
- jumpOFF 같은 바닥 정리, 진짜 다른 높이의 유한 취소, pettingOFF·feedingOFF·sleepOFF·roamOFF·마스터OFF·activeWhileVisible/숨김·감소모션을 각각 확인한다. 마우스를 가까이 둔 것을 정리 실패의 정상 근거로 삼지 않는다.
- TV·전등·커튼의 실제 상태와 수동15초 우선권, 음악 소리 중지/잔잔함·경쾌함/실제 듣기 경험, 패드 입·칫솔500ms 가시 접촉, 음식 실섭취/보관/쓰레기통 전달을 확인한다. 배지 근처 화면 밖 제거는 정리 성공으로 인정하지 않는다.
- 실제 공개 편집·서버 성공/실패 ACK와 두 개발자 활동표를 검증하되 모든 쓰기는 fixture에서 차단/안전 응답한다. 실제 운영 DB/실명·제목 읽기·운영 mutation·live-state GET은 사용하지 않는다.

## 현재144행 조건·명령·완료 연결

아래 `+` 조건은 AND다. 공통 guard와 위 계약이 모든 행에 적용된다. `선택`은 현재 사건/실물/학습 조건이 유효한 후보이며, 경로 실패 시 강제 성공하지 않는다. 원본 대표·보조·결합의 순서를 유지했다. 순서의 `?`는 명시된 optional이다. 완료 열은 필요한 실제 owner/ACK의 종류이며 실행 결과 배지가 아니다.

### 재롱둥이 (performer)

| ID·종류 | 원본 장면 | 현재 조건·선택 | 실제 명령 순서 | 효과·종료 연결 |
|---|---|---|---|---|
| P01 · 대표 | [돌아온 사람을 위한 작은 개막식](../reports/REPORT-20261019-136-personality-scenes.html#P01) | arrival | 표현:cheer-rehearsal → 표현:celebrate → 표현:bow → 이동:floor | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| P02 · 대표 | [마라카스 한 개로 여는 소품 무대](../reports/REPORT-20261019-136-personality-scenes.html#P02) | toy | 장난감:inspect(maraca,tambourine) → 이동:floor → 장난감:play(maraca,tambourine) → 표현:cheer-rehearsal → 표현:bow → 장난감:return(maraca,tambourine) | 실물 근접/필요한 pick ACK; 실제 받침·목적지 도착; 같은 ID 실제 play 효과 ACK; 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| P03 · 대표 | [음악 한 구절을 받는 짧은 응원](../reports/REPORT-20261019-136-personality-scenes.html#P03) | music | 표현:cheer-rehearsal → 표현:celebrate → 표현:bow | 실제 유한 표현/감상 완료 |
| P04 · 대표 | [잘 끝난 공개 작업에 축하 한 번](../reports/REPORT-20261019-136-personality-scenes.html#P04) | work | 표현:cheer-rehearsal → 표현:celebrate → 표현:bow → 이동:floor | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| P05 · 대표 | [앵콜은 딱 한 번, 다른 재롱으로](../reports/REPORT-20261019-136-personality-scenes.html#P05) | pet; 최근 실제 공연 완료 뒤 pet | 표현:celebrate → 표현:bow → 표현:groom | 실제 유한 표현/감상 완료 |
| P06 · 보조 | [공과 맞춰 통통](../reports/REPORT-20261019-136-personality-scenes.html#P06) | toy | 장난감:toss(ball) → 감상:0.7초 → 이동:toy → 표현:celebrate → 표현:bow | 같은 ID toss ACK·실제 낙하; 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| P07 · 보조 | [기차 옆 행진](../reports/REPORT-20261019-136-personality-scenes.html#P07) | toy | 장난감:nudge(train) → 이동:toy → 표현:bow | 같은 ID nudge ACK; 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| P08 · 보조 | [별 지팡이 소개](../reports/REPORT-20261019-136-personality-scenes.html#P08) | toy | 장난감:inspect(star-wand) → 표현:cheer-rehearsal → 표현:bow → 장난감:return(star-wand) | 실물 근접/필요한 pick ACK; 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| P09 · 보조 | [굴러도 마지막 인사](../reports/REPORT-20261019-136-personality-scenes.html#P09) | recovered | 표현:shake → 표현:bow | 실제 유한 표현/감상 완료 |
| P10 · 보조 | [새로 입은 액세서리 자랑](../reports/REPORT-20261019-136-personality-scenes.html#P10) | outfit | 표현:celebrate → 표현:bow → 표현:groom | 실제 유한 표현/감상 완료 |
| P11 · 보조 | [관객 없는 연습](../reports/REPORT-20261019-136-personality-scenes.html#P11) | free | 표현:cheer-rehearsal → 표현:bow | 실제 유한 표현/감상 완료 |
| P12 · 보조 | [빛 아래 작은 무대](../reports/REPORT-20261019-136-personality-scenes.html#P12) | tv; 실제 TV ON + 전등 ON | 이동:floor → 표현:cheer-rehearsal → 표현:celebrate → 표현:bow | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| X-P-house · 결합 | [재롱둥이 · 집·TV·빛·씻기](../reports/REPORT-20261019-136-personality-scenes.html#cross) | tv; 실제 TV music 채널 | 감상:1.8초 → 이동:floor → 표현:cheer-rehearsal → 표현:bow → 장난감:return? | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착; 같은 ID 입구 전달·stash ACK |
| X-P-editor · 결합 | [재롱둥이 · 편집하는 사람 곁](../reports/REPORT-20261019-136-personality-scenes.html#cross) | work | 표현:celebrate → 표현:bow | 실제 유한 표현/감상 완료 |
| X-P-music · 결합 | [재롱둥이 · 실제 음악](../reports/REPORT-20261019-136-personality-scenes.html#cross) | music | 표현:cheer-rehearsal → 표현:bow | 실제 유한 표현/감상 완료 |
| X-P-return-time · 결합 | [재롱둥이 · 귀가·재회·시간대](../reports/REPORT-20261019-136-personality-scenes.html#cross) | arrival + experience + night; 실제 저녁 재회 + 학습된 이 시간 경험 | 표현:cheer-rehearsal → 표현:celebrate → 표현:bow → 이동:floor | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |

### 탐험둥이 (curious)

| ID·종류 | 원본 장면 | 현재 조건·선택 | 실제 명령 순서 | 효과·종료 연결 |
|---|---|---|---|---|
| C01 · 대표 | [처음 놓인 장난감의 양쪽 살피기](../reports/REPORT-20261019-136-personality-scenes.html#C01) | toy + toy-settled; 미경험 종류 + 양쪽 안전 자리 | 표현:sniff → 이동:toy → 장난감:inspect → 이동:toy-other-side? → 표현:sniff → 표현:bow → 장난감:play → 장난감:return | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착; 실물 근접/필요한 pick ACK; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK |
| C02 · 대표 | [처음 맛보는 음식 앞의 한 걸음](../reports/REPORT-20261019-136-personality-scenes.html#C02) | food; 아직 먹지 않은 실물 | 음식:inspect → 표현:shake → 이동:food → 음식:eat | 고정 실물 근접 inspect ACK; 실제 유한 표현/감상 완료; 실제 받침·목적지 도착; 실제 eat ID ACK |
| C03 · 대표 | [종이비행기의 도착 지점 조사](../reports/REPORT-20261019-136-personality-scenes.html#C03) | toy | 장난감:inspect(paper-plane) → 장난감:toss(paper-plane) → 감상:0.9초 → 이동:toy → 장난감:inspect(paper-plane) → 장난감:return(paper-plane) | 실물 근접/필요한 pick ACK; 같은 ID toss ACK·실제 낙하; 실제 유한 표현/감상 완료; 실제 받침·목적지 도착; 같은 ID 입구 전달·stash ACK |
| C04 · 대표 | [TV 다섯 채널 중 한 번 비교하기](../reports/REPORT-20261019-136-personality-scenes.html#C04) | tv | 이동:sofa → TV:nature → 감상:1.4초 → TV:next → 감상:3초 → 표현:bow | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료 |
| C05 · 대표 | [달력이 바뀐 뒤 안전한 새 자리 하나](../reports/REPORT-20261019-136-personality-scenes.html#C05) | layout; 실제 layout 완료 | 표현:sniff → 이동:novel-place → 표현:stretch → 표현:bow | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| C06 · 보조 | [멈춘 공을 늦게 톡](../reports/REPORT-20261019-136-personality-scenes.html#C06) | toy + toy-settled | 감상:0.5초 → 이동:toy → 장난감:nudge(ball) → 표현:bow | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착; 같은 ID nudge ACK |
| C07 · 보조 | [만화경 가까이 보기](../reports/REPORT-20261019-136-personality-scenes.html#C07) | toy | 장난감:inspect(kaleidoscope) → 표현:sniff → 장난감:return(kaleidoscope) | 실물 근접/필요한 pick ACK; 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| C08 · 보조 | [팽이 앞 갸웃](../reports/REPORT-20261019-136-personality-scenes.html#C08) | toy | 장난감:inspect(spinning-top) → 표현:bow → 장난감:return(spinning-top) | 실물 근접/필요한 pick ACK; 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| C09 · 보조 | [덜 논 실물 선택](../reports/REPORT-20261019-136-personality-scenes.html#C09) | toy; 실물2개 이상; 덜 논 종류 우선 | 장난감:inspect → 장난감:play → 표현:bow | 실물 근접/필요한 pick ACK; 같은 ID 실제 play 효과 ACK; 실제 유한 표현/감상 완료 |
| C10 · 보조 | [반대쪽으로 빼꼼](../reports/REPORT-20261019-136-personality-scenes.html#C10) | free | 숨기:1.6초 → 표현:bow → 이동:novel-place | 실제 집 접기/유한 완료; 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| C11 · 보조 | [처음 들린 소리](../reports/REPORT-20261019-136-personality-scenes.html#C11) | music | 표현:sniff → 감상:2.5초 → 표현:bow | 실제 유한 표현/감상 완료 |
| C12 · 보조 | [창밖 비 한 번 보기](../reports/REPORT-20261019-136-personality-scenes.html#C12) | rain | 이동:window → 커튼:open → 감상:2.2초 → 표현:stretch | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료 |
| X-C-house · 결합 | [탐험둥이 · 집·TV·빛·씻기](../reports/REPORT-20261019-136-personality-scenes.html#cross) | tv | 이동:sofa → TV:nature → 감상:1.4초 → TV:toys → 감상:2.6초 → 표현:bow | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료 |
| X-C-editor · 결합 | [탐험둥이 · 편집하는 사람 곁](../reports/REPORT-20261019-136-personality-scenes.html#cross) | editor-open | 표현:sniff → 표현:bow | 실제 유한 표현/감상 완료 |
| X-C-music · 결합 | [탐험둥이 · 실제 음악](../reports/REPORT-20261019-136-personality-scenes.html#cross) | music | 표현:sniff → 감상:2.3초 → 표현:bow | 실제 유한 표현/감상 완료 |
| X-C-return-time · 결합 | [탐험둥이 · 귀가·재회·시간대](../reports/REPORT-20261019-136-personality-scenes.html#cross) | arrival; 실제 봄 새벽 재회 | 이동:window → 커튼:open → 표현:sniff → 감상:2초 → 표현:stretch | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료 |

### 애교쟁이 (affectionate)

| ID·종류 | 원본 장면 | 현재 조건·선택 | 실제 명령 순서 | 효과·종료 연결 |
|---|---|---|---|---|
| A01 · 대표 | [멈춘 마우스 옆의 작은 부탁](../reports/REPORT-20261019-136-personality-scenes.html#A01) | free; 허용·안정 포인터; 실시간 추적 | 이동:pointer → 표현:ask-petting → 감상:1.2초 → 표현:bow → 이동:floor | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| A02 · 대표 | [실제 쓰다듬기 뒤 오래 남는 만족](../reports/REPORT-20261019-136-personality-scenes.html#A02) | pet | 표현:lean-nuzzle → 표현:groom → 표현:bow | 실제 유한 표현/감상 완료 |
| A03 · 대표 | [놀던 인형을 들고 사람에게 인사](../reports/REPORT-20261019-136-personality-scenes.html#A03) | toy; pettingON·안정 포인터 | 장난감:inspect(duck,plush-fish) → 이동:pointer → 표현:bow → 장난감:play(duck,plush-fish) → 장난감:return(duck,plush-fish) | 실물 근접/필요한 pick ACK; 실제 받침·목적지 도착; 실제 유한 표현/감상 완료; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK |
| A04 · 대표 | [밤의 실제 재회, 조용한 옆자리](../reports/REPORT-20261019-136-personality-scenes.html#A04) | arrival + night; 실제 arrival + 허용·안정 포인터 | 이동:pointer → 표현:lean-nuzzle → 감상:1초 → 표현:bow | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| A05 · 대표 | [넘어진 뒤, 실제 안심을 기다리는 재접근](../reports/REPORT-20261019-136-personality-scenes.html#A05) | recovered; pettingON·안정 포인터 | 표현:shake → 이동:pointer → 표현:ask-petting → 감상:1초 → 표현:groom → 이동:floor | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| A06 · 보조 | [쿠션에서 몸 내밀기](../reports/REPORT-20261019-136-personality-scenes.html#A06) | free | 이동:sofa → 표현:lean-nuzzle → 표현:groom | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| A07 · 보조 | [한 번만 따라가기](../reports/REPORT-20261019-136-personality-scenes.html#A07) | free; 목적지 한 번 고정; pettingON·안정 포인터 | 이동:pointer → 표현:bow → 이동:floor | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| A08 · 보조 | [음식보다 먼저 인사](../reports/REPORT-20261019-136-personality-scenes.html#A08) | food; pettingON·안정 포인터 | 이동:pointer → 표현:bow → 음식:eat | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료; 실제 eat ID ACK |
| A09 · 보조 | [음악 끝에 가까이 꾸벅](../reports/REPORT-20261019-136-personality-scenes.html#A09) | music; pettingON·안정 포인터 | 이동:pointer → 표현:bow → 감상:0.8초 | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| A10 · 보조 | [저장 뒤 응원 대신 곁 지키기](../reports/REPORT-20261019-136-personality-scenes.html#A10) | work; pettingON·안정 포인터 | 이동:pointer → 표현:lean-nuzzle → 감상:1.2초 → 표현:bow | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| A11 · 보조 | [TV보다 사람 보기](../reports/REPORT-20261019-136-personality-scenes.html#A11) | tv; pettingON·안정 포인터 | 감상:0.7초 → 이동:pointer → 표현:bow → 이동:sofa → 감상:1.7초 | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| A12 · 보조 | [교감 OFF의 조용한 인사](../reports/REPORT-20261019-136-personality-scenes.html#A12) | free; pettingOFF일 때만 | 표현:bow → 표현:groom | 실제 유한 표현/감상 완료 |
| X-A-house · 결합 | [애교쟁이 · 집·TV·빛·씻기](../reports/REPORT-20261019-136-personality-scenes.html#cross) | tv; pettingON·안정 포인터 | 감상:1.1초 → 이동:pointer → 표현:lean-nuzzle → 표현:bow | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| X-A-editor · 결합 | [애교쟁이 · 편집하는 사람 곁](../reports/REPORT-20261019-136-personality-scenes.html#cross) | work; pettingON·안정 포인터 | 이동:pointer → 표현:lean-nuzzle → 감상:0.9초 → 표현:bow | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| X-A-music · 결합 | [애교쟁이 · 실제 음악](../reports/REPORT-20261019-136-personality-scenes.html#cross) | music; pettingON·안정 포인터 | 이동:pointer → 표현:bow → 감상:1초 | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| X-A-return-time · 결합 | [애교쟁이 · 귀가·재회·시간대](../reports/REPORT-20261019-136-personality-scenes.html#cross) | arrival + night; pettingON·안정 포인터 | 이동:pointer → 표현:lean-nuzzle → 표현:bow | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |

### 잠꾸러기 (sleepy)

| ID·종류 | 원본 장면 | 현재 조건·선택 | 실제 명령 순서 | 효과·종료 연결 |
|---|---|---|---|---|
| S01 · 대표 | [잘 자려다 다시 구경하는 쿠션 의식](../reports/REPORT-20261019-136-personality-scenes.html#S01) | free | 이동:sofa → 표현:doze-curl → 표현:cozy-nest → 수면:6.5초 → 표현:stretch | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료; sleepON·기력/집 조건; 실제 유한 동작 |
| S02 · 대표 | [졸리지만 밥부터 먹는 한 끼](../reports/REPORT-20261019-136-personality-scenes.html#S02) | food | 표현:stretch → 음식:inspect → 음식:eat → 표현:groom → 이동:sofa | 실제 유한 표현/감상 완료; 고정 실물 근접 inspect ACK; 실제 eat ID ACK; 실제 받침·목적지 도착 |
| S03 · 대표 | [장난감 하나만 치우고 쉬기](../reports/REPORT-20261019-136-personality-scenes.html#S03) | toy | 장난감:return → 이동:sofa → 표현:cozy-nest → 수면:5.5초 | 같은 ID 입구 전달·stash ACK; 실제 받침·목적지 도착; 실제 유한 표현/감상 완료; sleepON·기력/집 조건; 실제 유한 동작 |
| S04 · 대표 | [달별 TV를 보다 준비하는 밤 휴식](../reports/REPORT-20261019-136-personality-scenes.html#S04) | night; sleepON + 낮은 기력 | 이동:sofa → TV:moon → 감상:2.2초 → 표현:doze-curl → TV:off → 전등:OFF → 커튼:closed → 수면:7초 → 표현:stretch | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료; sleepON·기력/집 조건; 실제 유한 동작 |
| S05 · 대표 | [깃털에 놀라 깨어나는 짧은 놀이](../reports/REPORT-20261019-136-personality-scenes.html#S05) | toy | 장난감:inspect(feather) → 장난감:play(feather) → 표현:stretch → 장난감:return(feather) → 표현:bow | 실물 근접/필요한 pick ACK; 같은 ID 실제 play 효과 ACK; 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| S06 · 보조 | [느린 첫 인사](../reports/REPORT-20261019-136-personality-scenes.html#S06) | arrival | 표현:stretch → 표현:bow | 실제 유한 표현/감상 완료 |
| S07 · 보조 | [물고기 인형 감상](../reports/REPORT-20261019-136-personality-scenes.html#S07) | toy | 장난감:inspect(plush-fish) → 감상:0.9초 → 장난감:return(plush-fish) | 실물 근접/필요한 pick ACK; 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| S08 · 보조 | [쓰담 뒤 하품](../reports/REPORT-20261019-136-personality-scenes.html#S08) | pet | 표현:doze-curl → 표현:stretch | 실제 유한 표현/감상 완료 |
| S09 · 보조 | [쉬다가 자세 바꾸기](../reports/REPORT-20261019-136-personality-scenes.html#S09) | free | 표현:cozy-nest → 표현:stretch → 표현:groom | 실제 유한 표현/감상 완료 |
| S10 · 보조 | [떨어진 물건에 눈 뜨기](../reports/REPORT-20261019-136-personality-scenes.html#S10) | toy + toy-settled | 표현:stretch → 장난감:inspect → 표현:bow | 실제 유한 표현/감상 완료; 실물 근접/필요한 pick ACK |
| S11 · 보조 | [깨어 있는 귀 반응](../reports/REPORT-20261019-136-personality-scenes.html#S11) | free | 표현:doze-curl → 표현:stretch → 표현:bow | 실제 유한 표현/감상 완료 |
| S12 · 보조 | [작업 틈 스트레칭](../reports/REPORT-20261019-136-personality-scenes.html#S12) | work | 표현:stretch → 표현:groom | 실제 유한 표현/감상 완료 |
| X-S-house · 결합 | [잠꾸러기 · 집·TV·빛·씻기](../reports/REPORT-20261019-136-personality-scenes.html#cross) | night; sleepON + 낮은 기력 | 이동:sofa → TV:moon → 감상:2.6초 → 표현:doze-curl → 수면:6초 → 표현:stretch | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료; sleepON·기력/집 조건; 실제 유한 동작 |
| X-S-editor · 결합 | [잠꾸러기 · 편집하는 사람 곁](../reports/REPORT-20261019-136-personality-scenes.html#cross) | work | 표현:stretch → 표현:groom | 실제 유한 표현/감상 완료 |
| X-S-music · 결합 | [잠꾸러기 · 실제 음악](../reports/REPORT-20261019-136-personality-scenes.html#cross) | music; 실제 calm 음악 | 표현:stretch → 수면:5초? → 표현:groom | 실제 유한 표현/감상 완료; sleepON·기력/집 조건; 실제 유한 동작 |
| X-S-return-time · 결합 | [잠꾸러기 · 귀가·재회·시간대](../reports/REPORT-20261019-136-personality-scenes.html#cross) | arrival + night; 겨울 밤 재회 + sleepON + 낮은 기력 | 이동:sofa → 표현:doze-curl → 수면:6초? → 표현:stretch | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료; sleepON·기력/집 조건; 실제 유한 동작 |

### 깔끔이 (tidy)

| ID·종류 | 원본 장면 | 현재 조건·선택 | 실제 명령 순서 | 효과·종료 연결 |
|---|---|---|---|---|
| T01 · 대표 | [한 물건부터 끝내는 장난감 정리](../reports/REPORT-20261019-136-personality-scenes.html#T01) | toy | 표현:groom → 장난감:return → 표현:bow | 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| T02 · 대표 | [좋아하는 음식은 버리지 않고 보관](../reports/REPORT-20261019-136-personality-scenes.html#T02) | food; 최애 실물 + 포만 | 음식:tidy → 표현:groom → 표현:bow | 같은 ID pick·보관/허용 폐기 ACK; 실제 유한 표현/감상 완료 |
| T03 · 대표 | [버릴 수 있는 음식만 실제 쓰레기통으로](../reports/REPORT-20261019-136-personality-scenes.html#T03) | food; 비최애 실물 + 포만 | 음식:tidy → 표현:shake → 표현:groom | 같은 ID pick·보관/허용 폐기 ACK; 실제 유한 표현/감상 완료 |
| T04 · 대표 | [정리하다 사용자가 집으면 바로 양보](../reports/REPORT-20261019-136-personality-scenes.html#T04) | experience; 실제 사용자 선점 ID | 표현:bow → 장난감:return? → 표현:groom | 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| T05 · 대표 | [정리 완료 뒤 씻고 쉬는 작은 보상](../reports/REPORT-20261019-136-personality-scenes.html#T05) | toy-returned; 실제 남은 장난감0 + pad | 이동:pad → 세면:2초 → 이동:sofa → 표현:groom | 실제 받침·목적지 도착; 실제 pad·입 접촉500ms ACK; 실제 유한 표현/감상 완료 |
| T06 · 보조 | [겹친 음식 하나 옮기기](../reports/REPORT-20261019-136-personality-scenes.html#T06) | food; 같은 받침에서 겹친 음식 | 음식:tidy → 표현:bow | 같은 ID pick·보관/허용 폐기 ACK; 실제 유한 표현/감상 완료 |
| T07 · 보조 | [할 일이 없으면 몸단장](../reports/REPORT-20261019-136-personality-scenes.html#T07) | free; 도달 가능한 실제 정리 일 없음 | 표현:groom → 표현:sniff → 표현:bow | 실제 유한 표현/감상 완료 |
| T08 · 보조 | [음식과 장난감 중 한 작업](../reports/REPORT-20261019-136-personality-scenes.html#T08) | toy + food | 장난감:return → 표현:groom | 같은 ID 입구 전달·stash ACK; 실제 유한 표현/감상 완료 |
| T09 · 보조 | [운반 중 새 물건은 다음 차례](../reports/REPORT-20261019-136-personality-scenes.html#T09) | toy + toy-settled; 실제 운반 중 새 deferred ID | 장난감:return → 표현:sniff → 표현:bow | 같은 ID 입구 전달·stash ACK; 실제 유한 표현/감상 완료 |
| T10 · 보조 | [굴러도 원래 물건으로](../reports/REPORT-20261019-136-personality-scenes.html#T10) | toy + recovered; 실제 중단 원ID | 표현:shake → 장난감:return → 표현:groom | 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| T11 · 보조 | [음악 중에도 반납부터](../reports/REPORT-20261019-136-personality-scenes.html#T11) | toy + music | 장난감:return → 표현:bow → 감상:1.1초 | 같은 ID 입구 전달·stash ACK; 실제 유한 표현/감상 완료 |
| T12 · 보조 | [편집 완료 뒤 내 주변 정돈](../reports/REPORT-20261019-136-personality-scenes.html#T12) | work + toy | 장난감:return → 표현:groom | 같은 ID 입구 전달·stash ACK; 실제 유한 표현/감상 완료 |
| X-T-house · 결합 | [깔끔이 · 집·TV·빛·씻기](../reports/REPORT-20261019-136-personality-scenes.html#cross) | toy-returned; 실제 장난감0 + pad | 이동:pad → 세면:2.2초 → 표현:groom | 실제 받침·목적지 도착; 실제 pad·입 접촉500ms ACK; 실제 유한 표현/감상 완료 |
| X-T-editor · 결합 | [깔끔이 · 편집하는 사람 곁](../reports/REPORT-20261019-136-personality-scenes.html#cross) | work + toy | 장난감:return → 표현:bow | 같은 ID 입구 전달·stash ACK; 실제 유한 표현/감상 완료 |
| X-T-music · 결합 | [깔끔이 · 실제 음악](../reports/REPORT-20261019-136-personality-scenes.html#cross) | music + toy | 장난감:return → 표현:bow → 감상:1.5초 | 같은 ID 입구 전달·stash ACK; 실제 유한 표현/감상 완료 |
| X-T-return-time · 결합 | [깔끔이 · 귀가·재회·시간대](../reports/REPORT-20261019-136-personality-scenes.html#cross) | arrival + toy | 장난감:return → 이동:sofa → 표현:groom | 같은 ID 입구 전달·stash ACK; 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |

### 사고뭉치 (mischievous)

| ID·종류 | 원본 장면 | 현재 조건·선택 | 실제 명령 순서 | 효과·종료 연결 |
|---|---|---|---|---|
| M01 · 대표 | [한 번 굴리고 한 번 더 바꾸는 공놀이](../reports/REPORT-20261019-136-personality-scenes.html#M01) | toy | 장난감:toss(ball) → 이동:toy → 장난감:toss(ball) → 이동:toy → 장난감:return(ball) | 같은 ID toss ACK·실제 낙하; 실제 받침·목적지 도착; 같은 ID 입구 전달·stash ACK |
| M02 · 대표 | [자동차를 밀고 따라잡는 작은 소동](../reports/REPORT-20261019-136-personality-scenes.html#M02) | toy | 장난감:nudge(toy-car) → 이동:toy → 표현:pounce → 장난감:return(toy-car) | 같은 ID nudge ACK; 실제 받침·목적지 도착; 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| M03 · 대표 | [사용자가 놓은 소품에 딱 한 번 덤비기](../reports/REPORT-20261019-136-personality-scenes.html#M03) | toy + toy-settled | 표현:pounce → 장난감:play → 장난감:return | 실제 유한 표현/감상 완료; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK |
| M04 · 대표 | [정리한 상자는 건드리지 않는 딴청](../reports/REPORT-20261019-136-personality-scenes.html#M04) | toy-returned | 표현:look → 이동:floor → 표현:pounce → 표현:bow | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| M05 · 대표 | [채널 한 번 바꾸다가 조용해지는 반전](../reports/REPORT-20261019-136-personality-scenes.html#M05) | tv; 실제 TV ON + 기력≤.7 | 감상:1초 → TV:moon → 감상:3.3초 → 표현:groom | 실제 유한 표현/감상 완료; 공용 가구 owner 실제 승인 |
| M06 · 보조 | [나온 블록 조금 흩어 보기](../reports/REPORT-20261019-136-personality-scenes.html#M06) | toy | 장난감:toss(blocks) → 이동:toy → 장난감:inspect(blocks) → 표현:bow | 같은 ID toss ACK·실제 낙하; 실제 받침·목적지 도착; 실물 근접/필요한 pick ACK; 실제 유한 표현/감상 완료 |
| M07 · 보조 | [상자에서 한 개만](../reports/REPORT-20261019-136-personality-scenes.html#M07) | free | 이동:box → 장난감:spawn → 장난감:play → 장난감:return | 실제 받침·목적지 도착; 실제 새 ID·4개 상한 ACK; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK |
| M08 · 보조 | [먹기 전 한 번만 장난](../reports/REPORT-20261019-136-personality-scenes.html#M08) | food | 음식:inspect → 표현:pounce → 음식:eat | 고정 실물 근접 inspect ACK; 실제 유한 표현/감상 완료; 실제 eat ID ACK |
| M09 · 보조 | [비행기 반대쪽 봤다가 따라가기](../reports/REPORT-20261019-136-personality-scenes.html#M09) | toy | 장난감:toss(paper-plane) → 표현:look → 이동:toy → 장난감:inspect(paper-plane) → 장난감:return(paper-plane) | 같은 ID toss ACK·실제 낙하; 실제 유한 표현/감상 완료; 실제 받침·목적지 도착; 실물 근접/필요한 pick ACK; 같은 ID 입구 전달·stash ACK |
| M10 · 보조 | [고리 따라가다 회복](../reports/REPORT-20261019-136-personality-scenes.html#M10) | toy + recovered | 표현:shake → 장난감:inspect(hoop) → 장난감:return(hoop) | 실제 유한 표현/감상 완료; 실물 근접/필요한 pick ACK; 같은 ID 입구 전달·stash ACK |
| M11 · 보조 | [발견되면 완전히 나오기](../reports/REPORT-20261019-136-personality-scenes.html#M11) | free | 숨기:1.7초 → 표현:bow → 이동:novel-place | 실제 집 접기/유한 완료; 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| M12 · 보조 | [되돌리기 뒤 작은 갸웃](../reports/REPORT-20261019-136-personality-scenes.html#M12) | undo | 표현:sniff → 표현:bow | 실제 유한 표현/감상 완료 |
| X-M-house · 결합 | [사고뭉치 · 집·TV·빛·씻기](../reports/REPORT-20261019-136-personality-scenes.html#cross) | tv; 실제 TV ON | 감상:1.6초 → TV:next → 감상:2.3초 → 장난감:play? → 장난감:return? | 실제 유한 표현/감상 완료; 공용 가구 owner 실제 승인; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK |
| X-M-editor · 결합 | [사고뭉치 · 편집하는 사람 곁](../reports/REPORT-20261019-136-personality-scenes.html#cross) | undo | 표현:sniff → 표현:bow | 실제 유한 표현/감상 완료 |
| X-M-music · 결합 | [사고뭉치 · 실제 음악](../reports/REPORT-20261019-136-personality-scenes.html#cross) | music + toy; 실제 lively 음악 | 표현:pounce → 장난감:play → 장난감:return → 표현:bow | 실제 유한 표현/감상 완료; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK |
| X-M-return-time · 결합 | [사고뭉치 · 귀가·재회·시간대](../reports/REPORT-20261019-136-personality-scenes.html#cross) | arrival; 실제 밤 재회 | 이동:sofa → TV:moon → 감상:3.3초 → 표현:groom | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료 |

### 먹보 (gourmet)

| ID·종류 | 원본 장면 | 현재 조건·선택 | 실제 명령 순서 | 효과·종료 연결 |
|---|---|---|---|---|
| G01 · 대표 | [최애를 찾은 귀, 실제 한입의 만족](../reports/REPORT-20261019-136-personality-scenes.html#G01) | food; 학습 최애 실물 + 실제 허기 | 표현:bow → 음식:inspect → 음식:eat → 표현:celebrate → 표현:groom | 실제 유한 표현/감상 완료; 고정 실물 근접 inspect ACK; 실제 eat ID ACK |
| G02 · 대표 | [배부른 날 최애를 남겨 두기](../reports/REPORT-20261019-136-personality-scenes.html#G02) | food; 최애 실물 + 포만 | 음식:tidy → 표현:sniff → 표현:bow | 같은 ID pick·보관/허용 폐기 ACK; 실제 유한 표현/감상 완료 |
| G03 · 대표 | [이전에 보관한 음식과 다시 만남](../reports/REPORT-20261019-136-personality-scenes.html#G03) | food + experience; 실제 stored ID + 다시 허기 | 이동:food → 표현:sniff → 음식:eat → 표현:celebrate | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료; 실제 eat ID ACK |
| G04 · 대표 | [새 빵과 익숙한 한 끼 사이의 결정](../reports/REPORT-20261019-136-personality-scenes.html#G04) | food; 동일 부류 경험 + 새 실물; 비교할 실물2개 | 음식:compare → 음식:inspect → 음식:eat → 표현:groom | 고정 실물 근접 inspect ACK; 실제 eat ID ACK; 실제 유한 표현/감상 완료 |
| G05 · 대표 | [식후 요리 TV, 당근 장난감은 먹지 않기](../reports/REPORT-20261019-136-personality-scenes.html#G05) | meal | 표현:groom → 이동:sofa → TV:cooking → 감상:3초 → 장난감:inspect(squeaky-carrot)? → 장난감:return(squeaky-carrot)? | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실물 근접/필요한 pick ACK; 같은 ID 입구 전달·stash ACK |
| G06 · 보조 | [정착한 음식부터 보기](../reports/REPORT-20261019-136-personality-scenes.html#G06) | food | 표현:sniff → 음식:eat → 표현:groom | 실제 유한 표현/감상 완료; 실제 eat ID ACK |
| G07 · 보조 | [가까운 한 끼가 먼저](../reports/REPORT-20261019-136-personality-scenes.html#G07) | food | 음식:eat → 표현:celebrate | 실제 eat ID ACK; 실제 유한 표현/감상 완료 |
| G08 · 보조 | [최애가 실제 바뀐 날](../reports/REPORT-20261019-136-personality-scenes.html#G08) | favorite | 표현:celebrate → 음식:inspect? → 표현:groom | 실제 유한 표현/감상 완료; 고정 실물 근접 inspect ACK |
| G09 · 보조 | [음악은 먹은 다음](../reports/REPORT-20261019-136-personality-scenes.html#G09) | music + meal | 표현:groom → 표현:bow | 실제 유한 표현/감상 완료 |
| G10 · 보조 | [아침 귀가의 음식 확인](../reports/REPORT-20261019-136-personality-scenes.html#G10) | arrival + food + experience; 실제 아침 + 허기 + 학습된 아침 경험 | 표현:sniff → 음식:eat → 표현:groom | 실제 유한 표현/감상 완료; 실제 eat ID ACK |
| G11 · 보조 | [저장 성공 뒤 한입 후보](../reports/REPORT-20261019-136-personality-scenes.html#G11) | work | 음식:eat? → 표현:bow | 실제 eat ID ACK; 실제 유한 표현/감상 완료 |
| G12 · 보조 | [음식 없는 날의 여유](../reports/REPORT-20261019-136-personality-scenes.html#G12) | free | 표현:groom → 표현:bow → 장난감:inspect? → 장난감:return? | 실제 유한 표현/감상 완료; 실물 근접/필요한 pick ACK; 같은 ID 입구 전달·stash ACK |
| X-G-house · 결합 | [먹보 · 집·TV·빛·씻기](../reports/REPORT-20261019-136-personality-scenes.html#cross) | meal | 표현:groom → 이동:sofa → TV:cooking → 감상:3초 | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착; 공용 가구 owner 실제 승인 |
| X-G-editor · 결합 | [먹보 · 편집하는 사람 곁](../reports/REPORT-20261019-136-personality-scenes.html#cross) | work | 음식:eat? → 표현:bow | 실제 eat ID ACK; 실제 유한 표현/감상 완료 |
| X-G-music · 결합 | [먹보 · 실제 음악](../reports/REPORT-20261019-136-personality-scenes.html#cross) | music + meal | 표현:groom → 표현:bow | 실제 유한 표현/감상 완료 |
| X-G-return-time · 결합 | [먹보 · 귀가·재회·시간대](../reports/REPORT-20261019-136-personality-scenes.html#cross) | arrival + food; 실제 아침 재회 + 허기 | 표현:sniff → 음식:eat → 표현:groom | 실제 유한 표현/감상 완료; 실제 eat ID ACK |

### 집돌이 (homebody)

| ID·종류 | 원본 장면 | 현재 조건·선택 | 실제 명령 순서 | 효과·종료 연결 |
|---|---|---|---|---|
| H01 · 대표 | [상자에서 꺼내 놀고 다시 집으로](../reports/REPORT-20261019-136-personality-scenes.html#H01) | free | 이동:box → 장난감:spawn → 장난감:play → 장난감:return → 이동:sofa → 표현:groom | 실제 받침·목적지 도착; 실제 새 ID·4개 상한 ACK; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK; 실제 유한 표현/감상 완료 |
| H02 · 대표 | [밖의 좋아하는 소품을 데려오기](../reports/REPORT-20261019-136-personality-scenes.html#H02) | toy + experience; 집 밖 실제 최애 종류 | 표현:bow → 이동:toy → 장난감:inspect → 장난감:return → 이동:sofa → 표현:groom | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착; 실물 근접/필요한 pick ACK; 같은 ID 입구 전달·stash ACK |
| H03 · 대표 | [여름 낮, 깨어 즐기는 작은 극장](../reports/REPORT-20261019-136-personality-scenes.html#H03) | summer; 여름 + 강한 햇빛 | 이동:sofa → 커튼:closed → 전등:OFF → TV:nature → 감상:3.6초 → 표현:groom | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료 |
| H04 · 대표 | [접혔다 열린 집으로 실제 귀가](../reports/REPORT-20261019-136-personality-scenes.html#H04) | layout | 이동:sofa → 표현:sniff → 표현:bow → 표현:groom | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| H05 · 대표 | [쿠션·바닥·창가로 바뀌는 작은 일상](../reports/REPORT-20261019-136-personality-scenes.html#H05) | free | 이동:sofa → 표현:groom → 이동:floor → 표현:stretch → 이동:window → 커튼:open → 감상:1.8초 | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료; 공용 가구 owner 실제 승인 |
| H06 · 보조 | [집 앞 기차 왕복](../reports/REPORT-20261019-136-personality-scenes.html#H06) | toy | 장난감:nudge(train) → 이동:toy → 장난감:return(train) → 이동:sofa | 같은 ID nudge ACK; 실제 받침·목적지 도착; 같은 ID 입구 전달·stash ACK |
| H07 · 보조 | [고리 쌓기 소품 감상](../reports/REPORT-20261019-136-personality-scenes.html#H07) | toy | 장난감:inspect(stacking-rings) → 표현:sniff → 장난감:return(stacking-rings) | 실물 근접/필요한 pick ACK; 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK |
| H08 · 보조 | [좋아하는 음식 집 보관](../reports/REPORT-20261019-136-personality-scenes.html#H08) | food; 최애 실물 + 포만 | 음식:tidy → 표현:groom | 같은 ID pick·보관/허용 폐기 ACK; 실제 유한 표현/감상 완료 |
| H09 · 보조 | [새로 펼친 방 둘러보기](../reports/REPORT-20261019-136-personality-scenes.html#H09) | layout | 이동:sofa → 표현:sniff → 표현:bow | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| H10 · 보조 | [익숙한 노래 한 구간](../reports/REPORT-20261019-136-personality-scenes.html#H10) | music + experience; learnON + 실제 현재 음악 mood의 듣기 경험 | 이동:sofa → 감상:3초 → 표현:groom | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| H11 · 보조 | [새 편집 패널에 자리 양보](../reports/REPORT-20261019-136-personality-scenes.html#H11) | layout | 이동:sofa → 표현:stretch | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| H12 · 보조 | [포근히 파묻히기 후보](../reports/REPORT-20261019-136-personality-scenes.html#H12) | free | 이동:sofa → 표현:cozy-nest → 표현:stretch → 표현:groom | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| X-H-house · 결합 | [집돌이 · 집·TV·빛·씻기](../reports/REPORT-20261019-136-personality-scenes.html#cross) | summer | 이동:sofa → 커튼:closed → 전등:OFF → TV:nature → 감상:3.6초 → 표현:groom | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료 |
| X-H-editor · 결합 | [집돌이 · 편집하는 사람 곁](../reports/REPORT-20261019-136-personality-scenes.html#cross) | layout | 이동:sofa → 표현:stretch | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| X-H-music · 결합 | [집돌이 · 실제 음악](../reports/REPORT-20261019-136-personality-scenes.html#cross) | music + experience; learnON + 실제 현재 음악 mood의 듣기 경험 | 이동:sofa → 감상:3.3초 → 표현:groom | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| X-H-return-time · 결합 | [집돌이 · 귀가·재회·시간대](../reports/REPORT-20261019-136-personality-scenes.html#cross) | arrival | 이동:sofa → 표현:bow → 표현:groom → 감상:1.4초 | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |

### 둥글이 (balanced)

| ID·종류 | 원본 장면 | 현재 조건·선택 | 실제 명령 순서 | 효과·종료 연결 |
|---|---|---|---|---|
| B01 · 대표 | [살펴보고 놀고 반납하는 생활 한 편](../reports/REPORT-20261019-136-personality-scenes.html#B01) | toy | 장난감:inspect → 장난감:play → 장난감:return → 표현:bow | 실물 근접/필요한 pick ACK; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK; 실제 유한 표현/감상 완료 |
| B02 · 대표 | [두 번 같은 일을 했으면 다음 재미 찾기](../reports/REPORT-20261019-136-personality-scenes.html#B02) | free; 실제 완료 목적2회 연속 동일 | 표현:stretch → 이동:novel-place → 표현:bow → 장난감:inspect? → 장난감:return? | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착; 실물 근접/필요한 pick ACK; 같은 ID 입구 전달·stash ACK |
| B03 · 대표 | [배고픔과 새로움 사이에서 한 끼 결정](../reports/REPORT-20261019-136-personality-scenes.html#B03) | food; 실물2개; 허기 높으면 근접/그외 미경험 | 음식:inspect → 음식:eat → 표현:groom | 고정 실물 근접 inspect ACK; 실제 eat ID ACK; 실제 유한 표현/감상 완료 |
| B04 · 대표 | [한두 개 정리한 뒤 감상으로 전환](../reports/REPORT-20261019-136-personality-scenes.html#B04) | toy; 실제1~2개 반납; 미예약 다음 대상 없으면 감상 | 장난감:return≤2 → 이동:window → 커튼:open → 감상:2.4초 → 표현:bow | 같은 ID 입구 전달·stash ACK; 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료 |
| B05 · 대표 | [예상 밖의 중단에도 같은 일을 마치기](../reports/REPORT-20261019-136-personality-scenes.html#B05) | recovered; 실제 중단 원ID | 표현:shake → 장난감:return? → 음식:tidy? → 표현:bow | 실제 유한 표현/감상 완료; 같은 ID 입구 전달·stash ACK; 같은 ID pick·보관/허용 폐기 ACK |
| B06 · 보조 | [공 한 번 뒤 반납](../reports/REPORT-20261019-136-personality-scenes.html#B06) | toy | 장난감:play(ball) → 장난감:return(ball) → 표현:bow | 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK; 실제 유한 표현/감상 완료 |
| B07 · 보조 | [짧은 인사 뒤 양보](../reports/REPORT-20261019-136-personality-scenes.html#B07) | free; 목적지 한 번 고정; pettingON·안정 포인터 | 이동:pointer → 표현:bow → 감상:0.9초 → 이동:floor | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| B08 · 보조 | [쉬었다 작은 놀이](../reports/REPORT-20261019-136-personality-scenes.html#B08) | toy | 이동:floor → 장난감:play → 장난감:return | 실제 받침·목적지 도착; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK |
| B09 · 보조 | [최근과 다른 소품](../reports/REPORT-20261019-136-personality-scenes.html#B09) | toy; 실물2개; 덜 논 종류 | 장난감:inspect → 장난감:play → 장난감:return | 실물 근접/필요한 pick ACK; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK |
| B10 · 보조 | [좋았던 교감 한 번 제안](../reports/REPORT-20261019-136-personality-scenes.html#B10) | experience; learnON + 실제 좋은 교감 경험; pettingON·안정 포인터 | 이동:pointer → 표현:ask-petting → 감상:1초 → 표현:bow | 실제 받침·목적지 도착; 실제 유한 표현/감상 완료 |
| B11 · 보조 | [가을비 뒤 차분한 생활](../reports/REPORT-20261019-136-personality-scenes.html#B11) | rain; 실제 가을 + 비 | 이동:window → 커튼:open → 감상:1.8초 → 음식:tidy? → 표현:groom | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료; 같은 ID pick·보관/허용 폐기 ACK |
| B12 · 보조 | [가장 최근 작업 완료만 응원](../reports/REPORT-20261019-136-personality-scenes.html#B12) | work | 표현:bow → 표현:stretch | 실제 유한 표현/감상 완료 |
| X-B-house · 결합 | [둥글이 · 집·TV·빛·씻기](../reports/REPORT-20261019-136-personality-scenes.html#cross) | tv; 실제 TV ON | 감상:1.8초 → 장난감:play? → 장난감:return? → 표현:stretch → 표현:bow | 실제 유한 표현/감상 완료; 같은 ID 실제 play 효과 ACK; 같은 ID 입구 전달·stash ACK |
| X-B-editor · 결합 | [둥글이 · 편집하는 사람 곁](../reports/REPORT-20261019-136-personality-scenes.html#cross) | work | 표현:bow → 표현:groom | 실제 유한 표현/감상 완료 |
| X-B-music · 결합 | [둥글이 · 실제 음악](../reports/REPORT-20261019-136-personality-scenes.html#cross) | music | 표현:bow → 표현:stretch → 이동:novel-place | 실제 유한 표현/감상 완료; 실제 받침·목적지 도착 |
| X-B-return-time · 결합 | [둥글이 · 귀가·재회·시간대](../reports/REPORT-20261019-136-personality-scenes.html#cross) | arrival + rain; 실제 가을 재회 | 이동:window → 커튼:open → 감상:1.6초 → 음식:tidy? → 표현:groom | 실제 받침·목적지 도착; 공용 가구 owner 실제 승인; 실제 유한 표현/감상 완료; 같은 ID pick·보관/허용 폐기 ACK |
