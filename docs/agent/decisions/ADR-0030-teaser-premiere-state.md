# ADR-0030 — Public premiere state and one viewer coordinator

Status: Accepted
Date: 2026-10-14

The owner delegated the complete implementation to Codex, using Claude's stage plan as a reference. The latest in-session choices and PLAN-027-final-decisions govern conflicting proposals: screen at 68 seconds, no heartbeat sound, no rewrite of teaser_reveal_at, no persistent registry or external KV initially.

Public routes call only public-loader. A security-invoker read RPC reads the existing masked public view and returns the DB timestamp/state together. Discovery and canonical per-event confirmation use anonymous shared caches with bounded keys and process single-flight; missing discovery entries are not deletion evidence. No service-role helpers or hope settlement run in public reads. Existing cron performs settlement. A failed/missing RPC fails closed.

Initial development kept the deployment feature off. The owner's subsequent commit/push/deploy instruction on 2026-10-14 moves it to default ON after the additive RPC/anonymous boundary checks and actual Next-to-stub-DB cache probe; `NEXT_PUBLIC_PREMIERE_STAGE=0` remains the emergency stop. This supersedes the initial default-OFF rollout clause; physical-device/composite-luminance and complete deployed fanout evidence remain explicit follow-ups. Data Cache background revalidation is coalesced inside its origin callback, since a wrapper around stale responses alone did not bound real DB calls.

The personal `최초공개 무대` preference also defaults ON, persists per device and synchronizes between shared settings surfaces and same-origin tabs. OFF retains card/detail presentation with the same public coordinator; reduced motion still prevents automatic occupancy. Explicit preview rehearsal is a manual opt-in and remains available when automatic stages are off. Fixtures and rehearsal use synthetic transport, without database writes. 0142 was applied before the reader rollout with verified TLS; uncommitted past-month SQL canaries rolled back with zero residue.

Clock samples are separate, no-store and DB-free. A monotonic client clock drives one shared scheduler, countdowns and visual channels. Public release remains exclusively the DB's decision. The 1840px poster layout is preserved; stage rendering uses sanitized DTOs in a portal. Roles, private unlock grants and KST rules remain unchanged.

Synthetic canaries cover hidden content and identity, routes are anonymous and personal-data-free, and no new public row privileges are introduced beyond the existing masked view. No persisted viewer identity/history is required. External cache/provider retention remains unverified.
