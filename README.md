# VIC Schedule Studio

Streamer-first monthly schedule studio and public poster app.

The product is split into two surfaces:
- `Studio`: private planning workspace for owners and trusted members.
- `Public Poster`: viewer-facing monthly and weekly schedule surface.

Core constraints:
- `Asia/Seoul` timezone only.
- Owner-only schedule editing.
- Trusted member private-layer read access.
- Public API responses exclude private schedule fields by construction.
- Playwright is the canonical poster PNG/export renderer.

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
npm run test:e2e
npm run test:visual
```
