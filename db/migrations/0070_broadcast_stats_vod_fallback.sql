-- 0070: 공개 방송 통계 RPC(0049/0050)에 다시보기(VOD) 폴백 — 세션 기록 이전 시대 채우기.
--
-- broadcast_session은 2026-06 도입이라 그 이전 달(2024-02~2026-05)의 방송시간이 통째로 0이었다.
-- vod_archive(0068)의 (방송 시작일, 길이)로 그 시대를 채운다. 규칙:
--   · 세션이 있는 날 = 세션이 정답(이중 집계 금지)
--   · 세션이 하나도 없는 날만 VOD 길이 합으로 폴백(sessions 수 = 그 날 VOD 수)
--   · 구독(플러스) 전용 VOD도 포함 — 방송시간 통계는 '실제 방송 총량'이다(공개 칩과 다른 기준)
-- 나가는 값은 여전히 집계뿐(개별 세션·VOD 원본 비노출). 서버 로더(lib/insights/actions.ts의
-- mergeVodFallback)와 같은 규칙을 SQL로 복제한 것 — 한쪽만 고치면 편집실↔시청자 수치가 갈라진다.

create or replace function public.get_public_broadcast_stats(p_from_day date)
returns table (ym text, hours numeric, days integer, sessions integer)
language sql
stable
security definer
set search_path = public
as $$
  with sess as (
    select
      start_day,
      extract(epoch from (coalesce(ended_at, last_live_at) - started_at)) as sec
    from public.broadcast_session
    where start_day >= p_from_day
  ),
  vod as (
    select v.broadcast_day as start_day, (v.duration_ms / 1000.0) as sec
    from public.vod_archive v
    where v.broadcast_day >= p_from_day
      and v.duration_ms > 0
      and not exists (
        select 1 from public.broadcast_session b where b.start_day = v.broadcast_day
      )
  ),
  merged as (
    select * from sess
    union all
    select * from vod
  )
  select
    to_char(start_day, 'YYYY-MM') as ym,
    round((sum(sec) / 3600.0)::numeric, 1) as hours,
    count(distinct start_day)::int as days,
    count(*)::int as sessions
  from merged
  group by 1
  order by 1;
$$;

comment on function public.get_public_broadcast_stats(date) is
  '공개용 방송 기록 집계(월별 시간/일수/세션수). 세션 없는 날은 다시보기 길이 폴백(0070). 원본 비노출.';

create or replace function public.get_public_broadcast_daily(p_from_day date, p_to_day date)
returns table (day date, hours numeric)
language sql
stable
security definer
set search_path = public
as $$
  with sess as (
    select
      start_day as day,
      extract(epoch from (coalesce(ended_at, last_live_at) - started_at)) as sec
    from public.broadcast_session
    where start_day >= p_from_day and start_day <= p_to_day
  ),
  vod as (
    select v.broadcast_day as day, (v.duration_ms / 1000.0) as sec
    from public.vod_archive v
    where v.broadcast_day >= p_from_day and v.broadcast_day <= p_to_day
      and v.duration_ms > 0
      and not exists (
        select 1 from public.broadcast_session b where b.start_day = v.broadcast_day
      )
  ),
  merged as (
    select * from sess
    union all
    select * from vod
  )
  select day, round((sum(sec) / 3600.0)::numeric, 2) as hours
  from merged
  group by 1
  order by 1;
$$;

comment on function public.get_public_broadcast_daily(date, date) is
  '공개용 일별 방송시간(KST 시작일 귀속). 세션 없는 날은 다시보기 길이 폴백(0070). 원본 비노출.';

grant execute on function public.get_public_broadcast_stats(date) to anon, authenticated;
grant execute on function public.get_public_broadcast_daily(date, date) to anon, authenticated;
