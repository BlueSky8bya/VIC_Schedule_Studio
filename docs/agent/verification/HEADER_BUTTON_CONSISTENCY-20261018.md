#102 header button consistency

Date:2026-10-18 KST. Status:deployed correction verified.

## Scope

Restore soft studio account/tool controls after a specificity regression, audit viewer/preview/mobile peers, move the PC deployment badge to bottom-left, and let the shared narrow-desktop home launcher occupy the vacated header-left position. Preserve role/server/KST/write boundaries, semantic button hierarchy, saved preferences and mobile companion exclusion.

## Evidence to collect

Record the inspected cascade/history, actual changed selectors and topology, independent review, local typecheck/lint/unit/build/harness exit codes, rendered roles/themes/widths/zoom/native menu/copy checks, and authorized deployed full SHA/CI/provider/actual UI. Unrun checks remain unverified. Fixture writes are intercepted; no real schedule edits are permitted by this UI verification.

## Cascade and related-control audit

The earlier soft account-control correction remains in `studio-calm-layer.css` (history `bc395a42b`). A later home-launcher exclusion (`cf00f2b4`) raised the broad neutral metallic skin above that exception. Changing only this exclusion to specificity-neutral `:where(:not(.vc-home-launcher))` preserves its matching set while allowing the existing normal/hover card exception to win again.

| Control family | Intended shared design | Audit/result |
|---|---|---|
| Studio account preview/logout | Transparent12px inset cells, common soft hover within the account card | Cascade corrected; synthetic Chromium before/after witness and final native normal/hover/hit checks passed |
| Studio panel tools/season/help controls | Existing card-internal soft exception | Same corrected cascade restores this exception; no distinct new skin |
| Standalone header settings/home/search/history/login | Shared44px pill, header surface/ink/press tokens | Existing poster/shared implementation retained |
| Authenticated public account and preview-return/drawing controls | Card-internal36px/12px controls within shared44px outer material | Existing separate hierarchy retained; no same specificity defect found |
| Mobile studio settings/logout/actions | Existing44px pill targets, latest left-settings/right-account alignment | Retained; removed obsolete passive mobile version segment only |
| Semantic primary/danger actions | Existing distinct action meaning | Excluded from the neutral-skin correction |

The public metallic skin's home exclusion has no competing card exception of the same form and already excludes public header descendants. No public/global cosmetic rewrite was needed. This audit covers related chrome, not every unrelated editor/input control.

An additional isolated Chromium comparison of the pre-regression parent(`cf00f2b4^`) and shipping CSS matched9 representative structures×normal/hover,18 states with0 computed material/radius/ink/border differences. This includes editor auxiliary/save/delete and standalone controls; their existing semantic and utility styles are preserved. This CSS witness is distinct from the native production-build fixture checks below.

## Badge and header placement

The copyable badge keeps its existing label/action/1.4-second confirmation and moves outside `.studio-topbar` to a fixed bottom-left16px/safe-area position, with inverse shell zoom and no flow reservation. It uses z5 below ordinary rail6, editor12 and overlay/modal chrome. The shared1040px/coarse-height capability excludes it from narrow/mobile layouts independently of companion ON/OFF. The passive mobile badge is removed. The existing launcher becomes the first header-left child with no reserved version width. Preview's sanitized public tree contains no studio badge.

Independent code reviews of the cascade and badge placement found no remaining P1/P2. Their potential ordinary-rail layering finding was corrected from11 to5 before the final build. A test ownership concern about click-through wrapper space is tracked separately from actual product layering.

## Local checks so far

Initial product build `68JWH77d6eH22EOXz1_oq`: unit211 files/2,168 tests, typecheck, full lint, production build and harness264 PASS. First rendered run:27 pass/11 fail. Eight failures came from a fixture using settings epoch as its first-panel-choice predicate even though the base already seeded that epoch. It now seeds only a missing panel choice and preserves actual changes on reload. The old native clipboard fixture now grants real browser clipboard permissions and brings the page forward; no callback/state replacement is used. Two new dark cases incorrectly expected a noninteractive semantic role label to be transparent; actual preview/logout assertions remain unchanged. Actual painted panel ownership replaces click-through wrapper intersections in the layering test.

The corrected run passed33/34 on the same build, with the four unchanged mobile-header cases from the first run separately retained. One remaining developer1280/dark failure reproduced in a focused trace and bounded passive event observation: calendar document coordinates and dimensions stayed unchanged while the return pop restored116px rather than the test's original0. Passive return evidence alone initially suggested a product defect, but entry-point/control-step diagnosis showed the source position was already116 after Playwright's automatic menu-item scroll. The existing history return was preserving the actual source position.

Replacing only that fixture input with real menu-center mouse clicks, after actual BCR/viewport/native-hit checks and animation settlement, preserved0 through administrator/developer choices, preview entry, button return and native Back. The expected calendar and scroll values remain strict. The provisional product scroll correction and all temporary diagnostic logging were removed before integration; history/ref queues/scroll policy remain unchanged. Original/corrected/trace/passive/entry-control reports stay separate locally; those diagnostic runs alone did not establish shipping verification.

## Final local verification

Shipping build `zntlRDOg6wtGcrUiMONBd`:211 unit files/2,168 tests, typecheck, full lint, production build, harness264 and one final38-case native run PASS. The final run used existing baselines without `--update-snapshots`; all38 passed in4.0 minutes with intercepted mutations0 and page errors0. Coverage includes owner/developer wide/compact/dark/zoom account buttons, actual copy/readback and hover/hit behavior, home/calendar/scroll stability, left panel layering, public signed-in/anonymous/preview shared chrome, persisted disclosures, mobile settings/X/Back/focus and companion/build-metadata exclusion, as well as native viewer-return and browser Back.

Four intentional studio compact screenshots were updated during preparation and visually compared: light/dark header entries now contain only the leftmost home launcher; heading clips change283→282px because of its new pixel-aligned anchor, with typography/36px heading unchanged. Public baselines did not change. Root also opened final full light/dark fixture screenshots and verified the requested placement. Final independent review found no P1/P2 and confirmed no provisional scroll code, new loop, runtime inference, server/API/permission/KST or dependency changes.

Before release, actual developer Chrome at1590×1131/November2026 confirmed the old build `deac458`: header badge x24, home x101.35 and preview/logout10px metallic gradient/shadow. This is comparison evidence only. No actual schedule/heart/role edits were made.

## Deployed verification

Commit `35dd86afcd80309dc33688f2dfe742e69cde21c8` is on main. [Remote quality39093786040](https://github.com/BlueSky8bya/VIC_Schedule_Studio/actions/runs/39093786040), job117575862936, completed successfully with all13 steps. [Vercel deployment8qqEqeiRJUNh2zNzvF7Kypk9qp5M](https://vercel.com/bluesky-s-project3/vic-schedule-studio/8qqEqeiRJUNh2zNzvF7Kypk9qp5M) reports success.

At2026-10-18T03:32:21Z, production `/api/soop-live` returned200 with the exact full commit above; public clock200/no-store, warm204, anonymous developer presence401/no-store/error-only and fixture streamed404 boundary all passed. HTTP200 for the streamed fixture shell is recorded separately from its actual not-found outcome. These canaries are not genuine-login/RLS coverage.

After intentional reload, actual authenticated developer Chrome at1590×1068/November2026 showed badge `35dd86a` outside the header at x16, bottom gap15.56 physical pixels(rounding under existing zoom), fixed/z5. The shared home launcher is x24 and44×44 at the header-left start. Preview/logout computed transparent backgrounds, no gradient/shadow and12px radius; a full viewport screenshot was visually inspected. One companion remained visible. Right-side folded rail and saved preferences remained unchanged; no schedule/heart/role mutation or viewport override was made. Evidence: local `.scratch-pw/chrome-102/deployed-canaries.json`, `actual-ui.json` and rendered-shipping reports.

Final read-only review of the committed18-path scope found no additional findings: product changes remain limited to three files, protected user art is excluded, and temporary scroll/history/debug logic is absent. Fixture server3116 was stopped. Post-release documentation remains local; actual OBS hardware, genuine roles/RLS and provider quota recovery are outside this UI correction's claims.
