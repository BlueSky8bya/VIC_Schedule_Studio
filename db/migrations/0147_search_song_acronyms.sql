-- 0147: 노래 제목 줄임말 자동(2026-10-10 소유자: "'사랑하긴 했었나요 … 가둬두네'를 보통 사스가라고 줄여 부른다 —
-- 이것처럼 노래 줄임말도 검색되게").
-- 예전엔 사스가가 일반 줄임말 짝맞춤(search_abbrev_match, 가까운 글자 창 안의 부분열)에 운 좋게 걸렸고, 엉뚱한
-- '사스케'(오타 교정)보다 아래였다. 이제 곡 제목마다 줄임말 후보를 만들어 동의어(줄임말 → 제목 전체, 한쪽만)로 둔다:
--   · 낱말 머리글자 앞 3·4개(보고싶다 이렇게 말하니까 → 보이말)
--   · 낱말이 6개 이하면 머리글자 전부
--   · 첫 낱말 + 가운데 낱말 하나 + 끝 낱말(사랑하긴 … 스쳐가는 … 가둬두네 → 사스가) — 팬 줄임말은 대개 첫·끝을 잡는다
-- 한글 낱말 3개 이상인 제목만, 줄임말은 3~6자. 이미 있는 말(검색어 사전·문서 낱말·다른 동의어)과 같으면 버린다 —
-- 진짜 낱말을 가로채지 않게. source 'auto-acro', 다시 만들 때 통째로 갈아 끼운다(밤 작업 · 새 다시보기 챕터 뒤).
-- 적용: SUPABASE_DB_CA_PATH=.scratch-pw/supabase-ca.crt node scripts/apply-db.mjs db/migrations/0147_search_song_acronyms.sql

create or replace function public.search_song_acronyms_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.search_synonyms where source = 'auto-acro';
  with titles as (
    select distinct btrim(regexp_replace(sp.title, '\s*[\(\[（].*$', '')) as t
    from public.vod_chapter_index c
    cross join lateral public.search_song_split(c.label) sp
    where c.song_kind is not null and sp.title ~ '[가-힣]'
  ),
  words as (
    select t, public.search_norm(t) as tn,
      array(select left(w, 1) from regexp_split_to_table(t, '\s+') with ordinality as x(w, o)
            where w ~ '^[가-힣]' order by o) as ini
    from titles
  ),
  cands as (
    select tn, array_to_string(ini[1:3], '') as acr from words where cardinality(ini) >= 3
    union select tn, array_to_string(ini[1:4], '') from words where cardinality(ini) >= 4
    union select tn, array_to_string(ini, '') from words where cardinality(ini) between 3 and 6
    union
    select w.tn, w.ini[1] || w.ini[m] || w.ini[cardinality(w.ini)]
    from words w cross join lateral generate_series(2, cardinality(w.ini) - 1) as m
    where cardinality(w.ini) >= 3
  )
  insert into public.search_synonyms (term, alt, source, kind)
  select distinct c.acr, c.tn, 'auto-acro', 'syn'
  from cands c
  where length(c.acr) between 3 and 6 and c.acr <> c.tn
    and not exists (select 1 from public.search_terms s where s.term = c.acr)
    and not exists (select 1 from public.search_doc_words d where d.term = c.acr)
    and not exists (select 1 from public.search_synonyms y where y.term = c.acr)
  on conflict (term, alt) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.search_song_acronyms_rebuild() from public, anon, authenticated;
grant execute on function public.search_song_acronyms_rebuild() to service_role;

-- 밤 작업(0145)에 줄임말 재생성을 더한다 — 노래 분류 바로 뒤.
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
    perform public.search_song_acronyms_rebuild(); -- (0147) 노래 줄임말
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

select public.search_song_acronyms_rebuild();
