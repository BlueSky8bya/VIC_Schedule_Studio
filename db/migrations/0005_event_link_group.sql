-- 일정 잇기: 같은 link_group_id를 가진 일정들은 달력에서 연속된 막대로 이어진다.
alter table public.events
  add column if not exists link_group_id uuid;
