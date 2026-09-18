-- 0105: 인물 그래프 별칭 병합 + 제안 관련어는 제목·챕터·일정 말만.
--  · search_graph_rebuild: 시드 동의어로 묶인 이름을 언급 최다 이름으로 합친다(마최→아마최, 젠황→젠투) — '함께'에 자기 자신이 뜨던 실측 수정.
--  · search_doc_words: 단어 그래프 재구축 때 제목·챕터·일정 단어만 따로 저장. 제안 2순위(관련어)는 이 표에 있는 말(또는 게임·인물·시드)만 —
--    채팅에서만 온 '우리도·뭐여·커피·브금' 같은 잡음 차단.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0105_public_search_alias_merge.sql

create table if not exists public.search_doc_words (term text primary key);
alter table public.search_doc_words enable row level security;
grant select on public.search_doc_words to anon, authenticated, service_role;
grant insert, delete on public.search_doc_words to service_role;

create or replace function public.search_graph_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n_entities int;
begin
  create temp table tmp_mentions on commit drop as
    select * from public.search_person_mentions();
  -- 별칭 병합(0105): 시드 동의어(seed-person·seed-web·seed-owner)로 묶인 이름은 그 묶음에서 언급이 가장 많은 이름 하나로 합친다
  -- (마최·아마데우스최 → 아마최, 젠황 → 젠투). 안 합치면 같은 사람이 인물 둘로 갈려 '함께'에 자기 자신이 뜬다(실측).
  create temp table tmp_canon on commit drop as
  with grp as (
    select s.term, s.alt from public.search_synonyms s
    where s.kind = 'syn' and s.source in ('seed-person', 'seed-web', 'seed-owner')
  ),
  cnt as (select name, count(*)::int as n from tmp_mentions group by name),
  cand as (
    select g.term as name, x.alt as canon, coalesce(c.n, 0) as n
    from grp g
    join lateral (select g.alt as alt union select g.term) x on true
    left join cnt c on c.name = x.alt
  ),
  best as (
    select distinct on (name) name, canon from cand order by name, n desc, canon
  )
  select b.name, b.canon from best b where b.name <> b.canon;
  update tmp_mentions m set name = c.canon from tmp_canon c where m.name = c.name;

  delete from public.search_entities;
  insert into public.search_entities (name, display, mentions, docs, hapbang, first_day, last_day)
  select
    m.name,
    (select display from tmp_mentions x where x.name = m.name group by display order by count(*) desc, display limit 1),
    count(*)::int,
    count(distinct doc)::int,
    count(distinct doc) filter (where is_hap)::int,
    min(day), max(day)
  from tmp_mentions m
  group by m.name
  having count(distinct doc) >= 2;
  get diagnostics n_entities = row_count;

  -- 채팅에만 나온 방송 수(방문)
  update public.search_entities e set visits = coalesce(x.n, 0)
  from (
    select p.name, count(distinct p.title_no)::int as n
    from public.vod_chat_people p
    join public.vod_archive v on v.title_no = p.title_no and v.auth_no = 101
    where (p.greetings >= 5 or p.mentions >= 8)
      and v.broadcast_day >= current_date - interval '540 days'
      -- 제목·챕터에 그 이름이 있으면 방문이 아니라 출연(합방 등)
      and not exists (
        select 1 from public.vod_archive v2
        where v2.title_no = p.title_no and public.search_norm(v2.title) like '%' || p.name || '%'
      )
      and not exists (
        select 1 from public.vod_chapter_index c
        where c.title_no = p.title_no and public.search_norm(c.label) like '%' || p.name || '%'
      )
    group by p.name
  ) x where x.name = e.name;

  delete from public.search_relations;
  with docs as (
    select doc, day, bool_or(is_hap) as is_hap, array_agg(distinct name) as names
    from tmp_mentions
    where name in (select name from public.search_entities)
    group by doc, day
  ),
  pairs as (
    select least(a, b) as a, greatest(a, b) as b, d.is_hap, d.day
    from docs d, unnest(d.names) a, unnest(d.names) b
    where a < b
  ),
  agg as (
    select a, b, count(*)::int as co_docs, count(*) filter (where is_hap)::int as hap, max(day) as last_day
    from pairs group by a, b
  ),
  n as (select greatest(1, count(distinct doc))::numeric as total from tmp_mentions)
  insert into public.search_relations (a, b, co_docs, hapbang, weight, ppmi, last_day)
  select
    agg.a, agg.b, agg.co_docs, agg.hap,
    (agg.co_docs + agg.hap)::numeric,
    greatest(0, ln((agg.co_docs::numeric * n.total) / (ea.docs::numeric * eb.docs::numeric)))::numeric,
    agg.last_day
  from agg
  join public.search_entities ea on ea.name = agg.a
  join public.search_entities eb on eb.name = agg.b, n;

  delete from public.search_synonyms where source = 'auto-entity';
  insert into public.search_synonyms (term, alt, source, support)
  select s.name, l.name, 'auto-entity', least(s.docs, l.docs)
  from public.search_entities s
  join public.search_entities l
    on l.name <> s.name
   and length(s.name) >= 2
   and length(l.name) > length(s.name)
   and length(l.name) - length(s.name) <= 2
   and (l.name like s.name || '%' or l.name like '%' || s.name)
  where s.docs >= 3 and l.docs >= 3
    and not exists (select 1 from public.search_synonyms x where x.term = s.name and x.alt = l.name)
  union all
  select l.name, s.name, 'auto-entity', least(s.docs, l.docs)
  from public.search_entities s
  join public.search_entities l
    on l.name <> s.name
   and length(s.name) >= 2
   and length(l.name) > length(s.name)
   and length(l.name) - length(s.name) <= 2
   and (l.name like s.name || '%' or l.name like '%' || s.name)
  where s.docs >= 3 and l.docs >= 3
    and not exists (select 1 from public.search_synonyms x where x.term = l.name and x.alt = s.name)
  on conflict (term, alt) do nothing;

  return n_entities;
end;
$$;


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

  -- 제목·챕터·일정에서 온 말만 따로(0105) — 제안의 관련어 2순위는 채팅에만 있는 말을 쓰지 않는다.
  -- (먼저 문서 단어 집합을 임시 표로 만들고 교집합 — 행마다 서브쿼리를 돌리면 60초를 넘긴다, 실측)
  create temp table tmp_docw on commit drop as
  select distinct case when lower(x) ~ '님$' then regexp_replace(lower(x), '님$', '') else lower(x) end as w
  from (
    select v.title as txt from public.vod_archive v where v.auth_no = 101
    union all select c.label from public.vod_chapter_index c
    union all select e.public_title || ' ' || coalesce(e.public_description, '') from public.events e where e.deleted_at is null
  ) d, regexp_split_to_table(d.txt, '[^가-힣a-zA-Z0-9]+') as x
  where x ~ '^[가-힣]{2,6}$' or x ~* '^[a-z0-9]{3,12}$';
  delete from public.search_doc_words;
  insert into public.search_doc_words (term)
  select distinct t.w from tmp_tw t join tmp_docw d on d.w = t.w;

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
      '안녕','감사','합니다','입니다','타임라인','챕터','등장','일부','근황','확인','컨텐츠','게임','이어서','일정','보고']) as w
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
    union all
    -- 스트리머 별칭(0085 seed-person · 0102 seed-web): 별명 앞글자로도 사람이 뜬다(빡리→빡리안, 슈슈→슈슈잉이)
    select distinct s.term, 'person', 1.0::numeric, null::date from public.search_synonyms s where s.source in ('seed-person','seed-web') and s.kind = 'syn'
      and s.term !~ '님$'
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
  ),
  direct as (
    select s.term, min(s.kind) as kind, s.tn,
           round(max(s.m * 10 + s.w + case when s.day is not null and s.day >= current_date - 365 then 0.5 else 0 end), 3) as weight
    from scored s, q
    where s.m > 0 and length(s.tn) >= 2 and s.tn <> q.qn and s.tn not in (select w from stop)
      and s.tn !~ '(님의|님과|님이|님은|님을|님도|에서|으로|까지|부터|들의|들이|들은|들을|이서|에게|한테|처럼|보다|마다|조차|밖에)$'
      and not exists (
        select 1 from cand c2 where public.search_norm(c2.term) = substr(s.tn, 1, length(s.tn) - 1) and length(s.tn) >= 3
      )
    group by s.term, s.tn
  ),
  -- 씨앗: 질의 자체(완성어면) + 앞글자 상위 3개 — 이들의 이웃이 2순위 후보
  seeds as (
    select q.qn as tn from q
    union
    select d.tn from (select tn from direct order by weight desc limit 3) d
  ),
  related as (
    select case when r.a = sd.tn then r.b else r.a end as tn,
           (r.ppmi * ln(1 + r.co_docs) * (0.4 + 0.6 * exp(-greatest(0, current_date - coalesce(r.last_day, current_date))::numeric / 365.0)))::numeric as score
    from seeds sd
    join public.search_term_relations r on r.a = sd.tn or r.b = sd.tn
    where r.co_docs >= 4
    union all
    select s.alt, 6.0::numeric from seeds sd join public.search_synonyms s on s.term = sd.tn and s.kind in ('syn', 'rel')
      and s.source not in ('auto-rel')
  ),
  -- 관련어 2순위 불용어: 채팅에서 온 부사·대명사·추임새(역시·많이·사실·그럼·이건·일단…)는 관련어가 못 된다
  rel_stop as (
    select unnest(array['역시','많이','사실','그럼','이건','일단','토리가','반응','소감','획득','가리','그거','저거','이거','이렇게','그렇게',
      '아마','약간','조금','이미','거의','정말로','솔직히','어제','나중','먼저','저번','처음','마지막','하나','뭔가','뭐지','벌써','항상','가끔',
      '자주','매일','완전','엄청','되게','살짝','그때','이때','여기','저기','거기','저희','자기','본인','사람','분들','님들','이유','때문','정도',
      '느낌','생각','얘기','말씀','부분','경우','상태','시작','종료','오늘도','내일도','이제야','그래도','근데요','그리고요','아니면','또는',
      '뭐야','아니','네네','넵','오케이','미쳤다','대박','레전드','인정','ㅇㅈ','ㄹㅇ','실화','개웃','존나','너무','진짜','정말',
      '뭔데','뭐냐','뭐지','뭐임','어떻게','언제','어디','누구','왜요','그게','이게','저게','이건','그건','저건','뭐가','뭘','뭐를',
      '몰라','논란','맞네','화이팅','파이팅','대음','김치','여없노밥','토리도','토리는','토리가','토리야','아니야','그래요','네요','ㅋㅋ','ㅎㅎ']) as w
  ),
  common_cap as (
    -- 너무 흔한 말(전체 문서의 12% 이상)은 무엇과도 '관련'이 아니다
    select 0.12 * max(docs) as cap from public.search_terms
  ),
  related_ok as (
    select r.tn, max(r.score) as score
    from related r, q
    where length(r.tn) >= 2 and r.tn <> q.qn
      and r.tn not in (select w from stop)
      and r.tn not in (select w from rel_stop)
      and coalesce((select t.docs from public.search_terms t where t.term = r.tn), 0) <= (select cap from common_cap)
      and (r.tn !~ '(게|히|로|서|다|요)$'
        or exists (select 1 from public.search_games g where g.norm = r.tn)
        or exists (select 1 from public.search_entities e where e.name = r.tn)
        or exists (select 1 from public.search_synonyms s where s.term = r.tn and s.source like 'seed%'))
      and r.tn not in (select tn from direct)
      -- 조사 붙은 꼴(이유가·드신·사진이): 마지막 글자를 뗀 말이 이미 단어면 굴절형으로 보고 뺀다
      and not exists (select 1 from public.search_terms t2 where t2.term = substr(r.tn, 1, length(r.tn) - 1) and length(r.tn) >= 3)
      and r.tn !~ '(님과|님의|님이|과|와|의|는|던|기|인줄|으나|는데|해서|이서|에서|으로|까지|부터|이고|하고|라고|다고|나요|네요|어요|아요|세요|봤어|했어|합니다|입니다|했다|한다|되는|있는|없는)$'
      and r.tn !~ '^[0-9]+$'
      and r.tn !~ '^(빅)?토리'   -- 토리님 호칭 굴절형은 관련어가 아니다
      and (r.tn in (select term from public.search_doc_words)
        or exists (select 1 from public.search_games g where g.norm = r.tn)
        or exists (select 1 from public.search_entities e where e.name = r.tn)
        or exists (select 1 from public.search_synonyms s where s.term = r.tn and s.source like 'seed%'))
    group by r.tn
  ),
  merged as (
    select d.term, d.kind, d.weight, 0 as tier from direct d
    union all
    -- 관련어의 표시명: 인물·게임이면 그 표기, 아니면 정규화 단어 그대로
    select coalesce((select e.display from public.search_entities e where e.name = ro.tn limit 1),
                    (select g.display from public.search_games g where g.norm = ro.tn limit 1), ro.tn) as term,
           case when exists (select 1 from public.search_entities e where e.name = ro.tn) then 'person'
                when exists (select 1 from public.search_games g where g.norm = ro.tn) then 'game'
                else 'related' end as kind,
           round(least(9.9, ro.score), 3) as weight, 1 as tier
    from related_ok ro
  )
  select m.term, m.kind, m.weight
  from merged m
  order by m.tier, m.weight desc, m.term
  limit greatest(1, least(coalesce(p_limit, 8), 20));
$$;
grant execute on function public.search_suggest(text, integer) to anon, authenticated;


select public.search_term_graph_rebuild();
select public.search_graph_rebuild();
