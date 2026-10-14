# PLAN-039 — 기대에 반응하는 원본 배경

Status: complete; `e63261e5` deployed and production3-view smoke verified. Owner request 2026-10-15 KST.

- 원본 `28241791931065693.png` 전체 비율을 보존한 WebP를 무대 배경으로 사용. 얼굴 생성/합성 없음.
- PLAN-038의 하단 사진 교체/깜빡임을 대체. 하단은 빅타민만, 기대 중인 공개 전 일정이 하나라도 있으면 배경 사진이 은은하게 나타남. 모두 취소하면 페이드아웃. 로드 실패는 배경 없이 기능 유지.
- 기존 지휘자의 퇴장값으로 마지막 10초 전에 사진도 사라짐. 공개 후/숨김 탭/동작 줄이기에서 추가 루프나 섬광 없음.
- 상세 팝오버 공개 시각은 T−185~180초에 투명도와 실제 행 높이가 함께 줄어듦. 60초 링에서 시각을 다시 표시하지 않음. 미룸은 같은 공용 시계로 복원.
- 공개 DTO/권한/KST 포맷/기대 쓰기 경로/1840 포스터 기하는 유지. UI는 공용 시청자 구현에만 수정.
- 검증: 타입/린트/빌드, 합성 fixture의 PC·모바일·가로 렌더, 여러 기대/빠른 취소/느린 이미지/마지막 10초/시각 접힘과 미룸, 독립 코드 리뷰. 운영 데이터 쓰기 없음.

Verification: typecheck/lint/build, unit78, rendered58 and local root3-view smoke passed. Existing harness inventory2failures recorded. [검증 기록](../verification/TEASER_WISH_BACKDROP-20261015.md).
