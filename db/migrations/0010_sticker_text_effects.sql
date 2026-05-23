-- C6 텍스트 스티커 + C7 스티커 스타일 효과.
-- text_content가 있으면 텍스트 스티커(이모지/이미지가 아님). text_color는 글자색.
-- outline(흰 외곽선 = 다이컷 스티커 느낌) / shadow(진한 그림자)는 모든 스티커에 적용 가능한 토글.
alter table public.sticker_instances
  add column if not exists text_content text,
  add column if not exists text_color text,
  add column if not exists outline boolean not null default false,
  add column if not exists shadow boolean not null default false;
