# Ambient work — routing

Start here for `components/shared/ambient/**`, ambient artwork or QA. Read the matching row only. [AGENTS](../../AGENTS.md) owns shared boundaries; [CURRENT_STATE](../agent/CURRENT_STATE.md) owns current cross-project work.

## Task → required topic

| Task | Read | Code / evidence |
|---|---|---|
| Engine, world, camera, load or control wiring | [ENGINE_RULES](ENGINE_RULES.md) | `scene-engine.ts`, `world/*`, `scenes/*` |
| Scene visuals | [VISUAL_DIRECTION](VISUAL_DIRECTION.md), relevant [BIOME_GRAMMAR](BIOME_GRAMMAR.md) section | Existing scene and [IMMERSION_BREAK_RULES](IMMERSION_BREAK_RULES.md) |
| Time/weather/season | ENGINE_RULES time section and [SEASON_TIME_WEATHER_GRAMMAR](SEASON_TIME_WEATHER_GRAMMAR.md) | `world/sun.ts`, `time.ts`, `weather.ts`, `light.ts` |
| Mountain layers | [MOUNTAIN_DEPTH_RULES](MOUNTAIN_DEPTH_RULES.md) | `scenes/land.ts`, `world/view.ts` |
| Creature placement/behavior | ENGINE_RULES creature section and relevant BIOME_GRAMMAR section | `world/codex.ts`, `rarity.ts`, affected scene |
| Art entity/source/migration | [Art catalogue](../../art-src/목록.md), matching entity prompt, [source rules](../../art-src/AGENTS.md) | [ART_PIPELINE](ART_PIPELINE.md), [Manifest](../../components/shared/ambient/art/manifest.ts) |
| Art generation/review | Exact run request and frozen inputs, [ART_RULES](ART_RULES.md) | Entity reference/rejection/source/review entry points; full file plan does not expand this delivery |
| Active pine work | [Pine handoff](HANDOFF-20260908-pine.md), [pine entity](../../art-src/나무/소나무/프롬프트.md) | Existing frozen pilot request; do not reuse a historical prompt |
| Run QA | [VISUAL_QA_PROTOCOL](VISUAL_QA_PROTOCOL.md), [QA_PROGRESS](QA_PROGRESS.md) | [Tool README](../../scripts/ambient-qa/README.md) |
| UI around ambient | [UI_RULES](../ux/UI_RULES.md), matching controls section | Studio settings / showcase / ambient mode controls |

## Authority and evidence

Current user instructions → shared AGENTS boundaries → applicable current accepted decision → task-specific rules. Later decisions can replace specific clauses; ADR-0019 replaces the earlier Noto-only creature target without discarding all ADR-0017 rules.
The manifest owns art specifications/counts; code owns executable configuration; rules state acceptance intent. If these disagree, identify the conflict and update the stale representation after establishing intended behavior.

[SYSTEM_MAP](SYSTEM_MAP.md), [ENTITY_ART_PLAN](ENTITY_ART_PLAN.md), [FINAL_AUDIT](FINAL_AUDIT.md), older UX briefs and completed rounds are dated design/diagnostic evidence. Their old counts, “next” steps and pending decisions are not active commands. Read them only for a relevant investigation.

## QA operation

A/B/C reviewers run independently and in parallel: art mood, spatial ecology, season/weather/time/motion. Main session integrates findings; all P0 plus at most four attributable fix groups per round. Keep build/seed fixed during review and compare before/after with the same scenario inputs.
Use `npm run ambient:qa:selftest` and current capture/sheet/diff tooling. Get flags/server setup from the tool README; choose active round from QA_PROGRESS instead of copying a fixed old round number. Do not rebuild or stop another agent's server without coordination.

Current QA priority: AMB-QA-18 in QA_PROGRESS. Art workflow has its own review state. Completed rounds and archive snapshots are never startup context.
