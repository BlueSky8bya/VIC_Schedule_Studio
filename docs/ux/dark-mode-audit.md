# Dark mode audit — 2026-09-19

Status: complete and deployed. Owner authorized push on 2026-09-19. Product commit `494e8905` pushed to main; Vercel reported successful deployment.

## Outcome

Owner requested direct screenshots across pages, windows and their tabs, then visual refinement. Shared warm charcoal surfaces, subtle metal highlights, readable ink and semantic selected/on states now extend across viewer, studio and auxiliary interfaces. Original tag colors and art-stage backgrounds remain intact.

- `app/globals.css`: shared dark material/shadow tokens; light-only eye-comfort overrides no longer paint dark studio surfaces. Eye comfort warms UI glass in dark mode while leaving ambient compositing unchanged.
- `app/dark.css`: dark-only overrides for legacy literal colors in calendar/hover, panels, settings/menus, editor/date picker, taxonomy/color picker, public search/detail/records/replay, drawing/help, all dashboard tabs and visit drill-down, auth/system pages, art inventory/card/table/detail and dictionary.
- `studio-shell.css`: date flash finishes with the theme ink token; original light fallback is unchanged.
- `public-poster.css`: discovered mobile replay defect fixed in the existing shared <=899px stack. Desktop width calculation was subtracting the rail even when stacked, collapsing the video/strip. Page and modal now use full available width; page stack begins at the top. This intentional structural repair applies to both themes.
- `app/visual-fixture/theme/page.tsx`: flag-gated synthetic replay/dictionary surfaces, no operational loader. `tests/visual/dark-mode.spec.ts` exercises the shipped `vic.dark` setting and computed themes rather than synthetic CSS token replacement.

## Capture coverage

Final 116 images plus 40 before images and searchable comparison gallery: `output/dark-mode-review/index.html`. Main capture script: `tests/visual/dark-mode.spec.ts`. Independent dashboard scripts and inventories: `tmp/dark-audit/reviewer/`.

| Surface | Cases directly captured |
|---|---|
| Public viewer | Desktop, phone, landscape; detail, teaser detail, all four search sorts, empty/error search, monthly records |
| Studio | Owner/developer, viewer preview, desktop/mobile editor, options and date/time picker |
| Settings | Developer dark switch, selected/unselected states, dropdown portal, mobile popover; persistence and light restoration |
| Replay | Both parts, keyboard help, desktop/phone; light mobile, rail directions and fold interaction |
| Drawing | Board, tools/layers and keyboard help |
| Developer dashboard | All 8 tabs: trend/content/engagement/highlight/live/visits/security/system; lower scroll content, scopes/device/week/log/role/stay filters and performance range |
| Owner dashboard | All 5 tabs; passcode change window without submission |
| Mobile dashboards | All 8 developer and 5 owner tabs |
| Visit drill-down | Scopes, lower content, expanded activity, usage dropdown |
| Taxonomy | Content/format/help, color picker, discard confirmation |
| Utility pages | Login, not-found, dictionary/edit, art inventory/detail/table and all exposed secondary filter groups |
| Settings combinations | Ambient on/dim/off × eye comfort on/off, software graphics/lite palette; no root filter, transparent ambient surface preserved |

Independent final capture: 50 PNGs (23 dashboard + 27 supplemental), runtime errors 0; reviewed remaining specificity/contrast defects corrected. Full main screenshots include long utility pages; gallery thumbnails crop only previews and link to original images.

## Verification

- Typecheck and lint: PASS.
- Isolated production build: PASS. Built in `tmp/dark-build` to avoid collision with another active dev process using the main `.next` directory. Same affected product sources, normal dependencies; no product config change.
- Main visual/interaction suite: 15/15 PASS (final isolated production build, 1.1 minutes).
- Theme geometry: owner/developer/public calendar sizes and positions unchanged across toggles; light body ink restored exactly, PASS.
- Eye-comfort comparison, final compiled fixture: 97.42% of calendar pixels changed; mean blue-channel change over changed pixels −6.51. Root and `.gs-season` filter/opacity/blend unchanged (`none/1/normal`); this fixture renders no seasonal canvas, so canvas-specific evidence is not claimed. Measurement freezes animation frame scheduling between paired screenshots, not the UI palette.
- Fixture disabled: renders not-found with no replay content. Streaming response starts at HTTP 200 and carries Next's 404 fallback; do not mistake the initial status for exposed fixture content.
- Full unit suite: 947 passed / 949. Two failures in untouched `tests/unit/ambient-codex.test.ts` (lines 92, 125): shallow biome has no species / no wave-1 species. They concern the existing ambient catalog, not theme rendering. No passing claim for these checks.
- Harness/document check: FAIL — unchanged AGENTS.md declares G-18 twice (lines 30 and 47). Rule content/IDs were not rewritten as part of the visual task. git diff --check: PASS.

## Boundaries and limits

No auth, role, server DTO, unlock, KST helper or database changes. Public fixture data is synthetic. Browser API writes/external media were intercepted; real login/RLS, external playback, OS-native picker rendering and realtime multiuser presence are not established. Actual presence stays zero under automation. No production data mutation or dependency change.

Existing unrelated user files/work (including `.vscode`, `preview-360.png`, and concurrent search/migration work) were left untouched. Earlier injected-CSS captures under `tmp/dark-audit` are iteration evidence, not final production verification. Completed results belong here; no completed-history append to CURRENT_STATE.



## Production verification — 2026-09-19

Public site `https://vic-schedule-studio.vercel.app/` returned 200. Served CSS contains the new dark materials, eye-comfort glass and mobile replay width fix. Headless desktop (1840×1000) and mobile (390×844) captures show the active dark palette; no horizontal document overflow and no browser runtime errors. Production screenshots and machine-readable results remain local in `output/dark-mode-review/production-*.png` and `tmp/dark-audit/production-check.json`. Analytics guards and intercepted non-GET requests prevented synthetic interactions from writing data. Authenticated studio remains covered by the local fixtures, not this anonymous production check.
