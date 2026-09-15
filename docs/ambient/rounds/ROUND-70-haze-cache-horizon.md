# R70 — Key atmospheric haze by its horizon geometry

2026-09-16 KST. Owner reports a horizontal sky stripe that disappears after changing weather; fix and push authorized.

Root cause: drawDepthHaze cached absolute-coordinate CanvasGradients by season, viewport, color and opacity, omitting the biome horizon. Visiting meadow (.35h) before hill/pond/valley/forest (.42h) reused the earlier gradient but clipped its drawing rectangle at the new start. The first visible row therefore had nonzero opacity. A weather change created a fresh key and removed the stripe. R69 fixed a separate fog-density discontinuity; its direct-entry captures did not exercise this cross-biome cache history.

Change: include the gradient start and end coordinates in the cache key and use the same end for its fill rectangle. Cache remains bounded to 24 entries. No new assets, per-frame pixel processing, weather/color tuning, data/permission/KST behavior or biome-specific exceptions.

Verification: 21 haze/fog/light unit tests; typecheck, lint and production build passed. Added regression visits .35 -> .42 -> .26 -> .42 -> .35 with unchanged weather and verifies both current geometry and cache reuse. Real Chromium Canvas probe before fix: first visible alpha after warming .35 was 27/255 versus fresh 1/255; after warming .26 it was 12/255. After fix all four visit histories produce identical sampled rows, beginning 1/255.

Production fixture travel captured meadow -> hill -> pond -> valley -> forest -> meadow under unchanged autumn/night/fog, plus direct summer/noon/fog forest. No browser errors. Captures and before/after canvas measurements: .scratch-pw/qa/r70/. Main visual check found no straight clipped sky edge in valley/forest. Independent B review: no blockers, geometry/cache regression covered. Independent A/C reviews: no sharp sky cut or new weather/whitening blocker; broad smooth atmospheric haze remains intentional. Production deployment not verified.
