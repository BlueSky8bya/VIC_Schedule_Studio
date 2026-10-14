-- Additive read RPC. Apply before enabling production premiere state.
-- The existing masked view owns redaction. No new raw-event or identity grants.
-- KST date_key is unchanged; release timestamps remain timestamptz/DB now().
-- Rollback: disable the stage/roll back its reader first. Keep this additive RPC
-- while any deployed reader needs it; no schedule rows are rewritten.
begin;
create or replace function public.get_public_teaser_state(p_slug text, p_event_id uuid default null)
returns jsonb language sql stable security invoker set search_path = public as $$
  with clock as (select now() as sampled), rows as (
    select v.*, (coalesce(v.teaser,false) and v.teaser_reveal_at is not null and v.teaser_reveal_at > clock.sampled) as hidden
    from public.public_schedule_events v
    join public.calendars c on c.id=v.calendar_id and c.is_public and c.slug=p_slug
    cross join clock
    where (p_event_id is not null and v.id=p_event_id)
       or (p_event_id is null and v.teaser and (v.teaser_reveal_at > clock.sampled - interval '24 hours'))
  )
  select jsonb_build_object('sampledAtDbMs', floor(extract(epoch from clock.sampled)*1000),
    'rows', coalesce((select jsonb_agg(jsonb_build_object('id', rows.id, 'date_key', rows.date_key, 'end_date_key', rows.end_date_key, 'link_next', rows.link_next, 'is_support', rows.is_support, 'support_kind', rows.support_kind, 'support_url', rows.support_url, 'start_time', rows.start_time, 'end_time', rows.end_time, 'is_all_day', rows.is_all_day, 'is_tentative', rows.is_tentative, 'public_title', rows.public_title, 'public_description', rows.public_description, 'status', rows.status, 'sort_order', rows.sort_order, 'category', rows.category, 'teaser', rows.teaser, 'teaser_reveal_at', rows.teaser_reveal_at, 'event_tags', rows.event_tags, 'hidden', rows.hidden) order by rows.teaser_reveal_at, rows.id) from rows), '[]'::jsonb))
  from clock where exists(select 1 from public.calendars where slug=p_slug and is_public);
$$;
revoke all on function public.get_public_teaser_state(text,uuid) from public;
grant execute on function public.get_public_teaser_state(text,uuid) to anon,authenticated,service_role;
commit;
