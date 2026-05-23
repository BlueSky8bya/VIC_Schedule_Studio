-- 팔레트 10색을 서로 확실히 구분되는 색으로 재구성. (기존 비슷한 파스텔 → 상이한 색상)
-- key는 그대로 두고 name/색만 변경(태그의 color_key 연결 유지).
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  update public.color_palette set name='회색', bg_color='#c2c7d0', text_color='#1f2937', border_color='#8b91a0' where calendar_id=v_cal and key='gray';
  update public.color_palette set name='보라', bg_color='#c9a7f0', text_color='#3b1a66', border_color='#a577e0' where calendar_id=v_cal and key='lavender';
  update public.color_palette set name='파랑', bg_color='#8fbaf5', text_color='#0f2f63', border_color='#5b94e8' where calendar_id=v_cal and key='blue';
  update public.color_palette set name='분홍', bg_color='#f7a8cf', text_color='#6e1244', border_color='#ec7db0' where calendar_id=v_cal and key='pink';
  update public.color_palette set name='청록', bg_color='#74d6c4', text_color='#0c4439', border_color='#3fbfa8' where calendar_id=v_cal and key='mint';
  update public.color_palette set name='노랑', bg_color='#ffe066', text_color='#6b5200', border_color='#f0c419' where calendar_id=v_cal and key='yellow';
  update public.color_palette set name='주황', bg_color='#ffb066', text_color='#6e3500', border_color='#f59331' where calendar_id=v_cal and key='orange';
  update public.color_palette set name='갈색', bg_color='#d2a679', text_color='#4d2e12', border_color='#b9854f' where calendar_id=v_cal and key='beige';
  update public.color_palette set name='하늘', bg_color='#6fd0f5', text_color='#0a3f57', border_color='#34b3e0' where calendar_id=v_cal and key='sky';
  update public.color_palette set name='연두', bg_color='#a8e063', text_color='#2f5212', border_color='#7fc23a' where calendar_id=v_cal and key='lime';
end $$;
