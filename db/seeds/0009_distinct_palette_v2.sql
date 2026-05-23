-- 13색 팔레트를 휴(hue) 휠에 고르게 퍼뜨려 서로 최대한 구분되게 재구성.
-- 기존엔 파랑/하늘/남색/청록/민트가 한데 몰려 비슷해 보였음 → 간격을 벌린다.
-- key는 유지(태그 color_key 연결 보존), 색/이름만 변경.
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  update public.color_palette set name='회색', bg_color='#c4c8d0', text_color='#2b2f38', border_color='#9aa0ab' where calendar_id=v_cal and key='gray';
  update public.color_palette set name='빨강', bg_color='#f58a8a', text_color='#6b1212', border_color='#e25c5c' where calendar_id=v_cal and key='red';
  update public.color_palette set name='주황', bg_color='#f7ad5e', text_color='#6e3500', border_color='#ed8c2c' where calendar_id=v_cal and key='orange';
  update public.color_palette set name='노랑', bg_color='#f7da4d', text_color='#5f4a00', border_color='#e0bd1f' where calendar_id=v_cal and key='yellow';
  update public.color_palette set name='연두', bg_color='#a8d84e', text_color='#38501a', border_color='#8bbf30' where calendar_id=v_cal and key='lime';
  update public.color_palette set name='민트', bg_color='#54cf95', text_color='#0c4a32', border_color='#2fb87a' where calendar_id=v_cal and key='mint';
  update public.color_palette set name='청록', bg_color='#34bdb4', text_color='#06403c', border_color='#1aa39a' where calendar_id=v_cal and key='teal';
  update public.color_palette set name='하늘', bg_color='#5cc1f0', text_color='#08405a', border_color='#2ea6e0' where calendar_id=v_cal and key='sky';
  update public.color_palette set name='파랑', bg_color='#5f8bf2', text_color='#0f2f70', border_color='#386fe6' where calendar_id=v_cal and key='blue';
  update public.color_palette set name='남색', bg_color='#8a7fe0', text_color='#25215e', border_color='#6a5cd4' where calendar_id=v_cal and key='indigo';
  update public.color_palette set name='보라', bg_color='#c08ce8', text_color='#43176b', border_color='#a662da' where calendar_id=v_cal and key='lavender';
  update public.color_palette set name='분홍', bg_color='#f593c4', text_color='#6e1849', border_color='#ec6aa9' where calendar_id=v_cal and key='pink';
  update public.color_palette set name='갈색', bg_color='#c79a68', text_color='#4a2c10', border_color='#ad7c45' where calendar_id=v_cal and key='beige';
end $$;
