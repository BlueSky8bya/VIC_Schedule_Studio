-- 0096: 검색어 제안(입력 중 자동완성) + 'mic' 같은 잡음 단어 제거.
--
-- 소유자(2026-09-18): "엔터 치기 전엔 유튜브·구글처럼 우리 사이트 전용 관련 단어가 아래로 뜨고, 엔터 치면 검색".
--  · search_suggest(p_q): 우리 말뭉치의 단어(search_terms)·인물·게임·장르·시드 동의어 중 앞글자(prefix) 일치 우선, 포함 일치 보조.
--    초성(ㅁㅂ)도 앞글자 일치. 값싼 조회(수천 행 LIKE)라 키 입력마다 불러도 된다 — 무거운 search_public은 Enter 때만.
--  · 'mic'(팬 챕터 "MIC ON"에서 온 말)이 관련어 칩에 자꾸 떴다 → 단어 그래프·관련어 필터·트렌딩 불용어에 mic/on/off/micon 추가.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0096_public_search_suggest.sql

create or replace function public.search_suggest(p_q text, p_limit integer default 8)
returns table (term text, kind text, weight numeric)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select public.search_norm(p_q) as qn, public.search_norm(p_q) ~ '^[ㄱ-ㅎ]+$' as is_cho
  ),
  stop as (
    select unnest(array['mic','micon','on','off','토리','빅토리','토리님','방송','시작','종료','오늘','내일','시간','잠깐','다시','이야기',
      '우리','그냥','정말','진짜','엔딩','멘트','휴식','시청자','일차','후열','보기','참여','하기','해보기','구경','도전','하는','있는','없는',
      '같은','너무','이제','근데','그리고','그래서','하고','에서','으로','부터','까지','이번','다음','지금','아직','계속','다들','모두','여러분',
      '안녕','감사','합니다','입니다','타임라인','챕터','등장','일부','근황','확인','컨텐츠','게임','이어서']) as w
  ),
  cand as (
    select t.term, 'term'::text as kind, ln(1 + t.docs)::numeric as w, t.last_day as day from public.search_terms t where t.docs >= 2
    union all
    select e.display, 'person', ln(1 + e.docs)::numeric + 1.0, e.last_day from public.search_entities e where e.docs >= 2
    union all
    select g.display, 'game', ln(1 + g.docs)::numeric + 1.5, null from public.search_games g where g.docs >= 1
    union all
    select i.term, 'genre', 1.2::numeric, null from public.search_intents i where i.intent = 'genre'
    union all
    select s.term, 'term', 0.8::numeric, null from public.search_synonyms s where s.source in ('seed','seed2','seed-owner','seed-genre') and s.kind = 'syn'
  ),
  scored as (
    select c.term, c.kind, c.w, c.day,
      public.search_norm(c.term) as tn,
      case
        when q.is_cho and public.search_choseong(c.term) like q.qn || '%' then 2
        when public.search_norm(c.term) like q.qn || '%' then 2
        when not q.is_cho and public.search_norm(c.term) like '%' || q.qn || '%' then 1
        else 0 end as m
    from cand c, q
  )
  select s.term, min(s.kind) as kind,
         round(max(s.m * 10 + s.w + case when s.day is not null and s.day >= current_date - 365 then 0.5 else 0 end), 3) as weight
  from scored s, q
  where s.m > 0 and length(s.tn) >= 2 and s.tn <> q.qn and s.tn not in (select w from stop)
    -- 굴절형(샬롯님의·노래가·샬롯이) 제거: 조사 꼬리이거나, 마지막 글자를 뗀 말이 이미 후보에 있으면 뺀다(마비노기는 '마비노'가 없어 남는다)
    and s.tn !~ '(님의|님과|님이|님은|님을|님도|에서|으로|까지|부터|들의|들이|들은|들을|이서|에게|한테|처럼|보다|마다|조차|밖에)$'
    and not exists (
      select 1 from cand c2 where public.search_norm(c2.term) = substr(s.tn, 1, length(s.tn) - 1) and length(s.tn) >= 3
    )
  group by s.term
  order by weight desc, s.term
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;
grant execute on function public.search_suggest(text, integer) to anon, authenticated;

-- 단어 그래프 불용어에 mic/on/off (0089 재정의의 stop 배열만 갱신).
create or replace function public.search_term_graph_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n_terms int;
begin
  create temp table tmp_tw on commit drop as
  with docs as (
    select 'v:' || v.title_no as doc, v.broadcast_day as day, v.title as txt
    from public.vod_archive v where v.auth_no = 101
    union all
    select 'v:' || c.title_no, v.broadcast_day, c.label
    from public.vod_chapter_index c join public.vod_archive v on v.title_no = c.title_no and v.auth_no = 101
    union all
    select 'e:' || e.id, e.date_key, e.public_title || ' ' || coalesce(e.public_description, '')
    from public.events e
    where e.deleted_at is null and e.visibility_scope = 'public' and e.status <> 'draft'
      and not (coalesce(e.teaser, false) and e.teaser_reveal_at is not null and e.teaser_reveal_at > now())
  ),
  stop as (
    select unnest(array['토리님','토리','빅토리','빅토리님','방송','시작','종료','오늘','내일','시간','잠깐','다시','이야기',
      '우리','그냥','정말','진짜','엔딩','멘트','휴식','시청자','일차','후열','보기','참여','하기','해보기','구경','도전',
      '하는','있는','없는','같은','너무','이제','근데','그리고','그래서','하고','에서','으로','부터','까지','이번','다음',
      '지금','아직','계속','다들','모두','여러분','안녕','감사','합니다','입니다','타임라인','챕터','종료~','등장',
      'mic','micon','on','off','마이크']) as w
  ),
  words as (
    select doc, day,
      case when lower(x) ~ '님$' then regexp_replace(lower(x), '님$', '') else lower(x) end as w
    from docs, regexp_split_to_table(txt, '[^가-힣a-zA-Z0-9]+') as x
    where x ~ '^[가-힣]{2,6}$' or x ~* '^[a-z0-9]{3,12}$'
    union all
    select 'v:' || t.title_no, v.broadcast_day, t.term
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no = 101
    where t.cnt >= 3 and t.term not like '/%/'
      and v.broadcast_day >= current_date - interval '540 days'
  )
  select distinct doc, day, w from words
  where w not in (select w from stop) and w !~ '^[0-9]+$' and length(w) >= 2;

  delete from public.search_terms;
  insert into public.search_terms (term, docs, last_day)
  select w, count(distinct doc)::int, max(day) from tmp_tw group by w having count(distinct doc) >= 3;
  get diagnostics n_terms = row_count;

  delete from public.search_term_relations;
  with n as (select greatest(1, count(distinct doc))::numeric as total from tmp_tw),
  pairs as (
    select least(x.w, y.w) as a, greatest(x.w, y.w) as b, count(distinct x.doc)::int as co, max(x.day) as last_day
    from tmp_tw x
    join tmp_tw y on y.doc = x.doc and y.w > x.w
    where x.w in (select term from public.search_terms) and y.w in (select term from public.search_terms)
    group by 1, 2
    having count(distinct x.doc) >= 3
  ),
  scored as (
    select p.a, p.b, p.co, p.last_day,
      greatest(0, ln((p.co::numeric * n.total) / (ta.docs::numeric * tb.docs::numeric)))::numeric as ppmi
    from pairs p
    join public.search_terms ta on ta.term = p.a
    join public.search_terms tb on tb.term = p.b, n
  )
  insert into public.search_term_relations (a, b, co_docs, ppmi, last_day)
  select a, b, co, ppmi, last_day from scored where ppmi >= 0.5;

  delete from public.search_synonyms where source = 'auto-rel';
  insert into public.search_synonyms (term, alt, source, kind, support)
  select r.a, r.b, 'auto-rel', 'rel-chip', r.co_docs from public.search_term_relations r
  where r.ppmi >= 2 and r.co_docs >= 4 and r.last_day >= current_date - interval '540 days'
  union all
  select r.b, r.a, 'auto-rel', 'rel-chip', r.co_docs from public.search_term_relations r
  where r.ppmi >= 2 and r.co_docs >= 4 and r.last_day >= current_date - interval '540 days'
  on conflict (term, alt) do nothing;

  return n_terms;
end;
$$;

select public.search_term_graph_rebuild();
