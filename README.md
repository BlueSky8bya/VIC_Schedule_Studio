# VIC Schedule Studio

VIC Schedule Studio is a streamer-first schedule studio built for Victory.

It provides a public monthly calendar for viewers, an owner-only editing studio for the streamer, a passcode-protected private layer for trusted managers/workers, support campaign highlighting, customizable broadcast tags, sticker decoration, and poster-style image export.

The product is designed around one core rule:

> Public viewers must only receive public schedule data. Embargo, work, and owner-private information must never be included in public responses.

## Current Routes

- `/`: Google-auth gate, then server-side role routing (viewer → public poster, owner/staff → studio)
- `/studio`: owner-first studio with month navigation and date-based event editing
- `/studio/decorate/[year]/[month]`: sticker/text decoration + poster capture
- `/studio/tags`, `/studio/trusted-members`, `/studio/private-layer`: owner settings
- `/api/public/[slug]/events`: public schedule DTO (private fields excluded)

## Deployment

See [docs/deployment.md](docs/deployment.md) for the full production runbook
(Vercel + Supabase, owner handoff to Victory, OAuth/redirect setup, read-heavy caching).

## Current MVP Surface

- Real monthly calendar navigation by year/month.
- Google login appears first when opening the app.
- Authenticated Google email controls role routing.
- Owner-only studio interactions for adding, editing, and deleting local schedule items.
- Private-layer preview with owner/manager/worker roles.
- Broadcast tag palette with maximum two representative colors per date.
- Support campaign card and date highlighting.
- Public DTO leakage tests.

Persistence is still partly local sample data. Supabase Auth, trusted member lookup, RLS-backed writes, passcode hashing, and storage-backed sticker uploads are the next implementation phase.

## Authentication Model

The app resolves the current role on the server.

1. No Supabase session means the user sees the Google login gate.
2. Supabase sessions are trusted for elevated roles only when they come from Google OAuth.
3. Google email matching `OWNER_EMAIL` means `owner`.
4. Google email listed in active `trusted_members` means `manager` or `worker`.
5. Any other authenticated Google email is treated as `viewer`.

Only `owner` can write. `manager` and `worker` are read-only and can only see private-layer data after a valid unlock session.

In local development, set `OWNER_EMAIL` to your Google account. Before handoff, replace it with Victory's Google account email. If Supabase environment variables are empty, Google login is disabled.

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
