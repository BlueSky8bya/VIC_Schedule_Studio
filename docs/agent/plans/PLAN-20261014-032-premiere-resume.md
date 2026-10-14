# PLAN-032 — Resume a dismissed premiere

Date: 2026-10-14 KST
Status: Locally verified; authorized deployment pending

Closing the preparation chip/stage currently adds its generations to the coordinator's skip set until remount. Provide a small “최초공개 다시 보기” action on the same viewer page, in the existing preparation-chip position. No extra clock, explanation or automatic re-entry.

- Track explicit dismissals separately from automatic timeout, late arrival and preference/modal stops. Offer re-entry only for validated, still-future masked entries in the viewed month while the stage is enabled, motion allowed and no blocking overlay open.
- Manual re-entry clears only eligible dismissed generations and the automatic rest; continue from synchronized current time through the existing planner. Each explicit viewing session retains the 90s cap. Keep fired/observed publication state and flash budget; never replay published content or reset time.
- One shared hook/action across anonymous viewer and studio viewer preview. No DTO, API, polling, DB, role, unlock or KST change; export geometry remains 1840px. Preserve Escape/back/focus and normal calendar interaction after dismissal.
- Verify PC/mobile close → manual resume, real countdown continuity, no automatic reopening, repeated close, release/deletion and settings/reduced-motion suppression. Relevant units/browser checks, typecheck/lint/build and rendered inspection. Independent G-21 review before integration; authorized push followed by deployed-client verification.

This supplements PLAN-031's exit behavior: dismissal continues to suppress automatic re-entry; an explicit action can now resume a pending premiere.

Implemented. Final fresh-build focused browser checks: 12 PASS; relevant units/memory: 115 PASS. Typecheck/lint/build PASS. Two new resume baselines and one existing mobile invitation mask-edge refresh reviewed. Independent review findings resolved. [QA](../verification/TEASER_RESUME-20261014.md) records initial/intermediate failures, corrections and unchanged global harness gaps. No DB writes or additional requests on resume.
