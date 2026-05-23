-- #4: 텍스트 스티커 정렬(좌/중앙/우). 들여쓰기와 함께 쓰임.
alter table public.sticker_instances
  add column if not exists text_align text;
