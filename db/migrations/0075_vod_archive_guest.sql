-- 0075: 합방(게스트) 다시보기 — 토리님이 **다른 스트리머 방송국**에 출연한 VOD(모캡 합방 등)를 날짜 칩·다시보기 창에서
-- 함께 보여준다(2026-09-04 사용자 요청, 5건). 수집기(chapi 목록, lib/broadcast/vod-archive.ts)는 토리님 방송국만 읽으므로
-- 게스트 행은 scripts/add-guest-vods.mjs가 SOOP VOD 조회 API(api.m.sooplive.co.kr/station/video/a/view)로 넣는다.
-- 공개 성격은 0068과 같다(숲에서 누구나 보는 메타). 게스트 행은 ① 방송 통계 폴백(0070)에서 제외(토리님 방송시간이 아니다)
-- ② 전체 스윕의 삭제 동기화에서 제외(토리님 목록에 없는 게 당연) ③ 30분 체인에서 제외(다른 채널).

alter table public.vod_archive
  add column if not exists guest boolean not null default false,
  add column if not exists host_id text,
  add column if not exists host_nick text not null default '';

comment on column public.vod_archive.guest is
  '합방 게스트 출연분(다른 스트리머 방송국의 VOD, 0075). 방송 통계·삭제 동기화·체인에서 제외.';
comment on column public.vod_archive.host_id is
  '게스트 출연분의 호스트 스트리머 SOOP id — 댓글(타임라인) API 경로에 쓴다.';
comment on column public.vod_archive.host_nick is
  '호스트 스트리머 닉(공개 표시 "합방 · ○○"). 토리님 본방은 빈 문자열.';

create index if not exists vod_archive_guest_idx on public.vod_archive (guest);

-- 방송 통계 폴백(0070) — 토리님 방송(guest = false)만 센다.
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
      and v.guest = false
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
  '공개용 방송 기록 집계(월별 시간/일수/세션수). 세션 없는 날은 다시보기 길이 폴백(0070, 게스트 출연분 제외 0075). 원본 비노출.';

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
      and v.guest = false
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
  '공개용 일별 방송시간(KST 시작일 귀속). 세션 없는 날은 다시보기 길이 폴백(0070, 게스트 출연분 제외 0075). 원본 비노출.';

grant execute on function public.get_public_broadcast_stats(date) to anon, authenticated;
grant execute on function public.get_public_broadcast_daily(date, date) to anon, authenticated;
