-- 0164: 원본 통계 삭제(purge_stats_batch) DB 쪽 안전장치(2026-11-13 소유자).
-- 0160은 표·열 화이트리스트만 봤다 — 서버 코드(lib/insights/archive.ts canPurgeYear)가 조건을 지키지만, 지난 해를 손으로
-- 막 만든 직후(예: 2026-11에 2025를 만들면 이미 2026-02-01이 지나 있다) 바로 지워질 수 있었다. 이제 DB도 같은 조건을 본다:
--   · 지우는 범위가 한 해 [y-01-01, y+1-01-01) 안
--   · 오늘(KST)이 y+1-02-01 이후
--   · 'vic' 캘린더 보관함에 y년 1~12월이 모두 있고, 그 달들이 해가 끝난 뒤(KST y+1-01-01 이후) 만들어졌으며
--   · 모든 달이 만든 지 30일 넘음
-- 조건이 안 맞으면 예외 — 서버 루프는 error를 받아 멈춘다(지우지 않음).
-- ② perf_samples(서버 성능 표본)는 7일만 남긴다(소유자 결정: 화면 창이 24시간·7일뿐). 지금 한 번 줄이고, 매일
--    03:45 KST 'vic-perf-retention'이 작은 배치로 이어서 지운다. search_graph_nightly()의 30일 삭제는 그대로 둔다(빈 일).
-- 멱등(create or replace · unschedule→schedule). 서명·권한은 0160과 같다.
-- 되돌리기: 0160의 함수 정의를 다시 적용 + select cron.unschedule('vic-perf-retention'); (지운 표본은 되살릴 수 없다)

create or replace function public.purge_stats_batch(p_table text, p_from date, p_to date, p_limit integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  n integer;
  lim integer := greatest(1, least(coalesce(p_limit, 5000), 20000));
  y integer;
  year_start date;
  year_end date;
  ok_months integer;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'purge_stats_batch: bad range';
  end if;
  y := extract(year from p_from)::integer;
  year_start := make_date(y, 1, 1);
  year_end := make_date(y + 1, 1, 1);
  if p_from < year_start or p_to > year_end then
    raise exception 'purge_stats_batch: range must stay inside one year';
  end if;
  if (now() at time zone 'Asia/Seoul')::date < make_date(y + 1, 2, 1) then
    raise exception 'purge_stats_batch: % is not open until %-02-01 (KST)', y, y + 1;
  end if;
  select count(distinct a.month) into ok_months
  from public.insights_year_archive a
  join public.calendars c on c.id = a.calendar_id and c.slug = 'vic'
  where a.year = y
    and a.built_at >= (year_end::timestamp at time zone 'Asia/Seoul')
    and a.built_at <= now() - interval '30 days';
  if ok_months < 12 then
    raise exception 'purge_stats_batch: archive for % is incomplete or younger than 30 days', y;
  end if;
  if p_table in ('activity_event', 'visit_session') then
    execute format(
      'delete from public.%I where ctid in (select ctid from public.%I where day >= $1 and day < $2 limit $3)',
      p_table, p_table)
      using p_from, p_to, lim;
  elsif p_table = 'perf_samples' then
    delete from public.perf_samples where ctid in (
      select ctid from public.perf_samples
      where created_at >= (p_from::timestamp at time zone 'Asia/Seoul')
        and created_at < (p_to::timestamp at time zone 'Asia/Seoul')
      limit lim);
  else
    raise exception 'purge_stats_batch: table % not allowed', p_table;
  end if;
  get diagnostics n = row_count;
  return n;
end;
$function$;

revoke all on function public.purge_stats_batch(text, date, date, integer) from public, anon, authenticated;
grant execute on function public.purge_stats_batch(text, date, date, integer) to service_role;

-- ② 성능 표본 7일 — 지금 한 번(배치로 나눌 만큼 많지 않다: 하루 수백 행), 그리고 매일.
delete from public.perf_samples where created_at < now() - interval '7 days';

select cron.unschedule('vic-perf-retention')
  where exists (select 1 from cron.job where jobname = 'vic-perf-retention');
select cron.schedule(
  'vic-perf-retention',
  '45 18 * * *',
  $job$delete from public.perf_samples where id in (
    select id from public.perf_samples where created_at < now() - interval '7 days' limit 20000)$job$
);

notify pgrst, 'reload schema';
