# ADR-0022 — World depth and showcase motion

Status: Accepted · 2026-09-10 (KST)

## Context and authority

The owner accepted the decisions in [PLAN-20260910-015](../plans/PLAN-20260910-015-world-depth-layers.md), then authorized implementation with “P0 가보자”. P0 changes the existing procedural renderer, fixtures, quality control and their verification. Generated backdrop art starts separately with spring meadow in P1.

## Decision

- Keep terrestrial/coastal 3/4 view and side-on deep sea. Keep the viewed calendar month's season, existing KST services and six time bands. Deep sea remains season/weather sealed and owns its time response.
- Compose each world panel completely before camera composition. WorldScene owns scene weather particles, haze, above-ground objects and light; the outer engine skips these passes for `Scene.composed`. A sealed panel bypasses terrestrial weather/light even during a transition.
- Fixed sky S, distant scenery F, ground/objects/shadows M and a sparse procedural foreground N share scoped rendering transforms. Inverse M coordinates govern pointer hits and exclusion rectangles. Mountain group ① belongs to F; ②–④ and standing objects retain M geometry and occlusion.
- Pointer movement uses bounded analytic exponential convergence (tau 0.12 seconds). At 1400px, full offsets are F 3/0, M 8/2, N 16/4 px; lite uses 1/0, 4/1, 4/1. Narrower desktop widths reduce these amplitudes. Missing mouse input centers the pose; touch does not create parallax.
- Preserve the 620ms camera transition and graph. Freeze the initial parallax pose during a pan and fade it to zero. Each panel has its own clip and atmosphere. Reduced motion arrives immediately.
- Decorative simulation runs only in showcase. Elsewhere, dt=0 initialization, bounded late-art retries and a minute-level KST refresh keep a stationary scene current. Mobile uses `MOBILE_QUERY` before engine creation, so scene modules/art are not requested. Portrait and short coarse-pointer landscape share the gate.
- Keep graphics preference default `auto`; preserve `max`, `lite`, `off` and persisted device classification. Extend the existing raw RAF/load controller with temporary full/lite/still quality and bounded recovery probes. Do not infer operating-system load percentages or identify other applications.
- Cache padded low-resolution scenery; no runtime blur or scene screenshots. Bound each allocation before creating the canvas, with an LRU pool. Only active/transition procedural foreground buffers stay allocated. Exact measurements and remaining limits belong to the P0 QA record.

## Replaced clauses and retained boundaries

This partially replaces ADR-0017's undifferentiated background composition and motion availability, ENGINE_RULES AMB-09/10/13/27 and BIOME_GRAMMAR's single-background layer interpretation. Its camera, ecology, pixel-art palette, low-resolution soft effects and server security contracts remain. SYSTEM_MAP remains historical architecture evidence; current ownership is this ADR and executable Scene/WorldScene interfaces.

The open-sea water origin now uses the shared `horizonY(h)` (0.26h), replacing its local additional 0.06h. All water positions using that origin follow the same boundary.

P0 adds no backdrop manifest slots, generated image, delivery promotion, production data operation or permission change. The eventual 123-image art contract remains the accepted plan's P1/P2 work.

## Verification and recovery

See [P0 execution record](../../ambient/rounds/ROUND-18-depth-P0.md). Revert the P0 implementation as a unit to restore the previous procedural composition; do not revert unrelated owner assets or other active work. Browser fixtures establish rendering behavior, not genuine-device GPU, authentication or RLS coverage.
