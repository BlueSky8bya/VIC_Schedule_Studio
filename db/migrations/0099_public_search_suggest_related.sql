-- 0099: 검색어 제안을 유튜브식으로 — 앞글자 후보가 적어도 관련어(공출현 이웃·큐레이션 관련어)로 채워 늘 목록이 뜬다.
-- 소유자(2026-09-18): "단어를 치면 유튜브처럼 관련어가 항상 나오게". 앞글자/포함 일치(0096)가 1순위, 그 상위 후보들의
-- 이웃(search_term_relations, PPMI·최근성)과 동의어/관련어(search_synonyms syn·rel)가 2순위. 여전히 값싼 조회.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0099_public_search_suggest_related.sql

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
      '뭔데','뭐냐','뭐지','뭐임','어떻게','언제','어디','누구','왜요','그게','이게','저게','이건','그건','저건','뭐가','뭘','뭐를']) as w
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
