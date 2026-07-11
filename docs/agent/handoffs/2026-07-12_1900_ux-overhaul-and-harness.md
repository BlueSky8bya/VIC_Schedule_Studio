# Handoff Snapshot

Created: 2026-07-12
Agent / Tool: Claude Code (Opus 4.8)
Task: 포스터 UX 전면 개선(멀티에이전트 평가·리서치 기반) + 시청자 공개 인사이트 + 편집실 다듬기
+ Agent Harness 전면 적용
Risk Level: L2 (일부 L3 — 공개 경계 확장)
Project Version: 0.1.0

## Session Goal

① 실물 스냅샷 + 평가 에이전트 3(몰입·재미·편의) + 리서치 에이전트 2(벤치마크·HCI 논문)로 포스터를
진단하고 개선 ② 시청자에게 월별 기록 공개 ③ 편집실 자잘한 회귀 수정 ④ 저장소 기억(하네스) 정착.

## Completed

- **Phase 0(회귀)**: 미니게임 opt-in, 딤 클릭 통과, 시즌 테마 강제 해제, 태블릿(641~1040px) 아젠다 전환
- **Phase 1(몰입)**: 마스트헤드(제목 54px + 연·월 44px 진한 골드), 날짜 숫자 위계, 오늘 강조,
  빈 메모 접기, 대비 AA
- **Phase 2(모션/재미)**: `--ease-enter/exit`·`--dur-4/5`, 아젠다 stagger 2.2s→0.4s,
  `content-visibility` 제거, 빈 날 접기, 셀 호버, 하트 승급 토스트
- **공개 인사이트**: '이 달 기록' 시트(관리자 차트 재사용) + 집계 RPC(0049·0050) + 공개 API
- **편집실**: 공개범위·옵션 접기(기본 접힘), 단축키 안내 축약, 새 일정 = **Alt+N 하나**,
  카드 드래그 삽입선 판정(카드 중심선 기준)
- **하네스 전면 적용**: `docs/agent/` 트리(Constitution·Project Map·Risk Profile·DoD·Changelog·
  Plans·Handoffs·Domain Rules) + ADR 9건 + 자동화 훅(SessionStart 브리핑 / Stop 드리프트) +
  `npm run harness:verify`

## Files Touched (요약)

`components/poster/*`, `components/studio/*`, `components/seasonal/*`, `lib/schedules/public-loader.ts`,
`lib/ui/breakpoints.ts`, `app/page.tsx`, `app/api/public/[calendarSlug]/broadcast/route.ts`,
`db/migrations/0048~0050`, `docs/agent/**`, `.claude/settings.json`, `scripts/agent-harness/**`

## Decisions Made

- [ADR-0008](../decisions/ADR-0008-public-insights-aggregate-rpc.md) 공개 인사이트는 집계 전용 RPC로만
- [ADR-0009](../decisions/ADR-0009-seasonal-toys-are-opt-in.md) 시즌 장난감은 opt-in, 포스터를 덮지 않는다

## Validation Evidence

| 명령 | 결과 |
|---|---|
| `npm run typecheck` / `lint` / `build` / `test` | PASS (테스트 136) |
| 공개 포스터 실물(prod build + Playwright) | PASS — 미니게임 off, 태블릿 아젠다, 인사이트 시트·차트 |
| `/api/public/vic/broadcast` | PASS — 월별/일별 **집계만** 반환 |
| 마이그레이션 0048·0049·0050 | 적용 완료 |
| 편집실 실물 | **NOT VERIFIED** — 로그인 필요(ISSUE-001) |

## Failed Attempts (기록해 둘 가치가 있는 것)

- dev 서버(`next dev`)가 HMR 상태로 **거짓 결과**를 반복해서 냈다(스케일 미적용, 이벤트 리스너 미부착).
  → 이후 검증은 **프로덕션 빌드 + `npm run start`**로만 했다. 다음 에이전트도 그렇게 해라.
- 차트 CSS를 줄 번호 기준으로 잘라 옮기다 주석이 깨져 빌드 실패 → 선택자 기준 추출 스크립트로 다시 했다.

## Open Questions

- 공개 인사이트에 방문자 지표를 넣을지(현재 의도적 제외).
- 하트 인기 배지: 절대 임계값 → 상대 순위 전환(합의만 됨).

## Known Risks

- 편집실 변경분(접기·단축키·드래그 판정)은 실물 검증이 안 됐다 — 사용자 확인 필요.

## Next Exact Step

1. `docs/agent/CURRENT_STATE.md` → Next Exact Steps 참조(출석 도장이 1순위).
2. 편집실 변경분 사용자 확인 후 이상 없으면 ISSUE-001에 그 사실을 적는다.

## Rollback

각 커밋이 독립적이다(`9324779`…`c509657`). 문제가 되는 커밋만 revert 가능.
마이그레이션 0049·0050은 함수 추가뿐 — `drop function`으로 되돌린다(데이터 영향 없음).
