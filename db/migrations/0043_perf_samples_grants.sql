-- perf_samples(0042)에 service_role 권한이 안 붙어, 서버 액션(service_role)의 INSERT(timed→
-- recordPerfSample의 after() 표본 기록)가 "permission denied(42501)"로 조용히 실패하고 있었다 →
-- 표본이 한 행도 안 쌓이고, 개발자 인사이트 "서버 성능" 패널이 영구히 "아직 표본이 없어요"로 떴다
-- (visit_session 0035와 동일 이슈 — RLS deny-all + service_role DML grant 누락).
-- 서버(service_role)만 접근하도록 권한 부여. anon/authenticated는 계속 차단(경계 유지).
-- 읽기(집계)는 get_perf_stats가 security definer라 이미 통과하지만, 대칭/직접조회 대비 select도 함께.
grant select, insert, update, delete on public.perf_samples to service_role;
