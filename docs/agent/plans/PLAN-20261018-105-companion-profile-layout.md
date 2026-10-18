# 105 — Readable companion profile

## Authorization and scope

2026-10-18 owner request: research game pet/character profiles, apply a more readable game-like traits/habits layout, and suggest further fitting ideas. Existing session commit/push/release authorization continues. Extra gameplay ideas remain proposals only.

## Design and boundaries

- Official Neko Atsume Catbook: https://nekoatsume.com/en/about.html — name/portrait, labeled personality and favorite items establish a scan order.
- Ooblets creator's June 2018 development screen: https://ooblets.com/2018/06/moving-into-an-office-e3-friendship-and-more-the-june-2018-devlog/ — anchored character identity and regular experience slots. Historical design reference, not a claim about its current UI.
- Apply identity/favorite → four qualitative traits → earned habits → recent experience in one compact shared profile; manual settings follow. Rename the visible subtab to 프로필, retaining its key and analytics action.
- Reuse settings tokens, existing fruit/icons and subscriptions. No fabricated XP, percentage meters, levels, extra bitmap downloads, polling or animation loops.
- Preserve distinct life/habit models, actual qualitative thresholds, reset scope, local persistence, keyboard navigation and all surface/capability gates. Mobile companion remains excluded.
- No API, database, authority, private/public DTO, KST or preference-model changes. Preserve user art and unrelated drafts.

## Work and verification

1. Read-only UI audit and official visual research (complete).
2. Shared component/CSS implementation and affected selectors.
3. Native rendered viewer/studio/preview, light/dark, narrow desktop, empty/learned/off/reset/reload/storage event and keyboard checks. Inspect before/after images.
4. Independent diff review; typecheck, lint, tests, build and harness.
5. Scoped commit/push, verify full deployed SHA and actual authenticated production UI. Record limitations separately from tested fixtures.

Status:complete. Shared implementation and independent source/rendered reviews complete. Local2,236 unit/typecheck/lint/build/harness269 and20 native rendered cases PASS. Release `edcf2a93a5d1f6a45ec037d1d261a3be325663cd`, remote quality39100282369/all13 steps, Vercel success, exact deployed SHA/public boundary canaries and actual authenticated developer-studio profile verified. The original month/right-folded panel was restored. Coverage and hardware limits are in [the105 record](../verification/COMPANION_PROFILE_LAYOUT-20261018.md). No required implementation/release work remains; extra ideas remain proposals. Post-release metadata stays local for the next authorized product commit.
