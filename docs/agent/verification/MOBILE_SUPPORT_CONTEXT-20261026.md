# Mobile period/support context — 2026-10-26

The owner adopted the cozy contextual design for actual mobile schedules. This implementation replaces repeated period/support cards with one shared sticky notice board in public, anonymous, preview and studio agendas. Ordinary broadcasts retain their existing width. Desktop calendar bands remain unchanged.

## Behavior and boundaries

- Full original titles wrap without truncation. Period and support kinds use separate icons/colors; the selected notice exposes its real range and existing detail/edit/link actions. A single-day notice has no redundant range line.
- The board follows the leading visible date after180ms of scroll idle. At the document end it follows the final visible date. Unrelated titles remain available; focus on a footer action prevents automatic retargeting, and focused title rows are preserved across groups.
- The maximum title-stack height among the month's overlapping groups and one shared footer are reserved. This intentionally leaves spare space for smaller groups; changing context does not change calendar flow. Highlights and internal details use the existing520ms `flipSpring`. App reduced-motion preference is authoritative.
- Studio retains the existing masked teaser card and password/edit gate for unreleased support notices. Released teasers enter the board through an explicit minimal projection. Public notices still exclude unreleased teaser data. No loader/API/role/RLS/authentication changes or database writes.
- Manual controls use fixed targets `agenda-support-select`, `agenda-support-detail`, existing `agenda-link` and `m-support-edit`. Their labels use the shared activity dictionary for timeline/usage views. Automatic context, measuring and animation emit no human activity; existing automation guards remain.

## Verification record

Execution checkout: named `codex/mobile-period-ux`; product base fast-forwarded from229749ce to already released0eb79bc3 without changing that session's rotor-lighting work. The mobile implementation bytes did not change during that integration.

- Production build, explicit typecheck and full lint: exit0 on the integrated candidate.
- Full unit run before that unrelated integration:437 files passed;7,118 tests passed,1 pre-existing native-cache cleanup test skipped because an active process was detected,0 failed. The skip is not a mobile coverage claim.
- Original concurrent runs remain preserved: one15s art-catalog timeout, then three failures during a parallel retry;44 isolated rerun cases and the subsequent bounded full run passed without changing any timeout or oracle. A typecheck attempted during a `.next` rebuild failed with missing generated files; the stable-build retry passed.
- The24 new notice tests cover KST/month overlap, date boundaries, immutable grouping, missing/equal single-day dates, teaser exclusion and safe links.
- Rendered integrated production-build mobile suite:13/13 passed. Both320/390px cover anonymous/signed-in/owner/developer/preview, app reduced motion and focused-link context; an additional case checks the masked support password gate for both editor roles. All three full titles remain readable, board height231.34px, no actual title/heart overlap or horizontal overflow,0 browser errors and0 attempted mutations. Three selections per role are sampled for650–665ms each; schedule coordinates/width/height and scroll drift remain below0.5px. Scroll, single-day text, mobile detail close and exact opener focus return pass.
- Independent non-author source review accepted the final initial-date, focused-row/footer, bottom-date and teaser-mask changes with no remaining findings. Rendered QA was authored and executed by a separate agent; native390px and320px images were also visually inspected by the parent.
- Existing desktop export/admin-boundary regression:1/1 passed. The desktop pixel baseline still fails against its stored image (1440×1113 expected,1408×1112 actual,16,325 pixels/about2%). A separate named, clean0eb79bc3 worktree was production-built and ran the original strict test: it reproduces the same failure. Before/candidate actual PNGs have identical SHA256 `9b6a5a12514dca451724eb6ffda95600772570110aa4e9fff66e034b735c526d` and0 changed pixels. This is a pre-existing baseline mismatch; neither the oracle nor baseline was changed. Both original results are preserved.

Original UI failures led to actual corrections: initial visible-date synchronization, footer opener focus restoration, preserving focused titles, hidden support editing/masking, and final-day detection at the document bottom. Harness-only corrections identify exact read-over-POST actions and distinguish occluded card rectangles from actual visible overlap; actual writes remain blocked.

Durable evidence and exact release truth: `C:/Users/im917/.codex/vic-pipeline/runs/20261026-mobile-cozy/`. This includes source pins, executed checks, original failure pointers, independent review, CI/provider/public readback and the coordinator journal. This document alone is not deployment confirmation.

Coverage is responsive Chromium with synthetic public/studio fixtures at320/390px, not physical iOS/Android or genuine-login/RLS certification. Month/filter source reuse is reviewed; no new comprehensive month/filter matrix or assistive-technology certification is claimed. Existing broader checks remain in OPEN_CHECKS.
