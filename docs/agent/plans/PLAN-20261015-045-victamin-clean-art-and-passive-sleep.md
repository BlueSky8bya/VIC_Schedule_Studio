# 빅타민 작은 화면 그림과 방송 성능

2026-10-15 KST. 사용자 요청으로 구현. PLAN-044의 집·돌봄·공개 데이터 경계를 계승한다.

- 사람이 보라 하트를 처음 누르면 로컬 하트만 비운다. 실제 투표·카운팅·API 호출 없이 그 클릭을 소비한다. 다음 클릭은 기존 투표이며 빨간 하트 동작은 유지한다.
- 빅타민 원래의 두 긴 귀·무사지·크림색 사각층·주황 네모 볼을 유지하되 작은 크기의 얇은 세부선과 프레임별 윤곽 소음을 줄인다. VIC 이미지 규칙에 따라 실제 원본 열람·단일 제작·native 보존. 많은 서로 다른 그림보다 소수의 일관된 키 포즈와 연속 이동을 쓴다.
- 다른 창으로 초점이 옮겨진 visible 상태는 hard pause와 분리한다. 현재 유한 행동 완료→짧은 휴식→하품→현재 위치 수면. 새 행동 선택·욕구 갱신·rAF·기하 관측을 끄고 CSS transform/opacity의 작은 수면 표현만 남긴다. 초점 복귀 시 기하를 다시 읽고 자연스럽게 깬다. hidden 탭/모달/최초공개/장면 감상은 기존 안전 중단을 우선한다.
- full 이동은 최대60Hz, lite는30Hz, 정지 상태는 저주기. OBS와 함께 쓰는 환경을 고려해 중복 DOM 쓰기·잦은 전체 측정·텍스처 크기를 줄인다. 실제 OBS 장비 보장은 하지 않고 브라우저 측정값과 한계를 기록한다.
- 공개DTO/권한/unlock/KST/1840 export기하·DB 변경 없음. 시청자/비로그인/미리보기 단일 구현, 기본OFF 유지. 기존 사용자 미커밋 파일 보존.

검증: 하트 실제 핸들러 차단/다음 클릭/키보드·중복ID, 행동 중 blur/빠른 복귀/수면 중 resize·설정변경/hidden·모달, full/lite/reduced, PC/agenda/터치. 성능은 일정 이동과 parked sleep의 rAF·JS·layout·asset 비용을 비교한다. 관련 unit/렌더/type/lint/build, 독립 코드 리뷰, harness 기존 실패 분리. 승인된 commit/push 후 실제 배포 SHA와 PC·모바일 확인.

상태: 완료. 제품 `b005a6dd` commit/push·Vercel success/live SHA 일치·운영 atlas SHA 일치. 제품 단위106/문서43/화면54·type/lint/build·native 파생 재현 통과. 실제 루트local2뷰·운영집2뷰·운영새하트/수면2뷰·고립 비용9표본 확인. 기존 harness2실패 유지. 실제OS focus/OBS 동시송출 장비는 미검증. [검증 기록](../verification/VIEWER_VICTAMIN_PASSIVE_SLEEP-20261015.md).
