# QA reclaim and duplicate-build prevention — 2026-10-23

## Latest authorization

After the236.5MB compression result, the owner explicitly requested more substantial cleanup of duplicate builds and unused QA while preserving existing report references and necessary failure evidence, plus daily prevention of accumulation. This expands the previous compression-only/no-deletion scope **only** to verified unused generated QA caches and any separately proven duplicates. It does not authorize deleting original art, user source, raw failure media, retained build/source evidence or blindly replaying historical retention policies.

Implementation checkout `C:/Projects/VIC-daily23-replay-seek`, starting at `b9039bbbbe7cabd0549e5dfa05d587904dc58f1e`. The primary dirty checkout and all source/art user work remain preserved.

## Approach

1. Audit actual disk/file identities and report/receipt reference closure. Distinguish per-path logical sums, native allocation, existing hardlinks, exact duplicates and unique raw data. Size/name/date similarity is not duplicate proof.
2. Reclaim explicit closed snapshot `workspace/.next/cache` directories that are excluded from the exact hash-bound build contract. Record a pinned plan, file hashes/identities/allocation, successful build/source proof, protected references and active state/process checks before removing only those verified caches. Never remove `.next/types`, runtime build output, snapshots or raw evidence under a generic age rule.
3. Separate build-byte verification from case PASS verification. A successful immutable build must remain reusable after ordinary test/assertion/max-failure stops, while source/runtime/build integrity, cleanup and network guards still apply. Unknown environment errors fail closed. Existing `verifyRun`/case PASS gates remain unchanged; build reuse never converts failed cases into PASS.
4. Use the default owned build-history index or explicit pinned candidates matching the current product inputs. Materialize only a verified runtime build without its compiler cache and execute selected native cases fresh. Keep at most200 verified compile origins, separate from case PASS. Record whether a build was actually reused or rebuilt. No new paid service/dependency/model or production data.
5. Add daily bounded cache maintenance and reuse selection alongside existing lossless compression. Preserve schedule, existing instructions, source/build/raw references and all original failures. Cache cleanup is maintenance, not another QA observation or release certification.

Read-only audit found16 snapshot caches around6.38GB logical, about6.32GB single-link bytes. Eleven focused caches totaling4,657,635,672 logical bytes have closed bound source/build receipts. Three initial failed-build caches lack that proof; two legacy caches are unbound/partly hardlinked. All five remain protected. Roughly44GB ZIP traces are mostly unique (even equal-size large archives had different hashes), so they are not disposable duplicate evidence. Original/current working-checkout builds are not declared unused merely because no server is running.

## Validation and evidence

Meaningful unit counterexamples cover pinned metadata/hash/source/runtime/build input changes, excluded-cache boundaries, reparse/hardlink/path/activity/reference races and strict case-PASS separation. Actual controlled build reuse from a preserved failed-case run must show no fresh compile step and a fresh native interaction. Reclaim checks compare all retained manifest hashes, protected result headers/report links and actual allocation, retaining original metadata and failures. Synthetic delete fixtures establish native exact-path behavior before real maintenance. Obtain non-author review before real apply/integration.

Tool-only work requires relevant units, type/lint and harness; it does not justify another full site build/full200/normal36. Exact code release and public fullSHA, if pushed, are recorded in the local report/primary ledger. No misleading all-suite/actual-user/device claim.

## Actual closure

At2026-10-23 17:35KST two independently approved SHA-pinned plans removed exactly11 cache directories/110 single-link files, measuring4,657,635,672 allocated bytes. Combined with the earlier236,500,672-byte lossless compression, verified savings are4,894,136,344 bytes. No synthetic savings are included. Whole-drive free-space movement is separately recorded and not attributed as precise savings.

The independent post-apply145.6-second content audit verified all11 retained raw/source/non-cache-build sets, all8 original recursive case-history receipts and534 protected reference snapshots plus state. Original result headers and failures remain unchanged; FAF9/E716 still fail the case gate while their build-only proof is valid. A fresh actual native case passed using the existing FAF9 BUILD_ID with zero compile/cache-copy/case-PASS reuse. Default index selection and safe atomic cap200 maintenance were separately observed at metadata level and unit-tested; that is not another native run.

Relevant58 units, typecheck, targeted eslint and harness passed. Cache and build-reuse sources, exact plans and real post-apply effects received non-author approval. Original receipts and hashes are in local `.scratch-pw/qa-reclaim-20261023/` and `.scratch-pw/build-reuse-proof-20261023/`; public documentation does not contain private raw media. New product AI/full200/normal36 were not run or claimed.

Existing daily09:00KST automation was updated in place and its saved policy/schedule verified. Daily plan+apply+compression share3min/2GiB/1000-file limits with24h cooling. Unique raw traces and unknown/active/linked caches stay protected, so ongoing necessary evidence growth is monitored rather than promised to disappear. Release commit and public verification are recorded in the local final report after integration.
