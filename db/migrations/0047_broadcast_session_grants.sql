-- broadcast_session(0046)에 service_role DML 권한 부여. RLS deny-all 테이블은 service_role도
-- 테이블 GRANT가 없으면 서버 쓰기가 "permission denied(42501)"로 조용히 실패한다
-- (visit_session 0035·perf_samples 0043과 동일 함정). anon/authenticated는 계속 차단(경계 유지).
grant select, insert, update, delete on public.broadcast_session to service_role;
