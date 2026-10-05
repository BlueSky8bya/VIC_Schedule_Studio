-- 0140: 떡밥 '기대돼요' → 공개 뒤 하트로 이어진다(비로그인 기기만, 2026-10-05 소유자).
--
-- 기대(teaser_hope)와 비로그인 하트(event_hearts_anon)는 같은 기기 토큰(vic:anonId)을 쓴다. 공개가
-- 지나면 그 기기의 기대를 하트로 한 번 복사한다 → 공개 카드에서 내 하트가 이미 켜져 있고, 하트 수·
-- 관심 단계에도 들어간다. 다시 누르면 꺼진다(같은 행이라 2번 세지지 않는다).
-- 로그인 시청자는 제외 — 하트가 계정 기준이라 기기 토큰과 짝이 안 맞는다(켜져 보이지 않고 2번 셀 수 있음).
--
-- anon: 누른 순간의 로그인 여부(auth.uid() is null). null = 이 마이그레이션 이전 기록(모름) →
--   그 기기가 비로그인 하트를 한 번이라도 누른 적 있을 때만 비로그인으로 본다(보수적 추정).
-- settled_at: 공개 뒤 처리 완료 표시(옮겼든 안 옮겼든) — 사용자가 하트를 끈 뒤 다시 살아나지 않게.
-- 처리는 settle_teaser_hopes(): 공개 순간 서버 액션(revealTeaserAction)이 즉시 부르고, 떡밥 수동 해제·
--   아무도 안 보던 공개는 pg_cron(5분, SQL만 — HTTP 없음)이 줍는다. 멱등.
-- 되돌리기: select cron.unschedule('vic-teaser-hope-settle'); (옮겨진 하트는 일반 하트로 남는다)
-- 적용: node scripts/apply-db.mjs db/migrations/0140_teaser_hope_to_anon_hearts.sql

alter table public.teaser_hope add column if not exists anon boolean;
alter table public.teaser_hope add column if not exists settled_at timestamptz;

create index if not exists teaser_hope_unsettled_idx
  on public.teaser_hope (event_id) where settled_at is null;

-- 0060과 같고, 넣을 때 로그인 여부(anon)를 남기는 것만 다르다. security definer라도 auth.uid()는
-- 요청 JWT를 읽는다(서버 액션은 사용자 쿠키 클라이언트로 부른다).
create or replace function public.toggle_teaser_hope(p_event_id uuid, p_token text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count bigint;
begin
  if p_token is null or length(p_token) < 8 then
    raise exception 'invalid token';
  end if;
  if not exists (
    select 1 from public.events e
    where e.id = p_event_id
      and e.is_public
      and e.teaser
      and e.teaser_reveal_at is not null
      and e.teaser_reveal_at > now()
  ) then
    raise exception 'event is not an active teaser';
  end if;

  if exists (
    select 1 from public.teaser_hope t
    where t.event_id = p_event_id and t.device_token = p_token
  ) then
    delete from public.teaser_hope t
    where t.event_id = p_event_id and t.device_token = p_token;
  else
    insert into public.teaser_hope (event_id, device_token, anon)
    values (p_event_id, p_token, auth.uid() is null)
    on conflict do nothing;
  end if;

  select count(*) from public.teaser_hope t where t.event_id = p_event_id into new_count;
  return new_count;
end;
$$;

grant execute on function public.toggle_teaser_hope(uuid, text) to anon, authenticated, service_role;

-- 공개된(떡밥 해제 또는 공개 시각 경과) 공개 일정의 미처리 기대를 처리한다. p_event_ids가 null이면 전부.
-- 돌려주는 값 = 새로 생긴 하트 수(0이면 캐시 무효화 생략용).
create or replace function public.settle_teaser_hopes(p_event_ids uuid[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with due as (
    select t.event_id, t.device_token, t.anon
    from public.teaser_hope t
    join public.events e on e.id = t.event_id
    where t.settled_at is null
      and e.is_public
      and (not e.teaser or (e.teaser_reveal_at is not null and e.teaser_reveal_at <= now()))
      and (p_event_ids is null or t.event_id = any (p_event_ids))
    for update of t skip locked
  ),
  ins as (
    insert into public.event_hearts_anon (event_id, device_token)
    select d.event_id, d.device_token
    from due d
    where d.anon
       or (d.anon is null and exists (
             select 1 from public.event_hearts_anon a where a.device_token = d.device_token))
    on conflict do nothing
    returning 1
  ),
  upd as (
    update public.teaser_hope t
    set settled_at = now()
    from due d
    where t.event_id = d.event_id and t.device_token = d.device_token
    returning 1
  )
  select count(*)::integer from ins into n;
  return n;
end;
$$;

revoke all on function public.settle_teaser_hopes(uuid[]) from public, anon, authenticated;
grant execute on function public.settle_teaser_hopes(uuid[]) to service_role;

-- 바닥 그물: 5분마다(SQL만, 미처리 행이 없으면 부분 인덱스로 즉시 끝난다).
select cron.unschedule('vic-teaser-hope-settle')
where exists (select 1 from cron.job where jobname = 'vic-teaser-hope-settle');
select cron.schedule('vic-teaser-hope-settle', '*/5 * * * *', $job$select public.settle_teaser_hopes()$job$);

-- 이미 공개된 떡밥의 기대를 지금 한 번 처리(소급).
select public.settle_teaser_hopes();

notify pgrst, 'reload schema';
