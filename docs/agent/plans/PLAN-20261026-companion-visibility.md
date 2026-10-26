# Companion recurrence diagnostics and recovery — 2026-10-26

Current authority: the owner explicitly asks to automatically record a future missing companion, distinguish intentional schedule hiding from offscreen/lost support, find the cause and recover. The 2026-10-25 adopted-scope mandate covers implementation, applicable checks, independent review and exact release confirmation. The original disappearance remains unconfirmed; synthetic failures verify the new handling, not the historical cause.

## Implementation

- Reuse the shared PC viewer/studio/preview controller, actual paint/geometry lifecycle and existing measured landing paths. No art, mobile mount, server/API/auth/data changes.
- Record only finite coarse geometry and fixed semantic categories locally, with bounded entries/retention and safe storage failure. Never record event/platform IDs, titles, bodies, account/session identity, URLs, DOM text or learned traits. No upload and no human activity analytics for autonomous diagnostics/recovery.
- Treat schedule hide, folded home, modal/showcase/premiere, hidden tab, deliberate input, startup/month handoff and graphics/motion ownership as explicit exclusions. Preserve normal same-column gravity. Escalate a sustained unintended missing state through a bounded measured recovery; do not unhide invalid geometry or run an idle poller.
- Provide opt-in local diagnostic export so recurrence evidence can be read after reload without requiring the user to catch it live.

## Verification and release

Use injected offscreen/lost-support cases and native normal interactions on production-build fixtures, intercepting writes. Verify classification → bounded local record → safe recovery, deliberate-hide exclusion, ownership/cancellation, storage denial, retention/size limits, viewer/studio parity and no analytics/network writes. Run focused units, typecheck, lint, build, harness and independent role/boundary/UX/QA review. Then scope commit/push and confirm exact CI SHA, Vercel READY/alias and public readback.

Local implementation and validation complete:219 focused tests, typecheck/lint/build and9 distinct production-build rendered scenarios. Independent source review resolved malformed-storage persistence and test-request boundary findings; rendered review preserves original precondition/observation failures. [Contract and evidence](../verification/COMPANION_VISIBILITY-20261026.md). The original reported cause remains unconfirmed and is monitored through the new local mechanism.

Source run: `C:/Users/im917/.codex/vic-pipeline/runs/20261026-companion-visibility`. Exact scoped commit/CI/provider/public outcome is selected there by `release-confirmation.json` only after actual confirmation. No pipeline runtime policy, server API or production DB changes.
