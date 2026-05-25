-- #3: 0011(너무 연함) 대비 전반적으로 한 단계 톤업(채도↑·명도 살짝↓). 글자는 여전히 어두운 톤.
-- key 유지(태그 연결 보존), 색만 변경. (휴뱅=회색 고정)
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  update public.color_palette set bg_color='#cbd0d8', text_color='#2b2f38', border_color='#a2a8b3' where calendar_id=v_cal and key='gray';
  update public.color_palette set bg_color='#ffb0a6', text_color='#8a2018', border_color='#ee8074' where calendar_id=v_cal and key='red';
  update public.color_palette set bg_color='#ffce8f', text_color='#7a4400', border_color='#f0aa5a' where calendar_id=v_cal and key='orange';
  update public.color_palette set bg_color='#ffe87a', text_color='#6b5300', border_color='#e8c63f' where calendar_id=v_cal and key='yellow';
  update public.color_palette set bg_color='#b6e394', text_color='#2f5e1a', border_color='#8ec969' where calendar_id=v_cal and key='lime';
  update public.color_palette set bg_color='#a6ead0', text_color='#0c4a32', border_color='#6fcea4' where calendar_id=v_cal and key='mint';
  update public.color_palette set bg_color='#93dcd4', text_color='#0a4f4a', border_color='#5bc3b9' where calendar_id=v_cal and key='teal';
  update public.color_palette set bg_color='#a8dcf3', text_color='#08405a', border_color='#6cbde4' where calendar_id=v_cal and key='sky';
  update public.color_palette set bg_color='#a8c4f2', text_color='#1b3a78', border_color='#7099e2' where calendar_id=v_cal and key='blue';
  update public.color_palette set bg_color='#bcb4f2', text_color='#2f2682', border_color='#9184e2' where calendar_id=v_cal and key='indigo';
  update public.color_palette set bg_color='#d6c0f1', text_color='#43176b', border_color='#b596e0' where calendar_id=v_cal and key='lavender';
  update public.color_palette set bg_color='#ffb3d4', text_color='#8a1f5c', border_color='#f585b8' where calendar_id=v_cal and key='pink';
  update public.color_palette set bg_color='#ddc29a', text_color='#5a3d1a', border_color='#c5a373' where calendar_id=v_cal and key='beige';
end $$;
