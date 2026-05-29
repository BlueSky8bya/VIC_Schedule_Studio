-- 꾸미기 화려함 P2: 데코 도형 스티커. 이모지/이미지/텍스트에 이어 새 종류 "shape".
-- shape_key가 있으면 도형 스티커. 색은 기존 text_color를 fill로 재사용(재채색). null=도형 아님.
alter table public.sticker_instances add column if not exists shape_key text;
