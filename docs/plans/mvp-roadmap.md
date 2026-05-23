# MVP Roadmap

## Sprint 1: Foundation And Security Core

- [x] Scaffold Next.js App Router route groups.
- [x] Add `CLAUDE.md`, `AGENTS.md`, and project docs.
- [x] Define public and studio DTOs.
- [x] Draft Supabase schema and RLS policies.
- [x] Add public API leakage tests.

## Sprint 2: MVP Calendar

- [x] Add studio monthly calendar surface.
- [x] Add owner-only local event draft creation and deletion.
- [x] Add read-only trusted member and viewer preview modes.
- [x] Add event detail drawer on desktop and responsive stacked layout on mobile.
- [ ] Replace local sample mutations with Supabase-backed persistence.

## Sprint 3: Private Planning

- [x] Add `event_private_meta` in types and schema.
- [x] Add private-layer unlock UI.
- [x] Add embargo and codename fields to private metadata.
- [x] Add A/B variant groups and studio summary.
- [x] Add proposal and request inbox moderation UI.
- [ ] Persist unlock sessions and moderation actions.

## Sprint 4: Export And Mobile

- [x] Build poster export surface.
- [x] Add Playwright visual regression path.
- [x] Add browser clipboard PNG convenience path.
- [x] Add mobile poster screenshot baseline.
- [ ] Add canonical server/CI PNG artifact generation endpoint.

## Sprint 5: Hardening

- Add E2E role coverage.
- Add visual regression baselines.
- Add RLS smoke tests.
- Add realtime proposal/presence authorization tests.
