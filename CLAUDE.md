# VIC Schedule Studio

## Project Identity

Project name: VIC Schedule Studio  
Repository name: vic-schedule-studio  
Korean name: VIC 스케줄 스튜디오  
Short name: VIC Studio

This is a streamer-first schedule studio built for Victory.

The app is not a generic calendar. It is a streamer schedule board that supports public co-planning, embargo-safe private layers, support campaigns, broadcast tags, sticker decoration, and poster-style image export.

## Core Product Mission

Build a web app where:

- The streamer can edit all schedules.
- Everyone signs in with Google at the root entry; non-owner/non-staff accounts (viewers) see only public schedules.
- Managers/workers authenticate with Google OAuth and unlock a private layer with a passcode.
- Embargo and work schedules are overlaid only for trusted unlocked sessions.
- The streamer can safely plan public schedules with viewers during a live stream.
- The streamer can customize broadcast tag names/colors.
- The streamer can decorate the calendar with PNG stickers.
- The streamer can export a poster-like calendar image.

## Non-Negotiable Rules

1. All time is KST / Asia/Seoul.
2. Only the configured owner (or a platform developer/superadmin) can create, edit, or delete schedules. Trusted members never can. The owner may be configured as more than one Google account of the same streamer (`OWNER_EMAIL` is a comma-separated list; extra accounts are synced into `calendar_co_owners` and recognized by `is_calendar_owner`). These co-owner accounts are fully equivalent to the owner, including `owner_private` access.
3. Everyone authenticates with Google at the root (`/`); after login, role decides the screen (owner/staff → studio, viewer → public calendar). Viewers can only see public data.
4. Managers and workers are read-only for schedule data (events, tags, members, passcode). EXCEPTION: they may decorate — add/move/resize/flip/delete emoji stickers (`sticker_instances`). Sticker image assets (`sticker_assets`) remain owner/developer-only.
5. Managers/workers may see the private-layer toggle only after Google authentication.
6. General viewers must never see the private-layer toggle.
7. Private-layer unlock requires a streamer-defined passcode.
8. Private-layer unlock is per-user-session, never global.
9. Embargo/work/owner_private schedules must never be included in public API responses.
10. Do not hide secret data with CSS. Remove it from server/API responses.
11. Public viewer mode must be clean, cute, and poster-like.
12. Studio mode may show operational information.
13. Private-layer mode must show a strong warning banner.
14. Poster export mode must not include admin UI.
15. Broadcast tag colors are limited to two representative colors per date.
16. The default color of 휴뱅 is gray.

## User Roles

### Viewer

- Must authenticate with Google (any account that is not owner/trusted)
- Lands on the public calendar after login (rendered at root `/`)
- Can view public calendar
- Can click support campaign links
- Cannot see private-layer toggle
- Cannot see embargo/work schedules
- Cannot edit anything

### Trusted Member

Includes managers and workers.

- Must authenticate with Google OAuth
- Must be listed in trusted_members
- Can see private-layer toggle
- Must enter private-layer passcode
- Can view embargo/work schedules after unlock
- Cannot edit schedules
- CAN decorate (add/move/resize/flip/delete emoji stickers); cannot upload sticker image assets
- Cannot view `owner_private` ("나만") events — those are owner-only

### Owner

The streamer.

- Must authenticate with Google OAuth
- May use more than one Google account: list them comma-separated in `OWNER_EMAIL`. The first is the primary owner (`calendars.owner_id`); the rest are synced into `calendar_co_owners`. All such accounts have identical owner rights (including `owner_private`).
- Can edit all schedules
- Can manage trusted members
- Can set/change private-layer passcode
- Can create public, embargo, work, and owner_private schedules
- Can manage tags, colors, support campaigns, stickers, and poster export

### Developer (Platform Superadmin)

The system maintainer (the engineer), distinct from the streamer. Listed in the
`platform_admins` table, not in `OWNER_EMAIL`.

- Must authenticate with Google OAuth; resolved before the owner check
- Has owner-level read/edit access across every calendar, for debugging and fixes
- EXCEPTION: cannot read or create `owner_private` ("나만") events — those are owner-only
- Sees a "developer session" banner in studio so elevated mode is obvious
- Two boundaries still apply, exactly like everyone else:
  - Public API output is unchanged for developers; public stays private-free
  - Reading embargo/work/owner_private still requires a valid unlock session (no passcode bypass)
- DB: `is_developer()` reads `platform_admins`; `is_calendar_admin()` = owner OR developer

## Visibility Scopes

Events must use one of these visibility scopes:

- public
- embargo
- work
- owner_private

Public mode must calculate date colors using public events only. Embargo/work tag colors must not affect public calendar rendering.

## App Modes

### Viewer Mode

For signed-in viewers (non-owner/non-staff Google accounts). Rendered at root `/` after login.

Show public events, public broadcast tags, public support campaign cards, public stickers, and public legend.

Hide edit controls, private-layer toggle, operational info, embargo events, work events, owner private events, private notes, save state, and link validation status.

### Live Safe Studio Mode

For the owner while planning with viewers.

Show public events, public event editing, tag selection, support campaign controls, sticker controls, poster preview, and private-layer toggle.

Hide embargo, work, and owner_private events until private-layer unlock.

### Private Layer Mode

For owner/trusted members after passcode unlock.

Show public events, embargo events, work events, owner private events only for owner, private notes when allowed, conflict warnings, and a strong warning banner.

Required banner text:

`⚠ 비공개 레이어 표시 중입니다. 방송 화면 공유에 주의하세요.`

### Poster Mode

For image export.

Show calendar, public events, tag colors, support campaign card, stickers, and legend.

Hide studio panels, edit controls, operational warnings, private-layer warnings, save status, and admin buttons.

## Broadcast Tags

Seed these 10 default tags:

1. 휴뱅
2. 합뱅
3. 대형서버
4. 풀트뱅
5. 잔잔뱅
6. 종겜뱅
7. 월드컵뱅
8. 날먹뱅
9. 노래뱅
10. 기대컨

These are defaults only. The owner can edit display names immediately.

Default color mapping:

- 휴뱅: gray
- 합뱅: lavender
- 대형서버: blue
- 풀트뱅: pink
- 잔잔뱅: mint
- 종겜뱅: yellow
- 월드컵뱅: orange
- 날먹뱅: beige
- 노래뱅: sky
- 기대컨: lime

Rules:

- Tags may be assigned multiple per event.
- Date cell representative colors are limited to two.
- If more than two tags exist, show only two representative colors and display +N if needed.
- Owner can choose the representative two tags.
- If owner does not choose, use event/tag sort order.
- Private event tag colors must not leak into public mode.

## Data Boundary Rules

Public data and private data must be separated at query/DTO level.

Public DTO must never include private_title, private_memo, editor_note, embargo events, work events, owner_private events, owner email, trusted member list, passcode info, operational updated_at, link validation result, or admin warnings.

Private-layer DTO can include embargo/work data only when:

1. User is authenticated.
2. User is owner or active trusted member.
3. User has private-layer permission.
4. User has a valid unlock session.
5. Passcode version matches current private_layer_settings.

Owner DTO may include all editable data after owner verification.

## Recommended Tech Stack

- Next.js App Router
- TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase RLS
- Supabase Storage
- Custom CSS calendar grid for MVP
- dnd-kit or react-rnd for sticker editing
- Playwright for E2E and visual regression
- Vitest for unit tests

Avoid FullCalendar for MVP unless the custom grid becomes insufficient.

## Done Definition

A task is not done unless:

1. TypeScript passes.
2. Lint passes.
3. Public/private data boundary is checked.
4. Viewer API does not include private fields.
5. Owner-only write routes reject non-owner users.
6. Trusted members cannot edit schedules.
7. Private-layer data requires valid unlock session.
8. KST date logic is preserved.
9. Tag colors do not leak private information.
10. Poster mode does not include admin UI.
11. Relevant docs are updated.
