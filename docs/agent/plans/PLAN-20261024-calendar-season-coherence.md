# Calendar/save/highlight and seasonal coherence — 2026-10-24

Status: implementation and independent scoped verification complete, including the deployed mobile opener follow-up. Final release closure is governed by the exact CI/public fullSHA and actual deployed evidence in release.json. Both original deployed failures remain preserved. User explicitly adopted all three calendar-platform proposals and requested implementation, actual interaction verification, independent review and production deployment. Additional direct requests: constant compact month-picker height, readable month title over night background, companion/food/toy lighting where overlapping the visible seasonal scene, and no entry jump for an actor already overlapping it.

## Scope and decisions

- Shared MonthPicker: own Escape/Tab, return focus, preserve pointer/year scrub/arrow/month/today/KST behavior. Keep a useful compact footer at the same height for every month; no large blank placeholder.
- Save queue: no fictitious saving or fresh last-saved timestamp without a write; distinguish a retained memory-only draft in the existing shortcut feedback. Preserve failure/serial/keepalive/recovery contracts and privacy.
- Remove the highlight section/tab/renderers from viewer, owner and developer; shared preview follows. Keep other statistics and public/server data contracts. This is UI simplification, not new analytics collection or DB deletion.
- Night month title: shared readable ink over the existing seasonal background, including hover/open state; no broad palette/filter replacement.
- Scene overlap: consume the existing scene lighting/geometry for companion, food and toys on visible background, including ordinary calendar mode. Keep room/held ownership, explicit OFF, reduced motion, mobile exclusion, pointer/manual input and item identity. No new real raytracing engine or permanent polling.
- Showcase entry: an actor already visibly overlapping the seasonal scene enters continuously without a new jump; an actor outside still follows existing travel. Preserve return/input/ownership gates.

These direct instructions replace only the conditional-height footer and unconditional entry-jump behavior in the affected paths. Existing source assets, user work, QA originals and completed/rejected ideas remain intact. No new dependencies, model/API work, production DB access or tracking.

## Work / gates

1. Calendar/save/highlight implementation; ambient implementation follows as a separate bounded work group (at most two groups active).
2. Relevant units, typecheck/lint/harness; one immutable guarded production build for final product inputs.
3. Actual viewer/studio/preview PC/mobile where applicable: month chooser keys/height; no-op and real/failing save; remaining insights tabs; night title; overlap lighting and entry inside/outside, item and OFF boundaries. Preserve all first failures and scoped receipts; no full200.
4. Independent role/boundary/UX/QA review before integration, G22 timeline/least-used-feature audit, exact released SHA and safe deployed public interaction verification.
5. Close owned processes; update registry only after release verification. Real login/device/RLS and normal36 remain separate UNVERIFIED. No proposal discovery completion is inferred from these fixes.

Evidence root: `.scratch-pw/site-daily/accepted-calendar-season-20261024/`. Prior observation/report: `.scratch-pw/site-daily/calendar-platform-ideas-20261024/`.

## Activity / boundary audit

G22: checked both developer action timeline (`activity-timeline.tsx`) and least-used controls (`activity-usage.tsx`) against the shared activity labels/capture pipeline. Month title/year/month/today and showcase/remaining insights controls retain their semantic `data-act` targets. The current-month footer is disabled, so it creates no fake action. Highlights had no separate active fixed target; removing that tab leaves the existing generic insights-tab target and remaining current labels intact. Old historical activity is not deleted. Existing click delegation handles native Enter/Space without a second explicit click log; focus traversal/Esc and no-op saving gain no new telemetry. Lighting, autonomous actor presentation and automatic handoff do not manufacture human events or item/learned metadata. The unchanged pipeline is covered by the full activity unit suite; fixture automation remains excluded and public/server DTOs are unchanged. No operating activity/least-used data was queried.

Night contrast uses the shared transparent public/preview chrome; the studio's opaque paper title retains its existing dark ink. This is a painted-background structural exception, not a second month-picker implementation. Seasonal light reuses the existing spatial light pass; this release adds no raytracing engine, shader dependency, model inference or original art replacement.

## Verified implementation / release record

- Unit suite: 6,998 PASS / 429 files (117.53s), with raw earlier failures retained. Typecheck/lint/build and document harness passed.
- Initial broad-scope product BUILD_ID `ysfjsTo1uWXWfSBTqto6X`; productKey `23d7461a7a198d8b76abf119ad8d9f57ef0906f22b5e509915cf0a31f1df1b75`. Its scope has 27 PASS proofs: 11 actual final executions plus 16 validated same-build observations from the preceding receipt. No cross-build case reuse or new observation day from reuse.
- Final native receipt `2026-10-24-1792846515562-31c74037/result.json`, SHA256 `3955c036cbf1dbeecdcef1b99d4c018c555555a2174456247ba7fa8fd8fa36e7`. Source/build/guard/owned-process checks are true. Current native catalog has 287 registrations; the other 260 are not certified by this task.
- The actual rendered pending-night plate exposed another title contrast gap. Backdrop paint ownership now drives title contrast independently of complete art/material readiness. A held original ground PNG verifies pending and ready night titles; the light field retains its original readiness gate and alpha.
- Original optional-art404 guard mistakes, covered studio placement, stale/hidden source-coordinate probes, startup-precondition timeout and parallel-world latency observations remain in attempts1–6. The return file now measures one active world serially with unchanged350ms/contact/continuity limits and actual input/painted-foot evidence. No product RNG, behavior, clock or position is patched to manufacture a PASS.
- Source review and fresh independent actual evidence are in `independent-review.md` and `independent-final/`. Exact commit, public fullSHA, CI and deployed anonymous interactions are bound by `release.json`/`report.html` after release, rather than predicting deployment in this source document.
- This changes calendar/save/records UX and companion scene material/entry presentation; autonomous needs/personality/living routines are unchanged. All-three adopted proposals and four direct requests close only after deployed verification. No new idea-discovery completion is inferred. Genuine-login/RLS/device/OBS, all settings/personalities, full certification and normal36 remain unverified.

## Deployed mobile follow-up

The first released commit `1e34ae9f7eb52fcc0ffc0d32829a9a8d63013ff8` passed CI and the deployed desktop interaction, but mobile cold entry exposed a real focus gap. Both failed deployed attempts remain immutable. Actual event/node-identity diagnostics show the SSR desktop month-title node being removed as the mobile agenda header mounts while its dialog is open; the captured opener is disconnected at Escape. A settled-mobile control passes. This is not an inert/visibility permission issue.

The shared picker now remembers its existing owner surface before detachment and restores a visible replacement month title within that same surface when needed. A connected visible original still wins, and deliberately moved external focus is not stolen. No timers, global replacement search or changed activity capture. Actual viewport replacement reproduces FAIL on the unchanged initial product, then passes on the fix.

Final follow-up BUILD_ID `_DJFAQ3XHa4dXAfEQOYAL`; productKey `41c510aa6e43ceb08f35dc90fee20af819dfc47e9cbf20b2cb39cc770385ddf3`. New actual calendar/save/records11 PASS (25.8s), build82.984s, total126.644s. Receipt `2026-10-24-1792847630462-ae59e95b/result.json`, SHA256 `b7783e492a503aa19f7c13e594b22bb6816db4e8ff30336f9d69a1a13a2eeae6`; integrity/source/build/guard/owned-process checks pass. Typecheck/lint/harness pass. The only product input changed after the initial27 is `components/shared/month-picker.tsx`; the initial seasonal16 remain evidence for their original build, not cross-build PASS reuse or final-build re-observations. New independent focus evidence and exact deployed/CI binding are recorded separately under `independent-focus-final/` and `release.json`.
