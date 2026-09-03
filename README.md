# VIC Schedule Studio

VIC Schedule Studio is a streamer-first schedule studio built for Victory.

It provides a public monthly calendar for viewers, an owner-only editing studio for the streamer, a passcode-gated teaser (최초공개) reveal, support (업 도움) highlighting, customizable broadcast tags, viewer hearts with interest tiers, an OBS broadcast preview (`/onair`) and a broadcast drawing board. (Sticker decoration, PNG export and the worker role were retired on 2026-08-27 — ADR-0014/0015.)

The product is designed around one core rule:

> Public viewers must only receive public schedule data. Embargo, work, and owner-private information must never be included in public responses.

## Current Routes

- `/`: public poster (anonymous allowed); logged-in owner/developer get a studio link
- `/onair`: anonymous broadcast preview (avatar scene fixed) for OBS
- `/studio`: owner-first studio with month navigation and date-based event editing
- `/studio/tags`: owner settings (tags). (`/studio/trusted-members` was retired 2026-09-04, ADR-0018.)
- `/api/public/[slug]/events`: public schedule DTO (private fields excluded)

## Deployment

See [docs/deployment.md](docs/deployment.md) for the full production runbook
(Vercel + Supabase, owner handoff to Victory, OAuth/redirect setup, read-heavy caching).

## Current MVP Surface

- Real monthly calendar navigation by year/month.
- Google login appears first when opening the app.
- Authenticated Google email controls role routing.
- Owner-only studio interactions for adding, editing, and deleting local schedule items.
- Developer role preview (owner/viewer screens, client-only).
- Broadcast tag palette with maximum two representative colors per date.
- Support campaign card and date highlighting.
- Public DTO leakage tests.

Persistence is Supabase (Postgres + RLS); sample data is only used by the visual fixtures.

## Authentication Model

The app resolves the current role on the server.

1. No Supabase session means the user sees the Google login gate.
2. Supabase sessions are trusted for elevated roles only when they come from Google OAuth.
3. A Google email listed in `OWNER_EMAIL` means `owner`. `OWNER_EMAIL` is a comma-separated list, so one streamer can use multiple Google accounts as the same owner.
4. Any other authenticated Google email is treated as `viewer`. (The manager / trusted-member role was retired 2026-09-04, ADR-0018.)

Only `owner` (and the developer maintainer) can write schedules. Roles are developer / owner / viewer.

In local development, set `OWNER_EMAIL` to your Google account. Before handoff, replace it with Victory's Google account email (or several, comma-separated, if the streamer uses more than one account). When more than one is listed, the first is the primary owner (`calendars.owner_id`) and the rest are synced into `calendar_co_owners` by `db/seeds/0013_sync_co_owners.sql`. If Supabase environment variables are empty, Google login is disabled.

## Getting Started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill Supabase values before wiring real auth/data.

## Useful Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run test:visual
```
