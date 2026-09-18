# Dark palette follow-up — 2026-09-19

Status: implemented; final release verification and push in progress. Owner requested dark-specific tag colors (automatically saved for future colors), stronger popularity highlighting, and fixes for trend/loading/showcase controls, plus coherent nearby dark UI improvements.

Plan: shared deterministic palette derivation; additive generated database columns (original colors untouched); explicit public/studio color DTO mapping; one rendering path across viewer/studio/preview/mobile; dark loading/chart/ambient/popularity states; production-build captures and interaction checks, unit/data-parity/type/lint/build validation.

This instruction supersedes the previous audit's decision to preserve light tag fills in dark mode. Light mode, tag hue meanings, KST, permissions, and public/private boundaries remain unchanged. Palette fields are public visual metadata, not operational data. Apply additive schema before selecting its columns; no source-color backfill or deletion. Store generated values for both base palettes and custom tag colors; child tags inherit the parent. Existing fixtures can derive the same values when generated fields are absent.

Implementation:

- Shared OKLCH dark fill/border/text/accent palette. Cards and text chips use muted fills and warm light ink; legend dots, mobile bars and charts use restrained brighter accents. Color picker shows both themes. Source colors and light borders remain unchanged.
- `0121` generated columns applied before the new loaders: 21 palettes + 22 tags retain identical original-field hashes; 27 non-null palettes stored. Insert/update/NULL behavior checked with a transaction-local temporary table. No real schedule fixtures or production tag edits.
- Insights shimmer, plot bars, current-month progress and semantic increase/decrease colors; ordinary mobile subtitles and heart ink.
- Ambient entry/exit/settings, date/year picker, navigation/map and range controls use the dark surfaces. Original ambient art stays intact.
- Popularity keeps existing thresholds and meanings, adds static 1–4 segment marks, inset rim and controlled glow. Layout does not gain a row; reduced-motion retains the marks.

Verification:

- SQL/TS exact palette parity for 1,240 source colors. 216-color grid confirms text contrast >6:1, hue family and bounded dark fill lightness/chroma. Stale/corrupt metadata and explicit public visual DTO tests.
- Unit suite: 953/955 passed. The same two pre-existing `ambient-codex` shallow species/wave failures remain; no dark-color test failed.
- Typecheck, lint and isolated production build passed. Final build excludes another task's uncommitted legend alignment edits.
- Production-build visual/interaction suite: 17/17 passed; 123 final captures and 40 baseline captures. Covers desktop/mobile, actual theme persistence, original light colors and geometry, public/viewer preview/studio, detail/editor/pickers/search/replay/records/settings, drawing tools, art, loading and ambient controls. Developer 8 tabs + owner 5 tabs also captured with synthetic server-action responses; current KST-month progress tested. All external media/writes intercepted.
- Live local public API: HTTP 200, 21 palettes, 22 tags, 27 explicit dark palettes; forbidden private-field scan clean. This is not a new RLS audit or authenticated production owner test.
- Harness remains blocked by pre-existing duplicate G-18 in AGENTS.md.
- Independent reviewer found and verified scope for generated palette/public boundary; final findings (broadcast-day selector, light borders, readonly chip ink) were corrected.

Evidence: `output/dark-mode-palette/index.html` and `tmp/dark-audit/*palette*` (local artifacts, not committed). [ADR-0026](../agent/decisions/ADR-0026-automatic-dark-tag-palette.md) records schema, boundary, supersession and rollback. Deployment result pending; prior push authorization applies.
