# 107 — 빅타민 소리·추억·옷장

2026-10-18 KST. Status: complete; authorized release/exact deployed UI verified. [Plan](../plans/PLAN-20261018-107-companion-sounds-moments-and-wardrobe.md).

## Result and boundaries

- Foods36→60, accessories6→12 including the supplied pixel sunglasses, twelve causal situation stamps in addition to twelve existing witnessed behaviors. Original ID order, care/ownership/discoveries and106 art bytes retained. Missing situation arrays migrate empty rather than inventing history.
- Situations distinguish finding a hidden companion, heart rejection, running tumble, food-trip, landing mishap, card bump, completed meal, home sleep, petting, gift arrival/opening and completed accessory antics. Request/RNG selection alone earns nothing. Explicit successful gift opening is itself the outcome even while settings pauses the world.
- Equipped items use finite item-specific choreography on the existing scheduler. No model/API request, independent permanent RAF, all-pose preloading or new dependency. Existing decoded-body adoption, direct-input/home/meal ownership, overlay/premiere/reduced/OFF/mobile boundaries remain.
- Dedicated sound tab controls master/volume/care/motion/discovery.13 synthesized finite semantic cues share the existing AudioContext, global master/volume and trusted activation. Hidden/quiet gates and bounded cue/voice budgets apply. Sound-only settings never restart the world. No downloaded audio.
- Fixed activity operations cover new sound controls and situation-book controls. Personal food/item/situation IDs, care data, schedule text and volume values stay out of analytics. No API/schema/auth/role change or production DB write.
- Unknown names, hints, rarity/chances and accessible identities stay `???`/silhouette until discovered. Selected details appear before long grids and remain sticky when deeper entries are selected. [Actual50 copy changes](COMPANION_COPY-20261018.md) include the removed gift explanation and 간식 naming; concise accessibility/storage/reset meaning remains. Two entries explicitly compare the new107 draft rather than claiming they were in106.

## Defects found during this change

- Corrected generated food04's moved waffle cell without altering native artwork.
- Corrected scarf/bell/old bow face coverage using actual pose bounds and mouth-safe placement, including rotated motion phases.
- Independent review found accessory antics missing the roamOFF gate and witnessed stamps lacking actual accessory-atlas readiness. Fixed start/continuation gates and bounded readiness for only the current equipped/pending-gift atlas. A late decode after replacement/clear is ignored; failed/unseen art cannot earn a stamp. Independent rereview found no remaining P1/P2 in the scoped diff.
- Removed a draft audio priority override so autonomous companion sounds cannot cancel unrelated UI/save sounds.
- Moved selected collection details before the60-item grid to keep the result of a click visible.

## Verification

Frozen product checks:223 unit files/2,358 tests PASS, production build PASS, explicit typecheck PASS and full lint PASS. Harness274 documents PASS. The initial concurrent unit run caught one stale test fixture while the roam gate was being changed; complete frozen reruns passed. Final production-fixture UI/audio26/26 PASS across viewer/studio/preview, light/dark, narrow desktop, deep selections, reload/reset/OFF/reduced and independent audio controls. Whole-dialog/viewport screenshots were visually reviewed. Runtime ten cases passed as detailed below; these local results are not a deployed-release claim.

Initial UI/audio run25PASS/1FAIL was preserved. Playwright's ordinary evaluate granted CDP `userGesture:true` during the preparation helper, contaminating the no-input audio assertion. The corrected test observes the initial document with read-only CDP `userGesture:false`: all three surfaces showed activation false and no companion sounds before real input. No product autoplay setting, clock or RNG was patched. Final26 all passed. Report: `.scratch-pw/companion-107-ui-audio-final-report.json`; screenshots `.scratch-pw/companion-107-settings/`.

Technical asset checks: both106/107 exact repacking,14 asset units, original-source SHA preservation. Actual product painter helper:6,240 mappings,252 static composites,132 motion samples; three neck items13,905 geometric phase checks. Pixel flags aid review, not owner/style approval. Native event coverage and numerical offline coverage remain distinct.

Staging found Windows CRLF normalization would change authored SVG evidence on checkout. Scoped `.gitattributes` preserves this run's SVG/JSON bytes; actual staged native8+receipt SHA comparisons all9 matched the frozen local bytes. Original artwork was not rewritten to match a changed hash.

## Native runtime evidence

Ten unique cases passed on the final production fixture build `Iomaazf3X3l4T5SyeHNdR`: two physical-gift/premiere-gate cases; two actual food-drop/meal/collection/reload cases; pixel sunglasses, baseball cap and scarf finite antics on both viewer and studio. Viewer actually ate raspberry; studio actually ate the new pancake. Both successful audio traces were exactly feed→land, with only the consumed food added. Six accessory sequences observed106–128 frames each over2.485–2.518s, prepare→show→settle, matching actual decoded/adopted physical and accessory pose, followed by the accessory-trick stamp. Both cap hops reached about26px; world x/y remained fixed while the projected body hopped. Writes/errors remained empty.

The first runtime run had7PASS/3FAIL: all three viewer accessory cases stopped before product input because a helper copied a280px-wide empty ray requirement from a horizontal cheer test. The actual accessory choreography does not move horizontally. The corrected helper measures the real DOM with spread0 and more x candidates while retaining170px headroom; failed three cases all passed separately on the same product build. No product geometry, clock, RNG, action or source was patched. Initial reports remain `.scratch-pw/companion-107-runtime/`; final three `.scratch-pw/companion-107-runtime-viewer-rerun/`. This is not described as one clean first run.

Food-trip/running-tumble cause preservation and resuming the same meal after mishaps are verified by production-domain tests in `viewer-companion-romp`, `viewer-companion-episodes` and `companion-collection`. This run does not claim native random observation of every possible situation or all520 poses. SFX policy/graph was tested, not actual speaker listening or broadcaster hardware.

## Release

Authorized main commit/push: `66cca4dcca8f4195f88d94898f38c7dab242e8e9` (`feat: add companion sounds and moment stamps`), scoped66 files. Protected user art-note SHA remains unchanged. Private original requests/contracts/reference copies, attachments and unrelated drafts/configuration were excluded. No force/reset/cleanup was used.

[Remote quality39106642196](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39106642196) completed successfully, all13 steps including full units, isolated SQL contracts, harness, production build, typecheck and lint. Vercel succeeded for this exact commit. At2026-10-18 16:13 KST the deployed public build endpoint returned the full SHA above. Clock200/no-store, warm204, anonymous developer presence401/error-only/no-store and production fixture nonexposure passed. The streamed fixture response is HTTP200 with the404 fallback marker; it is not claimed as HTTP404. Local evidence: `.scratch-pw/companion-107/deployed-canaries.json`.

Actual authenticated developer-studio tab was reloaded and displayed badge `66cca4d`. Native settings→빅타민 confirmed the enabled saved choice, dedicated sound master/volume60/three categories, food60, combined memories24 with separate situation12 panel, unknown identities and twelve wardrobe entries. No production collection grant, care reset, sound/preferences toggle or schedule edit was used for proof. Existing preferences were retained. Screenshots `.scratch-pw/companion-107/deployed-{sound,moments,wardrobe}.jpg` record actual production UI. Dialog closed; original November2026/right-folded panel restored.

This post-release bookkeeping remains local until the next authorized product commit, avoiding a documentation-only second deployment. Actual broadcaster hardware, speaker listening, genuine-login/RLS and provider quota coverage remain separate from these checks.

Actual broadcaster-PC/OBS hardware validation remains deferred by the owner. Fixture tests do not establish real-user RLS/device/provider quota coverage. Public boundary canaries and exact deployed SHA/UI are required after authorized release.
