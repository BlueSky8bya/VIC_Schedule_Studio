# R52 — Terrain-relative particles and horizon stars

2026-09-15 KST. Local implementation; no push requested.

## Changes

- Hill seasonal material uses authored source-space depth contours following the central saddle and diagonal near shoulder. Exact panorama crop is inverted before lookup. One continuous distance drives size, opacity, cached softness, screen speed, pointer breeze and hit radius. Render position and terrain parallax retain actual surface coordinates. Meadow keeps its planar calculation.
- Removed the Milky Way's abrupt 3° cutoff. Atmospheric extinction now approaches the true horizon continuously; baked blur fades before its canvas border. Hill terrain itself occludes the sky, instead of a rectangular clip. Real star coordinates, catalogue magnitudes and below-horizon exclusion remain.
- Future biome art must deliver its own relief profile; see BIOME_GRAMMAR. Hill contours are an artistic approximation, not measured 3D. Disabled animals/props remain disabled. No source art, permissions, public DTO, KST calendar selection or sealed deep behavior changed.

## Verification

- Initial integrated build, typecheck, lint and full unit suite: 88 files / 890 tests passed.
- Four seasons: passive motion, grab, drag, release passed; day/night captures and summer/winter identical-date before/after stored locally under `.scratch-pw/qa/r52`. Browser errors: none.
- Unit coverage: continuous/monotonic contours, same-row relief differences, crop/cover invariance and skyline boundaries.
- Independent A visual review: no new skyline seam, matte hole, material depth band or terrain breakthrough. B code review: shared distance and surface alignment correct. C identified animated sky projection cache churn; final verification below records its fix.
- Physical low-end devices and deployed production remain unverified.

Final follow-up: fixed the transition cache churn with a stable viewport-derived sky projection and exact affine x/y reprojection (including changing horizontal FOV). Catalogue star sizes stay unchanged. Celestial suite: 20 passed; Chromium 61 changing-height frames allocate exactly two bake canvases, with no pixels at/below the horizon. C re-review cleared the blocker. Final build/typecheck/lint passed. Integrated final night captures, 900×1100 / 2560×1080 crops, meadow↔hill night travel and pointer parallax passed without browser errors. Showcase exit/reset and interactive calendar while assets load: 2 Playwright tests passed. Harness passed. Full suite before this scoped cache follow-up: 890 passed; scoped celestial test adds one projection regression case.
