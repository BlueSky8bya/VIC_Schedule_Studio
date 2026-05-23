create type public.trusted_role as enum ('manager', 'worker');
create type public.event_status as enum ('draft', 'scheduled', 'live', 'done', 'cancelled');
create type public.visibility_scope as enum ('public', 'embargo', 'work', 'owner_private');

-- 플랫폼 레벨 개발자 / 슈퍼관리자. 캘린더 소유자(스트리머)와 구분된다.
-- 개발자는 시스템을 유지보수하며 모든 캘린더를 읽고/편집할 수 있지만, 공개 API
-- 출력은 절대 바뀌지 않고 비공개 레이어 읽기에는 여전히 잠금해제 세션이 필요하다.
-- 개발자 구글 이메일을 시드로 넣는다 (db/seeds/platform_admins.sql 참고).
create table public.platform_admins (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

create table public.calendars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  title text not null,
  timezone text not null default 'Asia/Seoul',
  is_public boolean not null default true,
  theme_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  public_changed_at timestamptz
);

create table public.trusted_members (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  email text not null,
  display_name text,
  trusted_role public.trusted_role not null,
  can_view_embargo boolean not null default false,
  can_view_work boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, email)
);

create table public.private_layer_settings (
  calendar_id uuid primary key references public.calendars(id) on delete cascade,
  passcode_hash text not null,
  passcode_updated_at timestamptz not null default now(),
  passcode_version integer not null default 1,
  unlock_duration_minutes integer not null default 30,
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

create table public.color_palette (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  key text not null,
  name text not null,
  bg_color text not null,
  text_color text not null,
  border_color text not null,
  sort_order integer not null,
  unique (calendar_id, key)
);

create table public.broadcast_tags (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  tag_key text not null,
  display_name text not null,
  color_key text not null,
  sort_order integer not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, tag_key)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  date_key date not null,
  start_time time,
  end_time time,
  is_all_day boolean not null default false,
  public_title text not null,
  public_description text,
  visibility_scope public.visibility_scope not null default 'public',
  status public.event_status not null default 'scheduled',
  is_public boolean generated always as (visibility_scope = 'public') stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  public_changed_at timestamptz
);

create table public.event_private_meta (
  event_id uuid primary key references public.events(id) on delete cascade,
  private_title text,
  private_memo text,
  editor_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_tags (
  event_id uuid not null references public.events(id) on delete cascade,
  tag_id uuid not null references public.broadcast_tags(id) on delete cascade,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  primary key (event_id, tag_id)
);

create table public.support_campaigns (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  title text not null,
  description text,
  url text not null,
  starts_on date not null,
  ends_on date not null,
  public_cta_label text not null,
  highlight_color_key text not null,
  is_public boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  public_changed_at timestamptz
);

create table public.sticker_assets (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  name text not null,
  file_url text not null,
  file_type text not null,
  width_px integer,
  height_px integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sticker_instances (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  asset_id uuid references public.sticker_assets(id) on delete cascade,
  page_scope text not null default 'monthly',
  year integer not null,
  month integer not null,
  x_ratio numeric not null,
  y_ratio numeric not null,
  width_ratio numeric not null,
  rotation_deg numeric not null default 0,
  opacity numeric not null default 1,
  z_index integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
