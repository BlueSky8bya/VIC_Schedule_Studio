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

## Verification and boundaries

Semantic classification receives independent review; mechanical coverage does not itself prove visual equivalence. Verify restored contracts, all ADR audit rows, missing/added rule IDs, migration bytes, all entity links, approved-source publication/rollback and review-sheet ownership. Run tests appropriate to code changes, lint, typecheck and required per-commit checks. Browser/device/DB and actual generated-art approval remain separately reported.
