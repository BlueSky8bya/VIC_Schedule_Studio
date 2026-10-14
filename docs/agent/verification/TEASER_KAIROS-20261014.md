# Premiere moment — 2026-10-14 KST

Scope: [PLAN-031](../plans/PLAN-20261014-031-premiere-kairos.md), [research and provenance](../../ux/motion/premiere-kairos-research.ko.md). Deployed and verified: 4a34433a.

## Product and review

Shared PublicPoster/PremiereStage only. Original transparent Tori portrait, two broad folds, one local wish response, calm final seconds, server-confirmed opening, and explicit continuation into the existing public detail. Accurate clock/public DTO/release authority, queued studio preview snapshot, seeded card slots, export geometry and max occupancy/rest remain. Rehearsal keeps synthetic events out of the calendar; no continuation button where no real detail exists.

Independent G-21 source review found two real defects in the first draft: mobile reading continuation would use the desktop anchor, and rehearsal continuation had no real event. Corrected with the actual agenda media query/origin, public dateKey and omitted rehearsal action. A discovery concern about long text burying the action was addressed by placing it before the heading and asserting it is in the initial viewport. Pending handoff is consumed only when the single rAF runs, avoiding cancellation by a newer public snapshot. No new continuous loop or fetch.

Initial 15-case focused run: 14 PASS/1 FAIL. Failure was a test selector checking `is-pop` on the inner sheet; that class belongs to the existing backdrop. Corrected the assertion to the real topology container; no production behavior was weakened to pass it.

Final independent review found that a server-clock correction could advance the visible flash budget without real time passing. A real browser regression intercepted only fixture GET responses and introduced a +700ms clock sample after the first confirmed release. It failed on the preceding built implementation: 901.6ms between effects instead of the 1.5s budget. Visible-effect budgeting now uses `performance.now()`; the synchronized server clock still conducts the countdown and DB still authorizes publication. Subsequent fresh-build 40-case and final 17-case rechecks PASS, including this previously failing regression.

## Checks

| Check | Current evidence |
|---|---|
| Final production build, standalone typecheck/lint | PASS |
| Relevant unit tests | 72 PASS: premiere planning/choreography/focus, public DTO and hype curve |
| Memory/rule tests | 43 PASS after local completion; final rollout record checked before its separate documentation commit |
| Global harness | FAIL: the same two RULE_MIGRATION active-ID/inventory mismatches; no rule changes |
| Intentional baselines | 6 PASS with update: desktop/mobile fluid, outline and original-host invitation; before/after reviewed |
| Full relevant browser matrix without updates | 78 PASS before the final monotonic visual-budget correction |
| Monotonic visual-budget fresh-build rechecks | 40 PASS, including the previously failing clock-correction regression |
| Reading-control contrast | Themed body ink, light/dark computed ratio ≥4.5; fresh-build focus/moment recheck 16 PASS |
| Return fade follow-up | Regression failed before fix: completed entry animation held opacity 1 throughout return. Entry animation disabled during return; final fresh-build 17-case recheck PASS |
| Local rendered inspection | PC/390px invitation, voluntary hope, long/indented outline and T−3; original portrait intact, quiet countdown, no global filter/canvas |
| Deployed result | Vercel success + production build SHA matched; actual main-route client synthetic smoke PASS |

Browser cases cover unchanged preview-save continuity and single clock, individual departures, public masking/re-gating/deletion/immediate/multiple release, hidden tab, gfx/reduced motion, focus restoration, mobile/landscape touch, plus new asset load, local wish, unhurried reading and no premature bang during data delay. Snapshot cases freeze decorative position or mask numeric ink; server/client time stays real. No page.clock.

## Deployment

`4a34433a04df745d4f7118648e638c1416af55ad` committed/pushed to main. [Vercel deployment](https://vercel.com/bluesky-s-project3/vic-schedule-studio/2cnHK969QsNCXQ3fhEF7wptDGWzX) succeeded and production `/api/soop-live` build matched. Deployed-client checks used the real `/` and its compiled client, with synthetic 2025-09 GET responses substituted only inside a fresh test browser; all browser POSTs intercepted (2 blocked, 0 sent).

PASS: original 640px portrait loaded, local wish response, one detail countdown, unrelated/month navigation lock, individual departure deadline and restrained carrier entry, no pre-release canary, quiet finale/zero drift/retired ring/Tab-to-exit, server-confirmed title + 3 subtopics, mobile full-width reading/no horizontal overflow, continuation into the normal mobile detail surviving 6.5s, Escape/native interaction restoration, no anonymous rehearsal and zero page errors. Genuine-login studio preview remains fixture/Flight-stub coverage, not a real production authenticated session.

## Safety and limits

All browser POSTs intercepted; fixture events are synthetic/past-month. No real schedule seeds, migrations, DB cleanup, auth/unlock/grant or public DTO changes. Static 54,528-byte WebP is the only added transfer; DB/analytics/polling cost added 0. Visible effects also use the existing 1.5s flash budget after server confirmation.

Genuine production login, physical screen-reader/mobile/haptic/audio devices, formal composite luminance, complete 180s observation and multi-region nano load remain NOT VERIFIED. Existing full-unit failures/old calendar geometry baseline are recorded by PLAN-030 and were not claimed fixed or rerun here. Fan enjoyment/subjective Kairos experience is a research-informed design hypothesis, not an established usability outcome. All-site research did not authorize unrelated studio/VOD or ambient engine redesign.
