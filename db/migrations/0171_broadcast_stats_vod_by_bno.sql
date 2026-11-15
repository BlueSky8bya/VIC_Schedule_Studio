-- 0171: 방송 시간 통계의 다시보기(VOD) 폴백을 '그날'이 아니라 '그 방송(bno)' 단위로 맞춘다(2026-11-16 소유자).
--
-- 문제: 0070·0156의 폴백은 "그날 broadcast_session이 하나라도 있으면 그날 VOD는 전부 뺀다"였다. 구독+(auth_no 107)
-- 생방송은 공개 라이브 조회가 잡지 못해 세션이 생기지 않는데, 같은 날 일반 방송 세션이 있으면 구독+ VOD 길이까지
-- 버려졌다(2026-11-15: 일반 4.56h만, 구독+ '쇼츠제작중!' 4.56h 누락).
-- 규칙(이중 집계 금지는 그대로):
--   · VOD의 bno와 같은 bno 세션이 있으면 → 세션이 정답, VOD 제외.
--   · 그날 bno 없는 세션(0051 이전 기록)이 있으면 → 어느 방송인지 모르니 예전처럼 그날 VOD 제외.
--   · bno 없는 VOD는 그날 세션이 있으면 제외(예전 규칙).
--   · 그 밖(구독+ 등 세션이 못 잡은 방송) → VOD 길이로 센다.
-- 업로드(upload)·게스트(guest) 행은 생방송이 아니라 계속 제외. 2026-11-16 운영 데이터로 모의 계산: 새로 더해지는 행은
-- 2026-11-15 구독+ 1건뿐(옛 6~7월 기록 이중 집계 없음).
-- 앱 코드 lib/insights/actions.ts mergeVodFallback도 같은 규칙. 반환형 그대로라 배포 순서 무관.
-- Rollback: 0156의 두 함수 정의를 다시 적용. 멱등.

begin;

CREATE OR REPLACE FUNCTION public.get_public_broadcast_stats(p_from_day date)
 RETURNS TABLE(ym text, hours numeric, days integer, sessions integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and v.guest = false and not v.upload
      and not exists (
        select 1 from public.broadcast_session b
        where (v.bno is not null and b.bno = v.bno)
           or (b.start_day = v.broadcast_day and (b.bno is null or v.bno is null))
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
$function$;

CREATE OR REPLACE FUNCTION public.get_public_broadcast_daily(p_from_day date, p_to_day date)
 RETURNS TABLE(day date, hours numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      and v.guest = false and not v.upload
      and not exists (
        select 1 from public.broadcast_session b
        where (v.bno is not null and b.bno = v.bno)
           or (b.start_day = v.broadcast_day and (b.bno is null or v.bno is null))
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
$function$;

commit;
