# VIC Schedule Studio — Agent Guide

Streamer-first broadcast schedule studio for Victory: public schedule poster +
private (work/embargo) layers + monthly poster decoration/export.

**Core promise:** viewers receive ONLY public schedule data. Private, embargo, work,
owner-only, operational, and admin data must never leak into public UI or public API.

## Philosophy (immersion-first — the top tie-breaker)

When options are otherwise equal, choose the one that deepens immersion and keeps the UI
uniform. A cold "admin-panel" feel is a regression.

- **Perceived performance:** every click / save / route change / upload / unlock / export feels
  responsive — clear loading, transition, optimistic feedback, and recovery states.
- **User–system bond:** warm, trustworthy, role-aware — not a cold admin panel.
- **Playful motion:** schedule planning and poster decoration feel cute, alive, and fun without
  hurting clarity or accessibility.
- **Role-specific flow:** owner / manager / worker / developer / viewer each feel they are in the
  right place with the right tools.

(Concrete forms — design unity, no wasted space, platform-tailored, HCI — are in **Design rules**.)

## Stack & layout

- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript · Supabase (Postgres + RLS;
  service-role only server-side) · Vercel (auto-deploy on push to `main`) · tests: Vitest
  (unit) + Playwright (`tests/e2e`, `tests/visual`; also official poster PNG export).
- **Commands:** dev `next dev` · checks `tsc --noEmit` / `npm run lint` / `next build` ·
  tests `vitest run` / `npm run test:e2e`.
- **Tree** (each folder has a routing `README.md`): `app/` routes · `components/` UI ·
  `lib/` domain + data loaders/actions · `db/migrations/` SQL · `scripts/` ops · `docs/` topic tree.
- **Routes:** `/` = public poster (anon allowed). `(studio)/studio/{calendar/[year]/[month],
  decorate/[year]/[month],private-layer,tags,trusted-members}` = studio (viewer→`/` guard).
  `api/public/[calendarSlug]/*` = the public boundary (public-loader only);
  `api/{studio-write,sticker-write,unlock-private-layer,private-layer,presence,trusted-members,auth/*}`.
- Studio month routes are bookmark/cold-entry only — no runtime route-based month nav.

## Non-negotiable

1. Time is always KST (Asia/Seoul).
2. Public/private are separated **on the server** — never hide secret data with CSS.
3. Only `owner` can create / edit / delete schedules.
4. `developer` maintains the system but cannot read/create owner-only content; public API
   stays private-free for developers too.
5. Private-layer access = Google login + valid passcode unlock session.
6. Poster/export mode: no admin UI, no private badges, no edit/unlock controls; export
   surfaces use `[data-export-surface]`.

## Roles & permissions

- **Viewer** — public poster only (filters, hearts, support links, month nav). No private
  toggle, edit, or admin.
- **Worker** — view unlocked **work** schedules only (not embargo). Stickers/decoration.
  Cannot edit schedules, tags, members, passcodes, or support.
- **Manager** — **no private access at all** (no unlock button; public only). May edit support
  period/link (`canEditSupport`) and assign event tags (`canEditEventTags`, max 2). May
  decorate + export. Cannot edit schedule bodies, create/delete/recolor tags, manage
  members/passcodes, or touch owner-only.
- **Owner** (UI label "관리자", role key `owner`) — full control; may use multiple owner Google accounts.
- **Developer** — diagnostics (presence panel) + role preview (read-only, client-only, resets
  on refresh, never escalates real permissions).
- A trusted member can be manager AND worker (`is_manager`/`is_worker`); effective role =
  manager when `is_manager`.

## Visibility scopes (3)

`모두`(public) / `엠바고`(owner_private — **owner only, even developers can't read or create**;
DB value stays `owner_private`, old `embargo` merged in) / `작업자`(work).
**Read access** (private needs login + passcode): public → everyone; work →
owner/developer/worker; owner_private → owner only. Manager has zero private access.

## Invariants (high-frequency facts)

- Private-layer banner, exact: `⚠ 비공개 일정 표시 중입니다. 방송 화면 공유에 주의하세요.`
- Max 2 tags per event; a date cell shows ≤2 representative colors.
- Tag create/delete/recolor = owner/developer only.
- Support feature term = "업 도움".
- Mobile = `≤640px` (`BREAKPOINTS.mobile` / `MOBILE_QUERY`).
- Design tokens live in `app/globals.css :root` (`--space-*`/`--r-*`/`--shadow-*`/`--ease`) —
  single source of truth; always reference, never hardcode.

## Design rules (acceptance criteria for ANY UI work)

- **Two native layouts, not one scaled.** Web (`@media (min-width: 641px)`): use the horizontal
  room — multi-column, aligned table-like rows, hover lift/accent, comfortably large type.
  Mobile (`≤640px`): single column, compact, thumb targets, bottom-sheets; cut copy; never
  overflow width. Same DOM merely scaled = defect.
- **Typography:** web large/legible, mobile small (never overflow). Tune base small, bump up in
  `@media (min-width: 641px)`.
- **Design unity:** symmetric L/R padding, reused tokens/components, shared motion vocabulary.
  One-off styles, imbalance, or ragged sibling heights = defect; new UI must look native.
- **Fill empty space by content** (scale value/icon up, redistribute) — don't stretch an
  already-cramped box. Sibling cards/tiles share one height.
- **Motion & feedback by default:** `:active` scale, state transitions via `var(--ease)`,
  meaningful enter/exit; charts get centered+clamped hover value tooltips. Static = regression.
- **Haptics:** `hapticTick()` on toggles/selectors/confirms (press→server-confirm = two ticks).
- Respect reduced motion via `html[data-reduce-motion]`. The in-app toggle is the final
  authority; when the user hasn't chosen in-app, OS `prefers-reduced-motion` seeds the
  default (P1-MOTION-1). Never gate motion on the OS media query directly in CSS —
  always target `html[data-reduce-motion]`.
- **HCI:** minimize eye/pointer travel, keep related things close, preserve position across
  state changes (a loading skeleton sits where the real content will land).

## Optimistic writes & gating

- Optimistic writes go through a **serialized queue** (never raced) — the LAST action is the
  saved truth. Don't let server revalidation overwrite in-flight state. `beforeunload` warning
  only while a real write is in flight (count live ops, never a fixed timer).
- **Gate narrowly:** never disable/relabel a control from a broad flag (e.g. global `pending`) —
  a background save must not block unrelated actions (like creating a new card). Gate on the
  specific condition.

## Harness loop

- **Plan:** affected route/component, role/permission impact, public/private boundary, KST
  assumptions, per-role expected behavior.
- **Build:** narrow; follow existing patterns; **keep server permission checks** (client gates
  are never the only protection); don't make manager/worker schedule-editable unless asked;
  prefer role-specific screens over disabled owner controls.
- **Evaluate:** no private leak · owner-only stays owner-only · manager ≠ worker · viewer clean ·
  private warning clear · export has no admin UI · **regression review** (create/drag/reorder/
  save-order, optimistic-vs-server-prop sync, gating scope, nearby layout/padding) · design
  unity · platform-tailored + motion + haptics · note verification.

## Workflow

- Each change: TypeScript + lint + `next build` pass → recheck public/private boundary →
  commit & push to `main` (Vercel auto-deploys). Report the commit hash.
- Branch off `main` if not on it; commit/push only when asked or clearly expected.
- DB schema = SQL in `db/migrations/*`, applied manually:
  `node scripts/apply-db.mjs db/migrations/<file>.sql` (idempotent, reads `.env.local`).

## Repository memory (read first, write back)

세션 시작 시 SessionStart 훅이 현재 상태 + 결정 인덱스를 자동 주입한다(.claude/settings.json).
그래도 아래는 항상 유효하다:

- **작업 시작:** `docs/agent/CURRENT_STATE.md` — 현재 목표·진행중·알려진 이슈·잠긴 영역·다음 단계.
- **왜 이렇게 했나:** `docs/agent/decisions/DECISION_INDEX.md` → 해당 ADR. Accepted ADR은 조용히
  뒤집지 않는다(충돌하면 말하고 supersede — 삭제 금지).
- **어디를 고치나:** `docs/agent/PROJECT_MAP.md` (경로 → 역할 → 로컬 지침 → Risk).
- **끝났나?:** `docs/agent/DEFINITION_OF_DONE.md` (실행하지 않은 검증은 성공이라고 말하지 않는다).
- **위험 경로:** `docs/agent/domain-rules/` (SECURITY · AUTH · DESTRUCTIVE_DATA).
- **의미 있는 작업이 끝나면** `docs/agent/CURRENT_STATE.md`를 갱신한다(Stop 훅이 드리프트를 잡는다).
  되돌리기 비싼 결정이면 ADR + DECISION_INDEX 한 줄. 마이그레이션/공개 경계 변경이면 CHANGELOG_AGENT.
- L2(구조적)·L3(치명적) 작업은 구현 전에 `docs/agent/plans/ACTIVE_PLAN.md`를 채운다.
- 하네스 자체 점검: `npm run harness:verify`
- 매니페스트(명령·리스크·provenance): `agent-harness.yaml`

## Source of truth

Entering any folder, read its `README.md` first instead of bulk-reading the tree:
`docs/` (topic tree), `app/`, `components/`, `lib/` (+ `lib/schedules/`), `scripts/`, `db/migrations/`.
- `docs/sop.md` full SOP · `docs/architecture.md` architecture · `docs/security-boundary.md`
  public/private + RLS · `AGENTS.md` role guidance.

**Conflict priority:** 1) security/info boundary 2) KST 3) owner-only editing 4) role-specific
UX 5) poster/export quality 6) maintainability.
