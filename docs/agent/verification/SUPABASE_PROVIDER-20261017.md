# Supabase 실제 제공자 확인·국소 최적화

Status: dashboard 확인·0152 적용 완료. [PLAN-082](../plans/PLAN-20261017-082-provider-and-lifecycle-validation.md).

소유자가 Chrome에서 직접 로그인했다. 관리 dashboard 접근은 서비스의 Google owner/developer/viewer 로그인 검증과 다르다. 계정·조직/프로젝트 식별자·사용자 행·원문 쿼리·토큰은 이 기록에 복사하지 않는다.

## 실제 관측

2026-10-17 12:10–12:26KST dashboard와 검증 TLS/read-only DB 카탈로그를 확인했다. Dashboard 사용량은 최대1시간 지연될 수 있으며 DB SQL의 현재 byte 집계와 단순 합치지 않는다.

| 대상 | 실제 표시·조회 | 범위/한계 |
|---|---|---|
| 플랜/compute | Free / Nano | 유료 전환·compute 변경 안 함 |
| 계량 기간 | 2026-09-21–10-21 | 현재 billing cycle |
| 조직 usage | egress1.623/5GB, DB summary0.288/0.5GB, MAU7/50,000, storage0/1GB, realtime peak1/200 | **조직** summary. 현재 주기 quota 초과 없음 표시. VIC 단독 egress로 부르지 않음 |
| 추가 로그 계량 | ingestion0.685/1GB, query2.656/100GB | UI에 UPCOMING,2027초 grace 종료 표시. 현재 과금 초과로 해석하지 않음 |
| VIC DB dashboard |274.43MB, Space used0.27GB, provisioned disk2GB | 시간 지연/표시 단위가 있는 제공자 관측 |
| VIC disk dashboard |570.76MB | Database/WAL/System을 포함하는 Disk Usage chart. Free DB500MB 제한과 서로 다른 분모 |
| 현재 DB SQL |272,649,363bytes, 연결16, 대기잠금0 |12:24KST의 순간 집계. 피크·p95·현재 물리 디스크 전체를 뜻하지 않음 |
| 제공자 지표 |연결 chart10 표시; CPU/메모리/IOPS/throughput 일부 `Unable to load data` |로딩 후에도 불러오지 못한 지표는0이나 정상으로 간주하지 않음 |
| 일일 백업 |`Free Plan does not include project backups` |관리형 일일 복구 없음.081의 로컬 한정 진단 백업은 전체 DB 백업이 아님 |
| PITR |Pro add-on 안내 |현재 활성화된 PITR 증거 없음. 유료 기능 켜지 않음 |

## 적용한 최적화

실제 Performance Advisor는 errors0/warnings36/info24였다. `event_hearts_read_own`의 `user_id = auth.uid()`가 행마다 인증 함수를 평가한다는 경고를 실제 정책 카탈로그와 대조했다.

[0152](../../../db/migrations/0152_event_hearts_read_initplan.sql)는 이를 `user_id = (select auth.uid())`로 바꿔 문장당 InitPlan 평가를 사용한다. SELECT/permissive/PUBLIC/본인 user_id 조건·NULL 거절·RLS·grant·owner·쓰기 RPC는 유지한다. 새 인덱스/테이블/수집/행 변경은 없다. 원문 SQL 함수에 SET search_path를 일괄 추가하거나 extension을 이동하지 않았다. SQL helper의 inlining·검색 의존성까지 검토하지 않은 경고 제거는 최적화로 취급하지 않는다.

12:24KST 검증 TLS·statement5s/lock500ms에서 적용 성공. BEGIN→ROW EXCLUSIVE→원/최적화 후 predicate 형태와 정책 metadata 확인→ALTER→COMMIT. ACL/owner/RLS 전후 동일, SELECT/역할/with-check 동일, 실제 카탈로그의 InitPlan 표현 확인. 정확한 이전 정책을 로컬 rollback SQL로 보관했다. `UPDATE`/`DELETE`/`TRUNCATE`/사용자 데이터 조회·추가 정리는 수행하지 않았다.

12:33KST 실제 Performance Advisor를 다시 열었을 때 errors0/warnings**35**/info24로 표시됐다(이전36). 새 권한/데이터 노출 없이 해당 함수 평가 경고1건을 줄였으며, 전체35개 경고 해결이나 지연 개선률을 뜻하지 않는다.

격리 PostgreSQL2,000행에서 두 사용자 각각의 **실제 반환 user_id**·NULL·익명 SELECT 거절·직접 쓰기 거절·grant 동일·2회 멱등·InitPlan·원 predicate rollback·true/null drift 거절 PASS. 독립 보안 검토 차단0. 공식 [Supabase RLS 지침](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)과 일치하지만 실계정 OAuth/RLS 전수 검사나 nano 전체 지연 절감률을 증명하지 않는다.

근거: ignored `.scratch-pw/platform-082-db-inspect.json`, `platform-082-db-apply.json`, `platform-082-policy-rollback.sql`. 첫 grant 조회는 잘못 추정한 RPC signature로42883 실패했고 `get_public_teaser_state(text,uuid)`를 실제0142에서 확인한 뒤 수정했다. 실패 원본 `platform-082-db-inspect-signature-first.json` 보존. 오류를 성공으로 덮지 않는다.

## 유지한 경계·미해결 사항

Security Advisor의 `public_schedule_events` SECURITY DEFINER 경고1은 의도된 공개 가림 경계와 관련된다. 실제 view는 owner-context/security_barrier=true, DB now/CASE를 포함하며 anon/authenticated는 view·가린 RPC 읽기만 허용받는다. base raw teaser는 RLS로 숨긴다. view를 invoker로만 바꾸면 익명 카운트다운 stub이 사라짐을 격리 SQL로 확인했다. 원문/전체 검증 범위는 [보안 기록](SECURITY_SESSION_BOUNDARY-20261017.md). 경고를 없애려고 원본 일정 읽기 권한을 넓히지 않는다.

전체 least-privilege 검증은 완료가 아니다. 기존 event_hearts ACL의 SELECT 외 privilege 잔여·mutable helper 경로·중복 permissive 정책/인덱스·실제 Auth/storage/기기별 revoke는 별도 검토한다. 잔여 ACL을 이번0152가 새로 부여한 것은 아니다. Data API에서 즉시 파괴적 명령이 가능하다는 증거도 아니다.

무료 플랜의 전체 백업 경로는 별도 운영 과제로 남는다. 현재 용량·제공자 경고만으로 유료 상향/일괄 인덱스/큰 VACUUM/데이터 삭제를 실행하지 않았다. DB 호출 감소080의 운영 비용 효과는 같은 기간/분모로 비교해야 하며 이번 순간 관측으로 절감률을 주장하지 않는다. 자동 정기 작업·미래 알림은 만들지 않았다.
