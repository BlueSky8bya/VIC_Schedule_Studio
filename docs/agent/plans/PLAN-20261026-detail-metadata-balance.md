# Detail metadata balance — 2026-10-26

User adopted `design:detail-metadata-balance` in the current chat: title → full-width soft strip (wrapping tags left, rank right) → body → Google action. Many/long tags must not overlap rank. The separate replay-title proposal remains unadopted.

## Scope and design

One existing `PublicPoster` detail implementation serves viewer desktop/agenda and studio viewer preview. Move existing public tag spans and the existing `heartTier` label into a shared metadata strip. Reserve the rank's intrinsic width and let tag chips wrap in `minmax(0,1fr)`; long chip text wraps within its own column. Omit absent groups and omit the whole strip when both are absent. Preserve the full title, tag colors/primary marker, rank semantics without counts, body, Google link and existing interaction/focus/history/teaser/support rules.

No server loader, DTO, role, KST, database, telemetry, dependency or preference change. G-22 audit: layout-only spans introduce no human action. Existing Google/close/tag/interest targets, pointer/keyboard capture and both developer views remain unchanged; existing readable-target unit coverage is rerun. No tag/title/rank values are added to action metadata.

## Verification plan

- Typecheck/lint, public DTO + heart-tier + Google event + action-catalog units, harness and one immutable product build.
- Existing viewer/preview detail paths at320/390/1440; actual Google keyboard activation to a local sink, X/Esc/focus return and retired controls absent.
- Shared preview stress cases at320/390/1440/1920 in light/dark:13 tags, long unbroken tag, only tags, only rank, neither, one tag. Assert exact tag content, column separation, wrapping, body order, no horizontal overflow and trap/Esc.
- Four rank labels on viewer desktop, support and unreleased teaser exclusions. These are credential-free Chromium fixtures, not genuine login/RLS/device or Google-account saving tests. No screenshot baseline exists for these assertion-driven cases; preserve before/after captures and original failures instead of inventing a baseline update.
- Independent non-author boundary/UX/QA review before commit/push. Confirm exact remote CI, Vercel production SHA and public interaction. Full certification remains false; no normal36/living-AI claim.

## Current status

First actual attempt:11/12 passed;1920 dark reached rank-only after its many/long cases but the legacy filter's nowrap tag text enlarged its grid and intercepted the calendar click. Preserve receipt1631af1d, video, screenshot and trace. This is an existing related tag-display defect exposed by synthetic long labels, not a detail overlap. Permit long labels to wrap within their existing filter grid (`min-width:0`, normal whitespace, anywhere wrap); no new control or analytics. Add actual filter bounds assertions and rerun the scoped12 on the changed product. No prior case PASS is carried across that product change.

Final local gates pass:85 units/typecheck/lint and scoped12 fresh UI PASS on verified BUILD_ID `DbiVIbteM_DrnyQXJ0Pwj`. Independent source/UI/video review found no product blocking defect; the fixed-panel oracle follow-up passes the final receipt626b01ca. Detailed original evidence, formal review and exact commit/CI/provider/public release confirmation live in durable run `C:/Users/im917/.codex/vic-pipeline/runs/20261026-detail-metadata-balance` and primary daily state. Local gates alone do not certify a deployment. Final results belong in [verification](../verification/DETAIL_METADATA_BALANCE-20261026.md), not accumulated startup history.
