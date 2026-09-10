# ROUND-32 — Meadow surface parallax and soft ridge

Owner request 2026-09-11: avoid a single trembling ground plane. Keep distant surface nearly fixed, gradually increase movement toward the viewer, soften the cleaned ridge silhouette without restoring magenta.

- Meadow ground uses 64 full /24 lite depth bands with continuous distance weights .04→.70. Shared device-aligned destination boundaries avoid overlapping translucent strips/gaps. Existing baked opaque ground and bounded cache reused; no pointer-triggered rebakes.
- Far/frame meadow plates use matching surface-distance offsets. Other biome projection and all motion/mobile/deep gates unchanged.
- Far ridge is blurred once after source matte exclusion (1.6 source pixels), with smooth minification; original RGB matte never sampled. Near ground detail remains intact.
- Ground-bound flowers, pressed grass, trace items, mounds and footprints use matching foot-depth anchors. Autumn leaves/acorns/squirrel and winter rabbit include their shadows in the same correction. Meadow input coordinates invert the surface projection; other biome inputs remain unchanged. Future standing entities must use the same anchor helper. Flying spring creatures retain their existing airborne path rendering.

Final build o0_ZuI5PWds7Yqvj_gIsM. Build, explicit typecheck/lint and diff check passed. Full suite before anchor/input refinement: 79 files /841 tests passed. Final targeted projection/world/depth tests: 29 passed, including inverse mapping across surface depth. Initial movement/cache/mobile checks: 33 passed; intermediate deterministic selftest all 3 scenarios passed including deep seal. Final noon/night pointer extreme captures have no page errors.

A/B/C review identified fixed-prop drift, input mismatch and narrow edge extrusion traces. Addressed with anchors, meadow-specific inverse projection and reflected edge texture instead of repeating one pixel column. All four seasons viewed at center/left/right; final night summer/autumn/winter extremes captured. No observed magenta ridge, obvious full-width seams or gaps. Evidence: .scratch-pw/qa/r32/{final2,gates} and seasonal PNGs. Real-device motion comfort remains owner visual feedback; no claim of fully continuous geometric mesh rendering.

No commit/push; local fixture remains on3100.
