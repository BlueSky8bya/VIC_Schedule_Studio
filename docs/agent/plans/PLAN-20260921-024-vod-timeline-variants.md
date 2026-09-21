# Multiple fan timelines

Authorized 2026-09-21: preserve independent fan timelines, join same-author reply continuations, select a representative automatically, allow viewer selection and owner/developer moderation.

## Implementation

1. Verify SOOP reply response; preserve root/reply provenance without storing raw viewer IDs or unrelated comments. Group only within a root thread and same author; retain other contributors separately.
2. Add private candidate/moderation storage and atomic projection RPCs. Public `vod_timeline` remains the representative/search source, with explicitly sanitized visible alternatives. Manual representative/visibility decisions survive source resync. No change to calendar/KST attribution, authentication/unlock or role authority.
3. Share `VodChapters` selector across viewer/preview. Add studio management via existing serialized keepalive write dispatcher; owner/developer only, preview read-only.
4. Test parsing, replies, ranking, source deletion/errors, override persistence, RLS/public boundary and studio permissions. Run typecheck/lint/tests/build and production-build fixture interactions; independent review before completing.

## Rollout

Subsequent owner instruction authorized migration and push/deployment. Additive0124 applied successfully2026-09-21 before the new reader/collector. Privacy0125 also applied; combined deployment evidence is in [privacy audit](../verification/PRIVACY-20260921.md). Retain candidate data on rollback. Existing representatives remain readable until complete resync.

## Status

Implementation and local verification complete. Production migration applied; authorized deployment in progress with privacy fixes.

SOOP reply contract verified against an actual four-reply thread: `/comment/<root>/reply` returns the complete `data` array (per_page ignored), with `c_comment_no`, `p_comment_no`, author ID and text. Collector uses four workers and rejects incomplete parent/reply snapshots. Same-author IDs remain transient; reply-only candidate keys are hashed per root to preserve settings after deletion of the first reply.

Local Postgres/WASM migration regression passes: migration applied twice, existing 0071 schema and 0076 representative index trigger, manual pin/hide persistence across edits/deletion/return, stale snapshot rejection, public-only RLS, private candidate/choice denial and service-only mutation grants. This verifies an isolated database, not production Supabase sessions.

Production-build fixture interactions pass at 1440px and 390px: alternate selection, chapter seek, hidden candidate omission from public UI, management write payload and no horizontal overflow. Light/dark screenshots reviewed in `.scratch-pw/timelines-{width}.png` / `timelines-dark-{width}.png`. Writes were intercepted; local analytics guards remained enabled.

Independent reviewer identified and rechecked duration-zero queue starvation, serial reply latency and unstable first-reply keys; fixes and regressions added. Numeric-string reply IDs are also preserved.

Final checks: typecheck and full lint pass; production build passes. Unit suite: 989 pass, 2 existing `ambient-codex` shallow-biome failures. New feature, route/cache, parser and collector regressions all pass. Harness retains the pre-existing duplicate `G-18` rule-ID failure. `git diff --check` passes. No actual login/session RLS claim is made from fixtures; isolated Postgres role tests are scoped above.

Limits: heuristic classification can require manual correction; a source snapshot exceeding the bounded fetch timeout preserves prior content for retry. External cron invocation timing is not guaranteed. Existing replay-chat collection defects remain outside this fan-comment implementation.
