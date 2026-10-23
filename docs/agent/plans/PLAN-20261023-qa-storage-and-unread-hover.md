# QA storage and unread page indicators — 2026-10-23

## Authorization and outcome

The owner requested daily management/compression of accumulated QA, preserving existing report/evidence routing, and fixing collection page indicators that turn blue when an unread red dot is enlarged on hover. Implement these within the existing daily automation; preserve its schedule and unrelated instructions. Current authorization continues routine bug-fix validation and release. No new tracking, dependencies, services or operating data.

## Storage contract

- Use explicit cold QA roots and Windows NTFS lossless in-place compression. Keep original paths, bytes, SHA256, raw failed runs, images/video/trace, source/build receipts and report links. Do not zip-and-remove, rename evidence, deduplicate with writable hardlinks, or delete anything under this authorization.
- Inventory actual available data and distinguish logical bytes, allocated bytes, observed drive free space and projected savings. Previously reported 300GB is the owner's observation, not our current measurement.
- Default to a bounded dry-run/plan; explicit apply uses a bounded time/byte/file allowance and records before/after hashes and native allocated-size results. Exclude active runs/builds, recent/mutating files, symlinks/junctions/reparse paths, source assets, secrets/configuration, unrelated caches and directories outside explicit QA roots. Never recurse native compression through arbitrary directory links.
- Referenced evidence stays readable at its original location. Validate the applicable local ledger/report references and hashes, retain original receipt statuses and every failure. Keep a small resumable storage index; daily maintenance must not create another full evidence copy or scan/read all raw JSON every day.
- Compression is a storage operation, not a new PASS, observation date or expert review. On unavailable filesystem/locked files/budget expiry, preserve data, report actual failure/deferral and continue the normal QA workflow.
- Initial controlled cleanup and future bounded daily maintenance share the same tool. Future runs prioritize old compressible QA over already compressed media; no savings claim until allocated-byte measurements are available.

Microsoft's [compact documentation](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/compact) specifies NTFS compression and LZX for infrequently modified files. Applicability and savings must be verified locally; the command is not an archival deletion policy.

## UI contract

Preserve unread red semantics in pointer hover, keyboard focus and current/active states, including enlarged indicators. Ordinary dots retain normal blue interaction and current-page behavior. Use the existing shared collection/wardrobe pager and theme tokens; no new event/analytics semantics. Audit existing pointer/keyboard targets and discovery-data exclusions.

## Validation and release

Meaningful storage unit/synthetic Windows checks cover path/reparse/activity/mutation/budget/hash guards and transparent readability. Actual bounded cold-QA compression verifies byte identity, original paths and measured allocation before/after; current evidence chains remain valid. UI uses a fresh production build and relevant rendered light/dark shared-surface interaction checks. Run type/lint/relevant unit/build and harness checks, obtain non-author review, then scope commit/push and verify exact public deployed fullSHA. No unrelated full200 or normal36 run.

## Verified implementation

- Shared CSS hover background now applies the ordinary blue only to dots without `data-unread`; enlargement/pressed behavior, theme discovery colors, current+unread gradient and existing read/keyboard/activity behavior stay intact. Fresh immutable production BUILD_ID `2xAwzpaBasuQIpL9hETly`:6 actual cases across viewer/studio/preview × light/dark,4 pagers each. Final result `81e8e4e5`, SHA256 `d3b7f0cf78575e5926e39255855e38360d4f046f0c2d9380a055ea2a2429ca83`. Earlier fixture failures (transition color sampling; legitimate detail-read ACK) and rejected build reuse remain preserved; no original reporter was promoted.
- `scripts/site-daily/qa-storage.mjs` and the native helper implement explicit pinned plans, cold single-link files, bounded inventory/cursor/pending, native process/state/lease guards, per-file hash/identity verification, allocation measurements and transparent reads. Already-compressed inspection is a storage observation, never QA PASS. Pending starvation and PowerShell UTF-8/exit-code differences were reproduced and fixed with failure evidence retained.
- Actual existing QA:437+147+14 files across two old QA roots,598 files total. Allocated bytes340,326,080→103,825,408;236,500,672 bytes saved. Every processed file retains its original path/SHA/size/timestamps, and each operation verifies its protected references. Hardlinked/media/protected/recent files are excluded; no deletion or relocation. Existing seven result headers and21 current report links remain present. Five older state references were already absent before maintenance; their cause is unknown and they are not silently repaired or blamed on compression.
- Separate synthetic actual Windows cases verify new single-link compression, ordinary Node/receipt reads, already-compressed continuation and full Korean+space paths. The latter guards PowerShell5's ANSI interpretation of BOM-less UTF-8; inspection errors are now explicit. Nine storage units include a real Windows encoding check.
- Existing automation `automation` updated through the app tool, preserving its full previous prompt prefix, daily09:00 KST schedule, status and thread. Daily storage has its own3-minute/2GiB/1000-file default and explicit root rotation; no extra automation was created. Small local schedule/cursor/report files retain continuation; normal unchanged outcomes stay quiet.

## Status and evidence routing

Primary dirty checkout and original assets/evidence are preserved. Implementation/release checkout: `C:/Projects/VIC-daily23-replay-seek`, starting at `396024fcaf1d0334c436612195eca65f17a98932`. Non-author source, actual UI and per-file compression reviews are local under `.scratch-pw/qa-storage-20261023/audit/`. Exact final quality/commit/deployed fullSHA and original failure links are retained in the local report `REPORT-20261023-qa-storage-unread-hover.html` and primary site-daily state; local PASS is not deployment.

Initial inventory covers seven QA roots,241,712 regular files,87.65GB logical and84.91GB per-path native storage sums. Existing hardlinks can double-count those sums; these are not unique whole-drive usage or the owner's earlier300GB measurement. Already-compressed ZIP/media dominate and all today's snapshots remain recent. Only actual per-file allocation reductions above are savings claims; no full200/all-device/normal36 or complete historical proof-chain revalidation claim.
