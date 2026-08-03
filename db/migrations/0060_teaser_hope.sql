-- 최초공개(떡밥) '기대돼요' — 공개 전까지만 누를 수 있는 기대 카운트(하트와 별개).
-- 공개 순간 "n명이 기다렸어요" 배지로 전환되는 기대감 지표. 로그인 여부와 무관하게
-- 기기 토큰(익명 하트와 같은 vic:anonId) 기준 1기기 1표 — PII 비저장.
-- 0040(event_hearts_anon) 패턴 그대로: RLS 켜고 정책 없음(직접 접근 차단),
-- 변경/조회는 security definer 함수로만. 멱등.

create table if not exists public.teaser_hope (
  event_id uuid not null references public.events(id) on delete cascade,
  device_token text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, device_token)
);

create index if not exists teaser_hope_event_idx on public.teaser_hope (event_id);

alter table public.teaser_hope enable row level security;
-- 정책 없음 = 직접 접근 차단. 아래 security definer 함수로만.

-- 토글: '아직 공개 전인 떡밥 공개 일정'만 허용 — 공개가 지나면 기대는 닫힌다(기록은 남아
-- 배지 집계에 쓰임). 새 총합을 돌려준다.
create or replace function public.toggle_teaser_hope(p_event_id uuid, p_token text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  if p_token is null or length(p_token) < 8 then
    raise exception 'invalid token';
  end if;
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.is_public
      and e.teaser
      and e.teaser_reveal_at is not null
      and e.teaser_reveal_at > now()
  ) then
    raise exception 'event is not an active teaser';
  end if;

  if exists (
    select 1 from public.teaser_hope t
    where t.event_id = p_event_id and t.device_token = p_token
  ) then
    delete from public.teaser_hope t
    where t.event_id = p_event_id and t.device_token = p_token;
  else
    insert into public.teaser_hope (event_id, device_token)
    values (p_event_id, p_token)
    on conflict do nothing;
  end if;

  select count(*) from public.teaser_hope t where t.event_id = p_event_id into new_count;
  return new_count;
end;
$$;

grant execute on function public.toggle_teaser_hope(uuid, text) to anon, authenticated, service_role;

-- 이 기기가 이 캘린더에서 기대한 일정 id 목록 — '내가 눌렀는지' 복원용.
create or replace function public.get_teaser_hope_ids(p_calendar_id uuid, p_token text)
returns table (event_id uuid)
language sql
security definer
set search_path = public
as $$
  select t.event_id
  from public.teaser_hope t
  join public.events e on e.id = t.event_id
  where e.calendar_id = p_calendar_id and e.is_public and t.device_token = p_token;
$$;

grant execute on function public.get_teaser_hope_ids(uuid, text) to anon, authenticated, service_role;

-- 집계: 캘린더의 기대 수(공개 일정만, 토큰 비노출 → 공개 안전). 공개가 지난 떡밥도 포함
-- — "n명이 기다렸어요" 배지가 공개 후에도 남는다.
create or replace function public.get_teaser_hope_counts(p_calendar_id uuid)
returns table (event_id uuid, count bigint)
language sql
security definer
set search_path = public
as $$
  select t.event_id, count(*)::bigint as count
  from public.teaser_hope t
  join public.events e on e.id = t.event_id
  where e.calendar_id = p_calendar_id and e.is_public
  group by t.event_id;
$$;

grant execute on function public.get_teaser_hope_counts(uuid) to anon, authenticated, service_role;
