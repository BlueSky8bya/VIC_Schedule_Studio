-- 0166: 이용 기록은 개발자 본인만(2026-11-13 소유자 결정 — 오류 추적용).
--
-- ① 방문 세션(visit_session)은 더 이상 쓰지 않는다(방문·실시간·동접 화면 철수). 남은 행을 모두 지운다(표는 둔다 —
--    연간 아카이브 함수 purge_stats_batch의 화이트리스트가 이름을 참조한다).
-- ② 방송인(owner)·옛 역할(manager·worker) 등 개발자 외 행동 기록(activity_event)을 지운다. 코드
--    (lib/activity/kinds.ts isTrackedRole)가 같은 날부터 개발자 기록만 남긴다.
-- ③ 매일 정리(vic-insider-stats-retention, 0165)를 개발자 기준으로 바꾼다: 진단 3일·나머지 400일, 개발자 외 행·
--    방문 세션은 남아 있으면 지운다.
-- 멱등. 되돌리기: 0165의 cron.schedule을 다시 적용 — 지운 기록은 되살릴 수 없다.

delete from public.visit_session;

delete from public.activity_event
 where role <> 'developer';

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
  delete from public.visit_session where ctid in (
    select ctid from public.visit_session limit 20000);
  $job$
);
