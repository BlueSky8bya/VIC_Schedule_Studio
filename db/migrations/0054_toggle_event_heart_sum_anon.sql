-- 로그인 하트 토글(toggle_event_heart)이 돌려주는 집계 수에 익명(기기 토큰) 하트를 합산한다.
-- 0040에서 익명 하트를 도입하며 toggle_event_heart_anon과 get_event_heart_counts는 두 표를
-- 합산하도록 고쳤지만, 로그인 경로인 이 함수만 event_hearts 단독 count로 남아 있었다.
-- 그 결과: 로그인 시청자가 하트를 누르면 서버가 '계정 하트만 센 작은 수'를 돌려주고,
-- 클라이언트가 그 값을 권위값으로 화면에 덮어써 배지(🔥, 5개 이상)가 사라졌다.
-- 새로고침하면 get_event_heart_counts(합산)로 다시 그려져 배지가 돌아오던 증상의 원인.
create or replace function public.toggle_event_heart(p_event_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_count bigint;
begin
  if uid is null then
    raise exception 'authentication required';
  end if;

  -- 공개 일정에만 하트를 허용한다(비공개/엠바고/작업 일정 보호).
  if not exists (
    select 1 from public.events e where e.id = p_event_id and e.is_public
  ) then
    raise exception 'event is not public';
  end if;

  if exists (
    select 1 from public.event_hearts h where h.event_id = p_event_id and h.user_id = uid
  ) then
    delete from public.event_hearts h where h.event_id = p_event_id and h.user_id = uid;
  else
    insert into public.event_hearts (event_id, user_id)
    values (p_event_id, uid)
    on conflict do nothing;
  end if;

  -- 계정 하트 + 익명 하트 합산 — get_event_heart_counts / toggle_event_heart_anon과 같은 정의.
  select (select count(*) from public.event_hearts h where h.event_id = p_event_id)
       + (select count(*) from public.event_hearts_anon a where a.event_id = p_event_id)
    into new_count;
  return new_count;
end;
$$;

grant execute on function public.toggle_event_heart(uuid) to authenticated;
