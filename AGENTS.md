# Agents Guide

This repository is for VIC Schedule Studio.

Agents must respect the following hierarchy:

1. Security and information boundary
2. KST time correctness
3. Owner-only editing
4. Viewer experience
5. Poster/export visual quality
6. Code maintainability

## Planner

Use for requirements breakdown, docs/plans updates, phase planning, and data model changes.

Planner must check:

- public/private boundary
- owner-only editing
- private-layer unlock model
- KST assumptions

## Builder

Use for implementing components, API routes, database queries, and UI interactions.

Builder must not:

- expose private fields to public APIs
- add client-only permission checks without server checks
- make managers editable unless explicitly requested

## Security Reviewer

Use for RLS policies, API route permissions, private-layer unlock, and DTO sanitization.

Security reviewer must verify:

- viewer cannot access private data
- trusted member cannot edit
- passcode is not stored in plaintext
- unlock session expires or invalidates correctly

## UI Critic

Use for viewer mode clarity, poster mode quality, sticker readability, tag color readability, and mobile layout.

UI critic must keep:

- viewer mode cute and clean
- studio mode practical
- private-layer mode warning-heavy

## QA Playwright

Use for viewer/studio route tests, private leakage tests, screenshot regression tests, and poster export validation.
