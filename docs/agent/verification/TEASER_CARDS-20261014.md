# Premiere card choreography — 2026-10-14 KST

Scope: [PLAN-029](../plans/PLAN-20261014-029-premiere-card-choreography.md), replacing PLAN-028's date-wide dimming. Deployed/verified: 40d2e1cb.

## Behavior

Other schedules leave in a stable shuffled order between T−126 and T−75. Four transform/opacity trajectories share one slot for each event's multi-day segments; date cells keep their original geometry/opacity. Public IDs and public reveal generations seed the score. Newly arriving DOM inherits its existing event slot or a bounded late-arrival slot. Target cards gently lift during T−75…68, then their measured shell expands into the large countdown with a one-second shared FLIP and card-face/content crossfade. An off-screen/missing source uses the centered fade instead of a long flight from outside the viewport.

During the full-stage prelude/countdown, unrelated schedule cards, hearts, support links, date-background VOD actions and month navigation cannot activate. Native inert handles focus/keyboard descendants; capture guards handle delegated clicks, day backgrounds and links; the existing month shortcut handler yields while the stage owns the calendar. The target and persistent exit remain available. Closing, personal OFF, reduced motion and rescheduling restore original state; dynamic desktop/agenda nodes inherit the gate. This does not change authorization or data masking.

The shared FLIP helper now accepts only its own transform transitionend. Previously a descendant's 100ms countdown-ring transition could prematurely clear the shell's one-second transition. A behavioral unit test and actual-browser child-transition check guard that failure.

Rendered review covered the partly departed calendar, the sole target at T−74, mid-morph and settled screen. A real requestAnimationFrame sample followed shell width 203→621→975→1171→1199→1180px over 1.09s, retaining the 1000ms transition until its own completion. The mild overshoot settles; it no longer snaps on a child transition.

## Checks

| Check | Result |
|---|---|
| Typecheck / lint | PASS on final product files |
| Focused unit/document tests | 74 PASS: FLIP, choreography, premiere, public DTO, memory and rule migration |
| Full unit suite | 1,084 PASS / 8 existing failures, 1,092 total, exit 1. Same six unrelated files as the preceding release: ambient-codex 2, centering-vs-animation 1, public-cache-revalidate 1, scroll-position-wiring 1, timeline-route 1, vod-chat-recovery 2 |
| Production build / final browser matrix | PASS: build completed in the visual runner, then 63/63 checks passed (exit 0): fluid 20, premiere 24, basic reveal 3, hype 3, hype-craft 13. Includes desktop/mobile/landscape, seeded slots, late segments, morph, interaction gates/restoration, OFF/reduced motion, public canary, releases and rescheduling |
| Visual baselines | Both existing final-screen desktop/mobile baselines PASS on final files. Final screen geometry remains unchanged; no baseline updated |
| Geometry gate | Existing stored snapshot FAIL: expected surface 1840×1421 / day height 222, actual 1840×1453 / 228. Independently built unchanged parent 2299dfcc in a detached temporary worktree and compared at 1440×1200 with the same font-ready, reduced-motion/max-gfx fixture: parent and candidate both 1840×1453, all 42 day heights 228, exact equality. This change preserves current geometry. Do not relabel the old snapshot PASS or overwrite it here |
| Harness | Existing two RULE_MIGRATION active-ID/inventory mismatches remain, exit 1; memory/rule units PASS |

Intermediate browser failures were investigated: first-paint transition sampling and a locator based on a deliberately removed temporary attribute were corrected. The reduced-motion test now observes the existing cooldown instead of requiring immediate automatic reentry. The final 63/63 run supersedes the intermediate runs; the separate geometry-snapshot failure remains explicitly recorded above.

The final bundle also passed a local main-route synthetic smoke: prelude interaction/month gate, authoritative-looking time advances, all other cards departed before focus, source morph, no title before confirmation, release, Escape/restored activation, mobile resize with no overflow, anonymous rehearsal absent, zero page errors; one browser POST intercepted/zero sent. Deployed-client scope is recorded below separately.

All fixtures are synthetic and browser POSTs are intercepted. No real schedule seeds, SQL, migration, dependencies, server DTO, clock/polling changes or DB load test. Public title/body/tags/actual time still require the existing server-confirmed release. Shared viewer, anonymous viewer and studio preview use the same implementation; owner/developer permissions, private unlock and KST semantics are unchanged. Existing search-maintenance WHERE warnings during server rendering are outside this change; browser POST interception does not establish that every pre-existing server path is read-only.

Ignored render captures and geometry comparison live in `.scratch-pw/`; no personal data is copied into this record. Hardware/screen-reader/haptics, formal composite luminance, full uninterrupted 180-second observation and multi-region fanout remain unverified in [OPEN_CHECKS](OPEN_CHECKS.md). Personal OFF / Escape and `NEXT_PUBLIC_PREMIERE_STAGE=0` remain recovery paths.

## Deployment

`40d2e1cbb951c32d3f65bdeee12713dc3a3a4542` committed/pushed to main. [Vercel deployment](https://vercel.com/bluesky-s-project3/vic-schedule-studio/oJFEUM5c2Ux7ex3zqXKg545HWHnF) reported success and the production API build field matched this exact SHA.

Headless Chromium loaded the deployed main route with the established past-month cookie (2025-09). Browser-local teaser GET substitutions supplied synthetic masked/released content dated 2025-09-16; a temporary synthetic non-target DOM card exercised the deployed interaction gate without writing server data. Verified: pointer/key activation blocked, month arrow inert and keyboard month change suppressed, other cards absent before focus, visible target morph, no title before confirmation, release, Escape/restored activation, mobile agenda/no overflow after resize, anonymous rehearsal absent, zero page errors. Two attempted browser POSTs intercepted, zero sent. The temporary DOM was removed. This is deployed-client coverage, not a real production timed event, genuine-login/RLS or DB-capacity result.
