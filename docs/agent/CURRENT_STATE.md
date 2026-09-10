# Current State — VIC Schedule Studio

Last Updated: 2026-09-10 (KST)
Project Version: 0.1.0

Current work only. Completed results live in topic records. Historical snapshots are evidence, not startup instructions.

## Current Objective

Finish the remaining C choices in the approved [work plan](plans/PLAN-20260909-014-rule-preservation-and-art-completion.md). A, five checked D commits, all current B entry points and C2's raw-archive code are complete. Starfish now has one animal workspace. For pine, collect entity-specific web references first, wait for owner curation, then freeze the selected set in a new run before generation. Review-sheet presentation, the existing 40 legacy sources' classification and B/C follow-up commits await the owner. No push or new art generation.

## Active Work

| ID | Status | Next | Record |
|---|---|---|---|
| RULE-ART-COMPLETION | Awaiting Owner | Apply the chosen review presentation and legacy-storage policy; commit B/C only if selected | [Work-order evidence](handoffs/20260909-work-order-results.md) |
| ART-PINE-PILOT | Reference Collection Planned | Web-discover pine pixel-art candidates only; remove photo/render/vector mismatches, store validator-accepted images with provenance and keep other pixel-art candidates as source links, then wait for owner curation | [Pine entry point](../../art-src/나무/소나무/프롬프트.md) |
| AMB-QA-18 | Planned | Reproduce prioritized candidates on one fixed build before selecting fixes | [Ambient QA](../ambient/QA_PROGRESS.md) |
| OPS-ANALYTICS-CLEANUP | Blocked | Verify current data/backup and establish authorization before production deletion | [Open checks](verification/OPEN_CHECKS.md) |
| VERIFY-PUBLIC-002-003 | Planned | Reconcile historical mobile insights and teaser preview issue labels with current evidence | [Open checks](verification/OPEN_CHECKS.md) |
| VERIFY-REAL-SESSION | Planned | Track genuine-login/RLS/device evidence separately from fixtures and service-role tests | [Open checks](verification/OPEN_CHECKS.md) |

## Blockers

- Owner choices pending: latest run's two sheets directly in 검토; approved-only 생성본 with the existing 40 legacy sources moved to 보존본 versus a provenance-labelled source archive; and B/C follow-up commits versus uncommitted review. The ≤12 size ratio applies within one entity's variants, per the owner's answer. Raw-archive implementation is tested; do not silently choose the remaining policy.

- No new pine images have been generated. The old request remains frozen, 원본/정리본 contain no delivery, and review is pending. Newly collected references require owner curation and a new run before generation. Numeric checks do not replace owner visual approval.
- Production cleanup has no current execution or approval evidence. Old backup paths and row counts are historical; recheck before acting.
- ISSUE-002/003 have conflicting old labels and resolution claims. These are verification tasks, not confirmed current leaks. Fixture/service-role tests do not establish genuine-login/RLS/device coverage.

## Next Exact Steps

1. RULE-ART-COMPLETION: after the owner's answers, implement C1 and the chosen legacy-source placement/meaning, regenerate affected documents and run scoped checks. B and raw-archive code are deliberately uncommitted while the follow-up-commit choice remains unanswered.
2. ART-PINE-PILOT: search broadly for pine pixel-art references without a license-first search filter. Remove photographs, renders, vectors and smooth illustrations from the candidate set. Store only current-validator-accepted image bytes with provenance in `art-src/나무/소나무/레퍼런스/`; list other pixel-art candidates by original-source URL without copying their bytes. Regenerate NOTICE/catalogue and stop for owner curation. Keep the prepared request and input images intact. After the owner says selection is complete, freeze the surviving references in a new run before generation.
3. AMB-QA-18: choose the next reproduction from the current QA state. Do not replay commands from completed rounds.
4. VERIFY-PUBLIC-002-003 and VERIFY-REAL-SESSION: close only with current scoped evidence.
5. OPS-ANALYTICS-CLEANUP: keep the production operation separate; current authorization and recoverable backup must precede deletion.

## Last Verified

2026-09-09: latest art tree passed 786 tests across 69 files, typecheck, lint, build and harness. Starfish consolidation leaves 193 entries/966 generated documents from 207 slots/419 files, with only `동물/불가사리`. Low-quality common references 93 images and entity references 10 images were hash-backed up and removed; entity reference NOTICE verifies 0 active candidates. The owner then supplied 69 common-reference images: visual review classified 8 core environment scenes, 5 auxiliary codex screens and 56 subject/style-mixed files without changing bytes. `공통화풍원칙.md` records the derived mood/color/composition/camera rules; missing provenance blocks automatic run input. Legacy migration checks still verify 105 moved + 244 protected records. Frozen manifest/codex and pine request/input hashes are unchanged. [Reference cleanup and classification](handoffs/20260909-reference-library-cleanup.md). Five earlier local commits end at 628123d5; B/C and these follow-ups remain uncommitted.

Automatic host hook activation, new generated-art quality, browser/device and production DB checks remain NOT VERIFIED. Local commit split is authorized; no push/deploy performed.
