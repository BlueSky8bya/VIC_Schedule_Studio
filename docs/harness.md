# LLM Harness

Use a planner, builder, and evaluator loop for substantial work.

## Repository Memory

- `AGENTS.md`: common product, permission, workflow and communication rules.
- `CLAUDE.md`: short Claude adapter to those rules and the current brief.
- `docs/agent/CURRENT_STATE.md`: active work only; completed history is kept in topic records.
- `docs/`: source of truth for architecture, security, UX, and plans.
- `.claude/rules/`: focused Claude rules.
- `.agents/skills/`: Codex skills for repeated workflows.
- `.github/prompts/`: VS Code prompt files.

## Agent Loop

1. Planner turns broad asks into scoped specs.
2. Builder implements within the route, DTO, and RLS boundaries.
3. Evaluator checks leakage risk, UI behavior, screenshots, and tests.

Humans steer scope and product tradeoffs. Agents execute bounded work with automatic verification.

## Current-memory checks

Run `npm run harness:verify` after changing memory/routing. UTF-8 byte limits in `agent-harness.yaml` cover AGENTS, CLAUDE, CURRENT_STATE, ACTIVE_PLAN, generated brief and their combined startup content (including `.claude/rules`). These are repository-managed bytes, not measured model tokens or host system instructions. Overflow fails; the brief is never silently truncated.

CURRENT_STATE has exactly one of each section: Current Objective, Active Work, Blockers, Next Exact Steps, Last Verified. Active Work is an ID/status/next/record table. Next actions use `1. TASK-ID: action` and may name several active IDs before the colon. IDs in that label must remain active; technical names and historical citations in the action prose are not task IDs. Completed plans leave ACTIVE_PLAN and the active table together.

## Session adapters and documentation impact

Claude hook commands are configured in `.claude/settings.json`; automatic execution in the host is not assumed. The CLI accepts hook stdin `session_id`. Other agents read AGENTS and run the verifier explicitly. For a manually identified session:

```powershell
node scripts/agent-harness/session-brief.mjs --session local-task-001
# Perform the task, then check that session's actual content changes.
node scripts/agent-harness/state-drift-check.mjs --session local-task-001
# Only when the exact changes have no documentation impact, record the reason.
node scripts/agent-harness/state-drift-check.mjs --session local-task-001 --ack-none "Comment typo only; documented behavior unchanged."
node scripts/agent-harness/state-drift-check.mjs --session local-task-001
```

The snapshot is local under Git's `agent-harness/sessions` directory. Existing dirty work is baseline content; later changes to the same file are detected. A successful Stop advances the baseline, and later code edits invalidate an earlier impact explanation. Resume does not erase unchecked work. Without a session baseline, Stop reports NOT CHECKED instead of using today's commits.

Drift is advisory: a matching domain record or exact-content acknowledgement satisfies the mechanical check, but cannot prove that the explanation is semantically correct. CURRENT_STATE alone is not a substitute for a changed domain contract. See repair evidence (`agent/handoffs/20260909-memory-and-art-pipeline-repair.md`; destination lands with the following art commits) and [current work](agent/CURRENT_STATE.md).
