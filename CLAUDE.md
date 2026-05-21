# VIC Schedule Studio

## Mission
Build a streamer-first scheduling web app with:
- an internal studio for owner and trusted member workflows
- a public poster for viewer-friendly monthly and weekly schedule consumption
- strict separation between public schedule data and private planning data

## Product Rules
- Timezone is always `Asia/Seoul`.
- Only `owner` can create, edit, or delete events.
- `trusted_member` can read unlocked private layers, but cannot edit.
- Anonymous `viewer` users can only read public poster data and submit proposals.
- Viewers never see private-layer controls.
- Public APIs must never include embargo, work, internal title, private notes, codenames, or editor-only fields.
- Do not hide secrets with CSS; exclude them from queries, server loaders, and DTOs.
- A/B variants are grouped scenarios; only one branch can be promoted publicly.
- Poster mode must be screenshot-safe and free of admin UI.

## Technical Defaults
- Next.js App Router
- Supabase Auth + Postgres RLS
- FullCalendar for studio workspace views
- Dedicated poster surface for public schedule rendering
- Tiptap for private notes and announcement drafts
- dnd-kit for sticker and candidate reordering
- Playwright for E2E, export rendering, and visual regression

## Architecture Rules
- Separate `events` and `event_private_meta`.
- Keep permission logic in `lib/permissions` and DB policies.
- `app/(public)` must not import private loaders.
- `app/(studio)` may access private data only through server-side checks.
- Public DTO and private DTO must be distinct types.
- Clipboard PNG is a convenience path; Playwright PNG is the canonical export path.

## Workflow
- For non-trivial work, update `docs/plans/` first.
- Use planner before broad refactors.
- After UI changes, run screenshot validation.
- After auth or data changes, review RLS and route boundaries.
- Keep commits small and reversible.

## Done
A task is done only if:
- lint, typecheck, and relevant tests pass
- public/private leakage is checked
- docs are updated
- poster/export behavior is verified if UI changed
