-- Additive, caller-scoped tag replacement. Apply before deploying its reader.
-- No existing rows/table grants/roles change. Legacy embargo gets the same
-- owner-only private policy already required for owner_private.
-- Rollback only to a reviewed compatible app preserving scope guards and
-- authenticated writes; never restore the known service-role-write bypass.
-- Keep this safe RPC, or fail tag writes closed, while any reader still calls
-- it. Revoke authenticated EXECUTE only after no callers remain. Keep the
-- owner-only policies; no existing data backfill or restoration is needed.
begin;
alter policy "owners can manage events" on public.events
  using (public.is_calendar_admin(calendar_id)
    and (visibility_scope='public' or public.has_private_unlock(calendar_id))
    and (visibility_scope not in ('owner_private','embargo') or public.is_calendar_owner(calendar_id)))
  with check (public.is_calendar_admin(calendar_id)
    and (visibility_scope='public' or public.has_private_unlock(calendar_id))
    and (visibility_scope not in ('owner_private','embargo') or public.is_calendar_owner(calendar_id)));
alter policy "owners can manage private meta" on public.event_private_meta
  using (exists(select 1 from public.events e where e.id=event_id
    and public.is_calendar_admin(e.calendar_id)
    and (e.visibility_scope='public' or public.has_private_unlock(e.calendar_id))
    and (e.visibility_scope not in ('owner_private','embargo') or public.is_calendar_owner(e.calendar_id))))
  with check (exists(select 1 from public.events e where e.id=event_id
    and public.is_calendar_admin(e.calendar_id)
    and (e.visibility_scope='public' or public.has_private_unlock(e.calendar_id))
    and (e.visibility_scope not in ('owner_private','embargo') or public.is_calendar_owner(e.calendar_id))));
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
  if v_scope not in ('public','work','owner_private','embargo')
    or (v_scope<>'public' and not coalesce(public.has_private_unlock(p_calendar_id),false))
    or (v_scope in ('owner_private','embargo') and not coalesce(public.is_calendar_owner(p_calendar_id),false)) then
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
commit;
