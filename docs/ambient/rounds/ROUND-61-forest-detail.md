# R61 — Terrain-relative tree detail

2026-09-15 KST. Owner reports tree/ground resolution mismatch and requests high near detail, lower distant detail on the same depth basis.

- Preserve R60 ground source and foreground quality. Forest trees use their root's `HillBackdrop.distance`, the same authored field used by material size/motion. Screen detail pitch varies continuously from3.2px at far roots to0.95px at near roots; full retains up to native source detail. This is detail matching/sampling, not generation of new high-resolution artwork.
- Each complete tree uses one sampling scale, avoiding a quality seam across trunk/crown. Image position/size/parallax unchanged. Low-resolution variants have smooth image sampling, so tiny distant branch/leaf noise merges rather than staying sharper than nearby ground. Existing seasonal materials keep shared terrain-distance blur/scale behavior.
- Bake once per viewport/source-version/quality-tier. Full/lite/still extra detail canvas+alpha budgets8/3/1.5MiB before allocation, plus original atlas/contact caches. No per-frame pixel processing. Draw, alpha picking and root-contact masks all use the same cached sampled tree; draw/pointer receive identical tier. Resize/tier/dispose clears old variants.

Validation: typecheck/lint/build and4forest unit tests passed (monotonic continuous pitch, native near samples, smaller lite budget, existing masks/root order). Four-season noon/night grab/drag/release passed, no browser errors. 900/2560 crops inspected.90full/lite frames keep detailBakes=1 and terrain bakes=1; detail bytes5,325,580/3,053,400, total forest caches13,171,990/10,899,810 at1400×860. Actual summer/winter image probes pass front/back trunk occlusion, canopy holes, root parallax and disposal. Evidence `.scratch-pw/qa/r61/`. Device FPS and production unverified; no push requested.

B cleared root-field and sampled-alpha alignment. C cleared cache ownership, bounded allocation and tier propagation. A rendered comparison recorded below. Final visual approval belongs to owner.

A compared summer before/after: excessive middle/far microtexture reduced, near bark/leaves and root join preserved, no new gaps/matte. Far appearance is smooth focus-like sampling rather than coarse nearest-neighbor pixels; strength remains owner visual preference. Main also inspected winter daytime.
