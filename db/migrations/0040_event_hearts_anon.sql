-- 익명(비로그인) 관심 하트: 구글 로그인 없이도 시청자가 하트를 누를 수 있게 한다.
-- 로그인 사용자는 기존 event_hearts(계정 1인 1하트), 비로그인은 여기 device_token(기기당 1하트).
-- 집계 배지/정렬은 두 표를 합산한다. device_token은 신뢰 못 하는 클라이언트 값이라 중복(시크릿창
-- 여러 개)은 막지 못하지만, '관심 신호' 용도라 가벼운 dedup으로 충분(투표가 아님).
create table if not exists public.event_hearts_anon (
  event_id uuid not null references public.events(id) on delete cascade,
  device_token text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, device_token)
);

create index if not exists event_hearts_anon_event_idx on public.event_hearts_anon (event_id);

alter table public.event_hearts_anon enable row level security;
-- 정책 없음 = 직접 접근 차단. 변경/조회는 아래 security definer 함수로만(공개 안전).

-- 토글(익명): 공개 일정만 허용. 기기 토큰 1개당 1하트. 새 총합(계정+익명)을 돌려준다.
create or replace function public.toggle_event_heart_anon(p_event_id uuid, p_token text)
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
    select 1 from public.events e where e.id = p_event_id and e.is_public
  ) then
    raise exception 'event is not public';
  end if;

  if exists (
    select 1 from public.event_hearts_anon a
    where a.event_id = p_event_id and a.device_token = p_token
  ) then
    delete from public.event_hearts_anon a
    where a.event_id = p_event_id and a.device_token = p_token;
  else
    insert into public.event_hearts_anon (event_id, device_token)
    values (p_event_id, p_token)
    on conflict do nothing;
  end if;

  select (select count(*) from public.event_hearts h where h.event_id = p_event_id)
       + (select count(*) from public.event_hearts_anon a where a.event_id = p_event_id)
    into new_count;
  return new_count;
end;
$$;

grant execute on function public.toggle_event_heart_anon(uuid, text) to anon, authenticated;

-- 이 기기(토큰)가 이 캘린더에서 하트한 공개 일정 id 목록 — 비로그인도 '내 하트' 채움 복원용.
create or replace function public.get_anon_heart_ids(p_calendar_id uuid, p_token text)
returns table (event_id uuid)
language sql
security definer
set search_path = public
as $$
  select a.event_id
  from public.event_hearts_anon a
  join public.events e on e.id = a.event_id
  where e.calendar_id = p_calendar_id and e.is_public and a.device_token = p_token;
$$;

grant execute on function public.get_anon_heart_ids(uuid, text) to anon, authenticated;

-- 집계 조회: 계정 하트 + 익명 하트 합산(공개 일정만, user_id/token 비노출 → 공개 안전).
create or replace function public.get_event_heart_counts(p_calendar_id uuid)
returns table (event_id uuid, count bigint)
language sql
security definer
set search_path = public
as $$
  select e.id as event_id,
         (select count(*) from public.event_hearts h where h.event_id = e.id)
       + (select count(*) from public.event_hearts_anon a where a.event_id = e.id) as count
  from public.events e
  where e.calendar_id = p_calendar_id and e.is_public
    and (
      exists (select 1 from public.event_hearts h where h.event_id = e.id)
      or exists (select 1 from public.event_hearts_anon a where a.event_id = e.id)
    );
$$;

grant execute on function public.get_event_heart_counts(uuid) to anon, authenticated;
