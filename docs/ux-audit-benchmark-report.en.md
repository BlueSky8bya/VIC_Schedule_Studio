# UX Audit & Benchmark Report

## App Entry / First Paint

* **Component Name / Code Location**: `app/layout.tsx` and `app/page.tsx`
* **Discovered UX Bottleneck**: The root layout resolves the current actor before rendering the document body, and the home route resolves actor, unlock state, and schedule data before choosing public, studio, or auth UI. There is no route-level `loading.tsx`, so slow Supabase auth or role queries can delay the first visible shell. This is especially noticeable on mobile/KST users opening the monthly poster from chat links.
* **Industry Benchmark Analysis**: Slack's incremental boot moved from waiting for a full model to showing the first useful screen earlier, separating "content visible" from "fully loaded" and disabling unfinished UI until the rest arrives.
* **Proposed Custom Strategy for Our Project**: Add a conceptual "VIC schedule shell" phase before private role data resolves. The shell should immediately show the calendar frame, month label placeholder in Asia/Seoul time, poster-safe background, and non-sensitive shimmer blocks. Public/private separation must remain server-owned: shell content must never include private event fields. Engineering should split the first paint into anonymous-safe chrome first, then hydrate actor-specific controls after server role resolution.

## Studio Initial Data Load

* **Component Name / Code Location**: `app/(studio)/studio/page.tsx` and `lib/schedules/studio-loader.ts`
* **Discovered UX Bottleneck**: Studio waits for actor, unlock, public preview, calendar, tags, palette, events, and campaigns before mounting `StudioShell`. The loader is already partially parallelized, but the user gets no route-level progressive shell while private-safe DTO filtering runs.
* **Industry Benchmark Analysis**: Slack's model is directly applicable: render the initial working surface with a small payload, then progressively enable deeper UI. Notion's offline architecture also shows the value of reliable local/persistent data for fast page access, while refusing to show incomplete data when that would mislead users.
* **Proposed Custom Strategy for Our Project**: Define a studio boot ladder: first show a KST month grid shell, then public-safe events, then private-layer affordances, then owner-only edit controls. The "viewer cannot access private data" rule means the first two phases must use only public DTOs. Private-layer tiles should be warning-heavy placeholders until unlock state and filtered studio events arrive.

## Month Route Navigation

* **Component Name / Code Location**: `app/(studio)/studio/calendar/[year]/[month]/page.tsx`
* **Discovered UX Bottleneck**: Month-specific studio routes reload the same full studio schedule instead of preserving a local shell during route transition. The existing `navMsg` overlay in `StudioShell` gives feedback for some links, but the actual route navigation can still feel like a full-page wait if data resolution is slow.
* **Industry Benchmark Analysis**: Figma's prototype guidance treats state continuity across frames as essential: scroll position, component state, and matching-object state are preserved so navigation feels continuous rather than reset.
* **Proposed Custom Strategy for Our Project**: Preserve the current month grid as a stale-while-refresh visual during month changes. The outgoing month should remain visible but softened, with the next/previous month skeleton sliding in immediately. KST month math must stay authoritative, and the final server payload should reconcile the shell rather than remounting the entire experience.

## Private Layer Unlock

* **Component Name / Code Location**: `components/studio/studio-shell.tsx` and `components/private-layer/private-layer-panel.tsx`
* **Discovered UX Bottleneck**: Unlock uses a client fetch, then triggers parent refresh behavior. The code has a loading overlay, which is good, but the transition still depends on a full server refresh before private events become real. This creates a fragile "verified but not yet visible" moment.
* **Industry Benchmark Analysis**: Auth and privacy transitions benefit from explicit handshake states. Firebase's redirect best-practices documentation calls out browser storage and redirect-flow fragility across browsers, while Supabase emphasizes configured redirect destinations and custom error handling after auth failures.
* **Proposed Custom Strategy for Our Project**: Treat private unlock as a three-state handshake: verifying passcode, unlocking private schedule, private layer active. Keep the warning-heavy private-layer affordance on screen and replace redacted cells with skeleton private cells only after passcode verification succeeds. On failure, collapse back to locked state without revealing counts, titles, or timing patterns.

## OAuth / In-App Browser Handshake

* **Component Name / Code Location**: `components/auth/in-app-browser-notice.tsx`, `app/api/auth/login/route.ts`, and `app/(auth)/auth/callback/route.ts`
* **Discovered UX Bottleneck**: The project already detects in-app browsers and shows a "trying" state before Chrome intent handoff. Remaining risk is the external blank gap: the browser may leave the current app, return from OAuth, exchange the code, then redirect again with only generic browser feedback.
* **Industry Benchmark Analysis**: Firebase documents that redirect sign-in can fail or degrade in browsers that block third-party storage, and recommends same-domain auth handling, proxying, or self-hosted helpers depending on environment. Supabase similarly stresses exact production redirect configuration and error parsing for failed auth returns.
* **Proposed Custom Strategy for Our Project**: Make the OAuth journey feel branded end-to-end: pre-handoff overlay, callback-processing overlay, and post-login route restore overlay. The callback route should conceptually land on a minimal "returning to VIC Schedule Studio" shell before final redirect. Errors should become friendly, recoverable cards rather than query-string surprises.

## Event Create / Edit / Delete

* **Component Name / Code Location**: `components/studio/studio-shell.tsx`
* **Discovered UX Bottleneck**: Event creation, deletion, linking, reordering, and undo already use optimistic local state with rollback. This is one of the strongest UX areas. The remaining bottleneck is that pending temp IDs can affect follow-up operations, producing "try again shortly" moments when the user chains actions faster than persistence resolves.
* **Industry Benchmark Analysis**: Linear's public sync-engine work is built around realtime sync, and Notion's offline work emphasizes background sync and conflict handling instead of blocking the writing flow.
* **Proposed Custom Strategy for Our Project**: Keep the optimistic model, but make pending entity status visible and granular. New events should show a tiny "syncing" marker, links should show a temporary chain shimmer, and failed saves should target only the affected event with rollback explanation. Owner-only editing must remain server-enforced; optimistic UI is only perception, not permission.

## Tag Editing / Color Propagation

* **Component Name / Code Location**: `components/tags/tag-legend-editor.tsx`
* **Discovered UX Bottleneck**: Existing tag updates optimistically repaint calendar colors, but new tag creation and deletion are more server-dependent. When a tag is removed or created, the user may see controls disabled and wait for the canonical list to return.
* **Industry Benchmark Analysis**: Figma's interaction-state model is useful here: state should be shared across matching surfaces, and reset only when the action demands it. For VIC, tag state appears in the editor, legend, calendar chips, and poster colors, so disconnected loading feedback feels more jarring than a single global spinner.
* **Proposed Custom Strategy for Our Project**: Treat tags as a synchronized design-token layer. Existing tag edits should continue to update instantly. New tags should appear as pending chips with generated color immediately. Deletes should fade the tag and affected calendar pills, then finalize or restore. Public DTOs must never expose private-only tag associations.

## Trusted Members Panel

* **Component Name / Code Location**: `components/trusted-members/trusted-members-panel.tsx`
* **Discovered UX Bottleneck**: The panel fetches trusted members after mount and shows a simple loading empty state. Add/remove waits for a full server-returned member list before the list visually changes, so management feels slower than the rest of studio editing.
* **Industry Benchmark Analysis**: Slack and Linear both optimize toward keeping the working model local and responsive, then reconciling with server truth. Canva's guidelines also frame loading affordances as important perception tools even when backend time cannot be eliminated.
* **Proposed Custom Strategy for Our Project**: Convert the members list into an optimistic roster. Add should insert a pending member row immediately with role and email. Remove should collapse the row into an undoable pending-deletion state. The server must remain the only authority for permissions; managers/workers must not gain edit affordances through client-only state.

## Poster Capture / Clipboard Export

* **Component Name / Code Location**: `components/poster/poster-export-actions.tsx`
* **Discovered UX Bottleneck**: Poster export dynamically imports `html2canvas`, renders a high-scale canvas, converts it to blob, then writes to clipboard. The button label changes to "capturing," but the rest of the page can feel frozen during heavy DOM/canvas work, especially with stickers and custom fonts.
* **Industry Benchmark Analysis**: Canva recommends reducing bundle size, offloading intensive work to the server when possible, showing loading affordances, and using thumbnails for image-heavy workflows. This maps closely to poster export: official exports should prefer server/Playwright rendering, while client export needs richer feedback.
* **Proposed Custom Strategy for Our Project**: Split export into "preparing poster," "rendering image," and "copying to clipboard." For official monthly schedule exports, prioritize the canonical Playwright path already described in the architecture docs. For convenience export, show a non-blocking overlay with poster-safe microcopy and warn if assets/fonts are still settling.

## Sticker Image Uploads

* **Component Name / Code Location**: `components/poster/public-poster.tsx` and `lib/schedules/sticker-asset-actions.ts`
* **Discovered UX Bottleneck**: Uploads are sequential. The UI does create local object URL previews and pending asset chips, which is excellent, but multiple image uploads still serialize network/storage work and can leave the drop zone in a broad "uploading" state.
* **Industry Benchmark Analysis**: Canva's performance guidance specifically recommends thumbnails for image workflows and avoiding full-size image cost where a preview is enough. It also recommends offloading intensive tasks to servers for consistency across devices.
* **Proposed Custom Strategy for Our Project**: Keep local previews, but conceptually add per-file upload lanes: queued, uploading, processing thumbnail, ready, failed. Generate or store lightweight thumbnails for the asset palette while preserving full-size URLs for export. Failed files should remain visible as retryable chips, not vanish without context.

## Sticker Undo / Redo Snapshot Sync

* **Component Name / Code Location**: `components/poster/public-poster.tsx`
* **Discovered UX Bottleneck**: Undo/redo applies snapshots and then performs delete/create/update operations. Some operations are batched, but fallback paths can loop through individual server actions. During a large sticker composition, the local UI changes immediately, while background persistence may lag without enough per-object status.
* **Industry Benchmark Analysis**: Notion's offline architecture highlights why local state plus background sync needs robust dependency tracking. Showing partial or missing content can be worse than denying access when the data graph is incomplete.
* **Proposed Custom Strategy for Our Project**: Treat sticker snapshots as a composition transaction. The canvas should update instantly, while a small sync ledger tracks pending creates, deletes, and updates. If any operation fails, restore only the affected sticker layer or offer "restore previous canvas," avoiding a full poster panic state.

## Public Hearts / Interest Toggles

* **Component Name / Code Location**: `components/poster/public-poster.tsx`
* **Discovered UX Bottleneck**: Heart toggles are already optimistic and rollback on failure. The main hidden bottleneck is count trust: server reconciliation may change counts after the local animation, and users are not told whether the count is final, syncing, or local-only.
* **Industry Benchmark Analysis**: Linear-style realtime sync and Slack-style local responsiveness both point to immediate UI response with later reconciliation. The important part is not merely speed, but making reconciliation quiet and comprehensible.
* **Proposed Custom Strategy for Our Project**: Keep instant heart animation. Add a subtle syncing state to aggregate counts only when server-backed hearts exist. In localStorage-only mode, avoid implying global popularity; present it as "my saved events" behavior rather than public count authority.

## Decorate Route Entry

* **Component Name / Code Location**: `app/(studio)/studio/decorate/[year]/[month]/page.tsx`
* **Discovered UX Bottleneck**: The decorate route waits for actor and public schedule before rendering poster decoration mode. Because poster mode is visually rich and asset-heavy, any delay before first paint is more noticeable than in utilitarian studio mode.
* **Industry Benchmark Analysis**: Canva's guidance is especially relevant: image-heavy creative tools should optimize bundle size, use URLs/thumbnails, and surface loading affordances. Slack's incremental boot also supports rendering the first useful view before every side capability is ready.
* **Proposed Custom Strategy for Our Project**: Show a poster canvas shell immediately with KST month/title placeholders, then progressively hydrate stickers, asset drawer, and export controls. Decoration permissions must still resolve server-side before editing tools activate. Viewers should never see edit handles, even briefly.

## Presence Initialization

* **Component Name / Code Location**: `lib/presence/presence-client.ts` and `app/layout.tsx`
* **Discovered UX Bottleneck**: Presence starts after authenticated layout render and silently fails if realtime setup fails. This is acceptable as a secondary feature, but developer/admin panels may show stale or empty presence without distinguishing "no one here" from "presence unavailable."
* **Industry Benchmark Analysis**: Slack separates content-visible and fully-loaded states, and only enables parts of the UI when their backing data is ready. That same principle applies to realtime presence: it should not block the core schedule, but it should disclose its own readiness.
* **Proposed Custom Strategy for Our Project**: Keep presence non-blocking. Add conceptual presence states: connecting, live, degraded, unavailable. Only developer-facing surfaces need this detail; viewer mode should stay cute and clean with no technical noise.

## Public Schedule/API Fetch

* **Component Name / Code Location**: `lib/schedules/public-loader.ts` and `app/api/public/[calendarSlug]/events/route.ts`
* **Discovered UX Bottleneck**: Public schedule loading is cached and parallelized, but the route still waits for the schedule before rendering the poster. Public API consumers also wait for the full schedule object. Heavy sticker assets and event-heart joins can make this feel slower than the visual need of "show me the month."
* **Industry Benchmark Analysis**: Slack's initial payload strategy says the first screen should fetch only what it needs, then complete the rest. Canva's thumbnail guidance says image-heavy surfaces should not pay full asset cost for initial visibility.
* **Proposed Custom Strategy for Our Project**: Split public poster data conceptually into calendar frame, event summary, reactions, stickers, and full asset metadata. First paint should need only public-safe calendar/event summaries. Stickers and reaction counts can hydrate after the grid is visible, with no private fields included at any stage.

## Benchmark Sources

* Slack Engineering, "Getting to Slack faster with incremental boot": https://slack.engineering/getting-to-slack-faster-with-incremental-boot/
* Notion Engineering, "How we made Notion available offline": https://www.notion.com/blog/how-we-made-notion-available-offline
* Linear, "Scaling the Linear Sync Engine": https://linear.app/blog/scaling-the-linear-sync-engine
* Canva Apps SDK, "Performance": https://www.canva.dev/docs/apps/design-guidelines/performance/
* Figma Help Center, "State management for prototypes": https://help.figma.com/hc/en-us/articles/14397859494295-State-management-for-prototypes
* Firebase Auth, "Best practices for using signInWithRedirect on browsers that block third-party storage access": https://firebase.google.com/docs/auth/web/redirect-best-practices
* Supabase Docs, "Redirect URLs": https://supabase.com/docs/guides/auth/redirect-urls
