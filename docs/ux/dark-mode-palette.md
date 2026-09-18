# Dark palette follow-up — 2026-09-19

Status: third owner correction in verification — subdued color harmony, continuous popularity rail in both themes, and theme settings for every audience. Earlier release evidence below remains historical.

## V3: research-informed harmony — 2026-09-19

The owner rejected v2's saturated fills. The current UI has warm charcoal surfaces (`--paper: #1a1916`, `--cal-cell: #262420`, `--surface: #26241f`). V3 keeps that background and source hue semantics, while separating quiet card fills from brighter small accents. Example pastel-family fills: rose `#6d494a`, olive `#57563c`, sage `#445a4f`, slate `#435669`, mauve `#5d4c67`.

Evidence and limits:

- [Google's dark-theme guidance](https://developer.android.com/design/ui/wear/guides/m2-5/styles/color) recommends desaturated colors and sparing accents, with darker tones covering larger areas. Its black-background requirement is specific to Wear OS, so we do not import that requirement into this website.
- [Radix's scale roles](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale) distinguish component backgrounds, borders, solid accents and text. We adopt the separation of roles, not a copied palette or a new dependency.
- [Chameleon (Karunathilaka et al., revised January 2026)](https://arxiv.org/abs/2512.00516) jointly considers luminance contrast, color semantics and adjacent-color differences. Its 12-person study is not proof of an optimal palette for this calendar or reduced fatigue; no significant analytical-task/fatigue difference was found. It informs what to balance and why to inspect actual renders.
- [WCAG 2.2 text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) supplies the 4.5:1 normal-text minimum. Contrast is checked independently of aesthetic harmony.

Our application judgment: OKLCH fill L=0.38+0.08×sourceL, chroma capped at 0.065 (v2: 0.14); border cap 0.075, small accent cap 0.11. Preserve source hue, retain neutral grays and avoid the old amber overlay. The five sample fill families remain >0.03 apart in OKLab; this is a product regression guard, not a universal perceptual threshold. Exact constants are our design choices, not values prescribed by the sources.

`0123` stores v3 alongside v1/v2, preserving original colors and inherited NULL values. Apply migration before deploying readers. SQL/TS exact parity: 1,240 colors; 27 stored palettes and original 43 row hashes verified, temporary insert/update/NULL checked. Reverting to v2 readers restores the prior appearance without rewriting source data.

Popularity root cause: TierMark deliberately rendered 1–4 children with 2px flex gaps. It now renders one continuous inset rail in both light and dark. Shared CSS also handles mixed cards and continuation segments; agenda puts the rail beside its existing category stripe. Settings remove only the developer display gate from StudioSettingsList; all audiences use the existing local preference hook, without changing server privileges.

Mobile public settings also lacked an entry button. The agenda header now reuses the desktop button and dialog; narrow 320px headers hide decorative sparkles to preserve the 44px settings target. Owner, developer, signed-in viewer UI, anonymous and viewer-preview fixtures exercise the same preference on desktop/mobile, including reload persistence. These fixture roles do not establish real-session/RLS coverage.

V3 local verification: production-build visual/interaction suite 30/30 passed; final 320px header adjustment then passed its settings/persistence test and actual-public screenshot check (no overflow/runtime errors). Typecheck, lint and isolated production build passed. Unit suite 954/956 passed; the same two pre-existing ambient-codex failures remain. Harness still reports the pre-existing duplicate active rule ID. Independent reviewer checked shared rail geometry, mixed-card specificity, role gate removal, migration and public DTO mapping. Gallery: `output/dark-mode-harmony/index.html`; full captures/logs: `tmp/dark-audit/v3-tests`, `tmp/dark-audit/*v3*`.

2026-09-19 follow-up: v2 raises pastel chroma and removes the dark eye-comfort amber veil from cards, while leaving neutral colors neutral. `0122` adds generated v2 columns, preserving v1/source values. SQL/TS parity 1,240; existing source hashes unchanged; insert/update/NULL automatic storage verified. Minimum tested text contrast >4.5:1; distinct pastel-family OKLab distances >0.055. Visits now include explicit dark zero values, owner session tracks, criterion chips and day calendar ink. Ribbon base colors were already deployed; solo/hover text and highlights are corrected too. Public ribbon hover now scopes to the actual `.poster-page` root; independent review confirmed the fix.

V2 verification: typecheck, lint and isolated production build passed. Unit suite 954/956 passed (same two pre-existing ambient-codex failures). Production-build visual suite 19/19 passed; strengthened visit-zero/session and support/period hover cases then passed 2/2 on the final build. Support fixtures freeze time inside their active KST period, since expired campaigns are intentionally hidden. Actual local public desktop/mobile captures show distinct tag families, dark period ribbons, no overflow or runtime errors. Evidence: `output/dark-mode-palette/v2-local-*.png`, `tmp/dark-audit/v2-ribbons-tests`, `tmp/dark-audit/reviewer/v2-final`. Migration 0122 applied before loader release, retaining all 43 original color rows.

V2 production: desktop/mobile captures confirm active dark theme, v2 color fills, dark period ribbons, no horizontal overflow or runtime errors. Anonymous public production rendering checked; authenticated visits use guarded synthetic local fixtures. Evidence gallery: `output/dark-mode-v2/index.html`; production captures: `output/dark-mode-palette/v2-production-*.png` and `tmp/dark-audit/v2-production-check.json`.

Plan: shared deterministic palette derivation; additive generated database columns (original colors untouched); explicit public/studio color DTO mapping; one rendering path across viewer/studio/preview/mobile; dark loading/chart/ambient/popularity states; production-build captures and interaction checks, unit/data-parity/type/lint/build validation.

This instruction supersedes the previous audit's decision to preserve light tag fills in dark mode. Light mode, tag hue meanings, KST, permissions, and public/private boundaries remain unchanged. Palette fields are public visual metadata, not operational data. Apply additive schema before selecting its columns; no source-color backfill or deletion. Store generated values for both base palettes and custom tag colors; child tags inherit the parent. Existing fixtures can derive the same values when generated fields are absent.

Implementation:

- Shared OKLCH dark fill/border/text/accent palette. Cards and text chips use muted fills and warm light ink; legend dots, mobile bars and charts use restrained brighter accents. Color picker shows both themes. Source colors and light borders remain unchanged.
- `0121` generated columns applied before the new loaders: 21 palettes + 22 tags retain identical original-field hashes; 27 non-null palettes stored. Insert/update/NULL behavior checked with a transaction-local temporary table. No real schedule fixtures or production tag edits.
- Insights shimmer, plot bars, current-month progress and semantic increase/decrease colors; ordinary mobile subtitles and heart ink.
- Ambient entry/exit/settings, date/year picker, navigation/map and range controls use the dark surfaces. Original ambient art stays intact.
- Popularity keeps existing thresholds and meanings, adds static 1–4 segment marks, inset rim and controlled glow. Layout does not gain a row; reduced-motion retains the marks.
- Deployed-data follow-up: untagged cards, support/period ribbons, mobile inline VOD/period links and heart outlines also use dark materials. Dedicated synthetic link fixture and regression capture added after checking actual PC/mobile schedules.

Verification:

- SQL/TS exact palette parity for 1,240 source colors. 216-color grid confirms text contrast >6:1, hue family and bounded dark fill lightness/chroma. Stale/corrupt metadata and explicit public visual DTO tests.
- Unit suite: 953/955 passed. The same two pre-existing `ambient-codex` shallow species/wave failures remain; no dark-color test failed.
- Typecheck, lint and isolated production build passed. Final build excludes another task's uncommitted legend alignment edits.
- Production-build visual/interaction suite: 17/17 passed, then dedicated links test and light-color/geometry regression passed after the deployed-data follow-up (18 distinct checks); 125 final captures and 40 baseline captures. Covers desktop/mobile, actual theme persistence, original light colors and geometry, public/viewer preview/studio, detail/editor/pickers/search/replay/records/settings, drawing tools, art, loading and ambient controls. Developer 8 tabs + owner 5 tabs also captured with synthetic server-action responses; current KST-month progress tested. All external media/writes intercepted.
- Live local public API: HTTP 200, 21 palettes, 22 tags, 27 explicit dark palettes; forbidden private-field scan clean. This is not a new RLS audit or authenticated production owner test.
- Harness remains blocked by pre-existing duplicate G-18 in AGENTS.md.
- Independent reviewer found and verified scope for generated palette/public boundary; final findings (broadcast-day selector, light borders, readonly chip ink) were corrected.

Evidence: `output/dark-mode-palette/index.html` and `tmp/dark-audit/*palette*` (local artifacts, not committed). [ADR-0026](../agent/decisions/ADR-0026-automatic-dark-tag-palette.md) records schema, boundary, supersession and rollback.

Release: `a2a72f02` pushed to main; Vercel success at 2026-09-19 04:30 KST. Production API HTTP 200 returned 27 dark palettes; forbidden-field scan clean. Deployed-data follow-up `e64d023b` pushed and Vercel success at 04:36 KST. Actual final desktop/mobile screenshots: dark theme, no overflow or browser errors; mobile VOD background rgb(41,54,80), heart ink rgb(213,201,194). Follow-up also passed typecheck/lint/build. Production screenshots are `output/dark-mode-palette/production-desktop.png` and `production-mobile.png`.
