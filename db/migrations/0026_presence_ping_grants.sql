-- presence_ping(0024)에 service_role 권한이 안 붙어, 서버 액션(service_role)의 upsert와
-- 집계 RPC(security invoker → service_role로 SELECT)가 모두 "permission denied(42501)"로
-- 조용히 실패하고 있었다(액션이 반환 error를 안 봐서 안 보였음).
-- 서버(service_role)만 접근하도록 권한을 부여한다. anon/authenticated는 계속 차단(경계 유지).

grant select, insert, update, delete on public.presence_ping to service_role;

-- RPC도 service_role 실행 권한을 (재)확인(0024에서 부여했으나 멱등하게 다시).
grant execute on function public.presence_hourly(date, date) to service_role;
grant execute on function public.presence_peak(date, date) to service_role;
grant execute on function public.presence_active_days(date, date) to service_role;
