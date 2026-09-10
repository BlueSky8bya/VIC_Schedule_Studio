# ROUND-29 — Near-only ground detail

Owner correction, 2026-09-11: keep the existing far ground, add actual detail only to the near half, without a quality boundary. R28 lowered distant sampling instead and is superseded for ground only. Accepted cloud evolution is preserved.

## Implementation

- Removed distance mip downsampling from depth rendering and all meadow callers. Existing tier budgets remain.
- Built-in image_gen.imagegen edited four frozen seasonal originals. New finer grass strokes / snow texture are separate near-detail-v1 assets; original ground files untouched.
- One-time 1536×1024 composition copies original pixels exactly above row 512; rows below fade in new artwork with smoothstep (.5→.85). No runtime sharpening or per-frame processing. Existing tile overlap and source-pixel masking preserve seams.
- One additional composite costs 6 MiB per active meadow backdrop. Temporary decoded detail image released after composition. No claim of half cost or quantified 2× perceptual gain.
- Shared backdrop feeds viewer/preview/studio rendering. No server DTO, permissions, KST, camera, mobile, motion or deep-seal behavior changes.

## Art provenance

[Run and delivery](../../../art-src/배경층/초원/작업회차/20260911-근경세부보강-01/delivery.json): exact prompts, frozen originals, raw outputs, sibling runtime files and SHA-256. Agent inspected all four generated images. Owner acceptance pending.

## Verification

Final build Nj9XC47ZL_TxfFEFSG2Dp; build (including lint/type validity) and explicit typecheck passed. Full suite before optional-load cleanup: 77 files / 835 tests passed; final targeted ground suite: 3 files / 8 tests passed. Harness 81 documents and diff whitespace check passed. No commit or push.

- Eight 1400/3440×860 seasonal captures: no observed horizontal quality boundary, tile gap or stretching. Existing wide-screen grass repetition remains.
- Final original-vs-enhanced rendered comparison waits for nearDetailBytes=6291456: all four seasons have zero changed pixels in distant test rectangle x0–1399/y350–549; near rectangle y701–849 changes ~199k–202k pixels. This confirms preserved far rendering and added near content, not a numeric perceptual-quality claim. Evidence: .scratch-pw/qa/r29/final/report.json and paired PNGs.
- Final still/cache/mobile gate suite: 33 passed, 0 failed. Deterministic QA selftest: all 3 scenarios passed, including deep weather seal.
- A/B/C independent read-only reviews: no remaining blockers. Fixed optional detail blocking the base artwork and cleanup after original-load failure. Base rendering stays available while optional detail loads; later art-ready event refreshes it. Visual review limited to tested desktop viewports; real-device subjective acceptance pending.
- Local fixture server remains on port 3100.
