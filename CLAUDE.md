# Claude entry point

Read [AGENTS.md](AGENTS.md) for shared project rules. It is the common rule source for every agent.

SessionStart runs `scripts/agent-harness/session-brief.mjs` from `.claude/settings.json`. Its bounded output renders [CURRENT_STATE](docs/agent/CURRENT_STATE.md); do not load that state twice. If the hook did not run, run the script or read CURRENT_STATE once.

Use [PROJECT_MAP](docs/agent/PROJECT_MAP.md) to select topic guidance. UI work reads [UI_RULES](docs/ux/UI_RULES.md); ambient work starts at [docs/ambient/README](docs/ambient/README.md).

Completed plans, round reports and `docs/agent/archive/` are historical evidence. Read them only for a relevant decision or regression. They do not override current rules or authorize new work.
