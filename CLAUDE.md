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
- `owner_private` ("나만") is owner-only — developers cannot read or create it.
- Manager may assign per-event tags + edit support period/link; worker cannot.
  Both may decorate (stickers). Tag create/delete/recolor is owner/developer-only.
- A trusted member can be manager AND worker at once (`is_manager`/`is_worker`);
  effective role is manager when `is_manager`.
- Mobile = `≤640px` (`BREAKPOINTS.mobile` / `MOBILE_QUERY`); on mobile, cut copy
  and controls — don't just shrink them.
- Visible owner role label is "관리자" (the role key stays `owner`); the support
  feature term is "업 도움".

## Role Guide

### Viewer

- Views public schedule/poster only.
- Can use public interactions such as filters, hearts, support links, and month
  navigation.
- Cannot see private toggle, private data, edit tools, or admin tools.

### Worker

Creative-production collaborator, such as outfit, art, visual asset, or sticker
work.

- Can view unlocked embargo/work schedules.
- Can handle visual materials, stickers, and poster decoration.
- Cannot edit broadcast schedules, tags, members, passcodes, support period/link,
  or owner-only schedules.

### Manager

Broadcast-operations helper, such as stream, chat, or community manager.

- Can view unlocked embargo/work schedules.
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
