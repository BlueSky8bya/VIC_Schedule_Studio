-- Privacy audit 2026-09-21: close direct REST/RPC paths around app DTOs.
-- Apply before deploying public_schedule_events reader. No data deletion.
-- Rollback: revert app reader first; preserve restrictive grants/policies. Do not reopen leaks.
begin;

-- Passcode writes must go through server verification and its shared attempt limit.
revoke all on public.private_layer_settings from public,anon,authenticated;
grant select,insert,update,delete on public.private_layer_settings to service_role;

-- Administrative RPCs inherit PUBLIC EXECUTE unless explicitly revoked.
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname = any(array[
      'get_perf_stats','search_chat_top_terms','search_dictionary_draft','search_game_refresh',
      'search_graph_nightly','search_graph_rebuild','search_known_people','search_person_alias_seed',
      'search_person_typos_rebuild','search_related_seed_extra','search_related_seed','search_song_refresh',
      'search_synonyms_rebuild','search_synonyms_seed_extra','search_synonyms_seed',
      'search_term_graph_rebuild','search_trending_rebuild','vod_chapter_index_rebuild',
      'vod_timeline_chapter_index_trg','rls_auto_enable'
    ])
  loop
    execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
    execute format('grant execute on function %s to service_role',f.signature);
  end loop;
end $$;

-- Account identity is never a calendar display field (including direct REST).
revoke select on public.calendars from anon, authenticated;
grant select(id,slug,display_name,title,timezone,is_public,theme_id,created_at,updated_at,
  public_changed_at,public_memo,poster_theme,public_memo_align,public_memo_valign,public_memo_lines)
  on public.calendars to anon, authenticated;

drop policy if exists vod_archive_public_read on public.vod_archive;
create policy vod_archive_public_read on public.vod_archive for select to anon, authenticated
  using (auth_no=101);

-- Hide deleted and unrevealed source rows. Public countdowns come from the masked view below.
drop policy if exists "public can read public events" on public.events;
create policy "public can read public events" on public.events for select
  using (visibility_scope='public' and status<>'draft' and deleted_at is null
    and not (coalesce(teaser,false) and teaser_reveal_at is not null and teaser_reveal_at>now())
    and exists(select 1 from public.calendars c where c.id=calendar_id and c.is_public));

-- ALL policies are also SELECT policies: do not let an editor bypass private unlock.
drop policy if exists "owners can manage events" on public.events;
create policy "owners can manage events" on public.events for all
  using (public.is_calendar_admin(calendar_id)
    and (visibility_scope='public' or public.has_private_unlock(calendar_id))
    and (visibility_scope<>'owner_private' or public.is_calendar_owner(calendar_id)))
  with check (public.is_calendar_admin(calendar_id)
    and (visibility_scope='public' or public.has_private_unlock(calendar_id))
    and (visibility_scope<>'owner_private' or public.is_calendar_owner(calendar_id)));
drop policy if exists "owners can manage private meta" on public.event_private_meta;
create policy "owners can manage private meta" on public.event_private_meta for all
  using (exists(select 1 from public.events e where e.id=event_id
    and public.is_calendar_admin(e.calendar_id)
    and (e.visibility_scope='public' or public.has_private_unlock(e.calendar_id))
    and (e.visibility_scope<>'owner_private' or public.is_calendar_owner(e.calendar_id))))
  with check (exists(select 1 from public.events e where e.id=event_id
    and public.is_calendar_admin(e.calendar_id)
    and (e.visibility_scope='public' or public.has_private_unlock(e.calendar_id))
    and (e.visibility_scope<>'owner_private' or public.is_calendar_owner(e.calendar_id))));

-- Intentional owner-rights view: only the explicit public projection crosses RLS.
-- No raw row spread, identity, secret_cipher, private metadata or hidden teaser field.
create or replace view public.public_schedule_events with (security_barrier=true) as
select e.id,e.calendar_id,e.date_key,e.created_at,
  case when h.hidden then null else e.end_date_key end as end_date_key,
  case when h.hidden then null else e.link_next end as link_next,
  case when h.hidden then false else e.is_support end as is_support,
  case when h.hidden then null else e.support_kind end as support_kind,
  case when h.hidden then null else e.support_url end as support_url,
  case when h.hidden then null else e.start_time end as start_time,
  case when h.hidden then null else e.end_time end as end_time,
  case when h.hidden then true else e.is_all_day end as is_all_day,
  case when h.hidden then false else e.is_tentative end as is_tentative,
  case when h.hidden then '' else e.public_title end as public_title,
  case when h.hidden then null else e.public_description end as public_description,
  e.status,e.sort_order,
  case when h.hidden then 'stream'::public.event_category else e.category end as category,
  e.teaser,e.teaser_reveal_at,
  case when h.hidden then '[]'::jsonb else coalesce((select jsonb_agg(jsonb_build_object(
    'tag_id',t.tag_id,'is_primary',t.is_primary,'sort_order',t.sort_order) order by t.sort_order)
    from public.event_tags t where t.event_id=e.id),'[]'::jsonb) end as event_tags
from public.events e join public.calendars c on c.id=e.calendar_id and c.is_public
cross join lateral (select coalesce(e.teaser,false) and e.teaser_reveal_at is not null
  and e.teaser_reveal_at>now() as hidden) h
where e.visibility_scope='public' and e.status<>'draft' and e.deleted_at is null;
revoke all on public.public_schedule_events from public,anon,authenticated;
grant select on public.public_schedule_events to anon,authenticated,service_role;

-- Shared atomic reservation for unlock and passcode-change attempts. Reserve before
-- checking a password, including successful attempts: parallel guesses cannot race counts.
create or replace function public.reserve_private_unlock_attempt(p_user_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if p_user_id is null then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended('private-attempt:'||p_user_id::text,0));
  if (select count(*) from public.private_unlock_attempts
      where user_id=p_user_id and created_at>now()-interval '10 minutes')>=5 then
    return false;
  end if;
  insert into public.private_unlock_attempts(user_id,ok) values(p_user_id,false);
  return true;
end $$;
revoke all on function public.reserve_private_unlock_attempt(uuid) from public,anon,authenticated;
grant execute on function public.reserve_private_unlock_attempt(uuid) to service_role;
create or replace function public.vod_chat_profile(p_title_no bigint)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select bin, msgs, speakers, laugh, terms from public.vod_chat_bins where title_no = p_title_no and exists(select 1 from public.vod_archive v where v.title_no=p_title_no and v.auth_no=101)
  ),
  mx as (
    select greatest(1, max(msgs)) as m, greatest(1, max(speakers)) as s, greatest(1, max(laugh)) as l from b
  ),
  mine as (
    select case when sum(msgs) > 0 then sum(laugh)::numeric / sum(msgs) else 0 end as lpm, count(*) as n from b
  ),
  others as (
    select title_no, sum(laugh)::numeric / greatest(1, sum(msgs)) as lpm
    from public.vod_chat_bins where exists(select 1 from public.vod_archive v where v.title_no=vod_chat_bins.title_no and v.auth_no=101) group by title_no having count(*) >= 20 and sum(msgs) >= 200
  ),
  tier as (
    -- 비교 대상 방송이 8개는 있어야 '상위 25%'가 뜻을 가진다(백필 초기엔 등급 없음).
    select case
      when (select n from mine) >= 20 and (select count(*) from others) >= 8
       and (select lpm from mine) >= coalesce((select percentile_cont(0.75) within group (order by lpm) from others), 1e9) then 'high'
      else null end as t
  )
  select json_build_object(
    'binSec', 30,
    'laughTier', (select t from tier),
    'bins', coalesce((
      select json_agg(json_build_object(
        'i', b.bin,
        'h', round(b.msgs::numeric / mx.m, 2),
        'd', round(b.speakers::numeric / mx.s, 2),
        'l', round(b.laugh::numeric / mx.l, 2),
        't', b.terms
      ) order by b.bin)
      from b, mx
    ), '[]'::json)
  );
$$;
grant execute on function public.vod_chat_profile(bigint) to anon, authenticated, service_role;
commit;
