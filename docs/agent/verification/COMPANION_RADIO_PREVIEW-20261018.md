# 108 — 집 라디오·옷장 미리보기·음식 형태

2026-10-18 KST. Current implementation evidence; production remains pending until the exact deployed revision is checked.

## Result and boundaries

The house picture frame becomes a warm wood radio, retaining the shelf, plant, room footprint and sofa depth anchors. Its explicit click toggles playback. The shared companion settings control radio availability, volume, musical reactions, three moods and32 individually included tracks. No new account/schema/role/public DTO/DB operation/dependency is introduced. Mobile continues to use the shared1040px/coarse-height companion exclusion. Viewer, studio and preview use the same feature.

All60 collected food seals now contain the exact live-food source/crop with isotropic scaling. The peach shape difference came from independently drawn stamp art, rather than stretching by the old packer. The existing `rice-ball` ID now renders a newly generated packaged Korean convenience-store 삼각김밥. Old collections/probabilities/106–107 native bytes remain unchanged. Full food diagnosis and source receipts: [food shape](COMPANION_FOOD_SHAPE-20261018.md).

The sofa click now has its own `cushion` care cue. A small licensed carpet impact sample uses the shared context; the first click has an immediate authored plush fallback while the sample decodes for later clicks. There is no delayed sound when a fetch completes. The previous13 event cues remain available.

## Music rights, delivery and cost

-32 actual original CC0 recordings: Juhani Junkala / SubspaceAudio Towns4 + Calm6, Ragnar Random orchestral10 + rock10, TheFrenchDodo retro2. The original publishers identify the recordings as CC0; no commercial YouTube recording, unknown upload or automatic assumption from an old composition is used.
- [License/source list](../../../public/companion/audio/LICENSES.md) and per-file [provenance](../../../public/companion/audio/radio/provenance.json) retain original titles, authors, observed download/source URLs, original and delivered SHA-256. Kenney's original license and sample receipt accompany the cushion. Local source downloads and publisher-page snapshots are excluded from Git.
- The32 music assets total23,354,221 bytes and2,608.01seconds (43min28s), individual46.51–131.01seconds. `ffprobe` confirms all32 are stereo48k Opus; delivered files are64kb/s and normalized to -20LUFS/-2dBTP. Reaction BPM is a pacing hint, not a claim of beat detection. Asset units validate32 distinct hashes/receipts, codec headers and a25MB total budget.
- One `HTMLAudioElement`, `preload=none`, one `MediaElementAudioSourceNode`, the existing global AudioContext/master bus and an independent mix gain. Only the selected current recording is requested; no playlist preload/full-song AudioBuffer or second context. Natural completion chooses another enabled song, avoiding immediate repeats when alternatives exist. An empty pool stays stopped.
- Playback is never persisted and never starts on page load. Stop/unmount/hidden/master mute/zero volume/companion OFF/premiere/mobile resize invalidates pending work, clears the stream and listeners. Focus/unmute never silently replays. A second house click cancels pending loading. These constraints are separate from actual speaker listening and broadcaster hardware performance.

## Personality and wardrobe

A real successful play generation may offer one finite5.2s reaction on the existing world scheduler: lively bounce/sway/ignore, or graceful/calm sway/calm/bored/ignore according to species, personality, learned playfulness, comfort and current energy. Direct input, actual eating/food pursuit, home recall, return, overlays, premiere and unsafe support win. A reachable food also wins while feeding is enabled and hunger meets the existing.35 fullness threshold; simply leaving an ignored fruit on the floor does not silence every musical reaction. Offers expire after8s; hidden/blocked offers do not replay. Reaction source rows and transform envelopes use the same body registration, projection and shadow; no new discovery, gift or care credit is granted.

The wardrobe previews the selected owned accessory without equipping it. Locked accessories remain concealed. Its random pool is limited to the12 already discovered behavior IDs; sharing a texture packet or world sequence does not reveal another undiscovered gesture. No discoveries means neutral idle. It draws the existing decoded sprite synchronously to a canvas with the shared physical registration/accessory painter, without moving a world-owned Image, cloning an Image or expanding the decoder. Finite clips alternate with1–3s rests only in the active visible wardrobe; hidden/OFF/reduced/soft graphics/tab exit cancels work. No world/care/gift/discovery/audio side effect.

Long-running preview review also corrected two cache transitions: successful cold decoding no longer exhausts a retry limit after eviction; only failures count and success resets that count. A finished clip prepares the actual neutral row again before painting/resting, because another world-owned packet may have displaced it from the bounded cache. Waiting adds no animation loop and respects the same cancellation generation.

## Review findings and validation

Independent reviews found and corrected: studio premiere ownership was missing from radio observation; the capability gate initially used the smaller mobile threshold; a second click during loading did not cancel; a failed localStorage write could restore an older readable mix; radio motion needed continuous transform painting; the house radio's manual activity boundary needed an explicit fixed click record. Existing collection metadata protections extend to radio and wardrobe controls; song IDs/titles and discovered behavior IDs do not enter analytics.

Native interaction also found a real zoom defect: the studio's.9 shell zoom reduced a logical44px radio target to39.59screen pixels. A shared inherited-zoom correction now expands only the hit plane with a1px rounding allowance; both surfaces measure45×45px. The drawing retains its original size (viewer44×40, studio39.59×36) and its original shelf center within0.0125px. Room and sofa support geometry are unchanged. Initial native failures caused by expecting a nonexistent food DOM attribute and releasing a held pet after offering music were corrected in the test's real landing/event order; the product still cancels music offers on direct input.

The independent boundary review follows the fixed-target dictionary through metadata/duration stripping to the existing viewer/anonymous daily aggregate RPC. Learned life/habits remain local. Existing manual choices of the three basic personalities remain fixed-value feature counts; this release does not claim that every personality-related selection is unrecorded. Public audio provenance contains creator credits and public source URLs, not account/private-source metadata.

No genuine-user preference reset, collection grant or production schedule edit is authorized for verification. Actual broadcaster PC, speaker listening, real-login RLS and provider quota effects remain outside these fixture results.

## Final verification

| Check | Current result |
| --- | --- |
| Full unit suite |229files /2,391tests PASS, frozen product after decoder/food-priority fixes |
| Typecheck / lint / build | PASS; final production-fixture build `L6BToox6wi3oSekYDh0U4` includes the physical hit-plane correction |
| Harness |277documents PASS; links, statuses and startup budget |
| Food/source checks |60same-source comparisons,16asset units,106/107/108 reproducibility checks PASS; original receipts/native bytes retained |
| Independent review | Art/shape, UI/runtime, radio pipeline and fixed-target privacy review complete; reported P2findings corrected |
| Final production-fixture interactions |51/51 PASS on final build `L6BToox6wi3oSekYDh0U4`: runtime9 + UI42. Known OS-window case remains separately unverified; prior candidate failures/corrected runs are separate |
| Actual deployed revision/UI | Pending authorized scoped push and exact deployed SHA verification |

One OS-window visibility scenario is currently environment-unverified: native tab fronting/minimization, including removal of Playwright's default forced-focus emulation, still reported `document.hidden=false`. No visibility field, RNG or clock was patched to obtain a pass. The real preview effect is separately exercised in five unit-harness cancellation cases for RAF, rest timeout, stale callbacks, hidden late decoding, reduced mode and disposal/OFF. These are unit evidence, not a successful native minimized-window measurement.

Final runtime9 evidence is under `.scratch-pw/companion-108-runtime-final/`. The corpus case actually selects/plays all32 recordings with HTTP200/206; read-only CDP observes one AudioContext/one MediaElementSource and zero media errors. Six musical reactions remain registered for308–311samples over5.149–5.200s with support movement below1px. Lively cases leave a real ignored fruit on the floor with no eating goal, food stamp or preference reward. Both surfaces verify one cushion cue, current-song stop on the rendered premiere ownership signal, no automatic replay when that signal clears and successful explicit restart. The ownership-signal test does not claim a full real countdown simulation or real broadcaster/speaker validation. Writes/page errors are zero across all9 cases.

Final UI42 is `.scratch-pw/companion-108-ui-final-report.json`, all42 passed with zero retries/failures/skips on that same final build. It combines16 new cases (radio4/wardrobe12) with26 existing traits/habits/discovery/sound cases. The standalone OS-window scenario is explicitly excluded from this pass count. Initial tests exposed pre-dialog active-time persistence arriving after the old baseline, random-rest sampling and old no-button assumptions; corrected tests wait for the real existing flush, explicitly press the real replay button and check absence of equip controls. They retain exact collection equality, real wall time and existing safety guards. Whole-viewport radio/wardrobe light/dark/narrow screenshots and native92 reaction crops were directly inspected.

The staged scope contains86 authorized paths. Sixty-one native/audio/receipt files, including106/107 sources and the publisher's original license, match their pinned/raw hashes with zero drift. Unrelated user art notes, raw attachments, private generation receipts and earlier drafts are excluded.
