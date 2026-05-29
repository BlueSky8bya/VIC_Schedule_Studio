-- 개발자 인사이트 "시간대 동시 접속(체류)"용 핑 로그.
-- 브라우저가 화면에 보이는 동안 60초마다 1핑 → (세션, 분) 단위로 1줄만 남긴다(멱등 upsert).
-- 역할/기기/날짜만 저장 — 개인정보(이메일·user_id) 없음. session_hash는 무작위 식별자(PII 아님).
--
-- 핵심 등식:
--   어떤 시간대의 "평균 동시 접속" = (그 시간대에 찍힌 핑 수) / 60
--     (한 세션이 한 시간을 풀로 켜놓으면 분마다 1핑 = 60핑 → 평균 1.0)
--   어떤 시간대의 "최고 동시 접속" = 그 시간대 각 분의 세션 수 중 최댓값
--     (분당 핑 수 = 그 분에 떠 있던 세션 수, (session,minute) 유니크라서)
--
-- 쓰기/읽기는 서비스 롤(서버 액션)로만 — RLS 정책을 두지 않아 일반 사용자는 접근 불가.

create table if not exists public.presence_ping (
  session_hash text not null,
  minute_ts timestamptz not null, -- 분 단위로 truncate된 시각(UTC)
  day date not null,              -- KST 날짜(월 범위 조회·정리용)
  role text not null,
  device text not null,
  primary key (session_hash, minute_ts)
);

create index if not exists presence_ping_day_idx on public.presence_ping (day);
create index if not exists presence_ping_minute_idx on public.presence_ping (minute_ts);

alter table public.presence_ping enable row level security;
-- 일반 사용자(anon/authenticated)는 정책이 없으므로 읽기/쓰기 모두 불가. 서비스 롤은 RLS 우회.
revoke all on public.presence_ping from anon, authenticated;

-- 시간대(KST)별 역할/기기 핑 수 — 평균 동시 접속은 서버에서 /60 한다. 월 범위 [p_start, p_end).
create or replace function public.presence_hourly(p_start date, p_end date)
returns table (hour int, role text, device text, pings bigint)
language sql
stable
as $$
  select
    extract(hour from (minute_ts at time zone 'Asia/Seoul'))::int as hour,
    role,
    device,
    count(*) as pings
  from public.presence_ping
  where day >= p_start and day < p_end
  group by 1, 2, 3
$$;

-- 시간대(KST)별 최고 동시 접속 — 분당 세션 수(=핑 수)의 그 시간대 내 최댓값.
create or replace function public.presence_peak(p_start date, p_end date)
returns table (hour int, peak bigint)
language sql
stable
as $$
  select hour, max(cnt)::bigint as peak
  from (
    select
      extract(hour from (minute_ts at time zone 'Asia/Seoul'))::int as hour,
      minute_ts,
      count(*) as cnt
    from public.presence_ping
    where day >= p_start and day < p_end
    group by 1, 2
  ) m
  group by hour
$$;

-- 집계 함수도 서버(서비스 롤)에서만 호출.
revoke all on function public.presence_hourly(date, date) from public;
revoke all on function public.presence_peak(date, date) from public;
grant execute on function public.presence_hourly(date, date) to service_role;
grant execute on function public.presence_peak(date, date) to service_role;
