# R63 — Sky edge and shared near-terrain sampling

2026-09-15 KST. Owner reported a straight boundary above mountains and asked that every biome prioritize near-ground detail. No push requested.

Directional sky lighting previously used a horizontal gradient with nonzero opacity to the bottom of a rectangle at1.1×horizon. Replaced with a cached256² surface and smooth vertical opacity fade ending at zero. Same color/direction inputs, four-entry cache shared with ground directional lighting (about1MiB maximum). Stable lighting reuses it; transitions may create new keys. No calendar, astronomy, permissions or motion-gate changes.

Audit: meadow has R29 near-art composition; forest has R62 near-art composition. Hill/pond/valley/forest all use ReliefLayers, previously uniform sampling across terrain depths. Near layers now receive up to1.35× linear sampling, capped at display scale1 (lite .75). Far sampling is unchanged, never reduced to manufacture contrast. Same contour masks, transforms, physics and root positions; quality blends along authored relief. Old separate-layer scenes already distinguish far/ground sampling through drawDepthGround. Deep remains sealed.

This unifies quality priority, not original artwork detail density. No new hill/pond/valley artwork was generated. Source detail is the ceiling; future biome art must include genuinely detailed near-half surfaces and use shared terrain contours/rendering. Do not claim every legacy biome has been repainted. Near sampling may require up to1.35² times the former12/3MiB relief budget (about21.87/5.47MiB plus rounding), still bounded to current/travelling scene sets. No per-frame resampling/baking under stable viewport/tier.

Verification: typecheck/lint/build and38 relevant unit tests passed. Five current biomes summer noon/night before/after captures, plus2048px autumn/winter pond night. Isolated directional-light end-row jump ≤1 channel level; synthetic full/lite relief90-frame probes retain one bake,13,098,972/3,235,420 bytes. Evidence .scratch-pw/qa/r63/. No real-device FPS, production/deployment or every legacy biome visual claim.

B confirms geometry/masks/far sampling unchanged; C confirms smooth alpha and bounded cache. A inspected four pairs: no new seams, near sampling subtly clearer; original sky line weak in these fixtures, so exact user-case disappearance is not conclusively established. Main inspected pond summer/autumn night and found no sharp sky edge. Owner appearance review next.
