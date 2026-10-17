-- Cache the caller's stable auth.uid() once per statement, not once per heart.
-- Same SELECT policy/roles/own-user predicate; no grants, rows or write RPCs change.
-- Apply after the original event_hearts policy. Safe with old/new application code.
-- Rollback: alter policy event_hearts_read_own on public.event_hearts
--           using (user_id = auth.uid());
-- Ref: Supabase RLS performance guidance, "Call functions with select".
begin;
-- Keep the inspected policy fixed until ALTER; normal SELECT/INSERT/UPDATE remain compatible.
lock table public.event_hearts in row exclusive mode;
do $$
declare
  p record;
  predicate text;
begin
  select polcmd, polpermissive, polroles, polwithcheck,
         pg_get_expr(polqual, polrelid) as expression
    into p from pg_policy
    where polrelid = 'public.event_hearts'::regclass
      and polname = 'event_hearts_read_own';
  if not found then
    raise exception 'Expected event_hearts SELECT policy is missing';
  end if;
  predicate := regexp_replace(p.expression, '[[:space:]()]', '', 'g');
  if p.polcmd <> 'r' or not p.polpermissive
     or p.polroles <> array[0::oid] or p.polwithcheck is not null
     or predicate is null
     or predicate not in ('user_id=auth.uid', 'user_id=SELECTauth.uidASuid') then
    raise exception 'Unexpected event_hearts SELECT policy; review before changing';
  end if;
end;
$$;

alter policy event_hearts_read_own on public.event_hearts
  using (user_id = (select auth.uid()));
commit;
