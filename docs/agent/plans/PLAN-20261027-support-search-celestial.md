# Support readability, returned search sources and ecology retirement

Owner2026-10-27 adopted `calendar-support:validate-preview-url-before-opening` and directly requested the changes below. Standing adoption-to-release authority applies. No new idea discovery is claimed by this implementation task.

## Current contract

- Related-link preview uses the existing pure `validateSupportUrl` server validation function: nonempty valid HTTPS only. Invalid values display one short status in the existing preview space, no clickable href; optional empty values remain allowed. Server validation/serialized saves/permissions remain unchanged.
- Support/period ribbon labels share13px × calendar zoom × complete text-size setting, without the former1.15 cap. The existing22px × zoom height and shared lane offsets remain; label line-height1.1 fits the configured12–20px calendar range. Both viewer and studio use one shared rule. Today/selection ring8 remains visible around the rest of the cell; ribbon9/head10 take priority where labels cross. This supersedes the older ring-above-ribbon clause in UI-32. Studio entry uses backwards fill so completed per-cell transforms do not retain stacking contexts that hide spanning labels under the next day; the stagger itself remains.
- Returned results offer All, Schedule, VOD, Chat, Timeline. Wire DTO kinds remain event/vod/chapter: chapter with existing `matchedOn=chat` is Chat, other chapters are Timeline. Filtering/counts happen before grouping; an unmatched parent VOD is context, not an extra hit. No new query, chat collection or identity joins. Existing page-scoped search memory, reset, keyboard and selection rules remain. Old unified chapter action remains readable as retired history.
- Ecology species/plant generation catalogue and table/wave/phase UI are retired. Only the original9 sky/celestial slot records stay active, with identical metadata. The unused autumn ArtSet no longer requests retired scenery assets. Current meadow backdrop/garden, sky/constellations/weather, companion food/toy/memory collections and local records remain.
- Original art-src/public assets, frozen requests, historical source/QA/failure evidence stay intact. `world/codex.ts` is a zero-entry compatibility marker for historical source paths, not a live catalogue. New ecology generation fails closed. Existing receipt/path-based restoration and protected-file/rollback checks remain distinct from new generation; no migration or asset deletion runs on user material.

## Latest discovery decision

The owner rejected `studio-timelines:lookup-by-canonical-vod-url` and `studio-timelines:visibility-control-current-choice` because the fan timeline administration is rarely needed. Exclude that administration area from future idea discovery. This does not exclude viewer-facing replay/timeline or the explicitly requested search filters, and does not prevent handling a real reported defect. Preserve original proposal reports and decision provenance in primary state.

## Verification and evidence

Durable run: `C:/Users/im917/.codex/vic-pipeline/runs/20261027-support-search-celestial`.
Required gates: type/lint/relevant unit/build, guarded viewer/studio/preview actual font-setting interactions and topmost today-crossing labels, normal/reduced entry, valid/invalid preview, all four search sources/counts/reopen, sky-only board/copy/detail rejection and current meadow/sky settled render with opaque multicolor pixels and distinct day/night frames, non-author role/boundary/UX/QA review, exact commit/CI/provider/public fullSHA.

Historical ecology-only tests are replaced by explicit retirement/sky invariants. Generic geometry, provenance, path protection, immutable request, rollback and recovery tests remain, using current sky fixtures. Preserve all original failed reports instead of relabeling them. Fixture results do not establish real login/DB/RLS/physical-device/OS clipboard/full200/normal36 or living AI observation. Current controller/primary state hold actual progress and release status.
