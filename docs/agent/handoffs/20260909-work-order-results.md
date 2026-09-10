# Work order evidence — 2026-09-09

Scope: [approved A → D → B → C order](20260909-work-order.md). No rollback of the rule split, push, new art generation or production operation.

## A — Rule preservation

[RULE_MIGRATION](../RULE_MIGRATION.md) accounts for all 589 original lines in 163 rows against 97 active rule IDs. The original 59,266 bytes and SHA-256 are pinned by the validator. It checks live IDs outside examples/comments, exact code identifiers/property paths or configuration keys, classification targets and every source line exactly once.

The audit contains all 27 fully excluded source ranges and all 44 partially retired clauses, each with reasons. Most fully excluded ranges are headings/blank lines, not policy removals. Conditional private-layer warning wording and the server-only service-role boundary were retained after cross-review; they are not retired.

The measurement ledger contains 102 audited items and **42 restored contracts**, with the duplicate 620ms camera entry counted once. The owner separately clarified that the ≤12 largest/smallest ratio compares variants within the same entity. All 20 ADRs were audited: 15 received clause annotations, 5 remained unchanged. Existing ADR text, dates and statuses were preserved. The compaction manual's obsolete clauses also retain their text with current-rule notices.

Every retirement and restored measurement is listed in the linked audit; this handoff does not replace that complete list. Mechanical traceability is not proof of visual equivalence or owner acceptance.

## D — Independent local commits

All original tracked/untracked changes, ignored non-regenerable local material and Git history were backed up and hash-verified before edits. Recovery path and original base are in [PLAN-014](../plans/PLAN-20260909-014-rule-preservation-and-art-completion.md). The owner's separate poster fix `49b85abc` is preserved. The work-order commits were checked in an isolated worktree without copying production credentials.

| Unit | Commit | Actual checks |
|---|---|---|
| D1 original/rules/memory/A | `27abd6dd` | harness 65 documents, 589/163/97 mapping; 43 memory/migration tests; typecheck; lint; diff check |
| D2 art pipeline | `23cd605f` | all 708 unit tests, including 10 pipeline tests; typecheck; lint; harness; build exit 0; diff check |
| D3 catalog/reference/migration code | `ce1305f0` | all 731 unit tests, including 23 new catalog/reference/migration tests; typecheck; lint; harness; pre-migration NOTICE 103 pairs; diff check |
| D4 actual files/receipt/catalog | `369c665a` | 105 moved + 244 protected hashes; 14 generated entity entries; 103 reference pairs; 78 art Markdown documents' links; harness; diff check |
| D5 final routing/integration/state | `628123d5` | all 731 unit tests; typecheck; lint; integrated harness 73 documents and catalog freshness; 103 reference pairs; 105+244 migration hashes; diff check |

D1 defers the catalog import/check and unavailable art links. D2 includes the entity helper required by pipeline imports. D3 regenerates NOTICE in its new format using the still-unmoved paths. D4 introduces actual source/reference/rejection files and fixed run evidence; its future handoff link was deferred until D5 after the isolated link check found that dependency. D5 restores the final routing and enables repository catalog freshness in the harness.

No product build was required for D1/D3/D4/D5: only D2 changed product TypeScript. D4 did not rerun unchanged code tests. Each commit message distinguishes actual and unrun checks. No push or deploy.

## B — All entity entry points

B completed after the five commits. `npm run art:catalog -- --all` materialized all **194** entity entry points and four material folders; generated Markdown totals **971**. Every catalog row links its prompt. The bug category contains **39** entities. Variant/season folders were not pre-created for new entities.

`--all` and repeatable/comma-separated `--category`/`--entity` selections form a union; the no-selector behavior stays compatible. Invalid selections fail before writes. Existing handwritten/generated-file protection remains, and parent-file/target-directory conflicts are now detected across the entire batch before any write.

Actual B checks: catalog unit tests **17/17**, typecheck, targeted ESLint, diff check; actual all-entity freshness, all **979** art Markdown documents' links, **343** pre-B image/JSON hashes, integrated harness, **103** reference pairs and **105+244** migration hashes. The final tests also exercise dangling destination/parent links before any batch write. No new images or run artifacts were made. B remains uncommitted pending the requested follow-up-commit choice.

### Korean folder lookup

Subsequent owner instruction replaced English physical folders with Korean names. The original lookup-only result below is historical; current paths, preserved evidence and verification are in the [Korean folder migration](20260909-korean-art-folders.md).

The owner's follow-up request adds a Korean-name ↔ English-folder mapping to the existing [catalog](../../../art-src/목록.md). All 194 entities show their Korean category, all member-slot names, exact category/entity path, counts and prompt link. Names come from the existing manifest/codex data; duplicate names remain separate entities. `npm run art:catalog -- --all` refreshes the table, and the source README explains maintenance.

Scoped checks passed: 17 catalog tests, targeted ESLint, diff check, all 971 generated documents' freshness and all 979 art Markdown documents' links. All 343 protected image/JSON hashes are unchanged. Catalog source fingerprints were refreshed in generated entry points; physical folder paths and frozen run evidence did not change. This follow-up does not resolve the pending C choices or authorize commits.

## C — Source publication and pending choices

C2's explicitly requested common step is implemented: promotion copies approved raw bytes to the entity's canonical `생성본/<variant>/<season>/<filename>` while copying normalized bytes to public. Dry inspection reports both copy plans. Existing names, parent collisions, linked paths and publication/recovery records are checked before writes. The v2 published receipt records request/artifact/review hashes and both per-file source→target hashes. Run originals remain unchanged.

Partial writes, changed copies and receipt failures preserve uncertain bytes and report recovery. Only newly created regular files with matching expected hashes are rolled back. If a recovery record cannot be written, the CLI emits its complete JSON to stderr. New empty parent directories may remain; abrupt termination and concurrent publication are not promised atomic. Existing publication/recovery evidence blocks automatic retry.

C2 verification: **22 pipeline tests** including archive bytes/variant paths, all-destination conflicts, rollback, partial copy/receipt/recovery-record failures, source mutation and Windows path spelling. The final combined working tree passed **755 tests across 67 files**, typecheck, full lint and the integrated harness. Actual repo images, public files, prepared request/inputs and legacy locations remain unchanged; tests use isolated fixtures. No real normalize/promote was run.

Remaining C decisions: directly visible latest-run review sheets; whether 생성본 means approved originals only (relocate the existing 40 unverified legacy sources to 보존본 with a new receipt) or a provenance-labelled source archive; and whether B/C receive follow-up commits. The current prepared pine run has no delivered raw/normalized files or review sheets. C1 projection and legacy relocation have not been applied. No dependent mutation is authorized merely by elapsed time. The ≤12 size-ratio question has been answered separately.

## Verification limits

No new browser/device/visual capture, real-login/RLS/production DB test, generated-art quality judgement or owner approval was performed. The build ran without production credentials; it does not validate production data or live authentication. Frozen pine requests and accepted public artwork remain intact.

Final D5 candidate checks above passed in the isolated worktree. Only the verification record was updated afterward; document/harness checks were repeated on that final record. Product code is unchanged from the D2 build.
