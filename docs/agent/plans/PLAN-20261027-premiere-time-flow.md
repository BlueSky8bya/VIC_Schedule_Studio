# PC premiere time entry follow-up

Human directly requested on2026-10-27: remove the small numeric readout above the hour/minute captions, use those existing captions as an integrated `NN시 NN분` entry, and advance between parts for rapid typing. This is an explicit refinement of completed `studio-premiere:direct-hour-minute-entry`, not a newly discovered/adoption-pending idea. Original completion remains preserved. Execution mandate includes actual verification, non-author review and exact release.

## Contract

- PC only: numeric inputs live in existing wheel captions, matching cream/dark ink, scale and radius. No separate duplicated input row. The existing calendar and mouse wheels remain functional; mobile keeps its existing touch presentation.
- Two valid hour digits commit then focus/select minutes. Two valid minute digits commit then focus the existing confirmation button. Enter commits a valid single part and advances; no automatic confirmation or schedule save. Invalid/partial/empty edits never overflow into another part or date. Keep Arrow/Home/End, blur dedup, IME, nested Escape cancellation and KST wall-clock semantics.
- Existing `dtp-time-input#hour|minute` capture remains fixed, manual and deduplicated. No entered time/title/date in analytics metadata; G22 both developer views verified.
- New PC discovery is a separate phase/record. Current candidates must be observed on a pinned source/build and compared against completed/rejected/pending keys. Proposed new ideas are not implemented without adoption.

## Implementation and verification record

Direct inputs now replace the old captions and advance from hour to minute to confirmation. Confirmation remains explicit; schedule saving remains separate. A late wheel settle could restore an older minute after rapid entry: the wheel now uses the latest value/callback, cancels obsolete timers on external value changes/unmount and does not resend an unchanged value. PC caption spacing also reserves the full existing close-button area.

Baseline discovery uses deployed9e9a1953 bytes with verified build reuse. Relevant type/lint/unit/harness, immutable production-build owner1440/light + developer1920/dark actual rapid typing, caption/close-button geometry, wheel/keyboard/calendar/year-boundary/invalid/Escape/save payload and mobile390 regression provide the scoped checks. Unit fixtures also cover composing input and both developer activity components; they are not OS IME or real-account observations. Each distinct product input has its own build; test-only retries reuse verified unchanged build bytes. Original failures, intermediate builds and corrected test-oracle evidence remain preserved.

Exact receipts, non-author source/render review, commit/remote CI/provider/public confirmation and the separate three unadopted PC proposals are in the durable run `C:/Users/im917/.codex/vic-pipeline/runs/20261027-premiere-flow-discovery`. Actual release state is held by the controller and primary daily state, not inferred from this plan. No operating DB/login or full200/normal36 claim.

Current controller/primary state own progress; completed details belong in this dated record and durable run, not appended startup history.
