# PLAN-081 — 승인된 진단 기록 한정 정리

Status: Complete
Date: 2026-10-17 KST
Scope: L3 일회성 운영 데이터 정리. 제품 코드/스키마/권한/자동 pruning 설정 변경 없음.

## 승인·범위

소유자가 “진단 기록만 정리 승인”으로 답했다. 원래 백업의 정확한14,209개 id 집합 중 `diag=true AND day<'2026-10-14'`인 행만 대상이다. 조건이나 대상 수가 달라지면 중단한다. 일반 이용기록·방문·일정·설정·daily집계·perf·예전 로컬 테스트 청소는 포함하지 않는다. 앞으로의 상시 cleanup 활성화도 승인에 포함하지 않는다.

## 절차·검증

1. 검증 TLS/read-only로 실제 FK·사용자 trigger·rewrite·partition 부작용을 확인한다. 제한 암호화 백업을 복호화하고 원본id/현재 행 일치를 확인한다. JS Date 정밀도에 기대지 않도록 PG JSON text를 별도 암호화하며 실제 composite-type round-trip으로 날짜/시각/숫자 복원도 검사한다. 원 백업은 보존한다.
2. 독립 리뷰 뒤 dry-run을 통과해야 한다. 실제 transaction은 ROW EXCLUSIVE로 DDL 경합을 막고 스키마를 재확인한 뒤 대상 행 FOR UPDATE. 백업·현재 원문 불일치면 rollback. id 집합+diag+고정cutoff를 함께 제한하고14,209행 삭제·범위밖/일반/visit 수 불변을 확인한 뒤 commit한다.
3. commit 이후 승인id 잔존0을 별도 확인한다. commit 응답 불확실/검증 실패는 rollback 성공으로 오보고하지 않고 재조회한다. 실패 시 복원용 암호문/DPAPI 키와 identity override SQL을 보존한다. 원문·키·계정/방문 식별자는 출력/커밋하지 않는다.

제품 변화가 없어 UI/build 전면 재실행은 필요하지 않다. 실제 행집합·복원형식·DB 검증과 문서/harness 검사를 수행한다. [결과](../verification/DIAGNOSTIC_RETENTION-20261017.md)에 실제 결과·잔여 보존 설정을 기록한다.

## 결과

12:03KST 정확14,209행 삭제·COMMIT, 승인id잔여0. 12:04 새 연결에서도 만료진단0, 일반44,454/방문30,733 유지 확인. 현재 schema·백업·id/원문 일치·DB형식 복원·독립 리뷰·dry-run PASS 뒤 실행했다. 정밀 PG JSON 암호화 백업과 미실행 복구 template을 제한 보관한다. 앱/스키마/권한/cron/pruning flag는 변경하지 않았다. 상세 hash·원 실패 보정·복구와 제한은 결과 기록을 따른다.
