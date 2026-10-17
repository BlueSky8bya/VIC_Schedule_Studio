# 빅타민 집 첫 표시와 소파 조작 피드백

Status: In Progress.

소유자: 새로고침 때 집의 거대 검정 실루엣을 고치고, 소파 hover/누름을 분명하게 만든다. 정상 식사 경로는 유지한다.

- 진단: 집 CSS는 dynamic renderer 아래 child의 import에만 있다. 창문/선반 등 SVG는 viewBox만 가지며 치수·색·배치를 CSS에 의존한다. 첨부는 그 CSS 미적용과 일치하지만 실제 운영 네트워크 실패/레이스의 정확한 원인은 별도 재현으로 구분한다.
- 수정: 같은 home CSS를 public/studio의 초기 스타일 경계에서 싣는다. JS/runtime/아틀라스 지연 로딩은 유지하고, SVG의 명시 치수/기본 fill로 비정상 기본 크기도 방어한다. 소파는 실제 좌석·앞면과 공유하는 기하/transform을 바꾸지 않고, 작은 집 아이콘·hover/focus/pressed 색과 명암으로 조작을 알린다.
- 검증: production fixture에서 CSS 지연·저장 ON·실제 새로고침·첫 visible frame·양쪽/light/dark를 확인한다. 실제 pointer/keyboard 피드백과 버튼/그림/2px 좌석·앞면 기하 불변, 기존 집/음식/귀가 및 정상 식사 회귀를 확인한다. 전체 unit/typecheck/lint/build/harness·독립 검토 뒤 승인된 후속 commit/push/실제 배포를 검증한다. 미재현 원인은 확정하지 않는다.
- 경계: 공유 구현/모바일 제외·공개 DTO/역할/언락/KST/1840·운영 DB·의존성·사용자 아트는 변경하지 않는다. 새 상시 loop/timer/서버 요청은 없다.093의 정상 식사와 조건부 사고 분기는 변경하지 않는다.

검증 결과: old fixture의 실제 CSS1초 지연에서 검정 첫 표시66/89표본 재현. 수정 production fixture `XmSLc3XjlOzkGSpiqElOx` build/typecheck/lint, 전체 unit2,001·native17(첫 표시/재진입/조작6, 소파/전경2, 실제 정상 식사1, 모바일 제외8)·harness248 PASS. 독립 원본 감사1,329가시표본 경고0·CSS gate12회·trusted click12회·기하 변화0px, 소스/검사 독립 차단0. 구형6초 전역 귀가 가정은 실제 단거리 바닥 배치로 정합화하고 기존 도착 시간·레이어/식사 단언은 유지했다. 원격 배포 확인 대기. 상세 [검증 기록](../verification/COMPANION_HOME_FIRST_PAINT-20261017.md).
