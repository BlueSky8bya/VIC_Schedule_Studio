-- #6: 팔레트 전체를 "연한 톤"으로 재조정.
-- 글자가 색 위에 덮여 쓰이므로, 진한 배경(흰 글씨)보다 연한 배경 + 어두운 글씨가 가독성이 좋다.
-- key는 유지(태그 color_key 연결 보존), 색/이름만 변경. (휴뱅=회색 고정)
-- 한류(파랑~초록) 계열이 연해지면 서로 비슷해지므로, 일부는 globals.css의 무늬(대각선/점)로 추가 구분한다.
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  update public.color_palette set name='회색', bg_color='#d8dce2', text_color='#2b2f38', border_color='#aeb4be' where calendar_id=v_cal and key='gray';
  update public.color_palette set name='빨강', bg_color='#ffc4bd', text_color='#8a2018', border_color='#f29086' where calendar_id=v_cal and key='red';
  update public.color_palette set name='주황', bg_color='#ffdcae', text_color='#7a4400', border_color='#f2b673' where calendar_id=v_cal and key='orange';
  update public.color_palette set name='노랑', bg_color='#fff2a8', text_color='#6b5300', border_color='#ecd255' where calendar_id=v_cal and key='yellow';
  update public.color_palette set name='초록', bg_color='#c9ecb4', text_color='#2f5e1a', border_color='#9bd17d' where calendar_id=v_cal and key='lime';
  update public.color_palette set name='민트', bg_color='#bdf0d8', text_color='#0c4a32', border_color='#84d8b2' where calendar_id=v_cal and key='mint';
  update public.color_palette set name='청록', bg_color='#aee5df', text_color='#0a4f4a', border_color='#71c9c1' where calendar_id=v_cal and key='teal';
  update public.color_palette set name='하늘', bg_color='#c2e7f8', text_color='#08405a', border_color='#82c8e8' where calendar_id=v_cal and key='sky';
  update public.color_palette set name='파랑', bg_color='#c2d6f7', text_color='#1b3a78', border_color='#88abe8' where calendar_id=v_cal and key='blue';
  update public.color_palette set name='남색', bg_color='#d0cbf6', text_color='#2f2682', border_color='#a298e8' where calendar_id=v_cal and key='indigo';
  update public.color_palette set name='보라', bg_color='#e4d4f6', text_color='#43176b', border_color='#c6abe8' where calendar_id=v_cal and key='lavender';
  update public.color_palette set name='분홍', bg_color='#ffccE3', text_color='#8a1f5c', border_color='#f598c2' where calendar_id=v_cal and key='pink';
  update public.color_palette set name='갈색', bg_color='#e9d6bb', text_color='#5a3d1a', border_color='#d0b48f' where calendar_id=v_cal and key='beige';
end $$;
