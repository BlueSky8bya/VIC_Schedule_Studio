-- 13색 팔레트 v3: hue만이 아니라 명도(밝음↔어두움 교차)·채도까지 흔들어 구분.
-- v2(0009)는 hue만 퍼뜨려서 파랑/하늘/청록/민트/연두가 여전히 비슷했음.
-- 핵심: 한류(초록~파랑) 계열을 어두움/밝음으로 교차 배치하고, 어두운 칸은 흰 글씨를 쓴다.
--   연두=진초록(어두움) / 민트=연한민트(밝음) / 청록=진청록(어두움) / 하늘=연하늘(밝음)
--   파랑=진파랑(어두움) / 남색=진남색(어두움) / 보라=연보라(밝음)
-- 색만으로 부족한 한류 어두운 칸들은 앱 CSS에서 무늬(줄/점/격자)로 추가 구분한다.
-- key는 유지(태그 color_key 연결 보존), 색/이름만 변경. (휴뱅=회색 고정)
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  update public.color_palette set name='회색',   bg_color='#cdd2da', text_color='#2b2f38', border_color='#9aa0ab' where calendar_id=v_cal and key='gray';
  -- 빨강(CK): 업도움 배너(.support-bar, 연한 로즈핑크 #fda4af)와 안 헷갈리게 진한 빨강으로.
  update public.color_palette set name='빨강',   bg_color='#d11a2a', text_color='#ffffff', border_color='#a8121f' where calendar_id=v_cal and key='red';
  update public.color_palette set name='주황',   bg_color='#f5a623', text_color='#5a3300', border_color='#d6760c' where calendar_id=v_cal and key='orange';
  update public.color_palette set name='노랑',   bg_color='#ffe14d', text_color='#5f4a00', border_color='#e3bf17' where calendar_id=v_cal and key='yellow';
  update public.color_palette set name='초록',   bg_color='#4e9e2f', text_color='#ffffff', border_color='#3a7a1f' where calendar_id=v_cal and key='lime';
  update public.color_palette set name='민트',   bg_color='#9fe8c4', text_color='#0c4a32', border_color='#5cc497' where calendar_id=v_cal and key='mint';
  update public.color_palette set name='청록',   bg_color='#0e8a80', text_color='#ffffff', border_color='#0a625c' where calendar_id=v_cal and key='teal';
  update public.color_palette set name='하늘',   bg_color='#a9dbf5', text_color='#08405a', border_color='#5cb6e0' where calendar_id=v_cal and key='sky';
  update public.color_palette set name='파랑',   bg_color='#2f63d6', text_color='#ffffff', border_color='#1f49a8' where calendar_id=v_cal and key='blue';
  update public.color_palette set name='남색',   bg_color='#5a44c2', text_color='#ffffff', border_color='#4131a0' where calendar_id=v_cal and key='indigo';
  update public.color_palette set name='보라',   bg_color='#d8bdf2', text_color='#43176b', border_color='#b78fe0' where calendar_id=v_cal and key='lavender';
  update public.color_palette set name='분홍',   bg_color='#ee5aa3', text_color='#ffffff', border_color='#d63b89' where calendar_id=v_cal and key='pink';
  update public.color_palette set name='갈색',   bg_color='#a9794a', text_color='#ffffff', border_color='#885d33' where calendar_id=v_cal and key='beige';
end $$;
