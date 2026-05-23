-- owner_private("나만")를 소유자 전용으로. 개발자(superadmin)도 읽기/쓰기 불가.
-- (관리/읽기 정책에서 owner_private는 is_calendar_owner만 허용하도록 좁힌다.)

-- 이벤트 관리: 개발자는 owner_private를 만들거나 보거나 수정할 수 없다.
drop policy if exists "owners can manage events" on public.events;
create policy "owners can manage events"
on public.events for all
using (
  public.is_calendar_admin(calendar_id)
  and (visibility_scope <> 'owner_private' or public.is_calendar_owner(calendar_id))
)
with check (
  public.is_calendar_admin(calendar_id)
  and (visibility_scope <> 'owner_private' or public.is_calendar_owner(calendar_id))
);

-- owner_private 읽기: 소유자 전용 (+ 잠금해제 세션)
drop policy if exists "owners can read owner private events" on public.events;
create policy "owners can read owner private events"
on public.events for select
using (
  visibility_scope = 'owner_private'
  and public.is_calendar_owner(calendar_id)
  and public.has_private_unlock(calendar_id)
);

-- 비공개 메타도 동일: owner_private 이벤트의 메타는 소유자만 관리/열람
drop policy if exists "owners can manage private meta" on public.event_private_meta;
create policy "owners can manage private meta"
on public.event_private_meta for all
using (
  exists (
    select 1 from public.events e
    where e.id = event_private_meta.event_id
      and public.is_calendar_admin(e.calendar_id)
      and (e.visibility_scope <> 'owner_private' or public.is_calendar_owner(e.calendar_id))
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = event_private_meta.event_id
      and public.is_calendar_admin(e.calendar_id)
      and (e.visibility_scope <> 'owner_private' or public.is_calendar_owner(e.calendar_id))
  )
);
