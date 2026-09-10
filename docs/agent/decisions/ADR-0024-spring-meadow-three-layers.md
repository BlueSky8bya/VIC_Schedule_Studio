# ADR-0024 — Spring meadow three-layer camera

Status: Accepted · 2026-09-11 KST

## Authority and scope

The owner accepted concept08's broad sky and elevated, expanded ground impression, then explicitly requested newly generated tree-free meadow F/M/N layers and runtime depth integration. The concept itself must not be used as the runtime background. This supersedes ADR-0023's single source F/M + procedural N implementation for spring meadow, PLAN-015's angle lock, and the shared .26 horizon requirement **only for spring meadow**. Other scenes retain .26; deep remains sealed. Full seasonal expansion is not included.

Spring meadow uses .35h horizon in a synchronous scoped view, restored with try/finally. WorldScene scopes factory, resize, step/weather, complete render/light and ground pointer calls. Shared view helpers and prop placement follow that scope; sky/fog cache keys include the horizon. No asynchronous callback may retain a view scope. Existing navigation transitions retain separate camera profiles per panel.

## Sources and composition

2026-09-11 owner follow-up [ROUND-23](../../ambient/rounds/ROUND-23-meadow-sun-foreground.md) supersedes wide-view vertical compression and the subsequent mirrored tile joins: ground uses height-based uniform scale, same-direction overlapping tiles with a baked margin blend. This preserves the full distance gradient without horizontal stretch or a mirror-fold seam. N uses several staggered groups from the existing source on the outer edges with an inward taper; the center remains open. Meadow daylight sun now uses absolute date-based altitude instead of a fixed horizon position, before cloud rendering. Other biome sun paths and the deep seal remain unchanged.

Subsequent scope extension: the owner requested summer/autumn/winter meadow before other biomes. [ROUND-22](../../ambient/rounds/ROUND-22-meadow-seasons.md) records nine new F/M/N sources and extends the .35 horizon to meadow in all seasons. Other biome defaults and role-specific exposure remain unchanged. Seasonal F/N use opaque magenta RGB mattes with measured clipping; spring's existing green-span mask stays intact. This supersedes the spring-only scope clauses for meadow only, without authorizing other biome work or another push.

Run09 generated three independent 1536×1024 sources from frozen concept08 mood reference. Ground09 was rejected for large repeating tufts; run10 supplies a quieter new ground. F is a low tree-free grass ridge, M is continuous ground, N is sparse corner grass. Engine sky/time/weather stay separate. Existing large spring shrubs/stumps are omitted; small spring flowers are reduced, and redundant legacy animated-grass backing is released after new art arrives. Creature interactions remain.

The generator returned **RGB mattes, not genuine transparent PNGs**, for F/N. Original bytes remain unchanged and are not represented as alpha-qualified deliveries. `ambient-meadow-layers.mjs` measures green-pixel row spans; runtime Path2D clipping excludes the matte during initial cache baking. This is a deliberate rendered-mask delivery path under the current implementation request, replacing the failed-alpha pipeline expectation for these backgrounds only; general entity alpha rules are unchanged. Check actual composited output for matte leakage. F's lower edge fades into the overlapping M ground; N draws only at outer corners.

F and N each have a ≤1MiB display-cache target (rounding tolerance), keyed by viewport/quality, not pointer/time. Decoded originals total roughly 18MiB RGBA before browser overhead; this is higher than the former 6MiB source. Expansive land does not imply a four-times-larger framebuffer. Existing M cache caps, full/lite/still policy, mobile-before-load gate and showcase-only motion remain authoritative. No claims of zero performance cost or measured GPU headroom.

## Verification and recovery

Owner subsequently tested the local result, accepted its direction, and explicitly requested push to inspect the real site (2026-09-11). This authorizes the current spring F-v2/M-v5/N-v2 release; earlier no-push statements below describe the preceding stage.

2026-09-11 subsequent owner feedback requests softer distant detail within M and less regular grass. Run11 was rejected for large tufts; run12 supplies ground-v5 with paler low-contrast distance and irregular smaller grass patches. The M crop now retains the complete vertical depth gradient: wide views compress the terrain vertically, portrait views crop only the sides. This replaces the initial uniform-scale crop, which cut away the near-ground portion on wide displays. F/N and their movement remain unchanged. Softness is painted into the source; no runtime blur pass is added. Original dimensions/decoded-memory estimate remain unchanged, while encoded ground size increases about 14.8% from v3.

[ROUND-21](../../ambient/rounds/ROUND-21-meadow-camera.md) records actual tests, visual review, performance and deployment status. Revert this scoped camera/three-layer integration together to restore ADR-0023's previous source; preserve all generated evidence. Authentication, roles, public loaders, KST date behavior and DB are untouched. The latest request authorizes implementation; no new production push is inferred from the earlier completed release.
