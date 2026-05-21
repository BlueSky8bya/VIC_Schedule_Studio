# MVP Roadmap

## Sprint 1: Foundation And Security Core

- Scaffold Next.js App Router route groups.
- Add `CLAUDE.md`, `AGENTS.md`, and project docs.
- Define public and studio DTOs.
- Draft Supabase schema and RLS policies.
- Add public API leakage tests.

## Sprint 2: MVP Calendar

- Add studio month/week/list calendar with FullCalendar.
- Add owner-only event create/edit/delete.
- Add read-only trusted member mode.
- Add event detail drawer on desktop and bottom sheet on mobile.

## Sprint 3: Private Planning

- Add `event_private_meta`.
- Add private-layer unlock sessions.
- Add embargo and codename fields.
- Add A/B variant groups and promotion flow.
- Add proposal and request inbox moderation.

## Sprint 4: Export And Mobile

- Build poster export surface.
- Add Playwright PNG export path.
- Add browser clipboard PNG convenience path.
- Add mobile poster and studio interaction checks.

## Sprint 5: Hardening

- Add E2E role coverage.
- Add visual regression baselines.
- Add RLS smoke tests.
- Add realtime proposal/presence authorization tests.
