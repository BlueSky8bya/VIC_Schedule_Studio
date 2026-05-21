# LLM Harness

Use a planner, builder, and evaluator loop for substantial work.

## Repository Memory

- `CLAUDE.md`: short always-on product and architecture rules.
- `AGENTS.md`: role guidance for planner, builder, and evaluator.
- `docs/`: source of truth for architecture, security, UX, and plans.
- `.claude/rules/`: focused Claude rules.
- `.agents/skills/`: Codex skills for repeated workflows.
- `.github/prompts/`: VS Code prompt files.

## Agent Loop

1. Planner turns broad asks into scoped specs.
2. Builder implements within the route, DTO, and RLS boundaries.
3. Evaluator checks leakage risk, UI behavior, screenshots, and tests.

Humans steer scope and product tradeoffs. Agents execute bounded work with automatic verification.
