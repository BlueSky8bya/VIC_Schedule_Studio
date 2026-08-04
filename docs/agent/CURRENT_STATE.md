# Current State — VIC Schedule Studio

> **에이전트에게**: 이 파일이 "지금 이 프로젝트의 현재 시제"다. 과거 일기장이 아니다.
> 작업 시작 전에 여기부터 읽고, 의미 있는 작업(기능·구조·마이그레이션)이 끝나면 **여기를 갱신**한다.
> 완료된 역사는 여기 쌓지 말고 git log와 `docs/decisions/`(ADR)로 보낸다.
> 세션 시작 시 이 파일은 SessionStart 훅이 자동으로 읽어 넣는다(`.claude/settings.json`).

Last Updated: 2026-08-04
Project Version: 0.1.0
Harness: `agent-harness.yaml` (protocol `project-initializing_260710.md`, 최소 도입안)

---

## Current Objective

- **방문 지표 재정의 + 행동 기록(2026-08-04, PLAN-20260804-003 / ADR-0013)**:
  ① **방문 = 탭 수명**(0061 `visit_key`, sessionStorage). `visit_session` 1행은 '화면이 보인
  한 구간'인데 문서 네비게이션(pagehide)마다 끊겨, 사이트 안에서 페이지만 옮겨도 방문이
  늘었다 — 실측(04:11~04:20 owner 단독)에서 연속 9분 1회가 4행(4초/5분/7초/4분)으로 찍혔다.
  `lib/insights/visit-fold.ts`가 적재 직후 구간→방문으로 접는다(같은 탭 → 같은 계정의 겹치는
  탭; 계정 미상은 절대 안 합침). **체류는 구간 합집합** — 단순 합은 창 2개 동시 표시를 두 번 센다.
  시간대 점유·동접은 방문 span이 아니라 `spans`(실제 가시 구간)를 스윕한다.
  ⚠ 방문수·평균 체류의 정의가 바뀌어 **과거 수치와 직접 비교 불가**.
  ② **실시간 프레즌스**: track이 마운트 1회뿐이라 숨긴 탭도 접속으로 셌다(기록은 hidden에서
  끊는데 실시간만 안 끊김). 이제 `visibilitychange`마다 `visible`을 갱신 → 패널
  '화면에 떠 있음 / 탭만 열림' 2열. **visible은 화면 출력 여부지 시선이 아니다**(가려진 창·보조 모니터).
  ③ **행동 기록 `activity_event`(0062)** — 어느 화면·어느 일정·무엇을 고쳤는지. 개발자 패널
  '행동 타임라인'(날짜 모달)에서 방문 단위로 재구성.
  **불가침: meta에 일정 제목·본문 저장 금지**(target=uuid, 제목은 읽을 때 권한 확인 후 조인;
  공개 일정만 제목, 비공개는 범위 라벨). 어기면 ADR-0002 본문 암호화가 무의미해진다.
  **식별은 내부자(owner/manager/worker/developer)만** — viewer·비로그인은 `accountHashForRole`이
  쓰기 시점에 `account_hash`를 null로 만들어 개인 타임라인이 구조적으로 불가능. 보존 90일.
  server kind(실제 변경)를 클라가 사칭할 수 없다(`isClientKind`). 규약은
  `tests/unit/activity-kinds.test.ts`가 고정.
  **미배선(종류만 등록)**: `export.png`/`export.clipboard`(공식 내보내기는 Playwright라 인앱
  버튼 없음)·`zoom.change`·`decorate.open`·`settings.toggle`.
  **관측 필요**: 스티커 배치 저장이 잦으면 `sticker.move` 행이 빠르게 쌓일 수 있다(배치 1건=1행으로
  이미 줄였지만 실사용 확인 전).
- **⚠ 오버레이 스택 함정(2026-08-03, `cada217`)**: 모달/시트가 닫힐 때 오버레이 스택이
  history.back()을 호출하는데, 이 되감기는 **그 순간 진행 중인 router.refresh()/문서
  네비게이션을 취소**한다(잠금해제 미반영 버그의 근본 원인 — Playwright로 확정).
  오버레이를 닫으면서 서버 갱신을 함께 트리거해야 하면: 상태로 닫지 말고 문서 리로드로
  한 번에 처리하거나, 히스토리 되감기가 끝난 뒤 갱신할 것.
- **최초공개 시청자 기대 기능(2026-08-03, `6de578e`)**: 카운트다운 긴장 곡선(D-n→24h
  실시간→1h soon 고조→10s 심장박동), 공개 순간 제목 스크램블, 떡밥 카드 클릭→상세
  팝오버(공개 시각+기대돼요). 0060 teaser_hope(0040 익명 하트 패턴, 기기토큰 1표,
  공개 전만 토글, 공개 후 "n명이 기다렸어요" 배지). 적용 완료·Playwright 실측 검증.
- **하이프 4차 — 장인 정밀도(2026-08-04)**: 계획 `docs/ux/motion/hype-craft-plan.ko.md`를
  6개 수정과 함께 전량 구현. ① 팝오버 라벨을 링 밖 독립 행(`.dt-count-ringbox`)으로 분리
  — 원 하단 좁은 현(≈56px)에 6글자(≈67px)가 안 들어가 stroke와 겹치던 기하 버그.
  ② 시트 표면을 `sheetWarm=I^1.35`로 연속 가온(불투명, 떡밥 팝오버는 공개 전 전 기간
  `.is-teaser` → 60초 경계 재질 점프 없음). ③ 리더선을 선-로컬 `<g>` 좌표계로 바꿔 점선
  흐름을 `stroke-dashoffset`(매 프레임 SVG paint) → `transform`으로, 박동은 고정 굵기
  복제선의 opacity로. ④ 부제목·메타·태그 공개 스태거(`.reveal-secondary`, transform/opacity만
  써서 레이아웃 불변; 긴 제목이면 제목 60% 확정까지 시작을 민다).
  **위상 동기의 핵심**: 같은 duration을 주는 건 동기화가 아니다 → 빈도 적분 LUT로 절대
  위상을 구해 `animation-delay`에 음수로 못 박는다(`hypeMotionFrame`). 파형은 CSS가 60fps로
  그리고 JS는 10Hz로 위상만 재고정.
  **접근성**: 박동 주기 하한 0.62s(1.61Hz) — 최악 1초에 박동 2 + 공개 단발 1 = 3회로
  WCAG 2.3.1 한계에 여유를 남긴다(0.55s면 여유 0). 시트 대비는 실제 CSS 색으로 단위 테스트.
  **CSS 특이도 함정 3건**: 유리 재질(`.agenda-detail-backdrop.is-pop .agenda-detail-sheet`),
  `.detail-anchor-link line`, 박동 정지 규칙 — 클래스 단독 선택자로는 전부 조용히 진다.
  검증: tsc·lint·vitest 350·시각 스펙 신규 6 통과, 전체 시각 실패는 기존 6건 그대로(신규 0).
- **최초공개(떡밥) 편집실 가림(2026-08-03)**: 아직 안 풀린 떡밥은 편집실 카드/확대상세에서도
  제목 ???, 클릭 시 편집 폼 대신 비번 게이트(비공개 레이어 비번, `verifyOnly` — grant 미발급,
  rate limit 동일). 통과 id는 화면 생존 동안만 기억. 이동/드래그/복사는 게이트 없이 가능하되
  복사는 teaser 필드째 복사(CopiedEvent 확장 — 안 하면 붙여넣기가 가림을 벗겼음).
  실기기 검증 남음: 데스크톱 팝오버 게이트 폭/리더라인, 모바일 시트 게이트, 오답 shake.

**전면 UX/HCI 개선 계획 실행 중** — 코덱스 설계안(`docs/ux/audit/vic-schedule-studio-ux-hci-
improvement-plan_260729.md`)을 사용자 승인 하에 진행. 방침: **기능/안정(P0→P1→P2) 먼저,
그 다음 애플 기조 리디자인/애니메이션을 뼈대 위에 덮어씌움**. 결정 8건은 ADR-0011,
권한표/불변식은 ADR-0012가 정본.

- **완료(2026-07-29)**: `P0-SEC-1`(공개 범위 fail-closed — 조용한 public 변환 금지, 모바일
  게이트 통일, 서버 잠금해제 검증), `P0-SEC-2`(미리보기 = 서버 공개 스냅샷 전용 + 진입 시
  재조회 `preview-actions.ts` — 떡밥 가림 우회 제거), `P0-SEC-3`(오류 원문 비노출 —
  `safe-action-error.ts`, error boundary digest만), `P0-AUTH-1`(`event-validation.ts` —
  날짜/링크 https/태그 payload 서버 검증 + 매니저 비공개 태그 차단 + 특성화 테스트 13개.
  L6 반영: developer 권한 회수 안 함), `P0-PRIV-1`(드래프트 메모리 전용 + legacy 키 물리 삭제).
- **`P0-DATA-2` 완료(2026-07-29 밤)**: 0055 마이그레이션 적용됨(save_event_atomic/
  reorder_events_atomic/link_chain_atomic, SECURITY INVOKER). 액션 연결 + 클라 target rollback
  (전체 스냅샷 복원 폐지). service-role 왕복 실측 검증. **실계정 첫 저장/드래그로 실전 확인 권장**.
- **`P0-PRIV-3` 완료(2026-07-29 밤)**: embargo 행 0 감사 + 0056 CHECK 제약(신규 embargo 쓰기
  DB 차단, 적용됨) + 죽은 can_view_embargo true 기록 중단 + 샘플 현행화. 앱의 embargo 분기는
  fail-closed 방어로 의도적 존치.
- **`P0-A11Y-1` 부분 완료**: 모바일 편집실 월 이동 버튼 가시화(44px, sticky 헤더). fixture에
  poster CSS import(모바일 아젠다 골격이 poster CSS 공유 — fixture 전용 갭이었음).
  남은 A11Y-1: roving date grid + 선택일 event list, 드래그 메뉴 대안, 업도움 키보드 경로.
- **`P0-PRIV-2` 완료(2026-07-30 새벽, `a576d28`)**: 잠금해제를 auth-세션 결속 grant로(0057 적용).
  opaque 토큰 HttpOnly 쿠키 + sha256 해시 + session_id 결속, 10분 5회 rate limit, '지금 잠그기'
  버튼, 보안 패널=grants 기준, 비번변경/개별만료 시 grant 폐기. **배포 후 기존 잠금해제 전부
  무효 → 각 기기에서 비밀번호 1회 재입력 필요(토리님께도 안내)**. legacy unlock_sessions는
  미참조 잔존(후속 drop). 실계정 검증 필요: 해제→새로고침 유지→지금 잠그기→재잠김, 두 기기
  독립성, 오입력 6회 429.
- **`P0-DATA-1` 완료(2026-07-30, `e302e57`)**: 0058 tombstone(적용됨) + restore 액션/op +
  전 조회 경로 deleted_at 필터 + Ctrl+Z를 같은-id 복구로 교체 + 8초 실행취소 스낵바.
  fling은 복구 가능해져 존치(제거 여부는 이후 판단). '최근 삭제' 보관함 UI는 미구현(P1 후보).
  DB 왕복 실측 4항목 검증. **실계정 검증: 삭제→스낵바 실행취소→태그·하트 보존 확인**.
- **`P0-A11Y-1`/`P0-RESP-1` 완료(2026-07-30, `89092c0`) → P0 12/12 전부 완료 🎉**:
  roving focus 달력(단일 탭 스톱+화살표/Home/End — ←/→가 전역 월 이동과 겹쳐 stopPropagation
  필수였던 함정 기록), 편집 패널 [이동][복제] 버튼(이동=버튼+날짜 클릭, WCAG 2.5.7 비드래그
  대안, insertEventCopy 공통 경로), 가로폰 차단 오버레이 제거(MOBILE_QUERY가 이미 커버).
  A11Y 잔여 소과제(업도움 키보드 경로·공개 semantic list·SR 실기 검증)는 P1에서.
- **P1 진행 중**. `P1-FLOW-1` Quick Add 완료(2026-07-30, `c90d917`): 모바일 시트의
  공개범위·미정·업도움·최초공개 묶음을 기본 접힘 카드로(데스크톱 fold-field와 동일 문법,
  `me-fold`, scopeFoldSummary 공유) — 새 일정 quick tier = 제목→태그→저장. 계획서의
  '셀 팝오버' 안은 사용자 선호(새 일정 = 옆 패널 유지)에 따라 채택 안 함.
  `P1-MOVE-1`은 사용자 결정으로 **제외**(이동/복제 버튼 롤백 — 드래그+Ctrl C/V로 충분).
- **`P1-HIST-1` 완료(2026-07-30, `c6f073c`)**: 통합 다시 실행 — undo/redo 이중 스택,
  단일 실행기(applyHistoryAction)가 적용마다 역연산을 반대 스택에 적재. 새 작업은
  pushUndo 단일 창구로 들어와 redo를 비운다(충돌 가드). Ctrl+Shift+Z/Ctrl+Y.
  삭제 스낵바 복구도 redo 계약에 편입. fixture+스텁 검증 6항목 PASS(_verify_undo_redo).
- **모바일 '오늘' 버튼(사용자 요청, `494e4a7`)**: 하단 레일 시청자 화면 왼쪽 고정 슬롯,
  시청자 화면과 같은 복귀 동작(달 이동 후 오늘 카드 중앙 스크롤).
- **P1 추가 완료(2026-07-30 오후)**:
  - `IPAD-1`(`b9184c0`): 1000px 미만 편집실 = 아젠다 토폴로지(STUDIO_AGENDA_QUERY 999px,
    studio-shell.css 640/641→999/1000 전량 이동). 1024 가로는 데스크톱 유지. 포스터 CSS는
    기존 1040 경계 그대로. 남은 것: 세로 태블릿용 컴팩트 월 오버뷰 스트립(F4)은 미구현.
  - `ROUTE-1`(`e3c65d7`): 월 라우트 URL>쿠키>KST(예전엔 params 통째 무시). parseMonthParams
    단일 출처+단위테스트. 꾸미기 라우트는 쿠키 우선 유지(의도된 설계), NaN 구멍만 봉합.
  - `MOTION-1`(`c9353e6`): 인앱 미설정이면 OS prefers-reduced-motion 따름, 명시적 인앱
    선택이 항상 우선. CSS 게이트는 계속 html[data-reduce-motion] 단일(CLAUDE.md 갱신).
  - `EXPORT-1`(`7e3b28c`): 클립보드 거부/미지원 → PNG 다운로드 폴백(KST 파일명).
    렌더 실패만 '실패' 표기.
  - `VIEWER-1`+`MULTI-0`(`97d74d8`): 모바일 '이 달 기록' 진입을 legendTags 결합에서 해제,
    무액션 범위선택 강조 제거(판서 도구의 실제 범위선택은 유지).
- **P1 전량 완료(2026-07-30 저녁)** — MOVE-1은 사용자 결정으로 제외:
  - `STICKER-0`+`TITLE-1`(`a40b9ab`): 스티커 Tab 포커스=선택(이후 기존 화살표/Delete/
    Ctrl+D/Esc 전역 키가 이어받음, 포인터 불변) + 제목칸 상시 helper(첫 줄=제목 규칙,
    14자 소프트 카운터, 20자 amber 경고) 웹·모바일 공용.
  - `DIALOG-1`(`abd8f56`): `lib/ui/use-focus-trap.ts` 공통 훅 — 초기 포커스 진입 +
    Tab/Shift+Tab 카드 내 순환(capture). 4개 모달(메인·비밀번호·태그 시트·업도움 시트)
    적용. Esc·포커스 복원은 기존 B2 효과. 잔여: 시청자 '이 달 기록' 시트·모바일 편집
    시트는 미적용(터치 중심), background inert 처리도 후속.
- **P2 시작(2026-07-30 밤)**: `P2-ROUTE-1`+`P2-PROTO-1` 완료(`f63675c`) —
  /studio/tags·trusted-members → /studio?panel= 리다이렉트(StudioShell panel 딥링크,
  버튼과 동일 권한 게이트), 가짜 proposals 공개 엔드포인트 삭제(404 계약 테스트),
  supportCampaigns/Proposal/RequestItem 죽은 payload·타입 제거(공개 8→7, 스튜디오 4→3
  병렬 쿼리). DB 테이블은 보존. CHANGELOG_AGENT CHG-20260730-001.
  또: TITLE-1 심화(제목칸 라이브 미러 — 첫 줄 진하게+카드식 세부 레일, `c2fce73`~`f1a1d76`).
- **P2 추가 완료(2026-07-30 밤 2차)**: `KST-1`(월/시각 헬퍼 단일화 + UTC 경계 테스트),
  `STICKER-1` 키보드부(+/- 크기·[/] 회전, 실행취소 묶음), `A11Y-2` 강제색부(색=정보 표면만
  forced-color-adjust:none) — `63c9642`·`aa37bee`.
  **⚠ MULTI-0 롤백(`63c9642`)**: 달력 드래그 범위 강조는 사용자 요청으로 복원 — 방송 중
  기간 짚기 실사용 도구. 계획서의 '액션 없는 상태' 판정은 오판이었다. 다시 제거 금지.
- **P2 3차(2026-07-30 심야)**: `INSIGHT-1` 1차(`4af3ec9`) — 방송시간/트렌드 차트 sr-only
  요약(숫자 비노출 정책 존중, 요약 있으면 차트 aria-hidden). 웹 제목칸 굵기 카드와 통일(`a1ca16f`).
- **판정(supersede 아님, 병합)**: `TOKEN-1`은 기반(색·간격·라운드·그림자·모션 시맨틱 토큰,
  globals :root 단일 관리처)이 **이미 구축돼 있음** — 남은 '산재 리터럴 전면 이관'과 `IA-1`
  (상단 재편)은 애플 리디자인이 같은 선언을 다시 만지므로 **리디자인 단계에 병합**(두 번 작업 방지).
- **`ARCH-1` 1단계 완료(`d96d793`)**: 모듈 레벨 순수 코드(~300줄)를
  `lib/studio/editor-model.ts`로 추출(동작 0 변화, 특성화 테스트 8건 + fixture 회귀 4종 통과).
  단계 계획 = `docs/agent/plans/ACTIVE_PLAN.md`(PLAN-20260730-001) — 2단계(렌더 함수 분리)
  → 3단계(쓰기 큐 훅) → 4단계(undo/redo 훅) → 5단계(그리드/아젠다 분리)는 후속 세션.
  제목칸 라이브 미러/레일은 사용자 결정으로 철회(`bfeb8a5` — textarea 구조 한계).
- **`ARCH-1` 완료(scope-adjusted, `2217dfb`·`1185a1b`)**: 2단계 ReadonlyEventDetail·RoleBadge
  분리, 3단계 useStudioWriteQueue 훅(저장 칩·temp id·flush). 4·5단계(undo/redo 훅·그리드
  분리)는 상태 응집 없인 이득<위험으로 **보류 판정**(ACTIVE_PLAN 참조). 각 단계 fixture
  회귀 통과. **→ 다음 = 애플 기조 리디자인**(TOKEN 이관+IA 재편 포함).
- **🎨 애플 리디자인 계획 항목 완주(`2f31c05`, PLAN-20260730-002 Completed)**:
  1화면 편집 패널 타이포(`c64dbc5`) · 2화면 상단 IA 관리 드롭다운(사용자 A안, `b63644f`) ·
  월 내비 헤더 통합(사용자 요청, `0f88418`) · 3화면 모바일 타이포(`6a6129c`) ·
  4화면 꾸미기 크롬 라벨(표면 불가침, `2f31c05`). 5화면(시청자 크롬)은 기정돈 판단으로
  피드백 주도 전환. **이후 리디자인은 사용자 지적 → 그 지점 수정 루프.**
- **편집 카드 = 앵커 팝오버 전환(2026-07-31, 사용자 결정 — 목업 승인 후)**: 데스크톱 편집
  카드가 우측 고정 슬라이드 패널이 아니라 **선택한 날짜 칸 옆에 뜨는 앵커 팝오버**(absolute,
  workspace 기준·JS 실측 배치 placeEditorPopover — 오른쪽 우선/왼쪽 flip/뷰포트 클램프,
  재선택 시 닫히지 않고 transition으로 이동). 달력은 편집 중에도 전폭 유지(그리드 3번째
  칸·avatar-scene fixed 편집창·≤1180 전폭 행 규칙 전부 제거). 모바일 시트는 그대로.
  기존 바깥클릭 닫기/Esc/serialized 큐 로직 무변. 2차(사용자 피드백): **헤더 바 드래그로
  팝오버 이동**(수동 배치, 다른 날짜 고르면 자동 배치 복귀), **팝오버→앵커 칸 점선 리더 라인
  +도트**(어느 칸의 편집창인지 상시 시각 연결), 헤더 날짜 "M월 D일 (요일)" 형식
  (formatEditorDate, editor-model), 아바타 margin transitionend·달력 ResizeObserver 재배치.
  3차: 드래그 중 React 리렌더 대신 DOM 직접 갱신(끊김 제거), 클램프 완화(가로 140px·헤더만
  화면에 남으면 됨 — 꽉 가두기 금지), 리더 라인 끝점=카드의 앵커 쪽 최근접 가장자리
  (popEdgePoint), 새 일정(초록 +)/일정 수정(보라 ✎) 배지·라인·카드 상단 액센트 색 구분.
  4차: 앵커 좌표를 이벤트가 아니라 **rAF 루프로 매 프레임 실측 동기화**(placeEditorPopover,
  변화 없으면 setState 동일 객체 → 리렌더 0) — 실서비스에서 배치 후 레이아웃 시프트(체인
  등높이 JS 등)로 행이 밀리며 도트가 칸 위로 떠 보이던 드리프트 해결(fixture에 강제 행
  시프트 시뮬로 검증). 드래그 중엔 editorPopDragActiveRef로 루프가 좌표를 안 되돌린다.
  + 카드 맨 위 전폭 '이동 손잡이' 스트립(모드 색 틴트+중앙 그립 필, editor-grab).
  5차(진짜 원인): 드리프트 = **대형 모니터 CSS zoom**(≥1700px .studio-shell 0.9 / ≥2400px 0.8)
  — gBCR은 zoom 반영 화면 px, CSS left/top·SVG 좌표는 zoom 전 로컬 px라 전부 0.9배 지점에
  그려졌던 것(rAF는 무관). getPopZoom()=화면폭/offsetWidth 배율로 나눠 로컬 좌표로 변환,
  드래그 delta도 /z. 2560 뷰포트(zoom 0.8) fixture에서 전 행 오차 0·드래그 1:1 실측.
  ⚠ 교훈: 편집실에서 gBCR 좌표를 absolute/SVG에 쓸 땐 반드시 zoom 보정.
  ⚠ 교훈2(f77e2ac): 드래그처럼 DOM style을 직접 쓰는 상호작용은 종료 시 **DOM도 직접
  동기화**해야 한다 — 새 상태가 React의 이전 상태와 같으면 React가 diff 없음으로 보고
  드래그가 남긴 DOM 값을 안 고친다(파묻힘 미복귀의 진범). 상단 기준선은 하드코딩 대신
  getChromeBottomV(상단바+액션바 실측), 팝오버 최대높이는 --pop-max-h(가용 세로 실측).
  파묻힘 회귀는 22항목 매트릭스(4방향 플링·크롬 침범·up유실·blur·연속·스크롤 × 2뷰포트)로 검증.
  후속 수정: 저장 반짝(.panel-saved)의 잔존 position:relative가 팝오버를 0.6초간 그리드로
  떨어뜨리던 버그(`e256889`) · 태그 모달 저장 푸터 투시 제거(스크롤 래퍼 display:contents
  패턴 + 흐름 밖 고정 푸터) · 공지/방문 버튼은 날짜 선택(새 일정)에만 노출(`e41bca5`).
  6차 스타일(사용자 요청): 카드 밖 4px 오프셋 모드색 점선 아웃라인(리더 라인과 같은 색
  언어) + 앵커 도트 흐림(r4.5, fill-opacity .42, 흰 테두리)(`beac3d6`) — 카드 반투명은
  '집중이 안 된다' 피드백으로 **롤백**(불투명 var(--surface) 복귀) + 팝오버 세로 압축
  (폼 gap/패딩·칩 33px·트레이 여백·fold-head 38px 한 단계씩 축소) + 카드 폭 384→356
  (압축 후 비율이 옆으로 뚱뚱해 보인다는 피드백; form·readonly 동시 이동 필수).
  ⚠ 함정: .editor-grab 전폭 스트립 음수 마진은 폼 패딩과 동치여야 — 패딩만 줄이면
  2px 튀어나와 폼(overflow-y:auto)에 가로 스크롤바가 생긴다(overflow-x:hidden 안전벨트 추가).
  7차 태그 트레이
  애플식 정돈: 태그 색을 인라인 style 대신 **CSS 변수(--tp-bg/--tp-border/--tp-ink)**로
  넘기고(tag-picker.tsx, 기본 렌더 불변 — 모바일 시트 fixture로 확인) 팝오버 스코프에서만
  재해석 — 안 고른 칩 = 중립 표면 + 왼쪽 9px '색 점', 고른 칩만 태그 색 채움, 호버 =
  color-mix 24% 틴트, 콘텐츠/형식 칸 같은 헤어라인 문법(형식만 점선이던 비대칭 제거).
  ⚠ 함정: dev 서버 살아있는 채 `npm run build` 돌리면 .next를 덮어써 정적 청크 전부
  ERR_ABORTED(무스타일 렌더) — 빌드 후 dev 재시작 필요.
- **시청자 포스터 헤더 재편 + 메모 컬럼 삭제(2026-07-31, 사용자 결정)**: 서비스 제목
  '✨빅토리 일정표✨'는 상단 크롬(내 관심 ↔ 이 달 기록 사이, .poster-chrome-title)으로 이동
  — **공식 PNG export는 연·월만 표기**(사용자 확정). 표면 헤더 = 큰 '2026년 07월'(54px).
  왼쪽 메모지(238px) 컬럼은 기능째 삭제(surface 2컬럼: 달력 1fr + 우측 220px) — 달력이
  ~254px 넓어짐. 모든 모드가 같은 지오메트리라 스티커 모드 간 불일치 없음. 과거 달 메모지
  위 스티커는 그대로 존치(사용자 확정 — 필요시 꾸미기에서 수동 이동). publicMemo/memoLines
  DTO 필드는 UI 소비자 0인 레거시로 존치. 모바일 아젠다는 무변.
  이어서: **PC 시청자 일정 상세 팝오버** — 달력 카드 클릭(Enter/Space 포함) 시 모바일 상세
  시트와 같은 내용(agendaDetail 재사용)이 카드 옆 앵커 팝오버로 뜬다(anchor 있으면 is-pop
  분기, fixed·flip·클램프). interactive 모드만(꾸미기·캡쳐 无). 바깥 클릭/Esc 닫기.
- **시청자 레일 재편 + 라이브 카드 + 캡쳐 삭제(2026-07-31, 사용자 결정)**: ① 레일(태그
  필터 위) 업도움 카드 → **정보 카드**(🎂 데뷔 D+N(debutDPlus, holidays)·오늘 날짜 —
  전 모드 렌더, 캡쳐에도 찍힘). ② 업도움 접근은 **달력 띠 클릭 → 상세 팝오버 '도우러
  가기'**(support-bar.is-clickable, interactive만). ③ **라이브 카드**: 방송 중이면 우하단
  플로팅(soop-live-card, 표면 밖 fixed)에 SOOP 임베드 플레이어(bjId/bno로
  /{bjId}/{bno}/embed?autoPlay&mutePlay)+LIVE 배지+제목/보러가기 — 옛 좌상단 알약 비콘
  대체(모바일은 기존 '오늘'→LIVE 버튼 유지). ④ **일정표 캡쳐(클립보드/PNG) 기능 삭제** —
  poster-export-actions 컴포넌트·canExport prop·html2canvas 의존성 제거(토리님 미사용).
  공식 Playwright export 경로(tests)는 별개로 존치.
  2차(디자인+기능): 편집실 팝오버 문법 이식 — 카드→팝오버 **리더 점선+도트(대표 태그 색)**,
  **그립 띠/헤더 드래그 이동**(DOM 직접 갱신+손 뗄 때 상태 확정), rAF로 카드 위치 매 프레임
  실측(스크롤·리사이즈 추적, 카드가 DOM에서 사라지면 자동 닫힘). 디자인: 대표 태그 1~2색
  그라데이션 그립 띠(--dt-c1/c2) + 흰 카드 + 타이포 정돈(제목 21px 앵커).
  아울러 **편집실 아바타 자리 = 항상 켜짐**
  (끄기 토글 제거, 좌/우만 선택 — vic_avatar_on 키는 이제 시청자 포스터 전용, 시청자
  미리보기는 controlled 공유를 끊고 포스터 자체 상태로). fixture+Playwright 실측(anchor/
  flip/bottom-clamp/재클릭 닫기/아바타 컨트롤) 통과.
- **아바타 scene 재배치(2026-07-31 밤, `ca74d37`, 사용자 목업 승인)**: 아바타 자리 ON이면
  (시청자 미리보기+꾸미기 공통) 표면 안 오른쪽 레일을 접고(grid 컬럼 252→0 트랜지션) 달력이
  표면 1840 전체 차지. 태그 필터 = 아바타 **반대편** 얇은 1열 fixed 레일(.avatar-side-rail,
  인기도 포함), 정보 카드 = 아바타 자리 좌상단·라이브 카드 = 우상단(.avatar-top-cards).
  스프링 슬라이드/팝-인, reduce-motion 존중, <1100px는 평소 복원. 마크업 공용화:
  railInfoCard/renderLegendFilter 추출. ⚠ 스티커는 표면 비율 좌표라 scene(달력 폭 확장)에선
  비-scene 배치와 가로로 어긋남 — 꾸미기도 scene이 켜지므로 scene에서 꾸미면 scene과 일치.
  캡쳐 삭제로 '표면 고정 레이아웃(ADR-0004)' 제약은 사용자 결정으로 해제됨.
  후속(2026-08-01, ~`7b58cd9`): 레일 120px·아바타 22vw·여백 다이어트, 인기도 1열 축약
  (is-compact), 카드=점선 박스 완전 위(+꾸미기는 --avatar-h 72px 축소로 헤더/토글 회피),
  꾸미기 단축키 안내 접기+의미 그룹 3개,
  시청자 달력 Ctrl+휠 글자 확대 100/125/150(포스터 --cal-zoom, 하단 배율 배지).
- **스티커 scene/확대 드리프트 최종 해결(2026-08-01, ~`b865b5f`)**: 저장 좌표(DB)는 기본
  지오메트리(아바타 OFF·100%) 표면 비율 그대로, 렌더 시 기준(canon)↔현재(live) **실측 앵커
  구간별 매핑**으로 보정(저장 시 역매핑). x 앵커=열 경계+각 열의 카드 좌/우변(여백 상수 고정),
  y 앵커=스티커가 앉은 칸의 [칸 top·날짜줄·각 카드 상/하단·칸 bottom]. 기준은 항상 probe
  (한 프레임 안에서 scene 클래스/--cal-zoom을 트랜지션 off로 원복→실측→복구, reflow 후 클래스
  해제로 재전환 방지)로만 얻고, 표면 등장/월 슬라이드 애니 중엔 미루고 450ms 재시도(중간
  지오메트리 오염 방지). 월 전환 시 기준 무효화. Playwright 실측: 6모드(아바타×확대) 카드
  4지점 delta 0.0px, 5회 로드 동일 수렴. fixture `?avatar=1`, dev `__stickerMapDebug`.
  ⚠ 상수 폴백의 252/16은 .poster-surface 컬럼과 동기.
- **피드백 루프 3회전(2026-07-30, `4a06856`·`60ba610`·`43ebf8f`)**: 사용자 스크린샷 지적 →
  즉시 수정 방식. 주요 결정·함정 기록:
  - **그림판 왼쪽 기둥 = 달력 카드만(콘텐츠 높이, 항상 펼침)** — '접기=좌측 수납' 안도,
    그 다음 '아바타 점선 자리' 안도 사용자 결정으로 순차 제거. 접기 토글 자체가 없어졌고
    헤더는 월 라벨 span. 접기/아바타 존 재도입 금지.
  - 레이어 썸네일은 **전체 판 100% 축소**가 정본(획 bbox 크롭 안은 위치 맥락 상실로 롤백).
  - 미니 달력 '보냄'은 글자 배지 금지 — 칸 하이라이트 + aria-label만.
  - 도구 셸프: max-height 상한 금지(바닥 고정, 위로 성장 — 상한이 굵기 행을 잘랐음),
    굵기 6개 한 줄, 그룹 stretch로 등고.
  - 공지류 모달: 하단 여백은 스크롤러 padding-bottom이 아니라 **sticky 푸터 자신이** 가진다
    (스크롤러 방식은 푸터 아래 투시 구간 발생).
  - `.scope-opt.on::after` 같은 높은 특이도 구규칙은 리디자인 오버라이드 시 **같은 특이도로
    기하까지 전부 재선언**해야 함(체크 마크 어긋남 사고).
  - flex 컨테이너 안 혼합 인라인 텍스트는 조각화됨 — 문장은 항상 단일 span으로 감싸기(tag-tip).
  - 저장 배지: 최장 상태 폭 min-width 고정 + 좌측 정렬(출렁임 금지 패턴).
  - **신규 기능**: 모바일 시청자 일정 카드 탭 → 상세 바텀시트(`agenda-detail-*`, 공개 DTO만,
    태그 이름·색 표시). 데스크톱 미연결(아젠다 전용).
  - 검증: tsc·build·vitest 324개 통과. Playwright visual은 미실행(신규 시트 baseline 없음 —
    다음 visual matrix 배치에서 수용할 것).
- (시작 기록) 애플 리디자인 시작(`c64dbc5`, PLAN-20260730-002): 기반=타이포 역할 토큰 6종
  (--text-*, 현행값 스냅) + 1화면(데스크톱 편집 패널) 11종 px→6역할 수렴 + me-seg 동심.
  방식: 화면당 1슬라이스 배포→**사용자 눈 확인 후** 다음(2=상단 IA는 모형 승인 선행,
  3=모바일, 4=꾸미기, 5=시청자 크롬). 롤백 금지 목록(모달 글래스·fly 전이 등)은 플랜 참조.
- **✅ 사용자 실기기 검증 완료(2026-07-30, `4f2cc3c` 기준)**: 범위선택 복원·undo/redo·
  키보드 달력·모달 트랩·월 북마크/panel 딥링크·평소 편집 흐름·저장 칩·읽기전용 상세·
  역할 팝오버·스티커 키보드·캡쳐 폴백·모바일 시트/오늘/스낵바·아젠다 경계 — 전부 정상 확인.
- **P2 잔여(리디자인과 무관, 선택)**:
  `COLOR-1` 색 picker 키보드/컴팩트 시트, `CONFLICT-1`(증거 게이트 — 실제 충돌 관찰 후),
  STICKER-1 잔여(스냅 큐·터치 핸들), A11Y-2 잔여(200/400% 줌·SR 실기), INSIGHT-1 잔여(데이터 표).
  **그 다음(또는 ARCH-1 후) 애플 기조 리디자인**(TOKEN 이관·IA 재편 포함).
- **주의**: role fixture·canary 자동화는 아직 부분적(event-validation 단위 테스트만). 계획서
  K5 매트릭스 기준으로 슬라이스마다 채울 것.

## (이전) Objective

시청자 포스터의 **몰입·재미·편의 개선**(스냅샷 + 멀티에이전트 평가/리서치 기반)이 방금 끝났고,
지금은 **편집실 UX 다듬기**와 **시청자 참여 기능**으로 넘어가는 중.

## Current Status

- **운영 중(안정)**: 공개 포스터(`/`), 편집실(달력/태그/멤버/비공개 레이어), 꾸미기·PNG export,
  하트(비로그인 포함), 관리자 인사이트, 태그 2계층, 비공개 본문 암호화, 방송시간 기록.
- **2026-07-29 — '이 달 기록' 닫기 정책 + 애플 HCI 벤치마크 1차**(`bb23f6f`, `bf70da9`, `028e6f0`):
  - '이 달 기록' 시트는 **백드롭 클릭으로 닫히지 않는다**(신고 반영 — 같이보기 방송 중 오클릭
    사고 방지). 닫기 = X·Esc·뒤로가기만. overlay-pop에 800ms 유예 안전망(방금 안쪽이 닫혔으면
    지각 popstate도 안쪽 몫 → 미리보기 오닫힘 방지, 대신 시트 닫은 직후 0.8초 내 뒤로가기는
    한 번 무시될 수 있음 — 의도된 비대칭).
  - **X/백드롭 → 편집실 튕김은 현재 코드로 재현 불가**였다(dev·prod build, 정상/cold-entry/
    좁은폭/판서 churn/더블클릭 전부 미리보기 유지 확인). 원인 미상 리포트에 대해 위 정책 변경
    + 안전망으로 대응. 재현용 **편집실 fixture** `app/visual-fixture/studio`
    (`VISUAL_TEST_FIXTURE=1` 전용, owner actor + 샘플 데이터, `?viewer=1`로 미리보기 cold-entry)
    를 추가했다 — 오버레이 스택 회귀는 여기서 인증 없이 실측할 것.
  - **애플 HCI 리서치 보고서** `docs/ux/apple-hci-benchmark-report.md`(조화·몰입·재미 3×3,
    적용 후보 12건 P1~P3). 1차 적용(A1·A2): `globals.css`에 `--spring-smooth/--spring-bouncy`
    `linear()` 스프링 토큰(+`--dur-spring-*`), 전역 버튼 누름 70ms 즉각/뗌 스프링 복귀,
    '이 달 기록' 시트 등장·아바타 자리 등장/슬라이드·pop-number 스프링 치환. 다음 후보:
    C1(재질 토큰)·A3(코너 동심 감사)·B1(모바일 시트 드래그 닫기).
  - lint 경고 6건 제거로 `npm run lint`(max-warnings=0) 게이트 복구.
- **2026-07-29(밤) — 애플 HCI 벤치마크 P1~P2 일괄 적용**(`a67b758`…`1aaf2c5`, 검증 12/12 PASS):
  - **마이크로 인터랙션**: 모든 X 닫기 버튼에 그림판 X와 같은 호버 90° 회전+스프링 복귀
    (.pi-close/.modal-close/.dtp-pop-x/.m-edit-x/.peek-close/.bp-kbd-close). 모달·팝오버·
    바텀시트 등장을 `--spring-smooth`로 통일.
  - **C1 재질**: `--material-*` 토큰 + 모달/날짜시간·태그색·확대 팝오버/판서 단축키 안내를
    반투명 블러 유리로(@supports 가드, export surface 밖).
  - **B1**: 모바일 편집 시트 끌어서 닫기(`lib/ui/use-sheet-drag-close.ts`) — 1:1 추적·위로
    러버밴딩·릴리스 속도 스프링·임계 햅틱. **함정 2개 실측으로 잡음**: pointerdown 즉시
    setPointerCapture 금지(click이 캡처 요소로 가서 X 먹통), click 억제 플래그는 제스처 후
    반드시 자동 해제.
  - **B2**: 모바일 카드→시트 matched-geometry morph(열림=카드에서 자람, X/백드롭 닫기=역방향),
    웹은 카드 잔상 비행(`lib/ui/fly-ghost.ts`)으로 고정 편집 패널과의 연결감만.
  - **B3**: 스티커 경계 러버밴딩(표시만, 저장 좌표는 기존 clamp·직렬 큐 불변) + 스냅 노치 햅틱.
  - **B4**: 아젠다 필터 FLIP(`lib/ui/list-flip.ts`) — 시청자·편집실 모바일 아젠다.
  - **D1**: 캡쳐 성공 시 완성본 미니 썸네일 스프링 팝인 + 2틱 햅틱.
  - **부수 대어**: 편의 캡쳐(클립보드)가 **07-19부터 조용히 깨져 있었음** — `.event-subs`
    세로 레일의 `color-mix` computed(`color(srgb …)`)를 html2canvas가 파싱 못 해 전체 throw.
    transparent border + `::before`(currentColor+opacity)로 픽셀 동일하게 복구(`4a88582`).
    **교훈: export surface 안에는 color-mix 금지**(html2canvas 한계).
  - 검증 인프라: `scripts/_verify_hci.mjs`(12항목 실측), visual baseline 재캡쳐(stale이었음 —
    clean HEAD에서도 실패 확인 후 갱신). fixture가 프로덕션 빌드에서 무스타일이던 문제
    (studio-shell.css는 (studio) layout 소유)도 fixture 직접 import로 해결.
  - **디스코프**: C2 타이포 역할 토큰(전면 px 토큰화) — 100+ 지점 산재라 시각 리뷰 없이
    일괄 치환은 회귀 위험이 커 보류. A3 코너 동심 전수 감사도 스폿체크만(보상 썸네일 등
    신규 UI는 규칙 적용). 다음 세션에서 화면 단위로 진행 권장.
- **2026-07-27에 끝난 것 — 일정 그림판 작업 문맥 편의**:
  - 패널 세션에서 처음 일정을 보내면 `일정` 레이어 표시·활성 + `선택` 도구로 자동 전환. 모든
    카드를 뺐다가 다시 보내는 경우를 포함해 이후 보내기는 현재 그림 레이어·도구 유지. 보내기 뒤
    disabled 버튼에 남던 키보드 포커스도 다음 작업점으로 이동. 숨긴 일정 레이어에 새 날짜를 보내도
    레이어 표시를 복구해 결과가 즉시 보임.
  - 색 선택은 `선택/지우개 → 펜`, 굵기 선택은 `선택 → 펜`; 형광펜·지우개·도형처럼 해당 값을
    직접 쓰는 도구는 유지. 색·굵기·그리기 도구를 고르면 최근의 표시·잠금 해제 그림 레이어로
    자동 복귀. 숨김/잠금 자동 해제와 레이어 자동 생성은 하지 않음.
  - 커스텀 색 미리보기 취소 시 색뿐 아니라 도구·레이어도 원복. 새 빈 레이어는 선택/지우개 상태면
    펜으로 시작. 레이어 삭제/undo/redo 뒤에는 사용 가능한 그림 레이어를 우선 선택하고, 일정 레이어
    문맥은 이력 조작이 뺏지 않음. 미니 달력 `보냄` 표시 + 중복 전송/무의미한 undo 이력 제거.
  - 스타일러스에서 OS가 CSS 커서를 숨겨 판서 중 도구가 안 보이던 문제: pen 전용 DOM 커서를
    추가. hover/down/move 추적, up/cancel/lost-capture/leave 정리, 펜·형광펜·지우개 footprint와
    도형 crosshair/아이콘 표시. 마우스 전환 시 native cursor 복구, 활성 pen 우선권·touch 무시,
    240Hz 경로는 React state 갱신 없음.
  - 새로 열면 `펜 + #000000 + 레이어 1`로 즉시 판서 가능. 그림 레이어의 썸네일·이름을
    마우스/펜으로 직접 끌어 보라 삽입선 위치에 놓는다. 5px 의도 임계값, drag ghost,
    독립 목록 edge auto-scroll, `Alt+ArrowUp/Down` 대체 경로를 제공하고 이동 1회만 통합
    undo/redo 1건. drop 위치는 drag 시작 때 한 번 측정해 긴 목록의 pointer move layout 재측정을
    없앴고, 다중 포인터·목록 밖 drop·Esc·pointercancel은 안전하게 취소. 새 레이어는 스크롤
    목록 맨 위로 자동 노출·포커스하고 키보드 순서 이동도 화면 안에 유지. 눈·잠금·삭제는
    drag에서 제외하며 `일정` 구조 레이어는 맨 아래 고정.
  - 임의의 그림 레이어 6개 hard cap과 `(n/6)` 노출 제거. `+ 새 레이어`로 계속 추가하되 기존
    총 backing-pixel 예산을 레이어 수로 나누고 필요하면 0.25 scale 아래까지 해상도를 적응시킨다.
    DOM·썸네일·stroke 비용은 별도라 물리적 무한을 보장하지 않으며, 수백 레이어가 실제 요구되면
    virtualization·hidden backing 해제를 후속 검토.
  - 상단을 `현재 작업·기록 명령 / 이름이 보이는 도구·도형 / 색상 팔레트·빠른 판서 설정`으로
    재구성. 좁은 데스크톱 폭은 내부 가로 스크롤, 명령 바는 줄바꿈. 선택 카드 정렬은 선택
    문맥에서만 나타난다.
  - 모바일은 일정 그림판 진입점이 없어 범위 제외. 검증: vitest **294/294**, typecheck,
    changed-files lint, production build 통과. 전체 build의 기존 lint 경고 5개는 유지.
    구현 커밋 `376e7eb` Vercel Production 성공. 연결 브라우저가 없어 실제 렌더·마우스 drag·
    실기기 펜 스모크는 미실행.
- **2026-07-12에 끝난 것**(커밋 `9324779`…`c509657`):
  - 미니게임 opt-in화 + 시즌 테마 강제 해제 + 태블릿(641~1040px) 아젠다 전환 → [ADR-0009](decisions/ADR-0009-seasonal-toys-are-opt-in.md)
  - 포스터 마스트헤드/시각 위계/대비(WCAG AA) · 모션 토큰(`--ease-enter/exit`, `--dur-4/5`) ·
    빈 날 접기 · 셀 호버 · 하트 승급 토스트
  - **시청자 '이 달 기록'(공개 인사이트)** — 관리자와 같은 차트 재사용, 집계 RPC로만 개방 →
    [ADR-0008](decisions/ADR-0008-public-insights-aggregate-rpc.md) (마이그레이션 0049·0050 적용 완료)
  - 편집기: 공개 범위·옵션 접기(기본 접힘), 단축키 안내 축약, **새 일정 = Alt+N 하나로 통일**,
    카드 순서 드래그 삽입선 판정(카드 중심선 기준)
- **2026-07-26에 끝난 것**(`6e1ee43`, `4c7b01c`):
  - **하트 배지 사라짐 수정**(`6e1ee43`, 마이그레이션 0054 적용 완료): 로그인 토글
    `toggle_event_heart`가 익명 하트를 빼고 집계를 반환 → 클라가 그 작은 수로 덮어써
    배지(🔥 5개↑)가 사라지고 새로고침해야 복귀하던 증상. 0040에서 이 함수만 합산 누락.
  - **방송시간 머리 손실 수정**(`6e1ee43`): 세션 started_at을 '첫 폴링 발견 시점' 대신
    방송국 API `broad.broad_start`(실제 뱅온 시각)로 기록(`fetchSoopBroadStart`,
    bno 일치 확인 + 이상치 가드). 시청자가 늦게 들어오면 그만큼 깎이던 문제(4h24m→4h).
    꼬리(ended_at=last_live_at)는 보수적 추정 유지. → [[broadcast-time-tracking]]
  - **판서 패널 손맛·필기감**: `4c7b01c`·`45e3711` 이후 연구값을 제품 예산으로 과장하지 않게
    [근거 아카이브](../ux/broadcast-panel-inking-research.md)를 교정. coalesced 단일 소비 +
    분리 prediction 캔버스, 필압 감마(^0.65)·시간 기반 EMA, pen-priority palm guard
    (첫 touch 오탐/hover 연장/pointercancel 커밋 제거), WCAG 잉크 아이콘 대비·중립 outline,
    KST 오늘 링 자정 갱신, 레이어 28px 표적. 작업대는 따뜻한 라이트 톤 유지. 모바일은 기능
    진입점 자체가 없어 범위 제외. 검증: vitest 256/256 · typecheck · production build 통과;
    연결 브라우저가 없어 실제 판서 화면/실기기 펜 검증은 미실행.
- **2026-07-25에 끝난 것(2) — 방송 가독성 2종(토리님 승인, PLAN-20260725-001)**
  (`15181d4`·`57f2c75`·`effd28c`·`3c8cd46`·`9717a57`·`6d2b359`):
  - **A안 달력 확대**: 달력 패널 위 Ctrl+휠만 가로채 `--cal-zoom` CSS 변수로 100/125/150%
    단계 확대(브라우저 줌의 모바일 전환 부작용 회피). 125%+는 서브 접기 `+N` + 상세 팝오버
    (핀·Esc·실측 배치·포커스 복귀). 트랙패드 정규화·드래그/FLIP/유령 회귀 가드,
    buildbox `−/%/＋` + 확대 중 하단 플로팅 배율 표시. `lib/ui/calendar-zoom.ts`(13 tests).
  - **B안 방송 판서**: 미리보기(owner/developer·PC)에서 여는 전체화면 불투명 모달.
    서버 공개 스냅샷→명시 DTO만(→ [ADR-0010](decisions/ADR-0010-broadcast-panel-public-dto-only.md),
    teaser fail-closed 마스킹, 유출 canary 테스트). 미니 달력 다중선택→날짜순 나란히,
    stroke 벡터 엔진(`lib/broadcast/stroke-engine.ts`, 증분 렌더·undo 200·DPR/픽셀 cap),
    배경 DOM+캔버스 3장 동좌표 스크롤, 화면 맞춤(판서 있으면 잠금), 히스토리 스택 편입
    (뒤로가기=판서만 닫힘), 닫으면 완전 소멸(저장소·클립보드 미사용 정적 단언).
  - 훅 확장: `useCellRangeSelect`에 exemptRefs·getSelected·clearSelection·toggleIndex·
    escapeClears(opt-in, 기존 소비처 불변).
  - 검증: tsc/lint/build 0 · vitest 229/229 · Codex 더블체크 게이트 총 16회(G0×3 · G1×3 ·
    G2×2 · G3a×2 · G3b×6) 전부 통과. **남은 검증**: 실기기 스모크
    [docs/ux/broadcast-tools-qa-checklist.md](../ux/broadcast-tools-qa-checklist.md) 전항 미실행.
- **2026-07-25에 끝난 것**(`9911cb7`, `a03670e`):
  - **방송시간 오귀속 수정 + 재발 방지**(`9911cb7`, 마이그레이션 0051): 연속 방송이 새벽·무관중
    폴링 공백(`SESSION_GAP_MS` 4h)을 만나 두 세션으로 쪼개지고 뒷부분이 다음날로 오귀속되던 버그
    (실제 22일 9h34m→3h41m). SOOP **BNO(방송번호)**를 세션 연속성 정답값으로 도입 —
    `broadcast_session.bno` + `recordLiveTick(bno)`, bno 같으면 공백 무시하고 이어 붙임. 과거
    22·23일 데이터도 보정(1회, 하드코딩 id). → [[broadcast-time-tracking]] 갱신.
  - **월별 방송시간 툴팁 잘림**(`9911cb7`): 최신 막대가 100시간대(3자리)면 `.trend-bar::after`가
    가운데 정렬이라 패널 밖으로 잘리던 것 → 첫·마지막 막대만 가장자리 정렬.
  - **모바일 아젠다 형식색 점**(`a03670e`): PC처럼 마지막 서브 줄 오른쪽에 인라인(높이 절약) +
    오른쪽 정렬. 편집실은 왼쪽 정렬 별도 줄이었음. `.agenda-subs .pill-sub-last` 추가.
- **2026-07-21에 끝난 것**(`6c52a2a`): 시청자/편집실 다듬기 3종 —
  (1) 비로그인 '이 달 기록'의 최근 6개월 트렌드(StackTrendChart, vt-*)가 스타일 없이 깨지던 것.
  vt-* 구조 규칙이 `studio-shell.css`(=편집실 전용)에만 있어서 — 2026-07-17 하이라이트 카드와 **동일
  버그 클래스**. 구조 규칙을 공유 `insights-charts.css`로 옮겨 해결(anon playwright로 3차트 렌더 확인).
  (2) 모바일 시청자 아젠다 폭(좌우 22)이 편집실(`.studio-mobile` 14)보다 좁아 같은 글자 수 특별한 날
  표기가 시청자에서만 줄바꿈 → `.agenda-mode` 좌우 14로 통일(데스크톱 서페이스 기본 22 불변). 색상
  필터 레일은 시청자 104 vs 편집실 92인데 시청자 레일은 '이 달 기록'·미니게임·'내 관심' 라벨이 92↓에서
  잘려 유지 → 잔여 ~12px 폭차는 의도. (3) 특별한 날 조합 표기 순서 '이름·경기'→'경기·이름'.
- **2026-07-17에 끝난 것**: '이 달 기록'·인사이트 잘림 3종 —
  (1) 하이라이트 카드 스타일이 `studio-shell.css`(= (studio) 레이아웃 전용)에만 있어 **비로그인
  시청자에겐 통째로 안 붙던 버그**를 발견해 `insights-charts.css`로 이동(차트가 이미 같은 이유로
  분리돼 있던 것과 동일 조치). (2) 긴 제목 = 가로 스크롤 대신 …+호버/탭 툴팁(`.hl-sub`도 검사),
  문장형 sub는 아랫줄 전체 폭. (3) 일별 방송시간 툴팁을 툴팁 실측 폭으로 clamp(고정 32px이라
  1일·말일에서 패널 `overflow-x:hidden`에 잘렸다). 포스터 상단 '내 관심'/'이 달 기록' 간격 추가.
- **2026-07-17(2)**: 꾸미기 — 업로드한 커스텀 이모지를 눌러도 달력에 안 올라가던 버그.
  칩 래퍼 div에 `setPointerCapture`를 걸면 뒤따르는 click이 **캡처 요소로 리타겟**돼 안쪽
  `<button>`의 onClick이 아예 오지 않는다(브라우저 실측). 캡처는 관리 권한자에게만 걸려
  관리자에게서만 재현됐고, 같은 이유로 칩의 × 삭제도 죽어 있었다. → 캡처 경로에선 pointerup에서
  직접 추가하고, ×는 캡처를 걸지 않는다. **교훈: 포인터 캡처 + 안쪽 버튼 onClick 조합 금지.**
- **2026-07-17(3)**: 꾸미기에서 놓은 스티커가 시청자 화면에서 칸 대비 위로 떠 보이던 문제.
  표면 **안**에 모드로 갈리는 것이 있으면 안 된다(ADR-0004). 범인은 **🔥 관심 등급 배지**
  (`tier`가 `interactive &&`로 게이팅 → 꾸미기엔 없음): 이 배지가 카드 흐름에 있어 1행 +7px,
  2행 +19px → 표면 26px 김 → 칸은 26px 내려가고 스티커는 비율이라 14px만 내려가 ≈12px 어긋남.
  같이 고친 것: 메모 칸(내용 없으면 시청자만 컬럼째 접혀 가로로 밀 수 있던 잠복 버그) → 항상
  자리 유지 + 라벨만 숨김 · 범례 태그(꾸미기만 `<span>`이라 3.8px 차) → 마크업 통일 + disabled ·
  ♥ 인기도 안내 박스도 모드 무관 렌더. 실측: 표면 높이·달력 42칸·범례 Δ **전부 0**.
  → 남은 리스크(2026-07-17 **감수하기로 결정**): 하트가 5개(`HEART_MIN`) 문턱을 넘으면 그 카드에
  배지가 생기며 칸이 7~19px 커진다 → 월초에 놓은 스티커가 하트가 쌓이며 조금씩 밀린다.
  단 그 순간에도 꾸미기·시청자·PNG는 서로 일치한다(등급 상승 🔥→🔥🔥→👑은 줄이 이미 있어 높이 불변
  — 문제는 0↔5 문턱 하나뿐). 배지를 absolute로 빼는 안은 **기각**: 표면이 26px 줄어 기존 스티커를
  전부 한 번 재조정해야 하고, 카드 네 귀퉁이가 이미 ♡(우상)·형식색 점(우하)·제목(좌상)·소제목(좌하)로
  차 있어 어디에 놔도 겹친다. '메타 줄 항상 예약' 안도 기각(35개 중 26개 카드가 그 줄이 없어 포스터가
  100px 넘게 길어진다). 다시 꺼내려면 이 비용부터 반박할 것.
- **2026-07-17(4)**: 작은 스티커의 크기·회전 핸들이 스티커를 삼키던 문제. 디자인 툴 밴치마킹
  (Sketch=선택박스 부풀리기 / Figma=핸들 숨김 / PS·AI=겹쳐 쌓기, 공통점은 **핸들을 객체 크기에
  비례시키는 툴이 없다**) 후 **Sketch식 최소 선택박스**를 채택: 스티커가 작으면 링을 화면 기준
  72px까지 부풀려 핸들을 스티커 밖으로 밀어내고, 링 안쪽 전체가 이동 손잡이가 된다.
  회전은 알약 버튼을 없애고 링 바깥 22px 띠(Photoshop식 핫존, 호버 시 점선+⟳ 힌트)로.
  핸들은 `--poster-scale` 역보정으로 **어느 배율에서도 화면 28px**(히트영역 44px).
  → 참고: 이 값들은 `.sticker-item`의 `--h-size/--h-hit/--ring-min/--rot-band/--ring-out`.
- **2026-07-17(5) — 개선안 배치 1~3 적용**(`1d50628`, `ba59cb3`, `3c30810`, `20f3682`):
  하트 2단계 햅틱 + 실패 토스트(액션이 **throw**하면 롤백조차 안 되던 구멍을 실물 테스트로 발견) ·
  월이동/관심토글/필터해제/시트X 촉감 통일 · 브로드 게이팅 3곳 제거(TagPicker·태그삭제·취소) +
  tags/palette prop에 in-flight 가드 · 미들웨어 matcher에서 비콘·공개 API 제외 · 월드컵 장난감
  dynamic 전환(`/` 177→152 kB, 꾸미기 181→151 kB).
  → **곁가지로 프로덕션 500 발견·수정**: `/api/public/vic/events`가 Server-Timing 헤더의 한글
  desc 때문에 매 요청 500이었다(헤더는 ByteString만). 공개 API 계약인데 e2e가 NOT RUN이라
  흘러갔다. `ServerTiming.header()`에서 방어 + 유닛 테스트 4개 추가(vitest 140).
  **교훈: e2e(`npm run test:e2e`)를 계속 안 돌리면 공개 계약이 조용히 깨진다.**
- **2026-07-17(6) — 개선안 배치 4~6**(`d276c91`, `c17955a`, `a52b1dd`, `3a5eac4`):
  필터 흐림에 업 도움 끈 포함 + 스르륵 전환 · 리사이즈 rAF 스로틀(폭 안 바뀌면 갱신 0회) ·
  `getEventsForDate` 정리(**단 감사의 "O(N²) 최우선"은 실측 결과 오판 — filter가 sort보다 먼저라
  병목 아님. 250건에서 0.22→0.20ms**) · 폰/태블릿 '이 달 기록' 진입점(ISSUE-002 해소) + 바텀시트 ·
  하트 탭타깃 44px(의사요소 — 표면 지오메트리 불변 확인).
  → 새 안전망: `tests/unit/events-for-date.test.ts` 10개(달력 정렬 규칙 고정). vitest 150.
  → **함정 2개 기록**: ① 미디어쿼리는 우선순위를 안 올린다(모바일 블록은 기본 규칙 뒤에 둘 것)
  ② **PowerShell 5.1 `Set-Content`로 한글 문서를 쓰면 깨진다**(시스템 코드페이지) — 문서 수정은
  Edit 도구로만.
- **2026-07-17(7) — 개선안 배치 7~10 + 신고 대응**(`69b619f`, `492de15`, `a07caf1`, `dc69957`,
  `29f5d6f`, `503d628`): 인사이트 로딩 점프 46→4px·정직한 실패 · 폰 뒤로가기로 시트만 닫히게 ·
  버튼 셋(켜기/이 달 기록/편집실) 옷 통일 + 미니게임 칩 32px · 하이라이트 네 장 골격 통일 ·
  Esc 해제/단축키 안내 · **드래그 이동 Ctrl+Z** · 서버 왕복(admin 싱글턴·캐시헤더·page 병렬·
  GoTrue N+1·0051 RPC+폴백) · **죽은 코드 1,483줄 제거**.
  → 겹친 오버레이 뒤로가기: 편집실과 그 안의 포스터가 **각각** popstate를 들어 한 번에 둘 다
  닫혔다. "안쪽이 표식 남기고 바깥이 건너뛴다"는 **실패**(바깥이 먼저 불려 안쪽을 언마운트시킨다).
  → `lib/ui/overlay-pop.ts` 카운터 방식으로 해결. 새 오버레이를 겹칠 땐 이걸 쓸 것.
    (**2026-07-18 정정**: 이 카운터도 '순서 무관'이 아니었다 — 아래 (8) 참고.)
- **2026-07-18 — 신고 2건**(`f5c058d`, `3272736`):
  ① '이 달 기록' X/바깥클릭이 미리보기까지 닫아 편집실로 튕김. 원인: overlay-pop 카운터를
     안쪽 메아리 핸들러가 **동기적으로** 내렸는데, 미리보기 안 포스터는 새로 마운트된 자식이라
     그 popstate 리스너가 바깥(StudioShell)보다 **먼저** 불릴 수 있다 → 바깥이 볼 땐 이미
     innerDepth=0 → '내 pop'이라 오인해 viewerMode를 닫았다. (7)의 '순서 무관' 가정이 틀림.
     → 메아리의 `popInnerOverlay()`를 `queueMicrotask`로 미뤄 그 디스패치가 끝난 뒤 내린다 →
     리스너 순서와 무관하게 바깥은 이번 pop을 안쪽 것으로 본다. **교훈: 겹친 popstate에서
     공유 카운터는 그 디스패치 안에서 내리지 말 것(microtask로 미룰 것).**
  ② 자동 '기타' 태그가 `display_name==="기타"` 리터럴에 묶여, 운영자가 그 태그를 지우자
     아무 태그도 안 붙었다. **불변식("이벤트당 콘텐츠 ≥1")을 버렸다**: 태그 0개 = 색 없는
     흰 카드 허용(서버·클라 강제 부착 제거), '기타'는 인사이트에서만 합성 버킷(태그 0개 공개
     일정, 휴뱅 제외)으로 카운트. **교훈: UI/DB 불변식을 특정 태그 '이름'에 묶지 말 것.**
- **부분 완료**: 축구/월드컵 시뮬 — taxonomy·기초 적립 완료(68 테스트). 물리·인지 제약 정밀화 남음.
  월드컵 자동 테마는 `KOREA_MATCHES` 수동 입력 대기.
- **2026-07-18 — 태그 색 커스텀화 프로젝트 시작**(계획 `docs/tags/custom-tag-color-plan.md` v4.1,
  코덱스 4라운드 적대검수 반영·디스코프). 방향: 무늬 유지(색맹 단서)+가독성만 고침+커스텀 bg_hex+
  단일 resolver. **Phase 0-pre 첫 슬라이스 완료**(`b36b01c`): 공개 sample/type 분리 —
  `sample-public-data.ts` 신설, 공개 트리(public-loader·proposals route)가 privateMeta·requests
  품은 sampleStudioSchedule을 import하던 공개경계 잠복 위반 제거 + `public-boundary.test.ts`(정적
  import 가드 + 폴백 누출검사). 공개 API 출력 불변.
  **Phase 0-pre 비주얼 스위트도 완료**(`76f5186`): dangling이던 `test:visual`을 실제 스위트로 —
  `app/visual-fixture/poster`(VISUAL_TEST_FIXTURE=1 전용 route, 플래그 없으면 not-found·포스터
  미노출) + `playwright.visual.config.ts`(production build, viewport/DPR 고정, 애니 정지) +
  baseline(viewer-surface, `[data-export-surface]`만, OS별=현재 win32). **함정**: 언더스코어 폴더
  (`app/__x`)는 Next private라 라우팅 제외 → route 폴더명에 언더스코어 금지.
  **Phase 0A 진행 중**: 특성화 테스트(`tag-visual-contract.test.ts`, 17개)로 현재 색/잉크 동작을
  못박고(`edbee1d`), 단일 resolver `lib/tags/tag-visual.ts`(`createTagVisualResolver`) 신설
  (`2263540`) — visualOf(rootTagId·kind·colorKey·bg·border·legacyTextColor·patternKey·missing),
  이벤트 분배는 month.ts에 위임(정의상 동일). **시청자 포스터 카드 색을 resolver로 이관**(`217cbce`),
  비주얼 하네스로 구코드 vs 이관 = **픽셀 동일 증명**. **비주얼 하네스 flaky였다**(교훈): render
  타이밍 변화가 전역 diff 유발 — 원인 ①월드컵 공 JS rAF(CSS animations:disabled로 안 멈춤)
  ②`--poster-scale`가 폰트 로드 타이밍에 좌우. → 스펙에 reduce-motion 토글(localStorage
  `vic.reduceMotion=on`)로 rAF 정지 + 폰트 후 resize 재측정 + 표면 높이 안정 대기로 굳힘.
  **다음**: 나머지 표면 이관(studio-shell 카드·insights 4맵·칩·범례). ⚠ Phase 1 전 필수:
  pattern_key CSS 재작업(`data-pattern` + {shape,ink,alpha}), 무늬 CVD 자동배정.
- **미착수**: 시청자 출석 도장(체크인) — 계획서만 있음(`docs/insights/viewer-checkin-attendance-plan.md`).

## Active Work

**태그 색 커스텀화 — 기능 전체 구현 완료**(Phase 0~3, `85d6faf`까지). 커스텀 색이 전 표면 일관
반영(카드·2색·점·칩·범례·상세·인사이트) + 편집기 색 칸(단색 입력 + 톤 프리셋 파스텔/부드럽게/선명/
깊게 + 대비 배지 AA + 기본 되돌리기) + 서버 검증(#RRGGBB·대분류만·재부모 NULL). 무늬 전면 제거.
DB `bg_hex` 컬럼(0052) 적용됨. **색 편집 UI 재설계 완료**(`fe403a5`): 네이티브 color input(쓰기
어렵고 디자인 따로 놀고 행이 늘어 좌우스크롤)을 버리고 **팝오버 색 피커**로 — 행은 스와치 하나,
팝오버에 SV영역(좌표)+색조 슬라이더+톤 프리셋(4칸)+프리셋12색+미리보기/hex. 앱 토큰으로 통일.
**포털(body)+fixed**라 편집기 overflow에 안 잘림(스와치 rect 기준 배치, 화면밖이면 위로 flip).
마운트 onChange 억제(열기만 해도 색 박히던 버그 방지). AA배지 제거(잡음), 흐릴 때만 경고.
`color-picker-popover.tsx` + `color-tone.ts`(HSV/톤/대비). **남음 = 실사용 후 자잘한 디자인 피드백.**
아래는 세부 이력.

--- (세부 이력) ---
태그 색 커스텀화 — 0A(resolver 이관)·0B(가독성) 완료, **무늬 전면 제거 완료**(`cd53f06`,
baseline 교정 `5d2039e`). 토리님 결정으로 무늬 알파↓론 체감 없어 아예 제거 — 카드/칩 단색.
globals.css `[data-color=*]` 무늬 + `.evt-pat` 삭제, eventInkStyle isPatternColor 분기 제거(2-arg),
2색 `.evt-pat` 오버레이 제거. geometry Δ0. **Phase 1 대폭 단순화**: 무늬 없으니 pattern_key CSS
재작업·CVD 자동배정 blocker **소멸**(bg_hex 컬럼만). **함정 기록**: CSS 변경 후 비주얼 baseline이
안 바뀌면 **`.next/cache` 제거**하고 재빌드(next build가 옛 CSS를 캐시함 — 무늬 제거 때 실제로 당함).
**Phase 1 첫 슬라이스 완료**(`198c3d1`): `broadcast_tags.bg_hex` 컬럼(0052, **prod 적용됨**) +
resolver `buildEffectivePalette`(대분류 bg_hex가 colorKey 엔트리 덮어씀 → 카드·칩·범례 전부 bg_hex
반영, 없으면 palette 폴백=렌더 불변) + 로더 select/매핑 + BroadcastTag.bgHex. 커스텀 색이 end-to-end
흐름(태그에 bg_hex 넣으면 즉시 표시). **배포 순서 지킴**: 마이그레이션 먼저 적용 후 push.
**Phase 2 완료**(`922674d`): saveTagsAction이 bgHex 검증(#RRGGBB)·저장(대분류만, 세부/재부모 NULL
강제) + 편집기 대분류 행에 `<input type=color>` + '팔레트로' 되돌리기 + Draft.bgHex 배선 + 낙관 반영.
**커스텀 색 end-to-end 사용 가능** — 관리자가 색 골라 저장하면 카드·칩·범례 반영. **토리님 원래 목표
(원하는 색 지정) 달성.** **남음(폴리시)**: Phase 3 = HSLuv 색환 피커(현재는 네이티브 color input) +
톤 프리셋. 지금도 기능은 완전 동작 — 피커는 UX 고급화일 뿐. (ADR-0006 keepalive 라우팅은 태그 저장
전반의 기존 tech-debt로 별건.)
아래는 이전 0A/0B 상세.
- (이전) **0B 1차(가독성)**(`164fb71`, 지금은 무늬 제거로 대체됨).
0B: 무늬 알파↓(indigo 34→18·mint 10→6·sky 11→7·gen 6~7%) + eventInkStyle 전 카드 헤일로
(text-shadow=paint-only라 굵기·레이아웃 불변, 스티커 안전). 무늬는 유지(색맹=hue별 '모양'이 담당).
**geometry.spec 하드 게이트 신설**(offset 기반=결정적: 표면 자연 폭/높이·칸 높이·스티커 비율좌표) +
비주얼 fixture에 무늬 카드(대회=indigo) 추가(샘플에 무늬-fill 카드가 없어 커버 못 하던 구멍). 지오 Δ0
실측. **비주얼 하네스 교훈 추가**: getBoundingClientRect는 transform:scale subpixel로 run간 흔들림 →
지오는 offsetWidth/Height + 인라인 스타일로 측정할 것. **다음**: 0B 더(scrim 강화/AA 미달 태그) 또는
Phase 1(bg_hex). ⚠ 미이관(의도): 상세 칩 raw colorKey, insights 4맵(bg_hex는 Phase 1). ⚠ Phase 1
전 필수: pattern_key CSS 재작업(`data-pattern`+{shape,ink,alpha}), 무늬 CVD 자동배정.

## 배포가 안 될 때 (2026-07-17 실제로 겪음 — 다음 에이전트가 같은 길로 헤매지 말 것)

**증상**: `git push`는 성공하는데 Vercel Deployments에 **새 항목이 아예 안 생긴다**(실패도 아니고 무반응).
프로덕션은 옛 빌드를 계속 서빙한다.

**원인은 대개 우리 코드/설정이 아니다.** 2026-07-17엔 **GitHub 장애**였다 — Vercel 대시보드가
"GitHub Outage — affecting automatic deployments and account connection" 배너를 직접 띄웠다.
곁가지 증상: 대시보드의 GitHub 관련 칸이 회색 스켈레톤으로 멈춤(=계정 연결 API 실패), 배포가
붙어도 8분+ 지연.

**진단 순서**(위에서부터, 각 단계가 서로 다른 원인을 배제한다)
1. `git ls-remote origin refs/heads/main` — 원격에 커밋이 실제로 갔는지. (갔으면 우리 잘못 아님)
2. **배포된 사이트를 직접 읽어** 어느 커밋까지 반영됐는지 확인(추측 금지). 예:
   `https://vic-schedule-studio.vercel.app/` HTML에서 `/_next/static/css/*` 를 받아 특정 클래스
   존재 여부로 판독. (2026-07-17엔 삭제한 `.home-grid`가 남아 있는지로 판정했다.)
3. Vercel → Deployments: **새 항목이 없다** = 이벤트 미수신(장애·연결). `Error` = 빌드 실패(로그 보기).
   `Canceled` = Ignored Build Step. `Queued/Building` = 그냥 밀린 것(기다린다).
4. Vercel 대시보드 상단 **배너**(장애 공지) · `status.vercel.com` · `githubstatus.com`.
5. GitHub 쪽: 저장소 Settings → **Webhooks는 비어 있는 게 정상**이다(Vercel은 GitHub App을 쓴다.
   여기서 헤맸다). 볼 곳은 Settings → **GitHub Apps** → Vercel → Repository access.

**장애/연결 문제일 때 우회 배포(=GitHub를 안 거치고 로컬 코드를 Vercel이 빌드)**
```bash
npx vercel link --yes --project vic-schedule-studio --scope bluesky-s-project3   # 최초 1회(.vercel 생성)
npx vercel --prod --yes                                                          # 즉시 프로덕션 배포
npx vercel ls vic-schedule-studio --scope bluesky-s-project3                     # 배포 목록 확인
```
- CLI는 이미 `bluesky8bya`로 로그인돼 있다. `.vercel/`은 `.gitignore`에 있다.
- **주의**: `vercel link`가 `.env.local`을 프로젝트 환경변수로 **덮어쓴다**(그리고 .gitignore에 추가).
  로컬에만 있던 값이 있었다면 확인할 것.
- Git 연결이 실제로 풀렸다면 `npx vercel git connect` (대화형 확인 필요 — 에이전트는 못 누른다.
  사용자에게 터미널에서 직접 실행 요청할 것. 성공 시 `> Connected` 출력).

**교훈**: "push했으니 배포됐겠지"로 보고하지 말 것. **배포된 사이트를 읽어서** 확인하고 말하라.

## Known Issues

- **ISSUE-001 — 편집실 실물 검증이 막혀 있음.** 편집실(`/studio/*`)은 Google 로그인이 필요해
  로컬 Playwright로 실물 확인을 못 한다. 최근 편집실 변경(공개범위 접기, 단축키, Alt+N, 드래그
  삽입선)은 타입·빌드·코드 리뷰까지만 검증됐다. Status: Open.
  → 다음에 편집실을 만질 땐 사용자에게 실물 확인을 요청하거나, 테스트용 로그인 경로를 마련할 것.
- **ISSUE-002 — 모바일에는 '이 달 기록' 진입점이 없다.** 버튼(`.insights-open`)이
  `.public-calendar-header`에만 있는데 모바일(≤640px)은 아젠다 레이아웃이라 이 헤더를 안 그린다
  → 모바일 시청자는 공개 인사이트를 열 수 없다. Status: Open(미요청, 별도 판단 필요).
- **ISSUE-003 — 미리보기 낙관 경로가 teaser를 안 가린다.** `studio-shell.tsx`의 viewerMode
  미리보기는 낙관적 `events`에서 공개 일정을 추리는데(spread + privateMeta 제거), 공개 시각 전
  teaser의 실제 `publicTitle`이 서버 redaction 없이 그대로 미리보기에 노출될 수 있다(방송 화면
  공유 시 유출면). 판서(B안)는 ADR-0010으로 이 경로를 우회했지만 미리보기 자체는 남아 있다.
  Status: Open (2026-07-25 판서 작업 중 발견 — 수정 시 spread 제거 + 공유 redaction 적용 방향).

## Locked / Stable Areas — 명시적 이유 없이 건드리지 말 것

| 영역 | 왜 잠겨 있나 | 근거 |
|---|---|---|
| `lib/schedules/public-loader.ts` + `app/api/public/*` | 공개 경계. 비공개 필드가 새면 제품의 핵심 약속이 깨진다 | [ADR-0001](decisions/ADR-0001-public-private-server-boundary.md) |
| 공개 인사이트에 들어가는 값 | 방문/체류(운영 지표)는 공개 금지. 방송·하트는 **집계만** | [ADR-0008](decisions/ADR-0008-public-insights-aggregate-rpc.md) |
| 포스터 표면 지오메트리(폭 1840 고정, JS 스케일) | 뷰포트 미디어쿼리로 표면 내부를 재배치하면 스티커 좌표가 어긋난다 | [ADR-0004](decisions/ADR-0004-poster-surface-geometry.md) |
| 시즌 연출(미니게임·테마) | 기본 꺼짐·클릭 통과·오너 테마 우선 | [ADR-0009](decisions/ADR-0009-seasonal-toys-are-opt-in.md) |
| `PRIVATE_DATA_ENC_KEY` / 암호화 배포 순서 | 키 분실 = 비공개 본문 복구 불가 | [ADR-0002](decisions/ADR-0002-private-content-encryption.md) |
| 오너 바인딩(`OWNER_EMAIL` + `calendars.owner_id`) | 한쪽만 바꾸면 RLS로 저장이 조용히 실패 | [ADR-0003](decisions/ADR-0003-owner-dual-binding.md) |
| 스튜디오 월 라우트 | 북마크/콜드 진입 전용. 런타임 라우트 월 이동 금지 | [ADR-0005](decisions/ADR-0005-month-routes-cold-entry-only.md) |

## Open Decisions

- 하트 인기 배지를 절대 임계값 → **상대 순위**로 전환하기로 합의만 됨(미구현).
- 공개 인사이트에 방문자 지표를 넣을지(현재는 의도적으로 제외 — ADR-0008).
- 꾸미기 심화 중 보류: 칸별 데코 / 스티커 그룹 / 스티커 팩.

## Next Exact Steps

0. **마이그레이션 0051 적용** — `node scripts/apply-db.mjs db/migrations/0051_visit_known_accounts.sql`
   (새/재방문 판정용 DISTINCT RPC + `(day, account_hash)` 인덱스. 미적용이어도 코드가 옛 경로로
   폴백하므로 급하진 않지만, 적용해야 인사이트 열 때의 순차 왕복 40회+가 사라진다.)
1. **개선안 백로그 배치 1~10 전부 완료**(`docs/plans/refinement-backlog-2026-07.md`).
   보류 항목과 "이 감사에서 배운 것"은 그 문서 머리에 정리돼 있다.

1. 시청자 출석 도장: `docs/insights/viewer-checkin-attendance-plan.md`의 A안(오늘만, 서버 KST 강제).
   `event_hearts` 패턴 복제(비로그인 기기 토큰 포함), 마이그레이션 + `*_grants.sql` 잊지 말 것.
2. 멀티에이전트 리뷰가 제안한 Phase 3 잔여(사용자 승인 시): 시청자 저장/공유 버튼 + OG 메타 +
   월별 고정 PNG URL, LIVE/카운트다운 pill, 꾸미기 스탬프 모드, 휴방 상태를 1급 셀 상태로.
3. 축구 시뮬: GK 손→패스/개인기 규칙·물리·인지 제약 정밀화(`docs/sim/`).

## Last Verified (2026-07-17, 배치 1~10 이후 · 프로덕션 실측)

| 확인 | 결과 |
|---|---|
| 프로덕션이 최신인가(사이트 직접 판독) | **예** — 삭제한 `.home-grid`가 배포 CSS에서 사라짐 = `503d628`까지 반영 |
| `/api/public/vic/events` | **200** (한글 Server-Timing 헤더로 매 요청 500이던 것 수정됨) |
| 배포 경로 | GitHub 장애로 자동배포가 멈춰 **`npx vercel --prod`로 직접 배포**함(위 "배포가 안 될 때" 참고) |
| GitHub 자동배포 | 장애 회복 중(8분+ 지연 관측). 복구되면 push→배포가 저절로 정상화된다 |

## Last Verified (2026-07-17, 배치 1~3 이후)

| command | result |
|---|---|
| `npm run typecheck` / `npm run build` | PASS (exit 0) |
| `npm run test` (vitest) | PASS — **140** tests (server-timing 4 신규) |
| `npm run test:e2e` | **여전히 NOT RUN** — 이것 때문에 공개 API 500을 오래 못 봤다. 다음에 꼭 돌릴 것 |
| 공개 API 실물 | `/api/public/vic/events` 200(240건) · `/api/soop-live` 200 · `/api/presence` start 200 |
| 하트 실물(Playwright, vibrate 후킹) | 정상 [12,12] 두 톡(37~43ms 간격) · 실패 [12,20-60-20] + 토스트 후 2.6초 자동 해제 |
| 번들(로컬 prod 빌드) | `/` 152 kB · 꾸미기 151 kB · 편집실 221 kB. 초기 스크립트 16개에 월드컵·축구 코드 없음 |
| 7월(월드컵 달) 연출 실물 | 미니게임 버튼·중력 공·결승 표기 497ms에 정상 등장 |

## Last Verified (2026-07-17, 이전)

| command | result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | 0 errors (기존 경고 4 — `--max-warnings=0`이라 exit 1) |
| `npm run build` | PASS (exit 0) |
| `npm run test` (vitest) | PASS — 136 tests |
| 공개 '이 달 기록' 실물(Playwright, prod build, 비로그인) | PASS — 하이라이트 카드 스타일 적용, `pi-body` 가로 넘침 0(560=560), 긴 제목 …+툴팁(그리드 폭 안), 일별 툴팁 안 잘림 |
| 편집실 인사이트 '트렌드' 탭 실물 | **NOT VERIFIED** (로그인 필요 — ISSUE-001; 같은 컴포넌트를 공개 시트에서 검증) |
| 꾸미기 팔레트(DecoratePalette) 실물 | PASS — 로그인 벽 우회용 임시 라우트에 실제 컴포넌트를 올려 Playwright로: 수정 전 "칩 클릭→아무 일 없음"·"× 안 됨" 재현, 수정 후 클릭/터치탭 추가·× 삭제·드래그 순서·탭 분류이동 전부 OK, 중복 추가 없음. 임시 라우트는 삭제함 |

## Last Verified (2026-07-12)

| command | result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | 0 errors (기존 경고 4) |
| `npm run build` | PASS (exit 0) |
| `npm run test` (vitest) | PASS — 136 tests |
| `npm run test:e2e` / `test:visual` | NOT RUN |
| 마이그레이션 0048·0049·0050 | 적용 완료(Supabase) |
| 공개 포스터 실물(Playwright, prod build) | PASS — 미니게임 opt-in, 태블릿 아젠다, 인사이트 시트 |
| 편집실 실물 | **NOT VERIFIED** (로그인 필요 — ISSUE-001) |

---

## 이 저장소의 하네스 범위

`project-initializing_260710.md`의 **최소 도입안**만 채택했다.
채택: 이 파일 · ADR(`docs/decisions/`) · 매니페스트(`agent-harness.yaml`) · provenance ·
**자동화 훅**(`.claude/settings.json`: SessionStart 브리핑 + Stop 시 상태 갱신 확인).
미채택: `docs/agent/` 별도 트리, 상시 ExecPlan/Handoff, `CHANGELOG_AGENT.md`, 코드 내 `[WH-CHANGE]`
주석 규격 — 각각 기존 `docs/` 트리, `docs/plans/`, 한국어 git log, 이미 짙은 "왜" 주석과 중복이다.
