# R77 — Rocky shore

Owner accepted rocky concept and requested the same painted-wave motion as sandy coast. Implement four matched seasons, shared sky/weather/light and continuous depth. Protect rock surfaces with a cached water mask; sheltered pools receive smaller distortion. No flying decorations or creatures. Reuse sandy renderer and preserve sandy behavior. Verify pixels on rocks remain static while sea/pools move; four seasons, aspect ratios, night/fog, motion gates and fallback. No push requested.

## Delivered locally

- Four seasonal rocky assets use the shared coastal renderer, sky, weather, time and continuous depth parallax. Existing painted water deforms; no synthetic wave lines added.
- A cached mask from neutral summer geometry protects rocks in every season, including blue winter shadows. Sea receives full motion; sheltered pools about one quarter. Eroded edges fade motion before rock boundaries. Mask failure leaves water still.
- Existing full/lite 24/12 Hz budgets, pixel caps, still/reduced/pointer gates and WebGL fallback remain. Source and mask uploaded once in the measured run. No per-frame image readback or mask generation.
- Typecheck, lint, production build and nine focused unit tests passed. Ten rendered captures cover four seasons noon/clear and night/fog plus wide/tall layouts, with no page errors, creatures or drifting props. Evidence: `.scratch-pw/qa/r77/`, `r77-capture.mjs`.
- Two-second motion comparison: sea sample changed 69% of channels, pool 19%, sampled rock region 0%. Mouse motion, rocky→tidal→rocky, non-showcase stillness and WebGL-disabled fallback passed. Local headless draw mean 5.6ms, p95 14.1ms; not a hardware guarantee. Evidence: `.scratch-pw/r77-motion.mjs`.
- Independent A/B/C reviews found no blocking issues. A reviewed ten captures; B checked geometry/mask alignment and fallback; C checked seasonal lighting and performance gates. Color classification is conservative, not proof of perfect semantic segmentation at every shoreline pixel.
- Sandy regression passed: water changed 68.7%, dry sand 0%, navigation/still/fallback intact. Ambient selftest, harness verification and diff whitespace check passed on the fixed build.
- Public DTO, permissions and KST unchanged. Owner accepted and authorized commit/push on 2026-09-16. Deployment unverified.

## Next scope

Owner requested three marine biomes: shallow sea, open sea and deep sea. Add shallow sea between coasts and open sea; retain deep sea's existing season/weather isolation. Shallow sea concept should distinguish visible submerged bottom and clear turquoise water from open sea. No drifting decorations. This is the next design/implementation scope, not delivered in R77.

## Generation provenance

Built-in imagegen edits, copied unchanged to runtime PNGs. Reference: `C:/Users/im917/.codex/generated_images/01a08b85-9859-73e2-bac5-05ce6f2f5a1d/exec-7b72281b-e9c9-41fb-8d86-0b805f510b4c.png`.

Prompt template:
> Edit this exact approved rocky coast into a {season} runtime terrain layer. Preserve EXACT rock geometry, every tide pool, irregular shoreline and foam positions, camera, framing and fine pixel-painted style. {season instruction} Replace ONLY sky/clouds ABOVE the distant island outlines with flat pure magenta RGB255,0,255. CRITICAL keep all distant islands/headlands opaque, do not erase land above horizon. All rocks, sea, white foam and pool reflections must remain opaque. Same16:9 composition. No new objects, animals, plants, leaves, structures, text or UI. Neutral daylight. One image, not panels.

- Spring: Very subtly cool silver rocks, fresh muted green distant headlands, clear cyan sea.
- Summer: Preserve exact summer colors and rock details as closely as possible.
- Autumn: Subtle russet and ochre deciduous patches on distant headlands only, retain gray rocks and blue sea, no fallen leaves or orange rocks.
- Winter: Cool slate and silver rock, tiny restrained frost on dry high ledges only, distant dormant headlands. Open sea and rock pools remain liquid, no snow blanket or ice carpet.

Generated files share the reference directory. Runtime paths: `public/ambient/art/backdrop-rocky-{season}-v1.png`.

| Season | Generated file | Runtime SHA256 |
|---|---|---|
| spring | exec-49dc78da-1a1c-43c8-844e-be1cb28cbd5a.png | e493ba72925c5ab78f9cdde58e6a77af258ca7c8135ae15f77ff7777c9fdbb6c |
| summer | exec-99284b89-70b1-4a23-b6b0-81db942328e8.png | 1625167803a3ca700b3f435040166b6da3b167f2581c7d78bf1ed0e98b6edfff |
| autumn | exec-94d401ac-9fa4-4f60-b2f7-c24964639241.png | 605a950d785a401c97dd4b964d7d3fc753749c23a99448ebc4eaf1311b2e30bb |
| winter | exec-51210165-8919-4d27-aa35-64417d165382.png | f2bf460e50cfe517234449dde84031ed8dce2d38858f1934bfd91096cf780b61 |
