-- events에 분류(category) 컬럼 추가. 스튜디오 편집기의 "분류" 선택과 매핑된다.
-- 값: stream(방송) | collab(합방) | notice(공지) | support(업도움) | dayoff(휴뱅)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_category') then
    create type public.event_category as enum ('stream', 'collab', 'notice', 'support', 'dayoff');
  end if;
end $$;

alter table public.events
  add column if not exists category public.event_category not null default 'stream';

-- 시드된 휴뱅 일정의 분류 보정
update public.events
set category = 'dayoff'
where public_title = '휴뱅'
  and calendar_id = (select id from public.calendars where slug = 'vic');
