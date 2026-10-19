# 126 independent source review — home layout and curtain runtime

Reviewed 2026-10-19 KST by `/root/toy_art_125`. The reviewer generated the five curtain pictures, but wrote none of the product code below. This is an independent **code/technical-boundary review**, not independent art-quality approval, owner selection, a test execution, deployment verification or OBS/device certification.

## Exact reviewed source

| File | SHA-256 |
|---|---|
| `components/poster/viewer-companion/companion-home.css` | `FA1E475965A76B205FD9696EA153269D8C2D2A6C0E068347AD3700C1F9FC8FAC` |
| `components/poster/viewer-companion/companion-home.tsx` | `09AA798D24C8E2DDB811E8C147988131BF818A54803448EB3FBE3CD92A5A3F81` |
| `components/poster/viewer-companion/companion-home-window.tsx` | `CBE214BF53D43EC174B81E274495B44D4C78732F2A4A8E283002DD5BF4070447` |
| `components/poster/viewer-companion/companion-home-window.css` | `D94ACB67115DE2B05F9CD7618BB4FE12CD4CF403FA601A1566029C692B8CDBE9` |
| `lib/ui/viewer-companion/home-curtain-transition.ts` | `CC13B5244E280D22AB038E9F82264F23D436C079968B56F1EFB235B82DD2B6AA` |
| `lib/ui/viewer-companion/home-curtain.ts` | `C71E6A264F8649B7A4E046AF0AE83E00494EBE486770C3F810315BFEFDEB0EE9` |
| `lib/ui/motion.ts` | `9A2BF579F9F6B4AB2F25BEFDE213BCDFCB12372FE2F85389298A3E64A6C1465A` |
| `tests/unit/companion-home-curtain-126.test.ts` | `CC19C40D2D2B396204DDC31D702FE177B619F0CB95A3FB54F48556ED6D7642AE` |
| `tests/unit/companion-home-curtain-125.test.ts` | `ECE79B1224D8AD1E09605898D9E5EEBB3ED6DBD65C2AF9DB037A4BB25614E83E` |
| `tests/visual/companion-home-layout-124.spec.ts` | `BE6A423DC843DCD58B206DCB9F870ACE3F1E19B96B244EC1A3BA831A04F94D44` |
| `tests/visual/companion-home-curtain-126.spec.ts` | `AA0E57FBB4EC5197D2AB71145A3D004CF9B2F60D62597D7B2B94B3F979BE35CB` |

The source boundary is these hashes. Later edits need a scoped delta review. Root owns final build, units, rendered interactions and deployed-result checks; none were launched by this reviewer.

## Finding and disposition

The first source reading found a P2 initialization replay: a newly mounted closed/shaded `HomeWindow` had the correct SSR image, but the controller began at zero and repainted the open stage before animating to the current target. The concern was sent directly to the builder. The builder had already fixed the same issue during the concurrent review. The current hashes above now pass `initialStage.current` to the controller, initialize its position from that stage, and have two explicit stage3/stage4 no-replay unit cases. Re-reading verified the wiring and test assertions; the reviewer did not run those tests. The original finding is resolved in the reviewed source, rather than omitted from the record.

No remaining blocking finding was identified within this source scope.

## Controller and layering audit

- The window frame, sill, glass, landscape and applicable weather image remain mounted when curtain semantics change. Five stable keyed overlay images are siblings above the whole frame, outside the glass clip. No replacement background, curtain `scaleX`, new human control, geometry anchor or new environment clock appears.
- The finite transition uses at most five stops and five browser animations. Reversal reads current computed image opacities, derives the current adjacent blend, clears old finish callbacks and cancels the old effects before making the new finite path. A late finish checks its flight identity. Unsupported WAAPI/invalid animation parameters fall back to the current real target image.
- React retains a constant initial inline-opacity prop. Subsequent semantic changes are owned by the controller, so a rerender does not assign the new target opacity over an interrupted browser blend. The initial-stage fix aligns that constant with the controller's first paint.
- Inactive/hidden/inert/reduced/OFF/soft boundaries cancel effects and paint their target statically. Cleanup removes all installed event listeners and cancels finite effects. The existing motion setter now emits a payload-free same-window re-read event; it does not log an activity or create a timer/observer/RAF loop.
- Unit source covers quantization, adjacent stops, fractional reversal, stale callbacks, same-target deduplication, static cancellation, disposal, initial-stage preservation, motion-event delivery and no-WAAPI fallback. SSR markup assertions establish structure only; they do not execute component effects. The rendered fixture source observes actual DOM identity and animation tracks separately. It explicitly decodes images before measuring, so this review does not certify an unready-network first transition.

## Layout and image-registration boundary

The ground feeder has no dedicated pseudo-element ledge; its fixed slot is outside the moving paint. The existing source center `(131,168)` is retained with the new vertical offset. Chest width is104px normally/132px paint on wide containers, and its `(128,52)` opening scales with the same source image. Whole-object feedback changes painted descendants, while native buttons, seat, outlet and opening remain static. The original sofa paths/seat inset remain;45% sizing retains the120px physical minimum and150px logical cap.

The window's38:25 ratio and shelf-only width reservation leave wall space below it. Normal200px and exceptional narrow226px rooms remain shared across presentations. Minimum native target expressions still account for shell zoom. Their practical fit is a rendered-check responsibility, not inferred from CSS alone. Existing root-generated `layout-1` measurements were read as **earlier build** `YAo3rdcCOT0-TQhdvzWnT` evidence: viewer282px at scale1, studio357.778px at.9 and427.5px at.8, with six non-overlapping controls and real dimensions at least44px. They are not promoted to final-build proof by this review.

The immutable art [manifest](../../../art-src/빅타민/동행/작업회차/20261019-커튼단계레이어126/제작기록/공개자료/납품명세.json), SHA `D89785B062FE7B06654ED9BFC7C1B72B257DCD21940E5A04261B2FAD8F6B37AE`, records five256×192 uniform derivatives and PNG/WebP RGBA parity. Runtime alpha≥32 bounds have top13–14 and bottom180; alpha≥250 bounds have top15 and bottom179. The168×111 reference cover calculation retains every alpha≥32 pixel center. Actual earlier rendered overlay149.171875×97.875 has a slightly different border/zoom-aware cover interval; final actual BCR/pixel checks remain root-owned. Closed center alpha is253, so no claim of an entirely255-opaque cloth was made. These are registration measurements, not approval of the reviewer's own illustrations.

## Role, privacy, KST and activity audit

This source scope changes presentation only: no route, server loader/DTO, role check, unlock/session behavior, database operation or public-cache boundary. `HomeWindow` continues to consume the existing shared environment/resolver; no local-time calculation or second season/weather source was added. New image URLs are fixed local asset paths.

G-22: existing food/toy/home/radio/book controls retain their semantic targets and action route; relocation and autonomous curtain motion create no extra human actions. The new motion boundary carries no preference value, food/toy/song ID, trait, identity or analytics metadata. Timeline and least-used-feature behavior outside this bounded source scope remains the release audit's responsibility.

Protected unrelated user art SHA was rechecked as `E980005102457E2A02AE318FF7665596E7170D0BFB34A328F64A6EC292C5990B`. No source, runtime image, tests or user work was edited during this review. Only this new review record was written.

## Physics follow-up — final 11:10 KST source freeze

Reviewed 2026-10-19 KST by `/root/face_capture_118`, who did not author these126 physics changes. This addendum reviews code and unit assertions only. The reviewer authored curtain code earlier and makes no independent curtain verdict here. The preceding11-file review remains byte-for-byte unchanged.

| Inspected physics source | SHA-256 |
|---|---|
| `lib/ui/viewer-companion/item-landing.ts` | `DDAC85C412D25C39F764B45140F31220A46AC4E2DFF2E98513EF9037E3886C87` |
| `lib/ui/viewer-companion/food.ts` | `AF8757933F4122B3E0197FC7A87F22441658012471A9146A31A5A2B46F7D98CD` |
| `lib/ui/viewer-companion/food-toss.ts` | `6CCF71035234035A256F0E7D542B26F417EE0CA8959E65D75B133D1C38E76857` |
| `lib/ui/viewer-companion/toys.ts` | `826CF1D1577F4E5CA1528113FBF6B730B144D69A1DF2AEA2F65AC824F2C5B13E` |
| `components/poster/viewer-companion/companion-food.tsx` | `23533A70B2A1D705D7786D9F26F450EBE862B8A6ADC16F2AE5AFE680A6313CE6` |
| `components/poster/viewer-companion/companion-toys.tsx` | `59DC0D3CD4B76D19B51A6853CE8C20B786CA9FC455A96CBD2FE16E1E928F3AE9` |
| `components/poster/viewer-companion/viewer-companion.tsx` | `9ACA3652B7424B5E36B239199F1ABA4C744EBEE1A2462F57ABBE32FA11B19A85` |

No remaining P1/P2 was identified in this final delta. The earlier double-translation P2 is resolved: manual food emission now reads fresh copies from `geometryTracker.landings()`, paired with the original `anchor()` baseline, instead of the renderer's mutable followed supports. The food component reuses the same already-read current native floor frame. Body-support rebasing translates x/y only when the source width and height still match; a resize rejects that proof until the next full safe scan. It preserves the original body interval and never applies food's22px inset to certify the larger pet footprint. The earlier split-ID concern does not establish a runtime defect because `bindLanding` normalizes a genuine home-floor source to its retained home-floor family.

The four final corrections retain their intended boundaries:

- System food candidates intersect real home food spans with same-plane body stances within the existing36px mouth range. After velocity limits, the actual accepted first-contact endpoint is checked again. Only the home emission uses contact-height air time; ordinary throws and autonomous recipient ejections retain their previous horizon policy. The225px/s force bound,140px travel bound, viewport margins, gravity and first-descending-contact check remain.
- A chest flight with a real reserved target collides with measured front home-floor contacts, avoiding the sofa/calendar behind that emission. A native grab removes that flight, and a human drop/toss creates an ordinary flight without a target; its existing ledge collision path remains. Same-source reservation follow translates the finite flight without resetting its age. Missing target support clears the reservation instead of fabricating a platform.
- Packing stays within at most eight real spans and twelve occupied food/toy points. Equal-overlap candidates now prefer clearance and include real neighbor midpoints, so a crowded span can distribute items without claiming extra capacity. No global separation guarantee is asserted when native space is insufficient.
- Cross-item reservations contain only local coordinates. Native44px items, body footprint,36px food reach,48px toy pickup, four-toy/eight-food limits, direct input/frame batching, existing pause ownership and finite host clock remain. This delta adds no observer, timer, per-frame DOM scan, server/API/DB route, KST source or activity payload. G-22 targets remain the existing fixed human food/toy controls; autonomous placement does not log IDs or preferences.

`tests/unit/companion-home-item-spawn-126.test.ts` was read for real first-contact obstruction, mixed in-flight reservations and pickup, immutable translation, narrow-body preservation, shrink rejection, near-floor speed/travel bounds and minimum-overlap assertions. The reviewer ran no units, compiler, lint, build, browser, native or production check. The builder's150 focused-test result is separate evidence. Root's native2 failures remain preserved; this code review does not replace the pending final-build source/fall/landing, resize and actual return observations. The prepared public checker was not changed during this review.
## Follow-up delta — absolute toy return and saturated packing

Independent source re-read by `/root/face_capture_118` after native3 exposed a22.561px carry-resize miss and crowded placement could repeat exact centres. Those earlier native failures remain evidence; this addendum does not convert them to passes. The original11-file review and preceding7-file physics hashes remain unchanged above. The following snapshots supersede only the changed return/packing files and the previous area-first packing description.

| Delta source/assertion | SHA-256 |
|---|---|
| `components/poster/viewer-companion/viewer-companion.tsx` | `AEE0F5DAA96FFB5598C21788C61FFEC4585F05EC882E9582FDA881D2192F78B3` |
| `lib/ui/viewer-companion/item-landing.ts` | `56D3533EFE726B27220F402028C8D8636AF396FF84BAAE778390F60BF6B8FE34` |
| `lib/ui/viewer-companion/food-toss.ts` | `AAED70953F8A4694FCA82E1DCBC682BBDEDCADC28E559804938C809F525AA1A6` |
| `lib/ui/viewer-companion/toy-return.ts` | `2ED2B51A920E009C0DE9E647D06C385322B012B03CBCD980CC204E2F7A8E01FC` |
| `tests/unit/companion-toy-return-126.test.ts` | `BC2E0EB31AC0B8FD5D3885071043B9DAA8A14862E6121991667B63CBE47FCDB0` |
| `tests/unit/companion-home-item-spawn-126.test.ts` | `BABBC9CEE10CABBB130233AC7E2278B368A7E647B9C986C6E1A67D855200FDBE` |
| `tests/visual/companion-home-spawn-126.spec.ts` | `0BEEE7579B053C27E312048DDD0EDBFB8E086DD2A6EBEDC58E7545A9AC1334E8` |

No new P1/P2 was identified in this delta. Launch caches the actual same opening element and its absolute centre/bottom, replacing the body-relative offset. Only the existing finite `refreshAnchors` gate remeasures that same element, once per admitted follow call; a missing/hidden/empty source cancels the action. A changed opening contributes to the existing moved result so the current frame is repainted. This adds no global scan, observer, timer or new clock.

Ordinary transport still projects the adopted current pet pose and calls the existing synchronous `carry()`/`paint(id)` path. The stash beat alone samples the cached current opening with its existing28% approach and18px lift. `clearAction` resets both the target and painted-point cache; its ordinary cancellation still releases pet-carried objects without cancelling an independent human hold. Stash admission requires a previously painted point within strict20px of the cached aim, or the terminal attempt; success then independently requires the same opening DOM identity and a strict20px check against its current native rectangle. A terminal miss resolves failure instead of deleting a remotely carried toy. The threshold is not widened.

Saturated packing now shares one comparator: a genuinely free44px footprint first, then maximum nearest-neighbour clearance, then shared area, preferred distance and deterministic ties. Food re-evaluates its velocity-limited actual accepted endpoint with this same comparator. Span/occupancy caps, real floor bounds, source/first-contact proof, speed/travel caps, body36px reach and toy48px pickup remain unchanged. This corrects the earlier area-first edge pile without claiming eight disjoint44px items fit on a62px span.

The three pure return assertions cover the recorded22.561px miss, independent opening movement without clock replay, the authored lift, strict20px boundary and invalid-source rejection. The mixed-item unit source requires four distinct food centres and four distinct toy centres on the real saturated62px interval and checks actual toy landings. The native source likewise requires four distinct observed centres per kind. These are source/assertion inspections, not reviewer executions. Builder-reported154 focused passes and lint are separate evidence; final actual resize/current-opening and mixed-drop results remain root-owned. No product, art, public checker, build, browser, native process or git operation was changed or run by this reviewer.