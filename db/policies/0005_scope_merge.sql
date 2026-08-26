-- 작업자/매니저 권한 개편 + "엠바고"·"나만" 통합(owner_private = 소유자 전용 "엠바고").
--  - "작업자"(work): 작업자 + 관리자(owner/dev)만 잠금해제 후 읽는다. 매니저는 비공개를 전혀 못 봄.
--  - "엠바고"(owner_private): 소유자 전용(0004 정책 그대로). 옛 embargo는 0025로 owner_private로 이전.

-- 작업자(활성) 여부 — 작업자 역할은 2026-08-27 철수(0065, ADR-0015): 항상 false. 인자는 아래 정책 호환용.
-- (원래 본문은 trusted_members.is_worker/trusted_role='worker' 판정이었다 — 컬럼 is_worker는 0065가 drop.
--  이 파일을 재적용해도 작업자 판정이 되살아나면 안 되므로 스텁을 그대로 둔다. 원본은 git 이력.)
create or replace function public.is_active_worker(target_calendar_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select false;
$$;

-- events: 옛 "trusted unlocked … embargo/work" 정책 제거 → work만, 작업자/관리자만(매니저 제외).
drop policy if exists "trusted unlocked users can read private events" on public.events;
drop policy if exists "workers can read work events" on public.events;
create policy "workers can read work events"
on public.events for select
using (
  visibility_scope = 'work'
  and (public.is_active_worker(calendar_id) or public.is_calendar_admin(calendar_id))
  and public.has_private_unlock(calendar_id)
);

-- event_private_meta: 동일 기준.
drop policy if exists "trusted unlocked users can read private meta" on public.event_private_meta;
drop policy if exists "workers can read work meta" on public.event_private_meta;
create policy "workers can read work meta"
on public.event_private_meta for select
using (
  exists (
    select 1 from public.events e
    where e.id = event_private_meta.event_id
      and e.visibility_scope = 'work'
      and (public.is_active_worker(e.calendar_id) or public.is_calendar_admin(e.calendar_id))
      and public.has_private_unlock(e.calendar_id)
  )
);

-- event_tags 읽기: 공개 OR 관리자 OR (work + 작업자 + 잠금해제). embargo/매니저 제거.
drop policy if exists "read event tags for visible events" on public.event_tags;
create policy "read event tags for visible events"
on public.event_tags for select
using (
  exists (
    select 1 from public.events e
    where e.id = event_tags.event_id
      and (
        (e.visibility_scope = 'public' and e.status <> 'draft')
        or public.is_calendar_admin(e.calendar_id)
        or (
          e.visibility_scope = 'work'
          and public.is_active_worker(e.calendar_id)
          and public.has_private_unlock(e.calendar_id)
        )
      )
  )
);
