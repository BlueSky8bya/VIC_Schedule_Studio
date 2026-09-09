# ADR-0020 — Bounded current memory and isolated art review

Status: Accepted
Date: 2026-09-09
Area: Agent memory / art delivery

## Context

CURRENT_STATE accumulated completed work and incompatible next steps. SessionStart emitted the entire state and decision index. File-existence checks and a daily touched-file heuristic did not detect drift. The next pine brief requested three accepted files alongside its 21 missing files.

## Decision

- AGENTS contains common rules, CLAUDE its adapter, and domain documents current local rules with short reasons and evidence. CURRENT_STATE contains active work, blockers, next actions and bounded verification references. Historical snapshots are never current instructions.
- Generated current outputs have freshness checks; historical requests preserve original inputs and hashes. One authoritative source per fact does not require one physical file for all facts.
- Brief/document budgets are project configuration. Oversized mandatory content fails validation rather than being silently truncated. A baseline identifies the actual session; absence is reported, not replaced with today's commits.
- Documentation-impact checks accept relevant domain records or a reason tied to the exact changed content. Routine edits do not require appending a paragraph to CURRENT_STATE.
- Artwork enters an isolated batch using canonical flat filenames. Requested outputs exclude accepted files. Candidate and baseline remain distinct; numeric checks and human approval are separate. Publication verifies reviewed content and seasonal pairing.
- First pine pilot requests two new variants across three seasonal slots. It does not authorize replacing accepted PNGs or silently approving new artwork.
- Entity folders are the art navigation boundary: generated `프롬프트.md` routes to `레퍼런스/`, `반려본/`, `생성본/` and `검토/`. Canonical filenames and actual seasonal slots determine storage; category availability does not multiply files. Immutable `runs/` remain within the entity as delivery evidence.
- Correction on 2026-09-09: isolated runs alone did not fulfill the user's entity archive request. The prior art-src README promise to retain all legacy paths is superseded by a hash-recorded physical migration. Preserve original image/sidecar bytes and fixed run/public paths; ambiguous reference candidates remain shared, and imported historical rejection records are distinguished from current owner decisions.

## Consequences

Current memory is smaller and mechanically constrained. History remains retrievable; artistic judgement remains human. Hooks cannot prove an agent understood a referenced image; review records bind actual evidence.

## Evidence

- [Consultation](../handoffs/20260909-consult-art-pipeline-and-docs.md)
- Implementation plan (`../plans/PLAN-20260909-012-harness-memory-and-art-pipeline.md`; destination lands with the following art commits)
- Entity archive correction (`../plans/PLAN-20260909-013-entity-art-archive.md`; destination lands with the following art commits)

## Revisit Trigger

Active-work model cannot represent real concurrent work, required brief exceeds its budget, or a new art family needs a different review/publication contract.
