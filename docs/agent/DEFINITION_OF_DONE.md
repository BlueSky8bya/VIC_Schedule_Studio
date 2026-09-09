# Definition of Done

Unrun checks are NOT VERIFIED. Scope results to the tested revision/environment; do not reuse historical PASS as evidence for the current change.

## Common checks by scope

- Product TypeScript/behavior changes: `npm run typecheck`, `npm run lint`, relevant `npm run test`, `npm run build`; inspect actual exit codes.
- UI/layout changes: relevant production-build fixture/Playwright checks and visual inspection; intentional baseline changes require before/after review.
- Documentation/harness changes: `npm run harness:verify` and relevant harness tests. A prose-only change does not require unrelated product build/visual runs.
- Recheck affected public/private boundary, exact role permissions, KST assumptions, nearby interactions and a reversible recovery path.
- Record failures and coverage limits rather than adding a new permission request merely because a test is unavailable.
- Before L2 (structural) or L3 (critical) implementation, record the plan in ACTIVE_PLAN. Preserve the current authorized branch and user changes; when a new implementation branch is needed, branch from main. Commit and push remain separate actions governed by the current request.

## Viewer/poster

- Server public DTO only, no private/admin/edit/unlock controls on the public capture surface.
- Verify actual web, agenda and landscape-touch topology using `lib/ui/breakpoints.ts`.
- Preserve intended current desktop geometry; narrow surfaces switch to agenda. Stickers/in-app PNG export are retired.
- Check loading/empty/error recovery, clear typography, contrast, touch targets and in-app reduced motion.
- Stub external live state if its presence changes layout; a thumbnail mask does not stabilize a disappearing card.

## Studio and writes

- Check owner/developer editing and viewer redirect. Owner-private content stays owner-only; simulated role never escalates actual permission.
- Private-layer studio UI remains retired. If a separately authorized future design restores it, retain the exact warning: `⚠ 비공개 일정 표시 중입니다. 방송 화면 공유에 주의하세요.` This conditional wording does not authorize restoration.
- Server permission checks, serialized write ordering, optimistic reconciliation and specific operation gates remain intact.
- Available browser path: fixture plus intercepted writes in `tests/visual/studio-editor.spec.ts`. Real-DB actions: `test:integration`.
- Fixture UI and fixed-actor service-role tests do not establish real-login/RLS/device coverage. Track affected gaps in [OPEN_CHECKS](verification/OPEN_CHECKS.md); do not create a production auth bypass.

## Public API / loader / private access

- Public loader imports and explicit response fields only; inspect DTO/RSC/DOM leakage and teaser fail-closed behavior.
- Public aggregates must not expose visits, dwell, raw records or private content.
- Unlock changes cover hash storage, auth-session binding, expiry, revocation and rate limits.
- Separate service-role action behavior from anon/authenticated RLS policy verification.

## Data operations

- Migration SQL is versioned/idempotent and has required grants plus a documented safe deployment order.
- Execute migrations only within user authorization; preparing/reviewing a migration is not authorization to apply it.
- Production deletion requires recoverable backup and precise selection under [DESTRUCTIVE_DATA](domain-rules/DESTRUCTIVE_DATA.md).
- DB integration fixtures use past months, the established marker, afterAll cleanup and zero-residue confirmation.
- Local/automated analytics pass through `lib/analytics/guard.ts`.

## Memory and decisions

- Change CURRENT_STATE only for changed goals, blockers, next actions or current verification. Topic-only changes update the topic record; no doc impact gets a short reason.
- Keep one status per active work item. Move completed results to the relevant dated record, not an appended startup narrative.
- Record structural/expensive decisions in ADRs; specify any replaced clause. Update routing and generated indexes as needed.
- Record migration/public-boundary changes in CHANGELOG_AGENT as well as the affected decision/topic record. A dated record does not authorize repeating its commands.
- Run harness validation after memory/routing changes. Report concrete changed files, validation and remaining evidence gaps.
