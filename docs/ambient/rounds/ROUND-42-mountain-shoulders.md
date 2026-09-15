# R42 — Mountain shoulders rather than rounded waves

2026-09-15 user rejected R40 as overly smooth/simple; requests web-photo comparison and more natural mountain contours.

Reference viewed in browser: [NPS Craggy Gardens](https://www.nps.gov/blri/planyourvisit/craggy-gardens.htm), Jim Ruff sunset photo linked there. Observed asymmetric summits, long oblique slopes, short steeper shoulders and small irregular outcrops. Search comparisons also included Shenandoah panoramas. Images are visual reference only, not downloaded/copied into product assets.

Replace R40 fully eased low hills with irregularly spaced mostly linear slopes at three scales, modest rounding at corners from existing cache feather. Increase broad relief within existing ridge cache (top bounded 12–74px); preserve continuous silhouette/no cutout gaps, source texture and all R39/R41 work. Fixed coordinates across seasons. No push requested.

Locally verified; awaiting visual feedback. Typecheck/lint/final build PASS. Full suite 84 files/873 tests PASS before final relief-amplitude tuning; affected ridge suite 2 tests PASS after tuning. Eight seasonal noon/night captures plus wide 3440px and low-load spring captures: no errors, `.scratch-pw/qa/r42`. A: asymmetric summit groups/shoulders visible, no sawtooth repetition or old notches. B/C: deterministic continuous knots including negative coordinates; texture/cache/time/season contracts unchanged. Isolated Chromium painter + pixel readback median 8.2ms at1400px /12.6ms at3440px, cache-bake-only, not whole-frame/device timing.
