# Toy room lighting — 2026-10-26

Owner request: fix toys that occasionally ignore surrounding home lighting, then deploy.

## Cause and change

Spinning top, battle top launcher and pinwheel replace the catalog image with a sibling rotor canvas. `--vc-toy-color` was defined only on the image. The canvas referenced that undefined variable in its filter, invalidating the entire filter, including room brightness. Both artwork surfaces now receive the same existing color material in `companion-toy-art.css`. Room samples, motion, original artwork and scene lighting remain unchanged.

## Verification

- Before: production-build regression fails in full/reduced/soft/off; computed canvas filter is `none` instead of `brightness(0.4)`.
- After: all nine production-build browser cases passed: three canvas toys × four material modes (including actual dimmed pixels and neutral restoration), original all-84 normal/reduced motion cases, and native viewer/studio/preview room-light/curtain/TV/food/toy movement cases. Fixed-pose contact sheet visually inspected.
- Units: 7,088 passed/one skipped initially; six timeout failures across five suites during concurrent build. Original log retained. Those five suites then passed alone: 293 tests, unchanged timeouts/assertions. Combined coverage: 7,094 passed/one skipped.
- Production build, explicit typecheck, zero-warning lint, harness (392 documents) and diff whitespace checks passed.
- Independent non-author review: `/root/cavecrew_reviewer`, actual dispatched review of CSS, regression tests and nearby render/cascade paths; no findings. Execution/deployment verification remains separate.
- Local evidence: worktree `.scratch-pw/toy-room-lighting/`, governed by `scripts/scratch-retention/README.md`.

## Scope audit

Shared viewer/studio/preview artwork only. No server/DTO/role/private access, data, time/KST, storage, dependency or asset changes. G-22: no changed human action/control/target; timeline and least-used-feature catalog remain applicable, no autonomous material events collected. Topic-only repair: CURRENT_STATE/ACTIVE_PLAN objectives and blockers unchanged.

## Release

This is the pre-release verification record. Actual commit/main/CI/provider/public-source results are retained in `C:/Projects/context-hub/docs/results/VIC-toy-room-lighting-20261026/release.json`; only that completed receipt establishes deployment. Rollback is an ordinary revert of this scoped change; no data migration.
