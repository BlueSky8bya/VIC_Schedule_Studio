# 창을 열어도 보이는 빅타민

2026-10-15 KST. 사용자 최신 요청으로 일반 창을 hard hide하던 이전 정책을 대체한다.

- 일정 상세 팝오버·검색·기록·설정 등 일반 창의 표시와 입력/활동 상태를 분리한다. 빅타민 DOM·원래 발판을 보존하고 창 위의 조용한 비상호작용 동행으로 남긴다. 기존 동작을 유한하게 끝내고 쉬도록 기존 presence를 재사용한다.
- 일반 창 때문에 생긴 ambient pause는 계절 배경에 유지하며 빅타민 숨김 명령으로 쓰지 않는다. hidden tab·배경 감상·최초공개 무대는 기존 hard pause를 유지한다.
- 현재 자리에서 창을 가리면 실제 창 rect 소수로 가까운 여백에 표시하고 닫으면 실제 발판에 복귀한다. viewport/동작 줄이기·작은 화면에 대응한다. 표시는 작아질 수 있으며 빈 공간이 전혀 없으면 작은 비상호작용 모서리 표시를 쓴다.
- 창 동안 pet/food/home 입력, pointer capture·배치·옛 click guard와 초점 되찾기를 차단한다. 창의 타이핑·버튼·닫기·Tab을 방해하지 않는다. 음식/돌봄 데이터는 로컬로 보존한다.

공용 viewer/anonymous/preview 한 구현. 서버 DTO·권한·unlock·DB/KST·1840 표면 변경0, 원화 변경0. 구현 전후 현재 규칙/토픽 정정. 단위/type/lint/build, PC/390 실제 네 창·sameDOM/가시성/초점/입력통과·유한 뒤 quiet·hardhide 유지 검사. fixture/과거 월·POST 전부차단, DB 시험 데이터0. 독립 검토 후 승인된 commit/push·운영확인.

상태: 로컬 검증 완료, 배포 대기. 결과는 [검증 기록](../verification/VIEWER_VICTAMIN_VISIBLE_OVERLAYS-20261015.md)에 둔다.
