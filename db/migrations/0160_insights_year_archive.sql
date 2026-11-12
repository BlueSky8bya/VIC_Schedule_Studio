-- 0160: 연간 인사이트 아카이브(2026-11-13 소유자 결정).
-- 매년 1월 1일(KST) 지난해 1~12월의 월별 인사이트를 **숫자(JSON)** 로 남긴다 — 이미지는 저장하지 않고 개발자 설정
-- '지난 해 인사이트'가 같은 차트 컴포넌트로 다시 그린다. 원본 통계(activity_event·visit_session·perf_samples)는
-- 아카이브가 12달 모두 있는 해만, 다음 해 2월 1일(KST)부터 지운다(lib/insights/archive.ts, 시간별 Workers Cron).
-- 멱등. 되돌리기: drop function public.purge_stats_batch(text,date,date,integer); drop table public.insights_year_archive;
--   (아카이브를 지우면 이미 삭제된 원본은 되살아나지 않는다 — 삭제가 시작된 뒤엔 되돌리지 말 것.)

create table if not exists public.insights_year_archive (
  calendar_id    uuid not null references public.calendars(id) on delete cascade,
  year           integer not null check (year between 2024 and 2100),
  month          integer not null check (month between 1 and 12),
  schema_version integer not null default 1,
  payload        jsonb not null,            -- { insights, trend, visits } — 화면과 같은 집계 결과(합계·개수만)
  built_at       timestamptz not null default now(),
  primary key (calendar_id, year, month)
);

-- 개발자 화면·크론만 서버(service_role)로 읽고 쓴다. RLS deny-all + service_role DML grant(0035·0043 함정).
alter table public.insights_year_archive enable row level security;
revoke all on public.insights_year_archive from public, anon, authenticated;
grant select, insert, update, delete on public.insights_year_archive to service_role;

-- 원본 통계 배치 삭제 — nano(work_mem 2MB·작은 디스크)에서 한 번에 지우지 않고 p_limit 행씩.
-- 표·열은 화이트리스트(동적 SQL 주입 차단). [p_from, p_to) 는 KST 날짜(day 열) / perf_samples는 KST 자정 경계.
create or replace function public.purge_stats_batch(p_table text, p_from date, p_to date, p_limit integer default 5000)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  n integer;
  lim integer := greatest(1, least(coalesce(p_limit, 5000), 20000));
begin
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'purge_stats_batch: bad range';
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

notify pgrst, 'reload schema';
