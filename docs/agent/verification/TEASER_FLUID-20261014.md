# Premiere fluid redesign — verification

Date: 2026-10-14 KST
Status: Deployed and verified — functional release e74bd1b3
Decision: [PLAN-028](../plans/PLAN-20261014-028-premiere-fluid-redesign.md)
Previous release: [premiere implementation and deployment](TEASER_PREMIERE-20261014.md)

## Result and references

The owner requested a complete Apple-inspired motion/visual rework after finding freezes, inconsistent exits, a small countdown, weak hope feedback and sparse release presentation. [Apple Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities), [WWDC23's dynamic Live Activities session](https://developer.apple.com/videos/play/wwdc2023/10194/), [StandBy](https://www.apple.com/ca/newsroom/2023/06/ios-17-makes-iphone-more-personal-and-intuitive/) and [Motion's layout documentation](https://motion.dev/docs/layout-animations) informed the progression, large type and spatial continuity. Reference images were inspected locally for research; no third-party images/fonts/library were shipped. Product graphics remain responsive native CSS/SVG using existing clock, curve, spring, SFX and haptics.

- A continuously updating timer/progress capsule covers the entire prelude. The large viewport screen uses restrained chrome, a substantially larger shared clock and short numeric transitions. Zero keeps the number and an explicit animated confirmation state.
- Debut/live/season/filter/navigation/background follow one time-based score. Short travel and opacity replace huge rotations/falls. The calendar visually occupies the vacated panel width using only its outer transform; saved panel state and 1840px canvas width/row geometry do not change. Spatial de-emphasis precedes withdrawal and reverses on dismissal. Dynamically mounted live cards and responsive topology join the same score.
- Seasonal light fields replace literal rotating particle icons. The final ten seconds fade them out completely. Hope changes the entire control with an elastic press, ripple, check state and a brief tonal response. Publication uses public date/time, large title, optional description/tags and shared FLIP for layout changes and return; no filler, redundant film strip or title decoding delay.
- Full staging owns its reveal effect. Legacy card shockwaves do not run invisibly behind it or restart on immediate dismissal. The default-ON preference, OFF basic presentation, reduced motion, gfx fallback, cohort/time-edit/deletion rules and developer-only unobtrusive rehearsal remain shared.

## Root causes corrected

1. `avatar-card-pop` with `animation-fill:both` overrode debut exit opacity/transform. The active score now disables conflicting entry animation and controls inert/aria-hidden using the same progress.
2. Season controls were never registered; newly arriving live cards also needed registration. The hook covers all panel topologies and observes relevant added nodes, not per-frame style mutations.
3. Phase `screen` emitted `.pm-screen` on the entire portal, colliding with the actual screen component at T−68…60. Phase classes now use the `pm-phase-*` namespace. The regression asserts a single screen and a fully visible clock in this interval.
4. Detail's 196px maximum height, emerge opacity and gradient mask clipped the enlarged clock and hid its initial seconds. The shared presenter keeps its clock/structure while the viewport wrapper owns unclipped bounds and immediate visibility. Detail defaults remain intact.
5. A legacy `.reveal-shock` behind the full stage expanded the mobile document to 634px at a 390px viewport. The coordinator now selects one presentation effect. Long-title release tests assert no background shockwave and no overflow.
6. Even an identity transform on the ambient wrapper would rebase its fixed canvases to a zero-height containing block. That wrapper fades without transform; an ambient-ON browser test checks canvas bounds and dismissal.

## Executed checks

| Check | Result / scope |
|---|---|
| TypeScript | `npm run typecheck` PASS; final production build also typechecked |
| ESLint | `npm run lint` PASS |
| Relevant units | Premiere/coordinator cache/reconcile/celebration/public DTO/choreography: 57 PASS; continuous hype curve's 40 tests also PASS in full run |
| Full unit suite | 1,082 PASS, 8 pre-existing failures, 1,090 total; exit 1. Same failures as the previous release: ambient-codex 2, centering-vs-animation 1, public-cache-revalidate 1, scroll-position-wiring 1, timeline-route 1, vod-chat-recovery 2. No blanket full-suite PASS |
| Production-build browser matrix | 56 PASS across teaser-fluid, teaser-premiere, teaser-reveal, teaser-hype and teaser-hype-craft; exit 0. This preceded the final ambient-wrapper-only correction |
| Final production-build fluid checks | 14 PASS after the ambient-wrapper correction; exit 0. Includes all 13 new fluid cases and the additional ambient-ON case |
| Visual baselines | Desktop/mobile PNGs added and reviewed; two independent checks without updating snapshots PASS. Final fluid run also matched both baselines. Only changing digits/progress presentation are normalized for snapshots; interaction/time tests use the real synchronized clock |
| Documentation/harness | Memory/rule tests 43 PASS. `harness:verify` still fails on the same two pre-existing RULE_MIGRATION active-ID/inventory mismatches; exit 1 |

All publication/role interactions use synthetic fixtures and intercepted browser writes; no real calendar events were seeded, no SQL/schema changes were made and no real DB load burst was sent. Existing Next server search-refresh warnings (`DELETE requires a WHERE clause`) appeared during browser verification; they are outside this visual change. Browser POST interception is not evidence that every existing server-side maintenance path is read-only. Genuine login/RLS and hardware remain separate coverage.

Local image review covered prelude/filtered calendar/full-width focus/large clock/final calm/public release, plus desktop/mobile baseline geometry. Ignored captures live under `.scratch-pw/premiere-fluid-*`; committed baselines contain synthetic viewer UI only. Snapshot masks protect determinism; they are not used to hide layout defects from interaction checks.

## Boundaries and remaining checks

No public DTO, server grant, clock synchronization, DB masking, cache polling cadence, KST helper or private-unlock semantics changed. Public titles/time/tags enter the stage only from confirmed released events. Shared code serves anonymous/viewer/studio preview; role capability and synthetic-only rehearsal restrictions are preserved. No production dependency was added.

Formal composite-video luminance, real screen readers/haptics/mobile hardware, complete 180-second observation and deployed multi-region fanout remain unverified, as in [OPEN_CHECKS](OPEN_CHECKS.md). The existing 1.5-second large-effect budget and <3/sec requirement remain; removing the duplicate background effect improves consistency without claiming a formal audit. No production performance/capacity claim follows from these UI checks.

## Deployment

`e74bd1b3e12f5b80fee03108cd5e8aa878eabab6` committed/pushed to main. [Vercel deployment](https://vercel.com/bluesky-s-project3/vic-schedule-studio/A6ZPtK6yUxRwfPdnQhX4eaeLhEy9) reported success; the production API build field matched that exact SHA.

Headless Chromium loaded the deployed bundle using the established past-month cookie (2025-09). Only that browser's teaser GET responses were substituted with synthetic masked/released content dated 2025-09-16; all attempted browser POSTs were blocked (two intercepted, zero sent). Verified T−65 screen uniqueness/unmasked clock, no title before release, an authoritative-looking synthetic time advance to a near deadline, public release/title, no duplicate underlying shockwave, a mid-show resize into the mobile agenda with no overflow after topology settlement, Escape/inert restoration, anonymous rehearsal absence, default-ON switch and OFF persisted after reload. Zero page errors. This is deployed-client coverage, not a genuine production timed event or developer/owner login test.

Retain `NEXT_PUBLIC_PREMIERE_STAGE=0` as deployment stop and the immediate personal OFF control. Reader/RPC rollback policy remains the previous release's policy; this revision required no migration.
