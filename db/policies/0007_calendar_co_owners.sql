-- is_calendar_owner를 재정의해, 주 소유자(calendars.owner_id)뿐 아니라
-- calendar_co_owners에 등록된 공동 소유자 계정도 소유자로 인정한다.
-- is_calendar_admin / owner_private 게이트가 모두 이 함수를 거치므로, 이 한 군데만
-- 바꾸면 공동 소유자가 owner와 완전히 동일한 쓰기/열람 권한을 갖는다.
create or replace function public.is_calendar_owner(target_calendar_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.calendars c
    where c.id = target_calendar_id
      and c.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.calendar_co_owners co
    where co.calendar_id = target_calendar_id
      and co.owner_id = auth.uid()
  );
$$;
