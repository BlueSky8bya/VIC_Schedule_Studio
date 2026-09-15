# R53 — Relief-shaped motion and softer horizon extinction

2026-09-15 KST. Local only; no push requested.

## Result

- Milky Way uses one broad post-blur atmospheric veil instead of multiplying per-point and short edge fades. Near-horizon faint light lasts longer; resampling is smooth. Catalogue coordinates/sizes and the true horizon remain intact. Stable sky cache retained.
- Hill ground now follows the same authored ridge/saddle/near-shoulder distance field as seasonal material. Cached cumulative contour masks replace horizontal-strip parallax: 5 full, 3 lite, source only when still. Objects use exact source-over motion weights; pointer inversion solves both axes. Meadow stays planar.
- Source-space relief compiles once to a 198,404-byte lookup. Small opacity maps avoid full-resolution JS alpha scans/readbacks; ground texture resolution is independent of opacity-map resolution. No per-frame blur or mask creation.
- Per-scene texture budget includes base: full ≤12MiB, lite ≤3MiB. Pool retains at most 2 scenes, evicts older caches and releases changed source/viewport/tier. Future biome authoring and optimization contract recorded in BIOME_GRAMMAR.

## Verification

- Full suite: 88 files / 894 tests passed. Added lookup approximation, mask-weight equivalence, crop/tier pointer forward/inverse (<.01px), broad sky fade tests. Final build/typecheck/lint passed.
- Four-season passive motion/grab/drag/release; summer/winter night before/after; 900×1100, 1400×860, 2560×1080, 3840×1080; meadow↔hill night travel; full/lite opposite-corner pointer captures. No browser errors. Art reviewer found no double ridge, cracks or foreground-damaging blur.
- Fallback, reduced motion, low-load weather and mobile no-art/no-engine checks passed. Scoped C sky check: 61 changing-horizon frames reuse one bake pair; zero sky pixels below true horizon. B spatial review cleared composition, shared anchoring/inverse and memory bounds.
- Warm 90-frame check: no extra relief bakes. At1400×860 full5:12,101,484 bytes; lite3:2,775,744 bytes. Browser telemetry is local fixture evidence, not a physical-device FPS guarantee. Initial mask implementation had ~202ms first draw; replaced full image alpha loops with small opacity-map compositing and recaptured under `r53/final`.

Evidence: ignored `.scratch-pw/qa/r53` captures, perf.json, gates.json, travel-checks.json, interaction/checks.json. Approved source art unchanged; no backend/DTO/permission/KST changes. No animals/props reintroduced. Deep stays sealed. Depth contours remain an artistic approximation; unseen future biomes need their own profiles. Production and physical low-end devices unverified.

Final small-mask build: same summer night fixture initial draw maximum105.2ms (previous202.3ms), warm p95 2.1ms. This includes other first-draw sky work and is not isolated terrain timing or a guaranteed device speedup. Final four-season interactions and 90-frame full/lite cache/budget checks passed again. Ground texture resolution unchanged by the small opacity-map optimization.
