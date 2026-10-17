# 빅타민 집 비가림 배치

Superseded in part by the latest owner request: [098](PLAN-20261018-098-companion-consistency-and-recovery.md) replaces this plan's reserved calendar row and scroll restoration with a compact floating room. The results below describe097 only.

Status: Completed — `ae3cfdddcc7f849d91c9c710b65abb3f5da8fa05` production verified. [Evidence](../verification/COMPANION_HOME_SHELF-20261018.md): native20, main unit2,087/typecheck/lint/build/harness254, independent source/raw/security blocking0, remote quality13/Vercel success, full SHA/API canaries and actual developer studio/viewer preview overlap0. OBS hardware/all devices/RLS and096 focus gap remain separate. Post-release status stays local to avoid a docs-only redeployment.

소유자: 접힌 패널의 우하단 집 버튼/펼친 박스가 일정을 가린다. 위치·크기·여러 화면/상태를 함께 개선한다. 기존044의 compact fixed 위치만 대체하며 단일 집/펫·설정·소파/음식 기하를 유지한다.

- 닫힌 compact 진입은 일정 밖 상단 크롬에 둔다. PC 헤더의 공통 slot을 쓰며 기존 capability가 제외하는1040px 이하 agenda/모바일은 미마운트다. 초기 조사에서900px PC agenda도 활성이라고 추정한 부분은 실제 `capability.ts` 확인으로 정정한다. 중복 진입/기록 누락을 만들지 않는다.
- 펼친 compact 집은 헤더 다음·달력 앞 문서 흐름의 선반을 차지한다. 달력을 덮거나 글자를 작게 만드는 대신 같은 가독 크기로 아래에 이어지며 페이지 스크롤을 허용한다. 옆 패널이 실제 펼쳐지면 기존 패널 집을 쓴다. 패널/집 닫힘, 좌우, 짧은 높이, agenda, 미리보기 왕복에도 같은 규칙이다.
- 폭은 공유 side-panel 토큰과 사용 가능 폭에 맞춘다. 실내132px·펫92px·소파 좌석·음식/쓰레기통 실제 hitbox는 보존한다. studio CSS zoom은 slot 좌표계에서 상쇄해 화면상 크기를 맞춘다. 렌더마다 DOM 측정/상시 RAF/새 모델·서버 요청은 추가하지 않는다.
- 안정적인 header launcher의 expanded/controls/focus, launcher/X/Escape 닫기, 명시적 열기 시 보이기·닫기 시 이전 문서 위치, 감소 동작을 공통 구현한다. 집 제목은 기존의 저장되는 본문 접힘을 유지한다. 집 이동 뒤 기존 유한 layout/home 알림으로 소파 전경·거주자·집 음식이 함께 따라가게 한다. 최초공개의 퇴장/입장과 모달 inert/레이어는 유지한다.
- 검증: 이전 fixture에서 실제 가림 면적 재현 후 같은 역할/폭의 수정본으로 launcher/집 vs 일정/날짜/탐색의 실제 교차0, viewport clipping/컨트롤 크기·focus를 확인한다. viewer/anonymous/studio/preview 공통 연결,1480×938·1280×720·PC agenda·1680 경계·1920·초광폭/zoom, panel좌우·열기/닫기·scroll·음식/거주/앞림·모달·premiere·모바일 제외를 관련 rendered 검사로 확인한다. 실패·미실행은 분리한다.

공개 DTO/역할/언락/KST/DB/의존성은 변경하지 않는다. 사용자 아트와096 배포 후 로컬 메타데이터를 보존한다. 독립 소스/QA 검토 후 main 통합·typecheck/lint/unit/build/harness 및 계속 승인된 commit/push/운영 확인을 수행한다.
