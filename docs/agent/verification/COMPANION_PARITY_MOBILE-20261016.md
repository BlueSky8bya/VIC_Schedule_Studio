# 편집실 빅타민 행동 일치·모바일 제외 검증

2026-10-16 KST. [PLAN-063](../plans/PLAN-20261016-063-mobile-without-companion.md). 소유자가 구현·커밋·푸시·배포까지 승인했다. 최신 모바일 제외 요청이 이전 모바일 집·응원단 요청을 대체한다.

## 진단과 변경

- d934bc3의 편집실 pet mount 검사는 실제 일정 발판 추종을 검증하지 못했다. `.studio-day[role=button]` 전체가 장애물로 들어가 공개 일정 발판을 모두 막았고 실제 카드 위 배치가 viewport floor로 끝났다. 이전 빌드에서 재현했다. 공유 geometry에서 structural 날짜 컨테이너와 내부 실제 버튼을 구별한다. 공개 일반 일정·날짜·요일·명시 공개 지원바만 허용하며 비공개·떡밥·편집 버튼은 계속 보호한다.
- 편집실도 기존 숨바꼭질과 DetailBridge/Perch를 사용한다. 숨은 공개 일반 일정을 사용자가 직접 열면 내용칸의 실제 글자를 피한 빈자리에서 발견 후 졸고 zzZ를 표시한다. pet DOM은 contenteditable 밖에 있어 내용/저장값에 들어가지 않는다. 직접 쓰다듬기·집기/꺼내기를 공유하며 현재 선택과 미저장 form 모두 공개·비떡밥·일반 일정일 때만 연결한다.
- 독립 검토에서 찾은 원본 카드 공개 marker 소실, 다른 전경창, 내부 form 스크롤도 처리한다. marker/hidden/inert 변경은 숨기 세션을 끝내고, 다른 창은 bridge를 철회한다. 입력/기하 변경과 내부 스크롤은 이벤트에 따른1rAF 재측정으로 글자·컨트롤을 피한다. 공간이 없으면 외부 안전자리로 비킨다. 자동 편집창 열기/저장/실제 투표는 없다.
- 모바일·짧은 가로 터치는 공통 `POSTER_AGENDA_QUERY` capability에서 pet/집/음식/설정 탭/최초공개 응원단을 마운트하지 않는다. PC 저장 취향은 유지한다. 시청자·편집실의 같은44px 설정 버튼을 헤더 오른쪽으로 맞추고 X/뒤로가기/focus 경로를 공유한다.
- PC 잡기·소파 레이어/거주·최초공개 진입/복귀·개별 응원단 동작은062의 공유 구현을 유지한다. 새 그림/모델/의존성/DB/폴링/공개 DTO/권한/KST/export1840 변경0.

## 검증 상태

| 범위 | 상태·근거 |
| --- | --- |
| 관련 제품 단위 | 508 PASS(빅타민/최초공개/떡밥/고조 곡선), 하네스 단위25 PASS |
| lint/type/build | 최종 제품 소스 full lint/type/build exit0. 최종 테스트 수정도 scoped lint/type exit0. 빌드된 제품13파일 해시와 UI 검증 소스 일치 |
| 실제 카드·스크롤 | 시청자/편집실2 PASS. 실제 card-top 발판에 놓고 native wheel96px, 카드도96px 이동. 시청자74/편집실73프레임의 feet 상대오차 p95/max/end는0/약0.000015px, 같은 DOM·지원 유지/숨김0. 편집실 실제 shellzoom .9 확인. 독립 Studio geometry1도 실제200%확대/휠58프레임 PASS: source−90px, p95/end오차약0.000382px, card-top 유지/숨김·점프 재시작0 |
| 숨은 편집창 guest | 1 PASS(실제45초 grace/총51초, RNG만 제어). native 카드 배치→숨기→사용자 편집창→내용칸 글자 overlap0/수면·zzZ→잡아 꺼내기/입력 focus·내용 보존→전경 설정창 철회·자동 재등장 없음→미저장 떡밥 전환 철회. POST0/errors0 |
| 모바일/설정/최초공개 | 설정2 PASS: native390·1120×600 가로 터치에서 양쪽44×44/right14, X/Back/focus/route 일치. 최초공개·anchor34 고유 PASS(초기32+모바일 snapshot2 갱신 뒤 normal 재검사2). 모바일1/2/3/5·mixed·844가로 관객 DOM/atlas0, 타이머·기대·본문/태그/exit 유지. PC seed/개별 turn·fade/음악/진입·복귀 유지. 공통 모바일 제외8 PASS: public/studio/preview ×390·1120가로 +PC양쪽 resize. pet/집/음식/탭/atlas0, masterON 취향·1840 export 보존 |
| PC 공유/교감 회귀 | 16 PASS: 실제 Studio geometry1+역할별 공유2+contact4+잡기/관성5+집 light/dark2+집 바닥 음식2. reduced/off 중립·parked mutation0·소파 레이어/주민·최초공개 집 깨기/73초 진입 유지. POST0/errors0 |
| 문서 하네스 | 기존 inventory/mapping 불일치2건으로 exit1. 단위25 PASS와 구별 |
| 배포 | 미실행. 제품/문서 SHA와 실제 운영 결과를 확인한 뒤 기입 |

기존 모바일 pet 양성 검사38개는 최신 제외 정책으로 철수하고 PC 검사를 유지했다. 새 음성 capability·회전/resize·설정·모바일 최초공개 검사로 대체한다. 검사 발견 수를 실행 PASS로 세지 않는다. 실패한 탐색과 의도한 모바일 snapshot 변경은 최종 재검증과 구별한다.

총 고유 UI61 PASS=설정2+숨기1+최초공개/anchor34+PC회귀16+모바일 제외8. 모든 실제 서버 쓰기는 차단했으며 돌연변이 요청0/pageerror0이다. 미리보기의 기존 읽기 전용 `getPublicPreviewAction`도 POST transport라서 build manifest의 정확한 exportedName/id만 분리하고 공개 전용 fixture로 응답했다(각 preview1회, 실제 DB/서버 전달0). 모바일 초기 검사의 숨겨진 desktop 탭 클릭, 읽기 POST를 쓰기로 분류한 가정, 공개 fixture import 실수를 바로잡고 최종8 전체를 다시 실행해22.6초/실패·skip·flaky0을 확인했다. 제품을 이 검사에 맞춰 완화하지 않았다.

초기 실제 UI 검사에서 공개 설정창의 trap/초점 복원 누락과 편집창 테두리SVG의 빈 내부를 장애물로 잡는 문제를 발견했다. 기존 공유 trap과 opener 순서로 고치고, 명시 editor의 직접 장식 `svg.editor-ring[aria-hidden]`만 기하 예외로 두었다. 실제 이미지/버튼/다른 편집칸 보호와 밀집 입력 fallback은 유지한다. 재검사에서 설정2와 내용칸/수면/꺼내기는 통과했다. 다른 창과의 동시 유지 검사는 기존 편집기 외부 pointer 닫기 정책을 바꾸지 않도록 native keyboard로 열고 닫는다. 초기 실패 기록은 별도 보존한다.

최초공개 초기34회 실행은32 PASS+의도한 모바일 기준 이미지2 FAIL이었다. 제거된 관객과 줄어든 화면 높이를 before/after에서 직접 검수하고 `wish-background-390/844`만 갱신했다. 같은2개 normal 재검사가 PASS였으며 PC1100 기준선 SHA는 불변이다. 단일34 green 실행으로 바꿔 적지 않는다. `.scratch-pw/companion-063-premiere-review-report.json`, `companion-063-wish-{update,check}-report.json`, `companion-063-gear-hide-final-receipt.json`.

추가 근거: `.scratch-pw/companion-063-{integration-qa-summary,mobile-report,product-hashes}.json`, `companion-063-studio-follow.json`, `companion-059-063-mobile-verified.log`. 기존062 raw/운영/이미지 근거는 별도 백업과 SHA 대조 후 보존했다. 사용자의 미술 기록26줄·보류 자산·개인 로컬 파일은 커밋에서 제외한다.

## 한계

모든 UI 쓰기는 stub fixture에서 차단한다. 운영은 익명·과거2025-09 읽기만 확인한다. 실제 로그인 편집/RLS·물리 OBS 부하/실기기 smoothness는 이 검증이 증명하지 않는다. 기존062의 전체 완료 주장 대신 새로 재현한 실제 adapter 누락을 명시한다. 캐릭터 원화/시각 승인이나 AI 학습을 주장하지 않는다.
