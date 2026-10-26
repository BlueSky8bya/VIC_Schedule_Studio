# Open verification and operations checks

Updated: 2026-10-19

This file keeps unresolved evidence gaps out of startup history. A prior PASS applies to its tested revision and scope only. Recheck before closing; do not infer current production state from old notes.

## PLATFORM-080 — 배포 후 운영·비용·외부 증거

[079 감사](PLATFORM_AUDIT-20261017.md)는 읽기 전용 기준 기록이다. 이후 소유자 승인으로 코드·의존성·0151을 수정했다. 현재 구현과 검증 범위는 [080 적용 기록](PLATFORM_REMEDIATION-20261017.md), [backend](BROADCAST_WORK_BOUNDS-20261017.md), [client](PLATFORM_CLIENT-20261017.md)를 따른다.

- 운영 효과: 새 readiness stage·실패율/CPU/Fluid 점유·수집/RPC 호출·DB 임시 파일 증가량을 같은 기간/분모로 비교. warm204는 공개 readiness만 뜻하며 모든 인스턴스/Data Cache가 warm하다는 증거가 아니다. 프로세스 밖 중복은 가능하고 Redis/분산 compute lease는 미도입이다.
- 외부 후속: [082 실제 dashboard](SUPABASE_PROVIDER-20261017.md)에서 Free/Nano·현재 주기 조직 quota 이내·VIC DB/disk·관리형 일일 백업/PITR 없음 확인. CPU/메모리/IO 일부 graph는 로딩 실패했다. Free 전체 복구 경로·보존 flag·모든 Auth/storage/pool 제약은 여전히 별도다. 079의42703과082의 잘못된 함수 signature42883은 각각 보존 후 실제 카탈로그로 재조회했다.
- 권한: net 익명DataAPI406, activity401, publicview limit0=200은 그 경로만 확인했다. 실제 로그인 역할·RPC/storage·grant 만료/철회/다른 기기와 과거 유출 전체 검증을 대신하지 않는다. 민감 원문은 보고서/로그에 복사하지 않는다.
- 유지보수: production npm audit0. 개발 ESLint 경로 braces3.0.3 advisory는 공식 patch가 없어 영향5 high가 남는다. 불신 glob/config 입력을 lint에 주지 않으며 upstream patch 때 재검토한다. 원격quality38992818125 전 단계 PASS; 원 실패와 실제 이미지 통합 검사1개30초 조정은080 기록 참조.
- 경계: 새 activity64KiB byte 제한·검색 진행 키128개 cap은 분산 rate limit이 아니다. provider WAF/전역 rate 정책은 실제 트래픽·정상 입력 보존을 검토해 별도로 정한다. 공개 DTO/import·격리 canary가 실계정 RLS 전체를 증명하지 않는다.
- 실제 장비: OBS/SOOP 캡처·인코딩 동시 frame cadence, 장시간 memory plateau, 모바일·coarse landscape·focus/screen reader·formal flash·멀티리전 nano capacity는 별도. 기존 fixture 결과로 완료 처리하지 않는다.

최초 관측 Vercel CPU6시간47분/4시간·Fluid Memory460.1/360GB-hours, DB272.26MB. 측정 기간/계량은 감사 본문 참조. 수정 뒤 같은 기준의 route·RPC·사용량 변화로 효과를 확인하며 절감률을 미리 단정하지 않는다.

## COMPANION-BROADCAST — 실제 OBS/SOOP 장비

[082 로컬 OBS](OBS_LOCAL_RECORDING-20261017.md)는 이 PC의 공식 OBS/실제 GPU·NVENC·BrowserSource/MKV30분 완료, render/encoding lag 각2프레임이다. 실제 방송 PC/SOOP/Window Capture와 다르다. [종료20개](ACTIVITY_LIFECYCLE-20261017.md), [복합/실제 클릭](COMPANION_COMPOSED_INPUT-20261017.md)(최종 첫4 PASS/1 FAIL·독립 재관측1 PASS), [합성 권한/HTTP/SQL](SECURITY_SESSION_BOUNDARY-20261017.md)도 각 증거 층을 구분한다.

[PLAN-076 검증](COMPANION_BROADCAST_PIPELINE-20261017.md)은 실제 decoded 이미지의 단일 표시 경로, 중복 표시 쓰기/저장소 조회 제거와 native fixture를 확인한다. 실제 토리님 방송 PC의 GPU·OBS 합성/인코딩·SOOP 송출을 함께 측정하지 않았다. 장면/캡처 방식·브라우저 하드웨어 가속·GPU 여유에 따라 결과가 달라지므로 무끊김을 보장하지 않는다.

이전 COMPANION-TEXTURE 간격은076 후보 빌드 `-S59OcmbVUz2SMdS-qZsY`에서 수정·검증했다. cold 지연 packet 중 기존 몸체 유지/동일 decoded DOM/요청1회, 원래20 warm-pixel 기준을 유지한 음식 관찰에서 시청자395·편집실331픽셀을 확인했다. [075 원 실패](COMPANION_HABITS-20261017.md)와 `.scratch-pw/companion-075-inspect-failure.{json,png}`는 보존한다. 이 fixture 결과는 실제 방송 장비와 운영 빈도의 증거가 아니다.

## COMPANION-096-FOCUS — 실제 viewer 창 전환

[096 검증](COMPANION_CONTINUOUS_RUN_THROW-20261017.md)의 새 주행/투척12case와 기존 회귀21case는 PASS했다. 기존 `viewer-refocus`1case는 실제 headed 브라우저에서 의도한 창 전환 전부터 반복 trusted blur가 발생해3회 모두 준비에 실패했다. 외부 입력 주체/정확한 OS 원인은 미확인이고 다른 명령을 중지한 실행도 실패했다. 원본/report/context는 각각 SHA 봉인했으며 같은 공유 구현의 studio PASS로 대체하지 않는다.

[130 쓰다듬기](COMPANION_EXPERIENCE_DEPTH-20261019.md)는 별도 진입의 `document.hasFocus()` 조건과 저장된 visible-background 정책 불일치를 수정했다. Headless Playwright의 기본 focus emulation을 해제한 실제 peer 탭 전환에서 대상 visible/unfocused를 확인하고, 일정표 pointerdown 없이 첫 native stroke 반응을 관측했다. Native mouse 전송이 대상 탭을 활성화하므로, 계속 비활성 상태인 OS 창의 쓰다듬기나096 음식 접근 복귀를 검증한 것은 아니다. 이 간격과 사용자 유예한 실제 방송 장비 검증은 유지한다.

다음: 실제 포커스를 안정적으로 소유할 수 있는 환경에서 현재 fixture의 음식 배치→실제 approach 시작→native blur/focus→같은 음식 소비/한 번 보상·마무리를 기존 단언으로 재검한다. RNG/시계/강제 focus emulation으로 이 actual-focus 증거를 대신하지 않는다. 운영 기능 결함으로 확정된 사항은 아니며 새 코드의 기본 주행/투척 검증과 구분한다.

## TEASER-PREMIERE — authorized rollout and remaining QA

Latest visual/motion rework and exact verification scope: [premiere moment](TEASER_KAIROS-20261014.md), following [countdown focus/preview continuity](TEASER_FOCUS-20261014.md), [individual card choreography](TEASER_CARDS-20261014.md) and [fluid redesign](TEASER_FLUID-20261014.md). These do not close genuine-login preview, hardware, formal luminance, fan-experience observation or deployed fanout gaps below.

See [release evidence](TEASER_PREMIERE-20261014.md). Functional release a6c60ca9 deployed/verified. 0142 applied with verified TLS; real anon/unprivileged-authenticated SQL canaries and anonymous REST passed (rolled-back past-date rows, zero residue). Actual Next HTTP-to-stub-DB bursts at 1/100/1,000 requests on one/two instances passed after fixing background-revalidation fanout. Production commit/API/CDN/client smoke passed; client timed-release checks used intercepted synthetic past-month GETs with no server writes. Full Vercel multi-region fanout and nano capacity, formal composite luminance, real mobile/landscape/screen-reader hardware and full-duration occupancy remain unverified. The authorized release defaults ON with personal OFF/reduced-motion controls; `NEXT_PUBLIC_PREMIERE_STAGE=0` is the deployment stop (PLAN-027 §8 supersedes the initial OFF gate). Use synthetic DB counters for large loads, never the production nano. No real schedule rewrite/cleanup performed.

## PRIVACY-20260921 — historical exposure and provider/retention follow-up

Current findings, applied0124/0125, anon live probes and scoped SQL tests are recorded in
[privacy audit](PRIVACY-20260921.md). Current code containment does not erase publicly accessible
Git history or stop already-open old realtime clients. Those, restricted retention backups/deletion,
visit-session TTL, genuine-login/provider security and developer-tool major upgrades remain open.
Outside the separately approved 14,209 diagnostic rows documented in [081](DIAGNOSTIC_RETENTION-20261017.md), no broader production cleanup, key rotation or history rewrite has been performed.

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

080에서 준비한 `diag=true AND day<'2026-10-14'`의 기존14,209개 id만 소유자가 별도 승인했다. [081 결과](DIAGNOSTIC_RETENTION-20261017.md):12:03KST 정확14,209행 삭제·COMMIT, 새 연결 재조회 잔여0·일반/visit 불변. 원/정밀 PG JSON 암호화 백업·복원형식 검증 완료. 다른 정리나 상시 cleanup ON은 하지 않았다. 일반 activity90일 밖0행은 준비 시점 관측이며 visit TTL·운영 flag는 별도 미확인이다.

복구용 로컬 암호문/DPAPI 키는2026-10-24KST 복구 기간 뒤 제거 대상으로 기록한다. 자동 삭제/알림은 예약하지 않았다. 제한 파일/키/원문은 커밋하지 않는다. 초기9월4일의 더 넓은 테스트/로컬 트래픽 청소는 이번 승인에 포함되지 않는다.

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

## COMPANION-PANEL-REPORT-20261026 — reported disappearance during side play

The owner observed a missing resident around an autonomous panel-side change; the exact viewer/studio surface is not remembered. Original autonomous actor path was observed accepting the actual side request at98.825s, with629 frames continuously visible through the7s return. Both wide surfaces and narrow exposed-resident/fold/scroll side callbacks also stayed visible. Narrow callback coverage does not establish arrow-perch or natural-decision coverage. Panel product behavior was not changed on a conjecture. [Scope, original failures and evidence](AGENDA_COMPANION_DETAIL-20261026.md).

Keep the original cause unconfirmed. The owner's later2026-10-26 instruction explicitly adopts bounded device-local automatic classification/evidence and safe measured recovery; this replaces the earlier “no new production tracking is authorized” restriction only for that local purpose. Do not persist event/platform IDs or schedule/identity data, upload diagnostics, or add autonomous events to human analytics. [Current contract and verification](COMPANION_VISIBILITY-20261026.md). Do not repeatedly run the same90s case as proof that the report cannot occur. Physical devices and untested geometry remain separate.

## Deferred product choices

No current request to implement attendance, VOD full-text search, special-day ambient content, or replace the remaining poster themes. Existing plans are research/backlog only.
Historical “apply migration 0051” instructions do not establish a pending migration. Check actual migration history and authorization before any schema operation.
