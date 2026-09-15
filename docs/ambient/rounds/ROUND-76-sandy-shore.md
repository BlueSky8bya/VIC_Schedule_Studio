# R76 — Sandy shore

Owner accepted the front-facing beach with sand in the lower third. Implement four matched seasonal scenes, continuous depth parallax, and subtle movement of the existing painted waves. No flying decorations, animals, or unrelated props. Owner authorized commit/push on 2026-09-16.

Layers: distant headlands, offshore water, surf/wet sand, dry sand. One continuous UV mapping avoids separated-strip seams. Water deformation fades out before dry ground and distant islands. Bounded GPU pass; still/lite/unsupported fallback. Shared sky, weather, time and KST remain unchanged. Verify all seasons, night/fog, aspect ratios, source upload reuse, dry-sand stability, navigation, reduced motion and WebGL failure fallback.

Benchmark: Mark Finch, GPU Gems chapter 1 (NVIDIA), https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models — independent wavelengths and speeds, geometric versus fine wave scales. Adapted to painted-image UV deformation; no claim of full fluid simulation.

## Implementation and verification

- `sandy.ts` replaces the procedural sandy scene. Shared sky/weather/light and uniform cover crop match delivered land/tidal scenes. Source detail is preserved; no new sprites or leaf simulation.
- One GPU texture samples the four semantic regions continuously: headlands, offshore water, surf/wet sand, dry sand. Independent wave frequencies deform existing paint only; mask is zero over islands and dry foreground. This is subtle image deformation, not breaking-wave fluid simulation or dynamic tide.
- Full/lite water update budgets are 24/12 Hz, unchanged frames reused, pointer changes immediate. Output/source pixel caps prevent unbounded allocations; no frame-by-frame image readback or source upload. Reduced motion/still uses cached 2D relief, unsupported WebGL falls back to the same established renderer.
- Typecheck, lint, production build and 8 focused tests passed. A/B/C visual/code review: no visual blockers; B requested fallback motion contract alignment, implemented and re-reviewed. Context loss can still switch visual fidelity/offset, but coordinates agree with the active renderer.
- Ten captures cover four seasons noon/clear and night/fog plus wide/tall viewports. `.scratch-pw/qa/r76/`. No page errors or matte holes observed.
- Two-second comparison: sampled water changed 68.7% of channel values, dry-sand sample changed 0%. Texture uploaded once. Local headless mean draw cost improved from ~27ms to ~4.8ms, p95 ~12.4ms; this is not a guarantee for all hardware.
- Live mouse movement and sandy→tidal→sandy navigation passed. Non-showcase amplitude zero; WebGL-disabled fallback rendered successfully. Evidence: `.scratch-pw/r76-motion.mjs`.
- Ambient selftest: an intermediate run overlapped a rebuild and saw an asset400/deep hash failure; final fixed-build rerun passed all checks.
- Permissions/public DTO/KST unchanged. Owner authorized release; deployment unverified.

## Generation provenance

Built-in imagegen; exact raw generated files copied to public assets. Accepted composition reference (actually viewed and attached): `C:/Users/im917/.codex/generated_images/01a08b85-9859-73e2-bac5-05ce6f2f5a1d/exec-2b84a9ee-502e-4e0c-b572-9b6a7de8dd6a.png`.

Season prompt template:
> Edit this exact accepted beach image into a {season} terrain layer for runtime. Preserve EXACT dimensions, framing, pixel-painted style, shoreline around65percent down, water/land boundary and all wave crests. Sand bottom35percent, sea middle, no diagonal layout. {season instruction} Replace ONLY overhead sky/clouds above sea horizon and distant headland outlines with solid pure magenta RGB255,0,255. All terrain, water, white foam and wet-sand reflections remain opaque and unchanged in position. No magenta within water. Neutral daylight for runtime lighting. No added animals, people, shells, driftwood, flying objects, text, or UI. One16:9 image, not a contact sheet.

- Spring instruction: Cool ivory sand, fresh restrained green distant headland vegetation and corner coastal grass. Clear pale cyan sea.
- Summer initial instruction: Preserve reference summer colors as closely as possible. Initial `exec-b9829da8-0bd1-4061-a88a-00598155ed38.png` rejected: islands omitted; retained at generator path, not used.
- Autumn instruction: Subtle tawny coastal grass and russet/ochre distant deciduous headlands with evergreen patches, sand stays pale ivory, not orange. Sea remains blue.
- Winter instruction: Cool pale sand with only subtle frost at highest dry corners, dormant straw grass, distant dormant headlands. Open saltwater is NOT frozen; no snow blanket. Foam remains natural pale white.

Summer replacement prompt (same accepted reference):
> Precise background extraction of this approved summer beach. Replace ONLY the blue overhead sky and its clouds with flat pure magenta RGB255,0,255. CRITICAL: KEEP ALL DISTANT ISLANDS AND HEADLANDS, their exact silhouettes and colors: left headland, tiny islands, right headland must remain opaque and visible against magenta. Do NOT remove land above the sea horizon! Every water, sand, foam, grass and land pixel should otherwise retain same appearance and position. Full same16:9 composition, one image.

| Season | Generated filename | Runtime asset | SHA256 |
|---|---|---|---|
| spring | exec-1a778ce7-12d1-49b8-918f-e78a3cb60bff.png | `public/ambient/art/backdrop-sandy-spring-v1.png` | 95ddaffdba1a2b24c6355a05edf15486fe967a1d8ad7a79c119138abf4855bfd |
| summer | exec-52d9d071-69ea-403b-a0d1-3966fcd3a3dd.png | `public/ambient/art/backdrop-sandy-summer-v1.png` | 19fdfbbb5ff7ad3a786a2b26e57c107a43d57d6974ea19184eec9ee43cd673d4 |
| autumn | exec-1e72d9c1-75d7-4258-9c4d-7f02c4188142.png | `public/ambient/art/backdrop-sandy-autumn-v1.png` | 53e835bae7dbc528f432801364ffd9d035f631c6d8523fd52cb463e141588873 |
| winter | exec-deabbb9b-65e6-445b-a1d9-c41eca72b571.png | `public/ambient/art/backdrop-sandy-winter-v1.png` | 5f0cba05e8ba43fcbe708615f275d8560ac11b492636c6bd58cdf3f096d5f55a |
