# 채택한 태그 비우기·Google 캘린더와 상세 제어 철수

2026-10-26. 기준 배포 `1c4a1b57fa31c161cdc90cc47e492e3e0fce4c33`의 모바일 헤더를 보존했다. 필터 표시 배지와 그림판 월 선택은 사용자가 거절했다. 새 채택은 현재 초안 태그 비우기와 Google 캘린더 추가다. 최초 ICS 제안은 Google 방식으로 대체됐으며 이전 제안·승인·배포 보고서는 그대로 보존한다.

## 구현

- PC/모바일 편집실의 같은 버튼·핸들러가 현재 초안의 tagIds/primaryTagIds만 비운다. 제목·옵션·다른 일정·태그 정의·달력 필터를 유지하며 기존 저장을 눌러야 반영한다. canEdit·저장 직렬화를 보존했다.
- 공용 공개 상세는 링크 복사·피드백·수동 주소 입력과 이전/다음/순번을 없앴다. 그 자리에 설명 문단 없이 `Google 캘린더에 추가` 하나를 둔다. 본문·태그·관심·최초공개 경계와 기존 URL 도착·기록 복귀는 유지한다.
- Google 공식 미리 채운 일정 URL은 공개 DTO의 제목/설명/날짜만 명시적으로 쓴다. Google의 브라우저 계정/로그인과 마지막 저장을 이용하며 새 OAuth 권한·계정 수집·캘린더 API 쓰기가 없다. 명시한 시간 구간은 정확한 UTC 순간과 KST를, 종일/기간은 종료일 다음날의 배타적 종료를 쓴다. 종료 시간이 없는 일정은 임의 종료 시간을 만들지 않는 날짜 단위다. 비공개/가림/지원/빈 제목/잘못된 날짜는 전달하지 않는다.
- G22 신규 고정 대상2개는 수집기·행동 타임라인·적게 쓰인 기능 양쪽 표시를 검증했다. 철수한3개 이름은 역사 기록에 남고 현행 후보와 분리된다. 운영 이용 통계를 새로 조회하지 않았다.

## 실제 로컬 검증

타입·린트·관련 단위61건과 문서 harness를 확인했다. 공유 PC/390px 시청자·미리보기, owner/developer 편집 초안 저장, 공개 URL/reload/Back/포커스, 다일 일정·필터·최초공개, 기록 X/Esc/Back·스크롤 복귀를 포함한 고유37건이 같은 최신 제품 빌드에서 유효하다. 최신 attempt는 실제8건 PASS와 영수증/불변 빌드/의존성을 확인한29건 reused다. 재사용을 새 관측으로 세지 않는다.

빌드 `kIVKDiSPcuwTrvCwqsmxx`. 최종 영수증: `.scratch-pw/site-daily/native/2026-10-26-1792983623197-18a5ac43/result.json` SHA256 `4f60c05cfc849754637a691643d79d752c6041ea0bda63964e8b76b549230721`. 소스/빌드 무결성·네트워크 guard·소유 프로세스 종료를 확인했다. 작은 PNG/facts 인덱스는 `.scratch-pw/site-daily/detail-controls-retirement-20261026/inspection-final`, 검증 요약은 durable run의 `native-verified.json`이다.

독립 소스 검수에서 발견한9999년 종료 범위와 불가능한 종료일 보정을 먼저 실패 단위2건으로 재현하고 fail-closed로 수정했다. 초기 UI 실패3건은 이전 기록 닫기 선택자2건과 시간 있는 fixture를 종일로 가정한 검사1건, 다음 실패2건은 PC contenteditable에 input 전용 단언을 쓴 검사 오류였다. 원 FAIL/report/trace/영상과 중단·미실행을 보존했다. 제품 helper 변경 때문에 새 빌드를 만들었고, 이후 검사 코드만 고칠 때는 검증된 빌드를 재사용했다. 성공 retry로 원결과를 바꾸지 않았다.

미로그인 합성 일정 URL의 실제 읽기는302로 `accounts.google.com/ServiceLogin`에 도착했다. 화면의 키보드/포인터 새 창 이동은 정확한 Google 목적지만 합성 응답해 확인했다. Google 계정 로그인·실제 저장은 실행하지 않았다.

## 독립 검수·출시 근거

고정 원기록: `C:/Users/im917/.codex/vic-pipeline/runs/20261026-detail-controls-retirement`. 비작성 최종 검수는 `independent-review.json`, 정확한 commit/원격CI/provider/공개 fullSHA와 실제 공개 동작은 `release-confirmation.json`·`public-readback.json`을 대조한다. 이 파일이나 파일 해시는 실행·채택·배포 성공의 자체 보증이 아니다. 원격 출시 확인이 없는 시점에는 미검증이다.

10분 임시 continuation `automation-2`는 공용 화면 대기가 끝난 뒤 앱 도구로 삭제했다. 기존 오전9시 작업은 변경하지 않았다. 개인정보/운영DB/새 의존성/새 로그인·모델·유료 서비스 작업은 수행하지 않았다. fixture·viewport 검증은 실제 로그인/RLS·기기 검증이 아니며 fullCertification=false, normal36은 계속 미검증이다.

공식 근거: [Google의 미리 채운 일정 추가 링크](https://developers.google.com/workspace/calendar/api/concepts/inviting-attendees-to-events#provide_a_link_for_users_to_add_the_event). 이 방식은 한 번 추가한 사본이며 이후 자동 동기화를 보장하지 않는다.
