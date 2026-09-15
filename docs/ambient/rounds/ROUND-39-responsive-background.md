# R39 — Responsive background startup and soft ridges

2026-09-15 user: calendar should remain usable during background loading; soften all seasonal ridge silhouettes. Trees wait until other biome base designs are ready. Default showcase exit returning to actual KST is accepted; existing prior-override restoration preserved.

Plan: defer engine import/mount beyond hydration, recheck cancellation/mobile/off gates after imports; yield image composition between stages without exposing unfinished layers. Soften already-matte-free far ridge only. Verify delayed assets still permit calendar navigation/settings, rapid month changes do not mount stale scenes, mobile excluded, default exit live KST; capture four seasons. No push requested.

Status: locally verified, awaiting visual feedback. Public data/auth unchanged; no push requested.

## Findings and verification

- Background has no input-blocking overlay (canvas pointer-events none). Engine was mounted directly from hydration effect. It now imports/mounts in a later task with mobile/off/dispose checks before and after import; decoded backdrop composition yields between layers and before near-detail. Full readiness stays atomic, preserving no old-texture flash.
- Initial build route JS decreased: studio fixture 279→267kB; poster fixture 185→173kB (Next build estimates, not measured page latency). Individual synchronous paint stages still cost CPU; this does not promise zero stalls on all devices or remove image download time.
- Far ridge uses 3.5px blur on cleaned source only, high quality resampling, edge-column padding to avoid transparent tile gutters. Near ground detail unchanged.
- Build/lint/typecheck PASS; unit suite 83 files / 868 tests PASS. Two permanent browser tests PASS: current KST restoration after time/season edits and March–December season mapping; images held pending while calendar advances three months and settings/Escape remain usable, with final summer scene after release.
- Eight final four-season noon/night captures `.scratch-pw/qa/r39/final`: zero browser errors. Delayed/missing near-detail checks retain atomic readiness/fallback (aborted optional image produces expected network error). Mobile 390×844 has no engine or art requests.
- Independent C flagged pre-import gate race, fixed with a second gate check before importing. B found no atomic readiness/disposal issue. A identified tile-edge gutters, addressed with clean edge padding; final review recorded below.
- A final: all eight captures show softer contours and improved alpha gutters, no new matte/halo/ground artifact. Small source tile endpoint-height steps remain (x≈378/1023 at 1400px); not claimed fully seamless. Further source silhouette blending needs separate visual comparison rather than extra blanket blur.

Next: other biome base designs before tree placement. Existing pine reference curation is a separate owner-controlled workflow, not authorization to place trees now.
