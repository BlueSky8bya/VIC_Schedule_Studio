-- 관리자(owner) 접속 세션 복원 — presence_ping의 분 단위 핑을 "연속된 머문 구간"으로 묶는다.
-- 같은 session_hash 안에서 핑 간격이 2분을 넘으면(탭을 숨기거나 떠났다 = 핑 멈춤) 새 세션으로 끊는다
-- (gaps-and-islands). 한 세션 = device·시작·종료·머문 분(핑 수). 개발자 인사이트 전용.
-- 관리자는 1명(계정 2개)뿐이라 세션 수가 적어 상세 표시가 가능하다.

create or replace function public.owner_sessions(p_start date, p_end date)
returns table (device text, started_at timestamptz, ended_at timestamptz, minutes int)
language sql
stable
as $$
  with marked as (
    select
      session_hash,
      device,
      minute_ts,
      case
        when lag(minute_ts) over w is null
          or minute_ts - lag(minute_ts) over w > interval '2 minutes'
        then 1 else 0
      end as is_new
    from public.presence_ping
    where role = 'owner' and day >= p_start and day < p_end
    window w as (partition by session_hash order by minute_ts)
  ),
  grouped as (
    select
      session_hash,
      device,
      minute_ts,
      sum(is_new) over (partition by session_hash order by minute_ts) as grp
    from marked
  )
  select
    device,
    min(minute_ts) as started_at,
    max(minute_ts) as ended_at,
    count(*)::int as minutes
  from grouped
  group by session_hash, device, grp
  order by started_at desc
  limit 300
$$;

revoke all on function public.owner_sessions(date, date) from public;
grant execute on function public.owner_sessions(date, date) to service_role;
