# Deployment output storage — 2026-10-23

Status: local packaging verified and11 old deployments actually removed by the authorized CLI cleanup. Current follow-up release and provider-billed GB reduction are not established. The initial inventory/tooling observations below remain historical evidence.

## What was measured

The source checkout has 613 public files / 185,758,399 bytes. The largest groups are radio audio (96,189,203 bytes), ambient art (40,974,004), companion HD sprites (30,852,190), home assets (7,610,414), and collection art (4,768,450). No byte-identical public duplicates were found. These are raw source-file sizes, not provider billing charges.

The current native build's largest local Function trace references about 3.36 MB and no public files. The earlier 149 MB ambient-art Function packaging problem does not recur in this local trace. A 457.74 MB `.next` directory includes compiler caches; its size is not Deployment Storage.

## Exact archive, without changing source originals

`scripts/deployment-output/archive-manifest.json` pins 186 superseded public assets by exact relative path, size and SHA-256:

| Family | Files | Bytes |
| --- | ---: | ---: |
| Inactive original radio recordings, replaced by the current 34-track catalog | 32 | 23,354,221 |
| Superseded flat companion and audience atlases | 7 | 4,377,880 |
| Superseded HD atlases absent from current runtime sources | 147 | 23,985,672 |
| Total | 186 | 51,717,773 |

The current radio recordings are already 64 kbps Opus. They are retained without additional lossy compression or shortening. Current art, poses and near-detail resolution are unchanged.

The preparer runs automatically only in a Linux Vercel production/preview build. It validates all entries and current `app`, `components`, and `lib` source/JSON/CSS references before any move. It then moves those exact files into that disposable build's `.deployment-output-archive/`, outside `public`. It does not delete their bytes. A failed move or receipt publication restores earlier moves. Repeated prebuild calls revalidate staged bytes. The final receipt path is checked before staging and before publication; existing files must be regular, singly linked and matching managed receipts. New receipts use exclusive temporary files, a newly owned descriptor, fsync and atomic rename.

Ordinary local development, local builds, native QA and historical creation checks retain all original public paths. Immutable art receipts, original source files and their references are not rewritten. This avoids breaking historical pixel/alpha verification while keeping obsolete images out of new public deployment output. An intentionally reintroduced literal or manifest reference stops packaging rather than silently excluding an active asset. This conservative reference guard is not a general proof about arbitrary future dynamic URL construction.

The prebuild hook runs before ambient metadata generation and catalog bounds generation. Its temporary archive is excluded from source uploads and Git. No `.vercelignore`-only storage reduction is claimed.

## Actual separate packaging fixture

The test copied current public assets and runtime source into a separate disposable fixture, without private `art-src`, credentials, or an existing native snapshot. It then executed the real preparer:

- Public output: **613 files / 185,758,399 bytes → 427 / 134,040,626**.
- Exact raw public-file reduction: **51,717,773 bytes (27.84%)** per newly packaged output.
- All 427 retained files and 186 archived files have matching SHA-256 values.
- All 613 source-checkout public files remain byte-identical and at their original paths.
- The fixture's full `npm run prebuild` passed after staging: ambient metadata 64 files / 6,813 bytes, unchanged; catalog bounds 252 foods / 84 toys, unchanged. It did not need private source-art archives.
- Focused unit **16/16**, focused lint and read-only real-manifest check passed after receipt hardening. Coverage includes stale hashes, live references, missing/duplicate/escaping paths, linked archive parents/receipt entries, receipt hardlinks, unmanaged receipts, destination collisions, retry validation, a link introduced after preflight, and rollback after move/publication failures. The earlier whole typecheck passed; final typecheck remains recorded separately by the root.

An independent reviewer found a P2 in the initial receipt writer: a pre-existing receipt hardlink caused an outside fixture file to be overwritten. The original failing evidence remains at `.scratch-pw/showcase-toy-storage-20261023/storage-receipt-hardlink-reproduction.json`. The fix validates the final output path before staging and publishes through an exclusive temporary file and atomic rename. Actual Windows hardlinks and junction receipt entries are covered; the Windows junction test does not claim a file-symlink reproduction requiring unavailable OS privileges.

Evidence: excluded `.scratch-pw/deployment-storage-20261023/{local-public-inventory,local-next-output,hd-reference-inventory,legacy-sprite-refs,package-fixture-result,retained-public-manifest,unit,unit-attempt2,unit-receipt-hardening}.json`. The original source files were not moved. This record does not claim a full application build, rendered behavior, independent approval or provider deletion.

## Provider usage and retention

[Vercel's storage documentation](https://vercel.com/docs/deployment-storage) distinguishes build/static output from regional Function bundles. It measures both in GB-months using each project's daily maximum. Removing obsolete output lowers future retained output and future accumulation; it does not refund already accumulated daily maxima, CPU or memory time. A source-file delta is not a measurement of provider allocation or immediate quota reset.

[The optimization guide](https://vercel.com/docs/deployment-storage/optimize) recommends comparing the same team, projects and date range. Usage identifies high-storage projects, while deployment Resources identifies static files and bundles. The current user's screenshot shows the 10 GB / 10 GB storage warning; this lane did not obtain a fresh authenticated Usage reading.

The project's prior recorded retention policy is one day for all four states; the current connector's project summary omits this setting, so it was not freshly verified. [Retention exceptions](https://vercel.com/docs/deployment-retention) still retain Hobby's latest three deployments, three Ready productions, production aliases and active branch previews. Automatic evaluation is asynchronous.

The newly connected Vercel tool successfully read this project's metadata using its existing default connection scope. Passing the same discovered team ID explicitly returned 403, while the same project ID without that extra selector returned 13 Ready main-production deployments. An older-page request returned zero. Current production `bf980b810621d433e4dcdf26918b084da0edda14` and prior healthy `a749c7d66be33eeef3420585847340af0c8b966e` remain protected. The remaining 11 had no project alias and were not marked rollback candidates. They are a proposed deletion list, not deleted deployments. Four aliases were listed: three point to current production; one historical alias points to an ID that returns 404 and remains untouched.

The observed releases' Git source public files total 3,707,324,599 bytes: current 185,758,399 and the previous 12 at 293,463,850 each. This is a source-only sum, not a provider storage/charge measurement, and does not include or establish the other projects' usage. The file-tree endpoint returned 404 for the Git deployment, build-log access required additional team scope, and billing charges returned `costs_not_found`. Missing cost data is not zero usage. The connector exposes no observed per-project Deployment/Functions Storage usage result in this lane.

Purpose-limited receipts are `provider-inventory.json` and `provider-source-size-estimates.json` in the same excluded evidence folder. No provider deployment, alias, policy, paid plan or credential was changed. Any cloud deletion requires the current owner's confirmation of the exact list under the latest instruction.

The connected tool inventory currently has no deployment deletion operation or retention-policy update field. An existing-CLI check found no Vercel executable in PATH, this project or the existing npm global installation. Therefore no CLI authentication request was made: this is missing tooling, not a demonstrated account-authentication failure. No package download, login, token extraction or deletion was attempted. The connector's successful read access does not establish CLI authentication or deletion capability. Direct cloud cleanup remains pending that concrete capability and the latest human confirmation; the code/package reduction does not depend on it.

## Authorized CLI cleanup and current follow-up

The owner subsequently explicitly requested CLI installation and old-deployment deletion. Vercel CLI65.2.0 was installed globally, without a project dependency or lockfile change. Its device authorization completed successfully: the CLI logged `Success! Logged in.` and returned the intended scoped project. The owner's later device-page code error arrived after that successful login; no additional authentication was required.

Fresh project/deployment/alias metadata revalidated the exact11 old unaliased/nonrollback IDs. The actual scoped `remove` command used `--safe --yes --non-interactive`, exited0 and reported11 removals. The post-list retained the protected productionbf980b81 and rollbacka749c7d, plus a newly concurrent14fdd9c0 build, which was not touched. No project, alias or retention policy was deleted or altered. Sanitized before/after metadata, exact invocation and actual CLI output are preserved locally in `.scratch-pw/deployment-storage-20261023/{authorized-before-delete,delete-invocation,after-delete-11}.json` and `cli-delete-old-11.log`.

The CLI usage query for the current billing period returned unavailable costs, not zero usage. Neither11 deletions nor51,717,773 raw output bytes establish a provider-billed GB reduction; already accrued GB-month is separate. No CPU or memory refund is claimed.

The follow-up adds three generated curtain WebP assets totaling11,430B. Independent current-source checks preserved all613 prior source/Git/package hashes and resolved the current67 sprite/radio URLs plus3 curtain URLs, with no archived runtime reference. Current public source is616 files/185,769,829B; unchanged archive186 leaves430 files/134,052,056B by measured inventory projection. This uses the already verified separate packaging fixture plus exact new-file accounting, not a new remote deployment measurement. Evidence: excluded `.scratch-pw/showcase-curtain-20261023/review-boundary-package.json`. Current native failures and follow-up release remain in the active plan; this storage record is not a UI release approval.

## Owner recheck on production8c59f40 — 23:32 KST

Fresh connected provider metadata lists four current VIC deployments:8c59f401,14fdd9c0,bf980b81,a749c7d. All11 original deleted IDs remain absent.8c59f401192ce12f03f40430ed41ce260a897533 is Ready and owns all three main aliases. This recheck changed no provider resource. The team has three projects; the two other projects each list three deployments. Their deployment contents were not inspected or deleted.

The current billing-cycle CLI usage and project breakdown both returned unavailable billing data. The authenticated dashboard Usage value was not obtained through the connector; current GB and the account-specific cause of the remaining warning are therefore unverified. The documented daily maxima/GB-month aggregation explain why deletion does not retroactively erase previous usage, but do not prove this account's exact warning cause or quota recovery. Do not promise an immediate reset or a particular GB reduction.

The new cord is **not deployed**. All three new public asset URLs on the main production domain return404. The actual8c59f401 Git tree contains neither those files nor the output preparer; its prebuild does not call the new packaging stage. Both the cord and51,717,773B output reduction remain local, pending current UI verification and human push confirmation under the latest owner instruction. The previously reported11 cloud deletions are already real and independent of that unreleased code.

Local bounded evidence: `.scratch-pw/deployment-storage-20261023/{provider-recheck-8c59,public-curtain-8c59-recheck}.json`, current-cycle/project CLI logs, and the original deletion invocation/output. No raw authentication material or operational application data was collected.

At23:34KST the owner reported the currently displayed value as10.01GB/10GB. This is owner-observed display evidence, not a successful CLI/API measurement. The selected date range and per-project/metric breakdown were not supplied. Quota recovery is not established; no further unrelated project or protected rollback deletion is inferred from that rounded0.01GB overage.
