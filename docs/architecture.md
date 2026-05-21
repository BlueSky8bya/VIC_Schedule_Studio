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

## Export Pipeline

Use two export paths:
- Canonical export: Playwright renders the poster route and captures a PNG.
- Convenience export: browser-side `html2canvas` plus `canvas.toBlob()` and Clipboard API.

Playwright output is the source of truth for official monthly schedule images and visual regression tests.
