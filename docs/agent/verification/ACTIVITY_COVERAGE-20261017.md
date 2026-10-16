# 새 기능 이용기록 연결 점검 — 2026-10-17

Status: Locally verified — 제품 수정·실제 조작 검증 완료, 운영 배포 대기.
Plan: [PLAN-078](../plans/PLAN-20261017-078-activity-coverage.md)

## 조사 결과와 수정

기준 커밋은 `edb42880`이며 기존 activity visual6개는6/6 PASS였다. 빅타민 쓰다듬기·딱밤·드래그가 모두 미구현인 상태는 아니었다. 기존32계열(설정17/직접행동15)에 수집·등록·표시 연결이 있었다. 다만 키보드 이동 후 Escape, 실제 기울어진 일정의 사용자 복구, 공유 패널 접기/펴기, 일반 설정 탭의 방향키 전환, 일부 최초공개 조작은 빠져 있었다.

| 경로 | 이번 수정 |
|---|---|
| 빅타민/음식 키보드 이동 후 Escape | 새 위치에 놓은 완료를1회 기록. 이동 없는 취소·반복 Escape는0회 |
| 기울어진 일정 사용자 복구 | 실제 기울어진 상태에서만 `companion-card-restore`. 자동 복구·복구 중 반복 클릭은 제외 |
| 위치 고르기의 목적지 클릭 | window capture에서 먼저 소비. 실행하지 않은 달력 클릭이 함께 기록되지 않음 |
| 태그 필터·계절 배경·빅타민 집 | 공유 `PanelSection`에서 고정 이름과 접기/펴기 선택값 사용 |
| 설정 상위 탭 방향키 | 빅타민 이외 탭도 실제 다음 탭의 고정 이름 기록 |
| 최초공개 | 다시 보기·다른 달 이동·나가기·상세 보기·리허설 이름 추가. 기대돼요는 기존 `dt-hope` 재사용. 수동 응원은 허용 시점/800ms 간격을 통과한 때만1회 |

공유 구현은 시청자·비로그인·미리보기의 `PublicPoster`와 편집실의 `ViewerCompanion`에 그대로 연결된다. 새 DB/API/의존성/폴링/프레임 루프·기하·아트 변경은 없다.

## 등록 범위

빅타민 설정17계열: 전원, 움직임/장난/교감/성격 탭, 산책·점프·낮잠, 하트·일정 기울이기·숨기·패널 장난, 옮기기·쓰다듬기·밥주기 허용, 걸음·동물 모드·성격, 함께 배우기·배운 습관 초기화. 상위 `settings-tab#companion`은 공통 설정 진입 ID다.

직접행동16계열: 집 열기/닫기/접기/쿠션 복귀, 음식 생성/옮기기/개별 버리기/남은 밥 치우기, 쓰다듬기/옮기기/딱밤/직접 낮잠/숨은 빅타민 찾기/꺼내기/보라 하트 지우기/기울어진 일정 바로잡기.

최종 literal `data-act` 정적 조사에서는 `components/`·`app/`300곳/253 ID에 미등록 ID0개였다. 이 수치는 ID가 없는 모든 컨트롤이나 동적 표현식 전체를 자동으로 증명하지 않는다. 동적 빅타민 설정·탭·패널·무대 선택값은 별도 유한 union/고정 map과 등록 목록을 대조했다.

자율 걷기·점프·식사·표정·장난·숨기/스스로 나오기·자동 응원·랜덤 음악, 포인터 왕복 샘플과 드래그 중간 프레임은 사람의 사용으로 기록하지 않는다.

## 검증과 원본

모든 브라우저 검사는 과거2026-06 fixture, 비읽기 요청 인터셉트, 합성 읽기 응답을 사용한다. 실제 일정/투표/운영 행동 원본을 읽거나 쓰지 않았다. 수집 검사는 실제 client queue를 실행하되 전송은 로컬에서 응답한다. 기록 화면의 합성 응답 검사는 이름 표시의 증거이며 실제 저장 증명과 구분한다.

| 검사 | 결과 |
|---|---|
| 기존 activity visual 기준6개 |6/6 PASS |
| 변경 전 새8개 |3 PASS/5 FAIL. 이동 Escape2·패널2는 누락 재현. 편집실 placement1은 닫힌 편집창 DOM의 존재를 열림으로 오인한 검사 결함 |
| 변경 전 강화된 placement |시청자에서 `companion-drag`와 실행하지 않은 `auto:.public-event` 중복 재현. 편집실의 DOM 존재 오라클은 실제 `.studio-workspace.editor-open` 상태로 교정 |
| 관련 unit |25/25 PASS: labels8·card-play3·실제 writer/reader 모의 경계14 |
| 전체 unit |1701 PASS/기존8 FAIL(1709개) |
| 전체 lint / typecheck / production fixture build |PASS |
| harness |기존2 FAIL: active rule ID·RULE_MIGRATION inventory 불일치 |
| 1차 실제 입력·기록 화면·입력/창 소유권 회귀 |29/29 PASS, worker1·재시도0 |
| 추가 숨기/찾기/추출·학습 설정 |4/4 PASS |
| 최종 activity 검사 파일 전체 |17/17 PASS, worker1·재시도0·skip0·flaky0. 수정 없는 입력/창 소유권14개는 위29개 결과 유지 |

모의 DB 검사는 고정 target46개가 실제 `recordActivityBatch`와 일별/사용량 reader를 통과하는지, owner/developer 개별 기록과 viewer/anonymous 집계의 분리, 개발자 외 읽기 거절, 민감 canary 제거, 잘못된 client kind 차단, DB 설정 실패 시 닫힘, KST 일 경계를 확인한다. 운영 RLS·실제 로그인 세션의 증명은 아니다.

숨기 진입 검사는 희귀 행동을 재현하도록 전역 RNG와 브라우저 시계를 제어한다. 실제 planner가 숨긴 일정 ID·숨김 상태와 발견 전 기록0을 확인한 뒤, 시계를 재개하여 실제 카드 열기·드래그로 찾기/꺼내기 각각1회와 중복 이동0을 검증한다. 학습 초기화 검사는 버튼의 사용 기록을 검증하며 학습 수치 자체의 초기화 검사는 별도다.

전체 unit의 기존8건은 ambient-codex2, centering-vs-animation1, public-cache-revalidate1, scroll-position-wiring1, timeline-route1, vod-chat-recovery2다. PLAN-077 최종 결과와 같은 목록이다. 관련 검사 PASS에 섞지 않는다.

독립 리뷰는 제품 제스처/무대·공유 패널/설정·수집 경계를 나누어 작성자 외 리뷰어가 수행했다. Escape 무대 닫기의 이름이 준비 배지만 뜻하던 표시1건을 “닫기”로 수정했다.

원본은 로컬 `.scratch-pw/activity-078-*`의 버전별 log/JSON/PNG/trace에 보존하며 커밋하지 않는다. 기존070 원본은 `activity-078-original-070/`에 별도 보존했다.

제품 fixture build는 `6pdn60BJGgB2-SvgsHsVn`이다. 최종 결과는 `activity-078-complete-report.json`(17개), 입력 회귀 포함 1차는 `activity-078-final-report.json`(29개), 추가4개는 `activity-078-extra-report.json`이다. 실제 수집 payload와 동일 제목의 JSON을 함께 남겼다. 타임라인/사용량 PNG에서 쓰다듬기·딱밤·집어 옮기기·기울어진 일정 복구·패널/무대 이름을 직접 열람했다. 최초공개 재개는 전환이 끝난 스크린의 opacity1까지 기다린 최종 PNG로 확인했다.

## 정책과 한계

행동 타임라인의 개별 흐름은 기존 owner/developer 내부 기록만 제공하고, 시청자·비로그인은 일별 기능 집계만 유지한다. 사용량 목록은 기존에 실제 관측한 기능을 보여준다. 사용0회 전체 카탈로그나 과거 미수집 행동의 소급 생성은 추가하지 않았다. 신규 기록은 고정 기능 ID/고정 선택값만이며 일정 제목·본문·음식 ID·좌표·계정 정보를 추가 수집하지 않는다. 기존90일 보존·배치/keepalive·개발자 조회 권한을 유지한다.

보라 하트 지우기·실제 기울어진 일정의 복구는 소스/단위/표시 연결로 확인한다. 현재 공개 fixture는 실제 하트 버튼의 server action을 전달하지 않으므로 실제 투표 경로의 native 수집까지 증명한 것으로 표현하지 않는다. 실제 OBS 장비나 모든 기능 순열을 검증한 결과도 아니다.
