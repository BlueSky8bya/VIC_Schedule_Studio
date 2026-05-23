-- #7: 텍스트 스티커 전용 꾸미기 — 글꼴 굵기/글꼴 종류. (들여쓰기 등은 추후 확장)
alter table public.sticker_instances
  add column if not exists font_weight int,
  add column if not exists font_family text;
