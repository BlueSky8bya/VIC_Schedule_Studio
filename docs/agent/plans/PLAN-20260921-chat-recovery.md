# Automatic VOD chat analysis recovery

Authorized: viewer reaction density must populate automatically regardless of when fan timelines arrive.

Confirmed production cause: VOD207499291 has a missing 32-second first chat file (404), while subsequent files return valid chat XML. Legacy collector saved chunks=0, messages=0, complete=true and permanently excluded it.

Second confirmed cause: the upstream endpoint returns a 300-second window, while the old collector stepped 600 seconds and skipped alternating portions. New jobs reprocess legacy archives with 300-second windows. Due continuations/context edits and untouched archives are interleaved to prevent backlog starvation. Successfully complete sources are rechecked daily for the recent14KST days, monthly for older dates; gaps back off up to24h; timeline changes invalidate immediately.

Plan: add service-only resumable analysis jobs with atomic versioned checkpoint/publication; skip missing chunks without blocking later files, retry gaps with backoff, revisit old/incorrectly completed VODs without age/pagination cutoffs. Preserve file offsets, bound execution time, derive only aggregates, and invalidate analysis when fan context changes. Existing public profile stays ratio-only. Poll the profile while a replay is open so late results appear without reopening.

Apply additive schema before code; no historical deletion. Normal derived aggregate replacement happens transactionally only after a complete pass over the source plan. Keep the previously published profile while a new pass is incomplete. Rollback: disable the new collector; retain restrictive grants and existing profiles, never restore false-complete logic.

Validation: collector retry/resume/idempotence/deadline tests, isolated SQL transaction/permission canaries, public-profile refresh/render tests, typecheck/lint/build, independent review, target repair and deployed public profile verification.

Status: implementation and local verification complete. Migration0126 applied successfully with verified TLS. Deploy code before repairing the target, so retired collectors cannot overwrite new checkpoints.

Validation: 40 focused unit tests passed; isolated PGlite migration/idempotence/CAS/rollback/late-context race/fairness/role tests passed; typecheck, lint and production build passed. Four production-build Playwright tests passed (1440/390px, late profile without fan timeline or reopening, timeline selection/management). Waveform captures inspected. Independent reviewer found no remaining blockers after fixes. Live anonymous job-table, queue and checkpoint requests all denied (42501). Harness still fails only the pre-existing AGENTS/CURRENT_STATE size budgets.

Limits: unavailable upstream portions cannot be reconstructed; publish valid portions and retry gaps up to daily. Speaker density at chunk/file boundaries uses summed anonymous counts rather than retained identities. Scheduler timing depends on GitHub Actions; no instant-update guarantee. Existing published profiles stay in place until the new pass traverses the entire source plan. Production target repair and release checks follow deployment.
