-- ⚠ 역사 기록(2026-11-13): db/migrations/0159_retire_private_layer.sql이 이 파일이 만드는 비공개 레이어 객체
-- (event_private_meta·support_campaigns·has_private_unlock·is_active_worker·비공개 범위 정책)를 철수했다.
-- 다시 적용하지 말 것 — 지운 객체가 되살아나거나(테이블 없음으로) 실패한다. 현재 정의는 마이그레이션이 정본.
-- event_tags RLS 정책 보완. (sticker_assets 공개 읽기 정책은 0065 스티커 철수로 제거.)
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
