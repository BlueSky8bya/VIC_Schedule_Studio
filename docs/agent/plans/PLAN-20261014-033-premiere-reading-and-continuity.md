# PLAN-033 — Stay with the revealed story

2026-10-14 KST · Status: Deployed and verified — cb6e0383

Owner requests an unhurried revealed screen, coordinated departure of the bottom panel control, a preparation badge sliding into its vacated place, a more fluid card-to-stage transition, no generic invitation sentence, gentle build-up motion beyond the numeral, and richer tag-colored reading with the original Tori artwork.

## Decisions

- Supersedes PLAN-031's automatic six-second return and 90s cap **for confirmed reading only**. Current cohort stays until explicit calendar/close/Escape/back/detail action or authoritative removal/settings interruption. Pending/waiting retains existing bounds. Late arrivals never replay. Canonical public records continuously resolve retained generation keys; deletion/re-gating/updates must not freeze old titles, tags, descriptions or actual times. New unrelated premieres never replace a completed reading cohort.
- Panel control uses its own departure window alongside the side boxes (174→150s). Badge slides 158→138s toward the actual measured panel slot; agenda has no panel slot and keeps its safe-area position. No preference/layout/export-geometry changes; restore on dismissal/postponement.
- Same shared FLIP conducts a lightly sprung small card toward the center; only the backdrop unfolds, typography fades at its final size. No giant stretched text, new animation clock or extra timer. Remove “우리의 다음 장면”.
- Existing synchronized motion variables give headings/labels a fraction of the numeral's movement. Everything settles at ten seconds; the same inert/aria-hidden retirement preserves numeral/exit focus. Gfx/reduced-motion rules stay.
- Reuse original local Tori portrait across preparation/countdown/reading; no redraw/new asset. Reading gets a compact portrait keepsake, quiet star cuts, generous editorial type and thin two-tag color edges/washes. Existing TagVisualResolver supplies primary/extra tag colors, custom colors and dark variants; no second palette mechanism. One clear bottom calendar-return action remains visible while reading.
- Shared anonymous/viewer/preview implementation; no API/DTO/DB/auth/unlock/KST or dependency changes. Same polling and authoritative publication gates; no actual schedule seeds/writes.

## Evidence and verification

Apple [fluid interfaces](https://developer.apple.com/videos/play/wwdc2018/803/) and [fluid transitions](https://developer.apple.com/documentation/uikit/enhancing-your-app-with-fluid-transitions) support maintaining the visual identity of source and destination; [Motion HIG](https://developer.apple.com/design/human-interface-guidelines/motion) supports clear, restrained attention and motion preferences. These are design references, not proof of Kairos/subjective immersion. Existing [research/provenance](../../ux/motion/premiere-kairos-research.ko.md) remains applicable; its automatic-reading-return clause is superseded above.

Verify canonical held-reading planner (long wait, cohort isolation, delete/re-gate/update), PC/mobile long/multiple/sparse/tagged reading, close/focus/history/resume, measured panel/badge continuity at intermediate times, morphology frames, final-ten-second calm, OFF/reduce/gfx/landscape, single timer/public canary/export1840. Review new baselines against captured before/after. Independent G-21 review before integration; typecheck/lint/relevant units/build/browser checks, then authorized commit/push and deployed-client smoke. Prior global harness/unit/geometry gaps remain separately recorded.

Implemented and locally verified. Broad browser run: 73 PASS / 1 first-paint Escape failure; listeners/focus/history moved before paint, independently reviewed. Final fresh-build 30-case recheck without updates PASS, including the previous failure and ten snapshot cases (eight intentional new/updated images, two unchanged resume controls). Typecheck/lint/build PASS; relevant units/memory 117 PASS. Real-time PC/mobile light/dark/multiple/long/morph/dock captures reviewed. [QA](../verification/TEASER_READING-20261014.md) records exact scope, corrections and inherited gaps. No DB writes or new polling.

Committed/pushed as cb6e0383; Vercel success and production build matched. Actual production main-route synthetic PC/mobile smoke PASS: measured panel/badge handoff, card morph, one truthful clock, text tension→calm, server-confirmed public tags/subtopics, reading beyond the retired six-second budget, visible manual exit and restored calendar; zero page errors/server writes. Final rollout-record commit is documentation only.
