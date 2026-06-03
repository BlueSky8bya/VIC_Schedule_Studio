-- 방식 태그 '모캡'(모션캡처) 추가 — VRChat/합방 등에 얹히는 장비·기법 표식이라 modifier.
-- 새 고유 색(보라) 부여. idempotent.
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;
  insert into public.color_palette (calendar_id, key, name, bg_color, text_color, border_color, sort_order)
  values (v_cal, 'gen-cross-mocap', '모캡', '#ecc5f1', '#64206f', '#cd83d8', 53)
  on conflict (calendar_id, key) do nothing;
  insert into public.broadcast_tags
    (calendar_id, tag_key, display_name, color_key, sort_order, is_default, is_active, kind)
  values (v_cal, 'mocap', '모캡', 'gen-cross-mocap', 22, false, true, 'modifier')
  on conflict (calendar_id, tag_key) do update
    set display_name = excluded.display_name, is_active = true, kind = 'modifier';
end $$;
