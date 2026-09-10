# ROUND-20 — spring meadow desktop release

Status: Local checks complete; push/deployed inspection pending · 2026-09-11 KST

Owner authorizes another 2× finer visual detail if performance impact is modest, spring-meadow application across desktop aspect ratios excluding mobile, and push followed by deployed inspection. This supersedes the prior spring-only promotion prohibition and four-season-before-release order for this scoped spring release. Other seasons retain their existing scenes; deep remains sealed. The liked color/soft pixel appearance is preserved rather than forcing the rejected early 6–10-color candidate appearance onto it.

Plan: preserve 1536×1024 source dimensions (6MiB RGBA) while refining visible pixel detail, use bounded display-size caches and the existing full/lite/still policy, separate engine sky/time/weather from terrain artwork, preserve ground/horizon anchors and interaction coordinates. Validate standard, wide, ultrawide, square and portrait desktop sizes plus mobile exclusion. Keep source bytes/provenance; no private workflow metadata in public code. Capture a fixed baseline and compare performance, then independent A/B/C review, product checks, scoped commit/push and deployed checks.

The source image's dimensions and display-cache area affect pixel work; finer content within the same dimensions does not multiply decoded area. Compressed bytes and actual draw timings must still be measured. Reference: [MDN canvas optimization](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas).

## Delivery and scope

- Run `art-src/배경층/초원/작업회차/20260911-봄초원적용-시안05/`: frozen liked input, exact prompt, untouched generated PNG and hash-bearing delivery record. Public `backdrop-meadow-spring-v1.png` matches original bytes. 1,773,389 bytes versus liked source 1,690,391 (+4.91%); both 1536×1024, approximately 6MiB decoded RGBA each. Visible detail is finer; canvas dimensions did not double.
- One source supplies uniformly cropped ground and skyline-clipped distant trees; engine sky stays above horizon 0.26h, with time/weather overlays. Existing low foreground and interaction coordinates remain. This is not delivery of three transparent PNGs or all 123 planned images. See ADR-0023 for superseded restrictions and rollback.
- Far cache is bounded to 2MiB and keyed by dimensions/quality, not pointer/time. Decode is shared; delayed completion repaints a stopped non-frozen scene once. Initial mobile entry fetches neither scene engine nor backdrop. Desktop-to-mobile transition can retain the shared decoded image cache.

## Verification and independent review

Final fixture build: `EkhmqLdOFOWHks6x2GKDv`. `responsive-final` contains 35 passing checks: nine PC sizes (1024×768, 1400×860, 1920×1080, 3440×1440, 5120×1440, 1080×1920, 1440×1440, 641×1100, 3840×2160), both pointer extremes, opaque edges and bounded/no-pointer-rebake cache; six different time/weather frames; plain/reduced/lite modes; three mobile/touch exclusion cases; zero browser exceptions. `final-depth` has nine passes for spring pointer frames, deterministic replay and cache bounds. These samples and uniform crop bounds cover representative ratios, not every physical device.

Typecheck, lint, 72 unit files / 803 tests and production build passed. Geometry reproduction, art catalogue, 449 style references and document harness passed. Evidence under `.scratch-pw/qa/r20-spring/` is local and regenerable; scripts are committed.

A reviewed 17 images, then final noon/night/32:9 images: bright horizon band fixed by clipping engine sky above the ground; no P0/P1. B reviewed nine ratios and geometry: no P0/P1, no stretching/gaps, retained anchors. P2: distant mirrored repetition can be recognized at 32:9; future asymmetric distant art can improve it without changing the current bounded layout. C reviewed caches/decode/modes and measured performance; no blocking issue.

Same-machine, uncontended 30-second pointer comparison against the pre-art P0 build: baseline RAF mean 20.226ms, candidate mean 21.77ms; both p95 33.4ms and zero gaps over 34ms. Actual paint CPU mean .494ms → .441ms, p95 .700ms unchanged; zero per-frame canvas allocations. Candidate auto ~50fps, lite ~30fps. This supports modest observed impact, not universal 60fps or a GPU-spare-capacity measurement. The automatic policy reacts to observed frame load. C also delayed decode 3.3 seconds: stopped non-frozen scene repainted exactly once, frozen scene did not repaint or advance. Candidate2 performance evidence is `perf-before`, `perf-after`, `late-art-check.json`; the final visual change only clips sky below the horizon.

Final-build follow-up (`perf-final/summary.json`, max/pointer 30s): RAF mean **20.102ms** versus baseline 20.226ms, p95 33.4ms unchanged; paint CPU mean **.472ms**, p95 .700ms unchanged; 49.78 actual fps, no gaps over 34ms, no extra canvas allocation or browser error. Far cache 333,792 bytes / one bake. This supersedes the candidate2 max timing as the final observation; single-run scheduling variation remains, and no real low-end device/OBS/GPU guarantee is inferred. Final three-scenario smoke selftest also passed, including deep weather seal and deterministic frozen behavior.

Public data loaders, roles, authentication, unlock and production data are unchanged. Viewed-month season and existing KST time remain authoritative. User-owned `.vscode/` and `preview-360.png` are outside this release.
