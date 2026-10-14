# Premiere manual resume — 2026-10-14 KST

Scope: [PLAN-032](../plans/PLAN-20261014-032-premiere-resume.md). Status: locally verified; authorized production rollout pending.

Explicitly closing the preparation chip/stage leaves one small “최초공개 다시 보기” action at the existing bottom preparation-chip position. Calendar interaction resumes immediately. Clicking continues the shared planner at the actual synchronized time; it neither resets time nor replays already-public items. Repeated dismissal is supported, with keyboard focus returned to the new resume action.

Automatic preference/modal/timeout stops do not create a manual-resume offer. Eligibility requires a validated, future masked generation in the viewed month, stage ON, motion allowed, synchronized clock, online/visible state and no blocking overlay. Release/deletion invalidates the offer; authoritative rescheduling starts the existing generation transition. Manual re-entry bypasses the automatic 30s rest and starts a new 90s viewing budget by explicit request. Fired/observed state and flash budget stay intact.

Independent G-21 review found lost focus when the original trigger unmounted and stale dismissal state on A→B→A rescheduling. Both fixed; reviewer rechecked source. Expanded browser checks also exposed an existing one-commit stale screen-reader announcement during re-gating; announcements now carry their publication-set key and render only for the matching current set, including partial multi-item re-gating. Reviewer confirmed this final guard.

## Evidence

- Initial production-build browser run: 38 PASS / 2 FAIL, including all seven new resume cases PASS. Failures were the existing invitation snapshot's transformed timer-mask edge (440×441 versus 441×440; only 880 boundary pixels) and the stale announcement described above. Snapshot setup now freezes decorative digit drift, with the actual clock still live. Desktop/mobile mask-edge differences reviewed; the mobile invitation baseline refreshed, product composition unchanged.
- Intermediate focused rerun: 10 PASS / 2 FAIL. The fixed mobile mask differed from its old moving edge by one column (287 pixels, reviewed); the chain test sent native Escape before the newly mounted keyboard effect attached. That case now uses the real visible exit button; separate keyboard cases remain. New PC/mobile resume-control baselines reviewed; no screenshot threshold relaxed.
- Relevant units and memory/rule checks: 115 PASS (72 premiere/public-DTO/hype + 43 memory/rule).
- Final fresh-build focused browser run without updates: 12 PASS, including all seven resume cases, two invitation baselines, reduced motion, re-gating and return fade. No clock mocking.
- Final standalone typecheck/lint and production build: PASS. Two new resume-control baselines PASS and visually reviewed; only the mobile invitation mask edge changed among existing images.
- Main-route local synthetic smoke at 1440/390px: PASS. Preparation X and stage Escape → calendar → manual resume, target unchanged, live countdown decreases, one timer, repeat close/focus restoration, no horizontal overflow/page errors. All POSTs intercepted: two blocked per viewport, zero sent.
- Local rendered review: small dark pill, legible label, 44px target, existing bottom controls/safe area clear; outside the fixed 1840px export surface. New control adds no numeric timer.
- Global harness: FAIL, same two existing RULE_MIGRATION active-ID/inventory mismatches. No rule changes; unrelated global-unit/geometry gaps from PLAN-031 remain outside this change.

## Boundary and limits

No server/API/DTO/DB/schema/auth/unlock/role/KST/dependency change. Public-only records and the existing clock/poll/planner/choreography are reused; additional requests per resume: zero. Browser fixtures and synthetic past-month GET substitutions only, all POSTs intercepted, no real schedule writes.

Genuine authenticated production preview, physical assistive/mobile devices and inherited provider/performance/subjective-immersion checks remain unverified. Shared source/fixture checks do not establish those claims.
