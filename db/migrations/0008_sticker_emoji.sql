-- 꾸미기 모드: 이모지 스티커. asset(이미지 업로드) 대신 emoji 텍스트로도 스티커를 만든다.
-- 스티커는 달(월)마다 따로 적용되므로 기존 year/month 컬럼으로 범위를 구분한다.
-- asset_id는 이미 nullable이라 emoji-only 스티커는 asset 없이 저장된다.
alter table public.sticker_instances
  add column if not exists emoji text;
