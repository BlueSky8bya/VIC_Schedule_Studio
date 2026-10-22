# Scratch retention

Local QA evidence under `.scratch-pw/` (every registered worktree) has no other cleanup. Unbounded retention filled drive C (2026-10-22: about 300 GiB; companion-daily alone grew about 50 GiB a day). This module bounds it. It replaces the earlier "unbounded and local" retention statement and the unimplemented success-7-day/failure-30-day idea.

```sh
node scripts/scratch-retention/retention.mjs                # dry run: prints every remove/keep with its reason
node scripts/scratch-retention/retention.mjs --apply        # delete, slim, hardlink-dedupe, write .scratch-pw/.retention/<time>.json
node scripts/scratch-retention/retention.mjs --budgetBytes 60 --failureDays 10   # overrides (GiB / days / hours)
```

## Policy (`DEFAULT_POLICY`)

| Unit | Rule |
|---|---|
| Factory run (`companion-daily/<runId>`, `site-daily/<id>`, `site-daily/native/<id>`) | Keep the newest 2 per factory per worktree and the newest successful run. Others expire after 3 days (success) or 7 days (failed). |
| Feature folder (any other top-level folder: `companion-NNN`, `side-*`, `qa`, …) | Expires 14 days after its last write. |
| Test leftover (`focused-receipt-*`, `focused-continue-*`) | Expires after 1 day. |
| Tool environment (`pyvenv.cfg` / `Lib/site-packages` nested in a kept feature folder) | Expires after 3 days; re-create it when needed. |
| Budget | Total across every `.scratch-pw` ≤ 40 GiB and drive free ≥ 60 GiB; otherwise the oldest unprotected units go first. |
| Disk floor | A factory refuses to start below 30 GiB free after pruning. |

Never removed:
- anything written within the last 3 hours (it may still be running);
- a folder that is or contains a registered git worktree;
- anything a live `.scratch-pw/site-daily/state.json` references, and every run cited by a kept run's `result/build/plan/report.json` (continue-from, reuse-build, case history, `proofRef`), up to 10 links deep.

Committed `.md` references are deliberately not a protection: the owner put capacity ahead of historical evidence links (2026-10-23). Docs that cite deleted scratch evidence remain historical records.

## Actions and their evidence guarantees

- **Delete**: only inside a `.scratch-pw` root. Junctions and symlinks (e.g. `workspace/node_modules`) are unlinked first and never followed.
- **Slim** finished factory runs: remove `workspace/.next/cache` (webpack cache; receipts and `review.mjs` exclude or never read it) and NTFS LZX-compress text evidence ≥ 4 KiB. Bytes, SHA-256 hashes and `evidence-manifest.json` stay valid.
- **Dedupe** (`--apply` only, not at factory start): byte-identical files ≥ 64 KiB become hardlinks of one copy. Content and hashes are unchanged. Do not edit evidence files in place afterwards; every linked copy would change.

## Integration

`scripts/companion-qa/runner.mjs` calls `guardBeforeRun` before creating a run (prune without the slow dedupe pass, then the disk floor) and `afterRun` after its manifest is written. Set `SCRATCH_RETENTION=off` to skip pruning for one run; the disk floor still applies.

Site-daily (`scripts/site-daily/*`) is not wired in yet. Run the CLI before scheduled QA until it is. Update the scheduled heartbeat and `state.json` consumers to tolerate pruned non-live runs.
