# Build commit badge

Date:2026-10-18 KST. Status:deployed correction verified.

## Request and observed cause

The badge must show the previous seven-character commit string rather than `dev`. Actual authenticated production Chrome still showed `35dd86a`; this report does not establish a production regression. The locally built Next configuration did contain `APP_COMMIT=dev` despite a valid Git HEAD, because `next.config.ts` used only `VERCEL_GIT_COMMIT_SHA` before its fallback.

## Correction and boundaries

Resolve valid full revision metadata at configuration time: Vercel, explicit APP_COMMIT, GitHub SHA, then local Git HEAD. Validate object IDs, avoid shell interpolation and bound the local command; source archives without either metadata or Git retain the honest unknown-development fallback. No invented revision, new client request/poll, route/API/DTO/permission/KST or dependency change. Existing badge text/copy/placement and mobile exclusion remain shared and unchanged.

Unit tests cover provider precedence, invalid/blank metadata, local Git lookup and missing-source/error behavior. The existing production-build header test now asserts an actual short hash and native copy against the compiled full metadata; simply accepting the current label allowed `dev` to pass previously.

The separate companion research request is advice only. No new pet behavior, model, asset or server work is authorized by discussing those ideas. Historical bug summaries must retain their actual scope and remaining real-hardware/RLS gaps.

## Verification

Initial unit/lint checks passed, but the first production build caught the helper's environment Pick type requiring keys absent from the process dictionary. Optional weak-type and Next-augmented ProcessEnv variants also failed the direct typecheck. The final parameter is a read-only string/undefined dictionary; selection/execution behavior is unchanged. Independent review also reproduced one test portability failure when the real temporary Git repository used SHA-256; its actual-HEAD assertion now accepts both40/64 formats, matching the production contract. Failed logs are retained locally rather than reported as shipping success.

Final product build `I-s7FeZi_v7c2b-x0Gbf4` without provider metadata compiled the actual local HEAD `35dd86afcd80309dc33688f2dfe742e69cde21c8`. Full unit212 files/2,183 tests, full lint, production build and post-build typecheck PASS. Independent review found no remaining issues; child-process-only SHA-256 focused tests15/15 PASS. Harness265 PASS.

All8 native production-build header cases passed in55.1s: owner/developer wide/light, compact/dark, zoom, native copy/readback and preview/button/Back return, plus mobile/coarse agenda metadata exclusion. The five desktop cases require a real seven-character hash matching compiled full metadata. Root visually inspected the actual final fixture screenshot with `35dd86a` at bottom-left; there are no intentional layout or baseline changes. The evidence filename originally omitted describe context, causing two owner agenda artifacts to share a name; adding that context and rerunning preserved8/8 PASS in54.4s with8 distinct proof files, page errors0 and intercepted mutations0. Typecheck and changed-source ESLint passed again. Results are `.scratch-pw/chrome-103/` and `.scratch-pw/102-studio-header/I-s7FeZi_v7c2b-x0Gbf4/`. These local cases do not replace actual OBS/RLS tests.

## Deployed verification

Commit `3c6dfff381f8617fa2f1306e4cf836a92f3bce9b` pushed to main. [Remote quality39094977750](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39094977750), job117579429154, completed all13 steps successfully. [Vercel deploymentCK5AaxyxwKW7upwNz1FH3zkiTPmT](https://vercel.com/bluesky-s-project3/vic-schedule-studio/CK5AaxyxwKW7upwNz1FH3zkiTPmT) succeeded.

At2026-10-18T03:52:11Z, production `/api/soop-live` returned200 and the exact full SHA above. Public clock200/no-store, warm204, anonymous developer401/error-only/no-store and fixture nonexposure all passed. The fixture uses a streamed404 fallback in an HTTP200 shell; do not misreport it as transport404. Actual authenticated developer Chrome after reload showed `3c6dfff`, matching its accessible copy label, fixed outside the header at x16/bottom gap15.56 under existing zoom. After ordinary hydration, one visible home launcher and companion remained. A settled full viewport screenshot was inspected. Original November/right-side folded rail/preferences retained; no schedule, heart or role mutation and no viewport override. Local evidence: `deployed-canaries.json`, `actual-ui.json`, `remote-release.json` under `.scratch-pw/chrome-103/`.

The scoped fixture server3116 was stopped. Post-release bookkeeping remains local to avoid a second documentation-only deployment; user art/unrelated drafts are untouched. No new companion behavior was implemented by the research/advice portion. Actual broadcaster OBS/SOOP hardware, genuine-login/RLS and quota-effect evidence remain separate.
