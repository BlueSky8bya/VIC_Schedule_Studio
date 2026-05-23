-- 기본 방송 태그 13종으로 갱신.
-- 휴뱅·구플뱅·합방·서버·풀트뱅·VRChat·종겜·시참의날·소통뱅·기타 + CK·대회·시네티
-- 기존 10개는 tag_key를 유지한 채 이름/색/순서만 바꿔(event_tags 연결 보존), 3개만 새로 추가.
-- 색은 13색 팔레트에서 1색씩 배정해 겹치지 않게 한다. (휴뱅=회색 고정)
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  update public.broadcast_tags set display_name='휴뱅',     color_key='gray',     sort_order=1,  is_active=true where calendar_id=v_cal and tag_key='dayoff';
  update public.broadcast_tags set display_name='구플뱅',   color_key='orange',   sort_order=2,  is_active=true where calendar_id=v_cal and tag_key='worldcup';
  update public.broadcast_tags set display_name='합방',     color_key='lavender', sort_order=3,  is_active=true where calendar_id=v_cal and tag_key='collab';
  update public.broadcast_tags set display_name='서버',     color_key='blue',     sort_order=4,  is_active=true where calendar_id=v_cal and tag_key='big_server';
  update public.broadcast_tags set display_name='풀트뱅',   color_key='pink',     sort_order=5,  is_active=true where calendar_id=v_cal and tag_key='full_track';
  update public.broadcast_tags set display_name='VRChat',   color_key='mint',     sort_order=6,  is_active=true where calendar_id=v_cal and tag_key='calm';
  update public.broadcast_tags set display_name='종겜',     color_key='yellow',   sort_order=7,  is_active=true where calendar_id=v_cal and tag_key='variety_game';
  update public.broadcast_tags set display_name='시참의날', color_key='sky',      sort_order=8,  is_active=true where calendar_id=v_cal and tag_key='song';
  update public.broadcast_tags set display_name='소통뱅',   color_key='lime',     sort_order=9,  is_active=true where calendar_id=v_cal and tag_key='hype';
  update public.broadcast_tags set display_name='기타',     color_key='beige',    sort_order=10, is_active=true where calendar_id=v_cal and tag_key='easy';

  insert into public.broadcast_tags (calendar_id, tag_key, display_name, color_key, sort_order, is_default, is_active)
  values
    (v_cal, 'ck',         'CK',     'red',    11, true, true),
    (v_cal, 'tournament', '대회',   'indigo', 12, true, true),
    (v_cal, 'cineti',     '시네티', 'teal',   13, true, true)
  on conflict (calendar_id, tag_key) do update
    set display_name = excluded.display_name,
        color_key = excluded.color_key,
        sort_order = excluded.sort_order,
        is_active = true;
end $$;
