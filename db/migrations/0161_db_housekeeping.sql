-- 0161: DB 군살 정리(2026-11-13 소유자 승인 — "채팅 수집 작업 찌꺼기 정리", 예약 작업 로그 7일).
--
-- ① vod_chat_job: 끝까지 훑었는데 빠진 조각이 영영 안 받아지는 다시보기가 누적 상태(JSON, 편당 최대 430KB)를 계속
--    들고 있었다. 2026-11-13 실측 465행 = 25.3MB(거의 전부 TOAST), 미완료 152편의 state 합 20.2MB, 그중 재시도 20회 이상
--    126편 ≈ 16.6MB. 코드(lib/broadcast/vod-chat.ts MAX_GAP_RETRIES=20)는 이제 한도에서 받은 만큼으로 마무리한다 —
--    여기서는 이미 한도를 넘긴 작업을 같은 규칙으로 정리한다. 공개된 채팅 집계(vod_chat_terms·bins·people)는 그대로.
--    revision을 올려 진행 중인 수집기의 늦은 커밋이 되살리지 못하게 한다.
-- ② cron.job_run_details: pg_cron 실행 로그가 지워지지 않고 쌓였다(2026-09-19부터 2.4만 행, 9.4MB). 7일만 남긴다
--    (Supabase 권장). 매일 03:40 KST 작은 배치로 지운다.
-- 멱등. 되돌리기: select cron.unschedule('vic-cron-log-retention'); — 정리된 작업 상태·로그는 되살릴 수 없다
--    (상태는 다음 정기 재점검이 처음부터 다시 만든다).
-- 적용 뒤 공간 반환: db/maintenance/0161-vacuum-vod-chat-job.sql 을 따로 실행(VACUUM은 트랜잭션 안에서 못 돈다).

with stale as (
  select j.title_no,
         case when v.broadcast_day is not null
                   and (now() at time zone 'Asia/Seoul')::date - v.broadcast_day < 14
              then interval '3 days' else interval '365 days' end as recheck
  from public.vod_chat_job j
  left join public.vod_archive v on v.title_no = j.title_no
  where not j.complete
    and j.state is not null
    and coalesce((j.state->>'retries')::integer, 0) >= 20
)
update public.vod_chat_job j
   set complete = true,
       state = null,
       revision = j.revision + 1,
       next_retry_at = now() + s.recheck,
       updated_at = now()
  from stale s
 where s.title_no = j.title_no;

update public.vod_chat_sync s
   set complete = true
  from public.vod_chat_job j
 where j.title_no = s.title_no and j.complete and not s.complete;

-- 지금 한 번 정리하고, 매일 이어서.
delete from cron.job_run_details where end_time < now() - interval '7 days';

select cron.unschedule('vic-cron-log-retention')
  where exists (select 1 from cron.job where jobname = 'vic-cron-log-retention');
select cron.schedule(
  'vic-cron-log-retention',
  '40 18 * * *',
  $job$delete from cron.job_run_details where runid in (
    select runid from cron.job_run_details where end_time < now() - interval '7 days' limit 20000)$job$
);

notify pgrst, 'reload schema';
