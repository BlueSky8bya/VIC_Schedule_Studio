# PLAN-028 — Fluid premiere redesign

Date: 2026-10-14 KST
Status: Locally verified; deployment verification pending

## Owner direction and replacement decisions

The owner requested implementation of a more fluid, playful and refined Apple-inspired premiere. This supersedes PLAN-027's literal rotating seasonal particle storm, travelling star/lightstick, small nested countdown cards, long explanatory captions and abrupt off-screen exits. Keep the accepted public boundary, single coordinator/clock, 1840px poster geometry, default-ON setting, developer-only rehearsal, cohort/rescheduling rules, escape/focus restoration and cost limits. No schema, authority, private unlock or real schedule changes.

## References and adaptation

- [Apple Live Activities](https://developer.apple.com/design/human-interface-guidelines/live-activities): readable progress, concise information, content-preserving transitions and concentric spacing. Adapt to a live countdown capsule that remains visible from the first prelude through handover.
- [Design dynamic Live Activities, WWDC23](https://developer.apple.com/videos/play/wwdc2023/10194/): compact-to-expanded continuity, elastic movement and large readable numerals. Adapt with existing `flipSpring`, shared numeric countdown and short damped motion.
- [Apple StandBy](https://www.apple.com/ca/newsroom/2023/06/ios-17-makes-iphone-more-personal-and-intuitive/): distant legibility and full-screen information hierarchy. Adapt with a large countdown stage and editorial-scale release typography.
- [Motion layout documentation](https://motion.dev/docs/layout-animations): transform-based shared layout animation. Reuse the repository's implementation, without adding a motion dependency.

Reference screenshots/video imagery are research only, not product assets. Use resolution-independent CSS/SVG light fields, progress and rings for the product: responsive, season-colored, no bitmap downloads or large new runtime. No borrowed Apple artwork, fonts or marks.

## Implementation

1. Prelude: continuous seconds/progress capsule; no dead intervals. Fold debut/live/season/filter regions with consistent short distance and opacity. Exit thresholds agree with inert/aria-hidden. Disable conflicting legacy entry animations during this choreography.
2. When the panel yields, reclaim its viewport space on the poster's outer shell without changing surface width/rows or saved panel preference. Use shared FLIP and restore on dismissal/postponement/return, including mid-transition interruption.
3. Before screen handover, dim and withdraw non-target calendar regions progressively by spatial distance, not a synchronous falling grid. Keep the target legible. All continuous choreography uses synchronized monotonic time; no extra network timer or DB writes.
4. Large screen: compact chrome, expansive typography, flowing seasonal light rather than orbiting icons, a continuous progress trace and animated numeric updates. The final ten seconds remove surrounding motion while seconds still change. Pending data has a clear, moving loading indicator and retains the five-second limit.
5. Hope: one substantial elastic control, pressed state, local ripple/energy response and shared haptic/SFX settings; no floating decorative icon. Response does not alter countdown timing or authorize release.
6. Reveal: a single bounded low-luminance light expansion, a confident typographic arrival and clearly sized date/time/title/body/tags from confirmed public data only. Scale to content and cohort; no fake filler or secret-derived layout. Return to source with shared FLIP.

## Validation

Production-build fixtures, before/after captures and actual-time browser interaction checks: full prelude continuity, all panel regions exiting, reclaimed outer width with 1840px export unchanged, staggered calendar emphasis, numeric countdown during every interval, ten-second calm, hope feedback, release with sparse/long/multiple content, reschedule/delete/delay/hidden tab, interrupted return, settings OFF/reduced motion and developer-only rehearsal. Verify desktop, mobile, landscape-touch and gfx fallback. Use synthetic fixtures/intercepted writes only; no current/future real calendar seeds. Run typecheck, lint, affected unit/browser/document checks, build and harness; record exact failures and coverage limits.

## Completion

Implemented and rendered review complete. Production-build matrix 56 PASS; after the final ambient-only containing-block correction, all 14 fluid cases and both visual baselines PASS. Typecheck/lint/build PASS; full units 1,082 PASS/8 existing failures. Exact scope and remaining checks: [verification](../verification/TEASER_FLUID-20261014.md). Commit/push and deployed-client verification remain. Previous production release remains evidence, not proof of this revision.
