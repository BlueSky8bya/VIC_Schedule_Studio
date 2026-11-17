-- 0172: 방문 기록 표 두 개를 지운다(2026-11-17 소유자 승인 — 되돌릴 수 없는 삭제).
--
-- 2026-11-13 방문·시청자 기록을 철수(0165·0166)한 뒤로 두 표는 비어 있고 앱이 읽지도 쓰지도 않는다:
--   · visit_session        — 방문 세션(0033). 0166이 모든 행을 지웠다.
--   · activity_daily_count — 시청자 날짜별 버튼 개수(0063). 0165가 비웠다.
-- 적용 전 운영 확인(2026-11-17): 두 표 모두 0행, 뷰·외래키·트리거 의존 없음. 이름을 참조하던 것은 아래 넷뿐이다.
--
-- ① 매일 정리(vic-insider-stats-retention)에서 visit_session 삭제 줄을 뺀다 — 표가 없으면 작업 전체가 실패해
--    개발자 기록 보존 정리(진단 3일·나머지 400일)까지 멈춘다. 나머지 세 줄은 0166 그대로.
-- ② purge_stats_batch의 허용 표에서 visit_session을 뺀다(가드·서명·권한은 0164 그대로).
--    앱(lib/insights/archive.ts PURGE_TABLES)도 같은 커밋에서 뺐다. 순서 무관 — 이 함수는 해마다 2월에만 불린다.
-- ③ 두 표만 읽고 쓰던 함수 셋을 지운다(앱 호출 없음): get_known_account_hashes(0051),
--    bump_activity_counts(0063), developer_live_presence_counts(0151).
-- ④ 표 두 개 삭제.
-- 멱등(if exists · unschedule→schedule · create or replace). 한 트랜잭션.
-- 되돌리기: 0033·0034·0035·0061·0063의 표 정의와 0051·0063·0151의 함수, 0166의 cron.schedule을 다시 적용
-- (구조만 돌아온다 — 표는 이미 비어 있었으므로 잃는 기록은 없다).

begin;

select cron.unschedule('vic-insider-stats-retention')
  where exists (select 1 from cron.job where jobname = 'vic-insider-stats-retention');
select cron.schedule(
  'vic-insider-stats-retention',
  '50 18 * * *',
  $job$
  delete from public.activity_event where ctid in (
    select ctid from public.activity_event
    where diag and day < (now() at time zone 'Asia/Seoul')::date - 3 limit 20000);
  delete from public.activity_event where ctid in (
    select ctid from public.activity_event
    where day < (now() at time zone 'Asia/Seoul')::date - 400 limit 20000);
  delete from public.activity_event where ctid in (
    select ctid from public.activity_event
    where role <> 'developer' limit 20000);
  $job$
);

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
  if p_table = 'activity_event' then
    delete from public.activity_event where ctid in (
      select ctid from public.activity_event where day >= p_from and day < p_to limit lim);
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

drop function if exists public.get_known_account_hashes(date);
drop function if exists public.bump_activity_counts(jsonb);
drop function if exists public.developer_live_presence_counts(timestamptz);

-- 비어 있지 않으면 멈춘다 — 기록이 남아 있는 표를 조용히 지우지 않는다.
do $$
declare
  t text;
  has_rows boolean;
begin
  foreach t in array array['visit_session', 'activity_daily_count'] loop
    if to_regclass('public.' || t) is not null then
      execute format('select exists (select 1 from public.%I)', t) into has_rows;
      if has_rows then
        raise exception '0172: % is not empty', t;
      end if;
    end if;
  end loop;
end $$;

drop table if exists public.visit_session;
drop table if exists public.activity_daily_count;

commit;
