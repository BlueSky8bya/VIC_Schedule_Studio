# Role-Based UI/UX Audit & Benchmark Report

Date: 2026-05-28  
Project: VIC Schedule Studio  
Scope: Read-only audit of role-visible controls, permission-gated workflows, and role-specific UX redesign strategy.

## Executive Summary

VIC Schedule Studio already has a strong server-side role model. The product separates schedule editing, private-layer reading, poster decoration, and public viewer behavior through `canEditSchedule`, `canDecorate`, `canReadPrivateLayer`, and `canReadOwnerPrivate`. The UX issue is not permission logic itself. The issue is that controls are mostly arranged as a flat row of role-conditioned buttons, so users see "what I am allowed to click" but not "what job I am here to do."

The recommended direction is to reorganize the interface around functional zones:

* **Identity & Mode**: role badge, account switch, private-layer toggle, viewer preview.
* **Schedule Operations**: add/edit/delete/reorder events, notice drafting, tags.
* **Access & Team**: private passcode, member management, unlock state.
* **Poster & Decoration**: decorate route, sticker tools, upload, export, theme.
* **Developer Diagnostics**: presence and system-only context.

This keeps the permission boundary intact while making each role feel intentionally designed instead of merely restricted.

## Current Permission Model

Source files:

* `lib/domain/schedule-types.ts`: roles are `developer`, `owner`, `manager`, `worker`, and `viewer`.
* `lib/permissions/roles.ts`: central permission helpers.
* `components/studio/studio-shell.tsx`: main studio UI gating.
* `components/poster/public-poster.tsx`: public poster and decorate-mode gating.
* `lib/schedules/*-actions.ts`, `lib/private-layer/actions.ts`, `lib/trusted-members/actions.ts`: server-side enforcement.

Current role rules:

* **Developer**: can edit schedules, tags, trusted members, passcode settings, stickers, assets, and support settings. Can open developer presence panel. Can unlock the private layer, but cannot create or read owner-only events.
* **Owner**: can edit schedules, tags, trusted members, passcode settings, stickers, assets, poster theme, and support settings. Can unlock the private layer and can read/create owner-only events.
* **Manager**: cannot edit normal schedule data, tags, trusted members, or passcodes. This role supports broadcast operations: checking pre-release/work-only items, editing support period/link, decorating posters, and exporting decorated posters.
* **Worker**: cannot edit normal schedule data, tags, trusted members, passcodes, or support period/link. This role supports creative production: virtual outfit work, artwork, image materials, stickers, and poster decoration.
* **Viewer**: sees public poster only. Can use public poster interactions such as month navigation, tag filters, agenda mode, support links, and heart/bookmark actions. Cannot access studio private data or editing tools.

## Current UI/Feature Inventory by Role

### Developer

Visible or available controls:

* Role badge in Studio topbar.
* Private-layer toggle. If no unlock session exists, opens passcode modal.
* Viewer-screen preview.
* Account switch/logout.
* Developer warning strip.
* Tag edit modal.
* Trusted member management modal.
* Developer presence/status panel.
* Decorate route link.
* Calendar event selection, creation, editing, deletion, drag/reorder, link-chain behavior.
* Event save button, visibility choice, tag picker, support editor, notice writer.
* Private passcode change controls.
* Poster decorate tools: undo/redo, emoji stickers, text stickers, custom image upload, sticker editing, duplicate/delete, export.
* Poster theme switch because `setPosterThemeAction` is provided for `canEditSchedule` roles.

Important caveat:

* Developer can edit most schedule data but cannot use the owner-only schedule option. The UI correctly shows that option only to owner.

UX issue:

* Developer tools are visually adjacent to normal owner tools. The role is operationally powerful and should feel like a maintenance/supervision mode, not a daily creator mode.

### Owner

Visible or available controls:

* Role badge in Studio topbar.
* Private-layer toggle and private warning banner after unlock.
* Viewer-screen preview.
* Account switch/logout.
* Tag edit modal.
* Trusted member management modal.
* Decorate route link.
* Full schedule event creation, editing, deletion, drag/reorder, and link-chain behavior.
* Event save button, visibility choice including owner-only, tag picker, support editor, notice writer.
* Private passcode set/change controls.
* Poster decorate tools, image upload, sticker editing, export, and poster theme switch.

UX issue:

* Owner is the primary daily operator, but the current top button row gives management, poster decoration, private schedule access, viewer preview, and account switching almost the same visual weight. The owner needs a clearer "schedule publishing desk" where schedule work comes first and management tools are grouped separately.

### Manager

Visible or available controls:

* Role badge in Studio topbar.
* Private schedule button and unlock window. After unlock, can read pre-release and work-only items, but not owner-only items.
* Viewer-screen preview.
* Account switch/logout.
* Decorate route link.
* In decorate mode: sticker editing, undo/redo, duplicate/delete stickers, export.
* Existing support-bar click opens a limited support settings sheet for support event duration/link updates.
* Public support links remain available.

Hidden or blocked controls:

* Tag edit.
* Trusted member management.
* Developer panel.
* Normal event creation/edit/delete/reorder.
* Owner-only schedule items.
* Poster theme switch.
* Worker-style production material management such as outfit/art reference assets.

UX issue:

* Manager is a broadcast operations helper. The screen should feel like a place to check how the schedule will appear to viewers, fix support links, and keep the poster ready.

### Worker

Visible or available controls:

* Role badge in Studio topbar.
* Private schedule button and unlock window. After unlock, can read pre-release and work-only items, but not owner-only items.
* Viewer-screen preview.
* Account switch/logout.
* Decorate route link.
* In decorate mode: sticker editing, custom image upload, image delete, undo/redo, duplicate/delete stickers, export.
* Work-related pre-release/work-only schedule details needed for production.

Hidden or blocked controls:

* Tag edit.
* Trusted member management.
* Developer panel.
* Normal event creation/edit/delete/reorder.
* Support period/link editing.
* Owner-only schedule items.
* Poster theme switch.

UX issue:

* Worker is not a chat/broadcast manager. This role is closer to a creative collaborator who works with Victory on production assets such as virtual outfits, artwork, and visuals. Support-link editing is less appropriate than reference schedule access, asset upload, decoration, and production status sharing.

### Viewer

Visible or available controls:

* Public poster.
* Month navigation.
* Public tag filters and agenda mode.
* Event heart/bookmark interaction.
* Support links.
* Login/account-switch button when applicable.

Hidden or blocked controls:

* Studio route editing tools.
* Private-layer toggle.
* Private data.
* Decorate tools.
* Export tools in normal public mode.
* Tag/member/developer/admin controls.

UX issue:

* Viewer mode should stay cute, clean, and poster-first. Login or account buttons should not compete with the poster. The viewer should understand the calendar and interact with public events, not learn the studio permission model.

## Notable Permission/UI Inconsistencies

### Trusted Member Management

* In `TrustedMembersPanel`, server actions allow owner or developer via `canEditSchedule`.
* In the standalone trusted-members page, fields and submit button are turned off unless the current user is owner.

Recommendation:

* Decide whether developer is truly allowed to manage trusted members. If yes, make both surfaces consistent and label developer action as "system maintenance." If no, tighten server actions and modal access accordingly.

### Developer Owner-Only Schedule Handling

* Developer can maintain most schedule data but cannot read or create owner-only schedule items.
* This is a good security rule. Since the developer role is technical and internal, the UI does not need a long explanation in the main workflow.

Recommendation:

* Quietly hide the owner-only schedule option from developer.
* If any explanation is needed, keep it short: "Owner-only items are visible only to the owner."
* Save longer permission explanations for manager/worker, where the difference is more likely to affect day-to-day use.

### Manager / Worker Event Details

* Manager or worker can open some event paths, but showing the owner editing form with most fields locked can feel confusing.
* A non-technical user may read that as "I clicked the right thing, but the app will not let me do anything."

Recommendation:

* Do not show the owner editing form to manager or worker.
* Show a simple event detail view with title, date, visibility, and links.
* Only manager should see "Edit support period/link" on support events.
* Worker should see support events as reference information, not as something to edit.
* In plain terms: manager can fix broadcast-support details, while worker can check production-relevant schedule details and manage visual materials.

## Benchmark Analysis

### YouTube / Twitch / TikTok LIVE: Managers Are Community and Broadcast Helpers

YouTube describes live chat moderators as trusted people who help build a positive and safe community experience, and separates standard moderators from managing moderators. Twitch describes moderators as people who help keep chat safe, welcoming, and fun. TikTok LIVE Studio also frames moderators around comment management, violation prevention, and engagement support.

References:

* YouTube Live chat moderators: https://support.google.com/youtube/answer/9826490
* Twitch Managing Roles: https://help.twitch.tv/s/article/Managing-Roles-for-your-Channel
* TikTok LIVE moderators: https://www.tiktok.com/live/studio/help/article/Boost-viewer-engagement/Add-moderators-to-manage-LIVE-chat-comments

VIC application:

* Manager should be treated as a broadcast operations and community-flow helper.
* Good manager features: support period/link editing, pre-release schedule checking, notice draft checking, viewer-screen review, and broadcast-link checking.
* If manager also owns outfit/art material management, the role becomes blurry.

### Patreon / Creator Team: Workers Are Creative Production Teammates

Patreon Team Accounts let creators invite teammates to help run creator work without sharing the owner login. The team lead keeps sensitive areas such as earnings, payouts, and teammate permissions, while teammates handle assigned responsibilities such as benefits, messages, page improvements, and content operations.

References:

* Patreon Team Account: https://support.patreon.com/hc/articles/360026751812
* Patreon Teammate permissions: https://support.patreon.com/hc/en-us/articles/360027997231-Teammate-permissions

VIC application:

* Worker should be a creative collaborator, not a chat manager.
* Good worker features: work schedule reference, outfit/image/sticker asset upload, poster decoration, production notes, and asset/status tracking.
* Removing support period/link editing from worker makes the role clearer.
* Worker should use their own account for limited production tasks, not borrow the owner account.

### Discord: Separate Spaces by Role

Discord combines roles and channel permissions so only specific roles can access specific spaces. Role colors and hierarchy also help members quickly understand someone's status and access.

Reference: https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions

VIC application:

* Manager and worker should not feel like the same screen with a few different buttons.
* Manager surface should focus on broadcast operations.
* Worker surface should focus on production materials.
* Role badges for manager and worker should differ clearly in color and description.

### Slack: Permission Tables and Role Clarity

Slack documents permissions by role in explicit tables. It distinguishes owner/admin, member, and guest capabilities and makes it clear which permissions are default, configurable, or unavailable. This is useful for VIC because the current app already has well-defined roles but lacks a visible role capability map in the product UI.

Reference: https://slack.com/help/articles/201314026-Permissions-by-role-in-Slack

UX pattern to adopt:

* Show concise role summaries in role badge tooltips or a "What can I do?" popover.
* Avoid forcing users to infer role capability from missing buttons.

### Figma: View/Edit/Admin Separation

Figma separates viewing, editing, and administration. The useful lesson is that viewing and editing are not just on/off versions of the same screen; they are different work modes. A viewer is not a failed editor. A viewer needs a purpose-built experience.

Reference: https://help.figma.com/hc/en-us/articles/360039970673-Team-permissions

UX pattern to adopt:

* Treat viewer preview, manager/worker studio, owner studio, and developer mode as separate work modes with different layouts.
* Do not show the owner editing screen in a locked state to users whose job is not owner editing.

### Linear: Minimal, Focused Administration

Linear groups member/role administration under settings and uses role/status filters in admin member lists. It separates workspace-level administration from normal team work, so standard members are not distracted by admin controls.

Reference: https://linear.app/docs/members-roles

UX pattern to adopt:

* Move team/access controls into a single "Access" or "Team" surface.
* Keep daily schedule operations separate from account and permission administration.

### GitHub: Predefined Roles and Least-Privilege Labels

GitHub documents predefined organization roles such as owner, member, security manager, billing manager, and app manager. The pattern is not that every role gets a button row; each role is named by responsibility and mapped to permission groups.

Reference: https://docs.github.com/organizations/managing-peoples-access-to-your-organization-with-roles/permissions-of-predefined-organization-roles

UX pattern to adopt:

* Use role labels that communicate responsibility: "Owner: Publishing & Access", "Manager: Support & Decoration", "Developer: System Maintenance."
* Avoid generic role badges that do not explain operational scope.

### Atlassian: Delegated Administration

Atlassian emphasizes delegated responsibility among multiple admin roles instead of a single all-powerful user. This maps well to VIC's distinction between owner, developer, manager, and worker.

Reference: https://support.atlassian.com/user-management/docs/what-are-the-different-types-of-admin-roles/

UX pattern to adopt:

* Separate "delegated operational tasks" from "ownership tasks."
* Manager/worker should see the areas they are trusted with, not an owner management panel with many unavailable controls.

### Notion: Members, Guests, and Workspace Owners

Notion distinguishes workspace members, guests, owners, restricted members, and membership admins. The product lesson is that collaboration roles should be understandable to non-technical users and tied to the scope of visible content.

Reference: https://www.notion.com/help/whos-who-in-a-workspace

UX pattern to adopt:

* Explain manager/worker access in plain language: "Can decorate and update support links; cannot change broadcast schedule."
* Explain private-layer unlock as temporary access, not general ownership.

### Material Design / Accessibility: Disabled Controls Need Context

Material Design accessibility guidance emphasizes clear layouts, distinct primary actions, and support for assistive technologies. For permissions, the practical lesson is that locked controls should not be the main way to explain role boundaries.

Reference: https://m2.material.io/design/usability/accessibility.html

UX pattern to adopt:

* Hide unavailable role actions when they are permanently unavailable.
* Use locked or inactive controls mainly for temporary states such as saving, uploading, or missing required input.
* When a role is not allowed to do something, use a clear view-only surface and short explanation instead of inert buttons.

## Recommended Role-Based UX Architecture

### 1. Role-Aware Header

Current problem:

* Role badge, private toggle, viewer preview, and account switch are visually equal.

Recommendation:

* Left: calendar title and current KST month.
* Center or secondary row: current mode chip, such as "Owner Studio", "Manager Decoration", or "Viewer Preview".
* Right: identity menu with role badge and account switch.
* Private-layer state should be a security/status chip, not just another button.

### 2. Functional Action Groups

Current problem:

* Tag edit, member management, developer presence, and decoration are presented as sibling buttons.

Recommendation:

* **Schedule**: add/edit events, notice writer, tags.
* **Access**: private layer, passcode, members.
* **Poster**: decorate, export, sticker assets.
* **System**: developer presence, diagnostics.

### 3. Role-Specific Primary CTA

Recommended most-visible action per role:

* Developer: "Open diagnostics" or "Review system state"; schedule edit remains available but not visually dominant.
* Owner: "Add schedule" or "Edit selected date"; the app should feel like a publishing cockpit.
* Manager/Worker: "Decorate calendar" or "Update support link"; the app should feel contribution-focused.
* Viewer: no studio CTA; focus on poster navigation, hearts, and support links.

### 4. Manager/Worker Event Detail Mode

Current problem:

* Users who cannot edit may see an owner-style edit form with locked fields.

Recommendation:

* Give manager and worker a simple event detail view.
* Normal events should be view-only: title, date, status, links.
* Only manager should see "Edit support period/link" as the main available action on support events.
* Worker should not see the support edit button; worker should instead see production references, asset upload, and decoration flow.
* Private events should use plain labels such as "pre-release" or "work-only"; owner-only items must never appear.

### 5. Developer Maintenance Mode

Current problem:

* Developer actions sit beside owner actions, making the role feel like an ordinary editor.
* Developer can currently preview the viewer screen, but checking the owner or manager/worker experience still requires account switching or changing permissions.

Recommendation:

* Use a distinct "Developer mode" panel with:
  * presence counts,
  * role distribution,
  * environment/build metadata,
  * privacy reminder that owner-only items are excluded.
* Keep destructive or permission-sensitive actions behind an explicit maintenance grouping.
* Add a developer-only "Preview as role" tool.

Preview-as-role structure:

* **Preview as viewer**: shows the public poster and public schedule only. Editing, decoration, and private buttons are hidden.
* **Preview as owner**: lets the developer inspect owner button layout, schedule-editing flow, tag/member/private management placement, and overall owner experience. It must not become a way for developer to see owner-only private content.
* **Preview as manager**: lets the developer inspect the broadcast manager experience. Normal events should open as simple details, while support events should make the period/link edit button easy to find.
* **Preview as worker**: lets the developer inspect the creative collaborator experience. Work schedule details, reference materials, image upload, and poster decoration should be easy to find. The support edit button should not appear.

UX principles for this feature:

* This is a screen-checking tool, not permission borrowing.
* Save, delete, member changes, passcode changes, and other risky actions should be blocked inside preview mode.
* The preview state should always be visible at the top. Example: "Developer preview: viewing as manager."
* Exiting preview should immediately return to the normal developer screen.
* Keep the controls in one place and name them plainly: "View as viewer", "View as owner", "View as manager", "View as worker".

### 6. Owner Publishing Cockpit

Current problem:

* Owner sees many unrelated actions with similar button weight.

Recommendation:

* Owner landing should prioritize:
  * current month,
  * add/edit schedule,
  * private state,
  * poster readiness/export.
* Team management and tag management should live in a grouped admin menu or side panel.

### 7. Viewer Poster-First Experience

Current problem:

* Viewer account/login buttons can compete with the public poster when shown too strongly.

Recommendation:

* Keep viewer UI poster-first.
* Place login/account switching in a quiet top corner or menu.
* Keep hearts, filters, and support links visually playful and easy.

## Priority Recommendations

### P0: Preserve Security Boundaries

* Do not expose private fields in public or viewer surfaces.
* Do not make manager/worker schedule-editable.
* Do not allow developer to read or create owner-only content unless the product rule changes explicitly.
* Do not rely on client-only hiding for any permission.

### P1: Reorganize the Header and Top Button Row

* Replace the current flat row of mixed buttons with grouped zones.
* Split identity/mode controls from work actions.
* Add role summary text via popover or tooltip.

### P1: Stop Showing Owner Editing UI to Manager/Worker

* Manager and worker should get a simple event detail view.
* Only manager should get the support period/link edit action on support events.
* Worker should focus on work schedule references, asset upload, and decoration flow instead.

### P1: Split Manager and Worker Permissions

* Define manager as the broadcast operations role: support period/link editing, pre-release schedule checking, notice draft review, viewer-screen review.
* Define worker as the creative production role: work schedule references, outfit/image/sticker asset upload, poster decoration, production status.
* Remove support period/link editing from worker.
* Give manager and worker clearly different badge colors and plain role descriptions.

### P1: Make Private-Layer State More Legible

* Use plain state labels: locked, passcode needed, private items visible, owner-only items excluded.
* Owner gets stronger warning copy when private layer is visible.
* Manager/worker gets short copy clarifying that owner-only items remain hidden.

### P2: Improve Admin Surfaces

* Combine member management and passcode settings into an Access panel.
* Make standalone and modal trusted-member permissions consistent.

### P2: Add Developer Role Preview

* Give developer-only buttons for "View as viewer", "View as owner", "View as manager", and "View as worker".
* This preview must be for interface review only, not real permission escalation or data mutation.
* During preview, block risky actions such as save, delete, member changes, and passcode changes.
* Manager preview should focus on normal event details and the support period/link edit button.
* Worker preview should focus on work schedule details, asset upload, and decoration flow, and should confirm that support editing is hidden.
* Owner preview should focus on owner layout and management placement, while never newly exposing owner-only schedule content to developer.

### P2: Improve Decorate Mode by Role

* Owner/developer: sticker tools plus poster theme.
* Manager: sticker tools, export, and support period/link editing, but no theme controls.
* Worker: sticker tools, image upload, and export, but no theme controls and no support editing.
* Viewer preview inside decorate mode should temporarily remove edit/export buttons, as it already does conceptually.

## Suggested Future Information Architecture

### Developer

* Header: Developer Mode, current account, account switch.
* Primary zone: System Diagnostics.
* Secondary zones: Schedule Maintenance, Access Maintenance, Poster Maintenance, Role Preview.
* Explicit note: owner-only content excluded.

### Owner

* Header: Owner Studio, private-layer status, viewer preview, account menu.
* Primary zone: Schedule Publishing.
* Secondary zones: Access & Team, Tags, Poster Decoration.
* Warning-heavy private state when active.

### Manager

* Header: Manager Studio, private-layer status, viewer preview, account menu.
* Primary zone: Support Operations.
* Secondary zone: Broadcast link checking, Poster Decoration.
* View-only event details for normal events.

### Worker

* Header: Worker Studio, private-layer status, viewer preview, account menu.
* Primary zone: Work Schedule and Production Materials.
* Secondary zone: Image upload, sticker/poster decoration, production status.
* Support period/link is view-only and cannot be edited.

### Viewer

* Header: minimal poster identity, month navigation.
* Primary zone: Public calendar/poster.
* Secondary interactions: filter, hearts, support links.
* Auth controls: quiet and secondary.

## Final Strategic Direction

VIC Schedule Studio should not present roles as a permission matrix made visible through missing buttons. It should present each role as a different job:

* Developer maintains the system.
* Owner publishes the schedule.
* Manager supports broadcast operations and support links.
* Worker supports production assets and decoration.
* Viewer enjoys and reacts to the public calendar.

The code already enforces most of this. The UI should now make that mental model obvious.
