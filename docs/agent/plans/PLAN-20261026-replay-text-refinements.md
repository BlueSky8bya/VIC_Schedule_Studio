# Replay current context and existing text reset

2026-10-26 direct human adoption: implement proposal2 without a conspicuous text CTA; proposal3 reuses the existing 기본 button. Standing adopted scope includes actual checks/non-author review/release. Original request: local runtime run `20261026-replay-text-refinements/request.json`.

- Existing current-scene label gets a small locate icon. A deliberate click/Enter/Space unfolds the current group and scrolls only the timeline rail; it never seeks, changes playback, clears a search or steals focus. Search/closed list disables reveal. No idle observer/poll loop.
- Existing 기본 button restores font/size/weight through existing setters. It remains enabled when only font or weight differs; sound/background/other surfaces remain untouched. No extra reset button.
- G22: add fixed `vod-timeline-current`/`text-style-reset`; retain readable retired `text-size-reset` history. Pointer/native keyboard click captured once; no titles/search/settings metadata. Verify timeline and least-used developer views with synthetic local transport.
- Preserve public DTO/auth/KST, all user dirty source/assets, old failures and media. No DB/auth/provider setup or new dependency.
- Proposal1 remains conditional/unimplemented pending a nonduplicated, bounded-height design; attached detail badge arrangement remains a proposal, outside this implementation.

Local gates: type/lint/harness exit0;60 units and final11 fresh scoped UI cases pass. Corrected frozen build1um reused after verification, with original failed attempts preserved. Independent review/release readbacks remain separate runtime records. [Verification](../verification/REPLAY_TEXT_REFINEMENTS-20261026.md). No full200/normal36 claim.
