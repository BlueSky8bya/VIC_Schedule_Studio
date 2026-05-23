-- 꾸미기 스티커 좌우/상하 대칭(flip). 회전과 별개로 미러링을 저장한다.
alter table public.sticker_instances
  add column if not exists flip_x boolean not null default false,
  add column if not exists flip_y boolean not null default false;
