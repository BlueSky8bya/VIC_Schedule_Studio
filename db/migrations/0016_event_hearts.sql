-- A(집계형 인기 표시): 일정별 관심(하트) 집계.
-- 시청자는 모두 구글 로그인 상태이므로 user_id로 1인 1하트(토글)를 보장한다.
-- 공개로는 집계 수만 노출하고 user_id는 절대 내보내지 않는다(아래 함수로만 집계 조회).
create table if not exists public.event_hearts (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_hearts_event_idx on public.event_hearts (event_id);

alter table public.event_hearts enable row level security;

-- 본인 하트만 읽을 수 있다(개인 "관심" 상태 복원용). 집계는 SECURITY DEFINER 함수로만 공개.
drop policy if exists "event_hearts_read_own" on public.event_hearts;
create policy "event_hearts_read_own" on public.event_hearts
  for select using (user_id = auth.uid());

grant select on public.event_hearts to authenticated;

-- 토글: 있으면 지우고 없으면 넣는다. 해당 일정의 새 집계 수를 돌려준다.
-- 직접 INSERT/DELETE는 RLS·grant로 막고, 이 함수만 변경 통로로 둔다.
create or replace function public.toggle_event_heart(p_event_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_count bigint;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  -- 공개 일정에만 하트를 허용한다(비공개/엠바고/작업 일정 보호).
  if not exists (
    select 1 from public.events e where e.id = p_event_id and e.is_public
  ) then
    raise exception 'event is not public';
  end if;

  if exists (
    select 1 from public.event_hearts h where h.event_id = p_event_id and h.user_id = uid
  ) then
    delete from public.event_hearts h where h.event_id = p_event_id and h.user_id = uid;
  else
    insert into public.event_hearts (event_id, user_id)
    values (p_event_id, uid)
    on conflict do nothing;
  end if;

  select count(*) into new_count from public.event_hearts h where h.event_id = p_event_id;
  return new_count;
end;
$$;

grant execute on function public.toggle_event_heart(uuid) to authenticated;

-- 집계 조회: 캘린더의 공개 일정별 하트 수만 반환(user_id 비노출 → 공개 안전).
create or replace function public.get_event_heart_counts(p_calendar_id uuid)
returns table (event_id uuid, count bigint)
language sql
security definer
set search_path = public
as $$
  select h.event_id, count(*)::bigint as count
  from public.event_hearts h
  join public.events e on e.id = h.event_id
  where e.calendar_id = p_calendar_id and e.is_public
  group by h.event_id;
$$;

grant execute on function public.get_event_heart_counts(uuid) to anon, authenticated;
