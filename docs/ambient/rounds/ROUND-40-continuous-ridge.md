# R40 — Continuous irregular meadow ridge

2026-09-15 user asks to remove repeated crests and cutout-like notches.

Plan: preserve matte-free source colours, normalize valid source columns into opaque texture, replace repeated source silhouettes with a deterministic continuous world-space crest at multiple unequal scales. Blend texture wrap and feather once per bounded cache. No runtime randomness, new assets or foreground/tree changes. Verify source-column coverage, continuity/non-repetition, four seasons and wide/lite views; retain R39 startup/exit tests. User authorizes this silhouette replacement over previous unchanged-outline approach. No push requested.

Status: locally verified, awaiting visual feedback. No push requested.

## Verification

- Original generated PNGs unchanged. All four matte-free masks cover 1536 columns; sampled valid rows per column are normalized into opaque 1536×64 textures. Colour wrap crossfades independently of the smooth crest; source-edge cutout/height mismatch no longer defines geometry.
- Pure continuity/non-periodicity tests PASS. Full unit suite 84 files / 870 tests PASS; typecheck, lint, production build PASS. Existing two showcase/loading browser regressions PASS.
- Eight seasonal noon/night frames plus 3440px full and 1400px low-load spring night: no browser errors. Evidence `.scratch-pw/qa/r40`. Independent A: prior notches gone, unequal rolling crests, seasonal texture retained, no matte/halo/streaks. B/C: source coverage, bounded caches, lifecycle and shared controls unchanged.
- Isolated Chromium painter timing with synthetic opaque source and synchronous pixel readback: median 6.3ms at 1400px, 8.2ms at 3440px (12 warm samples; excludes other scene/blur stages). Far caches ~1.03MB each; painter runs only when cache is built, not each steady frame. Not a whole-frame/device guarantee.
- This replaces R39's preserved-source-outline treatment and closes its remaining source endpoint-height notch limitation. Foreground, loading/input improvements, KST restoration and tree deferral remain.
