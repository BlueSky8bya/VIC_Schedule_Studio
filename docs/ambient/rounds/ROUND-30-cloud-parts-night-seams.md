# ROUND-30 — Individual clouds and night seams

Owner request 2026-09-11: remove black horizontal lines on clouds/ground (especially at night); move, deform and dissolve individual clouds within a bank. Small clouds dissipate faster; large clouds change outline and separate into soft pieces.

## Changes

- Ground diagnosis: two eight-step translucent ramps overlap by half a pixel, making dark horizontal seams. Ground anchor now uses one continuous gradient; directional multiply uses one cached 256² masked surface (four-entry cap).
- Cloud diagnosis: whole banks were distorted in 24 horizontal strips with shared moisture. Replace runtime bank slicing/fading with individual cloud clocks, bounded local wind and three softly masked curved fragments per cloud. Each fragment deforms separately, small clouds have shorter lifetimes and dissolve completely. Dense weather retains larger cores; their split motion returns continuously at cycle boundaries.
- Soft source masks cached by genus/variant (20 entries / 16 MiB cap). No per-frame bitmap generation, readback or blur. Lite omits fragment deformation; existing global stationary/mobile/deep gates unchanged. No new artwork or data/security/KST changes.
- R29 near detail/original far preservation remains. R28 cloud deformation and whole-bank moisture behavior superseded.

## Verification

Final build g1C3gvWMPH4YDwDP736_b. No commit/push. Local fixture server remains on 3100.

- Full suite before final fringe/cache refinement: 77 files / 837 tests passed. Final targeted celestial/light suite: 35 tests passed. Final build (including lint/type validity), explicit typecheck, explicit lint and 81-document harness passed.
- Pre-refinement movement/cache/mobile suite: 33 passed, 0 failed; deterministic selftest all 3 scenarios passed including deep weather seal. Final refinement does not alter gates.
- Actual daytime/night captures for clear/cloud/wind/rain and four-time cloud/wind sequences: dark eight-band ground seams absent; no cloud strip cuts. Independent A/B/C reviews found no remaining correctness blocker after fixing core split-cycle continuity.
- Final cloud captures at 1.5/6.5/11.5/21.5 seconds show individual density and outline changes. 120 successive 60Hz steps after 21.5 seconds: maximum sky mean channel change .094/255, maximum single sampled channel change 16/255, no page errors. This is a short continuity sample, not full lifecycle/real-device performance coverage.
- QA evidence .scratch-pw/qa/r30/{before,after,motion,final,gates}. Earlier after filenames end in 0 due to stale settledT naming; those are actually 21.5s. Final/motion filenames use actual elapsed time.
- Reviewer performance advice integrated: quantized direction-cache keys and scalar mask weights avoid needless allocations. Large cores use continuous sin² split envelope; small-cloud resets occur at zero opacity. Outer fragments have separate moisture clocks.
- Lite intentionally retains inexpensive per-cloud drift/fade but omits fragment split/rotation/stretch/fringe evolution. Engine still/reduced/outside-showcase time freeze remains authoritative and passed gates. No claim of full physical fluid simulation.
