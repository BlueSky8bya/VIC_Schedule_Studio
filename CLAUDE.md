# VIC Schedule Studio - Claude Harness

## Product Purpose

VIC Schedule Studio is a streamer-first schedule studio for Victory.

This is not a generic calendar. It is a broadcast operations tool for planning
public schedules, safely managing private work/embargo layers, decorating monthly
calendar posters, and exporting viewer-friendly schedule images.

The product is built around **immersion**:

- **Perceived performance**: every click, save, route change, upload, unlock, and
  export should feel responsive through clear loading, transition, optimistic
  feedback, and recovery states.
- **User-system bond**: the app should feel warm, trustworthy, and aware of each
  user's role, not like a cold admin panel.
- **Playful motion**: animation should make schedule planning and poster
  decoration feel cute, alive, and fun without hurting clarity or accessibility.
- **Role-specific flow**: owner, manager, worker, developer, and viewer should
  each feel they are in the right place with the right tools.
- **Design unity**: keep one visual language across the whole app — consistent
  spacing, symmetric left/right padding, a shared motion vocabulary, reused
  tokens/components. **Imbalance is the worst** (mismatched paddings, ad-hoc
  one-off styles, inconsistent button shapes) — treat it as a defect, not a
  minor detail. New UI must look like it was always part of the app.

- **HCI fundamentals**: UI/UX must honor Human-Computer Interaction basics —
  minimize eye and pointer travel, keep related things spatially close, and
  **preserve position across state changes** (e.g. a loading skeleton should sit
  where the real content will land, so the eye doesn't jump on load). Respect
  Fitts's/Hick's law; never make the user hunt.

- **No wasted space**: every card, tile, and panel should feel *filled*, not
  hollow. A big card holding one small number with empty margins is a defect —
  fill it (scale type up, distribute content top-to-bottom, or rethink the
  layout). Sibling cards/tiles should share one height (don't let ragged
  heights or stray empty bottoms creep in). Density over emptiness — but never
  cramped; balance fill with the breathing room the rest of the app uses.

User immersion is the top tie-breaker: when options are otherwise equal, choose
the one that deepens immersion and keeps the UI uniform. A cold "admin panel"
feel is a regression.

Core promise:

> Viewers must only receive public schedule data. Private, embargo, work,
> owner-only, operational, and admin data must never leak into public UI or
> public API responses.

## Non-Negotiable Rules

1. Time is always KST / Asia/Seoul.
2. Public and private data are separated on the server. Do not hide secret data
   with CSS.
3. Owner is the only role that can fully create, edit, and delete schedules.
4. Developer maintains the system, but owner-only schedule content stays
   owner-only.
5. Manager is a broadcast-operations helper.
6. Worker is a creative-production collaborator.
7. Viewer sees only the public poster/calendar experience.
8. Private-layer access requires Google login plus a valid passcode unlock
   session.
9. Poster/export mode must be clean and must not include admin UI.
10. Viewer mode is cute, clean, and poster-first. Studio mode is practical.
    Private-layer mode is warning-heavy.

## Always-On Invariants (quick reference)

High-frequency facts so you rarely need to reopen `docs/sop.md`:

- Private-layer banner text, exact: `⚠ 비공개 일정 표시 중입니다. 방송 화면 공유에 주의하세요.`
- Max 2 tags per event; a date cell shows at most 2 representative colors.
- **Visibility scopes = 3: 모두(public) / 엠바고 / 작업자(work).** The owner's picker
  offers only these three. "엠바고" is the merged owner-only scope (DB value stays
  `owner_private`; the old `embargo` scope was merged into it) — **owner-only, even
  developers cannot read or create it**. "작업자"(work) is the worker layer.
- **Who can read each scope** (private needs Google login + passcode unlock):
  public → everyone; 작업자(work) → owner, developer, worker (a manager+worker dual
  via `isWorker`); 엠바고(owner_private) → owner only. **Manager has NO private
  access at all** — no unlock button, sees only public.
- Manager may assign per-event tags + edit support period/link; worker cannot.
  Both may decorate (stickers). Tag create/delete/recolor is owner/developer-only.
- A trusted member can be manager AND worker at once (`is_manager`/`is_worker`);
  effective role is manager when `is_manager`.
- **mobile is compact-first** Mobile = `≤640px`
  (`BREAKPOINTS.mobile` / `MOBILE_QUERY`). On mobile, *cut* copy and controls —
  shorten labels, drop helper/parenthetical text, hide non-essential buttons.
  Never just shrink the desktop layout. When adding text, ask "does this earn its
  width on a phone?" — if not, trim or hide it.
- **Web vs mobile typography (recurring).** The desktop/web has room — its text
  must be comfortably **large and legible**, never the tiny mobile-tuned sizes.
  Mobile is the opposite: text must stay **compact and must NEVER overflow the
  narrow width** — do not blow up mobile font sizes. Practically: tune base
  (mobile) sizes small, and bump up generously inside `@media (min-width: 641px)`
  for the web. If web text looks small, it's a defect.
- **Platform-tailored, never just-shrunk (recurring — the owner re-asks this
  constantly).** Every surface must earn a *distinct* web and mobile treatment.
  Web = use the horizontal room: multi-column dashboards, aligned table-like rows,
  hover affordances (row highlight, accent bars, lift). Mobile = compact, single
  column, thumb-friendly targets, tap/active feedback, bottom-sheet patterns. A
  responsive layout that is the same DOM merely scaled is a defect — see the
  **Platform-Tailored Experience skill** below before building/finishing any UI.
- **Fill empty space by content, not by stretching narrow boxes.** When a box
  feels empty, the fix is bigger content (scale the value/icon up), a smarter
  layout, or distributing content — **only widen a box that is genuinely empty on
  one side** (e.g. a wide box with content clustered left and a blank right).
  Never stretch an already-cramped box wider; that makes it worse. Sibling
  cards/tiles share one height; no ragged heights or stray empty bottoms.
- **Hover tooltips/value chips are centered on their target and never clipped.**
  Center the chip over the hovered bar; clamp it within the chart so edge bars
  don't get cut off; never wall-stick (left/right-pin) when there is room to
  center. A clipped or wall-stuck tooltip is a defect.
- Visible owner role label is "관리자" (the role key stays `owner`); the support
  feature term is "업 도움".
- **Optimistic writes are queued, not raced.** Rapid repeat actions (drag-move,
  reorder, repeated saves) must persist through a *serialized queue* so the
  **last** action is the saved truth — never "whichever request reaches the
  server first." Don't let server revalidation (fresh props) overwrite in-flight
  optimistic state. Warn on unload (`beforeunload`) only while a critical write
  is genuinely in flight (count real in-flight ops; never a fixed timer).
- **Gate UI affordances narrowly.** Never disable/relabel a control from a broad
  shared flag (e.g. a global `pending`): a background save must not block
  unrelated actions like creating a new card. Gate on the specific condition.

## Platform-Tailored Experience (standing skill)

The owner repeatedly asks for this; treat it as a default acceptance criterion,
not a one-off request. When you build or touch ANY interactive surface, deliver a
**web-native** and a **mobile-native** version (distinct layout, not the same DOM
scaled) plus **motion, tactile feedback, and immersion** on every affordance.
Run this checklist before calling UI work done:

1. **Two real layouts.** Decide the web shape and the mobile shape separately.
   - Web (`@media (min-width: 641px)`): fill the horizontal room — 2-column
     dashboards, aligned table-like rows, inset panels, zebra, hover row
     highlight / left accent bar / card lift. Type comfortably large.
   - Mobile (`≤640px`, `MOBILE_QUERY`): single column, compact, thumb-zone
     targets, bottom-sheet / segmented patterns. Cut copy (drop parentheticals,
     shorten labels, hide non-essential controls). Never overflow the width.
   - If the only difference between platforms is font size, it is not done.
2. **Motion & feedback by default.** Every button/toggle/card gets press feedback
   (`:active` scale), smooth state transitions (background/color/box-shadow via
   `var(--ease)`), and meaningful entrance/exit animation (e.g. options expanding,
   rows collapsing on delete). New charts get hover value tooltips
   (`.vt-tip`, centered + clamped, never clipped). Static = regression.
3. **Haptics on intent.** Call `hapticTick()` on toggles/selectors and key
   confirmations (press→server-confirm = two ticks; see haptics convention).
4. **Distinctive, not generic.** Replace plain native controls (`<select>`,
   bare lists) with the app's own affordances — color-coded cards, role-tinted
   pills, icons — consistent with neighbors (one visual language, symmetric
   padding, shared tokens). A cold "admin panel" look is a regression.
5. **Respect constraints.** `prefers-reduced-motion: reduce` must disable the
   animations. Keep server permission checks and the public/private boundary
   intact. Verify against the Evaluator + regression-review steps below.

Reference implementations to match: developer insights visit panels
(`.vpanel`/`.dayvisit` 2-col grid, `.vlog` session-log feed, `.dsess` bars,
`.scope-picker` cards) and the mobile edit bottom-sheet (`me-*`).

## Role Guide

### Viewer

- Views public schedule/poster only.
- Can use public interactions such as filters, hearts, support links, and month
  navigation.
- Cannot see private toggle, private data, edit tools, or admin tools.

### Worker

Creative-production collaborator, such as outfit, art, visual asset, or sticker
work.

- Can view unlocked **"작업자"(work)** schedules only (not 엠바고/owner-only).
- Can handle visual materials, stickers, and poster decoration.
- Cannot edit broadcast schedules, tags, members, passcodes, support period/link,
  or owner-only schedules.

### Manager

Broadcast-operations helper, such as stream, chat, or community manager.

- **Has no private-layer access at all** — no unlock button; sees only public
  schedules (the broadcast-ops helper doesn't need hidden plans).
- Can edit a support event's period/link (`canEditSupport`).
- Can assign/unassign an event's tags (`canEditEventTags`, max 2 per event).
- Can decorate (stickers) and export posters.
- Cannot edit normal schedule bodies; cannot create/delete/recolor tags; cannot
  manage members or passcodes; cannot touch owner-only schedules.

### Owner

Victory / streamer.

- Can manage schedules, tags, members, private passcode, poster theme, stickers,
  support items, and owner-only schedules.
- Can use multiple configured owner Google accounts when the environment allows
  it.

### Developer

Platform/system maintainer.

- Can debug and maintain the system.
- Can use developer-only diagnostics (live presence panel) and role preview (view
  as owner/manager/worker/viewer). Role preview is read-only, client-only (no route
  or cookie change, resets on refresh), and never escalates real permissions.
- Must not gain access to owner-only schedule content unless the product rule
  explicitly changes.
- Public API behavior must remain private-free for developers too.

## Harness Loop

Use a planner, builder, and evaluator loop for meaningful work.

### 1. Planner

Before implementation, identify:

- affected route/component
- role and permission impact
- public/private data boundary
- KST assumptions
- expected viewer, owner, manager, worker, and developer behavior

### 2. Builder

Implement narrowly.

- Follow existing app patterns.
- Keep server permission checks.
- Do not add client-only permission gates as the only protection.
- Do not make manager/worker schedule-editable unless explicitly requested.
- Prefer role-specific screens over showing disabled owner controls to everyone.

### 3. Evaluator

Check before finishing:

- no private data leakage
- owner-only content remains owner-only
- manager and worker behavior are distinct
- viewer mode remains clean
- private-layer warning is clear
- poster/export output has no admin UI
- perceived performance and motion states are purposeful
- **regression review**: after any structural change, re-verify that prior
  features still work under the new structure — create / drag / reorder / save
  ordering, optimistic-vs-server-prop sync, button enabled-state scope, and the
  layout/padding of nearby surfaces you touched. A change is "done" only once
  you've confirmed it didn't quietly break or unbalance an existing flow.
- design unity holds: spacing/padding symmetric, styles consistent with
  neighbors, no one-off imbalance introduced
- **platform-tailored experience**: web and mobile each got a distinct,
  appropriate layout (not the same DOM scaled), and every interactive element has
  motion + tactile feedback + (where relevant) haptics — see the
  **Platform-Tailored Experience skill** above
- tests or manual verification are noted

## Workflow

- Ship each change: TypeScript + lint + `next build` pass, recheck the public/private
  boundary, then commit and push to `main` (Vercel auto-deploys). Report the commit hash.
- Branch off `main` first if not already on it; commit/push only when asked or clearly expected.
- DB schema changes are SQL files in `db/migrations/*`, applied manually:
  `node scripts/apply-db.mjs db/migrations/<file>.sql` (idempotent, reads `.env.local`).

## Source of Truth

- `CLAUDE.md`: short always-on product rules and agent harness.
- `AGENTS.md`: agent role guidance.
- `docs/README.md`: **doc routing index — read first when entering `docs/`** (marks each doc
  canonical vs plan vs report vs stale so you don't bulk-read). Folder routing READMEs also exist
  for `app/`, `components/`, `lib/` (+ `lib/schedules/`), `scripts/`, `db/migrations/` — open the
  folder's `README.md` first to find what you need instead of bulk-reading the tree.
- `docs/sop.md`: full Korean product SOP and detailed operating rules.
- `docs/architecture.md`: architecture and data boundaries.
- `docs/security-boundary.md`: public/private and RLS expectations.
- `docs/*report*.md`: UX audits, plans, and research reports.

When documents conflict, follow this priority:

1. Security and information boundary
2. KST correctness
3. Owner-only editing
4. Role-specific user experience
5. Poster/export quality
6. Maintainability
