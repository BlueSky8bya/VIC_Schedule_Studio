# ADR-0025 — One side-panel model for studio, viewer and viewer preview

Status: Accepted · 2026-09-17 KST

## Authority and scope

The owner asked for UI unification on 2026-09-17 and answered three explicit choices: the viewer preview panel stands **outside the poster surface in one column, like the studio** (the in-surface right rail state "끔" is retired); a panel that auto-collapsed on a narrow window **floats over the calendar** when reopened instead of pushing it; the auto-collapse threshold is **1280px** and applies to the studio, the viewer preview and the anonymous public viewer alike. The `/onair` fixed scene is not a user-operated surface and keeps its always-open composition.

Supersedes the viewer's three-state avatar radio (`끔/왼쪽/오른쪽`, UI-14) and the studio's 1100px gate that moved filter/tools back into a left 188px grid column. UI-11's height contracts for the rail stay in force.

## Model

- One hook, `lib/ui/use-side-panel.ts`, is the single source of state for both shells: `side` (localStorage `vic_avatar_side`, inherited so earlier choices survive), `wide` (`PANEL_WIDE_QUERY`, `min-width: 1280px`), `open`, and `mode` = `push` when wide, `overlay` when narrow. Wide-screen collapse is remembered (`vic_panel_collapsed`); narrow-screen opening is not — a reload starts collapsed.
- One control, `components/shared/panel-place-control.tsx`: bottom-center pill `[⇤ | 패널 | ⇥]`. The middle is a toggle button. Side buttons appear only where the avatar area exists (owner/developer preview, studio); anonymous and viewer-role users get the toggle alone.
- Shell classes are shared: `avatar-scene avatar-{side}` (panel outside), `panel-open`/`panel-closed`, `panel-overlay`. Push margins apply only under `.panel-open:not(.panel-overlay)`. Closed panels slide back the way they came, then `visibility: hidden`; the aside is `inert` while closed. Overlay adds a scrim; outside click and Esc close it.
- Viewer panel column order: info/live cards, tag filter, ambient control, avatar empty area (avatar-capable only). The opposite-side thin filter rail is removed, so the calendar gains that width. The poster surface is calendar-only on desktop for everyone; `.public-right` stays in the DOM folded as the surface-geometry and SSR baseline.
- Motion: the existing sliding-door curve (0.52s ease-out entry, 0.42s exit). Under `html[data-reduce-motion]` animations use zero duration rather than `none` so re-enabling motion does not replay the entry.

## Consequences and verification

Geometry gate baseline changes intentionally: the viewer surface is now calendar-only at 1840px width in every desktop state, and stickers/decoration were already retired, so nothing drifts. `tests/visual/avatar-scene.spec.ts` covers 1920 owner/anon/fixed layouts, toggle collapse (inert, full-width stage), and 1200px auto-collapse with overlay + scrim close. Activity labels: `panel-toggle` added, `avatar-ctl-toggle` renamed to 패널 자리 바꾸기.

Revert by restoring the prior `public-poster` avatar state block and the studio 1100px gate together; the hook and control are additive and can remain.
