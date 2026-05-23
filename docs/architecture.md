# Architecture

VIC Schedule Studio is not a general calendar. It is a broadcast operations tool with two separate surfaces.

## Surfaces

| Surface | Route | Audience | Data rule |
| --- | --- | --- | --- |
| Public Poster | `app/(public)` | anonymous viewers | public DTO only |
| Studio | `app/(studio)` | owner and trusted members | server-checked private access |
| Public API | `app/api/public` | viewers and export jobs | no private fields |

The studio can use FullCalendar for month, week, and list workflows. The public poster should stay a dedicated rendering surface so branding, CTA placement, sticker positions, and screenshot export remain stable.

## Product Invariants

- Timezone is always `Asia/Seoul`.
- Owner is the only editing role.
- Trusted members can read private layers only after an unlock session.
- Viewer proposals and votes never mutate calendar events directly.
- Public DTOs and private DTOs are distinct types.
- Public routes must not import private loaders.

## Current Implementation

The first MVP pass is intentionally local-data-first. `sample-data.ts` acts as the domain fixture, while `public-loader.ts` constructs explicit viewer-safe DTOs. This keeps the public/private boundary testable before Supabase persistence is wired in.

Studio state mutations are currently client-local:
- create a draft event
- delete the selected event
- change status
- promote a viewer proposal to a draft
- advance request state

The next implementation pass should replace those local mutations with server actions backed by Supabase Auth and RLS.

## Export Pipeline

Use two export paths:
- Canonical export: Playwright renders the poster route and captures a PNG.
- Convenience export: browser-side `html2canvas` plus `canvas.toBlob()` and Clipboard API.

Playwright output is the source of truth for official monthly schedule images and visual regression tests.
