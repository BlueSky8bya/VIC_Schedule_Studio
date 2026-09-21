# Open verification and operations checks

Updated: 2026-09-21

This file keeps unresolved evidence gaps out of startup history. A prior PASS applies to its tested revision and scope only. Recheck before closing; do not infer current production state from old notes.

## PRIVACY-20260921 — historical exposure and provider/retention follow-up

Current findings, applied0124/0125, anon live probes and scoped SQL tests are recorded in
[privacy audit](PRIVACY-20260921.md). Current code containment does not erase publicly accessible
Git history or stop already-open old realtime clients. Those, restricted retention backups/deletion,
visit-session TTL, genuine-login/provider security and developer-tool major upgrades remain open.
No production cleanup, key rotation or history rewrite has been performed.

## VERIFY-PUBLIC-002-003 — reconcile historical issue labels

- ISSUE-002 originally reported no mobile “이 달 기록” entry. Later history says the entry was restored. Confirm current viewer mobile/landscape entry, keyboard/touch operation and modal exit in a fixture and, where available, deployed viewer.
- ISSUE-003 originally reported unredacted teaser titles in studio viewer preview. Later P0-SEC-2 history says preview uses refreshed server public snapshots. Confirm current `preview-actions.ts` and preview consumers, explicit DTO construction, no private title in DOM/RSC before reveal, and failure behavior.
- These are conflicting historical records, not newly confirmed production defects. Close with current code/test evidence; preserve findings in the relevant security/QA record.

## VERIFY-REAL-SESSION — coverage boundary

Available layers: `tests/visual/studio-editor.spec.ts` uses fixtures and intercepts write commands; `test:integration` exercises actual DB actions with a fixed owner actor/service-role. Neither proves real-login RLS behavior.
Keep genuine-login refresh/unlock/revocation, two-device session independence, rate limits, real pen input and screen-reader/device checks separate when affected. Do not add a production authentication bypass to make a test pass.
Use existing [broadcast tools checklist](../../ux/broadcast-tools-qa-checklist.md) and [visit insights checklist](../../insights/visit-insights-qa-checklist.md) only for their relevant unverified items.

## OPS-ANALYTICS-CLEANUP — no deletion authorized by this record

The 2026-09-04 history identified local/automated traffic in production analytics and described prepared backup/SQL under `.scratch-pw/`. It explicitly said cleanup had not run before owner approval.
Before a cleanup: inspect current source data, confirm the exclusion predicate, create/verify a recoverable backup, identify user authorization and preview exactly what would be deleted. Old file paths and row counts are not current evidence.
New analytics paths must use `lib/analytics/guard.ts`; UI checks should use route stubs. Actual DB integration tests use past months, the established test marker, cleanup and zero-residue verification.

## VOD-SYNC-20260918 — late fan timeline and missing replay chat

Initial read-only production/source investigation on 2026-09-21. Fan timeline correction implemented locally afterward at the owner's request; production data and deployment unchanged.

- Target: 2026-09-18 part 2, SOOP title `207499291`. SOOP comment `121882539`, dated 2026-09-20 21:37:10 KST, parses into 66 entries with the existing parser. Production public timeline API still returns empty entries. DB timeline last checked 2026-09-20 00:14:18 KST, before the comment appeared.
- Calm sync rotates 8 oldest-checked VODs per eligible run, across up to 500 archive candidates; the observed timeline table has 398 rows. It does not prioritize recently posted VODs once first checked. Both callers suppress this pipeline while live, and the 30-minute throttle is a minimum interval, not an execution guarantee. Recent GitHub backup poll runs are hours apart. At inspection, this target was 102nd in timeline last-check order (not a guaranteed ETA).
- Replay chat row is `complete=true, chunks=0, messages=0`, last updated 2026-09-19 02:04:56 KST. Current SOOP view API returns four files: file orders 2/3/4/5. First file (32 seconds) chat at `startTime=0` returns 404; the other three return 200 with 19/40/11 messages in their first chunks. No raw chat or viewer identifiers were retained.
- `vod-chat.ts` stops at the first failed chunk and marks zero-progress attempts complete (`giveUp`); `pickChatSyncTargets` then excludes them permanently. Empty/error view responses also become complete. The current observed 404 reproduces a path to the persisted zero-message result; historical request logs were not available to prove the original response.
- This is unofficial SOOP **VOD chat replay** analysis, separate from fan comment timeline parsing; it is not direct live-chat ingestion.
- Local fan timeline correction: separate 10-minute timeline throttle from archive refresh; run during live broadcasts through both existing callers; alternate oldest-checked archive and recent (14-day) candidates, with no catalogue age/500-row cutoff. Read every comment page within an 8-second per-VOD timeout; incomplete/error responses preserve content and advance only the attempted VOD's timestamp so unavailable videos cannot block rotation. A 20-second loop budget bounds comment work. Timeline and archive/chat tasks run concurrently within the existing 60-second function, rather than adding their durations.
- Regression evidence: 38 focused tests pass, including initial empty result → later fan post → later edit, third-page timeline, 501st archive row, failure preservation, slow archive/recent fairness, and both live callers. Typecheck, full lint and production build pass. Full unit run before the last three added regression cases: 965 pass, 2 existing `ambient-codex` shallow-species failures. Independent review's fairness/runtime findings resolved and re-reviewed; no remaining blocking finding. Harness still fails on pre-existing duplicate `G-18` in root AGENTS.md.
- Remaining: deploy/observe the fan timeline correction, including target `207499291`. Invocation timing still depends on the external cron/viewer traffic; 10 minutes is a throttle, not a maximum visibility delay. The timestamp throttle is not a distributed lease. Chat file failure/retry and recovery are separate outstanding work; `vod-chat.ts` is unchanged. No backfill, commit or deployment performed.
- Follow-up local implementation: [multiple fan timelines](../plans/PLAN-20260921-024-vod-timeline-variants.md), [ADR-0027](../decisions/ADR-0027-fan-timeline-variants.md). Same-author replies, alternative selector and persistent studio moderation implemented; migration 0124 prepared and verified in isolated Postgres, not applied to production. Shared ingest/moderation now use a per-VOD advisory lock and reject older completed snapshots; the polling throttle itself remains non-exclusive.

## Deferred product choices

No current request to implement attendance, VOD full-text search, special-day ambient content, or replace the remaining poster themes. Existing plans are research/backlog only.
Historical “apply migration 0051” instructions do not establish a pending migration. Check actual migration history and authorization before any schema operation.
