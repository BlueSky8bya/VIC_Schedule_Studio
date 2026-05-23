-- B2: 시청자 하트(좋아요) 반응. 숫자는 노출하지 않고 비율로 하트를 더 띄우는 용도.
-- 캘린더당 하나의 누적 카운트만 둔다(달 무관). 개별 탭 로그는 남기지 않아 무한 증가/추적을 피한다.
create table if not exists public.calendar_hearts (
  calendar_id uuid primary key references public.calendars(id) on delete cascade,
  count bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.calendar_hearts enable row level security;

-- 카운트는 누구나(로그인 시청자 포함) 읽을 수 있다(공개 데이터).
drop policy if exists "calendar_hearts_read" on public.calendar_hearts;
create policy "calendar_hearts_read" on public.calendar_hearts for select using (true);

grant select on public.calendar_hearts to anon, authenticated;

-- 증가는 SECURITY DEFINER 함수로만(직접 INSERT/UPDATE는 RLS로 막힘) → 안전한 +1 보장.
create or replace function public.add_calendar_heart(p_calendar_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  insert into public.calendar_hearts (calendar_id, count, updated_at)
  values (p_calendar_id, 1, now())
  on conflict (calendar_id)
  do update set count = public.calendar_hearts.count + 1, updated_at = now()
  returning count into new_count;
  return new_count;
end;
$$;

-- 로그인 사용자만 하트를 누를 수 있다(시청자도 구글 로그인 상태).
grant execute on function public.add_calendar_heart(uuid) to authenticated;
