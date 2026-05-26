-- 공동 소유자(co-owners).
-- 한 스트리머가 여러 구글 계정으로 "동일한 소유자 권한"을 갖고 싶을 때 사용한다.
-- calendars.owner_id(주 소유자)는 그대로 두고, 여기 등록된 계정도 is_calendar_owner로
-- 인정한다(RLS의 쓰기/owner_private 게이트가 모두 통과). 진짜 별개의 두 사람이 아니라,
-- 같은 사람이 계정 2개를 쓰는 케이스를 위한 추가형(additive) 메커니즘이다.
create table if not exists public.calendar_co_owners (
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (calendar_id, owner_id)
);

-- platform_admins와 동일한 잠금: anon/auth 클라이언트엔 정책이 없어 직접 읽기/쓰기가
-- 불가능하고, security definer 함수(is_calendar_owner)로만 참조된다.
alter table public.calendar_co_owners enable row level security;
