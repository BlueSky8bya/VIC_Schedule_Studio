# Current State — VIC Schedule Studio

Last Updated: 2026-09-09 (KST)
Project Version: 0.1.0

Current work only. Completed results live in topic records. Historical snapshots are evidence, not startup instructions.

## Current Objective

Execute the approved work order in order A → D → B → C: rule preservation, five checked local commits, all entity entry points, then review/source workflow completion. [Work plan](plans/PLAN-20260909-014-rule-preservation-and-art-completion.md). No push or new art generation.

## Active Work

| ID | Status | Next | Record |
|---|---|---|---|
| RULE-ART-COMPLETION | In Progress | Complete the 589-line rule/measurement mapping and ADR audit before the commit split | [Work order](handoffs/20260909-work-order.md) |
| ART-PINE-PILOT | Prepared | Generate variants 2 and 3 across base/autumn/winter using the frozen inputs, then inspect the six-file pack | Pine request (`../../art-src/tree/tree-pine/runs/20260909-pilot-01/request.md`; destination lands with the following art commits) |
| AMB-QA-18 | Planned | Reproduce prioritized candidates on one fixed build before selecting fixes | [Ambient QA](../ambient/QA_PROGRESS.md) |
| OPS-ANALYTICS-CLEANUP | Blocked | Verify current data/backup and establish authorization before production deletion | [Open checks](verification/OPEN_CHECKS.md) |
| VERIFY-PUBLIC-002-003 | Planned | Reconcile historical mobile insights and teaser preview issue labels with current evidence | [Open checks](verification/OPEN_CHECKS.md) |
| VERIFY-REAL-SESSION | Planned | Track genuine-login/RLS/device evidence separately from fixtures and service-role tests | [Open checks](verification/OPEN_CHECKS.md) |

## Blockers

- Owner choices pending for review-sheet presentation, the meaning of 생성본 and follow-up B/C commits. The ≤12 size ratio applies within one entity's variants, per the owner's answer. Continue independent work; do not choose dependent behavior silently.

- No new pine images have been generated. The request is prepared, raw/normalized contain no delivery, and review is pending. Numeric checks do not replace owner visual approval.
- Production cleanup has no current execution or approval evidence. Old backup paths and row counts are historical; recheck before acting.
- ISSUE-002/003 have conflicting old labels and resolution claims. These are verification tasks, not confirmed current leaks. Fixture/service-role tests do not establish genuine-login/RLS/device coverage.

## Next Exact Steps

1. RULE-ART-COMPLETION: finish A and its checks, then D, B and the approved C choices. Full pre-change backup is recorded in the plan.
2. ART-PINE-PILOT: generation is outside this work order. Keep the prepared request and input images intact.
3. AMB-QA-18: choose the next reproduction from the current QA state. Do not replay commands from completed rounds.
4. VERIFY-PUBLIC-002-003 and VERIFY-REAL-SESSION: close only with current scoped evidence.
5. OPS-ANALYTICS-CLEANUP: keep the production operation separate; current authorization and recoverable backup must precede deletion.

## Last Verified

A: source-to-rule coverage and memory contract checks passed before this split. This candidate commits rule preservation and memory only. Art implementation, migrated entry points and integrated verification follow in D2–D5. Historical product/browser/DB checks do not validate this candidate.
