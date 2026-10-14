# PLAN-029 — Individual departures and card-to-screen continuity

Date: 2026-10-14 KST
Status: Deployed and verified — 40d2e1cb

The owner replaces PLAN-028 step 3's day-wide spatial dimming with individual, shuffled schedule departures. Keep all existing clock/data/security, default-ON, reduced-motion, 1840px geometry and developer-only rehearsal decisions.

- T−126…75: stable seeded shuffle of public event/support IDs; one departure slot per schedule, shared by its multi-day segments. Four restrained transform/opacity trajectories. No common opacity on date cells. New DOM/topology inherits the current score; rescheduling reverses it.
- T−75…68: only the premiere schedule remains; a small continuous lift anticipates handover. At T−68 the same measured card shell expands into the stage with shared `flipSpring`; card face crossfades into the large live countdown. Off-screen/missing source uses a short centered arrival.
- While the full stage is preparing/counting, other calendar schedules, support links, heart controls and day navigation cannot activate by pointer or keyboard. Preserve target access, settings and the persistent exit. Restore original inert/aria state on dismissal, OFF, reduced motion, deletion, rescheduling and topology changes. This is an interaction gate, not a data/permission boundary.
- Reuse the existing monotonic clock subscription; no additional HTTP, DB work, dependency or real-calendar fixture. Public titles/tags/time still arrive only after the existing server confirmation. Role/unlock/KST behavior does not change.

Verify seeded order/variants/timing, same-day and multi-day cards, desktop/agenda interaction gates and restoration, actual card-to-screen transition, interrupted handover, OFF/reduced modes, rescheduling and release regressions. Use production-build synthetic fixtures with writes intercepted. Run typecheck/lint, affected units, browser checks, build and memory harness; inspect rendered captures. Existing hardware/luminance/fanout gaps stay open.

Implementation and local validation complete: final production-build browser matrix 63 PASS, typecheck/lint PASS, focused units/document checks 74 PASS; full suite 1,084 PASS/8 existing failures. Old geometry snapshot mismatch independently reproduced on unchanged parent with exact parent/candidate geometry equality. Shared FLIP ignores descendant transitionend; unrelated month controls/shortcuts yield to the stage. [Verification](../verification/TEASER_CARDS-20261014.md) records scope and remaining limits.

Committed/pushed as 40d2e1cb. Vercel status and production build SHA matched; deployed-client synthetic prelude/gates/departure/morph/release/restore/mobile smoke PASS, zero page errors, zero browser POSTs sent. No real schedule data changed.
