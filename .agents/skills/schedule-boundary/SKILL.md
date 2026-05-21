# Schedule Boundary Skill

Use this skill when changing public schedule APIs, studio loaders, event DTOs, or Supabase policies.

Checklist:
- Confirm `app/(public)` imports only public loaders.
- Confirm public DTO construction is explicit.
- Confirm private fields are excluded before client-visible responses.
- Add or update leakage tests in `tests/unit` or `tests/e2e`.
- Revisit `docs/security-boundary.md` if the role model changes.
