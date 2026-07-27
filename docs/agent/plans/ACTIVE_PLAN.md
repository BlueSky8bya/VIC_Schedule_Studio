# Active ExecPlan

Status: **None** — 현재 진행 중인 L2/L3 작업 없음.

> 직전 완료:
> [2026-07-27_broadcast-toolbar-layer-rebuild.md](completed/2026-07-27_broadcast-toolbar-layer-rebuild.md)
> (일정 그림판 레이어 직접 드래그, 6개 cap 제거, Clip Studio식 toolbar 역할 재구성.
> 실제 desktop mouse·iPad/Wacom 스모크는 `docs/ux/broadcast-tools-qa-checklist.md`로 추적 중.)

> L2(구조적: 새 기능·새 라우트·데이터 흐름 변경·의존성 추가)나 L3(치명적: 권한·개인정보·파괴적
> 마이그레이션·공개 경계) 작업을 시작하면, 구현 전에 이 파일을 아래 틀로 채운다.
> 끝나면 `plans/completed/YYYY-MM-DD_<제목>.md`로 옮긴다. 사소한 작업(L0/L1)엔 쓰지 않는다.

---

## 틀

```md
Plan ID: PLAN-YYYYMMDD-001
Status: Draft | Ready | In Progress | Blocked | Completed
Task Risk: L2 | L3
Created / Updated: ...

## Objective
달성하려는 결과(한 문단).

## Verifiable End State
무엇이 참이면 끝인가(관찰 가능한 문장으로).

## Scope / Out of Scope
포함 / 명시적 제외.

## Relevant Context
파일 · ADR · Domain Rule · 알려진 이슈.

## Assumptions
| 가정 | 영향 | 근거 | 상태(Confirmed/Open) |

## Ambiguity Register
| ID | 질문 | 중요도 | 해소 |

## Milestones
### M1 — 제목
Goal / Files / Changes / Validation(실행할 명령) / Rollback / Status

## Final Acceptance Criteria
- [ ] ...

## Validation Commands
```bash
npm run typecheck && npm run lint && npm run build && npm run test
```

## Rollback Strategy
...

## Progress Log
### YYYY-MM-DD HH:MM
- 체크포인트 / 검증한 것 / 남은 것 / 막힌 것
```
