-- 꾸미기 화려함 P1b: 텍스트 스티커 특수 효과(그라데이션 글자 / 네온 글로우). null=기본.
alter table public.sticker_instances add column if not exists text_fx text;
