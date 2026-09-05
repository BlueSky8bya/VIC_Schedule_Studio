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
- **Chrome placement (배치 대개편, 2026-09-03).** Studio web chrome is ONE north row: build badge (the "✨ 빅토리 일정표 ✨"
  title left the studio on 2026-09-04 — it lives on the viewer poster only) · month nav · save state · role badge · viewer
  preview · logout (owner-specified order). Under the ambient gate the transparent topbar is `pointer-events: none` with
  its three cells `auto`, so leaves under the old header area can be grabbed. Cold tools (태그 편집 · 인사이트 ·
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
  **The account card is rail-width** (2026-09-04): `.studio-role-tools` is a grid card fixed to `--rail-w` (20vw−16),
  columns `auto auto 1fr auto` (save/role/logout content-fixed and state-stable, the preview action takes the rest; save
  time lives in the tooltip only; short label "시청자 화면"), right edge on the rail when the rail is right; the preview nav
  card matches the poster rail via `--pv-w/--pv-mr` measured in `studio-shell.tsx`. Under the ambient gate the studio
  topbar is **transparent** (no fill/border/blur — calm-layer ⑧): title, month label and cards float on the season like the
  viewer.
- **Biome world (PLAN-20260904-004 P1, 2026-09-04 night; ADR-0017 ⑯).** The background is one small world: the calendar view and the
  first showcase screen are always the **meadow** (`scenes/meadow` = spring/autumn/winter scenes + the summer variant of spring), and in
  showcase mode the arrow keys / WASD / swipe / edge chevrons / minimap pan a camera across **eleven screens** (`world/biomes.ts`:
  valley·pond·mountain / hill·★meadow·forest / tidal·sandy·rocky + open sea·deep sea, directions = the 오행 compass, the two sea rows fold
  x so any coast leads to the same sea). `world/world-scene.ts` is a `Scene` the engine runs like any other: biome scenes are created
  lazily (`scenes/biome-loaders.ts`, dynamic import), only the active one steps, a pan draws two translated scenes for 620 ms
  (ease-out-quint, no overshoot), leaving showcase snaps back to the meadow, arrivals fire `vic:biome` (pill + minimap in
  `showcase.tsx` ShowcaseNav). **Water lives in its biomes** — `AmbientLayer` no longer mounts the CSS tide (`water-tide.tsx` is retired);
  pond (`summer.ts` with a season param: canvas water base from `scenes/water.ts`, winter ice), the three coasts (`coast.ts`) and the seas
  (`sea.ts`) draw their own water; lily pads only render where `drawTraces` gets `water: true`. Land biomes are thin plates (`land.ts`)
  until P2 agents and P3 art. Fixture: `?biome=pond`. Debug: `__vicAmbient.goTo/biome/exits`.
- **Ambient registry (ADR-0017, 2026-09-04, revised same day).** Studio and viewer mount ONE
  `<AmbientLayer month={view.month} />` (`components/shared/ambient/`). The season follows the **calendar
  month being viewed**, not today: 12–2 winter · 3–5 spring · 6–8 summer · 9–11 autumn (flip a month, the
  background flips). **(The water tide was summer's default until the biome world — see the bullet above.)** Spring/autumn/winter are **interactive canvas
  scenes** (revision 2, same day: `season-canvas.tsx` + `scene-engine.ts` + `scenes/*`), all in the same
  **top-down view** as the tide: winter = snow field + walked footprints + landing flakes, click the ground →
  footprints + snow puff; autumn = abundant desaturated brown/wine leaves (never red/orange/yellow) with physics
  (collisions, ground friction, gusts, pointer wind, grab-and-drag); spring = lawn + clover/daisies + butterflies
  (shadow, flee from pointer, click → petal burst). Apple-feel, cute, 오행 palette kept. Switch "계절 배경"
  (`vic.ambient`, **default OFF since 2026-09-04** — a first visit starts quiet; the chosen state persists per device
  and is restored before paint by the layout script): **OFF = everything down, tide included** (the tide is summer's, never a fallback).
  Every season answers the mouse: summer ripples (a canvas over the tide), spring butterflies flee and later land
  on daisies, autumn leaves blow (7 species: round · elm · willow · maple · ginkgo · oak · pine needles, muted
  colors), winter kicks up snow dust while an invisible walker keeps leaving boot prints. Special days go into
  `SPECIAL_DAYS` in `registry.ts` (real KST date, priority over season). Engine rules: sprites/ground baked once,
  per-frame drawImage only, dynamic import, loop stops when hidden/off, self-governor (late frames > 20% → fewer
  particles, never below a visible floor), **zoom-aware sizing** (canvas = `offsetWidth`, pointer ÷ zoom — the
  studio shell is zoomed ≥1700px); tide rules unchanged (transform/opacity only, no filter/blur/scale animation,
  no dark blobs). Never mount `<WaterTide />` directly again; never add a second background system
  (the old `data-poster-theme` 7-pack coexists for now and is slated to be superseded).
- **Ambient quality = continuous load + LOD + assets (2026-09-04, ADR-0017 ⑧).** `data-gfx` only sets a band; the engine
  keeps a **continuous `load` (0–1)** it raises (+0.06) or lowers (−0.15) every 90 frames from measured frame gaps, and every
  scene reads `f.load` each frame to scale counts/props/effects **gradually** (leaves fall in from the sky to grow, fade out
  farthest-from-pointer to shrink; flakes finish their cycle; butterflies fly in/out at the edges). "배경 효과" 자동 = adaptive,
  항상 최대 = 1, 가볍게 = 0.3 fixed (`vic:gfx-pref` event re-bands). **LOD rule:** anything soft is drawn at low resolution —
  the summer wake is stamped/stroked on a 0.35–0.5× offscreen canvas and upscaled (foam stamps aging wider/fainter, Kelvin
  arms, crests, rings), canvas DPR is fixed per mount, prints/props are baked sprites. **Animals are never hand-drawn
  (owner rule 2026-09-04)**: every creature is a Google Noto Emoji SVG in `public/ambient/noto/` (Apache-2.0 artwork,
  `NOTICE.txt`) loaded once by `components/shared/ambient/assets.ts` — 🐇 🐿️ 🐠🐟🐡 🦆 🐞 🐝; side-view sprites are drawn with
  `drawFacing` (flip when heading right, pitch by the vertical component — a 180° rotation would show the belly), top-view
  ones (ladybug) with `drawSprite` (forward = up). Only the swim ring and acorn are our own SVGs. Want a new creature?
  Download an asset (Noto/Twemoji/CC0), never draw one.
  **Per-season random events**: summer = rubber duck always afloat + an occasional swim ring drifting through (both grab/throw,
  leave their own wake), a school of fish shadows under the water (flee the pointer, one big one at high load), sun glints,
  bubble pops; winter = animal visitors (cat · bird · rabbit gaits) besides the human walker, a **snow rabbit** that pops out,
  looks around, hops (tracks) and dives back (startles from the pointer/click), a passing snow-dust gust; autumn = a baked
  ground (earth patches, dry tufts, twigs, pebbles, mushrooms — muted), acorn drops (bounce, roll, shove leaves, max 6,
  grabbable), a **squirrel** that runs in, sniffs and steals an acorn, a travelling leaf whirl; spring = the tuft layer sways
  (12 strips, travelling wave) during petal breezes, ladybugs, **dandelions** (click → seeds float off, regrow later), a bee
  visiting daisies. Canvas DPR is fixed per mount (a runtime DPR flip re-baked the ground = "re-render 2s after month change")
  and ground bakes use a per-size deterministic rng. Showcase swallows every key except Esc.
- **Top-down view is law; creatures have research-based minds (2026-09-04, ADR-0017 ⑬).** The scenes are seen from above, so
  **fish are under-water shadows** (Animal Crossing style): silhouettes baked from public-domain *top-view* drawings
  (`public/ambient/fish-shadow-*.png`, sources in `public/ambient/NOTICE.txt`, baker `.scratch-pw/bake-silhouette.mjs`),
  split into body + tail at a joint so the tail wags, drawn on the low-res wake layer, larger/darker the nearer the surface
  (`depth`). Never draw a side-view fish flat on the water again. **No open-licensed top-view duck exists** (openclipart 0 hits,
  OpenGameArt, Wikimedia, itch checked) — the Noto duck is drawn **upright, flip-only** (a 3/4-view prop, never rotated by
  heading) with a mallard ethogram (drift · paddle · dabble tip-up · preen · bathe · shake · curious approach · alarm), and it
  **sits in the water**: below a per-state waterline the sprite is drawn from a water-tinted copy at low alpha (feet/belly
  submerged while swimming, most of the body under during tip-up, rising when alarmed/shaking, fully out when lifted), with a
  thin waterline ellipse and the shadow directly beneath (an offset shadow read as "hovering"). Fish count follows capacity
  (2–14 × area, big ones from load .6/.9) and always enters/leaves via the edges in two loose schools.
  Every creature perceives the pointer through `threat()` in `scenes/util.ts` (distance + approach rate + loom = rate/d):
  slow approach is tolerated, a lunge triggers escape early (flight-initiation distance grows with speed). Fish: C-start burst
  + protean side-dodge, startle contagion within 90px, hovering shadow → sidle away, splash (click) = feeding cue after 1 s
  (curious fish circle and gulp with rings) but startles fish within 140px, boids schooling, bold slow big one. Rabbit:
  alert (upright, faces threat) → foot thumps → zigzag flee, freeze-then-flee on a lunge, binky when safe, the invisible walker
  is a predator too. Squirrel: scatter-hoards (dig · bury · pat · look), **deceptive fake burial when watched**, vigilance
  pauses, zigzag flee, cache retrieval from memory; clicking a mound digs the acorn back up. Spring: butterflies loom-flee,
  spiral-chase each other, bask with open wings in the sun patches; ladybug plays dead (thanatosis) before flying off; bee
  traplines the nearest unvisited daisies, hovers before landing, feeds, goes home after a bout, circles the pointer when
  swatted. New behavior must cite the animal's real ethology in a comment and expose counters in `debug()`.
- **Art slots + the Animal Crossing camera (2026-09-04, ADR-0017 ⑮).** Every picture the ambient scenes place (trees, saplings,
  sprouts, shrubs, grass, flowers, mushrooms, reeds, lily pads, mounds, twigs, pebbles, rocks, stumps, logs, snowmen, and — phase 2 —
  every species) is a **slot** in `components/shared/ambient/art/manifest.ts`, one file per slot: `public/ambient/art/<id>.png`
  (variants `<id>-n.png`). **If the file exists the scene draws it, otherwise the current stand-in** (procedural shapes, Noto emoji,
  PD silhouettes) — `art/load.ts` (`ArtSet`: alpha-trimmed, fitted to the slot box, 404 remembered for the session, ground re-baked
  once when all arrive) and `art/props.ts` (`drawProp` = one API, fallbacks inside; `scatterProps` places big props only when their
  art exists). The owner rejected shapes-glued-together plants ("winter tree = sea anemone, spring plants = gum on the ground, autumn =
  unidentifiable mounds, summer lily pads = flat overlap"): **never add a new procedural plant/prop — add a slot, draw the fallback in
  `props.ts`, and let the art replace it.** Camera rule refined: only things lying on the ground/water are strict top-down (`flat`) or
  silhouettes (`shadow`); **standing things (trees, shrubs, flowers, snowmen, animals) are `stand` = the Animal Crossing camera** (high
  3/4 front view, anchor = ground contact, the engine draws the ellipse shadow). Manage everything at **`/studio/ambient-art`**
  (developer-only route; settings modal dev row "배경 아트 보드 → 열기"): now-vs-delivered per slot, filters, and the Codex prompts
  (master 1차/2차/전체 + per slot) generated from the manifest so table and prompt never drift. ACNH catalog pages
  (soopoolleaf Fish/Bugs) are a **style reference only** — original art, no Nintendo asset copies; 오행 palette holds (no vivid
  red/orange/yellow). **The confirmed style is pixel art** (owner, second oak batch 2026-09-04: "much better"): chunky dots at a
  64–96px logical resolution scaled up, 6–10 colors per object, no anti-aliasing, outline = a much darker shade of the same hue
  (never pure black). `public/ambient/art/tree-oak-*.png` are the reference set — every new piece must sit beside them as one set;
  mixing dots with the painterly look breaks the scene. **Simple beats detailed** (the first batch was rejected as "too complex,
  1024 is overkill"): 2–3 blobs readable at 128px, generator at its minimum size with low/medium quality; stored files are shrunk
  with `npm run art:normalize` (alpha-trim + fit to 4× the slot's screen px, 128–512 — trees 512, props 128–256; the board flags
  heavy files). A trunk standing on a bright ground (snow, sand) is grey-brown, never red-brown — a red trunk was the loudest thing
  on the snow field; `scripts/ambient-art-desaturate.mjs` fixes delivered art in place. Fixture for probes: `/visual-fixture/ambient-art`.
- **3/4 camera + toy scale (PLAN-20260904-004 P0, 2026-09-04 night; owner: "leaves as big as trees", "I want distance").**
  `world/scale.ts` is the size table (TILE 64, biggest : smallest ≤ 12 — leaves 12–18, boot prints 18, oak crown 128, debut cap
  192, flowers deliberately 24–28); `world/view.ts` is the camera: `GROUND_SQUASH` .7 for anything lying on the ground/water
  (prints, clover, lily pads, fish shadows, ripple rings — ellipses, applied before rotation), `depthScale(y,h)` **.60→1.00**
  top→bottom in .05 steps for everything standing or alive (owner: .8 was too weak), `HORIZON_V` .12 = the far band
  (`bakeHorizon`: haze + two hills fading into the ground + a sparse silhouette tree line), **`drawDepthHaze` = the engine paints an
  atmospheric haze from the horizon down to 58% height over every scene** (grass, water, prints, creatures all fade with distance),
  `toScreen(u,v)` puts normalized world coords below the horizon, y-sort in `drawTraces`. **Ground-bound things live below the
  horizon only**: every scene has `gy()/groundY(r)`, and spawns, wraps, bounds, walker print emission, hot-zone bands and clicks use
  them (the owner saw prints and a swim ring floating on the far hills). New scene code reads sizes from `SIZE` and draws through
  these helpers — no hardcoded px, no un-squashed ground marks, nothing ground-bound above `horizonY`. The remaining biome world
  (11 screens, camera pan, pond/sea split of summer.ts, agents, 도감) is P1–P3 of the plan.
- **World services (PLAN-20260904-003 Phase A, `components/shared/ambient/world/`).** The scene `Frame` carries `date` (viewed month's
  day: today / last day of a past month / 1st of a future month), `time` (six KST bands — 새벽·아침·점심·노을·저녁·밤 by seasonal
  sunrise/sunset — with a light tint the engine paints over the scene: none by day, grey-violet dusk, blue-grey evening/night, never
  orange), `weather` (deterministic per calendar slug + date + am/pm segment from a seeded rng, seasonal tables; no real weather API —
  owner decision), and `traces` from `chronicle(slug, y, m, d)`: a pure deterministic function that replays the world from its birth
  **2023-05 (Tori's first appearance)** — the **debut tree**: one acorn buried 2023-05 (mound), sprouting **2025-10-01 (streamer debut)**
  and growing at a real oak's pace from then on (4→14 cm the first autumn, then only in the Apr–Sep growing season: ≈45 cm after a
  year, ≈3 m at 5, ≈11 m at 20, cap 20 m; 🌱 <15 cm, 🌿 <80 cm, then a canopy of radius ≈ height/12, bare in winter; fixed spot
  u .78 v .062; past months show its height then, future months its projected height) · the acorn cycle from autumn 2025: caches →
  visible again at the Feb 15 thaw → spring sprouts (60%) → summer saplings → autumn trees (age, cap 6, lifespan 6, top hedgerow band)
  · molehills → summer grass patches · snowman built Dec 20→27, melting Feb 15→25 · lily pads 3→12. Everyone sees the same world (no
  DB); a viewer's own marks stay in localStorage. **Only the developer account** can force band/weather/day (settings modal rows
  "세계 시간대·날씨·날(개발자)", session-only, carried into the viewer preview); owner and viewers always see real time. Rarity uses `SpawnDirector` (5 tiers, concurrency caps, cooldowns,
  pity timer, one legendary per session, never two rare events at once; legendaries are pure probability). Species live in
  `species.ts` (8 live + 20 priority). `traces-draw.ts` renders traces (plants/props may be ours; animals never). Fixture:
  `?y=&m=&day=&hour=&weather=`; debug `__vicAmbient.world()` / `forceWorld()`.
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
  entry buttons in the studio avatar slot and the viewer rail — **no settings row**, one entry per screen) sets
  `html[data-showcase]` to hide all chrome and let the whole screen act as background; Esc or the top pill exits. The
  showcase button hides under the same gate as the ambient (계절 배경 OFF → gone). Viewers have no settings screen, so the
  viewer rail shows `[감상하기 | 배경 끄기]` (`ViewerAmbientControl`, same `vic.ambient` key); the toggle stays visible when
  OFF as the only way back. **Three ambient states (2026-09-04):** `vic.ambient` = `on` · `dim` · `off`
  (`ambientMode`/`setAmbientMode` in `lib/ui/motion.ts`; `dim` = background layers at opacity .28 + engine at half rate,
  lifted while showcasing). The control is ONE component everywhere — `AmbientModeSegment` in `showcase.tsx`, a three-button
  radio segment `[켜기 | 흐리게 | 끄기]` (current state filled; any state reachable in one click — the owner rejected the
  cycling "next action" button, 2026-09-04): glass pill in the viewer rail / studio avatar slot (`ViewerAmbientControl`),
  metal skin (`.metal`) in the settings modal row. The studio watches `data-ambient` and keeps its settings state + the 배경
  효과 lock in sync, so the viewer-preview rail segment counts too.
  Under the ambient gate the transparent topbar is not sticky (it scrolls away instead of overlapping cells). **Focus dim:** while an event editor is open or
  an event is being dragged the studio sets `html[data-ambient-dim]` and only the background layers drop to opacity .28
  (never blur/filter, never text). `.gs-season`'s enter animation must keep `animation-fill-mode: backwards` — `both` pins
  opacity 1 forever and defeats every cascade opacity (showcase, dim).
- **Ambient pauses behind heavy media** (`lib/ui/ambient-pause.ts`, `html[data-ambient-pause]`): the VOD window, the
  viewer insights sheet and studio modals (except settings) hold the pause; the canvas loop stops on its last frame and
  the tide's animations pause. Never leave a full-screen animated layer running under a `backdrop-filter` or an iframe
  player (2026-09-04: VOD playback stuttered). No always-on rAF loops in the poster — drive follow/measure logic by
  scroll/resize/ResizeObserver events.
- **Viewer chrome groups and tiers**: header buttons live in uniform 36px segmented cards (login/logout, preview nav,
  아바타 자리) and the center trio is one 44px height; cell type is 13.5px (`--text-body`, raised from 11px on
  2026-09-05 — 11 read as a footnote inside a 44px card) with the gained width taken back from the horizontal
  padding so the cards keep their measured width; `html[data-pchrome="1|2|3"]` (measured in `public-poster.tsx`)
  folds labels → sparkles → title size when the header overflows or overlaps the overlays.
- **아바타 자리 = one three-state radio `[끔 | 왼쪽 | 오른쪽]`** (`.avatar-ctl-preview` in `public-poster.tsx`,
  owner/developer preview only). The 2026-09-05 rebuild replaced a card that held **two grammars at once** — a
  next-action toggle whose label flipped ("아바타 자리 끄기") glued to a state radio (왼쪽/오른쪽) that appeared and
  disappeared, so the card jumped width and reaching "off → right" took two clicks. Now it is the same grammar as
  `AmbientModeSegment`: a quiet name cell + three states always visible, current one filled, any state one click
  away, width constant. Never bring back a label that names the *next* action on a control that sits beside state
  cells (the owner rejected that pattern twice — here and in the ambient segment).
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
- **The shortest working label, everywhere** (2026-09-04 owner rule, widened to web 2026-09-05): "시청자 화면"
  not "시청자 화면 보여주기", "미리보기" not "역할 미리보기 ▾". The long/short label pair
  (`.lbl-long`/`.lbl-short`) is **retired** — every control renders one short `.lbl` on web and mobile alike.
  The owner asked for bigger type in the account card and the long label was what was eating the width; with
  one label the cells fit at 13.5px and the measured chrome tier actually *drops* (1920: tier 1 → 0). Never
  reintroduce the pair (it also caused the "미리보기 미리보기" defect when its hiding CSS leaked).
- **A hover box says only what the screen does not** (2026-09-05 owner rule: "이미 다 보이는 내용 또 띄우지 마").
  Three cases, in order: label visible and self-explanatory → **no tooltip**; label can fold (chrome tiers) →
  the tooltip appears **only while folded** and carries the **name** — use the `data-tip` + `::after` pill
  (`.stool[data-tip]` in studio-calm-layer.css, `html[data-pchrome] …[data-tip]` in public-poster.css), never a
  native `title` that fires when the label is already on screen; label visible but the *effect* isn't obvious →
  the tooltip states the **effect**, ≤ ~20 chars, no parenthetical asides ("시청자가 보는 그대로 보기",
  "옅게 — 일정이 잘 보이게"). Keep `aria-label` as the name in every case.
- **No decorative icons, and one per control.** An icon must add what the words can't — identity when folded,
  a shortcut, a state. A glyph that merely repeats or contradicts the label is a defect (2026-09-05: the 감상
  나가기 pill carried an eye — "보다" on the button that stops looking; the pencil beside it was an emoji among
  lucide strokes; the 미리보기 trigger wore an eye *and* a ▾). When a control would take two, keep the one that
  survives folding — the leading icon — and let `aria-haspopup` + the menu itself say the rest. One icon
  vocabulary per group: lucide strokes in chrome, emoji only in the viewer's playful surfaces.
- **Web materials stop at the mobile boundary** (2026-09-05 owner: 오늘 · 미리보기 · 태그 편집 · 로그아웃 ·
  이 달 기록 · 편집실 "혼자 딱딱하다"). The metal skin (ADR-0016) is the grammar of a **standing button on web**.
  Mobile already has its own: cream faces, 12px/pill radii, meaning-tinted chips (태그 = violet · 미리보기 =
  slate · 오늘 = accent). Painting grey metal over that erased the whole language and left those buttons as the
  only foreign material on the screen. The gate is a **class, not a media query** — `.studio-shell.studio-narrow`
  and `.poster-page.poster-agenda`, set from the same JS that chooses the topology, because `STUDIO_AGENDA_QUERY`
  has a second clause (a phone lying down: `max-height: 640` + `pointer: coarse`) that a `min-width` query
  silently misses. Any new web-only material must pass through the same gate.
- **State segments share one highlight technique** — tokens `--seg-on-*` / `--seg-off-op` in `globals.css`
  (2026-09-05). Selected = a soft tint fill + an inset white hairline, never a border; unselected = the same ink
  at `--seg-off-op`. A border-boxed "selected" chip inside a card fights the card's borderless-cell grammar and
  reads as a foreign object (계절 배경 and 아바타 자리 now draw from the same tokens).
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
  no save time · 3 save dot only, build tag/✨ hidden, smaller title/month). The measurement only ever runs on a laid-out
  topbar (`isConnected && clientWidth > 0`) and re-binds on shell remount via a callback ref (`shellEl` state): the viewer
  preview unmounts the whole shell, the ResizeObserver fired once with 0×0 rects (every tier "overlapped"), tier 3 froze and
  the remounted shell was never observed (2026-09-04 owner screenshot). Never measure a detached element. Height: the tag-filter card keeps
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
- **Analytics never record automation or local traffic (2026-09-04).** `.env.local` points at the production Supabase, so
  a local `next start` + Playwright run wrote 2,694 fake visit sessions (and presence/activity rows) in two days and
  produced "4 concurrent at dawn". Every recording path (visit beacon, presence channel, activity batch, their API routes)
  goes through `lib/analytics/guard.ts` (`navigator.webdriver` / localhost on the client, local Host / HeadlessChrome UA on
  the server). A new stats path must use the same guard. Cleaning old polluted rows is destructive — backup + SQL live in
  `.scratch-pw/` and run only after the owner approves.
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
