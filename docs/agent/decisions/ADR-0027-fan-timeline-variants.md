# ADR-0027 — Independent fan timelines and persistent moderation

Status: Accepted

Date: 2026-09-21 KST. Authority: owner approved the proposed multi-author/reply behavior in the current session.

Supersedes the single longest-comment winner used by 0071. Preserve a candidate per root thread and author, joining only same-author replies in source order. Separate roots remain separate templates even for the same author. Reply-only contributors use a root-scoped SHA-256 key, so deleting their first reply does not discard moderation. Raw user IDs, IPs and unrelated comment text are never persisted.

Candidate classification is a conservative heuristic, not semantic certainty: at least three unique, in-range entries spanning 35% of the VOD and three of six time bands qualify as an overview. Explicit feedback preambles are review-only. Rank overviews by coverage, span, section count and a small entry-count bonus. Exact time/normalized-label duplicates merge; different descriptions at one time remain. Owner/developer can show an alternative, hide a candidate, pin a representative or return to automatic choices. Explicitly shown specialists remain alternatives to eligible overviews unless pinned.

Private candidate and choice tables are service-role only. The shared advisory-locked ingestion/moderation RPCs materialize `vod_timeline`: legacy author/entries remain the representative and search-index source; optional public `variants` contain only present, visible candidates with id, credited nickname and entries. The public loader constructs explicit DTO fields. Public timeline/chapter-table RLS also requires an archived public VOD (`auth_no=101`). Read/create owner-private access and passcode grants are unaffected.

Resync changes source fields and presence only, preserving visibility/pin. Missing source candidates do not appear publicly; their settings survive a later return. Older snapshots cannot replace newer ones. Incomplete page/reply reads preserve the prior projection. Existing late-comment polling remains live-safe and age-unbounded. External schedule timing and SOOP availability still constrain delay.

One `VodChapters` selector serves replay/modal/preview; no management data enters it. Studio `/studio/timelines` uses owner/developer server checks and the existing serialized keepalive dispatcher. Management link is absent during role preview. Common select styling lives with the shared control rather than only in studio CSS.

Deploy additive migration 0124 before code. Do not run legacy single-winner backfill writes afterward; the script refuses them, and guest registration leaves timeline publication to the shared collector. Revert application code before rolling back schema; retain additive candidate data. Local implementation does not authorize production application or deployment.
