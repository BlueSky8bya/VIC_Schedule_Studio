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
| D5 final routing/integration/state | this integration commit | all 731 unit tests; typecheck; lint; integrated harness 73 documents and catalog freshness; 103 reference pairs; 105+244 migration hashes; diff check |

D1 defers the catalog import/check and unavailable art links. D2 includes the entity helper required by pipeline imports. D3 regenerates NOTICE in its new format using the still-unmoved paths. D4 introduces actual source/reference/rejection files and fixed run evidence; its future handoff link was deferred until D5 after the isolated link check found that dependency. D5 restores the final routing and enables repository catalog freshness in the harness.

No product build was required for D1/D3/D4/D5: only D2 changed product TypeScript. D4 did not rerun unchanged code tests. Each commit message distinguishes actual and unrun checks. No push or deploy.

## B / C — Remaining work

B follows the five commits: materialize all 194 entity entry points and four material folders, add --all/--category, and preserve demand-created variant/season subfolders.

C awaits the owner's choices: two directly visible review sheets; whether 생성본 means approved originals only or a provenance-labelled source archive; and whether B/C receive follow-up commits. No dependent C mutation is authorized merely by elapsed time. The ≤12 size-ratio question has been answered separately.

## Verification limits

No new browser/device/visual capture, real-login/RLS/production DB test, generated-art quality judgement or owner approval was performed. The build ran without production credentials; it does not validate production data or live authentication. Frozen pine requests and accepted public artwork remain intact.

Final D5 candidate checks above passed in the isolated worktree. Only the verification record was updated afterward; document/harness checks were repeated on that final record. Product code is unchanged from the D2 build.
