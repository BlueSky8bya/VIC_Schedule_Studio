# R79 — Showcase input isolation

Owner reported hidden studio buttons activating when clicking the ambient background, discovered after leaving showcase. Requested diagnosis, fix and push; includes prior concise loading-copy change.

## Cause and fix

Existing showcase CSS hides studio/viewer chrome using parent opacity and `pointer-events:none`. Descendants such as tag filters explicitly set `pointer-events:auto`, making invisible controls hit-testable. Reproduced on the studio fixture: a real coordinate click over the hidden first tag filter incremented its click listener. Regression test failed before the fix.

`ShowcaseExit` now uses a layout effect to make other body children inert while its body portal is active. This disables hidden pointer and keyboard interactions without blocking the ambient engine's global pointer listeners or showcase controls. A body child observer also isolates later portals. Cleanup restores each element's prior inert state before restoring entry focus. No runtime background/art changes. Public DTO, role permissions and KST unchanged.

Loading message is a single `목적지로/으로 이동중..` line; the explanatory second line is removed. Arrival and error messages retain their established behavior.

## Verification

Typecheck, lint and production build passed. All five production-fixture Playwright showcase tests passed (34.5s): hidden tag-filter click prevention, press/Escape/release prevention, later portal isolation and original inert restoration, normal controls after exit, environment reset, interaction during asset loading, immediate mouse/keyboard entry navigation and focus restoration. The regression failed against the prior build and passed with this fix. Global engine pointer listeners are unchanged; exhaustive interaction with every seasonal particle is not covered. User authorized push; deployment remains unverified.
