-- visit_session(0033)에 service_role 권한이 안 붙어, 서버 액션(service_role)의 INSERT/UPDATE(비콘)와
-- SELECT(집계)가 모두 "permission denied(42501)"로 조용히 실패하고 있었다 → 방문이 안 쌓이고
-- 인사이트 방문 패널이 "방문 데이터를 불러올 수 없어요"로 떴다(visit_log/presence_ping과 동일 이슈).
-- 서버(service_role)만 접근하도록 권한 부여. anon/authenticated는 계속 차단(경계 유지).
grant select, insert, update, delete on public.visit_session to service_role;
