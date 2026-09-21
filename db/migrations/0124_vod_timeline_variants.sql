-- Multiple fan timelines, 2026-09-21. Public source comments only; candidate identity
-- and moderation are server-only. KST broadcast attribution remains in vod_archive.
-- Apply before deploying the new collector/readers. Roll back application first;
-- retain these additive tables/columns and the existing representative projection.
begin;

alter table public.vod_timeline add column if not exists variants jsonb not null default '[]';
drop policy if exists vod_timeline_public_read on public.vod_timeline;
create policy vod_timeline_public_read on public.vod_timeline for select to anon, authenticated
  using (exists(select 1 from public.vod_archive v where v.title_no=vod_timeline.title_no and v.auth_no=101));
drop policy if exists vod_chapter_index_public_read on public.vod_chapter_index;
create policy vod_chapter_index_public_read on public.vod_chapter_index for select to anon, authenticated
  using (exists(select 1 from public.vod_archive v where v.title_no=vod_chapter_index.title_no and v.auth_no=101));

create table if not exists public.vod_timeline_candidate (
  title_no bigint not null,
  candidate_key text not null,
  root_comment_no bigint not null,
  source_comment_nos jsonb not null default '[]',
  author_nick text not null default '',
  entries jsonb not null default '[]',
  eligible boolean not null default false,
  reason text not null default 'focused',
  score integer not null default 0,
  present boolean not null default true,
  visibility text not null default 'auto' check (visibility in ('auto','show','hide')),
  primary key (title_no, candidate_key)
);
create table if not exists public.vod_timeline_choice (
  title_no bigint primary key,
  pinned_key text
);
alter table public.vod_timeline_candidate enable row level security;
alter table public.vod_timeline_choice enable row level security;
revoke all on public.vod_timeline_candidate, public.vod_timeline_choice from anon, authenticated;
grant select, insert, update, delete on public.vod_timeline_candidate, public.vod_timeline_choice to service_role;

-- Keep old representatives during rollout until a complete source fetch replaces them.
insert into public.vod_timeline_candidate(title_no,candidate_key,root_comment_no,source_comment_nos,author_nick,entries,eligible,reason)
select title_no,'root:'||comment_no,comment_no,jsonb_build_array('root:'||comment_no),author_nick,entries,true,'overview'
from public.vod_timeline where comment_no is not null and entry_count > 0
on conflict do nothing;

create or replace function public.vod_timeline_project(p_title_no bigint)
returns void language plpgsql security definer set search_path = public as $$
declare chosen public.vod_timeline_candidate%rowtype; alternatives jsonb;
begin
  -- Caller holds the per-VOD advisory lock. Only visible, present variants reach anon.
  select c.* into chosen from public.vod_timeline_candidate c
  left join public.vod_timeline_choice s on s.title_no=c.title_no
  where c.title_no=p_title_no and c.present and c.visibility <> 'hide'
    and (c.eligible or c.visibility='show')
  order by (c.candidate_key = coalesce(s.pinned_key,'')) desc, c.eligible desc, c.score desc, c.candidate_key asc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.candidate_key,'authorNick',c.author_nick,'entries',c.entries)
      order by (c.candidate_key=chosen.candidate_key) desc,c.score desc,c.candidate_key asc),'[]'::jsonb)
    into alternatives from public.vod_timeline_candidate c
    where c.title_no=p_title_no and c.present and c.visibility <> 'hide'
      and (c.eligible or c.visibility='show');
  insert into public.vod_timeline(title_no,author_nick,comment_no,entry_count,entries,variants)
  values(p_title_no,coalesce(chosen.author_nick,''),chosen.root_comment_no,
    jsonb_array_length(coalesce(chosen.entries,'[]')),coalesce(chosen.entries,'[]'),alternatives)
  on conflict(title_no) do update set author_nick=excluded.author_nick,comment_no=excluded.comment_no,
    entry_count=excluded.entry_count,entries=excluded.entries,variants=excluded.variants;
  -- Existing entries trigger indexes only the representative, not every variant.
end $$;

create or replace function public.vod_timeline_ingest(p_title_no bigint, p_candidates jsonb, p_started_at timestamptz)
returns boolean language plpgsql security definer set search_path = public as $$
declare c jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('vod-timeline:'||p_title_no,0));
  -- A slower earlier fetch must not overwrite a newer completed snapshot.
  if exists(select 1 from public.vod_timeline where title_no=p_title_no and synced_at > p_started_at) then return false; end if;
  if jsonb_typeof(p_candidates) <> 'array' then raise exception 'Invalid candidates'; end if;
  update public.vod_timeline_candidate set present=false where title_no=p_title_no;
  for c in select value from jsonb_array_elements(p_candidates) loop
    insert into public.vod_timeline_candidate(title_no,candidate_key,root_comment_no,source_comment_nos,author_nick,entries,eligible,reason,score,present)
    values(p_title_no,c->>'key',(c->>'rootCommentNo')::bigint,c->'sourceCommentNos',c->>'authorNick',c->'entries',
      (c->>'eligible')::boolean,c->>'reason',(c->>'score')::integer,true)
    on conflict(title_no,candidate_key) do update set root_comment_no=excluded.root_comment_no,
      source_comment_nos=excluded.source_comment_nos,author_nick=excluded.author_nick,entries=excluded.entries,
      eligible=excluded.eligible,reason=excluded.reason,score=excluded.score,present=true;
    -- visibility and pinned_key are deliberately never overwritten by collection.
  end loop;
  perform public.vod_timeline_project(p_title_no);
  update public.vod_timeline set synced_at=p_started_at where title_no=p_title_no;
  return true;
end $$;

create or replace function public.vod_timeline_moderate(p_title_no bigint,p_key text,p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('vod-timeline:'||p_title_no,0));
  if p_action='automatic' then
    insert into public.vod_timeline_choice(title_no,pinned_key) values(p_title_no,null)
    on conflict(title_no) do update set pinned_key=null;
  else
    if not exists(select 1 from public.vod_timeline_candidate where title_no=p_title_no and candidate_key=p_key) then
      raise exception 'Unknown timeline';
    end if;
    if p_action='pin' then
      if not exists(select 1 from public.vod_timeline_candidate where title_no=p_title_no and candidate_key=p_key and present) then
        raise exception 'Timeline is unavailable';
      end if;
      insert into public.vod_timeline_choice(title_no,pinned_key) values(p_title_no,p_key)
      on conflict(title_no) do update set pinned_key=p_key;
      update public.vod_timeline_candidate set visibility='show' where title_no=p_title_no and candidate_key=p_key;
    elsif p_action in ('show','hide','auto') then
      update public.vod_timeline_candidate set visibility=p_action where title_no=p_title_no and candidate_key=p_key;
    else raise exception 'Invalid action'; end if;
  end if;
  perform public.vod_timeline_project(p_title_no);
end $$;

revoke all on function public.vod_timeline_project(bigint) from public,anon,authenticated;
revoke all on function public.vod_timeline_ingest(bigint,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.vod_timeline_moderate(bigint,text,text) from public,anon,authenticated;
grant execute on function public.vod_timeline_project(bigint) to service_role;
grant execute on function public.vod_timeline_ingest(bigint,jsonb,timestamptz) to service_role;
grant execute on function public.vod_timeline_moderate(bigint,text,text) to service_role;
commit;
