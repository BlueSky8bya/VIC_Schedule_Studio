# Current State — VIC Schedule Studio

Last Updated: 2026-10-17 (KST)
Project Version: 0.1.0

Current work only. Completed plans/rounds are evidence, not instructions. Previous accumulated state is preserved byte-for-byte in [the snapshot](archive/20261017-CURRENT_STATE-before-platform-remediation.snapshot.txt); use topic records for current behavior.

## Current Objective

Current: observe operating costs and close provider/real-device evidence after the authorized platform release. Implementation/release results are in [080](verification/PLATFORM_REMEDIATION-20261017.md). Preserve user art/preview changes; no production deletion, bulk UPDATE, paid-plan change or permission expansion. Diagnostic cleanup awaits its exact separate approval.

Shared viewer/studio/preview implementation, public DTO/DB-time teaser gate, owner-only private content, Google+passcode/session binding, KST and serial writes remain mandatory. Companion defaults ON only for PC without saved choice; explicit choices persist. Mobile companion stays excluded. Actual OBS hardware/real-session/provider evidence stays distinct from fixtures.

## Active Work

| ID | Status | Next | Record |
|---|---|---|---|
| OPS-DB-QUOTA | Watch | DB272.26MB/259.64MiB on10/17; reduce duplicate rebuilds before capacity changes. Actual plan/disk/WAL/backup unverified | [DB audit](verification/PLATFORM_AUDIT_DB-20261017.md) |
| PRIVACY-20260921 | Follow-up | Historical Git exposure, legacy realtime clients, provider/retention and real-login evidence | [Privacy audit](verification/PRIVACY-20260921.md), [checks](verification/OPEN_CHECKS.md) |
| ART-PINE-PILOT | Awaiting Owner | Owner selects reference PNGs to remove; freeze replacement run only afterward | [Pine handoff](../ambient/HANDOFF-20260908-pine.md) |
| RULE-ART-COMPLETION | Awaiting Owner | Review presentation/legacy-source placement and B/C choices | [Plan](plans/PLAN-20260909-014-rule-preservation-and-art-completion.md) |
| MARINE-RESUME | Paused by owner | Static concepts retained; seasonal layers/waves future work | [Handoff](handoffs/20260916-marine-biomes-resume.md) |
| AMB-QA-18 | Planned | Reproduce candidates on one fixed build | [QA](../ambient/QA_PROGRESS.md) |
| OPS-ANALYTICS-CLEANUP | Awaiting authorization | Current selection, recoverable backup and explicit deletion authorization required | [Checks](verification/OPEN_CHECKS.md) |
| VERIFY-REAL-SESSION | Planned | Genuine roles/unlock/revocation/device/storage/RLS; reconcile old public issue labels | [Checks](verification/OPEN_CHECKS.md) |

## Blockers

- Supabase dashboard is logged out. DB aggregates do not establish account quotas/egress/backup/PITR/restore capability. Phone login does not authenticate PC Chrome. Continue independent fixes.
- Actual broadcaster hardware, mobile/screen reader and formal flash/fanout capacity remain unverified. Fixtures do not guarantee zero dropped OBS frames.
- Pine curation remains owner-only: all nine references retained. Existing frozen pilot has stale manifest contract; replace it, never normalize/promote. No new pine generation authorized by platform work.
- Art legacy-source policy/B/C selections remain owner decisions. Style captures stay byte/name intact and classification-only; prior attachment authorization never permits copying them into deliveries.
- Production analytics cleanup has not run; historical counts/backups are not current authorization/evidence.

## Next Exact Steps

1. OPS-DB-QUOTA: compare post-release route/RPC/cost metrics with the same period/denominator; verify actual account quotas/backups when dashboard access is available. No automatic future run was created.
2. ART-PINE-PILOT: only on owner curation, remove named references and freeze fresh variants2/3 request. Preserve the old pilot/approved inputs.
3. RULE-ART-COMPLETION: wait for pending presentation/source-policy choices; unrelated work grants no approval.
4. VERIFY-REAL-SESSION: use synthetic canaries and real authority; fixture/service-role tests never establish genuine-login RLS.
5. OPS-ANALYTICS-CLEANUP: wait for approval of exactly14,209 expired diagnostic rows. Restricted encrypted backup/round-trip verified; no deletion/ongoing cleanup enabled.

## Last Verified

Current [080 verification](verification/PLATFORM_REMEDIATION-20261017.md): product9aefbd29 deployed/API18; finalaac6b78d Vercel Ready and remotequality38992818125 all PASS(unit1894, SQL4, harness, real-font build, typecheck/lint). Fixture28+popup2/SW3 PASS. 0151 applied with restrictive grants/cron unchanged. Original failures retained; actual OBS/provider and diagnostic-deletion approval remain separate. [079](verification/PLATFORM_AUDIT-20261017.md) is the read-only baseline.

Accepted behavior: [UI rules](../ux/UI_RULES.md), [077 audit](verification/COMPANION_COMPREHENSIVE_AUDIT-20261017.md), [076 broadcast pipeline](verification/COMPANION_BROADCAST_PIPELINE-20261017.md). These scoped historical checks do not prove current changes. Completed work remains in topic files and preserved snapshot.
