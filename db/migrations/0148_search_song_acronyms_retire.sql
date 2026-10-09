-- 0148: 규칙으로 만든 노래 줄임말(0147 auto-acro) 철수(2026-10-10 소유자: "모든 곡을 첫 글자 따서 자동 줄임말 만들지 말고,
-- 실제로 사람들이 그렇게 줄여 부른다고 웹에서 확인된 것만"). 머리글자 규칙이 만든 205개를 지우고 함수·밤 작업 호출을 걷는다.
-- 확인된 줄임말은 시드(0149, source 'seed-songabbr')로 따로 넣는다. 밤 작업은 0145 본문으로 되돌린다.
-- 적용: SUPABASE_DB_CA_PATH=.scratch-pw/supabase-ca.crt node scripts/apply-db.mjs db/migrations/0148_search_song_acronyms_retire.sql

delete from public.search_synonyms where source = 'auto-acro';

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

drop function if exists public.search_song_acronyms_rebuild();
