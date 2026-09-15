# R75 — Tidal flat seasonal background

Owner accepted the tidal concept and excluded drifting decorative objects from remaining biomes. Four seasons now share matched channels/islands, runtime sky/weather/light and contour depth. No leaf engine, creatures, or hand-drawn moving water lines. Owner accepted the local preview and authorized commit/push to main on 2026-09-16. Deployment remains unverified.

## Implementation

- `scenes/tidal.ts` replaces the legacy procedural tidal scene. Terrain bakes only on size/DPR/source changes; relief masks are cached and quality follows shared automatic settings.
- The four PNGs retain near mud detail, soft distant islands, opaque water and a magenta sky matte removed by the existing runtime extractor. Uniform cover cropping preserves proportions.
- Shared lighting changes saturation and color with time/weather. Rain, snowfall and fog remain; wind debris is disabled for tidal/sandy/rocky/sea. Deep stays sealed.
- This is a static low-tide composition, not a tide or water-flow simulation. It supersedes the old procedural tidal decoration/wave treatment in BIOME_GRAMMAR §7 for this delivered background.
- Public data, permissions and KST behavior are unchanged.

## Verification

- Typecheck, lint and production build passed.
- 12 focused tests passed (coast debris/weather, biome navigation, terrain perspective).
- Ambient QA selftest passed, including deep seal and deterministic time/seed.
- 10 rendered captures: four seasons × noon/clear and night/fog; 2560×1080 and 900×1200. Art ready; leaves/creatures zero; no page errors.
- Live mouse movement confirmed depth offsets far=3px, ground=7px, frame=14px. Relief bake count stayed 1. Hill→tidal return passed.
- Evidence: `.scratch-pw/qa/r75/`; capture scripts `.scratch-pw/r75-capture.mjs` and `r75-motion.mjs`.
- Independent A/B/C review: no blockers. A notes spring/summer are intentionally similar and seasonal differences become subtler at night.

## Image generation provenance

User accepted concept: `C:/Users/im917/.codex/generated_images/01a08b85-9859-73e2-bac5-05ce6f2f5a1d/exec-2ea18406-3f2f-4935-b933-65c72a0ee57f.png`.
Built-in imagegen edited this same reference independently for each season. Delivered PNGs are byte-for-byte copies of generated outputs; no scripted image repainting.

Shared prompt (substitute season and seasonal instruction):
> Edit this exact approved tidal-flat background into a {season} runtime terrain layer. Preserve EXACT framing, 16:9 aspect, island silhouette, distant horizon, every winding channel and foreground bank shape and scale. {season instruction} Replace ONLY sky and clouds above island silhouettes and sea horizon with perfectly flat pure magenta RGB255,0,255 matte. Preserve water including reflected pale sky within water, no clouds remaining overhead. All terrain and water opaque. Keep original fine pixel-painted style, foreground sharp and distance softer. No text, UI, people, animals, flying leaves or decorative objects. Keep light neutral daylight so shared runtime light can change time. One image, not a sheet.

Season instructions:
- Spring: Early spring cool silver-gray moist mud, clear shallow tidal pools, restrained fresh vegetation on distant islands. No snow blanket.
- Summer: Preserve reference summer terrain/colors closely; moist silvery mud/delicate pale-blue reflections.
- Autumn: Slightly warmer muted gray-taupe dry mud ridges, silvery wet channels, distant island ochre/russet with muted evergreen; do not make all mud orange/brown.
- Winter: Cold silver-gray mud, subdued steel-blue water, very subtle frost highest dry ridges and thin translucent ice ONLY sheltered shallow pool margins, broad saltwater channels unfrozen, no snow carpet/falling snow, distant dormant islands.

| Season | Generated filename | Runtime asset | SHA256 |
|---|---|---|---|
| spring | exec-cf9d6fee-89c1-41ed-9f28-df44a133602f.png | `public/ambient/art/backdrop-tidal-spring-v1.png` | 6482b160debd9fc3b08db56a951f5634f89a3f3133124f9050db83b5c2008446 |
| summer | exec-6b12012a-ed31-485c-a41a-2eda8e835ef9.png | `public/ambient/art/backdrop-tidal-summer-v1.png` | 80909da7e4cb553b2a7dbe37676544e5b910b9ce56ddc75c7e58252360b70374 |
| autumn | exec-7dfd729f-ce35-4b32-b7f5-3e1a8ae30e17.png | `public/ambient/art/backdrop-tidal-autumn-v1.png` | eb83e11d01d99168a3e94f9c2769a970d9f905382b36b9da05ef217c81f0508a |
| winter | exec-010301e7-eb76-4103-86da-df447aa922ef.png | `public/ambient/art/backdrop-tidal-winter-v1.png` | fa07beeaf30f07bd9eed4050cf0f8949deb2e7db8401a3fcc638f3e6eaf9ced7 |
