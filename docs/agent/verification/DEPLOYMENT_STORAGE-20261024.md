# Deployment Storage follow-up — 2026-10-24 KST

## Current verification and limits

The existing authenticated Chrome dashboard supplied the missing project breakdown; no new login, token/cookie extraction or permission grant was used. The default **Last 30 Days** screen displayed **Deployment Storage 10.01 GB**, with VIC rounded to **10 GB**, soccer-tactics **1.46 MB**, and wak-schedule **0 B**. The same default period's **Functions Storage was 286.5 MB**, entirely attributed to VIC. Its visible date selector read `Sep 23, 오전 10:00 - Oct 23, 오전 10:00`; those UI labels are preserved as displayed, not relabelled as KST billing boundaries.

The explicitly selected today interval (`from=1792767600000`, `to=1792853999000`, 2026-10-24 KST) showed **1.31 GB** on the completed **00:00–01:00** VIC bucket. The next unfinished bucket displayed 0 B and is **not** evidence of zero storage. The recent hourly point is smaller than the default historical daily view; it is neither an instantaneous allocation measurement nor proof that the Hobby quota warning has cleared. Exact current provider bytes and billing GB-months remain unavailable. Do not report `10.01 → 1.31` as a reduction achieved by this change.

[Vercel's storage documentation](https://vercel.com/docs/deployment-storage) bills Deployment/Functions Storage using daily project maxima over time. [Hobby retention guidance](https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage) separately describes the 10 GB cap. An already accumulated maximum is not retroactively removed by deleting a deployment. Preserve the distinction between historical usage, a completed hourly stored-size sample, raw source/output bytes and actual provider allocation.

The exact CLI project target succeeds. The connector rejects explicit team-scoped metadata reads with 403; its auth expansion was not attempted. The official CLI API catalog exposes no separate Deployment/Functions Storage quantity endpoint. Prior failed cost/charges requests were not repeated.

## Retained output and protection

At 2026-10-24 01:21 KST, remote main and the public `/api/soop-live` build field were **00165c7fb3585fa6009c855c4c173d8e3868659c**. Provider production was READY at `dpl_HNqtRzmWmHXDU1rdxYamGD6GJmA5`, with the three current production aliases. Nine VIC deployments were returned with no next page. Recheck immediately before any release/deletion because another session is active.

Protect the current production, provider rollback candidate **b909d25239bb15786cb3704a39ee85d53a1e4945** (`dpl_HqnywQYSCJpDHGpNwHEqQGbukXke`), and the previously actually verified **8f1e2071b3950af4f610cdf838140869b88af63f** (`dpl_F1tfB2ix3mgmRmJwvZXjDU7ag29B`). Provider `lastRollbackTarget` is null; that is distinct from list `isRollbackCandidate`. A stale historical alias points to a different absent deployment and is left unchanged.

Fresh project metadata returns one day for all four expiration classes and `deploymentsToKeep: 10`. Do not infer that another duration reduction will solve this or automatically change the policy. The authoritative active alias map was checked: historical deployment detail `alias` arrays retain old assignments and are insufficient for deletion decisions.

The existing packaging reduction remains **186 files / 51,717,773 B**, already applied in cloud builds. It is not a new saving here. Current public output remains **430 files / 134,052,056 B**, before framework output. Its largest groups are active radio/audio **72,834,982 B**, ambient art **40,974,004 B**, home art **7,621,844 B** and HD art **6,866,518 B**. Runtime code constructs seasonal PNG URLs, so the large art is not safely removable from a basename search. No new asset exclusion or lossy compression was made.

The inspected representative production reports 93 Function output paths sharing seven digests, whose unique resource sizes sum to **8,474,878 B**. This is bundle metadata, not billing. Do not sum repeated route/RSC sizes as independent stored Functions. Normal functions use icn1; middleware has its existing regional fanout. Low measured Functions Storage makes changing regions a poor first target.

## Prevent repeated documentation builds

Commits **a9003a9e**, **b909d252**, and **00165c7f** each changed documentation or agent instructions only, yet each produced a READY production deployment. Their public packaging payload alone was **402,156,168 B** across the three builds. That historical amount has not been removed or reclaimed by this patch.

`vercel.json` now calls `node scripts/deployment-output/ignore-build.mjs` before install. It skips only changes entirely under `docs/`, `.agents/`, or exact root `AGENTS.md`, `CLAUDE.md`, `README.md`. Every other input builds normally. It compares the entire diff from `VERCEL_GIT_PREVIOUS_SHA` (the [last successful project/branch deployment](https://vercel.com/docs/environment-variables/system-environment-variables)), not HEAD's parent. Missing/invalid SHAs, same-commit redeploys, missing/shallow/divergent history, HEAD mismatch, errors and unknown paths continue building. Rename detection is disabled so moving an app file into docs still builds. No dependencies or product behavior changed. This introduces no UI controls or analytics events, so G-22 timeline/least-used views need no new event.

[ignoreCommand](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand) uses exit 0 to skip and exit 1 to build. First deployment of this config builds because config/scripts changed. To apply dashboard environment changes independently of code, redeploy the current commit or disable the ignore step in that redeploy. Docs-only pushes intentionally leave the public APP_COMMIT at the last runtime build. If the allowlist ever becomes a runtime/build input, revise the gate before using it.

Validation: scoped unit **22/22** (including real shallow/diverged Git fixtures, multi-commit runtime changes, unknown inputs and runtime→docs moves); typecheck; whole-repo lint; focused lint after the extra fixture; production `npm run build` with synthetic `.invalid` Supabase settings and no service-role key; real manifest `--check`; `git diff --check`. The synthetic build's public data loaders log their expected unavailable-data errors; exit 0 proves compilation/packaging, not a real DB response. Independent review accepted the implementation and first 5 gate cases; the sixth fixture subsequently passed. The first harness run exceeded the startup brief budget after a verbose state row was added; the row was shortened and the final harness run is recorded separately. No browser UI regression run was required for this build-only change. Actual Vercel execution of the gate remains pending authorized push.

## Additional deletion proposal — not executed

The following six READY deployments are outside the three protected revisions. Fresh list metadata marks each `isRollbackCandidate: false`, and none is the target of an active alias. Recheck those facts and use the CLI safe-removal guard immediately before any approved deletion.

| Source SHA | Deployment | Raw public output projection (B) |
|---|---|---:|
| a9003a9e51690228df944016a1e9b73c689383fb | dpl_CvVt3jVBwMQhDZteJcYBMoD6onWS | 134,052,056 |
| 7d2e4cf4e75e45bee8bec55345220ca7d751ea06 | dpl_H2w7SSNDZXdgKw4hcEi3qtbAeaKD | 134,052,056 |
| 8c59f401192ce12f03f40430ed41ce260a897533 | dpl_49V4DKMCmw2JyNPVFC8eZUccnDWb | 185,758,399 |
| 14fdd9c02a23e420bcef136f1ea512550ed51155 | dpl_AHTnbPQm74mX5bgBRYrxB5i4Gf2g | 185,758,399 |
| bf980b810621d433e4dcdf26918b084da0edda14 | dpl_5WnWx3Cxe2VixA3ppBZdpxMkKLdh | 185,758,399 |
| a749c7d66be33eeef3420585847340af0c8b966e | dpl_GXosmQmBWtvbdxD7fpu7M8bp9Afy | 293,463,850 |

Projection sum: **1,118,843,159 B**. This source-derived sum does not include framework assets, cross-deployment sharing, provider allocation or GB-months. It is not a promised 1.12 GB quota decrease. The six deployed versions would become unavailable for investigation/rollback; Git source, original art, local failed evidence and the protected deployments remain. Existing eleven deletions are separate completed work and are not repeated or recounted.

The proposal above was subsequently explicitly approved by the owner, including the six exact deployment deletions, latest-main push, deployed verification and worktree cleanup. The following execution supersedes the proposal's pending status.

## Authorized release and verification

At 2026-10-24 01:28 KST, fresh scoped project, deployment and authoritative alias reads confirmed the same production **00165c7f**, protected **b909d252 / 8f1e2071**, and all six candidates READY, unaliased and not rollback candidates. The guard repeated these reads immediately before executing the approved six IDs with `vercel remove --safe --yes`. Exit 0 reported **Removed 6**. The fresh post-list contained only the three protected deployments, and every approved deletion ID was absent. No alias, policy, source original, local evidence or other project was removed.

Remote main had not changed from **00165c7fb3585fa6009c855c4c173d8e3868659c**. A normal non-force push advanced it to reviewed commit **d347b4ac3aeeba4a47add1086ade5efd0f5f0cb7**, without changing the user's old local main. Cloud deployment **dpl_Hp45FzZ6y9XpgBwePXAbPfnC6KLL** reached READY with all three production aliases. Its actual build log ran the ignore command and printed `Deployment build: continue (deployment input changed).` The existing output guard still reported **430 files / 134,052,056 B**, **sourceOriginalsDeleted: 0**; the already completed 51,717,773 B packaging reduction was not counted again.

At 01:32 KST, public `/api/soop-live` returned HTTP 200 and the full **d347b4ac3aeeba4a47add1086ade5efd0f5f0cb7** build SHA. The rope, handle and collar static URLs each returned HTTP 200 with SHA-256 equal to their source originals. Provider production and active aliases matched. Four READY deployments remained, including all three pre-release protections. The initial 60-second inspect wait timed out while the build was still progressing; this was a wait limit, not a build failure, and the later READY result was verified.

This closing documentation update is intentionally a docs-only push to exercise the actual skip path after the successful code deployment. Its post-push provider state/log and final cleanup receipt are recorded in the Hub result `docs/handoffs/RESULT-20261024-vercel-storage.json` and the task's user-facing completion artifact. They must be checked before reporting that path verified; the pre-push text here does not assert a future PASS.

No fresh post-deletion Usage UI measurement was available in this execution. Keep **10.01 GB** as the last default historical display and **1.31 GB** as the separately timed completed hourly sample. Exact current bytes, GB-month effect and quota clearance are still unproven. The six-output raw projection **1,118,843,159 B** is not a claimed allocation or billing reduction. No re-login, permission expansion, paid change, tracking, production DB write or unrelated QA/cleanup was introduced.
