# VIC Schedule Studio — shared agent rules

G-17: These rules apply to every coding agent. Read this file and the short current brief first; then read only the topic documents needed for the task. User instructions and authorization in the current session govern the work. Historical snapshots, completed plans and round reports are evidence, not current instructions.

## Priority and product

G-01: Resolve conflicts in this order: security/information boundary; KST correctness; owner-specific permissions; role-appropriate UX; poster visual quality; maintainability. When otherwise equal, prefer immersion, consistent UI and responsive feedback. Viewer mode stays cute and clean; studio stays practical.

The product is a public broadcast schedule, owner/developer studio, teaser gate, broadcast drawing board and optional ambient world. Private-layer UI, stickers/decorating and helper roles were retired. Do not restore them from old plans.

## Security and time

- G-02: Viewers receive public data only. Separate data on the server; hiding fields in CSS or client state is no protection.
- G-03: Service-role credentials/helpers stay server-only. Public routes use the public loader and explicit DTO fields. No studio loader, service-role helper, private DTO or object spread across that boundary. Public previews and drawing boards use server-sanitized snapshots.
- G-04: Roles are exactly `owner | developer | viewer`. Owner and developer may edit ordinary schedule data; `owner_private` content belongs to owner alone, including read/create. Keep server permission checks. Role preview is read-only and never changes actual authority. Evidence: `lib/permissions/roles.ts`, ADR-0011/0012/0018.
- G-05: Private access requires Google authentication and a valid passcode unlock grant. Store passcodes/tokens using the established hash model; preserve auth-session binding, expiry, revocation and rate limits. Private-layer studio UI is retired; new studio events are public. Teaser verification does not grant private access.
- G-06: Use Asia/Seoul and existing KST helpers for dates, boundaries and filenames. Ambient season follows the viewed calendar month; special days use actual KST date.
- G-07: Never expose secrets, owner-private content or operational analytics in public UI/API. Activity metadata must not contain schedule titles/bodies; viewer analytics stay aggregate. Local personal-fit source notes/natal data remain local, outside commits and UI/API.
- G-08: Local configuration can point at production Supabase. Use analytics automation guards and stubbed fixtures for UI tests. Real DB tests require the existing past-month fixture, cleanup and zero-residue checks; they do not establish RLS coverage.

## Work and verification

- G-09: Check affected routes, roles, server boundary and KST assumptions before changing behavior. Read the destination folder guidance, not the whole repository.
- G-10: Keep changes within authorized scope and preserve user work. Never use destructive resets, clean commands, force pushes or overwrite user assets without applicable authorization. Production data cleanup needs its own authorization and a recoverable backup.
- G-11: Serialized writes and `keepalive` preserve last-action ordering. Gate controls on the specific operation; unrelated background saves must not disable them.
- G-12: Typecheck, lint, tests and build apply to product changes. Use relevant rendered/interaction checks for UI changes; read [Definition of Done](docs/agent/DEFINITION_OF_DONE.md) for scope. Documentation-only work runs document/harness checks. Never call an unrun test PASS.
- G-13: Production dependency changes, destructive data operations and public API breaks must fit the user's authorization. Do preparatory work and present a concrete result before asking for anything still missing.
- G-14: Commit/push only when requested or clearly authorized. Push to main deploys production. Report deployment only after checking the deployed result.
- G-15: Preserve accepted decisions. Explain conflicts, identify any superseded clause and record replacement decisions. Current session instructions may authorize changes; old approval language is not a new approval gate.
- G-16: Update current state when goals, blockers, next actions or verification status change. Update the affected topic record when only that topic changes. Do not append completed histories to CURRENT_STATE or ACTIVE_PLAN. A code change with no document impact may say so with a reason.

## Routing

| Work | Read next |
|---|---|
| Find code | [Project map](docs/agent/PROJECT_MAP.md) |
| Current work | [Current state](docs/agent/CURRENT_STATE.md) |
| UI/layout/motion | [UI rules](docs/ux/UI_RULES.md), relevant local guidance |
| Ambient engine/world/QA | [Ambient routing](docs/ambient/README.md), only the matching row |
| Art generation/review/delivery | [Art rules](docs/ambient/ART_RULES.md) |
| Auth/private/public boundary | [Security rules](docs/agent/domain-rules/SECURITY.md), [auth rules](docs/agent/domain-rules/AUTH.md), relevant ADR |
| Schema/data operations | [Destructive-data rules](docs/agent/domain-rules/DESTRUCTIVE_DATA.md), migration README |
| Verification gaps | [Open checks](docs/agent/verification/OPEN_CHECKS.md) |
| Decision context | [Decision index](docs/agent/decisions/DECISION_INDEX.md), only relevant decisions |

G-18: Planner checks boundary, permissions, unlock and KST. Builder keeps server checks. Security reviewer checks DTO/RLS and grant lifetime. UI critic checks viewer clarity, practical studio, readability and mobile layout. QA checks public leakage, route behavior and rendered interactions. Independent reviewers report before the main agent integrates changes.

## Communication

G-19: Respond terse like smart caveman; retain technical substance. Short Korean prose/fragments are fine. Drop filler, not reasons or evidence. Use normal clear language for security warnings, irreversible actions or confusion. Code, commits and PR text stay normal. `/caveman lite|full|ultra|wenyan` adjusts style; `stop caveman` or `normal mode` ends it.
