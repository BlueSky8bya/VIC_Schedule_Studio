# Current State — VIC Schedule Studio

> **에이전트에게**: 이 파일이 "지금 이 프로젝트의 현재 시제"다. 과거 일기장이 아니다.
> 작업 시작 전에 여기부터 읽고, 의미 있는 작업(기능·구조·마이그레이션)이 끝나면 **여기를 갱신**한다.
> 완료된 역사는 여기 쌓지 말고 git log와 `docs/decisions/`(ADR)로 보낸다.

Last Updated: 2026-07-12
Project Version: 0.1.0
Harness: `agent-harness.yaml` (protocol `project-initializing_260710.md`, 최소 도입안)

---

## Current Objective

운영 중인 제품의 **UX 다듬기 + 꾸미기(decorate) 기능 심화**가 현재 축.
큰 미완 축 두 개: ① 시청자 출석 체크인(미착수) ② 축구 시뮬 Phase 2/3.

## Current Status

- **운영 중(안정)**: 공개 포스터(`/`), 편집실(달력/태그/멤버/비공개 레이어), 꾸미기·PNG export,
  하트(비로그인 포함), 인사이트(방문·체류·방송시간), 태그 2계층, 비공개 본문 암호화.
- **부분 완료**: 축구/월드컵 시뮬 — taxonomy·기초 적립 완료(68 테스트). 물리·인지 제약 정밀화 남음.
  월드컵 자동 테마는 `KOREA_MATCHES` 수동 입력 대기.
- **미착수**: 시청자 출석 도장(체크인) — 계획서만 있음(`docs/insights/viewer-checkin-attendance-plan.md`).

## Active Work

없음(직전 작업 종료 상태). 직전 세션에서 끝낸 것:

- 꾸미기 "내 이모지" 보관함: 분류 탭(아바타/정적/동적) + 드래그 정렬 (migration `0048`, 적용 완료)
- 달력 정렬/스택 버그 3건: 월드컵 칩이 있는 칸의 날짜 줄 높이, 오늘·선택 칸 테두리가 카드에 가림,
  업 도움 띠(`.support-bar`) CSS가 시청자 포스터에는 아예 없던 문제

## Known Issues

현재 열린 이슈 없음. (새로 발견하면 `ISSUE-00N` 형식으로 아래에 추가하고, 해결되면 지운다.)

## Locked / Stable Areas — 명시적 이유 없이 건드리지 말 것

| 영역 | 왜 잠겨 있나 | 근거 |
|---|---|---|
| `lib/schedules/public-loader.ts` + `app/api/public/*` | 공개 경계. 여기로 비공개 필드가 새면 제품의 핵심 약속이 깨진다 | [ADR-0001](decisions/ADR-0001-public-private-server-boundary.md) |
| 포스터 표면 지오메트리(폭 1840 고정, JS 스케일) | 꾸미기==시청자 기하가 어긋나면 스티커 좌표가 전부 밀린다 | [ADR-0004](decisions/ADR-0004-poster-surface-geometry.md) |
| `PRIVATE_DATA_ENC_KEY` / 암호화 배포 순서 | 키 분실 = 비공개 본문 복구 불가 | [ADR-0002](decisions/ADR-0002-private-content-encryption.md) |
| 오너 바인딩(`OWNER_EMAIL` + `calendars.owner_id`) | 한쪽만 바꾸면 RLS로 저장이 조용히 실패 | [ADR-0003](decisions/ADR-0003-owner-dual-binding.md) |
| 스튜디오 월 라우트 | 북마크/콜드 진입 전용. 런타임 라우트 월 이동을 다시 넣지 말 것 | [ADR-0005](decisions/ADR-0005-month-routes-cold-entry-only.md) |

## Open Decisions

- 하트 인기 배지를 절대 임계값 → **상대 순위**로 전환하기로 합의만 됨(미구현).
- 꾸미기 심화 중 보류: 칸별 데코 / 스티커 그룹 / 스티커 팩.

## Next Exact Steps

1. 시청자 출석 도장: `docs/insights/viewer-checkin-attendance-plan.md`의 A안(오늘만, 서버 KST 강제)으로 구현.
   `event_hearts` 패턴을 그대로 복제(비로그인 기기 토큰 포함), 마이그레이션 + `*_grants.sql` 잊지 말 것.
2. 축구 시뮬: GK 손→패스/개인기 규칙·물리·인지 제약 정밀화(`docs/sim/`).
3. 월드컵 자동 테마: `KOREA_MATCHES` 실제 일정 입력.

## Last Verified (2026-07-12)

| command | result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run build` | PASS (exit 0) |
| `npm run test` (vitest) | PASS — 136 tests |
| `npm run test:e2e` / `test:visual` | NOT RUN |
| `node scripts/apply-db.mjs db/migrations/0048_*.sql` | PASS (Supabase 적용 완료) |

---

## 이 저장소의 하네스 범위(왜 문서를 더 안 만들었나)

이 프로젝트는 `project-initializing_260710.md`의 **최소 도입안**만 채택했다.
채택: 현재 상태 문서(이 파일) · ADR(`docs/decisions/`) · 매니페스트(`agent-harness.yaml`) · provenance.
미채택: `docs/agent/` 별도 트리, 상시 ExecPlan/Handoff 디렉터리, `CHANGELOG_AGENT.md`,
코드 내 `[WH-CHANGE]` 주석 규격 — 각각 기존 `docs/` 라우팅 트리, `docs/plans/`, 한국어 git log,
이미 짙은 "왜"를 적는 주석 문화와 **중복**이라 드리프트만 늘린다.
