# PLAN-20261023 — Local QA scratch retention

Owner request (2026-10-23 KST): prevent `.scratch-pw` QA evidence from filling drive C again. Capacity takes priority over historical scratch evidence; adapt the 09:00 automation afterwards.

## Problem

- No code removed anything under `.scratch-pw`. Each `companion-daily` run copied the source tree, built `.next` (with a large webpack cache), recorded video for every case and kept everything.
- On 2026-10-22, drive C reached 21 GiB free. Scratch was about 300 GiB across worktrees and was growing about 50 GiB a day.
- A manual cleanup on 2026-10-22/23, done outside the repository, deleted 71 repeated factory runs. It also removed five paths that `site-daily/state.json` still referenced: `lastDiagnosticRef` `site-daily-165/165-final-diagnostic-reference.json`, `previousFailedRun`, and three ledger paths. Those are unrecoverable. The heartbeat must treat them as missing evidence, not as a product failure.

## Change

- `scripts/scratch-retention/retention.mjs` (+ `.d.mts`, README) implements the policy: expiry by kind and status, a size budget, a free-space floor, slimming, and hardlink dedupe. Protections cover in-progress runs, git worktrees, live state references and receipt chains.
- `scripts/companion-qa/runner.mjs` calls `guardBeforeRun` before a run and `afterRun` after the manifest. `report.mjs` retention text updated.
- `tests/unit/scratch-retention.test.ts` covers the selection rules, protections, link safety, slimming, dedupe and argument parsing.

## Verification (claude/scratch-retention worktree, base origin/main 638b4d7f)

- `vitest run tests/unit/scratch-retention.test.ts tests/unit/companion-qa-142.test.ts tests/unit/companion-daily-review-143.test.ts`: 3 files, 443 tests passed.
- `npm run typecheck` exit 0. `eslint` on the changed files exit 0.
- Dry run against the real worktrees (2026-10-23 01:22 KST): scratch 167.6 GiB → 53.2 GiB, 633 units removable, 15 kept.
  - Kept: newest/successful runs, state- or chain-referenced folders, `side-toy-scroll-150` (contains a worktree).
- Owner-approved `--apply` (2026-10-23 01:25 KST, log `.scratch-pw/.retention/2026-10-22T16-25-49-074Z.json`):
  - 633 units deleted, 0 partial. Slim 0.79 GiB. Dedupe 5,061 links, 3.72 GiB.
  - Scratch 167.6 → 53.2 GiB. Drive C free 366.8 → 482.6 GiB.
  - Afterwards: all 15 kept units are present. The `state.json` missing-path count is unchanged at the five known paths. All three `node_modules` are intact. The `side-toy-scroll-150` worktree is still registered.
- Not run: full `npm test`, `npm run build`, an actual factory run with the hooks.

## Open

1. Owner decision on merging this branch into main and pushing; the branch is committed only. The main checkout has uncommitted work in `scripts/site-daily/*`, `scripts/companion-qa/README.md` and `ACTIVE_PLAN.md`.
2. Wire `scripts/site-daily/runner.mjs` / `scoped-native.mjs` to `guardBeforeRun`/`afterRun` once their uncommitted changes land.
3. Adapt the 09:00 heartbeat prompt and `state.json` consumers to pruned runs. Remove the stale `companion-qa/README.md` "unbounded" paragraph after its pending edits land.
