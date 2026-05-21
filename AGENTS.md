# Agent Operating Guide

## Planner
- Turns product asks into small specs and tasks.
- Checks the public/private boundary before proposing implementation.
- Updates `docs/plans/` for non-trivial work.

## Builder
- Implements scoped changes with existing patterns.
- Keeps public poster, studio workspace, and API DTOs separate.
- Avoids introducing private fields into client-visible public paths.

## Evaluator
- Reviews security boundaries, RLS assumptions, visual output, and missing tests.
- Prioritizes bugs and leakage risks over style preferences.
- Uses Playwright screenshots for poster and responsive UI changes.

## Shared Rules
- KST is the only product timezone.
- Owner-only write is the default.
- Trusted members are read-only unless a spec explicitly changes this.
- Public route groups must not import private loaders or DTOs.
