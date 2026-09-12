# R38 — Rich night sky

2026-09-12 user authorization: more spectacular stars, Milky Way and clusters; stylization allowed, actual catalog positions and relative brightness retained.

Plan: preserve catalog/projection/rendering; enrich only a deterministic decorative galactic field with fine points, irregular clustered star clouds, cool colour and dark dust contrast. These decorative points are not claimed catalog stars or identified real clusters. Keep minute/four-entry bounded cache, moon/weather/daylight gates and low-load fallback. Capture matching before/after summer/winter, check directions and low load, run product checks and independent A/B/C review. No push requested.

This user direction supersedes the restrained-night-sky interpretation of VISUAL_DIRECTION §1 and SEASON_TIME_WEATHER_GRAMMAR §0.3 for this decorative sky layer only. Actual celestial calculations and terrain remain unchanged.

Status: user authorized loading optimization and push on 2026-09-12; locally verified for publication. Deployed result unverified.

## Result

- Decorative galactic field: 34,000 scattered points + 6,300 clustered points, deterministic sky coordinates. Broader blurred unresolved light is composed behind sharp subpixel points; stronger dark dust contrast and cool/warm tint variation. No real cluster identifications asserted.
- Catalog JSON, visibleStars and actual-star draw commands unchanged. Independent C comparison across 160 season/hour/bearing/load cases found identical catalog positions, colours, alpha and sizes.
- Lazy decorative initialization and one-time galactic conversion reduce repeat work. Four-entry/minute canvas cap and low-load omission retained. B mocked-canvas CPU probe: recurring median 9.63ms baseline vs 11.12ms revised; first initialization 23.34 vs 41.67ms. These are CPU-only measurements, not device/GPU frame guarantees.
- Typecheck/lint and final production build PASS. Full unit suite 83 files / 868 tests PASS before final glow tuning; affected celestial suite 18 tests PASS after lazy/projection refinement. Final tuning changes only glow footprint, final build includes lint/types.
- Eight final Chromium fixtures: summer/winter clear night, winter four bearings, summer cloudy night, noon and low-load night; zero browser errors. `.scratch-pw/qa/r38` holds matching before/final captures and result.json. A final visual review closes initial weak-glow finding; B repeat-bake concern resolved; C no celestial findings. Actual device performance/deployed result unverified.

## Loading follow-up

- Construct the 40,300 decorative points directly with uniform fields; eliminate the intermediate array and spread-cloned objects. Seed/order/values unchanged; lazy initialization and cache limits preserved.
- Independent B probe: first draw median 52.16→44.81ms (14.1% reduction), 20 alternating Node22 samples after four warmups. Mocked canvas excludes raster/GPU/network; not a whole-page loading claim. Repeat cache misses not measurably faster; cache hit ~0.55→0.58ms.
- Independent B/C: all point values equal; 139,690 drawing/state commands exactly equal across bearings, seasons, low/full load, hits and eviction.
- Final revision: full unit suite 83 files/868 tests, lint and production build PASS. Rendered parity evidence is in `.scratch-pw/qa/r38-load`; no artwork or astronomical catalog changes in the optimization.
- Typecheck/harness PASS. Independent A: all eight final PNGs SHA256-identical to pre-optimization captures; zero browser errors.
