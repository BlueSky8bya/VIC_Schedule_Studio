# Adopted visibility and tab coherence — 2026-10-25

Status: Local implementation and scoped verification complete. Exact non-author review and authorized release status live in primary daily state and the local evidence below.

## Scope

- `search:submitted-query-visible-while-editing`: identify the query that produced the visible results while editing another query; keep result highlighting bound to that query. Preserve explicit Enter submission, suggestions, IME, sort and navigation restoration.
- `replay:find-within-current-timeline`: filter the already loaded public timeline by chapter/section text in the shared component. Preserve original indices/timestamps, parent sections, fold state, current playback tracking and existing ordinary/restricted jump paths. No new fetch/index/chat collection.
- Remove blank tab slots and redundant one-option tab rails left by the removed highlight view across viewer/studio/preview, with one shared layout mechanism. Preserve remaining content, role-specific panels and keyboard controls.

## Boundaries and activity

No DTO/auth/DB/KST changes, dependencies, new tracking, raw search terms in metadata, or companion behavior changes. Existing activity targets remain fixed; audit timeline and least-used views and pointer/keyboard deduplication. A local find input must not record its contents or leak keys to player shortcuts.

## Verification and release

Typecheck, lint, relevant units and harness; one guarded immutable production build per product input, scoped actual viewer/studio/preview PC/narrow interactions with videos/observations. Preserve original failures; rerun only affected cases. Check search submission/race/clear/restore, long/short/no-match timeline/fold/clear/seek and all remaining tab counts. Independent non-author boundary/UX/QA review precedes integration. Authorized Git release follows successful checks; verify deployed full SHA and public result. Real-device/login/SOOP playback and broader native/full certification stay separate.

Local adoption and evidence: `.scratch-pw/site-daily/accepted-visibility-20261025/`. Primary daily state owns exact completed keys and release status. Original discovery report remains unchanged.

## Recorded behavior and validation

Search pairs the successful response with its submitted term atomically, including old results during pending/failed requests and empty-result text. IME confirmation is consumed by composition. Timeline find is available from20 loaded entries, keeps original indices/sections and fold state, ignores playback shortcuts while typing, restores selected context and input focus on clear, and clears its transient text on variant change. Only a fixed find-entry/clear activity target is recorded; automatic focus return is excluded. Existing activity timeline and least-used cards render the same safe labels.

Remaining insight tabs share one component:3/4 fill one row and developer7 use3+4. Focus roves through one Tab stop; vertical keys follow row centers. No one-option tab rail or blank placeholder is rendered. Public records already have no tab rail; remaining summary/broadcast content stays intact.

Typecheck/lint/harness and94 relevant units pass. Final focused receipt `native/2026-10-25-1792901027227-ba5a0ae0/result.json` validates22 selected cases:16 fresh and6 same-build original PASS proofs retained through verified continuation. Viewer1440/390, studio/embedded preview, ordinary/sub/plus seek controls and owner/developer1440/390 tab interactions are rendered observations. Basic non-security3-tab coverage is server-rendered component verification, not an additional actual role/device observation. Three product-input builds were required for the IME/activity corrections; the last fixture-only retry reused the final build.

Original IME failures and wrong mobile-insights fixture-entry timeouts remain in their own reports/traces/videos. The current input matches1361 product files and31 relevant visual/helper files. No public DTO/auth/DB/KST or companion life changes; no normal36/full certification, physical device, actual studio login/RLS or live SOOP playback claim. Recovery is a scoped application revert; no data operation is required.
