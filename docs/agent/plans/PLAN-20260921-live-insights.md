# Developer live insights restoration

Authorized: restore the live tab without public presence disclosure.

Plan: reuse existing visible visit sessions; expose only counts through a developer-authenticated, no-store endpoint. Never return identities, session keys or raw rows. Query active non-ended sessions with a 90-second heartbeat window, including across KST midnight. Poll every 15 seconds only while visible; clear stale data on failure/permission loss. Preserve existing role/device UI and label sessions rather than unique people. Hidden tabs are not collected and must not be fabricated.

Verification: authorization/DTO/failure/query-boundary tests, production fixture interaction checks at desktop/mobile, typecheck, lint, build, independent security review. No schema change or new collection.

Status: implementation complete; local verification passed. Deployment is checked after push.

Verification (2026-09-21 KST): typecheck, lint, production build and 11 focused unit tests passed.
Three production-build Playwright tests passed: anonymous route denial/no-store, count rendering,
error clearing/recovery, permission-loss clearing and polling stop, 1440/390px layout without
overflow. Light mobile and dark desktop captures inspected. Independent security reviewer found
no blockers. Harness remains blocked by pre-existing AGENTS/CURRENT_STATE size limits.

Limits: genuine developer OAuth-session production UI has not been exercised. Live figures are
active sessions (tabs may duplicate), not unique people. Eight independent count queries may
differ briefly during arrivals/exits. Existing heartbeat is 60 seconds; stale sessions expire
after 90 seconds and disappear at the next successful poll. Historical privacy/provider and
retention follow-ups remain tracked in PRIVACY-20260921. No production rows were modified by tests.
