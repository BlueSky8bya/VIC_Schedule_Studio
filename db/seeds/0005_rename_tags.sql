-- 태그 표시명 갱신: 휴뱅/구플뱅/합방/대형서버/풀트뱅/잔잔뱅/종겜/노래뱅/기대컨/기타
-- tag_key는 그대로 두고 display_name/sort_order만 바꾼다(기존 event_tags 연결 유지).
do $$
declare
  v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  update public.broadcast_tags set display_name='휴뱅',     color_key='gray',     sort_order=1  where calendar_id=v_cal and tag_key='dayoff';
  update public.broadcast_tags set display_name='구플뱅',   color_key='orange',   sort_order=2  where calendar_id=v_cal and tag_key='worldcup';
  update public.broadcast_tags set display_name='합방',     color_key='lavender', sort_order=3  where calendar_id=v_cal and tag_key='collab';
  update public.broadcast_tags set display_name='대형서버', color_key='blue',     sort_order=4  where calendar_id=v_cal and tag_key='big_server';
  update public.broadcast_tags set display_name='풀트뱅',   color_key='pink',     sort_order=5  where calendar_id=v_cal and tag_key='full_track';
  update public.broadcast_tags set display_name='잔잔뱅',   color_key='mint',     sort_order=6  where calendar_id=v_cal and tag_key='calm';
  update public.broadcast_tags set display_name='종겜',     color_key='yellow',   sort_order=7  where calendar_id=v_cal and tag_key='variety_game';
  update public.broadcast_tags set display_name='노래뱅',   color_key='sky',      sort_order=8  where calendar_id=v_cal and tag_key='song';
  update public.broadcast_tags set display_name='기대컨',   color_key='lime',     sort_order=9  where calendar_id=v_cal and tag_key='hype';
  update public.broadcast_tags set display_name='기타',     color_key='beige',    sort_order=10 where calendar_id=v_cal and tag_key='easy';
end $$;
