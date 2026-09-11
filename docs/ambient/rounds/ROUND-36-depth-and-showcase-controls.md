# R36 — Distance and showcase controls

2026-09-11 KST. Local implementation complete; no push requested.

User supersedes R35's lower two-thirds restriction: allow meadow creatures and seasonal material toward the horizon, with continuous size, speed, opacity and cached softness. Preserve the ground artwork. Butterfly markings must inherit whole-wing opacity.

Rework shared developer controls: compact corner tools, collapsed map, direction and full KST date/minute selection, secondary options folded. Preserve developer-only settings, viewer meadow restriction, mobile exclusion and deep seal. Date overrides must consistently affect astronomy, weather and traces. Native input keyboard actions must not navigate biomes.

HCI basis: [progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/), [visible system state](https://www.nngroup.com/articles/visibility-system-status/), [slider keyboard semantics](https://www.w3.org/WAI/ARIA/apg/patterns/slider/).

Implemented shared distance curves: far size .22→1 and screen speed .12→1, continuous opacity and one-time cached soft sprites. Butterfly markings inherit wing alpha. Animal shadows, carried acorns and rabbit footprints/jump height follow distance. Budget reductions retire excess drift material over two seconds.

Shared controls: top-left exit, bottom-left folded map, top-right nonmodal developer panel. Four bearings, date input (1900–2100), minute input and 0–1439 slider. Secondary settings fold away. Dates drive season, astronomy, weather and traces without losing the selected biome. Arrow keys adjust native controls/radios; Escape restores settings-button focus.

Verification: typecheck/lint/build pass; 82 unit files, 860 tests pass (includes unrelated concurrent activity work). Shared-control browser checks cover leap day 2028-02-29, winter remount/live resume, 00:00/23:59, radio/slider arrows, no biome jump and Esc focus restoration. 1400×860, 900×700 and 641×480 layout checks pass. Four seasonal captures inspected; browser errors absent. Evidence: `.scratch-pw/qa/r36`, scripts `r36-controls.mjs`, `r36-depth.mjs`.

Independent A/B/C reviews: fixed excess-mote budget, body/shadow/carried-object mismatch, rabbit distance offsets and radio/Esc accessibility. B found no additional date/role wiring defect. C accepted rendered corner layout; time field width was then corrected and recaptured.

One initial build failed on a transient missing Next export file; clean retry passed. Concurrent unrelated work later replaced the shared `.next` build, invalidating follow-up runs; server/current-source build restored before final verification. These runs are not counted as passes. Physical devices/OBS and genuine-login RLS are outside this fixture evidence.

Final current-source preview build: ulmScLyovdz_-EmIE570N. Repeated shared-control checks passed. Spring/summer/winter drag→move→horizon fade passed; 60-second animal samples included rabbit y448 and squirrel y524 at h860. Mobile 390×844 engine exclusion passed. Harness verified (8015-byte brief).
Ambient QA selftest completed: all deterministic frame/time/weather/seed checks and deep weather seal passed, no page errors (30s).

## Compact movable panel follow-up

User requests removing the duplicate time input, previous/next day buttons, matching calendar styling, a small reset action, translucent draggable panel. Plan: shared panel only; retain native range keyboard semantics, civil-date rollover and developer/mobile gates; clamp drag/resize position to viewport. Verify month/year/leap rollover, calendar selection, drag, keyboard and compact layout. No push requested.

Compact follow-up complete (build `b3f-sUeJlCYacCbN_-mNJ`): basic panel 280×237; native time field removed, current HH:mm beside day controls, themed year/month calendar, small header reset, token-based translucent glass. Pointer capture and keyboard move with viewport clamp. Review fixes: clear drag on lost capture/close; prevent outside-panel buttons leaking arrows into studio calendar shortcuts. Typecheck/lint/build pass; 10 relevant unit checks pass. Browser checks pass for leap-day next/previous, 23:59→next-day 00:00 and reverse, calendar Escape, pointer/keyboard movement and 641×480 bounds (panel280×456 when expanded). No page errors. Captures: `.scratch-pw/qa/r36-compact`.

Calendar follow-up: day buttons now bridge 23:59→next-day00:00 and 00:00→previous-day23:59; other times stay the same. Shared holiday marks color Sundays/holidays red, Saturdays blue (holiday wins), including selected cells. Outside the curated 2023–2027 variable-holiday range, calendar states partial coverage. Corrected false 2026-09-28 substitute and missing 2027-05-03 from official KASA releases: https://www.kasa.go.kr/prog/bbsArticle/BBSMSTR_000000000010/view.do?bbsId=BBSMSTR_000000000010&nttId=B000000001860Pe2zT3 and https://www.kasa.go.kr/prog/plcyBrf/brief/kor/sub01_01_04/view.do?plcyBrfNo=431 .
Calendar follow-up verified on build mUrowzhHf3XOfCeCnDTGc: real day-button forward/backward midnight rollover; holiday/Sunday/Saturday computed colors, selected holiday color retained, no page errors. Typecheck, lint, build, 6 relevant unit checks and harness pass. Capture: .scratch-pw/qa/r36-compact/holidays.png.
Current-button correction: explicitly set kstToday year/month/day instead of reverting to the viewed calendar date; hour/band overrides clear for live current time. Close stale date picker. Verified actual click after 2028-02-29 23:59 returns to 2026-09-11 current KST with no page errors. Typecheck/lint/build and 6 date tests pass.
Year/month picker correction: replace OS-native selects with shared themed inline listboxes, bounded three-column scrolling years and all twelve months. Selected/focused colors match calendar; arrows/Home/End/Page and numeric type-ahead supported; Escape closes picker before calendar/panel. Verify expanded menus rather than closed triggers only.
Picker verification complete on o0e_bSGwOJuFXm7z_-O-Z: opened year/month screenshots inspected at1400px and641px; no native selects remain in panel; numeric year jump, month click, leap date selection and two-stage Escape/focus pass, no page errors. Removed remount autoFocus that stole trigger focus after picker close. Type/lint/build, six date tests and harness pass.

## Publication

2026-09-11: owner accepted and requested push of integrated R35/R36 and all subsequent control refinements. This supersedes earlier no-push notes. Release-wide test caught the new date-button activity-label omission; added the missing safe static label before publication.
Release gate: 83 test files /866 tests passed; production build (including lint/type validation) and harness passed. Only ambient release files and related holiday/activity-label corrections staged; personal .vscode and preview-360.png excluded.
