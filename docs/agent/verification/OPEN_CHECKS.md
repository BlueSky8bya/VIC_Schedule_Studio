# Open verification and operations checks

Updated: 2026-09-09

This file keeps unresolved evidence gaps out of startup history. A prior PASS applies to its tested revision and scope only. Recheck before closing; do not infer current production state from old notes.

## VERIFY-PUBLIC-002-003 — reconcile historical issue labels

- ISSUE-002 originally reported no mobile “이 달 기록” entry. Later history says the entry was restored. Confirm current viewer mobile/landscape entry, keyboard/touch operation and modal exit in a fixture and, where available, deployed viewer.
- ISSUE-003 originally reported unredacted teaser titles in studio viewer preview. Later P0-SEC-2 history says preview uses refreshed server public snapshots. Confirm current `preview-actions.ts` and preview consumers, explicit DTO construction, no private title in DOM/RSC before reveal, and failure behavior.
- These are conflicting historical records, not newly confirmed production defects. Close with current code/test evidence; preserve findings in the relevant security/QA record.

## VERIFY-REAL-SESSION — coverage boundary

Available layers: `tests/visual/studio-editor.spec.ts` uses fixtures and intercepts write commands; `test:integration` exercises actual DB actions with a fixed owner actor/service-role. Neither proves real-login RLS behavior.
Keep genuine-login refresh/unlock/revocation, two-device session independence, rate limits, real pen input and screen-reader/device checks separate when affected. Do not add a production authentication bypass to make a test pass.
Use existing [broadcast tools checklist](../../ux/broadcast-tools-qa-checklist.md) and [visit insights checklist](../../insights/visit-insights-qa-checklist.md) only for their relevant unverified items.

## OPS-ANALYTICS-CLEANUP — no deletion authorized by this record

The 2026-09-04 history identified local/automated traffic in production analytics and described prepared backup/SQL under `.scratch-pw/`. It explicitly said cleanup had not run before owner approval.
Before a cleanup: inspect current source data, confirm the exclusion predicate, create/verify a recoverable backup, identify user authorization and preview exactly what would be deleted. Old file paths and row counts are not current evidence.
New analytics paths must use `lib/analytics/guard.ts`; UI checks should use route stubs. Actual DB integration tests use past months, the established test marker, cleanup and zero-residue verification.

## Deferred product choices

No current request to implement attendance, VOD full-text search, special-day ambient content, or replace the remaining poster themes. Existing plans are research/backlog only.
Historical “apply migration 0051” instructions do not establish a pending migration. Check actual migration history and authorization before any schema operation.
