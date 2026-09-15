# Forest layers and occlusion

Status: Complete (local implementation); owner visual feedback tracked in CURRENT_STATE.

Owner approves forest composition and specifically requires individually rooted trees, canopy holes, future animal front/behind ordering and rendered occlusion probes. Deliver seasonal forest ground/far woodland plus separate tree atlas per season. No animal assets or push.

1. Preserve concept; generate ground without foreground trees and separately isolated tree silhouettes. Four seasonal sets retain geographic/anchor identity.
2. Shared scene/terrain/material/sky; separate root-anchored trees merged into the material draw order. Alpha-aware hidden-object picking. No ground-band deformation of standing trees. Bounded loading/cache/disposal; mobile/still gates unchanged.
3. Test actual behind/front and canopy-hole occlusion with a temporary fixture probe, root parallax alignment, seasonal grabs, crops/night, type/lint/tests/build and independent review.

Verification and limitations: [R59](../../ambient/rounds/ROUND-59-forest-layers.md).
