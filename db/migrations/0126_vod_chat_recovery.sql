-- Resumable aggregate-only chat jobs. Apply before collector deployment.
-- Missing files are gaps, never terminal completion. Legacy complete flags are
-- deliberately ignored by the new queue; old published profiles survive rebuilds.
-- Publication + optimistic checkpoint are one transaction (no double counting).
-- No raw chat, speaker IDs or source URLs in job state. Service role only.
-- Rollback: stop the new collector; retain grants/profiles/jobs for recovery.
create table if not exists public.vod_chat_job (
  title_no bigint primary key references public.vod_archive(title_no) on delete cascade,
  revision integer not null default 0,
  state jsonb,
  complete boolean not null default false,
  next_retry_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vod_chat_job_due_idx on public.vod_chat_job(next_retry_at);
alter table public.vod_chat_job enable row level security;
revoke all on public.vod_chat_job from public, anon, authenticated;
grant select, insert, update, delete on public.vod_chat_job to service_role;

create or replace function public.vod_chat_pick_jobs(p_limit integer default 4)
returns table(title_no bigint)
language sql security definer set search_path = public as $$
  with due as (
    select v.title_no, (j.title_no is null) as fresh,
      row_number() over(partition by (j.title_no is null)
        order by case when j.state is null and not j.complete then 0
          when not j.complete and coalesce((j.state->>'retries')::integer,0)=0 then 1 else 2 end,
          coalesce(j.next_retry_at, '-infinity'::timestamptz),v.broadcast_day desc,v.title_no desc) as lane_rank
    from public.vod_archive v left join public.vod_chat_job j on j.title_no=v.title_no
    where v.auth_no=101 and (j.title_no is null or j.next_retry_at<=now())
  )
  select d.title_no from due d
  -- Interleave continuation/context retries and untouched archives. Even limit=1
  -- alternates lanes every scheduled half-hour; backlog cannot starve late edits.
  order by d.lane_rank, case when (extract(epoch from now())::bigint / 1800) % 2=0
    then d.fresh::integer else (not d.fresh)::integer end
  limit greatest(1, least(coalesce(p_limit, 4), 20));
$$;
revoke all on function public.vod_chat_pick_jobs(integer) from public, anon, authenticated;
grant execute on function public.vod_chat_pick_jobs(integer) to service_role;

create or replace function public.vod_chat_commit_job(
  p_title_no bigint, p_revision integer, p_job jsonb, p_snapshot jsonb default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare current_revision integer;
begin
  if not exists(select 1 from public.vod_archive where title_no=p_title_no and auth_no=101) then return false; end if;
  insert into public.vod_chat_job(title_no) values(p_title_no) on conflict do nothing;
  select revision into current_revision from public.vod_chat_job where title_no=p_title_no for update;
  if current_revision <> p_revision then return false; end if;
  if p_snapshot is not null then
    -- Replace derived aggregates only for this VOD, atomically with its checkpoint.
    delete from public.vod_chat_terms where title_no=p_title_no;
    insert into public.vod_chat_terms(title_no,term,cnt,peak_bin,peak_cnt,bins)
      select p_title_no,x.term,x.cnt,x.peak_bin,x.peak_cnt,x.bins
      from jsonb_to_recordset(p_snapshot->'terms') as x(term text,cnt integer,peak_bin integer,peak_cnt integer,bins integer);
    delete from public.vod_chat_bins where title_no=p_title_no;
    insert into public.vod_chat_bins(title_no,bin,msgs,speakers,laugh,terms)
      select p_title_no,x.bin,x.msgs,x.speakers,x.laugh,x.terms
      from jsonb_to_recordset(p_snapshot->'bins') as x(bin integer,msgs integer,speakers integer,laugh integer,terms text[]);
    delete from public.vod_chat_people where title_no=p_title_no;
    insert into public.vod_chat_people(title_no,name,greetings,mentions)
      select p_title_no,x.name,x.greetings,x.mentions
      from jsonb_to_recordset(p_snapshot->'people') as x(name text,greetings integer,mentions integer);
  end if;
  update public.vod_chat_job set revision=revision+1,
    state=nullif(p_job->'state','null'::jsonb), complete=(p_job->>'complete')::boolean,
    next_retry_at=(p_job->>'nextRetryAt')::timestamptz, updated_at=now()
    where title_no=p_title_no;
  insert into public.vod_chat_sync(title_no,chunks,messages,complete,synced_at)
    values(p_title_no,(p_job->>'chunks')::integer,(p_job->>'messages')::integer,(p_job->>'complete')::boolean,now())
    on conflict(title_no) do update set chunks=excluded.chunks,messages=excluded.messages,
      complete=excluded.complete,synced_at=excluded.synced_at;
  return true;
end;
$$;
revoke all on function public.vod_chat_commit_job(bigint,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.vod_chat_commit_job(bigint,integer,jsonb,jsonb) to service_role;

-- A late/new/edited representative timeline changes contextual word analysis.
-- Invalidate a running checkpoint too, so stale workers cannot publish old context.
create or replace function public.vod_chat_timeline_changed()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if TG_OP='INSERT' or new.entries is distinct from old.entries then
    insert into public.vod_chat_job(title_no,revision) values(new.title_no,1)
    on conflict(title_no) do update set state=null,complete=false,
      revision=vod_chat_job.revision+1,next_retry_at=now(),updated_at=now();
  end if;
  return new;
end;
$$;
revoke all on function public.vod_chat_timeline_changed() from public, anon, authenticated;
drop trigger if exists vod_chat_timeline_changed on public.vod_timeline;
create trigger vod_chat_timeline_changed after insert or update of entries on public.vod_timeline
  for each row execute function public.vod_chat_timeline_changed();
