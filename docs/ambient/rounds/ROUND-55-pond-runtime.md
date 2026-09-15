# R55 — Seasonal freshwater runtime

2026-09-15 KST. Owner approved the open-lake concept and authorized meadow/hill-equivalent implementation. Owner authorized committing and pushing the verified implementation on 2026-09-15.

## Delivery

- Four original 3:1 summer/spring/autumn/winter landscapes, generated with built-in image_gen from the approved concept/frozen summer panorama. Source requests, actual input roles, dimensions and SHA256 lineage: `art-src/배경층/민물/작업회차/20260915-사계절광폭-시안02/`. Runtime copies are byte-identical. Spring2171×724, others2172×724; normalized source geometry handles the one-pixel difference. Source bytes total6,925,252; only active season fetched.
- Reuse the shared meadow/hill seasonal material simulation, scene lighting, actual KST sky, bounded relief caches and pointer inversion. HillBackdrop accepts pond configuration; skyline matte scan begins at the top so the leftmost high shore is not flattened. Meadow/hill/pond now share ready-gated travel and common sky projection during transitions.
- Source-space pond depth contours and conservative water bounds follow far shore, left peninsula and curved near bank. Seasonal leaves/petals/dry grass remain interactive. Legacy pond animals, lily pads and props are not loaded via the new scene.
- Live subtle water highlights and one actual sun/moon reflection path, clipped inside the water with same terrain parallax. Wind affects small ripple movement, overcast suppresses glints. Moon reflection also applies after sunset. Winter's full pale-blue ice stays still and distinct from snowy land; winter material still uses the shared wind engine.
- Water has144 preallocated marks, up to90/full or35/lite at load1 plus40 reflection strokes, one cached clip path, no full-size framebuffer. Time advances only in active simulation; reduced/still freezes it. Terrain textures keep12/3MiB budgets and 2-scene pool.

## Verification

- Build/typecheck/lint passed. Full89files/897unit tests passed, including shore containment, softened edges/crop invariance and near/far distance ordering. No public DTO, permission or KST data changes.
- Production fixture:4seasons×day/night, passive movement and grab/drag/release;900×1100,1400×860,2560×1080,3840×1080; meadow→pond→hill→meadow night travel; pointer parallax; failed source fallback; reduced; load.2 weather; mobile0art requests/noengine. Browser errors none.
- Explicit90frame water checks: summer time advances, winter time0/marks0, reduced time0; no extra relief bakes. Full summer relief12,103,152bytes, lite2,734,752bytes. Water framebuffer0.2Playwright showcase reset/pending-image interaction tests passed.
- Independent A inspected8screens: no visual blocker, winter ice distinct, no matte/sky gaps, pond remains open. B initially reported stale skyline/leaf issues; re-read current source and withdrew both (top-down matte scan and separate drawAirborne verified). Shore geometry/crop/relief cleared. C cleared bounds/time/perf; twilight moon-reflection suggestion applied.

Evidence: ignored `.scratch-pw/qa/r55/{interaction,water-checks.json,travel-checks.json,gates.json}` and water/day/night/crop captures. Owner runtime feedback pending. Water is a stylized highlight/reflection layer over generated water texture, not fluid simulation or live scene mirroring. Geometry is authored approximation; conservative water interior deliberately excludes uncertain shallow edge pixels. Physical low-end devices/production deployment not verified.
