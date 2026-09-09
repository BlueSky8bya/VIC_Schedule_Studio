# PLAN-20260909-012 — Current memory and isolated art delivery

Status: Completed
Task Risk: L2
Created: 2026-09-09 (KST)

## Objective

Stop completed work and withdrawn instructions from being injected as current tasks. Repair the initialization protocol that left these controls unspecified. Make the next pine request preserve accepted artwork and use an isolated, reviewable batch.

User authorization: 2026-09-09 consultation accepted; project documents and the supplied `project-initializing_260712.md` may be updated. The supplied protocol is an editing target, not an instruction to bootstrap this repository again.

## Scope

1. Preserve long memory documents as history. Make AGENTS the common rules entry, CLAUDE a short adapter, CURRENT_STATE a bounded active-work record, and ACTIVE_PLAN an index.
2. Route current UI and ambient rules to their domains; retain a short reason and evidence with important rules. Correct conflicting/retired instructions without weakening security rules.
3. Enforce memory size and lifecycle contracts. Session briefing uses bounded current facts; drift compares actual start/end contents and accepts domain records or an explicit, change-bound documentation-impact explanation.
4. Correct the pine file list. Add a flat six-file pilot batch with immutable request inputs, candidate/baseline separation, numeric checks, recorded human decisions and accepted-art protection.
5. Back up and narrowly revise the supplied initialization protocol: source ownership, configurable budgets, retirement rules and verification contracts.

## Boundaries

- No DB, RLS, runtime authorization or production API changes. Public/private separation remains server-enforced; `owner_private` remains owner-only.
- No production art replacement without the required review record. Existing public and source PNGs are preserved.
- New artwork generation is a separate execution choice; preparation can exercise the pipeline using isolated fixtures.
- No automatic commit, push, deploy, migration or production cleanup.
- Dates use Asia/Seoul; machine timestamps carry an explicit offset or UTC marker.

## Verification

- Harness: oversized/inconsistent active memory rejected, historical snapshots ignored, inherited dirty changes excluded, later changes invalidate documentation-impact acknowledgement.
- Art: exact requested files, accepted-file protection, incomplete seasonal pack rejection, same-name baseline does not hide a candidate, singleton coverage and failure exit status.
- Run harness verification, relevant unit tests, typecheck, lint and production build after integration. Inspect revised protocol definitions/templates; do not execute bootstrap.
- Record actual commands/results and source revision in final handoff. Unexecuted browser, human-art and production checks stay unverified.

## Rollback

Reviewable working-tree changes; old memory snapshots under `docs/agent/archive/`. External protocol has a dated backup beside its original. Restore only this task's changes if requested; preserve other work.

## Progress

- Completed 2026-09-09: document migration, bounded memory/lifecycle/session checks, isolated art pipeline and external protocol revision. See [repair evidence](../handoffs/20260909-memory-and-art-pipeline-repair.md).
- Validation: 680 unit tests, typecheck, lint and production build passed. Document/harness and immutable request checks passed. New image generation and owner approval remain future art execution, not unfinished implementation of this plan.
