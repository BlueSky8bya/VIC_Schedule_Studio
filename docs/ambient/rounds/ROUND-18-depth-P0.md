# ROUND-18 depth P0

Status: P0 local implementation and scoped verification complete · 2026-09-10 (KST)

Owner authorization: “P0 가보자”. Scope: PLAN-20260910-015 P0 only; no generated images, P1, production data writes or deployment.

## Fixed evidence

- Before server: production build `d076929f`, fixture enabled at 127.0.0.1:3100.
- Before representative 16: `.scratch-pw/qa/r18-depth/before`.
- Before 44 biome/season combinations × 3 pointer positions: `.scratch-pw/qa/r18-depth/matrix-before`; 132 PNG, 133 checks passed, page errors 0. Seed 42, viewport 1400×860.
- Contended performance run `perf-before-contended` overlapped matrix capture and is excluded. The separate `perf-before` run completed: max idle/pointer/pan raw RAF means 20.32/20.17/20.89ms, p95 33.40ms, >34ms ratios 0/0/.28%. This host did not meet the planned 60fps target before P0.
- Product checks: typecheck, lint, 71 test files / 801 tests and production build passed. Harness, full art catalogue and 449-image style index checks passed. Final build4 (`SLwfIfaetqNVu7KK9vVyr`) and lint passed after the cache-row correction; final rendered checks below cover that correction.
- Build2 (`v4I_M5PCezEdaYUuAq3Qe`): 1400×860 matrix132, determinism11, deep6×4×6, still8, cache11, pan3 and mobile2 functional assertions passed (249). The final no-console-error assertion failed on localhost `net::ERR_ADDRESS_IN_USE`. The overlapping long browser sweeps suggest a local networking resource issue, but its root cause was not established. The 1024 sweep captured129/132 and had the same network error plus a tidal-winter readiness timeout. These runs are not reported as clean suites; affected cases are checked sequentially below.

## Attributable P0 groups

1. Coordinates/composition: scoped F/M/N transforms, pointer inverse coordinates, fixed sky, per-panel particles/haze/light/seal, sea horizon and mountain occlusion. Affects all scenes, with focused pond/mountain/sea/deep comparisons.
2. Availability/load: mobile mount gate, stationary non-showcase/reduced, existing graphics settings, raw-RAF quality and bounded recovery. Affects viewer/studio ambient and fixture controls.
3. Cache/QA: overscan, bounded allocation and LRU, scenario/measurement scripts and contracts. No art-file edits.

## Independent review before integration

A independently inspected all16 before/after pairs and selected extreme-pointer frames; B inspected10 pairs and actual 4K/input gates; C independently reviewed the engine/motion/caching paths. Findings were reported before main integration:

| Reviewer | Finding | Correction / evidence |
|---|---|---|
| B | P1 light/bank edge strips and oversized-cache thrashing; P2 inappropriate generic foreground marks | Padded light/haze and banks, fixed sky-light scope, allocation caps before baking, ≤3MiB mountain far sources, biome-specific flat marks and deep suspended specks |
| A/B | P2 vertical tails from transparent shore top extrusion | Keep shore vertical padding transparent and near-bank top unextended; both reviewers confirmed absent in after2 |
| C | P1 deep-edge time-overlay gaps and vertical-pan alpha leakage | Padded deep overlays; bounded reusable fully-composed vertical panel, alpha applied once; opaque departure backing avoids page leakage |
| C | P2 mouse recovery unreachable and inactive padded layers retained | Actual mouse-down starts bounded probe; inactive owner caches pruned at pan finish |
| A | P2 pond mid-water side strip and moving sea horizon | Padded mid-water with original y anchor; water underpaint for translucent shore; sea water plane retains x parallax and fixed horizon y |
| B runtime | 4K deep top row and horizontal-pan seam | Original-source row padding (avoids fractional-scale transparent row); pan translated on device-pixel boundary |

Build3 spatial evidence (`edges3`): 4K mountain/pond/sea opacity, all four biome cache/memory gates, horizontal+vertical-pan opacity, mouse/touch/leave, zoom+scroll duck click and mobile gates passed; deep top row still failed and was corrected afterward. Input harness initially clicked a frozen engine: corrected to synchronous unfreeze→click→freeze; real inverse-coordinate hit passed. Do not erase the earlier failed evidence.

## Final build4 evidence

- `after4`: 16 representative captures. A independently opened seven final images and closed all remaining findings: pond tails and side strip absent, sea horizon at y223–224 for all three pointer positions. `review4` focused pond/sea checks: 9 passed, 0 failed.
- `edges4`: all checks passed, browser errors 0. Includes 4K mountain/pond/sea/deep raw opacity and bounded cache, horizontal/vertical pan opacity and cleanup, no-mouse/touch/leave, zoom+scroll actual duck click and mobile gates. This closes the build3 deep top-row failure.
- Final `npm run ambient:qa:selftest`: all passed in 30 seconds (autumn meadow, foggy mountain, deep; deterministic stepping, stillness, time band/seed/weather and no page errors). Sequential `tidal-1024-recheck`: 5 passed, 0 failed, all three missing winter-tidal frames captured. Final pond/sea/deep `final-focused` determinism and cache: 13 passed, 0 failed. These scoped clean reruns do not relabel the earlier broad sweep as clean.
- `load-after-build3`: max/lite and plain/reduced/mobile gates passed. Two harness assertions were corrected: absent stored preference means default auto; initial stationary retries are allowed before comparing pixels. Corrected auto-only `load-after-build3-recheck`: 8 passed, 0 failed. Engine logic is unchanged in build4. Synthetic strain demonstrated full→lite→still, stopped time/frame/RAF, stable settled pixels, and actual mouse-down recovery through a bounded 90-callback probe to lite.
- A/B/C findings were integrated and verified before completion. No generated art or production changes.

## Performance comparison

Uncontended 30-second runs, identical host/viewport/scenarios. `perf-before` versus final `perf-after4`; auto/lite in `perf-after4-modes`.

| Max setting | Before mean RAF | After mean RAF | After p95 | Before → after >34ms |
|---|---:|---:|---:|---:|
| Idle pointer | 20.32ms | 20.09ms | 33.40ms | 0 → 0% |
| Moving pointer | 20.17ms | 19.94ms | 33.40ms | 0 → 0% |
| Repeated navigation | 20.89ms | 19.92ms | 33.40ms | .28 → .13% |

All five final scenarios had no page exceptions. Idle/moving-pointer runs allocated zero new canvases and did not rebake depth. Auto pointer averaged 19.77ms RAF; lite rendered 30.02fps with load .3. Depth cache plus foreground was approximately 6.60MB max / 2.07MB lite in the measured scene. After 12 navigation moves the temporary panel was released and cache returned to two active entries; navigation allocated 109 canvases versus 71 before because bounded foreground/cache entries are recreated on reentry.

The absolute planned 60fps/p95≤21ms target was unmet both before and after. Navigation whole-paint CPU p95 was 5.20ms; baseline lacks CPU instrumentation, so the incremental ≤3ms target is not established. These measurements support no observed RAF regression on this fixture host, not universal device performance. Headful/CPU4×, GPU/decode memory and real OBS/game contention remain unverified.

## Coverage limits

Local fixture rendering and Chromium timing do not establish actual phones, OBS/game workloads, device GPU budgets, real-login/RLS or deployed behavior. GPU/decode allocation is not fully observable from HTML-canvas estimates. The older ROUND-17 backlog in QA_PROGRESS is not closed by P0.
