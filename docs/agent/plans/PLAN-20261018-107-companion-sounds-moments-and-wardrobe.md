# 107 — Companion sounds, moments and wardrobe

Date:2026-10-18 KST. Status:complete; released `66cca4dcca8f4195f88d94898f38c7dab242e8e9`, exact deployed UI/boundaries verified. See [verification](../verification/COMPANION_SOUNDS_MOMENTS-20261018.md). Post-release bookkeeping stays local until the next authorized product commit.

## Current owner request

Add fitting companion sound effects with controls in the companion settings; make this an ongoing requirement for new companion interactions. Expand food beyond produce into cooked food/bread, expand actions/accessories from official references and include the supplied pixel sunglasses. Add finite accessory-specific physical antics, e.g. a hat lifting on a vertical hop or glasses tilting/being pushed up. Collect actual situations such as finding a hidden companion, card collisions and food-caused tumbles. Hide undiscovered names as `???`. Replace awkward collection labels and remove redundant visible explanations throughout companion UI; preserve accessible labels and essential settings meaning. Report the actual removed copy. Actively reproduce randomized behavior/accessory defects instead of relying on chance.

## Product and boundaries

- One shared PC implementation across viewer/studio/preview/anonymous. Existing mobile exclusion, global audio choice, saved preferences/care/collections and original mascot eyes/body/ears remain. No production DB/schema/dependency/permission changes.
- Preserve existing36food/6accessory IDs/order/ownership and106 native/packed bytes. Add24 food pairs including baked/cooked foods, six accessories including pixel sunglasses, and12 situation stamps. Additive local collection migration must not invent historical discoveries or discard existing memories.
- Accessory behavior uses the existing action scheduler/actual decoded source/pose and finite prop/body choreography. Direct input, meal/home intent, modal/premiere/visibility/reduced/OFF ownership wins. No extra permanent RAF/timer, all-pose preload, server or model requests. Safe vertical hops only; cleanup restores base attachments on completion/cancellation.
- Reuse the single WebAudio context/bus and trusted-gesture/global volume gates. Companion sound settings affect gain/category only, without restarting the world/brain/decoder. Bound voices/cooldowns and avoid repeated landing noise. Future companion actions register a fitting sound or a documented silent reason.
- A situation is earned from the actual causal event and visible adopted playback/completion, never merely an RNG choice/requested action. Food-caused tumble and ordinary running tumble remain distinct. Fixed UI activity keys only; never send collected item IDs, food choices, accessory IDs or calendar content to analytics.
- Unknown collection names/hints/probabilities/ARIA must not reveal the item identity. Keep the accessible control/action and local-storage/reset meaning concise. Copy decisions use original project wording informed by official references, rather than claiming the new Korean labels are official game terms.
- Raster assets use built-in imagegen once per requested sheet, immutable native RGBA and deterministic packing. User pixel-glasses photo is a visual reference only. Existing mascot design authority and VIC production provenance apply to situation-stamp imagery. Generated, technically checked and owner approved remain distinct.

## Work and verification

1. Primary-reference/copy/audio/causal-event audit, freeze IDs and actual source requests.
2. Parallel bounded local models/runtime, shared UI/audio, additive art pipeline; root integrates fixed analytics and source receipts.
3. Generate food24+stamp24, accessory6×4views and12 situation stamps; preserve old bytes. Deterministic all-item/520-pose coverage, actual painter-layer/phase sheets and face/ear flags aid independent review.
4. Validate native direct input and autonomous/finite event paths, actual sound graph/global mute/category/voice budgets, unknown identity concealment, retained-decode/resize/overlay/home/premiere, storage migrations and mobile exclusion. Deterministic offline gallery coverage is separate from actual native event evidence.
5. Full unit/type/lint/build/harness, independent security/UI/pipeline review; authorized scoped release and exact deployed UI/boundary checks. Broadcaster hardware remains deferred by the owner.

References: [Tamagotchi Uni manual](https://tamagotchi-official.com/manual/toy/uni/manual_03/Uni_WEB_IS_EN.pdf), [Animal Crossing cooking](https://animalcrossing.nintendo.com/new-horizons/create/), [Pokémon Café ReMix](https://www.pokemon.com/us/pokemon-video-games/pokemon-cafe-remix/), [MDN WebAudio](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices). Product rarity, Korean naming and timing are project decisions. No external game artwork/audio is copied.
