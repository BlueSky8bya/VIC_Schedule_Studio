-- 0050: 공개 인사이트의 '일별 방송시간' 막대(관리자 인사이트와 같은 차트)를 위한 집계 RPC.
-- 0049와 같은 원칙: broadcast_session 원본은 계속 RLS deny-all, 집계만 SECURITY DEFINER로 내보낸다.
-- 나가는 값은 (KST 시작일, 그날 방송시간) 뿐 — 세션 시작/종료 시각·제목은 나가지 않는다.

create or replace function public.get_public_broadcast_daily(p_from_day date, p_to_day date)
returns table (day date, hours numeric)
language sql
stable
security definer
set search_path = public
as $$
  select
    start_day as day,
    round(
      (sum(extract(epoch from (coalesce(ended_at, last_live_at) - started_at))) / 3600.0)::numeric,
      2
    ) as hours
  from public.broadcast_session
  where start_day >= p_from_day and start_day <= p_to_day
  group by 1
  order by 1;
$$;

comment on function public.get_public_broadcast_daily(date, date) is
  '공개용 일별 방송시간(KST 시작일 귀속). 세션 원본은 노출하지 않는다.';

grant execute on function public.get_public_broadcast_daily(date, date) to anon, authenticated;
