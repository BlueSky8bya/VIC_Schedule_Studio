# Mobile reading context and save feedback — 2026-10-26

The owner adopted visible saving/saved/failed captions, an accurate screen-date context, clearer notice padding and actual mobile comparison. One shared implementation covers owner/developer studio, viewer, anonymous and preview. No write queue, API, loader, public DTO, permission, authentication or KST boundary changed.

## Behavior

- The existing44px month control shows `저장 중…`, `저장됨` after a real saved KST time, or `저장 실패`. Idle keeps the editor caption. Recovery remains the existing action; no new row/badge moves the dates.
- The notice board labels the date with the greatest clipped visible height, updating through one requested rAF. A collapsed range is explicitly a range. This is a screen heuristic, not eye tracking.
- Only notices intersecting the presented date/range appear. Focus keeps an action's URL and presented scope stable, with retained-selection text separate from the current screen date. The44px follow control returns to the current view.
- The current card and date control share a static blue cue. Complete titles are immediately readable; the action strip/card does not translate on context/selection changes. Only the date marker gets the existing bounded spring, respecting in-app reduced motion.
- Board padding is8px vertical/12px horizontal, with4px before titles and2px row gaps. Hidden measurement matches the visible stack, reserving actual concurrent stacks/range unions rather than every transitively connected notice. The four-syllable secondary caption inside the44px date control uses10px to fit that structural width; every surface shares this same control.
- Short-screen pointer focus no longer reveals/moves a row before its click. Keyboard-visible focus and explicit reading-frame entry retain the existing reveal helper. Today/search retain their own explicit reveal path.

## Evidence and limits

Durable evidence: `$CODEX_HOME/vic-pipeline/runs/20261026-mobile-reading/`. Screenshots and tests use guarded fixtures and intercepted public synthetic writes; no real DB writes, real-login or physical-device claims.

| Check | Actual result |
|---|---|
| Original behavior | Six owner/developer state captures had0px state drift, but a dominant24th could report23rd. |
| Pure/queue/activity units |112 passed,0 failed/pending; exact output in `unit-scoped-final.json`. |
| Build/type/lint | Final production fixture build and explicit checks; logs/exit receipts in `checks-summary.json`. |
| Main mobile matrix |32 unique cases:31 in `visual-main-r02.json`, corrected short-case preparation in `visual-short-r03.json`. No title/hit/geometry threshold relaxed. |
| Final short-focus delta | New build `uyUo_3QPT2UjBf3po7FBi`: coarse rotation2 and short-preview1 all passed in `visual-focus-r03.json`. Portrait evidence is unaffected because the reveal helper already returns above480px. |
| Final six-state gallery | `gallery-r03`: owner/developer,6 synthetic writes; visible saving/saved/failed plus recovery. Header/board/frame/date/card/scroll maximum drift0px, no unknown mutation/page error.320px caption and three titles complete. |
| Viewed-date linkage |19th tail40.1875px remains visible while20th dominates; reading20 within2rAF, focused19 URL/presented scope retained, explicit follow20. |
| Extra narrow/public cases | `extra-r01`:320px held metadata39.5625px inside44px slot,44px native actions, tag body120.656px; anonymous/signed-in/preview19→20 and no-active-date0 rows. |
| Collapsed range and one tap | `range-r03`: native visible heights9th25/gap10–17 44/18th25px. Range cue10–17 in2rAF; one native tap expands all8 dates, returns to10th cue, window/flow drift0px. |

Initial finite calendar entrance animations are settled before comparing state/selection geometry. Date-scroll reactions are still observed directly after two rAFs. Original failures remain: first gallery measured before entrance completion; old short test expected three notices without viewing their date; first range probe incorrectly expected no notices after18th became dominant; range-r02 recorded the real two-tap defect before its fix. None is relabelled PASS.

Independent non-author source/role/boundary/React review and independent rendered QA precede integration. G22 adds only fixed `agenda-support-follow-view`: existing collector→fake transport and both developer timeline/least-used display tests include its current label. Native pointer/keyboard controls remain semantic buttons; automatic date/highlight/save state is not a human activity event. No product title/body/identity metadata is added.

Physical Safari, screen readers and genuine-login/RLS remain unverified; fixtures do not establish them. Exact CI SHA, provider READY/production alias and public readback are separate release evidence in `deployment-summary.json` and the durable controller, not implied by local PASS. The temporary continuation was reported absent by the app during manual continuation; no replacement schedule was created. Previous worktree deletion was policy-blocked and is not retried.

## Research and design rationale

[NN/g change blindness](https://www.nngroup.com/articles/change-blindness-definition/) supports visibly linking related changes. [NN/g scroll animations](https://www.nngroup.com/articles/scroll-animations/) cautions against delaying text or replaying decoration. [Proximity](https://www.nngroup.com/articles/gestalt-proximity/) informs spacing/grouping. [Apple motion](https://developer.apple.com/design/human-interface-guidelines/motion) favors purposeful, brief feedback; [WCAG2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions) supports disabling nonessential motion. These sources inform the design; none proves this exact visible-height heuristic optimal. A fixed reading-line overlay and manual date tabs were considered but add obstruction or repeated user work.
