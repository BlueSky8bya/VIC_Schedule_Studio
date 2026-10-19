# 126 — 실제 출구·집 바닥 배출과 혼합 물체 분산

2026-10-19 KST. [PLAN-126](../plans/PLAN-20261019-126-companion-floor-drops-and-curtain-layers.md)의 물리 구현 기록이다. 이 작성자는 해당 물리 구현자이며 자신의 소스를 독립 PASS로 판정하지 않는다. 새 그림·집 가구 CSS·커튼은 다른 담당 범위다.

## 원인과 실제 이전 증거

수동 급식은 renderer가 `outlet.left−40,outlet.bottom+4`를 전달하고 음식 controller가 그 좌표를 즉시 정지시킨 뒤 `tray` attachment로 보존했다. 따라서 음식이 실제 바닥까지 떨어지지 않고 창틀/허공 높이에 남을 수 있었다. 창·가로대·커튼을 음식 발판으로 수집하는 selector는 없다.

root가 보존한 `.scratch-pw/companion-126/before-125/proof.json`의 build `MqU8wvWIV80xtoXNrEwb1`352개 실제 표본을 읽었다. 마지막 표본에서 음식4개의44² rect가 모두x158.063/y180.938, platform 빈 값, falling=false였다. 장난감4개도x193.041–193.051/y262에서 같은 `companion-home-floor-food`에 모였다. 실제 floor rect는x77/y232/282×80, slot bottom214.9375였다. 이 값은 원인 확인용 로컬 fixture 관찰이며 운영/실제 OBS 증거가 아니다.

기존 날짜칸·빈 패널의 BCR.bottom을 쓰는 manual floor와 그 scroll/월·패널 추종은 이전에 요청된 기능이다. 이번 클릭 배출 버그의 증거로 그 계약 전체를 제거하지 않는다. geometry의 해당 발행/직접 drop 경로는 수정하지 않았다.

## 최종 구현 범위

- 클릭한 음식은 실제 연결된 DOM slot의 중심/bottom+2에서 시작한다. 기존 finite parabola가 실제 집 food-floor를 첫 하강 접촉으로 증명해야 생성한다. 출구/집 바닥이 없으면 펫 옆·창틀·viewport 높이로 대체하지 않는다. 더 이상 새 클릭 음식을 tray에 고정하지 않는다. 자율 recipient 급식과 일반 직접 drag/drop 경로는 기존 구분을 유지한다.
- 새 `item-landing.ts`는8개 이하 실제 span과12개 이하 좌표 예약만으로44² footprint의 겹침 면적을 최소화한다. 동률이면 가장 가까운 기존 물체와의 간격을 최대화한 뒤 실제 출구 쪽 가까운 지점을 택한다. 유한 중간점 후보도 포함해 같은 면적의 혼잡 plateau가 한 점 중복으로 귀결되는 것을 피한다. 새 RNG·timer·DOM scan·storage가 없다. 정지 물체뿐 아니라 음식8개/장난감4개의 진행 중 목적지도 교차 예약한다. local bridge는x/y만 돌려주며 활동 기록에 instance/kind ID를 추가하지 않는다.
- 빈 후보가 기존 속도 상한 밖이면 그 실제 도달 경계도 비교한다. 속도를 올리거나 바닥을 늘리지 않는다. 음식 후보는 같은 평면의 실제 body-safe 발판에서 기존36px mouth 범위 안에 있어야 하고, 속도 제한 후 실제 접점도 같은 조건을 다시 확인한다. body 좌표는 기존 landing snapshot과 이미 측정한 같은 floor DOM frame으로 맞춘다. 장난감은 기존 body-safe/작은 물체 safe-span 교집합과260px/s 상한 안에서 예약한다.92px body·36px 음식 접근·48px toy pickup·일반 경로 graph를 넓히지 않는다.
- 음식의 현재 논리 목적지는 기존 floor attachment를 따라간다. source-bound 장난감 flight도 기존 유한 geometry sync에서 같은 floor의 fraction과 목적지를 따라 전체 포물선을 옮기며 중력 시계를 재시작하지 않는다. 일반 사람의 throw에는 이 목적지 예약을 붙이지 않는다. 집기/throw/제거는 기존 flight를 정리하며 pause/resume은 기존 시간 이동을 쓴다.
- 직접 입력의 최신-input 같은-frame paint, scroll 앵커, 날짜 정체성·숨김 판정, 사람 throw의 실제 첫 swept contact, 음식 소비/폐기·장난감 반납의 완료 ACK는 유지한다. 집에서 배출한 예약 flight에 한해 아래의 front-floor 접촉 정정이 적용된다. reduced/off의 음식은 기존처럼 정적인 최종 안전 위치를 쓰며 숨김·차단 상태의 새 무한 작업을 만들지 않는다.

## 좁은 바닥의 물리적 한계

root의 새 compact 가구 아래44px tier에 남는 중심 구간은 대략x30–120이다. 이90px 구간에서8개44px 물체의 중심을 모두 분리하려면308px가 필요하므로 완전 비중첩은 불가능하다. planner는 새 수직 lane·가상 바닥·teleport나 임의 capacity 변경을 만들지 않고 실제 남은 공간에서 최소 겹침을 택한다. 단위의 넓은/좁은/속도 제한 사례도 이를 나눈다. 최종 실제 UI의 분산 정도와 가림은 root native에서 확인해야 하며 “8개 전부 겹침0”이라고 쓰지 않는다.

## 경계·역할·KST·G-22

변경은 공유 viewer/studio/preview의 로컬 모델과 controller다. 서버 loader/DTO/API/DB/Google·패스코드·역할·teaser·calendar 날짜/KST·viewed season/weather 경로를 바꾸지 않는다. 기존 owner/developer/viewer 권한과 private canary·analytics automation guard를 우회하는 경로가 없다. 보호 아트/125 원본과 기존 증거도 수정하지 않았다.

수동 음식 spawn/move/discard와 home/toy box 컨트롤의 기존 고정 semantic target·label·pointer/keyboard 소유권을 유지한다. 자율 음식/장난감과 낙하·분산·예약·layout follow를 새 사람 행동으로 기록하지 않는다. timeline/least-used에 새로운 종류·instance ID·취향·좌표를 추가하지 않았다. 새 제어가 없으므로 새 catalogue target도 없다. 별도 비작성자의 G-21 검토를 요청했고, 자신의 구현을 독립 보안/역할/UX 전체 PASS로 표현하지 않는다.

## 검증과 남은 범위

- focused9 files **150/150 unit PASS**, owned12 files **lint PASS**. 새126 unit은 실제 출구 시작/유한 상승·낙하/집 floor 한정/첫 실물 contact 차단, 혼합 예약, 좁은 용량·속도 제한 경계, 같은 평면36px 접근과 비행 중 floor 추종을 검증한다. 기존 food gravity/access·직접 input/controller·toy pickup/return·24종 셔플 검사를 함께 실행했다.
- 새 native spec은1440 viewer/1920·2400 studio **3 cases 작성** 상태다. actual source frame·8개 낙하·floor contact·동일점 붕괴 방지/실제 분산, hover 중 물리 anchor,2400→1920 resize·wheel 후 같은 DOM/ID를 읽는다. 실제 화면의 모든44px target 비중첩을 주장하지 않고 전체 rectangle 표본을 남긴다. 기존124 contacts helper는 tray/별도 drag 준비를 실제 자동 배출·낙하 관찰로 교체했고 trash/carry/resize 검사를 남겼다.
- 첫 root 실행에서 이 작성자의 새 fixture가 `feeding:false`로 컨트롤을 숨긴 준비 오류가 발견됐다. `feeding:true`,roam=false,hunger=.05로 수정했으며 초기 실패는 보존한다. runtime geometry/style/brain/RNG/clock 주입으로 맞추지 않는다. native 요청은 loopback fixture로 한정하고 쓰기/외부/live·private API를 차단한다.
- 전체 type/lint/unit/build, 최종 native와 운영 확인은 root 담당이다. 이 lane은 build/server/browser/native/git을 실행하지 않았다. root의 이전 build/다른 담당 커튼 관찰을 최종 물리 구현 전체의 실물 통과로 대신하지 않는다.

## 실제 build2 실패와 후속 정정

root는 build `294UZTg96vwnPL0nInRe6`의38 native 중35 PASS/3 FAIL을 보존했다. 이 lane은 그중 `.scratch-pw/companion-126/spawn-2/`3개 JSON의 첫8개 정착 표본과 마지막 표본을 직접 대조했다.

-1440에서 음식4개는 y306 실제 floor에 도달했으나 toy2/4는 소파 `companion-home` y284.734에 정착했다. 클릭 상자 배출은 음식과 같은 집 앞 바닥 깊이를 쓰므로 새 source-bound 예약 flight는 home-floor 접촉만 판정하도록 정정했다. 소파 좌석과 뒤 달력은 이 앞쪽 물체의 받침이 아니다. 사람이 집어 던지면 목적지를 해제해 기존 real ledge 충돌로 돌아가는 짝 회귀 단위를 유지한다. 기존124의 상자 배출/일반 ledge 기대는 이126 깊이 계약에 한해 대체하고 실패 증거를 남긴다.
-2400 첫 정착 음식x는 `[222.203,222.203,207.939,222.203]`,1920 resize 뒤는 `[192.219,192.219,192.219,192.219]`였다. 기존 개인 fraction 뒤 새 control의 안전 끝점으로 clamp되며 재겹침이 발생했다. 또 초기 compact 음식도x189.169–194 범위뿐이었다. 지상 출구의 목표 바닥은 약16px 아래인데 viewport 바닥까지의 가상 시간으로 `140/horizon`을 적용해 실제 쓸 수 있는 바닥에 못 닿는 것이 초기 좁은 분산의 원인이다.
- 새 home 전용 `limitAim`은 알려진 실제 목표 바닥까지의 하강 시간으로 속도/벽 bound를 계산한다. **force별 최대225px/s·총 수평140px·같은 중력/포물선·36px 접근·첫 접촉 판정은 유지**한다. 일반 음식 throw/자율 recipient의 기존 viewport horizon은 바꾸지 않는다. source x247/y290, 실제floor y306 사례에서x150 미만의 실제 접점을 만들며 velocity≤225와travel≤140인 수치 단위를 추가했다. 임의 속도 상한 증가나 teleport가 아니다. 별도 그룹 reflow packing은 추가하지 않고 기존 fraction/regrowth 계약을 보존했다. 새로운 초기 분산이 resize 뒤에도 유지되는지는 다음 root native 대기다.
- peer는 mutable `landingPlatforms`가 이미 유한 follow로 이동한 뒤 원래 `geometry.anchor()` baseline으로 다시 rebase될 수 있음을 발견했다. main의 입력을 immutable `geometryTracker.landings()` 원본으로 바꿨다. body 전용 helper는 동일 폭/높이에서 원래 x/y에 DOM translation만 한 번 더하고 width를 보존한다. 크기가 변하면 food44px clearance로 큰 body를 확장 증명하지 않고 다음 full safe scan을 기다린다. 좁은20px body fragment·단일80px translation·shrink 거절·fresh baseline 재개 회귀를 포함한다.

root는 별도의 carry fixture가 새 바닥에서14.04px만 걸어 기존24px travel 조건을 못 채운 준비 문제도 분리했다. 그 fixture 조정은 root 소유이며 이 lane은 조건을 낮추지 않았다. 물리 최종 source는 이후150개 단위/12파일 lint를 다시 통과해 동결했으며, 이 기록을 최종 native PASS로 바꾸지 않는다.

최종 helper/food-toss/toys/controller/renderer의 정확한 통합 source freeze와 build identity는 root의 release packet에 결속한다. 이전 버전의 단위·native 실패 증거도 그대로 보존한다.

## build3 실물 두 결함과 최종 한정 수정

root의 build3 관측에서 스폰3개는 당시의 “종류별 최소2중심” 조건을 통과했지만 compact 음식은 `[194,132.893,194,194]`, resize 후 `[192.219,157.123,192.219,192.219]`로3개가 같은 점에 겹쳤다. 총 겹침 면적을 먼저 최소화하면 경계에 여러 개를 모으는 선택이 가능했다. 이 관측은 품질 완료로 취급하지 않는다. shared comparator와 food의 최종 실제 도달점 비교를 모두 **free44px 우선 → 포화 시 가장 가까운 이웃과의 간격 최대화 → 총 겹침 면적 → 출구 거리**로 통일했다. 기존 유한 midpoint 후보·캡·실제 포물선·225px/s·140px·body 접근 범위는 유지한다. 새62px 중심 구간에서 음식4개와 실제 toy model4개를 교대로 예약하고 실제 낙하시키는 회귀는 종류별4개 중심이0.1px 반올림 후에도 모두 다름을 확인한다. native3개는 정지 폭의 첫 정착에서 종류별4개를 구별하며, resize 후 조건은 아래의 사전 계약 구분을 따른다. 완전 비중첩이나 강제 위치 보정을 주장하지 않는다.

같은 build3의 실제 carry-resize 마지막5개 표본은 toy foot `(250.939,393.375)`와 현재 상자 입구 `(273.5,393.375)` 사이에22.561px 오차를 남기고 반납했다. 시작 당시의 상자−body 상대 offset은 둘의 서로 다른 resize fraction을 추종하지 못했다. 이제 시작한 **같은 opening DOM identity와 절대 중심·바닥 좌표**를 저장하며, 기존 `refreshAnchors`의 유한 layout/scroll gate가 허용한 frame에서만 해당 opening의 BCR1회를 읽어 갱신한다. 현재 body projection에서 출발하는 기존28% tween·18px lift는 그대로이며 paint 중 추가 DOM 조회나 새 timer/observer는 없다. source가 분리·숨김·빈 rect가 되면 작업을 취소한다. ACK는 마지막으로 실제 paint한 foot과 그때의 같은 실제 입구가20px 미만인 경우에만 허용한다. 기존20px 조건을 넓히지 않았다.

새 pure return 단위는 실제22.561px 실패 좌표, body와 box의 독립 이동, 현재 입구 도달, 기존 lift, strict20px 경계와 무효 source를 검증한다. 본문 앞의150개 단위/12파일 lint는 이전 동결의 이력이다. 후속 focused10 files **154/154 unit PASS**, owned14 files **lint PASS**로 구분한다. 비작성자 peer는 반환과 shared comparator delta를 읽어 새 확정 P1/P2가 없다고 보고했으며 별도 실행은 하지 않았다. build/server/native/배포는 계속 root 전속이며 새 실물 통과 결과는 대기 중이다.

최종 native 실행 전 root가 resize 계약을 분리했다. 정지 폭에서 새로 꺼낸4개는 종류별4중심을 요구한다.2400→1920 및 후속 scroll에서는 원본 full-floor fraction과 현재 control 안전 clip을 유지하므로 일부 endpoint 합류는 가능하며, 기존 종류별 최소2중심·실제 floor·DOM/ID 보존을 요구한다. 전체 한점 붕괴는 허용하지 않는다. 이를 위해 그룹 순간 재배치나 새 가상 plane을 추가하지 않았다. 이 사전 범위 구분은 새 native 실패를 보고 조건을 바꾼 것이 아니다.
