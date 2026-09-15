# Hill runtime and directional travel

Status: Completed

Owner accepted hill concept 01 and requested meadow-equivalent continuous depth motion, seasonal mechanisms and directional biome travel. Scope: hill four-season terrain, reuse meadow shared seasonal simulation/sky/weather, destination-ready travel. No trees/creatures/decor; deep remains sealed, ordinary calendar remains meadow. No push requested.

1. Generate seasonal terrain from accepted composition; preserve source/run evidence. Keep sky dynamic.
2. Add hill backdrop with aspect-preserving framing and continuous near/far surface motion. Reuse autumn shared engine with hill horizon; no duplicated seasonal physics.
3. Improve existing 620ms direction transition, hold source until destination ready, preserve reduced/static/mobile gates.
4. Type/lint/tests/build, fixed-fixture screenshots and interactions for four seasons and travel, independent A/B/C review. No backend/auth/DTO changes; existing viewed-month KST selection remains authoritative.

Approved composition overrides historical hill .26 horizon / procedural bands and decorative placement for this rollout. Sky space approximately .42; new terrain remains original generated raster, rendered with continuous depth sampling. Risks: alpha edge seams, ultrawide stretch, cold-load blank destination, cached frame budgets, coordinate inverse when picking.

Result and verification: [R51](../../ambient/rounds/ROUND-51-hill-runtime.md). Fine continuous slices replace literal three separate terrain images to avoid cracks. Panorama replaces first repeated-tile approach. Local runtime complete; owner visual feedback next. No push.
