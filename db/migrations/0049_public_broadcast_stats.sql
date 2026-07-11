-- 0049: 시청자(비로그인 포함)에게 보여줄 '방송 기록' 집계만 여는 RPC.
--
-- broadcast_session 테이블 자체는 계속 RLS deny-all(anon/authenticated 직접 접근 차단, 0046/0047).
-- 세션 원본(시작·종료 시각, 제목)은 운영 데이터라 공개하지 않는다. 대신 SECURITY DEFINER 함수로
-- '월별 합계'만 내보낸다 — 방송 시간(시간 단위), 방송한 날 수, 세션 수. 개별 세션은 절대 나가지 않는다.
--
-- 귀속은 기존 규칙 그대로: 자정을 넘겨도 start_day(KST 시작일) 하나에 통째로(0046 주석 참조).
-- 유효 방송시간 = coalesce(ended_at, last_live_at) - started_at (진행 중 세션은 마지막 확인 시각까지).

create or replace function public.get_public_broadcast_stats(p_from_day date)
returns table (ym text, hours numeric, days integer, sessions integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    to_char(start_day, 'YYYY-MM') as ym,
    round(
      (sum(extract(epoch from (coalesce(ended_at, last_live_at) - started_at))) / 3600.0)::numeric,
      1
    ) as hours,
    count(distinct start_day)::int as days,
    count(*)::int as sessions
  from public.broadcast_session
  where start_day >= p_from_day
  group by 1
  order by 1;
$$;

comment on function public.get_public_broadcast_stats(date) is
  '공개용 방송 기록 집계(월별 시간/일수/세션수). 세션 원본은 노출하지 않는다. 시청자 인사이트에서 사용.';

-- 비로그인 시청자도 볼 수 있어야 하므로 anon에게도 실행 권한.
grant execute on function public.get_public_broadcast_stats(date) to anon, authenticated;
