# Companion profile layout — 105

Date:2026-10-18 KST. Status:complete, deployed result verified.

## References and intended adaptation

Official [Neko Atsume Catbook](https://nekoatsume.com/en/about.html) presents a named character, labeled personality information and favorite objects. Official [Ooblets June 2018 creator devlog](https://ooblets.com/2018/06/moving-into-an-office-e3-friendship-and-more-the-june-2018-devlog/) shows a character-anchored friendship organizer and consistent experience slots. The original screens were viewed directly in Chrome by the research reviewer. Their layout principles inform the shared profile hierarchy; their artwork, scores and progression systems are not copied. The Ooblets screen is historical evidence, not a claim about the current release.

The shared settings subtab becomes 프로필. One information frame groups identity/favorite fruit, four qualitative tendencies, actually earned habits and recent experience. Manual animal mode/basic personality/learning controls follow. The same bounded state and notification thresholds drive the short prominent labels and explanations. Local memory/reset and OFF behavior remain established behavior.

No new model fields, server requests, DB access, timers, character atlas downloads or animation loops are introduced. Public/private boundaries, role authority and KST are unchanged. Mobile companion remains excluded. User artwork and unrelated drafts remain untouched.

## Additional ideas — proposals only

- Discovery book: only witnessed fruit/behavior gets a small stamp; bounded enum/bitset and no absence punishment. Neko Atsume's Catbook/album and Ooblets' experience organizer are references.
- Profile portrait choice: select from already witnessed existing poses, storing one enum rather than a calendar screenshot. Neko Atsume's named portrait/album is the reference.
- Guess the favorite: one user-started three-fruit choice, using the current real favorite without changing hunger or learning. Feeding/bonding in [Pokémon GO's official Buddy Adventure launch](https://pokemongo.com/news/buddyadventurelaunch) informs the interaction; the three-choice game is our design proposal, not a source feature claim.

These are not implemented by this UI request. They need no permanent automatic loop if separately authorized.

## Verification

Product source frozen before production build `1touKYZTGMYZqe-VujMrr`. Local runtime127.0.0.1:3116 uses the ordinary production build with `VISUAL_TEST_FIXTURE=1`; mutation/live API dependencies are intercepted. Local/automation analytics guards remain intact.

- Full final unit run:216 files /2,236 tests PASS. Typecheck (after generated build routes), whole-repository lint and production build exit0. Documentation harness269 documents PASS before final release metadata.
- Shared settings12/12 native cases PASS:viewer/studio/preview ×light/dark traits; viewer/studio ×light/dark learned habits; actual master/detail OFF and reload; arrow/Home/End keyboard controls. The trait matrix also covers actual cross-tab storage events, negative learned habits, qualitative high/low/balanced states, actual OFF/reset/reload and preserved hunger/affection. The real1050px desktop resize retains readable content without horizontal overflow. Text measurements retain13.5px minimum; habit labels/descriptions retain4.5:1 measured contrast in both themes.
- Mobile6/6 cases PASS:390px and coarse landscape across public/studio/preview; no companion settings/assets/entities, ordinary settings remain usable and saved desktop ON is preserved.
- Native meal2/2 cases PASS:viewer/studio actual food consumption updates only the consumed fruit, preserves its initial seed through reload and displays a genuine meal reason in the new shared profile. The old region-scoped recent-reason selector was corrected after independent review because the reason is now a common profile strip; the positive assertion verifies the actual meal message.
- Before/after screenshots inspected directly:104 previous centered trait card and105 full profile, light/dark, narrow desktop and whole settings dialog. Independent source/security/performance review and separate rendered/UI review found no remaining actionable product issue. One shared DOM/CSS implementation serves all PC surfaces; manual controls remain below the read-only profile.
- No artwork, package/dependency, API, schema or permission change. Extra ideas remain proposals only. Actual broadcaster OBS/GPU/encoder and genuine-login/RLS tests are separate, not claimed here.

Local logs/screenshots are under `.scratch-pw/companion-105*`; reporter JSON is under `.scratch-pw/.scratch-pw/companion-105-*-report.json` because the reporter resolves its configured path relative to the config. Reports confirm20 expected,0 unexpected/skipped/flaky. Some older settings/mobile helpers permit ordinary public-page prefetch reads; those are read-only and do not establish RLS coverage. No production care reset or schedule mutation is part of fixture verification. The local fixture server was stopped.

## Release

Released commit:`edcf2a93a5d1f6a45ec037d1d261a3be325663cd` (`feat: organize companion traits and habits`). Main push completed. [Remote quality39100282369](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39100282369) completed successfully with all13 steps, including isolated SQL/contracts/build/generated-route types/lint. [Vercel deployment](https://vercel.com/bluesky-s-project3/vic-schedule-studio/G8jB3Sv5Pf3myHap9sRknt3tpZ4k) reports success.

Production GET verification returned the exact full deployed SHA from `/api/soop-live`; public clock200/no-store, warm204 and anonymous developer presence401/error-only/no-store remain intact. Production fixture route returned its streamed404 fallback and exposed no fixture.

Actual authenticated developer studio was reloaded after SHA verification and displayed the `edcf2a9` badge. Real panel/settings/companion/profile controls opened the shared640px information frame with actual saved favorite/basic personality/four tendencies/earned habits/recent experience, zero horizontal overflow and one resident. The complete profile and surrounding modal were captured in `.scratch-pw/companion-105/production-profile-full.png`. Native keyboard scrolling exposed its whole hierarchy. An intermediate clipped capture did not match the selected subtab and is not release evidence; a fresh full capture and a separate52-second no-input observation confirmed the actual profile stays selected with the companion enabled. Narrow code review found no care-notification remount path; no unsupported cause or product fix is claimed for that intermediate capture.

No production preference toggle, reset, schedule/heart/auth action or account change was made. The settings window was closed and original November2026/right-side folded panel restored. The protected user-authored premiere art log retained its pre-commit SHA and stayed outside the commit, as did unrelated drafts. These post-release metadata updates remain local for the next authorized product commit rather than triggering a docs-only production deployment.
