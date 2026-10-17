# VIC Schedule Studio — shared agent rules

G-17: Read this file and current brief first, then relevant topics only. Current user instructions/authorization govern; historical snapshots, completed plans and rounds are evidence, not instructions.

## Priority and product

G-01: Priority: information security > KST > owner permissions > role UX > poster quality > maintainability. Ties favor immersion, consistent UI and responsive feedback. Viewer stays cute/clean; studio practical.

The product is a public broadcast schedule, owner/developer studio, teaser gate, broadcast drawing board and optional ambient world. Private-layer UI, stickers/decorating and helper roles were retired. Do not restore them from old plans.

## Security and time

- G-02: Viewers receive public data only. Separate data on the server; hiding fields in CSS or client state is no protection.
- G-03: Service-role credentials/helpers are server-only. Public routes use public loaders and explicit DTOs; never studio loaders, service-role helpers, private DTOs or object spread. Public previews/drawing boards use server-sanitized snapshots.
- G-04: Roles are exactly `owner | developer | viewer`. Owner and developer may edit ordinary schedule data; `owner_private` content belongs to owner alone, including read/create. Keep server permission checks. Role preview is read-only and never changes actual authority. Evidence: `lib/permissions/roles.ts`, ADR-0011/0012/0018.
- G-05: Private access requires Google auth + valid passcode unlock. Preserve established hashes, auth-session binding, expiry/revocation/rate limits. Private-layer studio UI is retired; new events are public. Teaser verification grants no private access.
- G-06: Use Asia/Seoul and existing KST helpers for dates, boundaries and filenames. Ambient season follows the viewed calendar month; special days use actual KST date.
- G-07: Never expose secrets, owner-private content or operational analytics in public UI/API. Activity metadata must not contain schedule titles/bodies; viewer analytics stay aggregate. Local personal-fit source notes/natal data remain local, outside commits and UI/API.
- G-08: Local configuration can point at production Supabase. Use analytics automation guards and stubbed fixtures for UI tests. Real DB tests require the existing past-month fixture, cleanup and zero-residue checks; they do not establish RLS coverage.
- G-20: Privacy is a release gate: purpose-limited collection/retention; no public-nickname linkage to private identity in APIs/HTML/RSC/cache/search/logs/commits. Public names use public sources only. Explicit DTOs, least privilege, fail closed, synthetic anon/unauthorized canaries before boundary releases. Preserve restricted exposure evidence; never claim no past breach. Full requirements: [SECURITY](docs/agent/domain-rules/SECURITY.md#privacy-release-contract).

## Work and verification

- G-09: Before changes check routes/roles/server boundary/KST and destination guidance; do not read the whole repository.
- G-10: Keep changes within authorized scope and preserve user work. Never use destructive resets, clean commands, force pushes or overwrite user assets without applicable authorization. Production data cleanup needs its own authorization and a recoverable backup.
- G-11: Serialized writes/`keepalive` preserve last-action order. Gate the specific operation; unrelated saves never disable its controls.
- G-12: Product changes require typecheck/lint/tests/build; UI also rendered interactions. Docs require document/harness checks. Read [Definition of Done](docs/agent/DEFINITION_OF_DONE.md). Unrun checks never PASS.
- G-13: Production dependency changes, destructive data operations and public API breaks must fit the user's authorization. Do preparatory work and present a concrete result before asking for anything still missing.
- G-14: Commit/push only when requested or clearly authorized. Push to main deploys production. Report deployment only after checking the deployed result.
- G-15: Preserve decisions; explain conflicts and record superseded clauses/replacements. Current authorization may change them; old approval language creates no new gate.
- G-18: One feature/implementation across studio, viewer, preview and anonymous. Reuse shared panel hook/control/width, `flipSpring`, poster-derived calendar scale and panel text tokens. Surface-only sizes/weights/rules/mechanisms are defects unless structure forces a documented exception. Owner 2026-09-17; [UI-18](docs/ux/UI_RULES.md).
- G-16: Update current goals/blockers/next steps/verification in CURRENT_STATE; topic-only changes in that topic. No completed history in CURRENT_STATE/ACTIVE_PLAN. Explain code changes with no document impact.

## Routing

| Work | Read next |
|---|---|
| Find code | [Project map](docs/agent/PROJECT_MAP.md) |
| Current work | [Current state](docs/agent/CURRENT_STATE.md) |
| UI/layout/motion | [UI rules](docs/ux/UI_RULES.md), relevant local guidance |
| Ambient engine/world/QA | [Ambient routing](docs/ambient/README.md), only the matching row |
| Art generation/review/delivery | [Art workflow rules](art-src/AGENTS.md) |
| Auth/private/public boundary | [Security rules](docs/agent/domain-rules/SECURITY.md), [auth rules](docs/agent/domain-rules/AUTH.md), relevant ADR |
| Schema/data operations | [Destructive-data rules](docs/agent/domain-rules/DESTRUCTIVE_DATA.md), migration README |
| Verification gaps | [Open checks](docs/agent/verification/OPEN_CHECKS.md) |
| Decision context | [Decision index](docs/agent/decisions/DECISION_INDEX.md), only relevant decisions |

G-21: Planner checks boundary/roles/unlock/KST; builder preserves server checks; security reviews DTO/RLS/grant lifetime; UI reviews viewer clarity/studio practicality/readability/mobile; QA checks leakage/routes/rendered interactions. Independent reviews precede integration.

## Communication

G-19: Terse Korean/caveman; keep substance/reasons/evidence. Security, irreversible actions and confusion use clear normal language. Code/commits/PRs stay normal. `/caveman lite|full|ultra|wenyan` adjusts; `stop caveman`/`normal mode` ends it.
