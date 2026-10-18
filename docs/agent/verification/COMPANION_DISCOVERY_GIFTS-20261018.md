# Companion discovery and gifts — 106

Date:2026-10-18 KST. Status:complete; authorized release/exact deployed UI verified.

## Scope and source of truth

[106 plan](../plans/PLAN-20261018-106-companion-discovery-and-gifts.md) authorizes actionable companion traits, soft pointer feedback, first-consumed food/first-witnessed action stamps,36 weighted foods, earned gifts and six explicitly equippable accessories. This supersedes105's proposal-only limit for discovery/dress-up. Companion belongings remain device-local; the retired general calendar decorating/sticker product is not restored.

One PC runtime/profile serves viewer, studio, preview and anonymous surfaces. Mobile stays excluded. Existing owner/developer/viewer permissions, server public DTO separation, owner-private boundary and KST rules remain authoritative. This adds no account collection, API/schema/dependency or production DB mutation.

The profile explains actual behavior and things to try. Saved13-food v3 seeds/scores/familiarity remain intact when the catalogue expands. Missing new scores initialize without overtaking the saved favorite. Discoveries are never inferred from old care scores. Separate versioned storage keeps36 food enums,12 behavior enums, one pending gift, up to6 owned accessories and one explicitly equipped item. Learning reset preserves discoveries/belongings. No dates, account IDs, schedule IDs/titles, location history, purchase/currency or absence debt is stored in collection memory.

Discovery is committed only after successful real consumption or visible decoded adoption of the requested actual frame/source. Gift delivery uses existing active-time ticks and safe decisions, actual positive interaction and affection. Opening unlocks without auto-equipping. The existing five-second persistence boundary is reused; ordinary paint/active credit changes do not introduce storage reads/writes, React updates or another permanent timer/RAF. The pointer highlight is event-coalesced and stops on leave/blur/hidden/reduced/graphics gates.

OFF means no companion character sprite download or autonomous scheduling. An explicit visit to profile/discovery/dress-up may show the user's static local collection artwork. Mobile has neither companion tab nor companion assets. These scopes must be distinguished in native assertions.

## Primary references

[Apple pointing devices](https://developer.apple.com/design/human-interface-guidelines/pointing-devices) informs responsive pointer emphasis. [Neko Atsume's official book](https://nekoatsume.com/games/neko/enjoy/enjoy_book.html) informs discovery/profile hierarchy. [Pokémon GO Buddy Adventure](https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/2155-buddy-adventure/) provides official examples of interaction, presents/souvenirs and a wearable ribbon. [Tamagotchi Uni's official guide](https://tamagotchi-official.com/us/news/02_86/) connects personality reactions, favorite objects and accessories. These are references rather than copied artwork or claims that our rarity/timing/local rules reproduce those games.

## Art provenance and bounded offline coverage

[The source production record](../../../art-src/빅타민/수집/작업회차/20261018-도감과선물/제작기록.md) binds six untouched native PNGs,114 cutouts and five lossless WebP atlases to [the packing receipt](../../../art-src/빅타민/수집/작업회차/20261018-도감과선물/정리본/패킹기록.json). Food36 and paired stamps36 are separate atlases; behavior12, accessory6×4views and book/gift6 complete the114 cells. Source crop/trim/isotropic resize, transparent gutters, source/derived hashes and RGBA cell hashes are retained. No color keying or opacity repair was used. The book/gift source's946,216 nontransparent pixels were attributed exactly once before resizing despite overlapping object bounding rectangles.

All520 actual physical frames across33 sprite packets/41 logical rows have source-SHA-bound offline attachment metadata. The renderer uses the adopted actual frame/source and existing pose/facing/contact/inertia transforms. A body roll is not mistaken for anatomical yaw; actual rear drawings do not invent eyes. Existing eyes/body/ears remain unchanged; sunglasses are the requested wearable occlusion and headwear retains both ears.

The offline witness contains126 composites:21 representative actual poses×six accessories. Six actual witness sheets were generated/opened by their technical reviewer using the product placement function, original cutouts and actual painter hidden/clip state and behind/body/front ordering. Repeating one identical painter pose120 times added zero CSS writes. Pure gift-hit projection across21poses×3scales×2facings measured zero inverse-projection error. These are offline/numeric results, not a browser/native PASS for all520 poses. Private original evidence paths, user-turn text and identity material are excluded from committed records.

Art status is generated/technically checked, with `approval:NONE` and `full_review:NOT_REQUESTED`. The behavior native is registered as `DRAFT_DELIVERED_FOR_USER_REVIEW`. Preserve the producer's observation that knead/nest stamps differ subtly; those collection symbols do not replace actual runtime poses.

## Scoped checks before final freeze

- `node scripts/prepare-companion-collection.mjs --check`:6sources/36foods/114cells/5atlases/registry/receipt reproduced byte-for-byte. Food asset unit8 PASS, including existing13 SVG/license/hash history and actual new atlas bytes/alpha/ordering/lineage.
- Relevant collection/snacks/care/life/accessory/anchor unit71 PASS. Covers malformed/unknown data, actual consume/adopt boundaries, denied storage, five-second writes, same-tab/cross-tab synchronization, external clear/equipment, reset preservation and13→36 migration. This is synthetic/in-memory coverage rather than genuine production browser storage or DB/RLS evidence.
- Activity tests86 PASS across five files. Seven fixed controls preserve timeline/usage labels and viewer/anonymous identity-free counts. Unknown/item-specific options collapse to the control; collection button metadata/duration are discarded at the writer. Food/behavior/accessory IDs, gift contents and sensitive canaries do not persist. Manual physical gift opening does not double count a delegated click. Existing tag/heart behavior remains covered.
- Scoped lint, whole-project typecheck and changed-file whitespace checks exited0 at the implementation checkpoint. They are not the final frozen revision's full gate.
- Independent core/security/performance review found one P2:keyboard gift activation could bypass a premiere pointer-only gate. Root added matching handler/disabled/tabIndex/result-notice gates; source correction was inspected. Actual native interaction remains part of the final matrix. No further actionable P1/P2 was found in the reviewed collection/gifts/care/engine boundaries.

## Final frozen-build checks — root to append

Windows production builds use real locked Next15.5.28 and the existing fixture-only environment on127.0.0.1:3116. `npm run build` exited0 after the final headwear renderer correction, build ID `kClpGEVH25D3UT3nQVUE7`. `npm run test -- --maxWorkers=1` exited0:219 files/2,301 tests. Whole-project typecheck/lint exited0; the final document harness is recorded below when complete. No dependency/schema change or real DB write was performed.

Final `npm run typecheck`, `npm run lint`, `git diff --check` and `npm run harness:verify` exited0. Harness verified271 documents and the7,602-byte current brief. Documentation checks are included in the full suite. Verification/source generation preserves exact local originals; public provenance replaces private reference paths with reference IDs/SHA, and the exact private request file is excluded from staging.

Initial unit runs had the not-yet-wired activity dictionary keys and a5s timeout in the full33-packet/520-frame anchor recomputation. Wiring fixed the dictionary. Profiling found19,169,280 temporary buffer views and millions of section arrays; direct pixel reads/streaming bounds cut measured CPU profile1,627→1,055ms and GC75→38ms. Full uncropped runs took981/1,027/1,111ms with unchanged registration bytes. The child process now has15s and the test20s, rather than mismatched20s child/5s test deadlines; all frames/assertions remain. This measures an offline preparation tool, not OBS runtime performance. Subsequent full runs passed.

Rendered checks found rear glasses inventing visible lenses and headwear hidden behind most body/ear pixels. Rear face/chest belongings now remain behind the original body. Headwear uses the actual registered head pivot, a body-proportional width lower bound and one full front layer: intentional lower ear-root wearing overlap, while the two ear tips and face remain visible. The old duplicate back/front55% clip and unused behind-ears metadata were removed. The gift notice now inherits the selected font/shared text/radius and has44px controls.

Independent core/privacy/performance and painter/source reviews found no remaining actionable P1/P2. Generated art/technical observation remain distinct from owner visual approval. Protected user-edited premiere production notes retain SHA `e980005102457e2a02ae318ff7665596e7170d0bfb34a328f64a6ec292c5990b`; unrelated drafts/configuration/legacy assets are excluded from staging.

## Production-build native matrix — root to append

Native evidence is local under `.scratch-pw/companion-106-*`; reports/screenshots are intentionally outside Git.

- Settings21/21 PASS across viewer/studio/preview light/dark,1050px desktop, actual keyboard tabs/grids, empty/owned collections, reset/reload, needs/habits/storage synchronization and pointer/reduced/OFF/soft/blur cancellation. Report `companion-106-settings-final-report.json`; before the renderer-only headwear refinement. Actual dialog top/bottom and narrow/light/dark images were inspected; full long-element screenshots can have blank tails due to ancestor scroll clipping.
- Mobile6/6 PASS: public/studio/preview at390px and coarse1120px landscape ignore saved masterON, retain the setting, mount no companion/food/book UI and request no companion assets.
- Actual meal2/2 PASS on build `sdcILmY_ixObpbBP5PQEN`: viewer consumed melon and studio strawberry; food discovery appeared only after consumption. Actual post-meal decoded row29 bow was observed (9/6 registered frames), then the behavior stamp appeared. Both survived reload and the actual book UI showed1/36. Inputs were trusted; page errors/forbidden writes0. Report `companion-106-meals/report.json`.
- Gift/world5/5 passed before the final front-layer refinement: real Enter petting completes earned conditions; native physical gift opens/unlocks without auto-equipping; explicit wearing/focus and reload preserve ownership. Premiere pointer and Tab access stay blocked, then ordinary interaction resumes. Three92px wearables follow actual wheel, sofa foreground, held pose and ordinary dialog layers. Final front-layer rerun is recorded below. The fixture's actual wheel range was4px; this is not a long-document scroll stress test.

Initial gift QA failures were fixture/test assumptions: API-wide503 blocked the DB-free synthetic premiere conductor and the real clock's3RTT calibration, leaving phaseidle. Only those two exact GETs are allowed for that case, with actual prelude phase required. The existing floor helper rejected legal sofa contact in a scrolled small room; native placement now accepts actual room contact, then explicitly recalls to the cushion and requires exact home/sleep/foreground. The real clock/RNG/focus/brain/geometry remain unpatched. A short click was corrected to real Enter petting because ordinary short click means a tap, not positive affection.

Final front-layer rerun on build `kClpGEVH25D3UT3nQVUE7`: gift/world5/5 PASS in30.2s, unexpected/flaky0. Report `companion-106-gift-world-final-report.json`. Root and independent UI reviewer opened the new92px cap/crown/glasses, held and sofa captures: cap dome and flowers are visible; face and both ear tips remain. Total settings21 + mobile6 + actual meal2 + gift/world5 =34 native cases. The final post-build metadata cleanup only removes unused old layer descriptions; all520 numeric coordinates/source bindings and all six offline composite PNG hashes are identical. Its two unit files/10 tests, generator `--check`, lint and typecheck passed separately; remote quality builds that exact committed metadata.

Offline126 composites use the actual painter's hidden/clip state, not a layer-name approximation. All520 mappings/retained-source fail-closed contracts remain numeric/unit coverage. Native tests do not establish all520 poses, actual broadcaster OBS hardware, genuine-login RLS or real DB mutation coverage.

## Release and deployed verification — root to append

Authorized main commit/push: `f8eab06b8559e84730a41fceb2392b4f9c204773` (`feat: add companion discoveries and gifts`). Scoped63 files; protected user art note SHA unchanged. Unrelated drafts/configuration, fixed private references and the exact private request are not committed.

[Remote quality39103699982](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39103699982) completed successfully: all13 steps, including full unit, isolated SQL, harness, locked production build, typecheck and lint. Vercel reported success for this exact commit. No docs-only second deployment was made.

At2026-10-18 15:24 KST the deployed `/api/soop-live` returned the exact full SHA above. Public clock200/no-store, warm204, anonymous developer presence401/error-only/no-store and production fixture nonexposure passed. The streamed fixture response has HTTP200 but the404 fallback marker; this is not reported as an HTTP404. Local proof: `.scratch-pw/companion-106/deployed-canaries.json`.

Actual authenticated developer-studio tab was reloaded and showed badge `f8eab06`. Native settings→빅타민→프로필 confirmed actionable effect/try cards,36-food/12-action book with honest first-install discovery state, rarity/base probability and six locked accessory entries. Existing favorite/mode/care were not reset or edited. Profile/discovery/dress screenshots are `.scratch-pw/companion-106/deployed-{profile,discovery,dress}.png`. Dialog closed, original November2026 and right folded panel restored. No production care reset, collection grants, schedule writes or account changes were used for proof.

Final deployment bookkeeping in this record/plan/current state stays local until the next authorized product commit. Actual broadcaster hardware and genuine-login/RLS evidence remain separate; generated art still has no invented owner approval.
