-- event_tags / sticker_assets RLS 정책 보완.
-- (0001에서 RLS는 켰지만 정책을 빠뜨려 모든 접근이 차단돼 있었음 → 태그 저장 실패 원인)

-- 부모 이벤트를 볼 수 있으면 그 이벤트의 태그도 읽을 수 있다.
create policy "read event tags for visible events"
on public.event_tags for select
using (
  exists (
    select 1
    from public.events e
    where e.id = event_tags.event_id
      and (
        (e.visibility_scope = 'public' and e.status <> 'draft')
        or public.is_calendar_admin(e.calendar_id)
        or (
          e.visibility_scope in ('embargo', 'work')
          and public.is_active_trusted_member(e.calendar_id)
          and public.has_private_unlock(e.calendar_id)
        )
      )
  )
);

-- owner/developer는 자기 캘린더 이벤트의 태그를 생성/수정/삭제할 수 있다.
create policy "admins manage event tags"
on public.event_tags for all
using (
  exists (
    select 1 from public.events e
    where e.id = event_tags.event_id and public.is_calendar_admin(e.calendar_id)
  )
)
with check (
  exists (
    select 1 from public.events e
    where e.id = event_tags.event_id and public.is_calendar_admin(e.calendar_id)
  )
);

-- 공개 스티커 인스턴스가 참조하는 에셋(이름/URL)은 공개 읽기 허용 (장식 정보)
create policy "public can read sticker assets"
on public.sticker_assets for select
using (true);
