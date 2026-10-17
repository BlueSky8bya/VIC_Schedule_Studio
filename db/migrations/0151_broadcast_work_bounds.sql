-- PLAN080 backend bounds. Apply before application rollout. No source-data cleanup runs here.
-- Rollback: deploy the previous application first; restore project/ingest functions from
-- 0124 and nightly/if_stale definitions from 0148/0129 (FUNCTION DEFINITIONS ONLY).
-- Do not rerun historical migration data DELETE/cron/backfill statements. Keep this
-- service-only checkpoint table until all in-flight workers have stopped. See rollback artifact.
begin;
create table if not exists public.broadcast_work_state (
  key text primary key check (key in ('vod-archive-sweep','timeline-search','search-term-graph')),
  revision bigint not null default 0,
  state jsonb,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.broadcast_work_state enable row level security;
revoke all on public.broadcast_work_state from public,anon,authenticated;
grant select,insert,update on public.broadcast_work_state to service_role;
comment on table public.broadcast_work_state is 'Service-only bounded archive recovery and derived-search success/dirty markers. Archive metadata clears on successful completion; abandoned snapshots expire after 24h in collector.';
create or replace function public.vod_timeline_project(p_title_no bigint)
returns void language plpgsql security definer set search_path = public as $$
declare chosen public.vod_timeline_candidate%rowtype; alternatives jsonb; writes integer;
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
    entry_count=excluded.entry_count,entries=excluded.entries,variants=excluded.variants
  where (vod_timeline.author_nick,vod_timeline.comment_no,vod_timeline.entry_count,vod_timeline.entries,vod_timeline.variants)
    is distinct from (excluded.author_nick,excluded.comment_no,excluded.entry_count,excluded.entries,excluded.variants);
  get diagnostics writes=row_count;
  -- Collection and moderation share this exact public-content change point.
  if writes > 0 then
    insert into public.broadcast_work_state(key,revision,state) values('timeline-search',1,'{"dirty":true}')
    on conflict(key) do update set revision=broadcast_work_state.revision+1,state=excluded.state;
  end if;
  -- Existing entries trigger indexes only the representative, not every variant.
end $$;

create or replace function public.vod_timeline_ingest_changes(p_title_no bigint, p_candidates jsonb, p_started_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c jsonb; before_content jsonb; after_content jsonb; changed boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('vod-timeline:'||p_title_no,0));
  -- A slower earlier fetch must not overwrite a newer completed snapshot.
  if exists(select 1 from public.vod_timeline where title_no=p_title_no and synced_at > p_started_at) then return jsonb_build_object('accepted',false,'changed',false); end if;
  if jsonb_typeof(p_candidates) is distinct from 'array' then raise exception 'Invalid candidates'; end if;
  select jsonb_build_array(author_nick,comment_no,entry_count,entries,variants) into before_content
    from public.vod_timeline where title_no=p_title_no;
  for c in select value from jsonb_array_elements(p_candidates) loop
    insert into public.vod_timeline_candidate(title_no,candidate_key,root_comment_no,source_comment_nos,author_nick,entries,eligible,reason,score,present)
    values(p_title_no,c->>'key',(c->>'rootCommentNo')::bigint,c->'sourceCommentNos',c->>'authorNick',c->'entries',
      (c->>'eligible')::boolean,c->>'reason',(c->>'score')::integer,true)
    on conflict(title_no,candidate_key) do update set root_comment_no=excluded.root_comment_no,
      source_comment_nos=excluded.source_comment_nos,author_nick=excluded.author_nick,entries=excluded.entries,
      eligible=excluded.eligible,reason=excluded.reason,score=excluded.score,present=true
    where (vod_timeline_candidate.root_comment_no,vod_timeline_candidate.source_comment_nos,
      vod_timeline_candidate.author_nick,vod_timeline_candidate.entries,vod_timeline_candidate.eligible,
      vod_timeline_candidate.reason,vod_timeline_candidate.score,vod_timeline_candidate.present)
      is distinct from (excluded.root_comment_no,excluded.source_comment_nos,excluded.author_nick,
        excluded.entries,excluded.eligible,excluded.reason,excluded.score,true);
    -- visibility and pinned_key are deliberately never overwritten by collection.
  end loop;
  update public.vod_timeline_candidate c set present=false
    where c.title_no=p_title_no and c.present and not exists (
      select 1 from jsonb_array_elements(p_candidates) v where v->>'key'=c.candidate_key);
  perform public.vod_timeline_project(p_title_no);
  update public.vod_timeline set synced_at=p_started_at where title_no=p_title_no;
  select jsonb_build_array(author_nick,comment_no,entry_count,entries,variants) into after_content
    from public.vod_timeline where title_no=p_title_no;
  changed := before_content is distinct from after_content;
  return jsonb_build_object('accepted',true,'changed',changed);
end $$;

create or replace function public.vod_timeline_ingest(p_title_no bigint,p_candidates jsonb,p_started_at timestamptz)
returns boolean language sql security definer set search_path=public as $$
  select (public.vod_timeline_ingest_changes(p_title_no,p_candidates,p_started_at)->>'accepted')::boolean
$$;

-- Compare-and-swap owns both the checkpoint and final archive publication. Incomplete
-- scans only store recovery metadata: they never publish deletions or a success clock.
create or replace function public.vod_archive_sweep_commit(p_revision bigint,p_state jsonb,p_complete boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare current_revision bigint; removed integer := 0; gone bigint[]; started timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('vod-archive-sweep',0));
  select revision into current_revision from public.broadcast_work_state where key='vod-archive-sweep';
  if coalesce(current_revision,0) <> p_revision then return jsonb_build_object('accepted',false,'deleted',0); end if;
  if jsonb_typeof(p_state) is distinct from 'object' or jsonb_typeof(p_state->'rows') is distinct from 'array'
    or jsonb_array_length(p_state->'rows') > 10000 or pg_column_size(p_state) > 8388608 then
    raise exception 'Invalid archive checkpoint';
  end if;
  started := (p_state->>'startedAt')::timestamptz;
  if started is null or started > now() + interval '1 minute' then raise exception 'Invalid sweep clock'; end if;
  if p_complete then
    if jsonb_typeof(p_state->'dbRows') is distinct from 'array' or jsonb_array_length(p_state->'dbRows') <> jsonb_array_length(p_state->'rows') then raise exception 'Invalid archive projection'; end if;
    if jsonb_array_length(p_state->'rows')=0 or coalesce((p_state->>'nextPage')::int <= (p_state->>'lastPage')::int,true)
      or coalesce((p_state->>'lastPage')::int not between 1 and 500,true) then
      raise exception 'Incomplete archive sweep';
    end if;
    if exists(select 1 from jsonb_array_elements(p_state->'dbRows') r where
      (r->>'title_no')::bigint <= 0 or r->>'broadcast_day' is null) then raise exception 'Invalid archive row'; end if;
    insert into public.vod_archive(title_no,bno,broadcast_day,title,duration_ms,reg_date,comment_cnt,like_cnt,read_cnt,auth_no,thumb,synced_at)
    select r.title_no,r.bno,r.broadcast_day,r.title,r.duration_ms,r.reg_date,r.comment_cnt,r.like_cnt,r.read_cnt,r.auth_no,r.thumb,now()
    from jsonb_to_recordset(p_state->'dbRows') as r(title_no bigint,bno text,broadcast_day date,title text,duration_ms bigint,
      reg_date timestamptz,comment_cnt integer,like_cnt integer,read_cnt integer,auth_no integer,thumb text)
    on conflict(title_no) do update set bno=excluded.bno,broadcast_day=excluded.broadcast_day,title=excluded.title,
      duration_ms=excluded.duration_ms,reg_date=excluded.reg_date,comment_cnt=excluded.comment_cnt,
      like_cnt=excluded.like_cnt,read_cnt=excluded.read_cnt,auth_no=excluded.auth_no,thumb=excluded.thumb,synced_at=excluded.synced_at
    -- Preserve guest rows and incremental updates completed after this snapshot started.
    where not vod_archive.guest and vod_archive.synced_at <= started;
    select array_agg(v.title_no) into gone from public.vod_archive v
      where not v.guest and v.synced_at <= started and not exists(
        select 1 from jsonb_array_elements(p_state->'dbRows') r where (r->>'title_no')::bigint=v.title_no);
    if cardinality(gone) between 1 and 20 then
      delete from public.vod_timeline where title_no=any(gone);
      delete from public.vod_archive where title_no=any(gone);
      get diagnostics removed=row_count;
    end if;
  end if;
  insert into public.broadcast_work_state(key,revision,state,completed_at)
    values('vod-archive-sweep',p_revision+1,case when p_complete then null else p_state end,
      case when p_complete then clock_timestamp() else null end)
    on conflict(key) do update set revision=excluded.revision,state=excluded.state,
      completed_at=case when p_complete then excluded.completed_at else broadcast_work_state.completed_at end,updated_at=now();
  return jsonb_build_object('accepted',true,'deleted',removed);
end $$;
create or replace function public.search_graph_nightly()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare t0 timestamptz; n int; graph_ok boolean := false;
begin
  if not pg_try_advisory_xact_lock(hashtextextended('search-graph-nightly',0)) then return; end if;
  -- (0145) 노래·게임 분류부터 — 챕터 재색인이 비운 song_kind를 되살린다.
  t0 := clock_timestamp();
  begin
    perform public.search_song_refresh();
    perform public.search_game_refresh();
    raise notice 'search_song/game_refresh: % ms', round(extract(epoch from clock_timestamp() - t0) * 1000);
  exception when others then
    raise warning 'search_song/game_refresh failed: %', sqlerrm;
  end;
  t0 := clock_timestamp();
  begin
    select public.search_term_graph_rebuild() into n;
    raise notice 'search_term_graph_rebuild: % terms, % ms', n, round(extract(epoch from clock_timestamp() - t0) * 1000);
    graph_ok := true;
  exception when others then
    raise warning 'search_term_graph_rebuild failed: %', sqlerrm;
  end;
  t0 := clock_timestamp();
  begin
    perform public.search_synonyms_rebuild();
    raise notice 'search_synonyms_rebuild: % ms', round(extract(epoch from clock_timestamp() - t0) * 1000);
  exception when others then
    raise warning 'search_synonyms_rebuild failed: %', sqlerrm;
  end;
  t0 := clock_timestamp();
  begin
    perform public.search_trending_rebuild();
    raise notice 'search_trending_rebuild: % ms', round(extract(epoch from clock_timestamp() - t0) * 1000);
  exception when others then
    raise warning 'search_trending_rebuild failed: %', sqlerrm;
  end;
  -- (0136) 성능 표본은 30일만 — 읽는 화면 없이 사고 분석(7일 창)에만 쓴다. 날마다 하루치만 지워 빈자리는 다시 쓰인다.
  begin
    delete from public.perf_samples where created_at < now() - interval '30 days';
  exception when others then
    raise warning 'perf_samples prune failed: %', sqlerrm;
  end;
  -- (0137) 맨 마지막: 이름 맞바꾸기 잠금은 커밋까지 이어지므로 뒤에 아무것도 두지 않는다.
  if graph_ok then
    begin
      if public.search_term_relations_swap() then
        insert into public.broadcast_work_state(key,completed_at) values('search-term-graph',clock_timestamp())
        on conflict(key) do update set completed_at=excluded.completed_at;
      end if;
    exception when others then
      raise warning 'search_term_relations_swap failed: %', sqlerrm;
    end;
  end if;
end;
$$;

create or replace function public.search_graph_nightly_if_stale()
returns boolean language plpgsql security definer set search_path=public as $$
begin
  if exists(select 1 from public.broadcast_work_state where key='search-term-graph'
    and (completed_at at time zone 'Asia/Seoul')::date >= (now() at time zone 'Asia/Seoul')::date)
    and exists(select 1 from public.search_trends where
      (computed_at at time zone 'Asia/Seoul')::date >= (now() at time zone 'Asia/Seoul')::date) then return false; end if;
  perform public.search_graph_nightly();
  return true;
end $$;

revoke all on function public.vod_timeline_project(bigint),public.vod_timeline_ingest(bigint,jsonb,timestamptz),
  public.vod_timeline_ingest_changes(bigint,jsonb,timestamptz),public.vod_archive_sweep_commit(bigint,jsonb,boolean),
  public.search_graph_nightly(),public.search_graph_nightly_if_stale() from public,anon,authenticated;
grant execute on function public.vod_timeline_project(bigint),public.vod_timeline_ingest(bigint,jsonb,timestamptz),
  public.vod_timeline_ingest_changes(bigint,jsonb,timestamptz),public.vod_archive_sweep_commit(bigint,jsonb,boolean) to service_role;
-- Nightly/retry remain cron-owner-only, matching existing grants.
-- One scan/snapshot replaces eight service-role HEAD count requests. No identifiers.
create or replace function public.developer_live_presence_counts(p_observed_at timestamptz)
returns jsonb language sql stable strict security definer set search_path=public as $$
  select jsonb_build_object('total',count(*),
    'roles',jsonb_build_object('owner',count(*) filter(where role='owner'),'viewer',count(*) filter(where role='viewer'),
      'anon',count(*) filter(where role='anon'),'developer',count(*) filter(where role='developer')),
    'devices',jsonb_build_object('desktop',count(*) filter(where device='desktop'),'android',count(*) filter(where device='android'),
      'ios',count(*) filter(where device='ios'),'mobile',count(*) filter(where device='mobile')))
  from public.visit_session
  where day >= ((p_observed_at-interval '90 seconds') at time zone 'Asia/Seoul')::date
    and ended_at is null and last_seen_at >= p_observed_at-interval '90 seconds' and last_seen_at <= p_observed_at
    and role in ('owner','viewer','anon','developer')
$$;
revoke all on function public.developer_live_presence_counts(timestamptz) from public,anon,authenticated;
grant execute on function public.developer_live_presence_counts(timestamptz) to service_role;
commit;
