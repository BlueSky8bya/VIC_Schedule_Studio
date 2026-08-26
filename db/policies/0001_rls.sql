alter table public.calendars enable row level security;
alter table public.trusted_members enable row level security;
alter table public.private_layer_settings enable row level security;
alter table public.unlock_sessions enable row level security;
alter table public.color_palette enable row level security;
alter table public.broadcast_tags enable row level security;
alter table public.events enable row level security;
alter table public.event_private_meta enable row level security;
alter table public.event_tags enable row level security;
alter table public.support_campaigns enable row level security;
alter table public.platform_admins enable row level security;

-- platform_admins에는 허용 정책이 없다: anon/auth 클라이언트로는 읽기/쓰기가 불가능하며
-- 아래의 security-definer 헬퍼 함수와 service-role 클라이언트로만 접근된다. 이렇게 해서
-- 개발자 허용목록을 모든 일반 쿼리에서 제외한다.

create or replace function public.is_developer()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_admins a
    join auth.users u on lower(u.email) = lower(a.email)
    where u.id = auth.uid()
  );
$$;

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
  );
$$;

-- 캘린더 관리자 = 이 캘린더를 소유한 스트리머, 또는 플랫폼 개발자 누구든.
-- 관리/쓰기 정책과 owner_private 읽기에 이걸 사용해, 개발자가 등록된 소유자가
-- 아니어도 모든 캘린더를 유지보수할 수 있게 한다.
create or replace function public.is_calendar_admin(target_calendar_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_calendar_owner(target_calendar_id) or public.is_developer();
$$;

create or replace function public.is_active_trusted_member(target_calendar_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_calendar_admin(target_calendar_id)
    or exists (
      select 1
      from public.trusted_members m
      join auth.users u on lower(u.email) = lower(m.email)
      where m.calendar_id = target_calendar_id
        and u.id = auth.uid()
        and m.is_active = true
    );
$$;

create or replace function public.has_private_unlock(target_calendar_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.unlock_sessions s
    join public.private_layer_settings p on p.calendar_id = s.calendar_id
    where s.calendar_id = target_calendar_id
      and s.user_id = auth.uid()
      and s.passcode_version = p.passcode_version
      and s.expires_at > now()
  );
$$;

create policy "public can read public calendars"
on public.calendars for select
using (is_public = true);

create policy "owners can manage calendars"
on public.calendars for all
using (public.is_calendar_admin(id))
with check (public.is_calendar_admin(id));

create policy "public can read public events"
on public.events for select
using (visibility_scope = 'public' and status <> 'draft');

create policy "owners can manage events"
on public.events for all
using (public.is_calendar_admin(calendar_id))
with check (public.is_calendar_admin(calendar_id));

create policy "trusted unlocked users can read private events"
on public.events for select
using (
  visibility_scope in ('embargo', 'work')
  and public.is_active_trusted_member(calendar_id)
  and public.has_private_unlock(calendar_id)
);

create policy "owners can read owner private events"
on public.events for select
using (
  visibility_scope = 'owner_private'
  and public.is_calendar_admin(calendar_id)
  and public.has_private_unlock(calendar_id)
);

create policy "trusted unlocked users can read private meta"
on public.event_private_meta for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_private_meta.event_id
      and e.visibility_scope in ('embargo', 'work')
      and public.is_active_trusted_member(e.calendar_id)
      and public.has_private_unlock(e.calendar_id)
  )
);

create policy "owners can manage private meta"
on public.event_private_meta for all
using (
  exists (
    select 1 from public.events e
    where e.id = event_private_meta.event_id
      and public.is_calendar_admin(e.calendar_id)
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = event_private_meta.event_id
      and public.is_calendar_admin(e.calendar_id)
  )
);

create policy "public can read active tags and palette"
on public.broadcast_tags for select
using (is_active = true);

create policy "public can read palette"
on public.color_palette for select
using (true);

create policy "public can read public support campaigns"
on public.support_campaigns for select
using (is_public = true and is_active = true);

create policy "owners can manage trusted members"
on public.trusted_members for all
using (public.is_calendar_admin(calendar_id))
with check (public.is_calendar_admin(calendar_id));

create policy "owners can manage private layer settings"
on public.private_layer_settings for all
using (public.is_calendar_admin(calendar_id))
with check (public.is_calendar_admin(calendar_id));

create policy "owners can manage tags"
on public.broadcast_tags for all
using (public.is_calendar_admin(calendar_id))
with check (public.is_calendar_admin(calendar_id));

create policy "owners can manage palette"
on public.color_palette for all
using (public.is_calendar_admin(calendar_id))
with check (public.is_calendar_admin(calendar_id));

create policy "owners can manage support campaigns"
on public.support_campaigns for all
using (public.is_calendar_admin(calendar_id))
with check (public.is_calendar_admin(calendar_id));
