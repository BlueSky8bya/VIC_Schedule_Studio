# Google 캘린더 서식·편집창 위치 기억

2026-10-26 사용자 직접 요청. 신규 아이디어 발굴·채택 수로 세지 않는 후속 수정이다.

- 공개 일정의 Google 캘린더 링크: 첫 줄만 제목, 나머지 공개 하위 항목은 들여쓰기를 보존한 줄 목록으로 설명 칸에 넣는다. 기존 공개 설명은 빈 줄 뒤에 이어 붙인다. 한 줄짜리 긴 제목을 임의로 자르거나 구두점으로 추측 분리하지 않는다.
- PC 편집실 일정 편집 팝오버: 확정한 수동 드래그 위치를 같은 셸의 닫기·다른 날짜/일정 선택에도 유지한다. 새로고침/셸 재생성은 초기화한다. 옮긴 적 없는 창은 기존 자동 배치, 화면 크기/배율 변경은 가시 영역으로 보정한다.
- 계정 로그인/최종 저장은 Google의 기존 네이티브 흐름을 유지한다. 새 로그인·캘린더 API 쓰기·추적·설정 저장·DB 작업은 추가하지 않는다. 서버 공개 DTO, 최초공개 경계, KST 날짜, 편집 저장 큐/권한은 유지한다.

공유 writer 작업과 소스·빌드·출시를 겹치지 않는다. 최신 원격/배포를 반영한 소스에 적용하고, 관련 unit/type/lint/build와 credential-free rendered 검증 및 비작성 독립 검수를 거쳐 정확한 CI/Vercel/공개 fullSHA를 확인한다. 기존 실패와 원본 증거는 보존한다.

G-22: 기존 `add-google-calendar` 링크와 편집 제어를 그대로 사용한다. 고정 target·개발자 timeline/least-used 라벨·포인터/키보드 수집 의미는 변경하지 않는다. 설명/일정 본문/좌표를 활동 메타데이터로 보내지 않으며 자동 재배치·복원은 사람 활동으로 수집하지 않는다.

원요청·수정 전 공개 관측·선택 검사·원실패·독립 검수·출시 결과는 `C:/Users/im917/.codex/vic-pipeline/runs/20261026-google-calendar-format`에 별도 보존한다. [검증 범위](../verification/CALENDAR_FORMAT_EDITOR_MEMORY-20261026.md).

근거: [Google 공식 pre-filled event 링크](https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events#provide_a_link_for_users_to_add_the_event). 공식 문서는 `text`/`details`와 시간대를 별도 필드로 정의한다. 이것이 실제 계정 최종 저장·동기화나 전 기기 검증을 보증하지 않는다.
