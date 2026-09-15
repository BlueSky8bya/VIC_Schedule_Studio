# Marine biomes — resume here

Updated 2026-09-16 KST. Owner requested open-sea and then deep-sea concepts, followed by archiving and pushing all current work. Stop after this delivery; resume implementation in a later session.

## Current delivered state

- Meadow, hill, pond, valley, forest, mountain, tidal, sandy and rocky backgrounds have been developed in prior rounds. Their accepted design and mechanisms remain; avoid restarting completed work.
- Sandy coast: `ed8369c5`, [R76](../../ambient/rounds/ROUND-76-sandy-shore.md). Four seasons and painted-wave deformation, continuous depth movement.
- Rocky coast: `3e5b6c14`, [R77](../../ambient/rounds/ROUND-77-rocky-shore.md). Four seasons; rocks protected by a cached neutral-summer water mask, pools move at approximately quarter strength. No drifting props.
- [R78 shallow placement](../../ambient/rounds/ROUND-78-shallow-concept.md): twelve map cells. All three coasts → shallow (`gy=2`) → open sea (`gy=3`) → deep (`gy=4`). Return path remembers the originating coast; marine left/right blocked. Existing saved biome string keys preserved.
- `public/ambient/art/concept-shallow-v1.png` is connected as a **static concept preview** via `scenes/shallow.ts`. Painted sky is part of the image. It deliberately bypasses weather/light and inherited foreground overlays; this is temporary preview behavior, not the final shallow-sea specification. No creature or decorative particles.
- Open sea concept is archived separately under `docs/ambient/concepts/open-sea-v1.png`. Owner subsequently requested activation: [R80](../../ambient/rounds/ROUND-80-marine-concept-activation.md) connects it as a static preview via the shared marine concept renderer.
- Follow-up: owner requested a deep-sea concept as well. Saved [deep-sea-v1](../../ambient/concepts/deep-sea-v1.md), a side-on dark underwater background with creatures omitted; owner accepted archiving and authorized pushing this follow-up. Owner subsequently requested activation: R80 connects it as a static preview, replacing the old procedural scene while retaining isolation. Seasonal packs are not needed for this concept.

## Next session order

1. Read this handoff and R78. All three saved concepts now display in their corresponding runtime biomes. Show those scenes; continue from the owner's visual feedback rather than regenerating by default.
2. Implement shallow seasonal runtime layers from the accepted composition. Separate sky from terrain/water. Replace temporary sealed preview behavior with the common sky, KST lighting, weather and solar direction mechanisms.
3. For shallow water, keep submerged sand/rocks visually anchored while moving painted reflections/surface detail gently. Do not add independent horizontal wave strokes. Use the established coast renderer where its assumptions fit; sandy's shoreline envelope is not automatically correct for full-screen water.
4. Implement open sea only after its concept direction is settled: no visible seabed, wide open swells; shared season/time/weather and full water-surface motion. Retain the absence of drifting objects/creatures for these remaining biome backgrounds.
5. Deep: use the saved side-on concept when owner resumes its implementation; separate near/far rock silhouettes and open water, keep creatures separate and preserve existing isolation. No seasonal pack is required. Test coast → shallow → sea → deep and return, including direct minimap selection, keyboard navigation and older saved biome keys.
6. Validate four seasons, noon/night/fog, wide/tall aspect ratios, continuous depth, no sky or layer seams, no initial-load flashes, no stretching, reduced-motion/still/lite and automatic performance modes. Keep source/mask uploads cached; no per-frame image readback.
7. Run applicable typecheck/lint/unit/build and rendered interaction checks, plus independent A/B/C review per ambient README. Do not rebuild during fixed-build QA. Push only when authorized in that session.

## Evidence and limits

Follow-up: concise loading copy and hidden-studio click isolation are recorded in [R79](../../ambient/rounds/ROUND-79-showcase-input-isolation.md); owner authorized their push. Loading shows only destination + `으로/로 이동중..`. The prior copy-only typecheck/lint/build and rendered 초원/먼바다/갯벌 checks passed; R79 owns current input regression evidence.

R78 was pushed as `27215d88`. This follow-up changes archive documents and saves the deep concept only; no runtime code changes. Document harness, whitespace and source-image hash checks apply; earlier runtime tests were not rerun for this archive-only change.

R78 typecheck, lint, production build, five biome navigation unit tests, twelve rendered minimap buttons, shallow selection, marine traversal and coast return passed. Final captures `.scratch-pw/r78-preview.png` and `.scratch-pw/r78-map.png` are local evidence, not durable release assets. R78 A/B review found no blockers; C found inherited water bars in the sealed foreground, fixed specifically for shallow and checked in final capture. Harness/diff checks passed. No production DB tests; public DTO/permissions/KST unchanged. Deployment remains unverified.

Local fixture: `http://127.0.0.1:3100/visual-fixture/biome?biome=shallow&season=summer&band=noon&weather=clear&seed=42&t=1500&camera=showcase&gfx=auto&load=auto&live=1`. If restarting, use `VISUAL_TEST_FIXTURE=1`; inspect the owning process first. Do not rely on old session IDs.

Unrelated `.vscode/` and `preview-360.png` were present before this work and are excluded from this release.
