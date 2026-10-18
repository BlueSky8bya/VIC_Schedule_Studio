#102 — Header buttons and build badge

Date:2026-10-18 KST. Status:local verification complete; authorized correction release pending.

## Current request

Restore the previous soft button design instead of the newly hard rectangular controls; audit related studio/viewer/preview chrome for consistency. Move the deployment badge out of the header to a small PC-only bottom-left position below the calendar. In narrower owner/developer desktop layouts, the companion-home launcher takes the vacated header-left position. Do not reserve extra calendar/document space or expose studio chrome publicly.

## Boundaries

UI/CSS and verification only. Keep server DTOs, owner/developer/viewer authority, preview read-only behavior, auth/unlock, KST, serialized saves and analytics identifiers unchanged. Preserve mobile settings/logout alignment and companion exclusion. Use actual topology, shared header/panel tokens, existing spring/press/reduced-motion rules and zoom-aware geometry. Preserve user art and post-release evidence.

## Implementation and verification

1. Inspect relevant button history and current cascade. Restore the existing soft inset account/tool controls by correcting unintended specificity; retain standalone shared44px pill controls and semantic primary/danger distinctions.
2. Keep one copyable build badge with its existing action identifier, outside the header/calendar capture surface and below modal chrome. Remove the mobile badge. Keep the shared home launcher at the actual header-left start with no duplicate or reserved badge width.
3. Independently review changes before integration. Run typecheck/lint/unit/build/harness and production-build fixture interactions for owner/developer, viewer/anonymous/preview, light/dark, compressed desktop, zoom and touch/mobile. Stub public preview reads and block writes; no production schedule mutation.
4. Update intentional screenshot baselines only after before/after inspection. Verify authorized continuation release with exact commit/CI/provider SHA and actual production UI; do not claim deployment before those checks.

## Current findings

The studio calm broad neutral-button selectors acquired a `:not(.vc-home-launcher)` specificity increment, defeating the already-established transparent12px card-control exception. A specificity-neutral exclusion restores that earlier design while retaining the shared home control. Public standalone controls and mobile pills already use their intended shared materials and should not be flattened into the card-internal style.

Narrow developer preview testing required a fixture correction: automatic menu-item scrolling had already changed the source position before preview entry. Passive return events alone initially misidentified that as a return defect. Entry/control-step evidence and actual viewport-bound menu-center clicks resolved the distinction. Keep the original strict geometry/scroll assertions and native Back coverage; do not add product scroll restoration or change history depth/global restoration behavior for this fixture artifact.

Current implementation/check results will be recorded in the [verification](../verification/HEADER_BUTTON_CONSISTENCY-20261018.md).

## Local result

Shipping product build `zntlRDOg6wtGcrUiMONBd`:211 unit files/2,168 tests, typecheck, full lint, production build and harness264 PASS. One final native run passed all38 cases without snapshot updates. Four intentional studio entry/heading baselines were inspected before/after. Independent final review confirms no remaining P1/P2 and no provisional scroll/diagnostic code. Next:exact staging, commit/push, CI/provider/full deployed SHA and actual UI verification.
