-- 꾸미기 화려함 P1: 움직이는 스티커. 스티커마다 선택적 애니메이션 프리셋(둥실·반짝·흔들·빙글·콩닥).
-- 공개 포스터는 살아있는 웹페이지라 시청자에게 실제로 움직여 보인다(몰입↑).
-- (내보내기 PNG는 정지 프레임 — 캡쳐는 거의 안 쓰기로 함.) null이면 정지(기존과 동일).
alter table public.sticker_instances add column if not exists anim text;
