-- Manual rollback artifact, NOT a forward migration. Roll application back first.
-- Retains recovery rows and additive functions; restores prior function behavior only.
begin;
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

create or replace function public.search_graph_nightly()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare t0 timestamptz; n int; graph_ok boolean := false;
begin
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
      perform public.search_term_relations_swap();
    exception when others then
      raise warning 'search_term_relations_swap failed: %', sqlerrm;
    end;
  end if;
end;
$$;

create or replace function public.search_graph_nightly_if_stale()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare last_kst date;
begin
  select max(computed_at at time zone 'Asia/Seoul')::date into last_kst from public.search_trends;
  if last_kst is not null and last_kst >= (now() at time zone 'Asia/Seoul')::date then
    raise notice 'search_graph_nightly_if_stale: fresh (%), skip', last_kst;
    return false;
  end if;
  raise notice 'search_graph_nightly_if_stale: stale (%), rerun', last_kst;
  perform public.search_graph_nightly();
  return true;
end;
$$;
commit;
