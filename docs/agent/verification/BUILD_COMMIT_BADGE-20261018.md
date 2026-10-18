# Build commit badge

Date:2026-10-18 KST. Status:locally verified; correction release pending.

## Request and observed cause

The badge must show the previous seven-character commit string rather than `dev`. Actual authenticated production Chrome still showed `35dd86a`; this report does not establish a production regression. The locally built Next configuration did contain `APP_COMMIT=dev` despite a valid Git HEAD, because `next.config.ts` used only `VERCEL_GIT_COMMIT_SHA` before its fallback.

## Correction and boundaries

Resolve valid full revision metadata at configuration time: Vercel, explicit APP_COMMIT, GitHub SHA, then local Git HEAD. Validate object IDs, avoid shell interpolation and bound the local command; source archives without either metadata or Git retain the honest unknown-development fallback. No invented revision, new client request/poll, route/API/DTO/permission/KST or dependency change. Existing badge text/copy/placement and mobile exclusion remain shared and unchanged.

Unit tests cover provider precedence, invalid/blank metadata, local Git lookup and missing-source/error behavior. The existing production-build header test now asserts an actual short hash and native copy against the compiled full metadata; simply accepting the current label allowed `dev` to pass previously.

The separate companion research request is advice only. No new pet behavior, model, asset or server work is authorized by discussing those ideas. Historical bug summaries must retain their actual scope and remaining real-hardware/RLS gaps.

## Verification

Initial unit/lint checks passed, but the first production build caught the helper's environment Pick type requiring keys absent from the process dictionary. Optional weak-type and Next-augmented ProcessEnv variants also failed the direct typecheck. The final parameter is a read-only string/undefined dictionary; selection/execution behavior is unchanged. Independent review also reproduced one test portability failure when the real temporary Git repository used SHA-256; its actual-HEAD assertion now accepts both40/64 formats, matching the production contract. Failed logs are retained locally rather than reported as shipping success.

Final product build `I-s7FeZi_v7c2b-x0Gbf4` without provider metadata compiled the actual local HEAD `35dd86afcd80309dc33688f2dfe742e69cde21c8`. Full unit212 files/2,183 tests, full lint, production build and post-build typecheck PASS. Independent review found no remaining issues; child-process-only SHA-256 focused tests15/15 PASS. Harness265 PASS.

All8 native production-build header cases passed in55.1s: owner/developer wide/light, compact/dark, zoom, native copy/readback and preview/button/Back return, plus mobile/coarse agenda metadata exclusion. The five desktop cases require a real seven-character hash matching compiled full metadata. Root visually inspected the actual final fixture screenshot with `35dd86a` at bottom-left; there are no intentional layout or baseline changes. The evidence filename originally omitted describe context, causing two owner agenda artifacts to share a name; adding that context and rerunning preserved8/8 PASS in54.4s with8 distinct proof files. Typecheck and changed-source ESLint passed again. Results are `.scratch-pw/chrome-103/` and `.scratch-pw/102-studio-header/I-s7FeZi_v7c2b-x0Gbf4/`. Exact shipping commit/CI/provider/API/UI remain pending; these local cases do not replace actual OBS/RLS tests.
