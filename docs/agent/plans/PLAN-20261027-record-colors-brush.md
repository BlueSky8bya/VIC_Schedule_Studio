# Record entry, exact recent colors and mouse brush preview

2026-10-27 human adopted all3 PC proposals, with a specific refinement: use the existing schedule popover and outside-click return; do not add a “기록으로” button. Keep the recent-color controls compact, centered and themed. Authority is the current human message; this plan is a record.

## Scope

- Popular record rows reuse the public detail route, public DTO, session/history and close behavior. Keep ranking/ratios, restore record month/scroll/focus on outside click, X, Esc or Back.
- Board remembers only5 confirmed custom colors in component memory. Place a centered short row inside the existing shared picker. Unconfirmed/cancelled changes never enter history. Preserve exact HEX through HSV conversion; test the shared tag picker too.
- Mouse pen/highlighter cursor shows actual effective stroke width using a bounded SVG cursor, with the existing tool icon. Existing eraser, stylus/touch, selection, shapes and eyedropper behavior remain.
- No new API, dependency, storage, tracking payload, operating DB action, login or living-AI change. Existing fixed action target for record entry; new recent-color target carries no color/title/ID.

## Verification and release

Related type/lint/unit + one immutable production build; credential-free viewer/studio-preview PC1440/1920 light/dark interactions, narrow shared-picker regression, record outside/X/Esc/Back return,5-color order/cap/cancel, exact HEX and mouse width/other tool transitions. Preserve original discovery failures, especially HEX mismatch, and every native attempt. No full200 or normal36 claim. Non-author boundary/UX/QA review before scope-only commit/push, CI/provider and public fullSHA confirmation. Keep unrelated user files and preferred checkout QA.

Primary daily state and durable run `20261027-record-colors-brush` select current ownership/evidence. Remove active rows at completion; keep final results in the verification record.
