# Mobile agenda frame — 2026-10-26

L2 adopted scope: remove mobile tag-filter folding; frame dates and filter between measured notice/header and Today/Preview toolbar. Adapt to notice-free months, viewport/safe-area changes and 3 overlapping notices. Shared viewer, anonymous, studio and preview implementation. Preserve editing, links, role boundaries, KST and user work. No database writes.

Implementation: measured frame; separately scrollable dates and tag contents, fixed readable tag heading and Insights; local scroll navigation for today/search/detail. Clip content only so rail popovers escape. Saved desktop folding remains desktop-only.

Verification: required type/lint/unit/build/harness; production-build rendered role/notice/viewport/theme matrix; independent non-author review. Check geometry, footer hit targets, keyboard/focus and resize. Automatic tracking adds no activity; existing human filter/navigation labels remain.

Local implementation verified:120 related units, build/type/lint/harness,64 frame combinations and scoped28 browser cases (delta reuse recorded explicitly). Final compact/focus5 checks passed; minimum tag body46.234px, outer gaps8px, eight edit/add opener returns with zero geometry/scroll drift. Independent source review accepted. [Verification](../verification/MOBILE_AGENDA_FRAME-20261026.md).

Short viewport structural exception: full notice board stays in normal document flow above a minimum168px frame. Today/search/detail and focus reveal that frame before internal scrolling. Existing management opens the shared full-width tag modal. Mobile edit/add closing restores the exact opener without scrolling.

Remaining integration/CI/deployed confirmation is owned by the local release controller in `C:/Users/im917/.codex/vic-pipeline/runs/20261026-mobile-agenda-frame/`. Only an executed matching `release-confirmation.json` proves release; absence remains unverified. Fixtures do not prove physical devices or real-login/RLS.
