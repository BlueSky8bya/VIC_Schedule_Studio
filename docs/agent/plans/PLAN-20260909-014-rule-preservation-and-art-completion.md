# PLAN-20260909-014 — Rule preservation and art workflow completion

Status: In Progress
Task Risk: L2
Created: 2026-09-09 (KST)

## Authorization and order

[Work order](../handoffs/20260909-work-order.md) explicitly authorizes implementation and local commits, in order A → D → B → C. Preserve the approved document split. No push, new art generation or production operation. Unspecified design choices require the owner's answer.

## Recovery point

Before any edits: `C:/projects/VIC-work-order-backup-20260909T043525Z`. Base HEAD `d60efb33cadb53e695c5de6446f2ab3b60041bbc`. Backup contains binary tracked/index patches, 257 current changed/untracked files, 105 deleted-path records, complete Git history bundle and 1,323 ignored local files (1,079,047,887 bytes). All copied file hashes verified. Only regenerable node_modules and .next caches excluded. Never commit ignored local material from this backup.

## A — Preservation

- Account for every original CLAUDE line (589 lines, 59,266 bytes, source SHA-256 `61508ea7a2d4ee9bbd32935ed01f16384325a3b17514481a2c0639b21beb1e0a`) in RULE_MIGRATION with rule ID/code symbol/explicit retirement reason.
- Audit every numeric/measurement clause; restore current acceptance contracts and identify superseded values using evidence. Mark owner-fixed visual values as requiring owner judgement to change.
- Put Korean search terms on current rule lines. Audit every ADR and annotate superseded clauses without deleting history.
- Validate source hash, full line coverage, target IDs/symbols and the current rule inventory; add meaningful failure tests.

## D — Five independently checked commits

1. Source preservation, rule split and memory harness including A.
2. Art request/normalize/review/promote pipeline and tests.
3. Entity catalog/reference code and tests.
4. Image/sidecar migration, receipts and generated catalog.
5. Final routing/harness integration/current state.

Split dependencies at change boundaries; check each candidate tree before committing. Preserve unrelated user commits and all working-tree work. Record performed and unperformed checks in each commit. No push. During read-only preparation the owner separately committed the existing poster fix as `49b85abcee3b51616bf800c486298aa3a499e561`, directly after the original backup base. Keep that commit and append the five work-order commits above it; an additional history bundle preserves this observation.

## B — Complete entity entry points

Create all 194 entity entry points and four material folders with links from the catalog. Add --all and --category. Variant/season subfolders remain demand-created.

## C — Review and approved source storage

Proposal awaiting owner answer: show latest run's two review sheets directly in 검토, without individual PNG duplication or symlinks. Also awaiting the chosen meaning of 생성본 and whether B/C receive follow-up commits. Owner clarified the ≤12 size ratio: compare variants within the same entity; do not compare unrelated assets.

## Owner follow-up — Korean folder names

The owner explicitly replaces the English-folder-plus-lookup choice with Korean names for every directory inside art-src. Keep the archive root, file names and internal IDs. Back up the current tree; persist folder names separately from display labels; record original→current paths and hashes; update catalog/reference/pipeline and fresh product prompt output; verify frozen evidence and current routing. [Migration record](../handoffs/20260909-korean-art-folders.md) tracks execution and recovery. Remaining C choices and commit authorization are separate.

## Verification and boundaries

Semantic classification receives independent review; mechanical coverage does not itself prove visual equivalence. Verify restored contracts, all ADR audit rows, missing/added rule IDs, migration bytes, all entity links, approved-source publication/rollback and review-sheet ownership. Run tests appropriate to code changes, lint, typecheck and required per-commit checks. Browser/device/DB and actual generated-art approval remain separately reported.

## Current progress

Korean-folder follow-up completed: 223 directory renames and no English subfolders inside art-src. A later owner classification merges decorative and codex starfish into the single `동물/불가사리` workspace, reducing current entry points from 194 to 193 without changing the 207 slots or 419 filenames. Latest verification passed 786 tests, typecheck, lint, harness and all current art links. Verification and recovery live in the [folder record](../handoffs/20260909-korean-art-folders.md); this does not resolve the remaining C choices.

A and D complete. Five checked local commits: 27abd6dd → 23cd605f → ce1305f0 → 369c665a → 628123d5; the owner’s 49b85abc is their parent. Final candidate and main working files matched across 1,237 files before attaching the commits. No push.

B complete: 194 entity entries, 971 generated Markdown files, 979 art Markdown link checks and 343 unchanged image/JSON hashes. C2's common raw-archive connection is implemented and tested. Final combined tree: 755 unit tests, typecheck, lint and integrated harness passed. Review projection, legacy-source classification and follow-up commits remain pending owner choices; retain In Progress until those choices are resolved and applied. Detailed checks: [work-order evidence](../handoffs/20260909-work-order-results.md).
