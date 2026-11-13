-- 0165: 시청자 방문·행동 기록 중단과 삭제, 운영자 기록 자동 보관 기한(2026-11-13 소유자 결정).
--
-- ① 시청자·비로그인 방문 기록(visit_session: role viewer·anon 등 운영자 외) 전부 삭제.
--    코드(app/layout.tsx·lib/insights/actions.ts)가 같은 날부터 운영자·개발자 본인 방문만 남긴다.
-- ② 시청자·비로그인 버튼 누름의 날짜별 개수(activity_daily_count — 운영자 외 역할만 쌓이던 표) 전부 삭제.
--    코드(lib/activity/record.ts)가 운영자 외 행동은 행·개수·진단 어떤 형태로도 남기지 않는다.
-- ③ 운영자·개발자 본인 기록의 보관 기한을 DB가 직접 지킨다. 매일 03:50 KST 'vic-insider-stats-retention':
--    activity_event(진단 3일, 나머지 400일)·visit_session(400일). 400일 = 연간 인사이트 아카이브(지난 1~12월을
--    다음 해 1월에 숫자로 남김)가 원본을 읽을 수 있는 최소 여유. 개인정보처리방침의 "최대 13개월"과 같은 기준.
-- 멱등. 되돌리기: select cron.unschedule('vic-insider-stats-retention'); — 지운 기록은 되살릴 수 없다.

delete from public.visit_session
 where role not in ('owner', 'manager', 'worker', 'developer');

delete from public.activity_daily_count;

delete from public.activity_event
 where role not in ('owner', 'manager', 'worker', 'developer');

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
  delete from public.visit_session where ctid in (
    select ctid from public.visit_session
    where day < (now() at time zone 'Asia/Seoul')::date - 400 limit 20000);
  delete from public.visit_session where ctid in (
    select ctid from public.visit_session
    where role not in ('owner', 'manager', 'worker', 'developer') limit 20000);
  $job$
);
