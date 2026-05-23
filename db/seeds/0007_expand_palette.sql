-- 팔레트를 13색으로 확장: 빨강/남색/틸 추가. (태그 13개에 1색씩 배정 가능하게)
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  insert into public.color_palette (calendar_id, key, name, bg_color, text_color, border_color, sort_order)
  values
    (v_cal, 'red',    '빨강', '#f59090', '#6e1414', '#e86b6b', 11),
    (v_cal, 'indigo', '남색', '#939ae8', '#222a66', '#6f76d6', 12),
    (v_cal, 'teal',   '틸',   '#3bb6c4', '#063c44', '#2596a6', 13)
  on conflict (calendar_id, key) do update
    set name = excluded.name,
        bg_color = excluded.bg_color,
        text_color = excluded.text_color,
        border_color = excluded.border_color,
        sort_order = excluded.sort_order;
end $$;
