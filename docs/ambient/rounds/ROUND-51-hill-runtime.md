# R51 — Seasonal hill and directional travel

2026-09-15 KST. Owner accepted hill concept01 and requested meadow-equivalent depth, season/sky/weather/interactive material, and directional biome travel. No push requested.

## Delivered behavior

- Hill uses four generated terrain panoramas, with shared live sky, solar/lunar positions, stars, clouds, weather and lighting. Source/run lineage: `art-src/배경층/언덕/작업회차/20260915-광폭지면-시안03/`. Original concept and rejected tiled run02 remain preserved. Runtime source matte is excluded before resampling; snow interiors never alpha-keyed.
- Same autumn engine as meadow: passive wind, gusts, pointer breeze, grabbing, perspective scale/speed/softness and seasonal art. No creatures/decor added. Actual x-dependent hill skyline also fades body/shadow and blocks picking invisible material.
- Continuous 64/full or 24/lite surface bands, almost fixed skyline and progressively stronger near motion; generated near texture retained. This supersedes literal three separately moving hill images: one continuous surface avoids opened cracks, with many fine depth slices instead of three rigid slabs.
- 3:1 panorama reveals more terrain as the viewport widens. Above 3:1, uniform cover crop around the .42 horizon keeps proportions; it gently zooms both axes rather than stretching grass horizontally. No repeated/mirrored hills.
- Meadow↔hill travel: 620ms quint, direction-dependent near/far shift and complete-frame dissolve, fixed/shared celestial projection, destination-ready hold. Other biome pairs retain existing directional slides until their new art/sky contracts are delivered. Deep transition remains unchanged/sealed. Offscreen readiness bakes dt0 without advancing material simulation.
- `.42` hill horizon replaces legacy `.26` for this delivered composition. Ordinary calendar stays meadow; showcase exit/reset, viewed-month KST seasons, mobile engine gate and automatic graphics policy remain shared.

## Verification

- Typecheck, lint and production build passed. Full suite: 87 files / 885 tests passed. New geometry/travel tests cover uniform crop, exterior matte, coverage, monotonic strips, celestial alignment, readiness wait and reduced-motion instant arrival.
- Production fixture: four seasons noon/night, passive motion, grab/drag/release all passed without browser errors. 900×1100, 1400×860, 2560×1080 and 3840×1080 captures inspected. Both travel directions captured at0/80/200/620ms; arrival and panel-cache release passed. Pointer offsets and cloudy night captured.
- Showcase reset/calendar-loading interaction: 2 Playwright tests passed.
- Corrected gate harness passed: failed-image fallback retains sky; app reduced mode keeps identical material positions/zero pointer offset; load.2 renders cloud/rain/fog/wind/snow with expected particle categories; mobile creates no ambient engine and makes zero art requests (empty canvas DOM can remain). 3840×1080 panorama inspected.
- Independent A/B/C reviewed actual captures/code. Fixed first-pass fallback sky occlusion, ultrawide repeated/ghost hills, dt0 background simulation and duplicate sun. A noted existing approved winter dry-grass shapes; no redesign in this scope. C legacy projection concern resolved by limiting new travel to delivered meadow/hill pair.
- Evidence under `.scratch-pw/qa/r51/`. Initial gate script used OS reduced preference instead of fixture `reduced=1`, then compared -0 with0 and incorrectly required no mobile canvas element; corrected to the actual app contract (stationary positions, no engine/art requests). These were harness assumptions, not reported passes.
- Production deployment, physical low-end hardware and subjective travel feel are not verified. No server/data/auth changes; no commit/push.
