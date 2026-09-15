# R54 — Remove the empty Milky Way band above hill saddles

2026-09-15 KST. Local; no push requested.

Owner screenshot still showed abrupt galactic disappearance after R53. Root cause: the .42h ground reference was also the astronomical horizon, although parts of the actual hill silhouette extend below it. A smoother extinction curve could not fill that visible gap.

HillBackdrop now caches a separate sky projection horizon below the lowest visible saddle plus .10h, using the exact panorama viewport crop. Ground depth/relief stays unchanged. Sun, moon, catalogue stars and galactic field share that projection; real azimuth/altitude and below-horizon exclusion stay unchanged, though screen framing changes. Both travel panels interpolate the same projection, and the whole shared sky region stays unwarped. No extra per-frame skyline scans, star bakes or textures.

Verification: final build/typecheck/lint, 28 scoped celestial/geometry/travel tests passed. Same summer/winter23h night captures; 900×1100/2560×1080; night meadow↔hill travel and pointer captures passed without browser errors. Evidence `.scratch-pw/qa/r54`, compare R53/final. No new art, backend/permission/KST changes. Production/device checks unverified.

A visual review confirms galactic glow now meets the right ridge without a new seam; the galactic composition shifts lower with the unified sky projection. C cleared celestial/cache handling. B identified that early travel's interpolated horizon could still be above the destination saddle: travel's stationary region now uses the maximum endpoint sky horizon, independently of the shared interpolated celestial projection.
