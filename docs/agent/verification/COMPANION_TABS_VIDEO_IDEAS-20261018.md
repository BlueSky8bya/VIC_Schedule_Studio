# Companion116 — tab loading, corners and video continuity

2026-10-18 KST. Existing-defect fixes only. [Plan](../plans/PLAN-20261018-116-companion-tabs-video-and-ideas.md). New gameplay remains proposal-only in [36 scenarios](COMPANION_SCENARIO_PROPOSALS-20261018.md); no return-time learning, visit histogram, new personality or scene was implemented by this round.

## Findings and changes

- **Apparent whole-page reload:** delayed first environment-tab chunk reproduced the route loading UI and zero-sized hidden dialog/main while `performance.timeOrigin`, document count, navigation count and component node identity stayed unchanged. Next dynamic without a local loading boundary propagated suspension to the route. Add a small local loading status to `CompanionBehaviorSettings`; preserve the page, modal, focus and tab state. No navigation/auth/server change.
- **Clipped corners:** the transparent, borderless profile wrapper inherited a larger radius with zero padding and `overflow: clip`, clipping its inner rounded tab controls. Only this wrapper now permits visible overflow. Modal/book/finite collection-page clipping remains authoritative.
- **Portrait badge:** prior need/interest conditions could show a heart or another symbol. Always use the actual favorite-food atlas frame and accessible food name. Existing food-art proportions are preserved; no new asset or persisted data.
- **Sprint discontinuity, confirmed in encoded video:** row20 cycled side-running native keys33–35 into X eyes36, larger-eye37 and upright front-facing38 before returning to side-running. Shared whole-pose playback now repeats33–35. Both world and wardrobe use the same `companionMotionClips`. Original artwork, registration, mouth/accessory anchors, distance phase,14Hz limit and decode budget stay intact.
- **Dizzy expression discontinuity:** row22's latter half switched from native44's unsettled spiral face to smiling45 and a different silhouette. Select only44's existing eight rig slots in forward/back order. Existing recovery row23 and deformation remain unchanged. Frozen packing receipt is zero-based; review sheet key numbers here are one-based.

These are targeted playback corrections, not a claim that every pose has identical proportions or that original raster art received owner approval. Recovery→drooping mood changes remain intentional state changes; their abruptness is not treated as proof of a raster/particle defect.

## Evidence and limits

Ignored local evidence root: `.scratch-pw/companion-116/`.

- B0 retained115 build `OIZjTlrIDpT27UVZbZk0q`; B1 production build `pcqKEDObT5Y1W0ms0Fbgt`. No hot source substitution into the retained build.
- `ui/b0-corner/`: actual delayed-chunk whole-route disappearance on viewer notebook and studio settings; DOM identity/document/navigation stayed unchanged. This distinguishes loading propagation from actual full navigation.
- `motion/source-before/metrics.json`: all520 physical slots measured, detached opaque components0 at alpha≥200. This threshold cannot establish absence of all faint particles or semantic style defects.
- `motion/diagnostic-before/`: actual selector/sampler/CSS real-rAF film,79.4seconds/4,594 samples, zero blank/undecoded samples; all41 logical rows displayed, including labelled unused row7. Only452 of459 selector-reachable slots adopted; all520-source measurement is separate. Scripted row selection is technical playback, **not native gameplay**.
- `motion/review-movies/`: normal-speed and4×slow MP4 plus every encoded frame for sprint/dizzy/recovery/jump/held/sleep boundaries. Root directly inspected the sprint encoded-frame sequence; independent motion reviewer inspected native held/drop/recovery sequences.
- B0 viewer/studio native held: actual pointer handling with unmodified RNG/clock/geometry; full-resolution1920×1100 recording. No blank/undecoded/lost-node samples in the tracked finite sequences. Broader85.56second film reached sleep/interaction; its final center-cushion pointer click was obstructed by the pet and failed, so it is **not** a normal-eating/sprint PASS or complete gameplay coverage.
- B1 UI/video and final checks are recorded below when complete. No actual OBS/GPU/encoder/broadcaster-PC claim; user deferred that environment. Fixture/public-source review is not genuine-login RLS validation.

## Boundary, activity and independent review

Independent source review found no confirmed defect in the scoped UI or motion changes. Shared viewer/studio/notebook/settings and world/wardrobe consumers retain one implementation. No DTO, authority, server loader/action, KST policy, API, dependency, schema or collection reward changes.

G-22 audit: existing `companion-profile-page` fixed targets, pointer capture and explicit keyboard emissions remain; no new control/target/catalogue name. Favorite-food name is accessible DOM text only, never activity metadata. Playback curation creates no human timeline action; autonomous motions remain excluded from human actions/least-used counts. Automation guards and blocked fixture mutations remain.

## Verification status

- Scoped navigation/motion/selection110 units PASS.
- Typecheck, lint and B1 build PASS. Harness297 documents PASS; scoped `git diff --check` PASS.
- Two full-unit attempts:252files/2,727tests PASS, one unrelated art-catalog15second timeout each during concurrent heavy work. The npm retry did not forward the intended worker bound. Retain `unit.log` and `unit-final.log`; no timeout/test change.
- Final explicit `npx vitest run --maxWorkers=1`:253files/2,728tests PASS,115.19seconds (`unit-serial.log`).
- B1 native UI18/18 PASS:16 viewer/studio × notebook/settings ×1440/1050wide × light/dark, plus viewer notebook1050×780 light and real developer fixture→preview menu→viewer preview settings1440×780 dark. Actual delayed environment chunk keeps document/timeOrigin/navigation, node identity, visible modal/profile/navigation, BCR, scroll and keyboard focus. Favorite peach atlas badge, tab keyboard/subtab retention and bounded collection/wardrobe wheel behavior checked. Before/after same-view corner comparison restored51 clipped pixels on each side. Earlier narrow/developer-menu entry locator failures are retained as harness failures, not environment-tab product failures.
- B1 native held viewer/studio2/2 PASS. Broader native real-RNG/default-care dog/lively film observed395 sprint samples, actual crouch/rise/fall/landing and sleep/cozy behavior; no action error. Normal food consumption was not reached, so no meal PASS from this film.
- B1 technical after film:4,675samples/41rows/440adopted slots, errors/blank0. Whole-key sprint33–35 and dizzy44 confirmed in encoded frames; original packets unchanged. B1 native broad film2,062samples, requested sprint395/adopted393 use33–35; first2 retain prior look drawing while cold decode completes, never the offending X/front sprint keys. Hidden/undecoded0. Native viewer/studio held196/244probe samples and220/215 encoded frames: no hidden/undecoded/lost-identity sample. Full report `motion/영상검토기록.md`; playable short videos under `motion/review-movies-after/`: `sprint-key-jumps-normal.mp4` (technical), `native-sprint-jump-normal.mp4` and `viewer-native-held-tracked-normal.mp4` (native). No actual meal reached;25fps recording cannot prove absence of a transient at every60Hz display refresh.
- Final typecheck after the18-case harness extension PASS. Deployment remains pending at this checkpoint.

Protected unrelated `art-src/최초공개/응원단/제작기록.md` remains SHA256 `E980005102457E2A02AE318FF7665596E7170D0BFB34A328F64A6EC292C5990B`; unrelated untracked art/preview/references remain excluded.
