# Component guidance

Shared rules: [AGENTS](../AGENTS.md). UI acceptance: [UI_RULES](../docs/ux/UI_RULES.md). Read the relevant sections and [component map](README.md), not the entire history.

- `poster/`: public poster and aggregate public insights.
- `studio/`: owner/developer editing, internal insights and settings.
- `shared/ambient/`: optional biome background; begin at [ambient routing](../docs/ambient/README.md).
- Stickers/decorating and seasonal minigames are retired. Old ADRs/records do not authorize restoration.

Public components receive server-sanitized DTOs only. Preserve explicit permission checks on the server; simulated role is UI preview only.
Use shared design tokens and real topology classes for web/agenda material gates. Keep capture surfaces free of editing/admin controls.
Serialized writes use the existing keepalive queue; gate only the unavailable action. Shared viewer/studio charts retain shared structural CSS.

Validation: production-build fixtures + relevant Playwright/rendered checks. Studio fixture/intercepted-write tests are available; genuine-login/device/RLS coverage remains separate. Report actual coverage rather than declaring all studio automation impossible.
