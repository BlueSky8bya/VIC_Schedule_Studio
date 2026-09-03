# VIC Schedule Studio — Agent Guide

Streamer-first broadcast schedule studio for Victory: public schedule poster + studio editor +
teaser (최초공개) gate + broadcast drawing board. (Poster decoration/stickers, PNG export, and the
worker role were retired — ADR-0014/0015, 2026-08-27.)

**Core promise:** viewers receive ONLY public schedule data. Private, embargo, work,
owner-only, operational, and admin data must never leak into public UI or public API.

## Philosophy (immersion-first — the top tie-breaker)

When options are otherwise equal, choose the one that deepens immersion and keeps the UI
uniform. A cold "admin-panel" feel is a regression.

- **Perceived performance:** every click / save / route change / upload / unlock / export feels
  responsive — clear loading, transition, optimistic feedback, and recovery states.
- **User–system bond:** warm, trustworthy, role-aware — not a cold admin panel.
- **Playful motion:** schedule planning and the poster feel cute, alive, and fun without
  hurting clarity or accessibility.
- **Role-specific flow:** owner / developer / viewer each feel they are in the
  right place with the right tools.

(Concrete forms — design unity, no wasted space, platform-tailored, HCI — are in **Design rules**.)

### Owner-fit palette rule (오행 레이어, 2026-09-03)

The owner's personal-fit analysis (details: `docs/ux/saju-redesign-direction.md`; the source notes
and the natal chart are **local-only, never committed or shown in any UI/API**) yields one standing
design rule for owner-facing surfaces (studio first, poster only as brand tone):

- **금생수 (metal → water), ADR-0016 (2026-09-03).** *Work* elements — edit popover, 업 도움/기간 안내
  bands, buttons, tiles, chips, event-card edges — are **metal (金)**: hairline `--gs-metal-line`, one
  top sheen line, small radius `--gs-metal-radius`, slate ink `--gs-metal-ink`, engraved band text.
  *Containers* — page ground, poster surface, calendar cells, weekday header, panels, top chrome — are
  **water (水)**: `--gs-water-glass`, large radius `--gs-water-radius`, low-contrast `--gs-water-line`,
  inner glow. Metal begets water: every water container has a metal hairline edge; a metal element may
  hold water inside (저장 = silver frame, water-tinted face). Tokens in `app/metal-water.css`; studio
  rules under `html[data-studio-calm]` (studio-calm-layer.css ④), viewer rules in
  `poster-metal-water.css` (default look, also the studio preview/export). Tag colours, the 8 semantic
  colours, hearts and all geometry stay untouched. Never amplify red/orange/yellow as new accents on
  owner screens.
- **Direction → screen.** North = top (month nav, header) = water; West = left (filter panel) =
  silver; Center = calendar body = warm; South = bottom, East = right: no new hot accents there.
- **One primary action per context, water-colored: 저장.** Calendar cells and cards are
  selection targets, not CTAs. Place by Fitts/thumb-zone first, then color.
- **Editor popover opens to the LEFT of the selected cell** (2026-09-04, owner HCI feedback): schedules are
  edited in date order, and a right-side popover covered the next day's cell, costing an extra dismiss click
  every time. Flip to the right only when the left has no room (Sunday/Monday cells). Keep this in
  `placeEditorPopover` (`components/studio/studio-shell.tsx`).
- **Never use clashing ("극") colors or awkward placement as deliberate stress.** Tension only
  through the existing warning system for real errors/unsaved changes.
- **Calm over noise, not dull.** Reduce decorative repetition in the studio (sparkle off in calm
  mode) but keep playful, meaningful motion (save ripple, spring transitions).
- These rules sit *below* HCI/accessibility (WCAG AA after the eye-comfort filter), the 8 fixed
  semantic colors (업 도움 rose · 기간 안내 cyan · 일정 편집 violet · 신규 green · 오늘 gold ·
  미정 orange · 떡밥 violet ring · 다시보기 forest blue), and the public/private boundary.
- Implemented as the `html[data-studio-calm]` theme — **always ON since 2026-09-04** (the owner found the
  toggle meaningless: "off just looks slightly darker"; the switch was removed, the pre-paint script always
  sets the attribute, CSS unchanged). New owner-screen UI should read its colors from `--studio-*` tokens
  under that attribute.
- **Chrome placement (배치 대개편, 2026-09-03).** Studio web chrome is ONE north row: title · month nav ·
  save state · role badge · viewer preview · logout (owner-specified order). Cold tools (태그 편집 · 인사이트 ·
  단축키 · **설정**) live in the **west rail tools card** under the tag filter (`.studio-tools`). **설정 (gear) is
  the single settings hub** (2026-09-04): every switch/preference (생동감 있는 동작 · 눈 편한 테마 · 계절 배경 ·
  배경 효과 · 포스터 테마, and anything new; 차분한 편집실 was removed the same day — always ON) goes into `components/studio/studio-settings.tsx`
  (`StudioSettingsList`) — never back into the role badge popover on web (mobile reuses the same list inside
  the role badge because it has no tools card). It opens as a **modal window** (`modal === "settings"`, same
  infra as 태그 편집/인사이트: history slot, focus trap, scroll lock, backdrop/Esc close) — owner said no
  popovers for it. The avatar
  left/right control is a **fixed bottom-center pill** (`.bottom-float-row`) — never inside the rail,
  because the rail moves to the other side and the control would travel with it (owner feedback
  2026-09-03). Do not reintroduce a second full-width action row —
  the calendar (hot zone) owns that height. The rail's vertical budget is filter | tools | avatar 58%.
- **Ambient registry (ADR-0017, 2026-09-04, revised same day).** Studio and viewer mount ONE
  `<AmbientLayer month={view.month} />` (`components/shared/ambient/`). The season follows the **calendar
  month being viewed**, not today: 12–2 winter · 3–5 spring · 6–8 summer · 9–11 autumn (flip a month, the
  background flips). **The water tide belongs to summer only.** Spring/autumn/winter are **interactive canvas
  scenes** (revision 2, same day: `season-canvas.tsx` + `scene-engine.ts` + `scenes/*`), all in the same
  **top-down view** as the tide: winter = snow field + walked footprints + landing flakes, click the ground →
  footprints + snow puff; autumn = abundant desaturated brown/wine leaves (never red/orange/yellow) with physics
  (collisions, ground friction, gusts, pointer wind, grab-and-drag); spring = lawn + clover/daisies + butterflies
  (shadow, flee from pointer, click → petal burst). Apple-feel, cute, 오행 palette kept. Switch "계절 배경"
  (`vic.ambient`, default ON): **OFF = everything down, tide included** (the tide is summer's, never a fallback).
  Every season answers the mouse: summer ripples (a canvas over the tide), spring butterflies flee and later land
  on daisies, autumn leaves blow (7 species: round · elm · willow · maple · ginkgo · oak · pine needles, muted
  colors), winter kicks up snow dust while an invisible walker keeps leaving boot prints. Special days go into
  `SPECIAL_DAYS` in `registry.ts` (real KST date, priority over season). Engine rules: sprites/ground baked once,
  per-frame drawImage only, dynamic import, loop stops when hidden/off, self-governor (late frames > 20% → fewer
  particles, never below a visible floor), **zoom-aware sizing** (canvas = `offsetWidth`, pointer ÷ zoom — the
  studio shell is zoomed ≥1700px); tide rules unchanged (transform/opacity only, no filter/blur/scale animation,
  no dark blobs). Never mount `<WaterTide />` directly again; never add a second background system
  (the old `data-poster-theme` 7-pack coexists for now and is slated to be superseded).
- **Graphics tiers (`lib/ui/gfx.ts` v3, 2026-09-04).** `data-gfx` is `full` (absent) · `lite` · `soft`. `soft` =
  software rendering (WebGL renderer SwiftShader/llvmpipe/software) or ≤2 cores → ambient off + eye-comfort token
  palette. `lite` = bad frame samples on **two consecutive visits** → ambient stays **visible but cheaper** (tide
  one caustic layer, canvas particles halved), root filter kept. Never hide the ambient on a single bad sample
  (streaming PCs jitter under OBS load — Tori's "tide vanished after a few seconds" was exactly that). Settings
  "배경 효과" (`vic.gfxPref` auto/max/lite/off — `off` hides the ambient only and keeps the eye-comfort filter)
  overrides the judgement; an automatic demotion fires `vic:gfx-auto` and the studio toasts it. **`lite` must keep
  every season recognizable** — it only trims cost per scene (summer: one caustic layer, static swells, half the wake,
  click ring ×1 · spring: one butterfly, no pointer reaction · autumn: 30–60 leaves, weak/rare gusts · winter: fewer
  flakes, no walker/dust); a `lite` that shows a plain background is a bug (2026-09-04: stale `:not([data-gfx="lite"])`
  gates made the shell opaque — every transparency/translucency gate must use `soft`/`off`/`data-ambient="off"`, never
  `lite`). The 계절 배경 switch and 배경 효과 are one state: switch OFF locks the select to 끄기, picking 끄기 turns the
  switch OFF, switching back ON returns the select to 자동. "배경 감상" (`components/shared/ambient/showcase.tsx`,
  entry buttons in the studio avatar slot and the viewer rail, plus the settings row) sets `html[data-showcase]` to
  hide all chrome and let the whole screen act as background; Esc or the top pill exits.
- **Ambient pauses behind heavy media** (`lib/ui/ambient-pause.ts`, `html[data-ambient-pause]`): the VOD window, the
  viewer insights sheet and studio modals (except settings) hold the pause; the canvas loop stops on its last frame and
  the tide's animations pause. Never leave a full-screen animated layer running under a `backdrop-filter` or an iframe
  player (2026-09-04: VOD playback stuttered). No always-on rAF loops in the poster — drive follow/measure logic by
  scroll/resize/ResizeObserver events.
- **Viewer chrome groups and tiers**: header buttons live in uniform 36px segmented cards (login/logout, preview nav,
  avatar toggle) and the center trio is one 44px height; `html[data-pchrome="1|2|3"]` (measured in
  `public-poster.tsx`) folds labels → sparkles → title size when the header overflows or overlaps the overlays.
- **Settings dropdowns are the custom `RhhSelect`** (`components/studio/rhh-select.tsx`: trigger + body-portal
  listbox in the metal skin, keyboard-navigable) — never a native `<select>` in the settings list (its popup cannot be
  styled). Settings epoch `2026-09-04` reseeds the four switches (motion · eye-comfort · calm ·
  ambient) to ON once; only values touched afterwards persist.
- **Tide layer.** `.gs-tide` (`components/shared/water-tide.tsx`, shared by studio and viewer poster;
  CSS in `app/metal-water.css`) — shallow-water caustics seen from above: thin bright cell network from
  an SVG noise contour, drifting/skewing/breathing via transform+opacity only (filters rasterize once;
  never animate scale, never blur/blend the layers — both cost frames). Shows only with 생동감 있는 동작
  ON ∧ `data-gfx≠soft` ∧ 계절 배경 ON ∧ web width (`data-gfx="lite"` keeps it visible with one caustic layer);
  the calm palette is unrelated to the water.
  The studio instance is brighter than the viewer's (`.studio-shell .gs-tide*` overrides). It is the
  only ambient animation; add nothing louder. Never give `html` a background — it stops body's canvas
  propagation and paints over negative-z layers.

## Stack & layout

- **Stack:** Next.js 15 (App Router) + React 19 + TypeScript · Supabase (Postgres + RLS;
  service-role only server-side) · Vercel (auto-deploy on push to `main`) · tests: Vitest
  (unit) + Playwright (`tests/e2e`, `tests/visual`).
- **Commands:** dev `next dev` · checks `tsc --noEmit` / `npm run lint` / `next build` ·
  tests `vitest run` / `npm run test:e2e`.
- **Tree** (each folder has a routing `README.md`): `app/` routes · `components/` UI ·
  `lib/` domain + data loaders/actions · `db/migrations/` SQL · `scripts/` ops · `docs/` topic tree.
- **Routes:** `/` = public poster (anon allowed). `/onair` = broadcast preview (anon, avatar scene
  fixed). `(studio)/studio/{calendar/[year]/[month],tags}` = studio (viewer→`/` guard).
  `api/public/[calendarSlug]/*` = the public boundary (public-loader only);
  `api/{studio-write,unlock-private-layer,presence,activity,soop-live,broadcast,cron,auth/*}`.
- Studio month routes are bookmark/cold-entry only — no runtime route-based month nav.

## Non-negotiable

1. Time is always KST (Asia/Seoul).
2. Public/private are separated **on the server** — never hide secret data with CSS.
3. Only `owner` can create / edit / delete schedules.
4. `developer` maintains the system but cannot read/create owner-only content; public API
   stays private-free for developers too.
5. Private-layer access = Google login + valid passcode unlock session. (Studio UI for viewing
   private layers / picking a scope was retired 2026-08-27 — ADR-0014; the server model stays,
   new events are always public, the passcode now serves the teaser (최초공개) gate + change only.)
6. Poster/export mode: no admin UI, no private badges, no edit/unlock controls; export
   surfaces use `[data-export-surface]`.

## Roles & permissions

- **Viewer** — public poster only (filters, hearts, support links, month nav). No private
  toggle, edit, or admin.
- **(Manager — retired 2026-09-04, ADR-0018.** The trusted-member feature, `/studio/trusted-members`,
  the `trusted_members` table and every manager-only UI are gone. Roles are exactly three: viewer,
  owner, developer. Never reintroduce a helper role; `canEditSupport`/`canEditEventTags` now equal
  `canEditSchedule`.)
- **Owner** (UI label "관리자", role key `owner`) — full control; may use multiple owner Google accounts.
- **Developer** — diagnostics (presence panel) + role preview (read-only, client-only, resets
  on refresh, never escalates real permissions).

## Visibility scopes (3)

`모두`(public) / `엠바고`(owner_private — **owner only, even developers can't read or create**;
DB value stays `owner_private`, old `embargo` merged in) / `작업자`(work).
**Read access** (private needs login + passcode): public → everyone; work →
owner/developer; owner_private → owner only. (Studio UI for
private layers is retired — ADR-0014; the server model stays.)

## Invariants (high-frequency facts)

- Private-layer banner (retired from studio UI 2026-08-27, ADR-0014; keep this exact text if it
  ever returns): `⚠ 비공개 일정 표시 중입니다. 방송 화면 공유에 주의하세요.`
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
- **Mobile copy is the shortest working label** (2026-09-04 owner rule): "시청자 화면" not "시청자 화면
  보여주기", "미리보기" not "역할 미리보기 ▾". A long/short label pair (`.lbl-long`/`.lbl-short`) must be
  hidden by a base CSS rule so both never render at once — on mobile render a single short `.lbl` instead
  (the "미리보기 미리보기" defect came from the pair leaking outside `.studio-role-tools`).
- **Design unity:** symmetric L/R padding, reused tokens/components, shared motion vocabulary.
  One-off styles, imbalance, or ragged sibling heights = defect; new UI must look native.
- **Fill empty space by content** (scale value/icon up, redistribute) — don't stretch an
  already-cramped box. Sibling cards/tiles share one height.
- **Motion & feedback by default:** `:active` scale, state transitions via `var(--ease)`,
  meaningful enter/exit; charts get centered+clamped hover value tooltips. Static = regression.
- **Haptics:** `hapticTick()` on toggles/selectors/confirms (press→server-confirm = two ticks).
- Respect reduced motion via `html[data-reduce-motion]`. The in-app switch is the only
  authority. Since 2026-09-03 it is labeled **생동감 있는 동작** and defaults to ON (ON = attribute
  absent = full motion; OFF sets the attribute — the old "동작 줄이기"). Storage key
  `vic.reduceMotion` keeps its old meaning. OS `prefers-reduced-motion` seeding was withdrawn
  2026-08-27; eye-comfort theme defaults to ON. Never gate motion on the OS media query
  directly in CSS — always target `html[data-reduce-motion]`. Always-on ambient decoration
  (the studio tide layer) must additionally hide under `html[data-gfx="lite"]` (weak-device
  probe, `lib/ui/gfx.ts`) and use transform/opacity only.
- **HCI:** minimize eye/pointer travel, keep related things close, preserve position across
  state changes (a loading skeleton sits where the real content will land).
- **Cramped-window compaction (2026-09-04, `docs/ux/chrome-compaction-manual.md`).** The studio web chrome
  must survive any forced window ratio: cold things fold first (labels → build tag → ✨ → avatar slot), hot things
  (calendar, save state, month nav) last, and every folded label keeps `aria-label`/`title`. Width tiers are
  **measured, never hardcoded** — `chromeTier` in `studio-shell.tsx` raises `.studio-shell[data-chrome="1|2|3"]`
  until the one-row header stops overflowing (1 short preview label · 2 "?"-only badge, icon-only 보여주기/로그아웃,
  no save time · 3 save dot only, build tag/✨ hidden, smaller title/month). Height: the tag-filter card keeps
  ≥132px (title + two chip rows) and the empty avatar slot yields first (`flex-shrink 4`); ≤620px → icon-only
  tool tiles, ≤470px → avatar slot hidden. Floating pills live in `.bottom-float-row`, which dodges an open
  editor popover sideways (or goes under it, faded, when there is no room). New header/rail elements follow
  the manual's checklist.

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
  are never the only protection); never add a helper role (manager/worker retired);
  prefer role-specific screens over disabled owner controls.
- **Evaluate:** no private leak · owner-only stays owner-only · viewer clean ·
  `/onair` has no admin UI · **regression review** (create/drag/reorder/
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
