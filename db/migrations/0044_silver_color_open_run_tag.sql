-- 은색(silver) 팔레트 색 + '오픈런' 형식(modifier) 태그 추가.
--   은색 = 스틸/건메탈 단색(흰 글씨, 대비 4.6:1) — 형식 풀(plain)이라 형식 태그에서 고를 수 있다.
--   오픈런 = 형식(modifier) 태그, 색 silver. 콘텐츠 통계엔 안 잡히고 점으로만 표시.
-- vic 캘린더에만. idempotent (on conflict do nothing).
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  insert into public.color_palette
    (calendar_id, key, name, bg_color, text_color, border_color, sort_order)
  select
    v_cal, 'silver', '은색', '#6b7682', '#ffffff', '#4b535c',
    coalesce((select max(sort_order) from public.color_palette where calendar_id = v_cal), 0) + 1
  on conflict (calendar_id, key) do nothing;

  insert into public.broadcast_tags
    (calendar_id, tag_key, display_name, color_key, sort_order, is_default, is_active, kind, v3_only)
  select
    v_cal, 'open_run', '오픈런', 'silver',
    coalesce((select max(sort_order) from public.broadcast_tags where calendar_id = v_cal), 0) + 1,
    false, true, 'modifier', false
  on conflict (calendar_id, tag_key) do nothing;
end $$;
