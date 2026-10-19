# 125 — artboard metadata and deployment inputs

2026-10-19 KST. Scoped implementation record; provider cleanup and build execution remain root-owned. The final section records the root's subsequent local build measurements.

## Change and conservation

`lib/ambient/art-files.ts` now reads a generated JSON inventory instead of scanning `public/ambient/art` during a request. `scripts/generate-ambient-art-metadata.mjs` runs before `npm run build` and `npm run dev`; `npm run art:metadata` refreshes it explicitly and `--check` detects drift without writing. The script reads public PNGs only and never reads source-art archives, credentials or DB state. Missing directories, invalid PNG headers/dimensions and linked paths fail before replacing metadata.

All slot identities, slot ordering, variant ordering and `{file, bytes, w, h}` records retain filesystem parity. Missing slots remain empty. Responses return independent records. The cache-bust `stamp` deliberately changes from maximum filesystem mtime to a deterministic 48-bit content digest: fresh checkouts produce the same value, while same-size byte replacements change it. It is not a date or release-authorization clock.

No PNG/runtime asset, role check, public DTO, authentication, KST boundary, health/cron cadence or provider setting changed. The developer-only artboard and production-disabled fixture gates remain in their existing routes. No new control or human action exists; G-22 timeline/least-used semantics are unchanged and generation is not an analytics event.

## Measured input and expected output

The pre-change local Next NFT inventories contain `public/ambient/art` in four routes:

- `/studio/ambient-art`
- `/studio/ambient-art/[slotId]`
- `/visual-fixture/ambient-art`
- `/visual-fixture/ambient-art/[slotId]`

The directory contains **111 PNGs, 148,678,737 bytes**, plus a718-byte README: **112 files, 148,679,455 bytes total**. This corrects the earlier shorthand “112 PNGs.” Those four pre-change traces were about150.6MB each; ordinary poster/studio traces were about3.7–3.8MB. These are raw local trace references, not measured Vercel storage charges or proof of four separately billed copies.

The generated inventory is **12,238 bytes**. The intended output is that each of the four artboard functions uses the small metadata snapshot (Next may inline the JSON into its server chunk) and its trace contains no `public/ambient/art` files; all public PNG URLs remain available. The root's later local build confirms the trace change below. Removing runtime filesystem imports does not establish a measured CPU/memory saving.

## Deployment exclusions

The new `.vercelignore` excludes source-art archives, documentation, tests, agent/workflow guidance and local scratch/report directories from deployment inputs. It explicitly preserves credential/local-file exclusions. All application code, all `public` runtime assets, generated JSON, package/lock/config files and the complete `scripts` directory remain included, including `scripts/build-commit.ts` and the new generator. Git/local originals are retained; this rule deletes nothing.

Root subsequently added root-only `/.codex*/`, `/.vscode/`, `/.scratch*/` and `/preview-*.png` exclusions so CLI uploads also omit attachment/work folders and local preview screenshots. A fresh Gitignore-compatible matcher check preserves16 actual required build/runtime files, the11 original exclusion examples and7 new exclusion examples. Three nested runtime/source examples (`public/preview-home.png`, `lib/.codex-future.ts`, `app/preview-route/page.tsx`) remain included, confirming that the new patterns are rooted rather than excluding similarly named application resources. This is a local pattern check, not a provider-upload observation.

The tracked source-art inventory was599,946,733 bytes. It was not included in existing Function traces, so excluding it reduces deployment input/upload rather than proving a Function CPU/memory or output-storage reduction. Actual provider packaging and source exclusion logs remain to be checked. Deployment/Functions Storage and already-consumed Fluid CPU/GB-hours are separate metrics.

## Verification and limits

- Generator write and subsequent `--check`: PASS,111 PNG records, deterministic snapshot.
- Focused new metadata7 and existing ambient-manifest22 units: **29/29 PASS**, two files, one worker.
- Owned loader/generator/unit lint and generator syntax check: **PASS**.
- Gitignore-compatible matcher check:16 required build/runtime paths included,11 source/credential/evidence paths excluded. This is a local rule check, not an actual provider-upload measurement.
- Agent harness: **PASS**,315 documents, brief7,096 UTF-8 bytes at this scoped run.
- Filesystem parity, missing-file removal, response isolation, mtime independence, same-size content invalidation, read-only drift rejection, invalid/missing source failure and linked-output rejection have focused coverage.
- Typecheck, full lint/units, build, rendered route behavior and provider/deployment checks remain root-owned. Later root build measurements are separated below from this lane's focused verification.

## Root's subsequent local build measurement

Root completed production build `EvOPphFWc5NQdeAbl6tL_` and reported typecheck/full3,037 units passing. This lane read the preserved `.scratch-pw/companion-125/vercel/nft-delta.json`; it did not run another build.

| Function trace | Before bytes | After bytes | Public PNG references before→after |
|---|---:|---:|---:|
|studio ambient-art|150,613,602|1,956,156|111→0|
|studio ambient-art/[slotId]|150,597,705|1,940,259|111→0|
|visual-fixture ambient-art|150,612,219|1,954,773|111→0|
|visual-fixture ambient-art/[slotId]|150,596,319|1,938,873|111→0|

Each local trace excludes the same **148,678,737 PNG bytes** and shrinks by148,657,446 total referenced bytes. These are build tracing measurements, not four separately billed storage copies, measured upload bytes, allocated Function memory or consumed Fluid CPU. No Vercel CPU percentage or billing reduction is established. The original before/after inventories and delta remain preserved in scratch; deployment behavior and provider billing still require their separate root-owned checks.

No production/provider operation, deployment removal, browser/server execution or protected-art write occurred in this implementation lane.

## Root's actual deployment verification

Release `a0c44ea79edb0b4d177f2f99a9fec04182f244d8` is Ready as Vercel `8QmowR8GezU6sjtdhdHbbBXtuB8v`. Root compared the Resources console with prior124 `HPkeLeSMuhZdG6h2RPtcHQA4GZHp`: `/studio/ambient-art`, its slot route and the two fixture equivalents each show **149MB before /2.23MB after**, ICN1/Node24.x. This verifies a provider package reduction, separate from local raw traces and accrued billing/Fluid CPU. Both screenshots are preserved in excluded125 evidence; current/rollback Ready states were observed. The original public files remain committed. Actual Git source-input exclusion bytes and equal-period CPU/memory/storage charges are still not measured. [Shared release proof](COMPANION_HOME_CURTAINS_TOYS-20261019.md#release).
