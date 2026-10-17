# 진단 기록 한정 정리 — 2026-10-17

Status: 승인 범위 삭제·사후 검증 완료.

승인: 소유자의 “진단 기록만 정리 승인”. [PLAN-081](../plans/PLAN-20261017-081-diagnostic-retention.md). 정확한 기존14,209개 id와 `diag=true AND day<'2026-10-14'`의 교집합만 대상으로 한다. 일반 이용기록/방문/일정/설정·다른 보존 정책은 변경하지 않는다.

11:58KST 검증 TLS/read-only 실제 카탈로그: activity_event는 일반 heap, partition/child0, inbound/outbound FK0, noninternal trigger0, rewrite rule0. id는 bigint identity, 나머지 포함13개 column은 generated 아님. 삭제를 다른 표로 전파하는 현재 구조가 없음을 확인했다. 실행 transaction에서도 ROW EXCLUSIVE 후 같은 조건을 다시 확인한다.

원 암호화 백업14,209행은 hash/복호화/압축해제 round-trip 검증을 마쳤다. PG의 date/timestamp를 JS Date로 읽은 백업은 DB 원형 정밀도까지 증명하지 않으므로 **삭제 전에** PG JSON text 백업을 별도 생성했다. 문자열을 JS object로 재직렬화하지 않아 timestamp의 소수점·날짜·JSON 숫자도 보존한다. 실제 `jsonb_populate_record(NULL::activity_event, ...)`→`to_jsonb` 왕복14,209행의 mismatch0을 확인했다. Windows 현재 사용자/SYSTEM 전용 폴더, 사용자 DPAPI 키, AES-256-GCM 새 IV. 원문/키/행 id는 출력·보고서·커밋에서 제외한다.

## 실행·사후 확인

| 시각(KST) | 실제 확인 |
|---|---|
|12:02:11|READ ONLY prepare: 원 백업과 현재14,209행·id 동일, PG JSON 복원형식·암호화 왕복 PASS. 삭제0|
|12:02:22|READ ONLY dry-run: 정밀 백업/현재 PG JSON 일치, schema guard·typed restore PASS. 삭제0|
|12:03:46|검증 TLS/REPEATABLE READ, ROW EXCLUSIVE→schema 재검증→대상 FOR UPDATE. 원본/정밀 백업/현재 일치 뒤 **14,209행 삭제·COMMIT**. 승인id 잔존0|
|12:04:41|새 연결 READ ONLY 재조회: cutoff이전 진단0, 일반44,454·visit30,733 유지|

삭제 transaction의 일반/범위밖id/visit 카운트는 각각 **44,454 /44,454 /30,733 → 동일**이었다. dry-run 이후 일반행 수가44,452에서44,454로2행 증가했으며, 이를 삭제 결과와 혼동하지 않는다. 동시 신규 기록은 막지 않고 같은 transaction snapshot의 대상외 행 수 불변을 확인했다. DELETE는 기존 백업id 배열 AND diag=true AND 고정cutoff로 제한했다. 일정·설정·daily 집계·perf에는 쓰지 않았으며 스키마/권한/cron/상시 pruning flag도 변경하지 않았다. 새 애플리케이션 배포가 필요한 제품 변경은 없다.

독립 리뷰에서 Node parse·키 전달/ACL·백업/현재 일치·DDL/행 잠금·exact DELETE·예외/commit 불확실 처리·복원 template을 확인했고 차단 사항0이었다. 실제 키/원문 열람·운영 변경은 root만 수행했다. 원본 집계 증거는 ignored `.scratch-pw/platform-080-retention-{schema,pgjson,dry-run,cleanup,postcheck}.json`, 실행 도구는 `platform-080-retention-cleanup.mjs`/`platform-080-retention-run.ps1`이다. 역사 기록이 재실행 승인을 주지 않는다.

## 제한 복구 백업

- 원 암호문299,439bytes: SHA256 `e21b7683f85c76dfcb88503ba75a5ec34edeb7083e380710ff4fd75f73a1d441`. 변경하지 않았다.
- **복구 정본 PG JSON 암호문357,249bytes**: SHA256 `08ee73d5fb05f9d87d6afe7f02c88e3fcc99e77669ce90807222d2209a5d109a`. `.scratch-pw/retention-080/activity-diagnostics.pgjson.aes`, 형식VIC080B1/IV12/tag16/AES-GCM, gzip JSON의 records는 원 PG JSON 문자열이다.
- 키는 같은 제한 폴더의 `key.dpapi`(Windows CurrentUser). 평문 key 파일 없음. 키는 stdin으로만 전달하고 메모리 byte buffer를 비운다. 프로필/로컬 백업이 사라지면 이 복구 경로도 잃는다. Supabase backup/PITR 전체 설정을 검증한 것은 아니다.
- 복구가 필요하면 먼저 정확한 hash·id집합·DB 타입 왕복을 확인한다. transaction에서 승인id가 모두 없는지 확인하고 명시13column + `OVERRIDING SYSTEM VALUE`로 삽입한다. 충돌을 건너뛰거나 기존 행을 덮지 않는다. 삽입14,209·정확 PG JSON 동등성을 검사한 뒤 COMMIT한다. 제한 폴더의 `restore-template.sql`은 **준비만 했고 실행하지 않았다**.
- 용도는 이번 정리의 복원 검증/복구다. 2026-10-24KST까지 복구 기간으로 제한하고 이후 로컬 정리 대상으로 기록한다. 이 문서는 자동 삭제/알림을 예약하지 않는다. 파일·키·사용자 식별자는 Git/공개 API/UI로 전송하지 않는다.

상시 cleanup flag·일반90일/진단3일 자동 실행 여부·visit TTL·외부 backup/PITR은 일회성 정리와 별개다. 더 넓은 삭제는 승인하지 않았으며 실행하지 않았다. 문서/harness219개·agent-memory/rule-migration43/43·diff-check PASS. 제품 코드가 바뀌지 않아 build/UI 전면 재검사는 실행하지 않았다.
