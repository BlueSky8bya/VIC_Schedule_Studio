-- 꾸미기 P4: 스티커 잠금. 잠긴 스티커는 선택은 되지만(툴바에서 해제) 이동/크기/회전이 막힌다.
-- 꾸밈이 많아졌을 때 실수로 옮기는 걸 방지. null/false=잠금 아님.
alter table public.sticker_instances add column if not exists locked boolean not null default false;
