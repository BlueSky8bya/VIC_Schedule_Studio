# Documentation routing

Read [AGENTS](../AGENTS.md) and the bounded [current state](agent/CURRENT_STATE.md) once, then select the relevant topic. Do not bulk-read SOPs, completed plans or archives.

| Task | Entry |
|---|---|
| Find affected code | [PROJECT_MAP](agent/PROJECT_MAP.md) |
| Current implementation plan | [ACTIVE_PLAN](agent/plans/ACTIVE_PLAN.md) |
| UI/layout/motion | [ux/README](ux/README.md) |
| Ambient engine/art/QA | [ambient/README](ambient/README.md) |
| Tags/colors | [tags/README](tags/README.md) |
| Insights/analytics | [insights/README](insights/README.md) |
| Auth, public/private boundary | [security rules](agent/domain-rules/SECURITY.md), [auth rules](agent/domain-rules/AUTH.md) |
| Data/migration work | [destructive-data rules](agent/domain-rules/DESTRUCTIVE_DATA.md) |
| Validation / unresolved coverage | [DEFINITION_OF_DONE](agent/DEFINITION_OF_DONE.md), [OPEN_CHECKS](agent/verification/OPEN_CHECKS.md) |
| Prior decision | [DECISION_INDEX](agent/decisions/DECISION_INDEX.md), only the relevant ADR |
| Deployment diagnosis | [deployment](deployment.md), verify dated operational assumptions before use |
| Historical research | [product/](product/README.md), [plans/](plans/README.md), dated UX/QA reports |

Shared current rules live in AGENTS; domain rules own their topics. `sop.md`, `architecture.md`, `security-boundary.md` and `harness.md` supply detailed background, not another always-loaded authority. Resolve any stale role/product statement against current decisions and executable checks.
Archive snapshots, completed plans and previous round instructions preserve evidence. They never define current tasks or approve deployment/data operations.
