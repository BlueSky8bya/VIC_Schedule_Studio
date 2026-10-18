#122 — 생성 집기·풍경·장난감과 즉각적인 성격 행동

2026-10-19 KST. [계획](../plans/PLAN-20261019-122-companion-illustrated-home-and-toy-tastes.md). 시작 기준 c627cdc3.121의 기술 검사 통과와 사용자의 그림 만족을 구분한다. 최신 사용자가 도형 가구/풍경을 반려했고 실제 이미지 생성과 더 즉각적인 성격 표현을 요청했다.

## 변경·보호 범위

소파의 원래 그림/좌석/앞면과 빅타민 몸통/포즈/눈 atlas는 유지한다. 새 가구5·장난감8·계절 풍경4·비/눈 투명 그림2는 새 원본과 파생 경로에 보존한다. 생성 도구의 native와 축소/배포 WebP, 생성자 관찰과 사용자 승인을 분리한다. 실제 공유 계절/날씨만 소비하며 새 환경 RNG/서버/시계를 만들지 않는다.

집은 음식통을 작게 하여 상자 왼쪽, 쓰레기통을 앞쪽의 별도 여유 있는 자리에 둔다. 큰 창문과 소파는 겹치지 않는다. 물체 전체 hover/press만 움직이며 실제 클릭/음식 출구/좌석 앵커는 고정한다. 감소/OFF/soft에서는 정적 전체 그림 반응을 유지한다.

앵커 고정은 상호작용 애니메이션 중 실제 측정 좌표를 바꾸지 않는다는 뜻이다. 새 인테리어의 허용된 재배치/좁은 방 높이 변경으로 소파의 실제 페이지 위치는 바뀔 수 있으며, 런타임은 그 DOM 좌석을 다시 측정한다. 소파 SVG/천/좌석 내부 비율은 그대로다. 독립 검수에서 quiet 상태의 disabled 집기 밝기 반응을 발견해 enabled 제어만 반응하도록 한정했다.

프로필은 성격과 좋아/싫어 간식·장난감 그림 카드, 도감은 냠냠/장난감/추억의 유한 페이지를 쓴다. 실제 꺼냄은 장난감 발견, 실제 놀이/정리/명시적 익숙한 것 거절은 해당 경험으로 제한한다. 새 것 경계나 정리만으로 싫어함을 위조하지 않는다. 미확인 !는 실제 직접 확인으로만 해제한다.

## 원인 조사

깔끔이 정리 시작 지연: 일반 행동 교체마다 inactive toy planner까지 cancel하여 readyAt을 계속1500ms 뒤로 미뤘다. 짧은 idle/look 반복 시 정리 시작이 영구 지연될 수 있었다. 실제 settled 장난감 단서의 재계획 경로와 줍기 전에 반납 경로를 함께 확인하는 과정도 부족했다. 단순 타이머 감축 대신 이 세 경계를 수정하고 실제 줍기→반납 완료를 검증한다.

모든 성격은10초 활성 가시 시간 안에 fitting meaningful goal/재롱 시작을 목표로 한다. idle/look/그림 프레임 변경은 의미 있는 새 행동으로 세지 않는다. 진행 중 실제 먹기/이동/직접 교감/귀가/명시적 휴식을 주기적으로 끊어 검사 시간을 맞추지 않는다. 상황이 맞지 않을 때 제자리 성격 재롱을 기존 단일 clock에서 제한적으로 사용한다.

## 검증 상태

첫 source freeze에서 전체270파일2947 단위 검사, 전체 lint/typecheck/production fixture build, harness309문서 PASS. `.scratch-pw/companion-122/units-3-final.log`, `lint-1.log`, `typecheck-1.log`, `build-1.log`, `harness-1.log`에 실제 종료 결과를 보존한다. 이후 native에서 발견한 수정은 별도 최종 검증이 필요하다.

첫 실제 Chromium24검사:17 PASS/7 FAIL. 원본 `native-1` trace/video/report를 보존한다. 집 5점 hit 검사는 둥근 버튼의 잘린 투명 꼭짓점을 검사했고, hover 좌표는 집 열기 spring 완료 전에 측정했다. 실제 중앙/네 가장자리와 ancestor finite animation 완료를 검사하도록 바로잡았다. 두 profile 검사는 정적 취향 카드 뒤 늦게 열리는 미리보기 chunk를 기다리지 않아 null computed style이었으며, 실제 preview 표시·ready를 기다리도록 했다. 사고뭉치 실패는 signature만 수집해 실제 household 장난 목표를 놓쳤다. 실제 기록에는0.56초부터 음식통 목표와 좌표1272→199px/여러 발판 진행이 있어 household·실제 이동·decoded를 함께 확인하도록 보완한다. 태그나 단순 walk/jump만으로 통과시키지 않는다. **깔끔이의4개 장난감 미반납은 실제 실패**로 추가 수정/재검증한다.

독립 교차 source 검수에서 해결한 항목: 도감 분류 전환 후 선택 보존, 취향 초기화의 발견/확인 보존, G-22 toy분류 실제 writer→timeline→least-used 검사, 좁은 container CSS 순서, 다른 장난감 잡을 때 기존 carried 소유권 해제, 닿지 못하는 음식의 성격 fallback 영구 억제, jumpOFF pounce 제외, quiet disabled 피드백. 역할/DTO/서버/KST/분석 경계 read-only 검수 새 open결함0. 자기 구현 검수와 교차 독립 검수는 구분한다.

native 실패 후 실제 정리 수정: 소파 collider의 안전한 집 바닥 경유를 household뿐 아니라 toy에도 적용하고, 중간 경유에서 pick/stash effect를 실행하지 않는다. 장난감 전용 경로에는 측정된 안전 home-floor만 중간 경유하도록 허용한다. 일반 배회/음식/manual top 원본을 변경하지 않는다. 실제 settled 장난감 최대4개의 support를 planner에도 포함하고, physics 입력 최대400/채택200·기존 경로 한도는 유지하면서 owned support/home을 먼저 남긴다. 중복 prefix로 마지막 실제 발판을 잘라낼 수 있는 경계도 교차 검수 후 제거했다. spawn은 support hint로 실제 상자 출구 y를 바닥 y로 덮지 않고 첫 물리 접촉까지 원래 출구를 보존한다. generic play와 단순 풍경 장면은 성격 의미 예산을 초기화하지 않는다. 관련2단위파일47검사 PASS; 최종 native는 별도다.

집/프로필 native2 재검사14/14 PASS. 독립 화면 QA로 실제 home3·season4·profile4 PNG를 열어 가림/대상 간격/실루엣/문자 잘림을 확인했고 관찰 범위 새 결함0. 이는 전문 미술 검수나 사용자 시각 승인이 아니다. native1의 실제 깔끔이 실패를 이 결과로 덮지 않는다.

두 번째 build의 native3는31검사29 PASS/2 FAIL. 프로젝트 이름까지 grep에 포함되어 예정한 두 cold-radio 검사뿐 아니라 radio7개 전부 실행됐으며 모두 통과했다. 기존 radio3 PNG 경로는 이번 결과로 재사용되어 native3 결과를 별도 복사했고, 이전 회차 trace/video는 그대로다. 이후 radio screenshot 출력은 환경변수로 회차별 분리한다. 다른 새 화면/도감/라디오/닿지 않는 음식 사례는 PASS. 8성격 각각22초 이상 관찰했을 때7성격은10초 초과 의미 공백이 없었다. 호기심은0.52초부터 실제 음식통 목적 이동을 했지만 도착 후 toy 출현까지12.3초로 첫 성격 표현이 늦었다. 기존 관측기의 household 성격 제한이 이를 공백으로 분류한 점과 제품의 즉시 성격 인지 부족을 구분하여 새 비주력 job보다 due인 첫 성격 표현을 먼저 admission하도록 보완한다. 진행 중 목표는 끊지 않는다.

같은 native3에서 깔끔이는 toy2를4.8초에, toy4를16.433초에 실제 줍고 각각13.3/24.9초에 제거했으나 viewport 바닥에 내려간 나머지 두 개는65초 동안 반납하지 못했다. 단순 제거를 실제 입구 접촉 PASS로 기록하지 않는다. 마지막50ms 표본은 입구에서38.7/63.6px였고 도착→제거 사이가12ms라 끝점 관측도 부족했다. 자연 꺼내기의 소형 물체 바닥/궤적과 보이는 도착 hold를 보완한다. 일반 사용자 던지기나 전역 점프 한도를 검사 통과용으로 바꾸지 않는다. native3 JSON/PNG36개는 `behavior-native3-preserved`, 원본31개 trace/video/report는 `native-3`에 보존한다.

새 음식통의 자율 꺼내기에서는 고정 최소 수평 세기의 낙하지점이 실제 가까운 수령 위치를 지나쳐 proof가 실패할 수 있다. 일반 toss와 기존 성공 ejection은 그대로 먼저 사용한다. 실패한 ejection에만 같은 중력/높이/속도 상한/화면 경계/첫 하강 접촉 검사를 유지하며 실제 recipient를 겨냥한 제한 vx를 시도한다. 발판200 제한·실제 home-floor/높이 오차.5px/수령36px 범위는 유지한다. 수학 회귀10검사와 독립 수식/경계 source검수 PASS이며, 실제 자율 간식 출현은 후속 native에서 별도로 확인한다.

최종 source freeze: 새 job 전에8성격 모두 due인 첫 표현을 reserve한다. tidy/mischievous를 일괄 제외하면 빈 깔끔이도3.9% 기본 비주력 장난 추첨이 먼저 되는 경계가 있어 제거했다. 실제 owner·식사·입력·라디오 우선권은 유지하며 같은 tick cue 후보를 재사용해 RNG는 한 번만 뽑고 실제 launch만 의미 예산을 갱신한다. 첫 decoded 성격 표현 선행을8종 모두 검사하며 이후에는 공유 profile이 허용한 맥락 있는 집안일의 실제24px 전진/지상 이동/새 발판 착지만 의미로 인정한다.

작은 장난감 접촉은 같은 geometry scan의 기존 작은 home-floor snapshot 최대8span을 사용한다. 물체의 실제 ID/좌표를 유지하고 몸체가 설 자리만48px 이내로 별도 증명한다. 자연 꺼내기는 실제 출구에서 작은 실제 바닥을 향한 제한 vx를 쓰며, 일반 사용자 toss/drop과 전역 점프 한도는 유지한다. 상자 입구 도착 뒤132ms를 보인 다음 실제 stash ACK를 실행한다. 독립 검수에서 food44×38 packet과 toy44×44 hit의6px 차이를 지적해 집 바닥 한 곳만44×44로 보수적 보호했다. 달력 food44×38·snapshot/ID/개수/추가 DOM 읽기는 그대로이며42px 위 컨트롤과의 실제 hit 겹침 회귀 검사를 추가했다.

이 source freeze의 전체270파일2965단위 검사와 전체 lint PASS. geometry/food toss 집중74검사 PASS. 추가 독립 source 검수 open결함0. 최종 build/typecheck/harness/native4·실제 배포 결과는 아래에 별도 기록한다. native4 선택은 프로젝트 grep 문제를 고쳐 정확27개(새24+실제 음식통1+radio cold gesture2)로 확인했으며, 이전 실패를 덮지 않는다.

가구5·장난감8·풍경4·날씨겹침2를 builtin각1회 생성했다(재시도0). [공개 제작 기록](../../../art-src/빅타민/동행/작업회차/20261019-집가구풍경122/공개제작결과122.md)은 원본/파생/프롬프트/해시를 보존하고 사용자 원문·참조원본·세션식별자는 로컬에만 둔다. Runtime19종669,058bytes. 소파/기존 캐릭터 이미지 원본은 그대로다. 사용자 시각 승인이나 독립 전문 미술 검수로 기록하지 않는다.

native4는 정확27검사 중26 PASS/1 FAIL. 8성격 각각22.06–22.22초 실제 관찰에서 첫 decoded 성격 표현은0.613–1.106초, 최대 의미 공백은7.484초였다. UI14·실제 자율 음식통 출현·닿지 않는 음식 fallback·cold radio2도 통과했다. 깔끔이는4개 모두 실제 줍고 운반해11.082초 안에 제거했으나 마지막 실제 DOM 발끝의 입구 거리가20.743/6.384/42.066/15.816px여서 기존20px 조건에 실패했다. 첫 실패만 보고0.7px 경계 문제로 축소하지 않는다. 원본27개 trace/video/report와 `behavior-native4-preserved`를 보존한다.

원인은 장난감 물리 버튼에 전역 transform spring600ms가 재적용되어 매 프레임 모델 좌표보다 DOM 표시가 뒤따른 것이었다. 실제 모델의 입구 hold132ms로는600ms 시각 지연을 없앨 수 없었다. `.vc-toy` 물리 root에만 transition:none을 적용하고 자식 그림의 hover spring은 유지한다. 인접 food/actor는 이미 transition:none으로 보호됨을 독립 검수했다. native는 nonzero transform/all transition 금지·모델/실제 carried DOM 오차1px 미만을 추가하고 실제4줍기/운반/입구20px/제거 기준을 유지한다. 기존 모델58단위·spec lint PASS. 최종 CSS 이후 build/native5와 실제 배포 결과는 후속 기록한다.

## 최종 로컬 검증

2026-10-19 04:26 KST, 최종 build `oAXr9aAR59qYwsiJFASKG`에서 native5 **27/27 PASS**, retries0. 첫14개 UI/프로필·8성격 각22초 연속 관찰·실제4장난감 정리·실제 자율 음식통 꺼내기·점프OFF 도달 불가 음식·viewer/studio cold radio2를 모두 같은 빌드에서 확인했다. 물리 root의 실제 DOM/model 오차1px 미만과4개 각각 입구20px 미만 조건을 그대로 통과했다. native1/3/4 실패는 보존한다.

독립 raw attachment 재계산:8성격 첫 decoded 표현0.1215–1.1149초, 각22.0789–22.1474초 관찰, 최대 의미 공백6.9997초. 각 첫 표현은 새 job보다 앞섰다. 실제4장난감 carried 표본26/15/24/17개, 마지막 DOM 발끝→입구 거리는 모두0.000546px, carried DOM/inline paint 최대 오차0.0000414px였다. 실제4반납은11.5479초에 완료했다. 모델 예정 좌표만 읽어 물리 완료로 승격하지 않았다.

| Gate | Actual evidence | Result |
|---|---|---|
| 전체 단위 | `units-6-final.log`,270파일2965검사; CSS 한정 최종 수정 뒤 기존 모델58/58 추가 확인 | PASS |
| 전체 lint | `lint-4-final.log` | PASS |
| 전체 typecheck | `typecheck-4-final.log`, 최종 build 뒤 실행 | PASS |
| Production fixture build | `build-4-final.log` | PASS |
| Rendered/native | `native-5-final.log`, `native-5-report.json`,27 trace/video/attachments | PASS |
| Harness | `harness-5-final.log`,309문서; 최종 결과 문서 포함 후 재확인 | PASS |
| 역할·공개경계·UX·QA 교차 검수 | 독립 source/manifest 검수 새 open결함0; 생성자 검수/사용자 승인을 구분 | PASS within scope |
| G-22 | toy분류·inspect 고정 label, 실제 writer→timeline→least-used 단위 경로, 자율 행동/취향 전송 제외 | PASS |

`.scratch-pw/companion-122/` 아래 실행 로그와 `final-native5-freeze.json`에 근거를 보존한다. 마지막 제품/테스트/public54개 해시는 native5 종료 후 재확인하여 변경0이다. staging manifest103개는 보호 사용자 원화·과거 자산·raw 사용자 원문·로컬 절대경로·세션/계정 키·운영 분석을 포함하지 않는다. 독립 검수에서19종 original/final/runtime57해시·용량도 공개 제작 기록과 일치했다.

실제 배포는 아직 미검증. 서버/DTO/역할/인증/DB/운영 데이터/의존성 변경은 범위 밖이다. G-22 고정 의미 제어 이름만 허용하며 toy/food ID·취향은 분석 전송하지 않는다. 실제 PC/OBS와 인증/RLS 범위는 이전처럼 별도다.
