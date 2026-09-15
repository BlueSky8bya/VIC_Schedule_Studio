# R80 — Apply saved marine concepts

Owner requested immediate activation and push of saved open-sea/deep-sea concepts. Supersedes archive-only status of both images. Reuse shallow's static concept renderer for all three marine cells; runtime PNGs are byte-identical copies of archived generator outputs. No regeneration.

`sea` → `concept-open-sea-v1.png`; `deep` → `concept-deep-sea-v1.png`. Cover crop preserves aspect ratio without stretching. Decode is tracked; fallback matches each biome. Shared sealed branch respects the scene's foreground ownership so old decorative bars do not appear. Old procedural sea/deep fauna are no longer rendered. Deep remains isolated from weather and seasonal effects.

This is static concept activation, matching shallow. Seasonal sky/layers and wave animation remain future work. No change to public data, permissions, KST or map order. Owner authorized push.

A review compared both originals and four standard/wide rendered captures: no blocking visual defects, matte, gaps or repeated seams; wide deep crops vertical edges while retaining its central open-water composition.

Typecheck, lint, five biome unit tests and production build passed. Rendered sea/deep captures at standard and 2560×1080 viewports showed loaded images with no page errors. Two-second advance preserves each static image. Deep summer/noon/clear and winter/night/fog captures are byte-identical. Coast → shallow → sea → deep and reverse navigation passed. Evidence: `.scratch-pw/r80-check.mjs` and `r80-*.png`. Independent B/C reviews found no blockers; A visual review recorded separately below. Harness and diff checks passed. Source prompts and provenance remain in `docs/ambient/concepts/open-sea-v1.md` and `deep-sea-v1.md`.
