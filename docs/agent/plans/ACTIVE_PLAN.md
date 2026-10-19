# Active Plan

| ID | Status | Record |
|---|---|---|
| PRIVACY-20260921 | Deployed containment verified; historical Git exposure, realtime/provider and retention follow-up remain | [Privacy audit](../verification/PRIVACY-20260921.md) |
| DARK-HARMONY-20260919 | Ribbon editor dark controls corrected; local verification and authorized push follow-up. Production unverified (prior release staged) | [Dark palette follow-up](../../ux/dark-mode-palette.md) |
| MARINE-RESUME | Paused by owner | [Resume handoff](../handoffs/20260916-marine-biomes-resume.md) |
| PLAN-20260909-014 | In Progress | [Rule preservation, Korean art folders and remaining C choices](PLAN-20260909-014-rule-preservation-and-art-completion.md) |
| PLAN-20260910-015 | Awaiting visual feedback | [Distance and controls](../../ambient/rounds/ROUND-36-depth-and-showcase-controls.md), [world depth layers](PLAN-20260910-015-world-depth-layers.md) |

Completed plans remain in their own files. Remove their row here when work finishes; record verification in the plan/handoff and link next active work from CURRENT_STATE.

Previous accumulated index: `docs/agent/archive/20260909-ACTIVE_PLAN.snapshot.txt` (history).

## UI-128 — grounded storage and final box approach

2026-10-19 KST, latest owner128. User selected the rear floor shared with the chest. CSS-only first candidate grounds both opaque bases and balances their right-side spacing. Independent review identified an existing jump-landing inset preventing the final grounded toy-box approach at shell .9/.8; the native carried-resize regression reproduced a failed return on build pUjm-JWwSRralWtP1gaXp.

Implement a bounded final walk only when an actual toy stash/spawn beat is outside the existing box-close range and the same measured body-safe home floor intersects that range. Ordinary jump landing inset, body/control collision geometry, close distance and actual painted-opening20px ACK remain unchanged. Revalidate that narrow walk against current safe floor/box on layout changes; cancellation/hidden/removed targets fail closed. No new clock, observer, teleport, API, DB, metadata or personal-data collection. Existing shared viewer/studio code only. Add focused boundary/resize/cancel coverage, rerun all local gates and actual native interactions, then independent review and authorized main release/public verification. Completion evidence belongs to the128 topic record; remove this active block afterward.
