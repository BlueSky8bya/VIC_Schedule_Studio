-- 멀티데이 일정: 종료일(없으면 단일 날짜). end_date_key가 date_key보다 크면 여러 날에 걸친다.
alter table public.events
  add column if not exists end_date_key date;
