# Adopted month-selection and offline hints — 2026-10-28

Human adopted ideas1 and3 from the PC calendar/connectivity discovery and explicitly requested studio confirmation, matching surrounding design, native interactions, independent review and deployment. Idea2, adjacent-month labels, remains unimplemented. Original proposal, discarded copy candidates and failed studio preconditions stay preserved in `20261028-pc-other-discovery-r2`.

## Scope

Reuse `useCellRangeSelect.clearSelection` for a real viewed-month identity change. Put the optional reset identity in the shared hook so viewer, preview and studio use one mechanism. Reset its selected indices, Shift anchor, active drag listeners/body class and click suppression before painting the new month. Same-month renders retain selection; consumers without the identity option retain their existing behavior. Preserve date keys, keyboard roving versus global month commands, gestures and serialized writes. Verify the studio with actual empty-cell drag targets, avoiding support ribbons/cards; a missing starting selection is a fixture precondition failure, not an observed product outcome.

Keep the existing offline badge, warning palette, position, typography, aria-live and reconnect toast. Replace the false public-only fallback with the adopted short save/update hint. If a public snapshot timestamp is known, identify it as public-snapshot storage time rather than implying an editor write was synchronized. Browser online/offline is a hint, not proof of server reachability or save success. Do not disable operations or change existing routing/cache/queue behavior based on that hint.

## Boundaries and activity audit

No DTO, auth, permission, KST/date value, teaser, database, dependencies, models, analytics collection or original assets change. Automatic selection cleanup and network/snapshot status are not new human action targets. Existing month controls and keyboard semantics keep their fixed G-22 targets; no selected dates, text, offline snapshot details or automatic clears enter activity metadata. Public content remains server-sanitized; synthetic fixture roles do not establish real-login/RLS coverage.

## Verification and release

Preserve original diagnostic reports. Reuse a hash-verified unchanged baseline build for reproduction; build once after final product inputs settle. Check actual viewer/studio/preview month transitions, Arrow commands, pointer/month picker/today/history, Shift selection and same-month preservation; distinguish roving grid focus from global shortcuts. Cover offline with/without public-snapshot age, reconnect and both themes without operating writes. Run relevant units/type/lint/build/harness and non-author boundary/UX/QA review. Commit only adopted source/tests/this topic document with the session trailer, preserve user-dirty CURRENT_STATE, then confirm exact CI/provider/public fullSHA. No full200 or storage-maintenance repetition.

Durable authority and original evidence: `C:/Users/im917/.codex/vic-pipeline/runs/20261028-adopted-calendar-offline`. This record is scope/evidence, not a grant of human authority.
