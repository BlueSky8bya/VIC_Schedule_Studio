# Teaser premiere — implementation and verification

Date: 2026-10-14 KST. Owner asked Codex to implement the complete feature using Claude's plan, then authorized commit/push/deployment. 0142 applied; reader/default-ON stage rollout in progress. No production schedule data rewrite or cleanup.

## Delivered behavior

- One coordinator and monotonic, no-store server clock drive cards, detail ring and viewport stage. DB release state alone authorizes content. Origin-paired DB offsets can be cached; cached timestamps are never treated as the current time.
- Chrome leaves from T−180, ambient at T−90, other schedules at T−76, central screen at T−68. Seasonal particles build, stop for the eye, then explode with one bounded flash/shock. The screen returns to its source slot via the existing FLIP spring; poster width remains 1840px. The information box's star has a departure/return bookend.
- Same-T and nearby distinct releases retain their individual release times. Desktop shows up to four screens, mobile up to two, then a list. Focused occupancy is bounded to 90 seconds with a 30-second rest. Data delay returns the calendar after five seconds; later content updates quietly.
- Changes, immediate publication and deletion use canonical public confirmations; absence from discovery is not deletion. Re-gating removes current content and starts a new observed cycle. Hidden/offline tabs stop polling; return resynchronizes without replaying a missed reveal. Large clock corrections clear live-observation eligibility.
- Reduced motion disables automatic occupancy and legacy teaser animation. Gfx tiers bound decorative particles; mobile has no ambient canvas. Escape/back/close restore inert, focus, scrolling and the ambient pause holder. Existing modals defer the stage. Audio/haptics use existing opt-in settings at confirmed publication, with no heartbeat loop.
- Viewer/anonymous/preview use the same stage and presenter. Preview rehearsal supplies synthetic state to that implementation, with no DB writes. Fixtures suppress live SOOP/hope writes. No owner/developer authority or private-unlock behavior changed.
- Owner follow-up: Settings → 움직임 → `최초공개 무대`, default **ON**. Only explicit `off` in `vic.premiereStage` disables automatic staging; normal cards/detail and DB-confirmed data continue. One shared hook/list serves studio, viewer and preview, including mobile. Same-tab events and cross-tab storage events synchronize active viewers; turning OFF restores an active stage. Reduced motion remains authoritative, and explicit rehearsal can be run manually with the preference OFF. The deployment release gate stays separate and OFF.

## Public read boundary and cost

`0142_public_teaser_state.sql` was **APPLIED 2026-10-14 KST**, before reader deployment, with verified CA/hostname TLS. Its security-invoker RPC reads the existing masked public view with a single DB `now()` and explicit JSON fields. It adds no raw event/identity SELECT grant. Public routes import only public-loader and return explicit sanitized DTOs. Missing configuration/RPC is an unsuccessful state, never a deletion.

Discovery uses one slug key; confirmations use canonical UUID keys, never caller-selected combinations. Shared CDN TTL is 15 seconds when distant and one second within five minutes/briefly after release; Data Cache refreshes at one second with process single-flight, an inner origin one-second window and a one-second negative cache. The inner guard covers background refreshes even after stale responses have returned. Cache layers can add a few seconds of confirmation latency; clients wait at most five seconds in the stage. No service-role helper, hope settlement or per-viewer write runs in public reads. Existing `0140` cron settles hopes independently.

For 1/100/1,000 foreground viewers, browser requests near T are approximately 1/100/1,000 per second for discovery; CDN/server cache should absorb repetition. The ideal warmed origin refresh is roughly one per active canonical key per second per cache region, **an estimate, not a measured bound**. Confirmations, cold starts, multiple instances and cache layers add work. Local 1/100/1,000 concurrent calls coalesce to one mock origin request in one process; this does not prove deployment fanout or nano capacity. There is no Redis/KV, registry or Realtime subscription.

No new viewer identifiers/history are stored. Public snapshots contain public schedule metadata only; client observation sets last for the component lifetime. Provider cache/log retention has not been audited. Already delivered public content cannot be fully recalled after re-gating.

## Local checks

| Check | Result / scope |
|---|---|
| Targeted units, clock/loader/routes/reconciliation/curve/DTO/harness | PASS, latest reruns 96 feature + 43 memory/rule tests, both exit 0 |
| ESLint | PASS, `npm run lint`, exit 0 |
| Production build and rendered checks | PASS, release run 40 tests / 3.1 minutes / exit 0, including 21 premiere/settings/flash-budget and 19 legacy ring/reveal cases; production build completed as the fixture server prerequisite |
| TypeScript | PASS, final `npm run typecheck`, exit 0; production build also checked types |
| Entire unit suite (earlier implementation run) | 1,081 tests: 1,073 passed, eight unrelated failures; see below |
| Document/harness validation | Targeted memory/rule tests PASS (included above); `harness:verify` FAIL, exit 1, existing RULE_MIGRATION active-ID hash and inventory mismatches; `git diff --check` PASS |

All browser cases use synthetic June 2026 fixture state; no schedules inserted in any real calendar. Final desktop eye/released and mobile four-item-list captures were visually reviewed after entry settled (`test-results/premiere-review/`); no page errors, zero mobile canvases and no horizontal overflow. UTF-8/local-link checks passed for the three new topic documents (six local links). Headless Chromium checks do not prove real-device frame rate, genuine-login RLS or composite flash safety.

Personal preference follow-up also passed: initial ON, OFF persisted across reload, basic publication with staging OFF, turning ON for the next screen, mobile/preview switch, cross-tab OFF cleanup and explicit rehearsal with the automatic preference OFF. Desktop/mobile settings captures were reviewed (`test-results/premiere-settings/`); both initially checked, no page errors or horizontal overflow. No product test DB writes were introduced.

Existing whole-suite failures, outside changed files: `ambient-codex` two missing shallow-art expectations; `centering-vs-animation` one existing month-jump animation; `public-cache-revalidate` one existing birthday-preview invalidation; `scroll-position-wiring` one existing source expectation; `timeline-route` one existing cache expectation; `vod-chat-recovery` two existing retry-interval expectations. These were not repaired or marked PASS. Original whole-suite totals precede the five added route tests.

## Reproduce without touching the DB

Use the production fixture server (`VISUAL_TEST_FIXTURE=1`, production build + `next start`). Normal deployments leave that flag unset; fixture pages/APIs then return 404.

- `/visual-fixture/poster?premiere=45&count=2&gap=3` — shared screen and separate releases.
- `?premiere=8&scenario=postpone|immediate|delete|remove-after|delay|regate` — choose one scenario; `?premiere=160&scenario=advance` moves a distant reservation earlier.
- `?rehearsal=1` — preview rehearsal button; close and restart without DB writes.
- `npx playwright test --config=playwright.visual.config.ts tests/visual/teaser-premiere.spec.ts tests/visual/teaser-reveal.spec.ts tests/visual/teaser-hype.spec.ts tests/visual/teaser-hype-craft.spec.ts --reporter=line` builds and starts its own production fixture.

## Deployment order and remaining release evidence

The owner requested commit/push/deployment after the default-ON personal setting. 0142 applied successfully before reader deployment. Anon and unprivileged authenticated roles passed hidden title/body/time, released content, owner-private/draft/deleted exclusion and invalid-calendar checks inside an uncommitted transaction on the established past fixture date 2025-09-16. All five synthetic events rolled back, verified residue zero. Anonymous REST RPC returned 200 with valid masking. One origin query took 1.455ms; this is not a capacity guarantee.

An isolated production Next harness imported the actual route/loader/cache and used a synthetic HTTP DB on localhost. The initial expired-cache burst made 80 origin reads for 100 requests: Next background revalidation escaped the outer single-flight. Adding the inner origin guard fixed this; the regression is unit covered.

| Next instances | Requests | Mock origin reads | Elapsed ms |
|---|---|---|---|
| 1 | 1 | 1 | 257 |
| 1 | 100 | 1 | 340 |
| 1 | 1,000 | 2 | 1,365 |
| 2 | 1 | 1 | 202 |
| 2 | 100 | 1 | 279 |
| 2 | 1,000 | 2 | 899 |

These bursts stayed inside the per-instance/time-window refresh budget; they do not prove Vercel multi-region global collapse or the earlier normalized preview 20% target. No large request burst was sent to the real nano. Production CDN headers and the deployed client will be checked after push. Full deployed fanout, hardware devices/haptics/screen readers, full-duration occupancy and formal composite-video luminance analysis remain unverified follow-ups. Local rendered flash-frequency/cleanup tests supplement the shared 1.5-second large-effect budget, without claiming a complete accessibility audit.

This authorized rollout supersedes the initial default-OFF release clause (PLAN-027 §8). Feature and personal setting both default ON; `NEXT_PUBLIC_PREMIERE_STAGE=0` plus rebuild/redeploy stops automatic occupancy. An individual can turn OFF immediately in settings. Retain the public masked boundary, canonical confirmations, restrictive grants and RPC for the shared reader. Reverting the reader is a separate code rollback; do not drop its RPC while deployed readers need it. No real schedule rewrite/cleanup is part of this release.

Decisions: [PLAN-027](../plans/PLAN-20261014-027-teaser-premiere-final-decisions.md), [ADR-0030](../decisions/ADR-0030-teaser-premiere-state.md). Release gaps: [OPEN_CHECKS](OPEN_CHECKS.md).
