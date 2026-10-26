# Agenda / companion / viewer detail — 2026-10-26

Current request: repair missing/abrupt date outlines and late-month notice access, compact empty notice context, investigate companion disappearance with panel play and restore seasonal interaction feedback, align the viewer detail sheet.

## Observed failures

- Original f23417de production build `uyUo_3QPT2UjBf3po7FBi`: at the actual end of the reading fixture,31 was visible but the reported date remained24. The old largest-visible-height rule also omits a44px day between two500px days. The original screenshot/report remains in local durable run `20261026-agenda-companion-detail`.
- First implementation build `VqrVl_Te3DPC2JajJ1TbZ`: empty→three notices corrected the date immediately but, within two rAFs, left the old frame height briefly overflowing the footer. Preserve `20261026-agenda-continuity/qa-r01`; the fix synchronizes frame measurement in the layout commit. Rechecked by the final scoped browser cases below.
- Detail320: the old12px inset disagreed with the grip's16px negative margin, producing324px scroll width. The shared inset now owns both. Rechecked by the final scoped browser cases below.
- Seasonal showcase: native shaking kept drawing held row8 without the existing dizzy row22; release after a throw omitted dizzy/recovery row23. Original native failure is retained. The fix reuses the existing gesture/play/art pipeline. Rechecked by the final scoped browser cases below.
- Panel play: manual real-pointer placement and the existing shared side callback stayed visible across temporary side/7s return in both viewer and studio. This does not establish the autonomous actor path or reproduce the user's disappearance; investigation remains open.

## Boundaries and activity

Public DTOs/loaders, roles, Google/passcode auth, KST and serialized writes are unchanged. Guarded synthetic fixtures only; no real database writes or authentication bypass. Art source pixels stay unchanged. Fixed follow/calendar/close and companion gesture targets stay aligned with the existing action catalogue, timeline and least-used display. Automatic context, paint transitions and autonomous companion acts do not become human events. Actual native capture and final check counts remain pending.

## Final verification

Final build `AMhShdPnObN96jm-LHclS`:219 relevant units, typecheck, lint, build and harness410 pass. Browser coverage has23 unique cases: six new agenda cases, two actual queue/save galleries, seven detail cases, four-tier metadata and seven companion cases. All counts exclude skips and invalid gesture/preparation attempts. Independent non-author source/role/boundary/UX/QA review accepted the tested scope.

- Final agenda6 PASS (`20261026-agenda-continuity/qa-r06`):320/390, short day20 beside tall neighbors, each28–31 and maximum-scroll31; owner/developer/preview focused link scope and follow; empty compact toolbar; no-notice July31; filter-empty ghost removal/restoration; real reduced-motion setting; landscape/gap/rotation and idle stability. Exact two-rAF reading and less-than0.5px frame/paint geometry checks remain strict.
- Final actual queue gallery2 PASS: owner/developer saving/saved/failed captions and recovery, complete three overlapping titles, retained link/follow semantics; save/selection header/card/scroll drift0px. Six state PNGs and raw measurements retained.
- Detail6 and heart-tier1 are reused from `vkOTNNkJhSBblbfZzQmRG` with unchanged TSX/CSS hashes; final support/teaser1 re-executed on `AMh...` PASS. Native Google CTA opens only a locally fulfilled destination, X44 pointer/keyboard, focus trap/return, no title/tag/calendar leak from unreleased teaser. One exact local-root GET remains synthetically isolated with its initiator unconfirmed; this is not a real public-loader test.
- Companion7 reused from unchanged product hashes on `vk...`: wide actual arrow perch2, narrow exposed-resident/fold/scroll side callback2, full viewer/studio showcase plus reduced3. Full cases observe held dizzy row22, release/recovery row23 and actual shaken throw/landing response; actual decoded ink/visibility checked. Native input timing failures caused by the QA observer/serialized driver are retained separately; sampler thresholds were never relaxed. Original autonomous actor629 frames and later final-build PC smoke are separate evidence, not additional unique cases.

The final two agenda fixes replace padding with pseudo-element scroll content (no transient minimum-height overflow) and clear a portal outline when its row disappears. The guarded studio fixture gained the same continuity dataset as public/preview. An accidentally misrouted npm runner invalidated one intermediate build; the attempt was stopped, preserved, and affected evidence re-executed against the pinned final build using the direct Node CLI.

Exact commit/CI/provider/public release confirmation lives outside scratch in `C:/Users/im917/.codex/vic-pipeline/runs/20261026-agenda-companion-detail`. Local checks alone do not prove deployment. Physical phone/Safari, actual login/RLS and broadcast hardware are outside these synthetic proofs. The panel report remains in OPEN_CHECKS.
