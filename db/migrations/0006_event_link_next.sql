-- 이음새(인접 쌍)별 연결: link_next는 "이 일정의 다음날 일정"을 가리킨다.
-- 그룹(set) 방식 대신 쌍(pair) 방식이라 각 이음새를 개별로 잇고 끊을 수 있다.
alter table public.events
  add column if not exists link_next uuid references public.events(id) on delete set null;

-- 이전 그룹 방식 데이터 정리(이제 link_next만 사용)
update public.events set link_group_id = null where link_group_id is not null;
