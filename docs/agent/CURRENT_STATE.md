# Current State — VIC Schedule Studio

Last Updated: 2026-09-10 (KST)
Project Version: 0.1.0

Current work only. Completed results live in topic records. Historical snapshots are evidence, not startup instructions.

## Current Objective

Pine is the entry point and it is waiting on the owner alone. The nine collected references are named by content and the request now attaches them, so the next action is the owner naming which ones to drop; nothing else about pine is blocked. Also finish the remaining C choices in the approved [work plan](plans/PLAN-20260909-014-rule-preservation-and-art-completion.md): A, five checked D commits, all current B entry points and C2's raw-archive code are complete, while review-sheet presentation, the existing 40 legacy sources' classification and B/C follow-up commits await the owner. No new art generation without the owner's word.

## Active Work

| ID | Status | Next | Record |
|---|---|---|---|
| RULE-ART-COMPLETION | Awaiting Owner | Apply the chosen review presentation and legacy-storage policy; commit B/C only if selected | [Work-order evidence](handoffs/20260909-work-order-results.md) |
| ART-PINE-PILOT | Awaiting Owner Curation | Owner names the reference PNGs to drop; delete those pairs, rebake the notice, create a new run and request variants 2·3 across the three seasons | [Pine entry point](../../art-src/나무/소나무/프롬프트.md) |
| STYLE-REF-GAMES | Owner Supplied | Ask the owner what these are for before classifying, naming or deleting any of them | [Style reference rules](../ambient/ART_RULES.md) |
| AMB-QA-18 | Planned | Reproduce prioritized candidates on one fixed build before selecting fixes | [Ambient QA](../ambient/QA_PROGRESS.md) |
| OPS-ANALYTICS-CLEANUP | Blocked | Verify current data/backup and establish authorization before production deletion | [Open checks](verification/OPEN_CHECKS.md) |
| VERIFY-PUBLIC-002-003 | Planned | Reconcile historical mobile insights and teaser preview issue labels with current evidence | [Open checks](verification/OPEN_CHECKS.md) |
| VERIFY-REAL-SESSION | Planned | Track genuine-login/RLS/device evidence separately from fixtures and service-role tests | [Open checks](verification/OPEN_CHECKS.md) |

## Blockers

- Owner choices pending: latest run's two sheets directly in 검토; approved-only 생성본 with the existing 40 legacy sources moved to 보존본 versus a provenance-labelled source archive; and B/C follow-up commits versus uncommitted review. The ≤12 size ratio applies within one entity's variants, per the owner's answer. Raw-archive implementation is tested; do not silently choose the remaining policy.

- No new pine images have been generated. The old request remains frozen, 원본/정리본 contain no delivery, and review is pending. Numeric checks do not replace owner visual approval.
- Pine references are curated by the owner, not by an agent. All nine are still present and renamed subject-first (소나무모음 / 소나무한그루 / 나무모음 / 숲소품 / 식물모음, source last); an earlier agent-chosen deletion of six was reverted at the owner's word in `33d0178d`. Ask which to drop and delete only those pairs. `request` freezes whatever remains in 레퍼런스/ into 고정입력/수집참고 as `inspiration` inputs, so the folder's contents at request time are exactly what the generator is attached, and a reference without a CC0 sidecar fails the request instead of being skipped.
- `art-src/공통화풍참고/데이브 더 다이버/` (186 files) and `모여봐요 동물의 숲/` (27) are commercial game captures the owner placed there deliberately on 2026-09-10 and intends to work on next; they are not entity references, carry no provenance sidecars, and their filenames are cache hashes. They are committed and pushed in `27a39748`, whose message names only two documents because an agent staged everything without reading it. Leave them alone and ask the owner what they are for. The mood/composition rules they feed are style reference only: no asset is ever copied into our art.

- Production cleanup has no current execution or approval evidence. Old backup paths and row counts are historical; recheck before acting.
- ISSUE-002/003 have conflicting old labels and resolution claims. These are verification tasks, not confirmed current leaks. Fixture/service-role tests do not establish genuine-login/RLS/device coverage.

## Next Exact Steps

1. RULE-ART-COMPLETION: after the owner's answers, implement C1 and the chosen legacy-source placement/meaning, regenerate affected documents and run scoped checks. B and raw-archive code are deliberately uncommitted while the follow-up-commit choice remains unanswered.
2. ART-PINE-PILOT: ask the owner which of the nine references to drop and wait. Show the pictures rather than the filenames, and label any sheet by name, never by an index number the owner can mistake for a pine variety. On their word, delete only those image files, run `node scripts/ambient-ref-notice.mjs` to prune the orphan sidecars and rebake NOTICE, regenerate the pine catalogue, then create a new run and request variants 2·3 across the three seasons. Keep the frozen `20260909-파일럿-01` request and its input images untouched.
3. AMB-QA-18: choose the next reproduction from the current QA state. Do not replay commands from completed rounds.
4. VERIFY-PUBLIC-002-003 and VERIFY-REAL-SESSION: close only with current scoped evidence.
5. OPS-ANALYTICS-CLEANUP: keep the production operation separate; current authorization and recoverable backup must precede deletion.

## Last Verified

2026-09-09: latest art tree passed 786 tests across 69 files, typecheck, lint, build and harness. Starfish consolidation leaves 193 entries/966 generated documents from 207 slots/419 files, with only `동물/불가사리`. Low-quality common references 93 images and entity references 10 images were hash-backed up and removed; entity reference NOTICE verifies 0 active candidates. The owner then supplied 69 common-reference images: visual review classified 8 core environment scenes, 5 auxiliary codex screens and 56 subject/style-mixed files without changing bytes. `공통화풍원칙.md` records the derived mood/color/composition/camera rules; missing provenance blocks automatic run input. Legacy migration checks still verify 105 moved + 244 protected records. Frozen manifest/codex and pine request/input hashes are unchanged. [Reference cleanup and classification](handoffs/20260909-reference-library-cleanup.md). Five earlier local commits end at 628123d5; B/C and these follow-ups remain uncommitted.

2026-09-10: reference attachment shipped and pushed through `a6a20777`. Typecheck, lint, build, 787 tests across 69 files and harness (76 documents) all pass on that tree, `art:catalog --all --check` is clean, and `ref:notice --check` reports 9 images. A dry `request` for tree-pine attaches 7 images at 3 accepted + 1 sheet + 3 inspiration when six references are removed, and 13 with all nine present. The 970 catalog documents in `eaa3f14f` changed only in their manifest source hash. The kickoff note `20260910-next-session-kickoff.md` is wrong where it calls work-order A-1 unfinished: `RULE_MIGRATION.md` exists at 107,992 bytes from `27abd6dd`/`628123d5`, both ancestors of that note.

Automatic host hook activation, new generated-art quality, browser/device and production DB checks remain NOT VERIFIED. No image has been generated, normalized or promoted.
