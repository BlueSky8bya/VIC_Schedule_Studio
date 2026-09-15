# Terrain-relative material perspective and horizon stars

Status: Completed

Owner requests hill ridge/valley-based material scale, softness and speed rather than screen-y alone, with the same principle for future biomes. Also remove apparent Milky Way cut near skyline.

1. Separate celestial projection/extinction from silhouette occlusion; preserve actual star coordinates and physical horizon. Capture same date/night before/after.
2. Add source-space terrain depth contours for delivered hill panorama, mapped using the exact render crop. Feed one distance into seasonal material size, opacity, cached softness, screen travel and pointer response/picking. Meadow remains planar. Future biomes must author their own terrain profile at art delivery.
3. Meaningful continuity/crop/relative-depth tests, four-season render/interaction checks, build/type/lint and independent A/B/C review. No art regeneration, backend, permission or KST selection changes. No push requested.

Authored depth is a visual approximation matched to the panorama, not measured 3D geometry. Keep finite/monotonic per-column profiles, no layer discontinuity or per-frame blur. Preserve mobile/static/reduced/load gates and retained user-approved source images.

Completed locally; verification and remaining limits: [R52](../../ambient/rounds/ROUND-52-terrain-perspective.md). No commit/push.
