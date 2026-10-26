# Compact mobile header — 2026-10-26

Latest owner request supersedes the prior bottom-toolbar preview return and Oct16 Studio month-row settings exception. Preview return now sits below Records; every narrow surface shares the upper-left44px gear and one44px month/caption control. Portrait headers measure60px Studio/61px public, with gear x14/y8 in the tested viewports. Desktop detailed status/version controls remain.

Mobile saving projects the existing queue through a small spinner/check/alert and a polite status. Idle never asserts success; only actual saved+KST time shows the check. Failure has a visible same-height caption and the existing44px failed-input recovery beside account exit. Equal side reservations keep the month centered, including320px recovery. No queue, permission, KST or API changes.

Notice metadata/read date and44px link/detail/edit actions share one fixed44px header above complete wrapped titles. One-day ranges stay omitted. The previous27px heading plus52px detail slot becomes44px (35px structural saving). Maximum overlap title reservation remains to prevent date movement as context changes. Padding7/0 retains the same overall board height and8px clearance for the top action. The shortest preview frame reserves206px: a44px tag row, Records and Return all fit. Ordinary short frames retain168px. The whole notice board remains reachable in normal flow below480px height.

## Executed evidence

Durable run: `C:/Users/im917/.codex/vic-pipeline/runs/20261026-mobile-header/`.

| Gate | Actual result |
|---|---|
| Build | `build-r05.log`, exit0; final product projection |
| Typecheck | `typecheck-final.log`, exit0 |
| Lint | Full `lint-r01.log`, exit0; final changed-test ESLint also exit0 |
| Units | `unit-scoped.json`:102 passed,0 failed/pending; notices, queue, failed-input recovery and activity contracts |
| Browser scenarios |46 distinct passed: context29, calendar11, settings3, save3; original attempts and exact build reuse retained |
| Final CSS delta | `visual-main-r05.json`:8/8, including16 portrait routes, both rotation flows, tag editor, LIVE/footer and568×320 preview |
| Portrait delivery | `visual-delivery-r05.json`:1/1 repeat of the same short-preview case; fresh390×844 portrait capture after resetting Chrome's rotated capture viewport |
| Independent source review | `/root/mobile_context_scout` accepted final source and same-height padding delta; no unresolved findings |
| Independent rendered QA | `qa-agent-smoke-r02.json`:7 distinct passed; actual synthetic queue success/failure/recovery, settings/focus, read-only preview |

The64 portrait route combinations cover0/3 notices, owner/developer/anonymous/preview,320/390 widths,568/844 heights and light/dark. Signed viewer and in-app motion have additional directed cases. Gear/month/account/recovery controls retain44px hits; labels stay whole; date/rail bounds remain stable within0.5px.568×320 preview measured206px frame and44px tag body, with Records/Return native hits and outer scroll0→180→0. No real DB writes: write responses and allowed read actions were intercepted; unknown mutations/page errors were0 in the scoped fixture checks.

Reused r04 evidence is explicit: r05 only moves board internals down3px by redistributing the same7px vertical padding. Header/queue/permissions/title sizes and total board/date/frame dimensions are unchanged. Final r05 reruns exercise the changed metadata clearance, title visibility, native actions and representative portrait bounds; unaffected r04 cases are not claimed as rerun.

## Preserved failures and limits

Original build import error, actual320px recovery label clipping and short-landscape5px metadata clearance were repaired and rechecked. Test-sequence corrections preserve the original no-op toast occlusion, concurrent Playwright artifact collision, obsolete heading selector and delayed Today/capture attempts. They remain separate from product failures in the durable reports; skipped/unrun attempts are not passes.

G-22: existing semantic action IDs and shared capture/display paths remain; placement hints for month steps/settings were updated. Automatic save feedback/context changes create no human action or least-used-feature events. No new personal/product-text collection.

Fixtures do not establish real-login/RLS, screen-reader or physical-device behavior. Exact release, CI, provider alias and public readback are tracked in this run's immutable release-intent/confirmation and deployment summary; deployment is complete only when those receipts actually confirm it.

The design applies immediate, relevant status feedback while avoiding persistent technical clutter, informed by [NN/g's visibility of system status](https://www.nngroup.com/articles/visibility-system-status/) and [Apple's progress indicator guidance](https://developer.apple.com/design/human-interface-guidelines/progress-indicators). The particular layout is a project design decision, not a research-proven universal optimum.
