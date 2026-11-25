# Public policy history removal — 2026-11-26 KST

Status: Completed

Latest direct owner request supersedes the earlier public comparison disclosure: remove the entire ‘처리방침 변경’ section, table and navigation from the public policy for viewer/owner. Developer history remains behind the existing actual-developer server check. Remove the terms link to the retired section and its accompanying comparison notice. Current processing descriptions and existing rights/contact sections remain.

Scope: static legal routes and one developer help line; no DB/schema/authorization/data-retention change. No role detection added to public static pages. G-22: removed control emits no new actions; retain its historic fixed label so both action timeline and least-used features can still describe old records. No new analytics.

Verification: typecheck/lint/tests/build, actual built static privacy/terms in 1440/390 viewports, absence from HTML/RSC/navigation, existing developer gate rejection for anonymous/viewer/owner/uncertain developer and positive synthetic developer. Keep before/after actual rendered pairs in runs/20261126-public-policy-history-removal and preserve final report in Hub. Real owner Google login/RLS is not certified by static-page or synthetic-role checks.

Recovery: scoped source revert; no data operation. User already authorized commit/integration/push/Workers release for the ongoing work. Primary user changes remain untouched; worktree C:/Projects/VIC-worktrees/20261126-privacy-public-history, branch codex/privacy-public-history.

## Verified candidate

Production build exit0 with679 product source hashes unchanged across the build, typecheck/lint exit0, full490 unit files/7,495 PASS/1skip. First bounded activity test found the retired-control flag missing; fixed and passed in the final full run. Harness463documents PASS. Independent non-author role/boundary/UX/QA source review: No issues.

Actual deployed baseline and actual built static Next pages rendered at1440/390: privacy/terms page errors0 and overflow0; privacy history and the retired terms link absent. Built privacy/terms HTML and RSC also contain none of the retired history headings/table/link. Four same-page/size/theme before/after pairs: [report](../../../runs/20261126-public-policy-history-removal/report.html), [scope](../../../runs/20261126-public-policy-history-removal/verification.md). Baseline f9104830 legal sources equal the deployed f3fa2efc sources. Actual Google login/RLS remains unverified; existing actual-developer server action is unchanged and synthetic gate tests pass.

## Released — 2026-11-26 KST

Feature commit65e2f8e0b405f97bb5bf443c4bdfdb0c60b4b3a1 pushed to main; quality run45694564105 success. Workers versionbe84af80-f521-4e1a-8d32-817963027936 served the new build. Actual anonymous production privacy/terms at1440/390 show no policy-history heading/table/navigation/retired link, no overflow or page errors. Public production HTML/RSC also excludes those retired tokens. Actual-developer server authorization remains unchanged; synthetic gate evidence is distinct from Google/RLS.

Final live before/after report and release/cleanup evidence preserved at C:/Projects/context-hub/out/20261126-public-policy-history-removal-01a21454/. Candidate files in runs retain their original validation scope. Primary user changes were untouched. Final worktree cleanup result is recorded in the Hub release.json.
