-- 방식 태그 '연습' 추가 — 대회/게임 본방 전 준비 방송용. 상태(준비) 표식이라 modifier.
-- 색은 점으로만 보이므로 비활성 태그가 비운 beige 재사용. idempotent.
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;
  insert into public.broadcast_tags
    (calendar_id, tag_key, display_name, color_key, sort_order, is_default, is_active, kind)
  values (v_cal, 'practice', '연습', 'beige', 21, false, true, 'modifier')
  on conflict (calendar_id, tag_key) do update
    set display_name = excluded.display_name, is_active = true, kind = 'modifier';
end $$;
