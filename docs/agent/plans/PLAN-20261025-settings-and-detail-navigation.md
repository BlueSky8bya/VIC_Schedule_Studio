# 채택안: 좁은 설정 탭과 공개 상세 연속 탐색

2026-10-25 사용자가 두 제안에 “그렇게 수정해”로 채택했다. 기존 실제 UI·독립 검수·배포 권한으로 완료까지 이어간다. 원 발굴 보고서와 실패를 보존하고 새 발굴로 중복 계상하지 않는다.

- `design:mobile-settings-category-navigation`: 공용 설정의 기존 항목/선택 상태를 재사용한다. 좁은 컨테이너는 가로 탭, 넓은 곳은 기존 세로 탭. 선택한 묶음만 보이고 실제 모바일 미지원/역할 전용 항목은 기존 범위를 지킨다. 2026-10-06의 좁은 창 전체 세로 목록 조항을 이 채택 범위에서 대체한다. 수첩 전용 화면·설정 저장·견본·모션/OFF는 유지한다.
- `calendar:consecutive-public-event-detail-navigation`: 해당 월과 현재 필터의 공개 일반 일정만 날짜/같은 날 수동 순서로 탐색한다. 다일 ID 중복 제거, 지원/기간/미공개/비공개/draft 제외, 첫/끝 비활성, 1개 이하에서는 행 생략. 기존 상세·카드 앵커/강조·공유 주소·닫기/포커스 복귀를 재사용한다. PC의 기존 바깥 카드 직접 선택은 유지한다. 자동 월 이동/새 요청/순환은 없다.

제품 입력이 달라지므로 새 불변 빌드 한 번과 관련 native 관찰을 실행한다. 실제 동작과 타입/린트/관련 단위/빌드/문서, G22 고정 제어의 capture→timeline/least-used 표시, 비작성 독립 검수, 원격 품질/운영 fullSHA를 검증한다. 소스와 테스트 fingerprint가 달라지면 관련 과거 PASS를 재사용하지 않는다. 실패·trace·정상속도 영상은 원본 보존한다. fullCertification=false, 정상36 UNVERIFIED.

현재 상태와 실행/실패/완료 원기록은 primary `.scratch-pw/site-daily/state.json` 및 preferred source의 `accepted-navigation-20261025`에 저장한다. 새 API/DB/로그인/추적/의존성/모델 실행/QA 삭제는 범위에 없다. fixture가 실제 로그인·RLS·물리 기기를 증명하지 않는다.
