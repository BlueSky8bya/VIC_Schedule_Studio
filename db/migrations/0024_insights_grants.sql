-- 서버 액션의 admin(서비스 롤) 클라이언트가 인사이트 집계를 위해 이 테이블들을 읽고/쓰게 한다.
-- event_hearts(0016)는 authenticated에게만, visit_log(0023)는 아무에게도 grant가 없어
-- 서비스 롤이 "permission denied"로 ① 방문 로그를 못 남기고 ② 월별 하트를 못 읽던 문제 수정.
-- service_role은 RLS를 우회하므로 grant만 주면 된다(클라이언트엔 노출되지 않는 백엔드 전용 롤).
grant select on public.event_hearts to service_role;
grant select, insert on public.visit_log to service_role;
