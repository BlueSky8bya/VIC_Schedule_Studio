alter table public.calendars enable row level security;
alter table public.memberships enable row level security;
alter table public.variant_groups enable row level security;
alter table public.events enable row level security;
alter table public.event_private_meta enable row level security;
alter table public.unlock_sessions enable row level security;
alter table public.proposals enable row level security;
alter table public.requests enable row level security;
alter table public.support_campaigns enable row level security;
alter table public.sticker_instances enable row level security;

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

create or replace function public.is_trusted_calendar_member(target_calendar_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.is_calendar_owner(target_calendar_id)
    or exists (
      select 1
      from public.memberships m
      where m.calendar_id = target_calendar_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'trusted_member')
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
    where s.calendar_id = target_calendar_id
      and s.user_id = auth.uid()
      and s.expires_at > now()
  );
$$;

create policy "public can read published events"
on public.events for select
using (status in ('scheduled', 'live', 'done', 'cancelled'));

create policy "owners can manage events"
on public.events for all
using (public.is_calendar_owner(calendar_id))
with check (public.is_calendar_owner(calendar_id));

create policy "trusted unlocked members can read private event meta"
on public.event_private_meta for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_private_meta.event_id
      and public.is_trusted_calendar_member(e.calendar_id)
      and public.has_private_unlock(e.calendar_id)
  )
);

create policy "owners can manage private event meta"
on public.event_private_meta for all
using (
  exists (
    select 1
    from public.events e
    where e.id = event_private_meta.event_id
      and public.is_calendar_owner(e.calendar_id)
  )
)
with check (
  exists (
    select 1
    from public.events e
    where e.id = event_private_meta.event_id
      and public.is_calendar_owner(e.calendar_id)
  )
);

create policy "public can create proposals"
on public.proposals for insert
with check (state = 'new');

create policy "public can read accepted proposals"
on public.proposals for select
using (state = 'accepted');

create policy "owners can manage proposals"
on public.proposals for all
using (public.is_calendar_owner(calendar_id))
with check (public.is_calendar_owner(calendar_id));

create policy "owners can manage requests"
on public.requests for all
using (public.is_calendar_owner(calendar_id))
with check (public.is_calendar_owner(calendar_id));
