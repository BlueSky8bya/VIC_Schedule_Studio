# Accepted broadcast / insights improvements — 2026-10-24

User adopted both observed proposals and authorized implementation, actual UI verification, independent review and deployment. Base: adb467e956023c0a7e334d6ed7f2322120007e5b. Discovery: local `.scratch-pw/site-daily/broadcast-insights-ideas-20261024/report.json`.

## Scope / contracts

1. `broadcast:confirm-discard-nonempty-board`: guard human close requests when ink, sent cards/images or recoverable meaningful history exists. Empty/tool-only/empty-layer boards close immediately. Keep selections' Escape priority, opaque public-DTO board, no persistence and empty-on-confirmed-reopen. Shared child close request handles X/Escape; parent browser-back guard restores its consumed overlay history entry on cancellation. Forced preview/authority teardown stays unconditional.
2. `insights:keyboard-daily-broadcast-values`: one keyboard entry into the existing shared chart; arrows/Home/End inspect dates, visible focus and named date/value, preserved pointer/touch behavior. Keep future/empty/KST semantics and monthly text alternative. No date drilldown, new data collection, API/DTO/storage/dependency changes.

## Verification / release gates

- Type/lint/units/build; one immutable credential-free snapshot, exact selected Playwright cases, preserve original failures and source/build receipts. No full200 or living-AI claim.
- Actual owner/developer preview drawing: empty close, ink cancel/discard/reopen, selection priority, back/cancel/history, undo/redo, card/image/hidden content. Shared chart: public/preview/owner/developer, keyboard boundary dates and empty/future/month lengths, pointer/touch timer interplay and tooltip edge.
- G22: audit fixed labels through both activity timeline and least-used views; no date/value/content metadata or new telemetry. Existing analytics automation guards remain.
- Non-author review of role/boundary/KST/UX/actual evidence before integration. Commit/push only scoped reviewed files; existing Git production integration; exact deployed fullSHA and public interaction checks. Real login/RLS/broadcast hardware/screen-reader voice remain distinct and unverified.

Status: implementation/local gates and independent review complete; authorized Git production release gate approved. Exact production outcome is recorded separately in primary site-daily state and `.scratch-pw/site-daily/accepted-broadcast-insights-20261024/release.json`; this document alone is not deployment proof. Original failed attempts remain preserved there and under native receipts.

## Local evidence

- Final18 scoped proofs:16 fresh actual UI +2 same-build/same-test verified G22 reuse. Result `native/2026-10-24-1792840779359-9cae36d7/result.json`, SHA256 `8d4bdc3fe808272163f02815d11bfd7e640f47cbbdc72a949abb2657ae95923e`, BUILD_ID `zfPw8Ujnpsa_pu3PPb42P`. One compile; related test-only corrections reused verified compile bytes.
- Full units6993/6993 with workers2, type/lint/build/harness passed. Initial parallel art-catalog timeout remained original; same18 tests passed isolated without changing the timeout, and final full units passed. Initial harness budget exceeded after the current-state addition; shortened this task's link only, final8188/8192 bytes.
- First UI report9P/3F/2interrupted/4unrun and second16P/2F remain failed. Corrections were fixture/oracle issues: existing checkbox role, marquee selection, exact inner drop target/coordinates, owner security read blocked and explicitly stubbed unavailable, mobile's existing accessible entry name and reload overlay state. No product input changed after compile. The first stopped report has a global reporter error and is quarantined from case-history import; its compile receipt is separately verified. Original videos/traces/results are preserved.
- G22: actual pointer keep + keyboard confirm each emitted one fixed action with null metadata under an entirely intercepted synthetic loopback collector. Both developer timeline and least-used lists rendered the new shared labels. Daily chart inspection adds no telemetry, date, value or content metadata. Existing automation guards remain.
- Independent source review found capture shortcut/paste, portal and focus risks before integration. Fixes and corresponding actual cases passed. Normal video evidence is preserved; selected-frame/source/UI review is not a claim of whole-video expert36 review. No real-login/RLS/hardware/screen-reader voice coverage.
- Fresh non-author native check on the same verified immutable build passed X→confirmation→keep,1690 ink pixels unchanged, focus restored,28 served/local chunks matched, browser errors/unexpected requests/writes/live reads0. Source/build hashes stayed unchanged and the owned server closed. Independent report: local `independent-review.md`; actual result SHA256 `ebd5eed39f96bead2c2a1e62ae397a853f63ac2bd5527bbc380ccf71eea215ee`. Review approved integration before release.
