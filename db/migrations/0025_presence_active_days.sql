-- 시간대 "평균 동시 접속"을 전형적인 하루 기준으로 만들기 위한 보조 집계.
-- 한 달치 핑을 시간대(24칸)로 합치면 핑/60은 '여러 날의 합'이라 동시 접속이 부풀어 보인다.
-- 그래서 핑/(60 × 관측된 일수)로 나눠 "관측된 하루 평균 동시 접속"으로 정규화한다.
-- 관측된 일수 = presence_ping에 핑이 하나라도 있는 (KST) 날의 수.

create or replace function public.presence_active_days(p_start date, p_end date)
returns int
language sql
stable
as $$
  select count(distinct day)::int
  from public.presence_ping
  where day >= p_start and day < p_end
$$;

revoke all on function public.presence_active_days(date, date) from public;
grant execute on function public.presence_active_days(date, date) to service_role;
