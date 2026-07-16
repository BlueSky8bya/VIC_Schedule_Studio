# Current State — VIC Schedule Studio

> **에이전트에게**: 이 파일이 "지금 이 프로젝트의 현재 시제"다. 과거 일기장이 아니다.
> 작업 시작 전에 여기부터 읽고, 의미 있는 작업(기능·구조·마이그레이션)이 끝나면 **여기를 갱신**한다.
> 완료된 역사는 여기 쌓지 말고 git log와 `docs/decisions/`(ADR)로 보낸다.
> 세션 시작 시 이 파일은 SessionStart 훅이 자동으로 읽어 넣는다(`.claude/settings.json`).

Last Updated: 2026-07-17
Project Version: 0.1.0
Harness: `agent-harness.yaml` (protocol `project-initializing_260710.md`, 최소 도입안)

---

## Current Objective

시청자 포스터의 **몰입·재미·편의 개선**(스냅샷 + 멀티에이전트 평가/리서치 기반)이 방금 끝났고,
지금은 **편집실 UX 다듬기**와 **시청자 참여 기능**으로 넘어가는 중.

## Current Status

- **운영 중(안정)**: 공개 포스터(`/`), 편집실(달력/태그/멤버/비공개 레이어), 꾸미기·PNG export,
  하트(비로그인 포함), 관리자 인사이트, 태그 2계층, 비공개 본문 암호화, 방송시간 기록.
- **2026-07-12에 끝난 것**(커밋 `9324779`…`c509657`):
  - 미니게임 opt-in화 + 시즌 테마 강제 해제 + 태블릿(641~1040px) 아젠다 전환 → [ADR-0009](decisions/ADR-0009-seasonal-toys-are-opt-in.md)
  - 포스터 마스트헤드/시각 위계/대비(WCAG AA) · 모션 토큰(`--ease-enter/exit`, `--dur-4/5`) ·
    빈 날 접기 · 셀 호버 · 하트 승급 토스트
  - **시청자 '이 달 기록'(공개 인사이트)** — 관리자와 같은 차트 재사용, 집계 RPC로만 개방 →
    [ADR-0008](decisions/ADR-0008-public-insights-aggregate-rpc.md) (마이그레이션 0049·0050 적용 완료)
  - 편집기: 공개 범위·옵션 접기(기본 접힘), 단축키 안내 축약, **새 일정 = Alt+N 하나로 통일**,
    카드 순서 드래그 삽입선 판정(카드 중심선 기준)
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
  → 남은 리스크: 하트가 등급 문턱을 넘으면 배지가 생겨 **실시간으로** 칸 높이가 바뀐다(그 순간
  스티커가 살짝 밀림). 근본 해결은 배지를 레이아웃 밖으로(absolute) 빼는 것 — 미결정.
- **부분 완료**: 축구/월드컵 시뮬 — taxonomy·기초 적립 완료(68 테스트). 물리·인지 제약 정밀화 남음.
  월드컵 자동 테마는 `KOREA_MATCHES` 수동 입력 대기.
- **미착수**: 시청자 출석 도장(체크인) — 계획서만 있음(`docs/insights/viewer-checkin-attendance-plan.md`).

## Active Work

없음(직전 작업 종료 상태).

## Known Issues

- **ISSUE-001 — 편집실 실물 검증이 막혀 있음.** 편집실(`/studio/*`)은 Google 로그인이 필요해
  로컬 Playwright로 실물 확인을 못 한다. 최근 편집실 변경(공개범위 접기, 단축키, Alt+N, 드래그
  삽입선)은 타입·빌드·코드 리뷰까지만 검증됐다. Status: Open.
  → 다음에 편집실을 만질 땐 사용자에게 실물 확인을 요청하거나, 테스트용 로그인 경로를 마련할 것.
- **ISSUE-002 — 모바일에는 '이 달 기록' 진입점이 없다.** 버튼(`.insights-open`)이
  `.public-calendar-header`에만 있는데 모바일(≤640px)은 아젠다 레이아웃이라 이 헤더를 안 그린다
  → 모바일 시청자는 공개 인사이트를 열 수 없다. Status: Open(미요청, 별도 판단 필요).

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

1. 시청자 출석 도장: `docs/insights/viewer-checkin-attendance-plan.md`의 A안(오늘만, 서버 KST 강제).
   `event_hearts` 패턴 복제(비로그인 기기 토큰 포함), 마이그레이션 + `*_grants.sql` 잊지 말 것.
2. 멀티에이전트 리뷰가 제안한 Phase 3 잔여(사용자 승인 시): 시청자 저장/공유 버튼 + OG 메타 +
   월별 고정 PNG URL, LIVE/카운트다운 pill, 꾸미기 스탬프 모드, 휴방 상태를 1급 셀 상태로.
3. 축구 시뮬: GK 손→패스/개인기 규칙·물리·인지 제약 정밀화(`docs/sim/`).

## Last Verified (2026-07-17)

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
