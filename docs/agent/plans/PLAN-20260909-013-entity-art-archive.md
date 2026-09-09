# PLAN-20260909-013 — Entity art archive

Status: Completed
Task Risk: L2
Created: 2026-09-09 (KST)

## Objective and authorization

Complete the entity folder organization in the original consultation. The user corrected the earlier interpretation that isolated runs alone fulfilled this request. This session authorizes moving existing source/reference files into entity folders while preserving bytes, filenames and provenance. The previous art-src README rule retaining all old paths is superseded for this recorded migration.

## Scope

- Generate entity routers and a catalog from the manifest's exact output filenames; seasonal availability does not multiply files. Keep immutable runs as delivery evidence within each entity.
- Move 40 root source PNGs into entity generated folders and 45 rejected pine PNGs into two identified rejection batches. Preserve uncertain original/approval lineage explicitly.
- Move only visually associated outside-reference candidates, together with identical source sidecars; leave shared/ambiguous candidates in the category library.
- Record source/target/hash receipts before moving; preflight collisions and path boundaries, support rollback on failed movement, and verify protected public/run files.
- Include imported historical rejection reasons in future requests. Update storage, command and current-state documentation.

## Boundaries

Public/private APIs, permissions, DB and KST behavior are unchanged. Do not generate artwork, publish public sprites, edit the frozen run/manifest contract, change the G-drive protocol, commit or deploy. Owner approval is never inferred from file location or numeric checks.

## Verification

Catalog determinism/freshness, migration collisions/rollback/hash protection, reference sidecar scope/read-only checking, rejection inheritance and existing art tests. Check source bytes and immutable public/run paths after migration; run scoped lint, unit tests, typecheck and harness verification. Product/UI builds are outside this archive/script-only change.

## Recovery

The tracked migration receipt records each exact reverse path and hash. Automatic rollback only touches files created by its own invocation. Preserve all unrelated working-tree changes; do not reset or recursively delete the archive.

## Results

Completed 2026-09-09: 105 files moved with identical bytes, 244 protected files verified, 14 entity routers and a 194-entity catalog generated. Two historical rejection records feed six open reasons into future pine requests. The prepared pilot remains untouched.

Validation: 702 full-suite tests passed; after the final reference-write hardening, 13 reference and 10 pipeline tests passed. Full lint, final typecheck, migration preservation, 103-reference notice, catalog freshness and 78 art-document link checks passed. Final memory/harness check recorded in [entity archive handoff](../handoffs/20260909-entity-art-archive.md).
