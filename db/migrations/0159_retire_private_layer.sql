-- 0159: 비공개 일정 레이어 철수(2026-11-13 개발자 결정). 운영 데이터 확인: 비공개 범위 일정 0,
-- secret_cipher 0, event_private_meta 0, private_unlock_grants 0. 남는 것은 최초공개 게이트 비밀번호뿐
-- (private_layer_settings.passcode_*, private_unlock_attempts + reserve_private_unlock_attempt, 앱의
-- PRIVATE_LAYER_UNLOCK_SECRET) — 이 마이그레이션은 그것들을 건드리지 않는다.
--
-- 순서: 앱 코드(공개 행만 읽고, secret_cipher·event_private_meta를 고르지 않고, p_meta=null만 보냄)를 먼저
-- 배포·확인한 뒤 적용한다. save_event_atomic·replace_event_tags_atomic은 같은 시그니처로 재정의하므로
-- 코드와 동시 배포가 필요 없다.
--
-- ⚠ 되돌릴 수 없는 삭제: event_private_meta·private_unlock_grants·support_campaigns 테이블,
-- events.secret_cipher·private_layer_settings.unlock_duration_minutes 열. 되돌리기는 0001·0045·0057·0067·0125·
-- 0144·0153을 다시 적용해 구조만 복원하는 것(데이터는 복원 불가 — 적용 시점에 0행이었다).
-- 멱등. 의존 객체가 남아 있으면 조용히 지우지 않도록 cascade를 쓰지 않는다(정책이 남았다면 실패로 알린다).
-- 적용: SUPABASE_DB_CA_PATH=.scratch-pw/supabase-ca.crt node scripts/apply-db.mjs db/migrations/0159_retire_private_layer.sql

begin;

-- 1) events 정책: 편집자는 공개 범위만 다룬다. (ALL 정책은 SELECT에도 걸린다.)
drop policy if exists "owners can manage events" on public.events;
create policy "owners can manage events" on public.events for all
  using (public.is_calendar_admin(calendar_id) and visibility_scope = 'public')
  with check (public.is_calendar_admin(calendar_id) and visibility_scope = 'public');
drop policy if exists "owners can read owner private events" on public.events;
drop policy if exists "workers can read work events" on public.events;
drop policy if exists "trusted unlocked users can read private events" on public.events;

-- 2) event_tags 읽기: 공개(비-draft) 일정 또는 관리자.
drop policy if exists "read event tags for visible events" on public.event_tags;
create policy "read event tags for visible events" on public.event_tags for select
  using (exists (
    select 1 from public.events e
    where e.id = event_tags.event_id
      and ((e.visibility_scope = 'public' and e.status <> 'draft') or public.is_calendar_admin(e.calendar_id))
  ));

-- 3) 태그 교체(0153 본문 그대로, 범위 검사만 공개 전용으로).
create or replace function public.replace_event_tags_atomic(
  p_event_id uuid, p_calendar_id uuid, p_tags jsonb
) returns uuid
language plpgsql security invoker set search_path = public
as $$
declare v_scope text;
begin
  select visibility_scope::text into v_scope from public.events
    where id=p_event_id and calendar_id=p_calendar_id and deleted_at is null for update;
  if not found or not coalesce(public.is_calendar_admin(p_calendar_id),false) then
    raise exception 'event not found or not writable' using errcode='42501';
  end if;
  if v_scope <> 'public' then
    raise exception 'event not found or not writable' using errcode='42501';
  end if;
  if p_tags is null or jsonb_typeof(p_tags)<>'array' then raise exception 'invalid tags'; end if;
  if jsonb_array_length(p_tags)>6 then raise exception 'too many tags'; end if;
  if exists(select 1 from jsonb_array_elements(p_tags) t group by t->>'tag_id' having count(*)>1)
    or (select count(*) from jsonb_array_elements(p_tags) t where coalesce((t->>'is_primary')::boolean,false))>2 then
    raise exception 'invalid tag assignment';
  end if;
  if exists(select 1 from jsonb_array_elements(p_tags) t
    where not exists(select 1 from public.broadcast_tags g where g.id=(t->>'tag_id')::uuid
      and g.calendar_id=p_calendar_id and g.is_active)) then raise exception 'invalid tag'; end if;
  delete from public.event_tags where event_id=p_event_id;
  insert into public.event_tags(event_id,tag_id,is_primary,sort_order)
    select p_event_id,(t->>'tag_id')::uuid,coalesce((t->>'is_primary')::boolean,false),ordinality-1
    from jsonb_array_elements(p_tags) with ordinality as rows(t,ordinality);
  return p_event_id;
end;
$$;
revoke all on function public.replace_event_tags_atomic(uuid,uuid,jsonb) from public,anon;
grant execute on function public.replace_event_tags_atomic(uuid,uuid,jsonb) to authenticated;

-- 4) 일정 저장(0144 본문에서 secret_cipher·평문 메타 블록만 뺀다). p_meta는 4인자 시그니처 호환용으로
--    받기만 하고 쓰지 않는다 — 배포된 앱은 늘 null을 보낸다.
create or replace function public.save_event_atomic(
  p_event_id uuid,
  p_row jsonb,
  p_tags jsonb,
  p_meta jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := p_event_id;
begin
  if v_id is null then
    insert into public.events (
      calendar_id, date_key, end_date_key, start_time, end_time,
      is_all_day, is_tentative, is_support, support_kind, support_url,
      public_title, public_description,
      visibility_scope, status, category, teaser, teaser_reveal_at, sort_order, updated_at
    ) values (
      (p_row->>'calendar_id')::uuid,
      (p_row->>'date_key')::date,
      (p_row->>'end_date_key')::date,
      (p_row->>'start_time')::time,
      (p_row->>'end_time')::time,
      coalesce((p_row->>'is_all_day')::boolean, false),
      coalesce((p_row->>'is_tentative')::boolean, false),
      coalesce((p_row->>'is_support')::boolean, false),
      coalesce(p_row->>'support_kind', 'up'),
      p_row->>'support_url',
      p_row->>'public_title',
      p_row->>'public_description',
      (p_row->>'visibility_scope')::public.visibility_scope,
      (p_row->>'status')::public.event_status,
      (p_row->>'category')::public.event_category,
      coalesce((p_row->>'teaser')::boolean, false),
      (p_row->>'teaser_reveal_at')::timestamptz,
      -- 새 일정은 그 날 맨 아래(지금 가장 큰 순서 + 1)
      (select coalesce(max(e.sort_order) + 1, 0) from public.events e
        where e.calendar_id = (p_row->>'calendar_id')::uuid and e.date_key = (p_row->>'date_key')::date),
      now()
    ) returning id into v_id;
  else
    update public.events set
      date_key = (p_row->>'date_key')::date,
      end_date_key = (p_row->>'end_date_key')::date,
      start_time = (p_row->>'start_time')::time,
      end_time = (p_row->>'end_time')::time,
      is_all_day = coalesce((p_row->>'is_all_day')::boolean, false),
      is_tentative = coalesce((p_row->>'is_tentative')::boolean, false),
      is_support = coalesce((p_row->>'is_support')::boolean, false),
      support_kind = coalesce(p_row->>'support_kind', 'up'),
      support_url = p_row->>'support_url',
      public_title = p_row->>'public_title',
      public_description = p_row->>'public_description',
      visibility_scope = (p_row->>'visibility_scope')::public.visibility_scope,
      status = (p_row->>'status')::public.event_status,
      category = (p_row->>'category')::public.event_category,
      teaser = coalesce((p_row->>'teaser')::boolean, false),
      teaser_reveal_at = (p_row->>'teaser_reveal_at')::timestamptz,
      updated_at = now()
    where id = v_id;
    if not found then
      raise exception 'event % not found or not writable', v_id;
    end if;
  end if;

  -- 태그 전체 재설정(빈 배열이면 0개 = 흰 카드).
  delete from public.event_tags where event_id = v_id;
  if p_tags is not null and jsonb_array_length(p_tags) > 0 then
    insert into public.event_tags (event_id, tag_id, is_primary, sort_order)
    select v_id,
           (t->>'tag_id')::uuid,
           coalesce((t->>'is_primary')::boolean, false),
           coalesce((t->>'sort_order')::int, 0)
    from jsonb_array_elements(p_tags) as t;
  end if;

  return v_id;
end;
$$;

-- 5) 쓰이지 않는 테이블·열·함수. (테이블을 지우면 그 테이블의 정책·인덱스·grant도 함께 사라진다.)
drop table if exists public.event_private_meta;
drop table if exists public.private_unlock_grants;
drop table if exists public.support_campaigns;
alter table public.events drop column if exists secret_cipher;
alter table public.private_layer_settings drop column if exists unlock_duration_minutes;
drop function if exists public.has_private_unlock(uuid);
drop function if exists public.is_active_worker(uuid);

commit;

notify pgrst, 'reload schema';
