-- 남은 모든 세부(자식) 일괄 폐기 → 완전 flat. 자식에 붙은 이벤트는 부모(대분류)로 옮겨 보존
-- (예: 게임>롤 태그 이벤트 → 게임 태그로). 그 뒤 자식 태그 전부 삭제. idempotent.
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  -- 1) 자식 태그가 붙은 이벤트를 부모 태그로 옮긴다(부모가 이미 있으면 중복이라 건너뜀).
  update public.event_tags et
  set tag_id = p.id
  from public.broadcast_tags c
  join public.broadcast_tags p on p.id = c.parent_id
  where et.tag_id = c.id
    and c.calendar_id = v_cal
    and not exists (
      select 1 from public.event_tags e2
      where e2.event_id = et.event_id and e2.tag_id = p.id
    );

  -- 2) 모든 자식 태그 삭제 — 남은(중복) 자식 event_tags는 FK cascade로 함께 정리된다.
  delete from public.broadcast_tags where calendar_id = v_cal and parent_id is not null;
end $$;
