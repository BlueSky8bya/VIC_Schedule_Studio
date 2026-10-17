# 일정 편집창을 닫은 뒤 빅타민 표시 복구

Status: Complete — locally integrated and verified; included in the later owner-authorized089 release, deployment verification pending.

소유자 보고: 편집창이 열리면10일 오른쪽 아래에 잠든 빅타민이 보이지만 창을 닫으면 사라진다. 실제 원인을 재현하고 수정한다. 현재 운영ecaa940f와 사용자 아트/사후 문서 작업을 보존한다.

후속 소유자 요청으로 커밋/푸시/배포 범위가 추가됐다. 아래087 단독 단계의 미배포 기록은 당시 증거이며, 현재 통합 릴리스는 [089](PLAN-20261017-089-companion-shake-release.md)에서 검증한다.

- 일반 창의 세계 위치/발판 유지와 숨바꼭질 게스트 추출을 구분한다. 강제 밀어내기·옛 위치로 자동 귀환·모바일 펫을 복구하지 않는다.
- native 일정 열기/닫기 전후 실제 좌표·지원 발판·숨김/수면/geometry 상태와 DOM 정체성을 관측한다. 충분한 수동 카드 상단뿐 아니라 텍스트/날짜/스크롤·활동 중 닫힘을 확인한다.
- 기존 공유 renderer와 geometry/presence/착지 경로로 원인만 보완한다. 새 상시 loop/DB·API 호출/역할·언락·공개 DTO 변경이 없다. 포스터1840 기하와 KST, 감소 동작/gfx, 집/음식/최초공개를 보존한다.
- production-build fixture와 POST·prefetch 차단을 사용한다. 실패 증거를 먼저 보존하고 typecheck/lint/관련 unit/전체 unit/build·실제 상호작용·독립 검토·문서 harness를 확인한다. 실제 로그인/RLS/OBS 장비 전수 증거로 확대하지 않는다.

[검증 기록](../verification/COMPANION_EDITOR_CLOSE-20261017.md): 보이는 비활성 창에서 첫 발판 측정 실패 후 parked 관측까지 종료되는 원인을 수정 전 FAIL로 확정했다. 기존 전환 기간의 유한 관측과 최종1회 검사로 복구한다. 독립 검토에서 재무장/관찰 잔존 경계를 수정한 뒤 차단0, build·typecheck·lint·전체 unit1,933/1,933·화면19/19 PASS를 확인했다. 새6개는 화면 안 동일 위치 단언을 보강한 뒤 재통과했다. 메인에 renderer/회귀 검사만 통합했으며 운영은ecaa940f다. 이번 수정 요청에 별도 커밋/푸시/배포는 포함하지 않는다.
