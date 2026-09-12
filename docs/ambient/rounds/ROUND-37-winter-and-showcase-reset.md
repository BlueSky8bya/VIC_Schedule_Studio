# R37 — Winter ridge and showcase environment lifetime

2026-09-12. User requests winter ridge holes fixed and calendar seasons restored after showcase experiments.

## Plan

- Preserve generated PNGs. Repair winter far-layer clipping geometry so internal snow colours cannot punch holes; retain silhouette inset and soft edge.
- Snapshot environment settings on showcase entry; restore on exit. Outside automatic calendar month/KST behaviour returns, prior intentional developer settings survive, graphics preferences remain persistent.
- Verify solid winter columns, rendered day/night ridge, showcase exit and subsequent month navigation. Run typecheck, lint, tests and build. Public DTO/permissions unchanged; mobile exclusion and deep seal retained.

Status: implemented and locally verified; user authorized push on 2026-09-12. Deployed result remains unverified.

## Result and verification

- Winter far mask restores 14,555 snow pixels and removes zero accepted pixels; bounds unchanged. Each column is continuous. No saturated magenta in restored mask. Original PNG and ground/frame geometry unchanged.
- Showcase snapshots season and WorldForce on entry, restores them on actual exit. Closing only the settings panel retains experiments. Outside intentional developer settings survive; default automatic month/KST behaviour resumes. Graphics choice remains persistent.
- Typecheck, lint, production build: PASS. Unit suite: 83 files / 868 tests PASS. Permanent browser regression `tests/visual/showcase-reset.spec.ts`: PASS; date/direction/season changes, two-stage Escape, March–December calendar season transitions.
- Rendered winter noon/night at 1400×860 and 2560×860: PASS; captures `.scratch-pw/qa/r37`. Separate studio scenario confirms June settings restoration and July–December transitions, no browser errors.
- Independent A art / B spatial / C season-control reviews: no actionable issues. Rendered evidence is local Chromium fixture, not deployed/live-auth verification.
