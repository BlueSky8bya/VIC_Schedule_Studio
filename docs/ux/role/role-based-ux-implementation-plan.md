# 역할 기반 UI/UX 개선 계획

원본: `docs/role-based-ui-ux-audit-report.en.md`
검증일: 2026-05-28 (현재 코드 실측 포함)

## 정직한 총평

보고서는 잘 조사됐지만 **멀티테넌트 SaaS 스케일**(Slack/GitHub/Notion/Discord)로 보정돼 있다.
VIC의 실제 규모: **owner 1명(빅토리), developer 1명(엔지니어), manager/worker 소수, viewer 수십.**
그래서 "역할별 전면 레이아웃 재설계 + functional-zone 헤더 + preview-as-role"는 이 규모에선
과설계이고, `studio-shell`(드래그·줌·슬라이드 애니 얽힘)을 크게 건드리는 **회귀 위험**이 크다.

다만 보고서가 짚은 것 중 **실제 코드에서 확인된 진짜 문제**가 있다(아래 실측).

### 현재 코드 실측 (보고서의 "현재" 주장 검증)

- **manager/worker 권한 완전 동일** — `lib/permissions/roles.ts`엔 둘을 가르는 분기가 전혀 없다.
  보고서의 "manager=방송운영 / worker=제작" 분리는 **현재 없는 신규 기능**이다.
- **manager·worker 둘 다 이미 support 기간/링크를 편집할 수 있다** —
  `updateSupportSettingsAction`([event-actions.ts:309](lib/schedules/event-actions.ts#L309))이
  `canDecorate`로 게이팅(owner·dev·manager·worker). 클라도 `openSupportSheet`를
  `canDecorateCalendar`로 연다([studio-shell.tsx:2257](components/studio/studio-shell.tsx#L2257)).
  → **이건 CLAUDE.md 규칙 4("매니저/작업자는 schedule data read-only, 예외는 스티커 꾸미기")와
  충돌한다.** support 이벤트의 기간/링크는 schedule data이고, 스티커 예외에 해당하지 않는다.
  **정책 결정 필요.**
- **비-owner가 이벤트를 누르면 owner 편집 폼이 `disabled`로 그대로 보인다**
  ([studio-shell.tsx:2440](components/studio/studio-shell.tsx#L2440) 등 `disabled={!canEdit}`).
  "맞게 눌렀는데 아무것도 못 하는" 혼란 — 보고서 P1과 일치하는 **진짜 UX 문제**.
- **trusted-members 불일치** — 액션/모달은 owner|dev 허용
  ([trusted-members actions](lib/trusted-members/actions.ts) `canEditSchedule`), 그러나
  standalone 페이지 폼은 owner-only로 비활성
  ([trusted-members/page.tsx](app/(studio)/studio/trusted-members/page.tsx) `actor.role !== "owner"`).
  → developer가 모달로는 멤버를 관리할 수 있는데 페이지 폼에선 막힌다.
- **역할 배지 존재**(이름만, 책임 설명 없음) — `ROLE_LABEL`
  ([studio-shell.tsx:154](components/studio/studio-shell.tsx#L154)).
- **developer 패널은 presence 카운트만**, preview-as-role 없음
  ([developer-panel.tsx](components/developer/developer-panel.tsx)).
- **viewer 미리보기**는 클라 토글(`viewerMode`)로 잘 동작.

## P0 — 가드레일 (불변, 무엇을 하든 깨지면 안 됨)

- 공개/시청자 표면에 비공개 필드 노출 금지.
- manager/worker를 일정(events/tags/members/passcode) 편집 가능하게 만들지 말 것.
- developer가 owner_private("나만")를 읽거나 만들 수 없게 유지.
- CSS로 숨기지 말고 서버/응답에서 제거.

## Tier A — 실제 문제, 고가치·저위험 (추천)

### A1. 비-owner 읽기전용 이벤트 상세뷰
disabled 투성이 owner 폼 대신, manager/worker(및 비편집 상황)에 **깔끔한 읽기전용 상세**
(제목·날짜·가시성 라벨·링크)를 보여준다. owner_private는 절대 노출 금지, embargo/work는
"비공개/작업" 같은 평이한 라벨로. **기존 모바일 agenda의 `!canEdit` 읽기전용 경로를 재사용**해
신규 코드 최소화. (위험: 에디터 렌더 분기 — 중간)

### A2. trusted-members 일관성
정책(CLAUDE.md: developer는 owner_private 빼고 owner급 관리 권한)에 맞춰 standalone 페이지 폼을
`canEditSchedule`(owner|dev)로 통일. developer 동작은 "시스템 유지보수" 라벨로 표시. (위험: 낮음)

### A3. 역할 명료화 (책임 라벨)
배지에 한 줄 책임 + "내가 할 수 있는 것" 작은 팝오버. 특히 manager/worker가 "왜 이건 안 되지"를
빈 버튼으로 추론하지 않게. GitHub/Slack 패턴의 경량 버전. (위험: 낮음)

## Tier B — 가치 있으나 결정/규모 필요

### B1. manager/worker 분리 + support 편집 정책 ⚠ 결정 필요
현재 둘은 동일하고 둘 다 support를 편집한다. 선택지:
- (a) **현행 유지** — 둘 다 support 편집 가능. (CLAUDE.md와 충돌 상태 유지)
- (b) **보고서안** — manager만 support 편집, worker는 제작(에셋 업로드/꾸미기) 중심·support 읽기전용.
  → 신규 권한 헬퍼 + 서버 enforcement + UI 분기 필요.
- (c) **CLAUDE.md 원칙대로** — manager·worker 둘 다 support 편집 불가(스티커 꾸미기만).
  → `updateSupportSettingsAction`을 `canEditSchedule`로 조이고 support 시트 제거.
어느 쪽이든 **CLAUDE.md와 코드를 일치**시키는 게 핵심(지금은 어긋나 있음).

### B2. 역할별 모드 칩 + 1차 CTA 정리 (가벼운 버전)
전면 재설계 대신: 헤더에 모드 칩("소유자 편집실"/"매니저"/"시청자 미리보기")과, 역할별 가장
도드라지는 1차 동작만 정리(owner=일정 추가, manager/worker=꾸미기). 큰 구조 변경 없이 "각 역할이
의도적으로 설계된" 느낌. (위험: 중)

## Tier C — 이 규모엔 과설계 (스킵/보류, 이유 명시)

- **C1. 전면 functional-zone 헤더 재설계(Identity/Schedule/Access/Poster/System)** — 스킵.
  현재도 topbar(정체성·모드) + actionbar(도구)로 어느 정도 그룹돼 있고, studio-shell 복잡도상
  전면 재배치는 회귀 위험 대비 이득이 작다(사용자 owner 1명).
- **C2. developer preview-as-role 4종(viewer/owner/manager/worker)** — 보류.
  엔지니어 1인용 화면 점검 도구. 이미 viewer 미리보기 + 계정전환이 있다. 원하면 별도로.
- **C3. developer maintenance 패널 확장(빌드 메타/역할 분포)** — 낮은 우선순위.

## 내가 추가한 더 나은 방법

1. **"모드 칩 + 읽기전용 상세 + 책임 라벨" 3종(A1·A2·A3 + B2)으로 보고서 비전의 ~80% 체감**을
   확보하면서, 전면 재설계의 회귀 위험은 피한다. 단일 스트리머 앱에 맞는 ROI.
2. **support 경계 결정(B1)을 가장 먼저** — 이건 UX가 아니라 정합성/보안 문제다. 코드를 CLAUDE.md에
   맞추거나, 보고서대로 정책을 바꾸고 CLAUDE.md를 갱신해 **단일 진실원**을 회복한다.
3. 읽기전용 상세는 **신규 화면을 만들지 말고** 기존 agenda 읽기전용 경로를 확장 → 표면적 최소.

## 권장 실행 순서

1. **B1 결정** (support/매니저·워커 정책) — 다른 작업의 전제.
2. **A2**(멤버 일관성, 가장 저위험) → **A1**(읽기전용 상세, 최대 체감) → **A3**(책임 라벨).
3. 원하면 **B2**(모드 칩/CTA). C는 보류.

각 단계: TSC/Lint/Build + 공개/비공개 경계 점검 → 커밋 → push → 해시 보고.
