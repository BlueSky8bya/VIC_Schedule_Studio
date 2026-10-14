# 최초공개 읽기 창 · 2026-10-14

[PLAN-037](../plans/PLAN-20261014-037-premiere-reading-layout.md). 사용자 요청 및 기존 커밋/푸시/배포 승인에 따른 구현.

## 2026-10-15 후속: 날짜순 배치

- 소유자 요청: 복수 공개 결과는 일정 날짜가 빠른 순으로 PC 왼쪽→오른쪽, 모바일 위→아래. 같은 날짜는 기존 순서 유지.
- 원인: 지휘자의 공개 시각/일별 sortOrder 순서를 읽기 화면에도 그대로 사용. 공유 PremiereStage에서 public `dateKey`로 복사본을 정렬해 표시/발표/첫 공개 종이색에 사용한다. 지휘자 원배열·대상 시각·연쇄 판정·공개 경계·서버·권한·KST 날짜 생성은 무변경.
- 타입·전체 lint·fixture production build, 관련 unit28/28 통과. G21 독립 코드 리뷰에서 확정 문제 없음.
- 로컬 실제 `/` PC1500/모바일390: 반대 순서로 전달된 합성 과거 일정도12일→30일 배치. 각 context POST1차단/실제쓰기0/pageerror0. `.scratch-pw/date-order-local.json`, `date-order-local-{1500,390}.png`.
- 첫 reading-layout 렌더6통과/1실패: 가로 화면 테스트 종료 중 fixture route.fetch 잔여 요청이 닫힌 브라우저를 참조. afterEach에서 요청 완료를 기다리도록 보완. 제품 오류로 숨기지 않음.
- 보완 후 reading-layout 최종7/7 통과. PC/모바일 역순 날짜 회귀 포함, 기존 단일 일정 스냅샷 변경 없음. 최종 수정 파일 scoped lint/diff check 통과.
- 제품 `dc8052bf` [운영 배포 성공](https://vercel.com/bluesky-s-project3/vic-schedule-studio/GH4sSu9MRUFtLVgBpygVX8Jve79B), live build SHA 일치. 운영 `/` PC1500/모바일390에서 합성12일→30일 순서와 실제 좌우/상하 좌표 확인. 각 context POST2차단/실제쓰기0/pageerror0. `.scratch-pw/date-order-production.json` 및 `date-order-production-{1500,390}.png`.

## 변경

- 완료 화면의 큰 날짜 열·반복 헤더·V 포즈 장식·단일 일정의 중첩 카드를 없앴다. 각 일정의 날짜/KST 요일·실제 시작 시각·모든 태그·상세 버튼을 상단에 모았다. 종일 일정의 `하루 종일` 문구는 생략한다.
- 제목·부제·본문은 크기/굵기/간격을 구분한다. 깊은 부제 들여쓰기를 유지한다. 긴 제목/부제 다수/태그 다수에는 조밀한 배치를 쓰되 줄임표·줄 수 제한·태그 +N은 없다. 태그 색상과 공개 후 종이 색은 기존 resolver를 사용한다.
- 완료 창은 내용 높이에 맞추며 낮은 화면에서도 낭비되는 최소 높이를 없앴다. 일반 사례는 첫 화면에서 읽고, 극단적으로 긴 내용은 기존 스크린 한 곳에서 끝까지 스크롤한다. 내용을 억지로 한 화면에 맞추는 축소/누락은 없다.
- PLAN-033의 완료 후 하단 중앙 종료 배치는 상단 우측으로 대체한다. 대기→읽기에서 위치를 유지하고, 긴 본문 위에서도 입력 가능한 겹침 순서를 보장한다. 자동 종료 없음. `상세 보기`는 기존 공개 상세 창으로 연결한다.
- 공유 PremiereStage의 released 렌더/CSS만 제품 변경. 대기 관객/음악/단일 시계/카드 진입, 공개 DTO·서버·DB·권한·unlock·KST·1840px export 기하 무수정. 토리 표정 로컬 시안과 기존 개인 파일은 적용/커밋 대상에서 제외한다.

## 검증

- 타입·전체 lint·fixture production build 통과. 관련 단위 76/76 통과: premiere26/company3/focus2/publicDTO2/rule-migration25/agent-memory18.
- 화면 검사 36개 통과: entry8/focus8/kairos9/reading-layout5/reading6. 이후 독립 검토의 metadata 굵기 500→400 및 태그 반경 토큰 수정 후 최종 production build와 영향 화면 13개를 다시 통과했다. 재실행 범위는 reading-layout5/reading6/focus의 공개 결과2개다.
- 새 합성 사례: 긴 제목+부제3개(깊이 포함)+태그8개+본문을 1100×780(CookieRun),390×844,844×390에서 검사했다. 모든 태그와 본문이 첫 화면에 완전히 포함되고 스크린 추가 스크롤/가로 넘침이 없다. 제목은 부제보다 1.3배 초과, 부제는16px 이상. metadata/부제/본문의 실제 canvas 색 대비는 밝음/어두움 모두4.5:1 이상이다.
- 복수 공개의 날짜·태그가 각 일정에 귀속되고, 실제 시각은 한 번 표시한다. 45줄 본문은 누락 없이 키보드 End로 끝까지 도달한다. 중첩 스크롤이 없고 4초 이후에도 화면 유지, 나가기 실제 클릭 성공. 본문 변경·재가림·삭제·상세 handoff·패널 양보·마지막10초 집중 회귀 포함.
- 실제 `/` 로컬 시청자 경로도 PC1100/agenda390/가로844에서 합성 과거 달 응답으로 확인했다. 공개 전 무제목→공개 후 전체 제목/태그8개/본문→4.2초 이후 유지→상세 창→Escape 복원 통과. 각 context 추가 스크롤0, 콘솔 예외0, 서버 전송 POST0(1건씩 차단). 운영 DB 시험 데이터 생성0.
- 의도한 공개 결과 스냅샷7개를 같은 제품 커밋에서 갱신한다. PC/모바일/가로3개 대표 렌더를 직접 확인했다. 대기 장면 기준선 변경 없음.
- G-21 독립 코드/UX 검토 후 metadata 굵기 규칙 지적을 수정했다. 재검토에서 미해결 확정 차단 사항 없음. 미술 평가/승인을 뜻하지 않는다.

## 기존 실패와 한계

전역 harness의 기존 실패2(active rule ID inventory 및 RULE_MIGRATION mapping 불일치)는 남는다. 이전 작업의 전체 단위1091통과/8실패와 상세 경로는 [응원단 검증](TEASER_AUDIENCE-20261014.md)에 기록되어 있다. 이번에는 관련76개를 실행했으며 전체 단위를 다시 통과했다고 주장하지 않는다.

글/태그 수가 무한히 늘어도 한 화면에 들어간다는 보장은 없다. 극단 본문은 한 스크롤 영역으로 유지한다. 실제 사용자 HCI 실험·실기기 Safari·확대 글자 전 조합·로그인/RLS 검증을 수행한 것으로 해석하지 않는다. 공개 경계 코드는 이번 범위에서 변경하지 않았다.

## 배포

제품 커밋 `0d7e9b2b09de27790140b67b4b4ad77d185faec4` main 푸시, [Vercel 성공](https://vercel.com/bluesky-s-project3/vic-schedule-studio/G7UzXbiCNKzwn7zchXExGgGdxs5w) 및 운영 `/api/soop-live` build SHA 일치를 확인했다.

[운영 사이트](https://vic-schedule-studio.vercel.app)에서 PC1100×780(CookieRun)/agenda390×844/가로844×390 실제 시청자 경로도 통과했다. 합성 과거 달 공개 응답/모든 브라우저 POST 차단 조건이며, 공개 전 무제목→공개 결과(태그8개·본문 완전 표시)→4.2초 이후 유지→상세 보기→Escape 복원 순서다. 각 context 스크린 추가 스크롤0/콘솔 예외0/서버 전송 POST0(1건씩 차단). 실제 DB 시험 데이터 생성 없음.
