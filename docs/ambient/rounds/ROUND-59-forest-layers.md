# R59 — Forest seasonal layers and rooted occlusion

2026-09-15 KST. Owner approved forest composition and requested careful tree separation for future animals emerging between trees. Implementation complete locally; visual feedback next. No commit/push requested.

## Delivery

- Four 2172×724 ground/far-woodland panoramas and four 1254×1254 isolated tree atlases. Exact requests, frozen inputs, original bytes and runtime SHA256 receipts: [art run](../../../art-src/배경층/숲/작업회차/20260915-분리레이어-시안02/request.md), [delivery](../../../art-src/배경층/숲/작업회차/20260915-분리레이어-시안02/delivery.json). Composition authorization applies to these forest layers, not the separate pine catalogue.
- Eighteen rooted instances from four tree forms. Central clearing/sky stay open. Source-space ground contours drive material size, fading, speed and parallax; each standing tree and contact shadow shares its root transform. No horizontal stretching or terrain-strip deformation of trees. Two near edge roots stay visible on narrow desktop crops.
- Trees and seasonal material interleave by root/foot y. Existing disabled animal path also merges at each actor foot, avoiding the future actor-behind-tree ordering bug found by B. Actual animals remain disabled. Future animals must use this queue and surface anchoring.
- Canopy interior key color is removed; mixed edge magenta is neutralized. Alpha-aware picking rejects hidden material and compensates for tree/material parallax differences. Held material stays in front while dragging.
- Forest joins existing KST/shared sky/weather, seasonal material wind/grab physics, relief cache and destination-ready world travel. Mobile/still gates unchanged. No water graphics, new animal assets, permission/DTO/server changes.

## Verification

Final code: typecheck, lint, production build, 92 files / 908 unit tests PASS. Build public-loader error diagnostics from unavailable fixture build data are unchanged; build exits zero. No production DB writes performed.

Production fixture captures and assertions in local `.scratch-pw/qa/r59/`:
- Four seasons, noon/night; passive movement, grab/drag/release; no browser errors.
- 900×1100, 2560×1080, 3840×1080 crops; pointer parallax; meadow→hill→forest→valley→pond→meadow transitions.
- Reduced motion unchanged positions/zero ground offset; mobile zero ambient art requests/no engine; ground-source failure and tree-atlas failure independently recover; low-load cloud/rain/fog/wind/snow.
- Actual summer/winter atlases rendered with temporary colored probe: trunk hides behind probe, front probe overlays trunk, canopy hole exposes behind probe, root parallax retains occlusion, disposal clears canvases. No probe/animal added to product.
- 90 full/lite frames: relief bakes remain 1; relief caches 12,100,792 / 2,576,640 bytes. Ground source 6,290,112 bytes, field 198,404 bytes, tree canvases + alpha 7,719,030 bytes per loaded forest. Atlases decoded/keyed once; no per-frame pixel reads. Full scene/device FPS and OBS remain unverified.

Independent B cleared current root/picking behavior and identified future animal ordering, now corrected. C cleared seasonal/time/lifecycle/mobile integration. A visual review recorded in art review. Owner visual approval of final runtime remains separate from these checks.

## Owner density refinement

Owner found only two foreground trees perceptible. Added eight inner-edge roots and staggered middle trunks; reduced the two foreground heights from .66/.60 to .51/.49 so their crowns no longer hide nearly every middle tree. The central clearing narrows into the forest, with multiple visible trunks on both sides. Existing four atlas forms reused, no additional downloads or sprite memory. Root ordering/season mechanisms unchanged.

Refinement verified: typecheck, lint, 3 forest unit tests, build; refreshed four-season noon/night and grab/drag/release; 900/2560 desktop captures; 90 full/lite frames retain one terrain bake and unchanged cache bytes. Earlier full908-suite result applies to pre-refinement code; only root coordinates/count and corresponding unit expectation changed. B/C independently found no ordering/lifecycle regressions. Final owner visual feedback remains pending.

A refinement review: visible middle trunks and overlapping crowns now read as forest on both sides; center/sky preserved, winter depth improved, no new root/seam defect. Repeated tree forms remain a nonblocking visual preference.

## Owner natural-layout and root-join refinement

Owner found the denser layout orchard-like and roots pasted onto grass. Replaced paired rows with asymmetric clumps and larger variation in tree age/height, leaving uneven openings. Original seasonal atlas bytes remain unchanged.

Root joins now reuse a small patch of that exact location's seasonal ground, feathered with an uneven upper edge and clipped to original tree alpha. This softens the foot boundary without painting over surrounding material. A soft radial contact shadow replaces the hard ellipse. Patch and tree share root motion; patches cache by viewport/source version and release on rebuild/dispose. Per-patch cap 256×64. B identified potential hidden-leaf picking mismatch before silhouette clipping; fixed and independently rechecked.

Validation: typecheck/lint/build passed; 3 forest unit tests passed on the final code. Actual final summer/winter probe passed root occlusion, canopy-hole visibility, parallax and disposal. Sprite+patch memory 7,811,522 / 7,809,682 bytes at 1400×860, about 90KB above atlas-only. Final four-season rendered interaction, 900/2560 crops and full/lite no-rebake checks passed; evidence in `.scratch-pw/qa/r59/`. A capture attempt during build timed out; rerun against restarted final production fixture. Physical-device FPS unverified.

Final A review: size/spacing/overlap reduce row-like appearance, root joins improved without visible rectangular patches or floating gaps. Repeated branch forms and side-corridor composition remain; natural-forest preference needs owner reassessment, not claimed fully resolved.

## Owner replaces central-clearing constraint

The latest explicit owner request supersedes the earlier central clearing/corridor requirement for forest. Keep sky above the canopy, but populate the middle of the forest. Added seven staggered central trees at far, middle and near root depths (25 total), breaking the long sightline through grass. This replaces the previous empty-center test with multi-depth central occupancy. No new images, mechanics or API changes.

Typecheck/lint/build and 3 forest unit tests passed. Wide/narrow rendered captures and full/lite no-rebake checks refreshed. B confirms ordering/depth correctness, C confirms unchanged seasonal/lifecycle gates; only bounded tree draw/picking work increases. Final interaction evidence is recorded after choosing visible leaves rather than the old fixed position now covered by a central tree.

Final interior-layout interaction: four seasons passive movement/grab/drag/release passed with no browser errors. Initial old fixed-coordinate pick hit a newly occluded material; QA now tries visible foreground candidates while input is live, keeping the hidden-object protection intact.

A final interior review: both1400 and2560 show overlapping center trunks/crowns at multiple depths; former corridor broken into small gaps, sky retained, no new root/crop/join defect. Repeated atlas forms remain visible.
