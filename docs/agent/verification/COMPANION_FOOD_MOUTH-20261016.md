# 빅타민 음식 입 위치 — 2026-10-16

Status: Implemented / local verification complete

먹는 음식이 입 아래에서 작아지던 후속 수정. 시청자·편집실·미리보기·비로그인은 같은 `CompanionFood`와 표시 sampler를 사용한다. 작은 시각 오류 수정으로 별도 구조 계획은 필요하지 않으며, 현재 작업 목록 대신 이 주제 기록을 갱신한다.

## 원인과 수정

- 음식의 논리 좌표는 발밑 기준이다. 44px 버튼 안의 36px 그림 중심은 그 좌표보다16px 위이므로 `presentCompanionFood`의 입+16px 보정은 맞았다.
- 그러나 `.vc-food span`의 축소 기준이 `bottom center`여서 축소할수록 그림 중심이18×(1−scale)px 아래로 내려갔다. 회전도 같은 기준의 오차를 만들었다. 먹는 동안만 중심 기준으로 바꾸고 낙하/잡기/장난의 바닥 기준은 유지한다.
- 입까지 올라오는 기존24% 구간 뒤 씹으며0까지 작아진다. 이전에는28% 크기를 남긴 채 엔티티를 제거했다. 동작 줄이기는 기존처럼 정적 입 위치/크기를 유지한다.
- 현재 먹는 포즈의 입 위치를 승인된 row9 그림과 등록 좌표로 확인했다. 입 좌표/먹이 논리 위치·발판·집 부착·중력·먹이 판단·친밀도·삭제 시점·데이터 경로는 바꾸지 않는다. 공개 DTO·권한·언락·KST 경계 변경 없음. 신규 아트/의존성/배경 루프 없음.

## 검증

| 검사 | 결과 |
|---|---|
| 독립 리뷰 | 아래 축소 기준점 오류와 먹는 중에만 중심 기준을 쓰는 범위 확인. 기존 입 좌표는 실제 row9 그림과 약2px 이내라 불필요한 좌표계 개편 제외 |
| 관련 단위 | 음식·중력·접근·아트/종류·뇌6파일71개 PASS. 동작 줄이기의 기존 정적 표시와 잘못된 좌표 방어 유지 |
| build/type/lint | exit0. 빌드 `C2vrjz41olKWh9XAb8Csp`. 첫 typecheck는 build와 병렬 실행해 `.next/types` 재생성 경합(TS6053)이 있었고, 빌드 뒤 단독 재실행 및 최종 테스트 작성 뒤 재검사로 exit0 확인 |
| 입 위치 native | 시청자/편집실×좌우4개 PASS(28.3초, 재시도/skip0). 승인된 row9의 실제 입 `(111,131)/192`를 독립 기준으로 사용. 실제 음식 그림 중심 최대 오차2.53px, 축소 중 수직 변동 최대1.70px. 크기1% 미만까지 축소, 제거/식사 정산 각1회. 서버 쓰기/페이지 오류0 |
| 먹기·중단 회귀 | 포인터/키보드 재집기·먹이 추적·집 바닥 식사4개 PASS(37.6초). 재집기 뒤 정산하지 않음, 다시 옮기기/삭제, 첫 바닥 착지 유지 |
| 문서/harness | 문서·세션18개 PASS. 기존 RULE_MIGRATION inventory 불일치2건은 그대로이며 PASS가 아님 |

제품 소스는 native 검사 사이 변경하지 않았다. 새 검사의 초기 실패는 실제 바닥보다 아래인 고정 좌표/착지 전 측정, 편집실에 없는 poster export 표면 전제 때문이었다. 기존 포인터 중단 검사의 마지막 삭제도 하단 고정 월 이동 바보다 아래에 음식을 놓아 화면 밖 음식에 키를 보내는 전제 오류였다. 실제 보이는 다른 일정 발판에 내려놓고 visible/focus를 추가 확인하도록 고쳤으며, 입5px·수직 변동3px·중단/미정산·삭제 단언은 줄이지 않았다. 초기 실패 보고서도 보존한다.

입 위치 native 보고서/측정/조기·후기 캡처8장은 ignored `.scratch-pw/companion-072-mouth-{report,summary}.json`, `companion-072-mouth-{viewer|studio}-{left|right}-{early|late}.png`. 회귀는 `companion-072-food-regression-report.json`, 소스 일치는 `companion-072-{source-proof,committed-source-proof}.json`에 기록한다. 캡처8장을 직접 검사했고 실제 운영 계정/RLS·OBS 실송출 검증으로 확대하지 않는다. 모든 fixture mutation은 가로채며 운영 DB 시험 쓰기는 하지 않았다. 사용자 미커밋 제작기록/이미지는 보존한다.

## 운영 확인 증거

승인된 main push의 정확한 SHA와 운영 API build 일치/Vercel success는 `.scratch-pw/companion-072-production-deploy.json`, 공개 HTTP200·배포된 음식 중심 축소 CSS는 `companion-072-deployed-resources.json`에 별도 기록한다. 표시 수정은 두 제품 파일뿐이며 음식 위치/정산 경로는 유지한다.
