# Google 캘린더 서식·편집창 위치 — 검증

2026-10-26 후속 사용자 요청. 최신 배포 `f23417de`를 반영한 소스에 두 변경을 적용했다. 검수와 신규 아이디어 발굴을 합산하지 않으며, 이번 두 항목은 직접 요청한 구현이다.

수정 전 실제 공개 버전 `4c4002aa`: PC1440/모바일390의 같은 공개 일정에서 Google 링크 `text` 6줄·78자, `details` 없음 확인. 첫 줄 제목과 공개 하위 항목을 별도 필드로 분리하는 근거다. 원관측은 `public-before-readback.json`에 보존했다. 읽기 전용 새 브라우저이며 운영 쓰기·Google 로그인·최종 저장은 실행하지 않았다.

실행 완료: 관련 unit 6파일·47개, typecheck/lint/harness와 production build 통과. 선택 native 15개 모두 새 실행 PASS, 실패/재사용/미실행 0, 전체 native 실행 126.461초. Build `JQTlS6wIdAmBxrzwa87c5`; 원영수증 `C:/Projects/VIC-worktrees/20261026-daily-review/.scratch-pw/site-daily/native/2026-10-26-1792986780735-f1ddd6dc/result.json`, SHA256 `75cbbca07a8c832bb998614430f7426da9df7ccdcbc15df35526332fe6557c5c`. `verifyRun` 무결성·현재 제품/검사 바이트·추출 화면30장 확인.

실제 화면 범위:

- viewer/preview ×1440/390, 각3개 공개 fixture: 첫 줄 제목과 기존 공개 설명·한 개/여러 하위 항목이 Google `text`/`details`로 각각 전달됨. PC Enter·모바일 pointer 새 탭 이동, 원래 상세/주소 유지. Google 목적지는 안전한 합성 GET으로 검증했다.
- owner/developer ×1440/1920: 실제 드래그 후 X/Esc로 닫기·다시 열기·다른 날짜·기존 일정 선택에도 위치 유지. 새 앵커·연결선 양 끝과 재열기 준비 좌표 확인. 1200×900으로 바꿔도 창/앵커/선 정상, 새로고침 후 자동 위치로 초기화. 옮긴 적 없는 편집창의 자동 배치2개 유지.
- 기존 태그 비우기·명시적 합성 저장4개, studio 유휴 geometry loop·scroll/resize/drag1개 회귀 통과. 날짜/KST/공개·최초공개/잘못된 입력·비공개 canary는 관련 단위로 확인했다.

G-22 기존 고정 target·개발자 표시 검사를 포함했다. 새 활동 수집·본문/좌표 전송은 없고 자동 위치 복원도 사람 활동으로 세지 않는다. 실제 Google 계정 저장·운영 DB·실기기·실로그인/RLS·생활 AI/full200/정상36 검증으로 확장하지 않는다. Companion OFF이며 readiness는 실제 재열기 좌표/transform-origin으로 확인한 범위다.

독립 소스 검수는 차단 결함0; 최종 원영상·관측·화면 검수와 실제 CI/배포 결과는 `C:/Users/im917/.codex/vic-pipeline/runs/20261026-google-calendar-format/independent-review.json`, `checks-summary.json`, `release-confirmation.json`의 실제 결과를 읽는다. 파일 이름/등록은 실행 증명이 아니다. 모든 원관측·영상과 이후 실패가 있다면 그 원결과를 그대로 보존한다.
