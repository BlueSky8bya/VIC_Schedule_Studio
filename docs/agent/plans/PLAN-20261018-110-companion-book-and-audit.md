# PLAN-110 — Companion book and reuse audit

Status: Local validation complete; release verification pending. Owner request 2026-10-18 KST.

## Scope

- Report only: inventory companion affordances, propose content loops using existing assets, and an appearance-preserving optimization/OBS plan. No speculative gameplay/pipeline implementation.
- Implement: replace house plant with a book opening the same companion settings in a book presentation; radio attenuation/default all-mood behavior; food-specific short facts; combined memories collection; accessory direction/occlusion correction; gift chance0.05–0.1% per explicitly bounded opportunity.
- Preserve shared studio/viewer/preview, saved preferences/collections, mobile exclusion and privacy. No server/schema/auth/role/DTO/data changes. No production-data tests. Preserve protected user art note and all untracked sources.

## Work and review

Root: book/shared modal wiring, activity contract, report/integration. Parallel owners: radio/gifts; collections/facts; accessory geometry/visual audit. Independent boundary/UX/QA review precedes integration. Reuse parent modal/focus/pause ownership; no second settings implementation or ambient loop.

## Validation

Probability/serialization, radio gain/preferences, all-food facts, unified discovery and accessory transforms; timeline/least-used audit; typecheck/lint/full units/build/harness; production-build guarded viewer/studio/preview interactions and screenshots. Actual broadcaster hardware/OBS and human speaker listening remain separately unverified.

## Next

Concrete changes, independent reviews, [report](../verification/COMPANION_REUSE_OPTIMIZATION-20261018.md) and [scoped verification](../verification/COMPANION_BOOK_FIXES-20261018.md) complete locally. Final build passes233files/2546units/type/lint/build/harness283 and book10/activity3/nativewearables3; unchanged-source earlier collection7/radio-gifts7/baselines2 retain their exact scopes. Next: one authorized release, public full-SHA/static proof and guarded anonymous UI, preserving previous evidence and user assets. Broad ideas/optimization remain proposal-only.
