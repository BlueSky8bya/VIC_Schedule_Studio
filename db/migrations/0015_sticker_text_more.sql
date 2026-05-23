-- 텍스트 스티커 추가 꾸미기: 글자 배경(하이라이트) 색 + 기울임.
alter table public.sticker_instances
  add column if not exists text_bg text,
  add column if not exists italic boolean not null default false;
