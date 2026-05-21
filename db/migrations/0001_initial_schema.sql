create type public.membership_role as enum ('owner', 'trusted_member');
create type public.event_status as enum ('draft', 'scheduled', 'live', 'done', 'cancelled');
create type public.proposal_state as enum ('new', 'reviewing', 'accepted', 'rejected');
create type public.request_state as enum ('new', 'triaged', 'scheduled', 'closed');

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  display_name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  timezone text not null default 'Asia/Seoul',
  created_at timestamptz not null default now()
);

create table public.memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  role public.membership_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, calendar_id)
);

create table public.variant_groups (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  name text not null,
  promotion_state text not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  public_title text not null,
  public_description text,
  status public.event_status not null default 'draft',
  category text not null default 'stream',
  variant_group_id uuid references public.variant_groups(id) on delete set null,
  variant_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_private_meta (
  event_id uuid primary key references public.events(id) on delete cascade,
  private_title text,
  private_notes text,
  codename text,
  embargo_until timestamptz,
  editor_note text,
  work_state text,
  updated_at timestamptz not null default now()
);

create table public.unlock_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  passcode_version integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  type text not null,
  content text not null,
  vote_count integer not null default 0,
  state public.proposal_state not null default 'new',
  created_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  source text not null,
  state public.request_state not null default 'new',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.support_campaigns (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  cta_label text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table public.sticker_instances (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  label text not null,
  x_ratio numeric not null,
  y_ratio numeric not null,
  width_ratio numeric not null,
  z_index integer not null default 0,
  created_at timestamptz not null default now()
);
