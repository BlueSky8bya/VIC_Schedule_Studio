# Open verification and operations checks

Updated: 2026-10-17

This file keeps unresolved evidence gaps out of startup history. A prior PASS applies to its tested revision and scope only. Recheck before closing; do not infer current production state from old notes.

## PLATFORM-080 — 배포 후 운영·비용·외부 증거

[079 감사](PLATFORM_AUDIT-20261017.md)는 읽기 전용 기준 기록이다. 이후 소유자 승인으로 코드·의존성·0151을 수정했다. 현재 구현과 검증 범위는 [080 적용 기록](PLATFORM_REMEDIATION-20261017.md), [backend](BROADCAST_WORK_BOUNDS-20261017.md), [client](PLATFORM_CLIENT-20261017.md)를 따른다.

- 운영 효과: 새 readiness stage·실패율/CPU/Fluid 점유·수집/RPC 호출·DB 임시 파일 증가량을 같은 기간/분모로 비교. warm204는 공개 readiness만 뜻하며 모든 인스턴스/Data Cache가 warm하다는 증거가 아니다. 프로세스 밖 중복은 가능하고 Redis/분산 compute lease는 미도입이다.
- 외부 미확인: 실제 Supabase 플랜·egress/storage/auth/realtime/pool·전체 disk/WAL·backup/PITR/복구 가능성, 보존 flag boolean. PC dashboard 로그인 필요; 휴대폰 별도 로그인은 PC 세션에 이어지지 않는다. 079의42703 조회는 보존했고 080에서 카탈로그 확인 뒤 read-only 재조회했다.
- 권한: net 익명DataAPI406, activity401, publicview limit0=200은 그 경로만 확인했다. 실제 로그인 역할·RPC/storage·grant 만료/철회/다른 기기와 과거 유출 전체 검증을 대신하지 않는다. 민감 원문은 보고서/로그에 복사하지 않는다.
- 유지보수: production npm audit0. 개발 ESLint 경로 braces3.0.3 advisory는 공식 patch가 없어 영향5 high가 남는다. 불신 glob/config 입력을 lint에 주지 않으며 upstream patch 때 재검토한다. 원격quality38992818125 전 단계 PASS; 원 실패와 실제 이미지 통합 검사1개30초 조정은080 기록 참조.
- 경계: 새 activity64KiB byte 제한·검색 진행 키128개 cap은 분산 rate limit이 아니다. provider WAF/전역 rate 정책은 실제 트래픽·정상 입력 보존을 검토해 별도로 정한다. 공개 DTO/import·격리 canary가 실계정 RLS 전체를 증명하지 않는다.
- 실제 장비: OBS/SOOP 캡처·인코딩 동시 frame cadence, 장시간 memory plateau, 모바일·coarse landscape·focus/screen reader·formal flash·멀티리전 nano capacity는 별도. 기존 fixture 결과로 완료 처리하지 않는다.

최초 관측 Vercel CPU6시간47분/4시간·Fluid Memory460.1/360GB-hours, DB272.26MB. 측정 기간/계량은 감사 본문 참조. 수정 뒤 같은 기준의 route·RPC·사용량 변화로 효과를 확인하며 절감률을 미리 단정하지 않는다.

## COMPANION-BROADCAST — 실제 OBS/SOOP 장비

[PLAN-076 검증](COMPANION_BROADCAST_PIPELINE-20261017.md)은 실제 decoded 이미지의 단일 표시 경로, 중복 표시 쓰기/저장소 조회 제거와 native fixture를 확인한다. 실제 토리님 방송 PC의 GPU·OBS 합성/인코딩·SOOP 송출을 함께 측정하지 않았다. 장면/캡처 방식·브라우저 하드웨어 가속·GPU 여유에 따라 결과가 달라지므로 무끊김을 보장하지 않는다.

이전 COMPANION-TEXTURE 간격은076 후보 빌드 `-S59OcmbVUz2SMdS-qZsY`에서 수정·검증했다. cold 지연 packet 중 기존 몸체 유지/동일 decoded DOM/요청1회, 원래20 warm-pixel 기준을 유지한 음식 관찰에서 시청자395·편집실331픽셀을 확인했다. [075 원 실패](COMPANION_HABITS-20261017.md)와 `.scratch-pw/companion-075-inspect-failure.{json,png}`는 보존한다. 이 fixture 결과는 실제 방송 장비와 운영 빈도의 증거가 아니다.

## TEASER-PREMIERE — authorized rollout and remaining QA

Latest visual/motion rework and exact verification scope: [premiere moment](TEASER_KAIROS-20261014.md), following [countdown focus/preview continuity](TEASER_FOCUS-20261014.md), [individual card choreography](TEASER_CARDS-20261014.md) and [fluid redesign](TEASER_FLUID-20261014.md). These do not close genuine-login preview, hardware, formal luminance, fan-experience observation or deployed fanout gaps below.

See [release evidence](TEASER_PREMIERE-20261014.md). Functional release a6c60ca9 deployed/verified. 0142 applied with verified TLS; real anon/unprivileged-authenticated SQL canaries and anonymous REST passed (rolled-back past-date rows, zero residue). Actual Next HTTP-to-stub-DB bursts at 1/100/1,000 requests on one/two instances passed after fixing background-revalidation fanout. Production commit/API/CDN/client smoke passed; client timed-release checks used intercepted synthetic past-month GETs with no server writes. Full Vercel multi-region fanout and nano capacity, formal composite luminance, real mobile/landscape/screen-reader hardware and full-duration occupancy remain unverified. The authorized release defaults ON with personal OFF/reduced-motion controls; `NEXT_PUBLIC_PREMIERE_STAGE=0` is the deployment stop (PLAN-027 §8 supersedes the initial OFF gate). Use synthetic DB counters for large loads, never the production nano. No real schedule rewrite/cleanup performed.

## PRIVACY-20260921 — historical exposure and provider/retention follow-up

Current findings, applied0124/0125, anon live probes and scoped SQL tests are recorded in
[privacy audit](PRIVACY-20260921.md). Current code containment does not erase publicly accessible
Git history or stop already-open old realtime clients. Those, restricted retention backups/deletion,
visit-session TTL, genuine-login/provider security and developer-tool major upgrades remain open.
No production cleanup, key rotation or history rewrite has been performed.

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

080 현재 선택: `diag=true AND day<'2026-10-14'` 진단14,209행. 일반 activity90일 밖0행; visit TTL 미정. 10:31KST Windows current-user/SYSTEM 제한·DPAPI 키·AES-GCM 백업의 복호화/원문 round-trip 검증 완료, 삭제0. 이 선택만 소유자에게 별도 승인 요청했다. 승인 전 삭제/상시 cleanup ON은 하지 않는다. 자세한 해시·집계는080 기록에 있고 원문·키는 커밋하지 않는다.

## VOD-SYNC-20260918 — late fan timeline and missing replay chat

Initial read-only production/source investigation on 2026-09-21. Fan timeline correction implemented locally afterward at the owner's request; production data and deployment unchanged.

- Target: 2026-09-18 part 2, SOOP title `207499291`. SOOP comment `121882539`, dated 2026-09-20 21:37:10 KST, parses into 66 entries with the existing parser. Production public timeline API still returns empty entries. DB timeline last checked 2026-09-20 00:14:18 KST, before the comment appeared.
- Calm sync rotates 8 oldest-checked VODs per eligible run, across up to 500 archive candidates; the observed timeline table has 398 rows. It does not prioritize recently posted VODs once first checked. Both callers suppress this pipeline while live, and the 30-minute throttle is a minimum interval, not an execution guarantee. Recent GitHub backup poll runs are hours apart. At inspection, this target was 102nd in timeline last-check order (not a guaranteed ETA).
- Replay chat row is `complete=true, chunks=0, messages=0`, last updated 2026-09-19 02:04:56 KST. Current SOOP view API returns four files: file orders 2/3/4/5. First file (32 seconds) chat at `startTime=0` returns 404; the other three return 200 with 19/40/11 messages in their first chunks. No raw chat or viewer identifiers were retained.
- `vod-chat.ts` stops at the first failed chunk and marks zero-progress attempts complete (`giveUp`); `pickChatSyncTargets` then excludes them permanently. Empty/error view responses also become complete. The current observed 404 reproduces a path to the persisted zero-message result; historical request logs were not available to prove the original response.
- This is unofficial SOOP **VOD chat replay** analysis, separate from fan comment timeline parsing; it is not direct live-chat ingestion.
- Local fan timeline correction: separate 10-minute timeline throttle from archive refresh; run during live broadcasts through both existing callers; alternate oldest-checked archive and recent (14-day) candidates, with no catalogue age/500-row cutoff. Read every comment page within an 8-second per-VOD timeout; incomplete/error responses preserve content and advance only the attempted VOD's timestamp so unavailable videos cannot block rotation. A 20-second loop budget bounds comment work. Timeline and archive/chat tasks run concurrently within the existing 60-second function, rather than adding their durations.
- Regression evidence: 38 focused tests pass, including initial empty result → later fan post → later edit, third-page timeline, 501st archive row, failure preservation, slow archive/recent fairness, and both live callers. Typecheck, full lint and production build pass. Full unit run before the last three added regression cases: 965 pass, 2 existing `ambient-codex` shallow-species failures. Independent review's fairness/runtime findings resolved and re-reviewed; no remaining blocking finding. Harness still fails on pre-existing duplicate `G-18` in root AGENTS.md.
- Remaining: deploy/observe the fan timeline correction, including target `207499291`. Invocation timing still depends on the external cron/viewer traffic; 10 minutes is a throttle, not a maximum visibility delay. The timestamp throttle is not a distributed lease. Chat file failure/retry and recovery are separate outstanding work; `vod-chat.ts` is unchanged. No backfill, commit or deployment performed.
- Follow-up local implementation: [multiple fan timelines](../plans/PLAN-20260921-024-vod-timeline-variants.md), [ADR-0027](../decisions/ADR-0027-fan-timeline-variants.md). Same-author replies, alternative selector and persistent studio moderation implemented; migration 0124 prepared and verified in isolated Postgres, not applied to production. Shared ingest/moderation now use a per-VOD advisory lock and reject older completed snapshots; the polling throttle itself remains non-exclusive.

## Deferred product choices

No current request to implement attendance, VOD full-text search, special-day ambient content, or replace the remaining poster themes. Existing plans are research/backlog only.
Historical “apply migration 0051” instructions do not establish a pending migration. Check actual migration history and authorization before any schema operation.
