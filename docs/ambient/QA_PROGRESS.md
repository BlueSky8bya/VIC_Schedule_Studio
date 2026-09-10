# Ambient QA — current state

Last Updated: 2026-09-11
Active Work ID: AMB-QA-18
Latest completed local scoped review: [ROUND-20 spring release](rounds/ROUND-20-spring-release.md), 2026-09-11; underlying depth checks: [ROUND-18](rounds/ROUND-18-depth-P0.md). Earlier general backlog: [ROUND-17](rounds/ROUND-17.md). Spring deployment verification is tracked in ROUND-20; this does not close real-device/OBS or the older general backlog.

This file owns current QA priorities, not completed-round narrative. Art generation/review is tracked separately by the [pine handoff](HANDOFF-20260908-pine.md) and current art board. Slot/variant counts come from the manifest and files.

## Current infrastructure

Deterministic biome fixtures and capture/sheet/diff/selftest tooling exist in `scripts/ambient-qa/`. A general metrics runner and automatic round runner remain deferred work; do not describe implemented P0/P1 tooling as unstarted.
Historical capture paths under `.scratch-pw/` may be absent on another machine. Recreate a baseline from an identified build/seed when required; old test counts and local paths do not establish current verification.

## AMB-QA-18 — first candidates

The owner authorized depth P0 on 2026-09-10. Its completed local implementation/review is [ROUND-18-depth-P0](rounds/ROUND-18-depth-P0.md): fixed baseline, scoped F/M/N composition, mode/load gates and before/after checks. The record retains unmet absolute performance targets and real-device/OBS/GPU limits. This does not close the older candidates below or authorize new artwork.

These findings were left by ROUND-17. Reproduce against current code and artifacts before choosing fixes; proposed numerical changes are hypotheses, not preapproved acceptance criteria.

| Priority | Finding | Area / next check |
|---|---|---|
| 1 | A#1: sun/moon lose their pixel grid during shrink | Compare source, ArtSet output and actual sky-size render; check current normalization/sampling |
| 2 | C#4: fog scene appears nearly stationary | Compare same-seed fog/clear temporal sheets and scene wind consumers |
| 3 | B#9/B#10: shoreline/current geometry differs from glint/fish boundaries | Reproduce coastal glint and open-sea fish contacts; share geometry where confirmed |
| 4 | B#6: spring/summer/winter meadow lack a shared occlusion order | Check insects/rabbit against shrubs/snowman at multiple y positions |
| 5 | B#5: autumn meadow trees bypass spacing claims | Measure crown overlap and trace placement through claimSpot |

## Remaining findings requiring triage

ROUND-17 retained nine P1 findings and its P2 backlog. The priority table above is not the full set and does not close omitted findings.
Remaining examples: C#5 pond distant silhouettes; B#7 rocky outcrops; B#8 valley bank vegetation; A#3 high-cloud ribbon silhouette/aspect; C#11 wetness transition; A#4 art/ground idiom mismatch; A#7 rock stamps; A#8 repeating grass; A#10 jellyfish rows; A#11 pond islands; B#11 tidal bank shade; B#12 shrub bases; C#7 cloudy/fog morning versus noon; C#8 night ground level; C#9 rain response in valley water; C#12 deep dawn versus dusk.
The authoritative observation/evidence list is [ROUND-17 remaining findings](rounds/ROUND-17.md). Older backlog rows have conflicting historical statuses; they remain evidence for targeted re-triage, not instructions to replay completed fixes.

## Rules that affected the last review

- Do not derive scene geometry constants from closure-initial w/h=0. Compute current-dimension values through functions.
- Drawing, collision, spawn and interaction boundaries must use the same geometry.
- Visual review remains required even when probes pass; the last review caught broken geometry shared by the implementation and its probe.
- Deep sea remains weather/season sealed while its scene reads time of day.
- Keep before build fixed until all independent reviewers finish; coordinate rebuilds with the main agent.

Evidence and standing rules: [ENGINE_RULES](ENGINE_RULES.md), [VISUAL_QA_PROTOCOL](VISUAL_QA_PROTOCOL.md).

## Next execution

For AMB-QA-18, identify current build and baseline → run selftest → capture selected scenarios before → simultaneous A/B/C read-only review → select all P0 and at most four attributable fix groups → fix → relevant gates → same-seed after/diff → visual review → write ROUND-18 result.
Commands and flags live in [tool README](../../scripts/ambient-qa/README.md); pass the active round number explicitly. No fixed old round command is a standing instruction. Current user authorization governs whether to implement or commit.

## Evidence history

Completed rounds remain in `rounds/ROUND-NN.md`; [FINAL_AUDIT](FINAL_AUDIT.md) describes the earlier autonomous review period only. The pre-split QA_PROGRESS snapshot preserves the former long backlog for historical lookup. None is loaded automatically or allowed to override this current task index.
