# Detail metadata balance verification — 2026-10-26

Adopted scope: `design:detail-metadata-balance`. Current implementation uses one public detail metadata strip: tag chips wrap within a flexible left column; existing rank keeps its intrinsic width at the right. No values/controls or server permissions are added.

## Actual local evidence

- 85 relevant unit tests pass: public DTO/static boundaries, rank source, Google title/date/details, action timeline/least-used labels and keyboard/pointer capture. Typecheck/lint pass on final source. No new action targets or payload fields.
- Final scoped12 fresh PASS,0reused cases/0fail/0not-run. Receipt `2026-10-26-1793012967581-fb9e7437/result.json`, SHA256 `626b01cae9e28df68740d9ba6e197930c164b79d68694be755ff98ef43ef96e6`. BUILD_ID `DbiVIbteM_DrnyQXJ0Pwj`, product key `9cc304a933cd09358062b8def9ef422f24eec846f1e3c2ed41add2c9fd4f14de`.
- 6 viewer/preview paths at320/390/1440 test title/body/tag/rank order, native Google keyboard activation to a local sink, trap/X/Esc/focus return and retired navigation absence. Four additional shared-preview cases at320/390/1440/1920 each execute13/long/only-tags/only-rank/neither/one combinations in light/dark, with exact content, tag wrapping, nonoverlap, no horizontal overflow and Google/keyboard reachability. Viewer desktop verifies all4 rank labels; one case retains support/teaser exclusions.
- 30 extracted PNGs and per-case observation JSON, all original normal-speed UI videos and source/build/guard/process receipts retained. Current implementation/test bytes match the final frozen snapshot. These are UI interaction observations, not companion living-AI or full-certification observations.

## Preserved failure and follow-up

First attempt `2026-10-26-1793012415149-355e739d` had11PASS/1timeout, SHA256 `1631af1dd94d18bbb5ea571fcd99cfa52be537c5495fec9b12bc486421692b2f`. A78-character synthetic tag in the existing desktop filter used nowrap, enlarged its grid, and blocked a calendar click after the long-detail cases. This was a related filter layout defect, not detail tag/rank collision. Preserve original trace/video/screenshot/report. The filter now wraps long names inside its existing cells; no new control/telemetry.

Second product attempt `2026-10-26-1793012821547-6393ccf8` passed12, SHA256 `319e742d4502d5cb33f2b6730e45d30c34e102a91981786687cc41e4afbafbb1`. Independent review then asked to compare the filter group against its fixed panel, not just items against that group. Only the test oracle changed, so final attempt reused the verified second compile and executed all12 anew. No cross-product PASS reuse and no original report rewriting. Final1920 group26..366 fits actual panel16..376; native pointer opening also passes.

## Release and limits

Final independent review, exact commit/CI/provider/public confirmation and small report are recorded in durable run `C:/Users/im917/.codex/vic-pipeline/runs/20261026-detail-metadata-balance`; the latest deployed source and completed registry entry live in primary `.scratch-pw/site-daily/state.json`. Local product checks alone are not deployment proof.

Full certification=false, normal36=UNVERIFIED. Stress13/78-character cases are robustness fixtures, not user-frequency evidence (current ordinary editor limits are smaller). Shared preview runs do not establish genuine login/RLS/physical devices or external Google-account saving. The separate replay-title redesign is unadopted and unchanged.
