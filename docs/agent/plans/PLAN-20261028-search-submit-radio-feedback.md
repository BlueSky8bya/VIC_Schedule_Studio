# Adopted search submit and radio feedback — 2026-10-28

The human adopted ideas1 and3 from the observed PC follow-up report: `search:mouse-submit-existing-magnifier` and `companion-radio:visible-playback-failure-state`. Idea2, browser tab month/title context, is not adopted this round and remains unimplemented. Existing earlier completed/rejected records remain intact.

Use the existing search icon and submit path, retaining its alignment, Korean composition/Enter behavior, result-kind filters and return context. The existing input already has an accessible name; use a search region and a native button without adding a form's implicit composition submit. No new query collection or backend path.

Use the existing radio status line and play button for failure and recovery. Respect request tokens on stop, preference changes and unmount; never replace failures with waiting or let a late failed request override a later human stop. Keep audio sources, credits, playlist, volume and behavior engine unchanged. No new modal, button row or media download.

G-22: `search-submit` is the only new fixed semantic target; map it to ‘검색 실행’ in both developer displays and verify pointer/keyboard capture once without search text. Radio targets remain unchanged. The automated failure status and preview measurements never become human action events. Use local synthetic analytics reads/capture only and preserve production automation guards.

Source adoption/evidence: `C:/Users/im917/.codex/vic-pipeline/runs/20261028-adopted-search-radio`. Verify actual production-build fixture interactions and non-author review before the combined release with the independently requested settings specimen fix. Preserve original morning carry failures; the same-ball post-use airborne-fall witness remains a separate unresolved QA condition, not a claimed product fix or life-AI improvement.
