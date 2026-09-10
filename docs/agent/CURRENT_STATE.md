# Current State — VIC Schedule Studio

Last Updated: 2026-09-11 (KST)
Project Version: 0.1.0

Current work only. Completed results live in topic records. Historical snapshots are evidence, not startup instructions.

## Current Objective

Current: owner accepted the three-layer spring meadow and authorized push; deploying for live visual feedback. [Implementation/checks](../ambient/rounds/ROUND-21-meadow-camera.md), [ADR-0024](decisions/ADR-0024-spring-meadow-three-layers.md). Other seasons await expansion; deep stays sealed.

Style captures are now a working pipeline (ADR-0021): every one of the owner's 449 game captures under `art-src/공통화풍참고/` is indexed with a role, and `art:pipeline request <entity>` attaches the matching ones automatically. Pine is the next delivery and waits on the owner alone: name the reference PNGs to drop, then a new run requests variants 2·3 across the three seasons with accepted baselines + CC0 references + style captures frozen together. No new art generation without the owner's word. The remaining C choices in the approved [work plan](plans/PLAN-20260909-014-rule-preservation-and-art-completion.md) still await the owner.

## Active Work

| ID | Status | Next | Record |
|---|---|---|---|
| AMB-DEPTH-P1 | Deploying accepted spring meadow | Verify live result, then owner reviews before expansion | [Camera work](../ambient/rounds/ROUND-21-meadow-camera.md) |
| STYLE-REF-GAMES | Shipped, extensible | New captures: drop into `공통화풍참고/<게임>/`, `style:scan --sheets`, classifier agent fills the worksheet, `style:apply`, `style:check` | [공통화풍참고 README](../../art-src/공통화풍참고/README.md), ADR-0021 |
| ART-PINE-PILOT | Awaiting Owner Curation | Owner names the reference PNGs to drop; delete those pairs, rebake the notice, create a new run and request variants 2·3 across the three seasons | [Pine entry point](../../art-src/나무/소나무/프롬프트.md) |
| RULE-ART-COMPLETION | Awaiting Owner | Apply the chosen review presentation and legacy-storage policy; commit B/C only if selected | [Work-order evidence](handoffs/20260909-work-order-results.md) |
| AMB-QA-18 | Planned | Reproduce prioritized candidates on one fixed build before selecting fixes | [Ambient QA](../ambient/QA_PROGRESS.md) |
| OPS-ANALYTICS-CLEANUP | Blocked | Verify current data/backup and establish authorization before production deletion | [Open checks](verification/OPEN_CHECKS.md) |
| VERIFY-PUBLIC-002-003 | Planned | Reconcile historical mobile insights and teaser preview issue labels with current evidence | [Open checks](verification/OPEN_CHECKS.md) |
| VERIFY-REAL-SESSION | Planned | Track genuine-login/RLS/device evidence separately from fixtures and service-role tests | [Open checks](verification/OPEN_CHECKS.md) |

## Blockers

- Owner choices pending: latest run's two sheets directly in 검토; approved-only 생성본 with the existing 40 legacy sources moved to 보존본 versus a provenance-labelled source archive; and B/C follow-up commits versus uncommitted review. The ≤12 size ratio applies within one entity's variants, per the owner's answer. Raw-archive implementation is tested; do not silently choose the remaining policy.
- No new pine images have been generated. The frozen `20260909-파일럿-01` request is untouched, but `manifest.ts` changed for the style-reference prompt kinds, so that run's source-contract hash no longer matches: it cannot be normalized or promoted and must be replaced by a new run (it was already planned to be). 원본/정리본 contain no delivery.
- Pine references are curated by the owner, not by an agent. All nine are still present and named subject-first; an earlier agent-chosen deletion of six was reverted in `33d0178d`. Ask which to drop and delete only those pairs. `request` freezes whatever remains in 레퍼런스/ as `inspiration` inputs, and a reference without a CC0 sidecar fails the request.
- Style captures are commercial game assets the owner placed deliberately. Their bytes and filenames stay as placed; classification lives only in `색인.json`. Stock/watermarked/other-game files inside those folders are `none` and never attach; moving one into an entity 레퍼런스/ needs a confirmed license and sidecar. Whether attaching commercial captures to the generator is acceptable was the owner's decision (2026-09-10); reviewers still check that no game asset is copied into a delivery.
- Production cleanup has no current execution or approval evidence. Old backup paths and row counts are historical; recheck before acting.
- ISSUE-002/003 have conflicting old labels and resolution claims. These are verification tasks, not confirmed current leaks. Fixture/service-role tests do not establish genuine-login/RLS/device coverage.

## Next Exact Steps

1. ART-PINE-PILOT: ask the owner which of the nine references to drop and wait. Show the pictures rather than the filenames, and label any sheet by name, never by an index number. On their word, delete only those image files, run `node scripts/ambient-ref-notice.mjs`, regenerate the pine catalogue, then `npm run art:pipeline -- request tree-pine --run <새 회차> --variants 2,3` (style captures attach automatically; `--no-style` to opt out) and hand the owner the frozen inputs plus `고정입력/화풍참고/화풍시트.png` to attach. Keep `20260909-파일럿-01` untouched.
2. STYLE-REF-GAMES follow-ups only when the owner asks: extend `분류어휘.json` groups if a new entity family has no group, add a new game folder the same way, or move a licensed stock image into an entity 레퍼런스/.
3. RULE-ART-COMPLETION: after the owner's answers, implement C1 and the chosen legacy-source placement/meaning, regenerate affected documents and run scoped checks.
4. AMB-QA-18: choose the next reproduction from the current QA state. Do not replay commands from completed rounds.
5. VERIFY-PUBLIC-002-003 and VERIFY-REAL-SESSION: close only with current scoped evidence.
6. OPS-ANALYTICS-CLEANUP: keep the production operation separate; current authorization and recoverable backup must precede deletion.

## Last Verified

2026-09-10 (style captures): 449 images (데이브 더 다이버 186 = 184 depiction + 2 mood; 모여봐요 동물의 숲 263 = 8 mood + 195 depiction + 13 form + 47 none) were classified by visual review of 38 contact sheets and applied through the real `style:scan → 분류대기.json → style:apply` path; `style:check` passes with 0 unindexed and 0 hash drift. `style:pick` for tree-pine yields 2 mood scenes, fish-crucian 3 exact/pond icons, fish-anglerfish 2 exact + 1 deep-sea, animal-chipmunk mood only (no land-mammal captures exist). Unit tests cover scan/apply/pick/freeze; the full gate results for this tree are recorded in the commit message. [Reference cleanup and classification](handoffs/20260909-reference-library-cleanup.md) remains the record for the earlier 69-image pass.

2026-09-10 (earlier): reference attachment shipped and pushed through `a6a20777`. The kickoff note `20260910-next-session-kickoff.md` is wrong where it calls work-order A-1 unfinished: `RULE_MIGRATION.md` exists from `27abd6dd`/`628123d5`.

Automatic host hook activation, real-device and production DB checks remain NOT VERIFIED. Spring provenance, browser checks, A/B/C review and deployed public verification are in ROUND-20; owner visual feedback remains separate.
