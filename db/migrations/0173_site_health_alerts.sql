-- 0173: 고장 알림 메일의 DB 쪽 준비물(2026-11-23 소유자: "고장 났을 때만 개발자 메일로, 같은 고장은 일주일에 한 번").
-- 지금까지는 방송 감지·다시보기 수집·예약 작업이 멈춰도, DB가 한도에 가까워져도 아무에게도 알려지지 않았다.
--  1) site_health_snapshot(): 점검에 쓰는 값들을 한 번에 읽는다(DB 크기, 마지막 방송 감지·수집 시각, 예약 작업 실패 수 등).
--     cron·net 스키마와 pg_database_size를 읽어야 해서 security definer, 서비스 롤만 실행.
--  2) site_alert_state: 알림 종류마다 마지막으로 메일을 보낸 시각(일주일 안에 같은 알림을 또 보내지 않게).
--  3) pg_cron 'vic-health-check': 6시간마다 사이트의 /api/cron/health를 부른다. Workers 예약 작업(매시)도 같은 점검을
--     부르지만, 그 예약 작업 자체가 멈춘 경우를 잡으려면 DB 쪽에서도 불러야 한다. 인증은 0128과 같은 Vault 토큰.
-- 판정(무엇이 고장인가)과 메일 발송은 앱이 한다(lib/health/check.ts). 멱등.
-- 되돌리기: select cron.unschedule('vic-health-check'); drop function public.site_health_snapshot(); drop table public.site_alert_state;

create table if not exists public.site_alert_state (
  kind text primary key,
  last_sent_at timestamptz not null,
  detail text
);
alter table public.site_alert_state enable row level security;
revoke all on public.site_alert_state from public, anon, authenticated;
-- RLS 표를 새로 만들면 서비스 롤 DML 권한을 따로 줘야 서버 쓰기가 된다(0035·0043에서 두 번 당한 함정).
grant select, insert, update, delete on public.site_alert_state to service_role;

create or replace function public.site_health_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'now', now(),
    'db_bytes', pg_database_size(current_database()),
    -- 방송 감지(매분): 방송 중엔 last_live_at이, 방송이 없을 땐 다시보기 수집 시각이 계속 새로 찍힌다.
    'last_live_at', (select max(last_live_at) from public.broadcast_session),
    'last_vod_sync_at', (select max(synced_at) from public.vod_archive where upload = false),
    'last_session_started_at', (select max(started_at) from public.broadcast_session),
    'search_graph_at', (select completed_at from public.broadcast_work_state where key = 'search-term-graph'),
    -- DB 예약 작업 실패(최근 24시간) — 이름별 건수.
    'cron_failed', coalesce((
      select jsonb_object_agg(name, n) from (
        select coalesce(j.jobname, 'job ' || d.jobid::text) as name, count(*) as n
        from cron.job_run_details d left join cron.job j using (jobid)
        where d.status = 'failed' and d.start_time > now() - interval '24 hours'
        group by 1
      ) f
    ), '{}'::jsonb),
    -- DB가 사이트를 부른 결과(pg_net이 6시간쯤 보관) — 대부분 실패면 채팅 수집 호출이 막힌 것.
    'http_total', (select count(*) from net._http_response),
    'http_bad', (select count(*) from net._http_response where timed_out is true or status_code is null or status_code >= 400)
  );
$$;
revoke all on function public.site_health_snapshot() from public, anon, authenticated;
grant execute on function public.site_health_snapshot() to service_role;

select cron.unschedule('vic-health-check') where exists (select 1 from cron.job where jobname = 'vic-health-check');
select cron.schedule(
  'vic-health-check',
  '13 */6 * * *',
  $job$
  select net.http_get(
    url := 'https://victory-broadcast.com/api/cron/health',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'vic_cron_token'),
      'User-Agent', 'vic-pg-cron/1'
    ),
    timeout_milliseconds := 30000
  );
  $job$
);
notify pgrst, 'reload schema';
