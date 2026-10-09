-- 0145: 영문 가수·곡 제목 → 한글 읽기 자동 파이프라인(2026-10-10 소유자: "새 래퍼가 나와 감지돼도 자동으로 한글 검색").
--
-- ① search_xlit_pending(): 노래 챕터("가수 - 곡")에서 영문이 든 가수·곡 제목 중 아직 어떤 동의어(syn)의 짝도 아닌 것.
--    앱(lib/search/xlit-sync.ts)이 받아 규칙 엔진(lib/search/xlit.ts)으로 한글 읽기를 만들고 search_synonyms에
--    '한글 → 영문'(source 'auto-xlit', 한쪽만)으로 넣는다. 새 다시보기 챕터가 저장될 때마다(lib/broadcast/vod-timeline) 돈다.
--    읽기가 조금 틀려도 검색 오타 교정(search_correct, 자모 거리)이 사전의 이 한글 말로 끌어온다.
-- ② 밤 작업이 노래 분류(search_song_refresh)·게임(search_game_refresh)도 다시 한다 — 챕터 재색인(vod_chapter_index_rebuild)이
--    그 방송의 song_kind를 비우는데, 낮 파이프라인은 저장이 있을 때만 분류를 다시 돌려 2026-10-10 전 챕터가 미분류(가수·곡
--    검색 의도가 통째로 꺼짐)였다. 밤마다 한 번 맞춘다.
-- 적용: SUPABASE_DB_CA_PATH=.scratch-pw/supabase-ca.crt node scripts/apply-db.mjs db/migrations/0145_search_xlit_pipeline.sql

create or replace function public.search_xlit_pending(p_limit integer default 300)
returns table (latin text, norm text)
language sql
stable
security definer
set search_path = public
as $$
  with phrases as (
    select btrim(regexp_replace(x.p, '\s*[\(\[（].*$', '')) as p
    from public.vod_chapter_index c
    cross join lateral public.search_song_split(c.label) sp
    cross join lateral (values (sp.artist), (sp.title)) as x(p)
    where c.song_kind is not null and x.p ~ '[A-Za-z]'
  )
  select min(p) as latin, public.search_norm(p) as norm
  from phrases
  where p ~ '[A-Za-z]{2}' and length(public.search_norm(p)) between 2 and 40
    and not exists (select 1 from public.search_synonyms s where s.alt = public.search_norm(p) and s.kind = 'syn')
  group by public.search_norm(p)
  order by count(*) desc
  limit greatest(1, least(p_limit, 1000));
$$;
revoke all on function public.search_xlit_pending(integer) from public, anon, authenticated;
grant execute on function public.search_xlit_pending(integer) to service_role;

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
