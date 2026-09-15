# R68 — Immediate keyboard navigation on showcase entry

2026-09-16 KST. Owner reported needing one background click before arrow navigation.

Cause: focus remained on the entry button, while ShowcaseExit intentionally excludes buttons and form controls from biome keyboard navigation. Entry now focuses a named, programmatically focusable viewing region; exit/unmount restores the connected entry target without scrolling. Existing settings input/radio key handling, Esc layers, navigation loading queue, scene drawing, roles and KST remain unchanged. Owner authorized push to main on 2026-09-16; deployment unverified.

Verification: typecheck/lint/build passed; 11 date/navigation unit tests passed. Four production-build Playwright tests passed: existing environment reset and pending-art calendar interaction, plus mouse and Enter entry followed immediately by ArrowRight without a background click, settings slider retaining focus without biome travel, two-stage Esc and entry-button focus restoration. B independent review found no blocking focus/lifecycle issue. Fixture role was developer; viewer shares the same component but was not separately exercised this round.
