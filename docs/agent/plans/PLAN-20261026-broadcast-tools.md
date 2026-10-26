# Broadcast tool widths and inline layer names

Owner2026-10-26 adopted only PC proposal1/3: `broadcast:remember-width-per-tool`, `broadcast:rename-layer-in-place`. Match the surrounding themed toolbar/layer rows. Proposal2 tag-management search is not adopted. Original proposal/evidence stays in primary daily state.

## Scope and design

- Keep separate session-only pen/highlighter/eraser base widths; shape/fill/select fallback keeps the existing pen-width family. Existing six choices, pressure and eraser/highlighter multipliers remain.
- Double-click a drawing-layer name or press F2 on its selection button to edit within the same row. Enter/blur commits a changed nonempty name; Escape cancels. Keep the thumbnail mounted, row height, themed font/material, hidden/selection state, drag order and unified undo/redo. No permanent edit button, new popup or native select.
- Names stay in existing panel memory and are discarded on unmount. No storage, URL, server, DTO, auth, KST or collection changes. Fixed rename action only; never log the entered name/layer identity. Existing width target includes pointer and keyboard operation.

## Verification / release

Local gates complete: typecheck, scoped lint,173 broadcast/security/activity units, harness and4 fresh scoped PC interactions. The final immutable build was verified and reused after test-only changes; product fixes invalidated earlier build/case reuse. Independent non-author role/boundary/UX/QA review and exact release records are retained by the daily pipeline for this run; only an actual CI/provider/public fullSHA match completes release. Preserve the three pre-existing untracked discovery tests. No full200/living-AI claims.

Review corrections: name undo changes only the name, preserving later visibility; rename focus returns in the closing layout commit rather than a delayed frame; layer name ink follows both themes; an open color picker consumes Escape before the board close handler. Keep their original failed evidence and source-review findings.

Original errors and failed attempts remain immutable. See [verification](../verification/BROADCAST_TOOLS-20261026.md) for current evidence and limits.
