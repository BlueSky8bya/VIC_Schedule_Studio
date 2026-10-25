# Premiere lightstick orientation — 2026-10-26

Owner requested correction of the upside-down lightsticks in the jumping premiere audience. Continue the adopted fix through verification, independent review and deployment.

The lightstick is baked into each of the existing 16 atlas cells. Preserve the original atlas bytes, character design, ribbon attachment, frame exclusions, score/clock, jump/seat/quiet timing and local-only native buttons. A single imagegen pass restores only paper hidden beneath the original bulbs; deterministic assembly turns the original bulbs upward and preserves all decoded RGBA outside the old/new bulb footprints. The existing renderer selects the new source atlas; no new runtime layers, hands, clocks, dependencies, data or permissions.

Verify every cell's actual displayed bulb points above its attachment, inspect the rendered contact sheet, and exercise native cheering/settling/reduced/quiet interactions. Run relevant units plus required typecheck/lint/build and harness. G-22: existing native cheer action/labels are unchanged; no new event or autonomous telemetry. Public DTO/roles/private access/KST remain unchanged.

The initial runtime clipping prototype exposed transparent body holes and was discarded before integration. Its pixel checks missed this because they excluded the prop footprints; the corrected oracle also requires restored paper inside those footprints. Original prototype evidence remains in local scratch.

Status: final atlas and local required checks/independent code review complete; scoped commit and deployed source confirmation next. Scope is a topic-only rendering repair; unrelated CURRENT_STATE goals remain unchanged. Built-in generation request, original references REF-016/017, native output and deterministic derivation are separately preserved. No independent specialist art PASS or new owner visual approval is inferred from technical checks.
