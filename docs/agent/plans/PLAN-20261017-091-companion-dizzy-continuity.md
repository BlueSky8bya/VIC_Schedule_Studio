# 빅타민 흔들기 감도·낙하 표정·회복 연결

Status: In Progress.

Local verification complete: fixture `COhDP-yWtcC2J1ll649l3`, unit1,954·rendered39·build/typecheck/lint·harness242 PASS, independent final blocker0,28-file source equivalence. Remote quality/Vercel/deployed-result verification pending. [검증](../verification/COMPANION_DIZZY_CONTINUITY-20261017.md).

소유자 후속 요청: 덜 흔들어도 빙글빙글 눈이 나오고, 놓은 뒤 실제 낙하 중에도 유지하며, 착지 후 정신 차리는 동작의 끊김을 줄인다.089의 강한 판정/낙하 중 일반 얼굴/짧은 회복만 대체하고090의 더블클릭 제거와 이전 귀가·편집창 닫힘 수정을 보존한다.

- 실제30px·300px/s·유효 반전2회와 세 번째 stroke·280ms로 완화한다. 한 번 옮김/한 번 왕복/작은 떨림/느린 이동/이벤트 폭주/역행 시각은 제외하고16ms 격자·bounded history·공백 latch·취소/새 집기 초기화를 유지한다.
- 잡힌 물리는 row8, 놓은 뒤 물리는 실제 첫 발판의 기존 중력/row5·6/landing이다. 표시는 마지막 빙글빙글 key를 낙하→착지 첫 회복에 이어 둔다. 실제 collision·world point·pivot·소파 레이어를 표정 때문에 바꾸지 않는다. 새 명령/취소/모달/blur/pause/공연/감소/OFF의 우선권은 유지한다.
- 회복은 shake 전용 유한 타임라인과 기존 pose plane의 연속 감쇠 lean/compression을 사용한다. native22의2그림·23의4그림을 단순 지연 재생하지 않고 안정된 빙글빙글→짧게 눈 감음→정상 눈의 전환을 작은 연속 동작으로 잇는다. 기존 bonk/tumble 등의 회복은 유지한다. 픽셀 자체 보간/새 그림을 만들었다고 주장하지 않는다.
- 드래그 첫 실제 집기에서22, 실제 어지러움 시작에서23을 기존 decoder로 미리 읽어 cold recover 후반 건너뛰기를 막는다. 현재2 in-flight/3 retained·exact decoded image·실패시 기존 몸체 유지 경로를 재사용한다. 새 image consumer·clone·canvas·상시 loop·timer·React 프레임 갱신은 추가하지 않는다.
- 독립 검토 후 격리 production fixture에서 완만한 흔들기→held/낙하의22→연속 회복→정상, 단발/취소/새 집기/감소/OFF·기존 중력/관성/모달 소유권을 확인한다. full unit/typecheck/lint/build/harness, main 소스 일치, 원격 검사와 실제 배포 SHA를 구분한다. 공개 DTO/역할/언락/KST/1840 포스터·모바일 제외·사용자 아트를 보존한다. 테스트는 합성 fixture와 차단된 쓰기를 사용한다.

같은 빅타민 수정/운영 배포의 후속으로 검증 뒤 관련 코드/기록만 commit/push한다. 실제 OS/OBS/RLS 전수 증거로 확대하지 않는다.
