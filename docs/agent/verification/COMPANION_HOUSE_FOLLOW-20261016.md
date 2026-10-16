# 집 이동 시 소파 앞면 정렬·편집실 패널 순서

2026-10-16 KST. [PLAN-067](../plans/PLAN-20261016-067-companion-house-follow.md). 진행 중. 사용자 미술26줄·보류 자산·기존 증거를 보존한다. 서버/공개 DTO/DB/역할·unlock·KST·1840·이미지·기존 행동 cadence는 변경하지 않는다.

## 재현과 원인

고정 소파 앞면은 기존 집의 절대 좌표 캐시를 쓴다. 기존 frame follow는 현재/목적 발판2개만 읽고 `companion-home`이 그 쌍에 있을 때만 침대 좌표도 옮겼다. 따라서 펫이 달력이나 집바닥에 있으면 패널의 실제520ms FLIP을 앞면이 따라가지 못했다. 집 자체를 접을 때도 DOM은 연결돼 있고 앞면 숨김이 집 거주 펫에만 적용돼 밖의 펫 상태에서는 앞면이 남을 수 있었다. CSS 잔상 효과가 아니라 좌표 소유권 누락이었다.

수정 전 production build `Nkungp4UPThbx5yG57aBG`에서 native 태그/계절 접기·펼치기만으로4개 모두 정렬<1px 단언이 실패했다. Viewer 외부349.993px, Studio 외부268.919px, Viewer lite/controlled-parked 집바닥243.213px, Studio reduced/controlled-parked 집바닥292.828px의 최대 오차를 기록했다. 이4개는 원인 재현 성공이지 상품 QA PASS가 아니다. Mutation/pageerror0, 원래 raw/trace는 `.scratch-pw/companion-067-baseline-*`에 보존한다.

## 수정과 독립 검토

- 같은 shared engine에서 기존 유한 추종 창 안에 retained seat anchor를 추가한다. 기존 home sample이 있으면 재사용하고, 없으면 그 anchor의 BCR1회만 읽는다. 전체 selector/Range 재측정이나 새 loop를 만들지 않는다. 집만 움직여도 paint하고 집 자체 접힘은 밖의 펫을 숨기지 않고 앞면만 해제한다.
- 독립 검토가 침대 캐시만 옮기면 오래된 좌석 플랫폼을 depth/놓기에서 쓸 수 있음을 지적했다. 실제 `bed.anchorY`를 깊이 평면으로 쓰고, 쌍에 없는 home의 캐시 플랫폼과 seen 기준도 같은 delta로 한 번만 옮긴다. 이후 쌍에 들어와도 이중 이동하지 않게 한다.
- 독립 검토가 패널 이동 중 창을 열 때 기존 follow 취소로 집 주민과 앞면이 나머지 FLIP을 놓치는 경계를 지적했다. `overlayHomeResident`만 이미 열린 유한 deadline을 마저 소비하고 표시 perch를 같은 world 위치로 맞춘다. 일반 창/발견 guest·hard pause/숨김/최초공개 소유권을 완화하거나 deadline을 연장하지 않는다.
- 편집실 PC 실제 rail과 표시되는 준비 전 fallback 모두 도구→태그 필터 순서로 재배치했다. 같은 기존 slot 안 계절→집 순서는 유지한다. 기존 필터 재질은 section first-of-type으로 선택해 새 첫 도구 div와 구별한다. 모바일 별도 render/설정 헤더 위치·빅타민 미마운트는 유지한다.

## 검증 상태

진행 중. 첫 후보 `Kf46N6irB7X7xT4Kyf7Mt`의25개는20통과/5실패였다. 신규3개에서 수백 프레임 중 한 프레임씩3.033/11.819/5.530px가 어긋났으며 오차는 정확히 이전 표시 프레임의 집 위치였다. 기존 follower의 두 번째60Hz gate가16.5ms display rAF를 건너뛰는 것을 확인해 제거했다. 실제 집 이동/재측정의 `bedNeedsPaint`를 그리기 시작에 소비해 이미 main이 표시한 앞면은 follower에서 중복 표시하지 않는다. 새 loop·brain cadence 변경은 없으며 유한 패널 구간만 실제 화면 주사율을 따른다. 고주사율에서도 비용이 항상60Hz라는 주장은 하지 않는다. follower가 main보다 먼저 실행된 일부 프레임에는 같은 프레임 내 full paint가 두 번 가능하며, 이를 없애려고 한 프레임 지연을 다시 넣지 않는다.

나머지2개는 실제 집/HD 마운트 전에 한 번 호출한 settle 뒤 첫 입력을 시작해, 집의 초기 entrance와 첫 geometry delivery가 아직 진행 중이었다. viewport 밖/scroll 문제는 실측으로 기각했고 당시 실제 지원 부재 안내 또는 실제 seat보다13.266px 아래에서 cushion 선택을 기록했다. 별도 진단의1.4초 jump 중 snapshot은 완료 실패로 단정하지 않는다. 검사 목적에 맞게 실제 집/HD 마운트 후 finite entrance 종료를 기다리고, 실제 BCR이140ms 안정됨을 관찰해 기존120ms geometry coalesce를 지나도록 setup만 보완했다. blind sleep/retry·임계값 완화는 하지 않았다. 원래5실패 raw와 별도 진단은 보존한다.

수정 빌드 `-6kbZqdlzgpU8pCesnZsM`에서 순차 typecheck·lint·build exit0, 관련 unit38파일428개 통과. 같은 native 회귀25개(신규 집6·소파3·프레임4·모바일 헤더4·모바일 제외8)는25/25, 실패/재시도/skip0으로 완료했다. 전체 앞면 정렬 최대0.015656px, 집바닥/쿠션/controlled parked의 실제 발판 접촉 최대0.000550px로 기존<1px 기준을 유지했다. Native 검색 진입/종료, 집 자체 접힘/밖 펫 유지, 같은DOM, Studio 실제 순서, 유한 tail 뒤 DOM 쓰기0도 통과했다.

신규 oracle은 renderer rAF 전체 뒤 task에서 실제 침대/고정 앞면 BCR과 실제 resident 발판을 독립 측정한다. DOM 유지·진짜 집 이동>20px·정렬/접촉<1px, 집 자체 접힘 해제, native FLIP→80ms 안 검색 열기, Studio DOM/실제 wrapper 순서, lite/reduced·유한 종료 후 DOM 쓰기0을 검사한다. controlled-focus parked는 명시적 fixture 분기이며 실제 OS focus loss/OBS 송출 검증으로 부르지 않는다. 모든 mutation은 차단하고 preview의 기존 공개 read-action만 public fixture로 로컬 응답한다. 현재/미래 달 시험 일정 생성0이다.

최종 raw/report/PNG는 `.scratch-pw/companion-067-final-v2-*`, 소파는 `companion-067-final-sofa-v2-*`, 기존 프레임은 `companion-067-final-pipeline-v2-*`, 헤더는 `companion-067-final-header-v2-*`로 분리해 과거 결과를 덮지 않았다. 정렬 수치는 `companion-067-final-v2-metrics.json`, 검사 소스5파일의 줄바꿈 정규화 SHA256/빌드는 `companion-067-final-source.json`에 기록했다. 독립 소스 검토는 초기2개 깊이/창 tail 결함을 보완한 뒤 차단 문제0이다.

`npm run harness:verify`는 기존 rule inventory 불일치2건으로 exit1이다. `Active rule IDs changed; update RULE_MIGRATION inventory and mappings`, `RULE_MIGRATION inventory table differs from live rule IDs`를 PASS로 계산하지 않는다. 이번 작업에서 rule ID를 추가/삭제하지 않았다. 실제 OAuth/RLS/실기기 notch나 실제 OBS/GPU/encoder 송출 품질 보증은 이번 정렬 검사 범위가 아니다.
