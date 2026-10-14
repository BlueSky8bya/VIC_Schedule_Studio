# PLAN-031 — A moment worth waiting for

Date: 2026-10-14 KST
Status: Deployed and verified — 4a34433a

Owner asks for a substantial premiere redesign informed by HCI, temporal experience and restrained beauty (검이불루·화이불치). Scope includes the calendar-to-premiere journey, not unrelated studio/VOD/ambient features. Preserve PLAN-030's single countdown, stable public preview entry, title/subtopic hierarchy and 10→2s retreat. Replace the generic dark modal composition and ornamental light blobs with one recognizable invitation, one focal plane, a small voluntary response and a legible reading moment.

## Experience

1. Approach (180→75s): existing staggered chrome/cards yield; seeded departure slots and 1840px geometry stay. A quiet invitation identifies the upcoming moment without multiplying clocks.
2. Enter (68→60s): existing card carrier/FLIP connects to a cinema-like editorial surface. A real, transparent Tori reference becomes the host at the edge, not another central focal point. No unverified teaser hints.
3. Gather (60→10s): a restrained pair of translucent folds contracts toward the single honest countdown. Existing irregular digit texture stays bounded. Hope presses send one small star toward the shared center, with immediate local feedback; no invented crowd totals, claims of remote synchrony or extra DB requests.
4. Stillness (10→2s): folds, host, ring, labels and hope controls withdraw smoothly; the one numeral grows. No circulating particles, flashes or idle movement. Visible exit remains usable.
5. Open (server-confirmed only): one low-luminance opening wave, warm reading surface, editorial title/subtopics/date. Same public DTO and existing fanfare/haptic gates. Provide a way to keep reading the already-public content without extending the automatic full-screen budget.
6. Return: preserve exit/Escape/back, focus restoration, hidden-tab rules, cancellation/re-gating and 90s cap/30s rest.

## Boundaries and implementation

- All roles and both viewer routes continue through the same PublicPoster/PremiereStage. No auth/unlock, migration, API, polling, clock, KST or release authority change.
- Original references are read-only. Use REF-004's existing transparent Tori portrait as an optimized, local WebP; no character redraw or generative identity substitution. Reference screenshots containing room/UI and low-resolution vitamin diagrams are research inputs, not automatically production assets. Record provenance, hash and derivative operation.
- Shared synchronized clock/hype curve writes phase variables; no second rAF/clock loop or pointer tracking. Transform/opacity animation; no global filter, new dependency, canvas or video.
- Respect actual agenda topology, reduced motion, gfx off/lite, hidden tabs, contrast, keyboard focus, safe area and <3 flashes/s. Decorative media never carries timing/release information.
- Reading continuation must reuse the existing public detail, not a second independently fetched viewer. Avoid automatic disappearance while someone is trying to read long released text.

## Research and verification

Record primary sources, evidence strength, concrete adaptations and limitations in a companion research record. Research does not establish that this UI changes psychological time or guarantees immersion.

Before integrating: independent UI/security/QA review required by G-21. Production build + relevant units/typecheck/lint; fixture interactions at 1440/390/landscape-touch, off/reduce/gfx, final seconds, release/multiple/re-gating, one clock/preview stability. Review intentional baseline changes before accepting; no real DB fixture writes. Then authorized commit/push and deployed build/client verification.

Implemented and locally verified. 78 browser cases PASS, then 40 after the monotonic flash-budget correction, 16 after light/dark reading-control contrast, and final 17 after the return fade correction. Both clock-budget and return regressions failed before their fixes and passed after fresh builds. Relevant units 72 PASS; typecheck/lint/build PASS; 6 intentional PC/mobile baselines reviewed. [QA](../verification/TEASER_KAIROS-20261014.md) distinguishes all scopes and unverified human/device/provider evidence. No DB/schema/API/dependency changes.

Committed/pushed as 4a34433a; Vercel and production build verified. Deployed main-route synthetic client smoke PASS including original portrait, wish response, final focus, public release, mobile reading continuation and restored interactions; zero page errors/server writes. [QA](../verification/TEASER_KAIROS-20261014.md) records exact scope and remaining evidence gaps.
