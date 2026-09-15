# R56 — Remove artificial pond water overlays

2026-09-15 KST. Owner rejected the new ripple appearance and requested removal. This supersedes the R56 ripple experiment and R55 live-water overlay decision.

Removed the source-texture ripple experiment and the horizontal highlight/reflection strokes. Pond uses the authored water artwork only; terrain parallax, sky, seasons and interactive seasonal materials remain. Removed PondWater and its scene hooks; no ripple texture cache or water simulation remains. Owner authorized committing and pushing this removal on 2026-09-15.

Removal verified: typecheck, lint, build, 897 unit tests passed. Production fixture day/night renders without browser errors and no water simulation debug entry. Main inspected the noon capture: procedural line reflection removed. Evidence: `.scratch-pw/qa/r56/removed-{noon,night}.png`. Production deployment not verified.
