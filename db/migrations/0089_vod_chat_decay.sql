-- 0089: 채팅 학습 손질 — 이모티콘 제외 + 옛 방송 은어의 시간 감쇠.
--
-- 소유자(2026-09-18): "요즘 태그에 /빅하/ 같은 이모티콘류는 적용하지 마(영양가 없음)",
-- "옛날 VOD 유행어는 사장되어 가는 말일 수 있으니 고려해라".
--  1) 이모티콘("/…/") 행을 지우고, 수집기(vod-chat.ts)도 더는 넣지 않는다. 트렌딩 정규식에서도 뺀다.
--  2) 단어 관계에 last_day(마지막 공출현 날)를 두고 관련어 점수에 감쇠(1년에 약 0.62배, 바닥 0.4)를 곱한다.
--     자동 관련어 칩(auto-rel)은 18개월 안에 같이 나온 적이 있어야 한다.
--  3) 채팅 기반 줄임말 채굴·그래프 합류는 18개월 안 방송의 채팅만 쓴다(제목·챕터는 기간 제한 없음 — 검색 대상 그 자체).
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0089_vod_chat_decay.sql

delete from public.vod_chat_terms where term like '/%/';

alter table public.search_term_relations add column if not exists last_day date;

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
      '지금','아직','계속','다들','모두','여러분','안녕','감사','합니다','입니다','타임라인','챕터','종료~','등장']) as w
  ),
  words as (
    select doc, day,
      case when lower(x) ~ '님$' then regexp_replace(lower(x), '님$', '') else lower(x) end as w
    from docs, regexp_split_to_table(txt, '[^가-힣a-zA-Z0-9]+') as x
    where x ~ '^[가-힣]{2,6}$' or x ~* '^[a-z0-9]{3,12}$'
    union all
    -- 채팅 단어(방송당 3회 이상, 이모티콘 제외) — 18개월 안 방송만(사장된 은어가 그래프를 끌지 않게)
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

-- 관련어 조회: 마지막 공출현이 오래될수록 점수 감쇠(1년 지나면 약 0.62배, 바닥 0.4).
create or replace function public.search_related_terms(p_q text, p_limit integer default 8)
returns table (term text, co_docs integer, score numeric, kind text)
language sql
stable
security definer
set search_path = public
as $$
  with q as (select public.search_norm(p_q) as qn),
  mine as (
    select q.qn as t from q
    union
    select s.alt from public.search_synonyms s, q where s.term = q.qn and s.kind = 'syn'
  ),
  curated as (
    select s.alt as term, 9999 as co_docs, 100::numeric as score, 'rel'::text as kind
    from public.search_synonyms s, q where s.term = q.qn and s.kind = 'rel'
  ),
  neigh as (
    select case when r.a = m.t then r.b else r.a end as term, r.co_docs,
           (r.ppmi * ln(1 + r.co_docs)
             * (0.4 + 0.6 * exp(-greatest(0, current_date - coalesce(r.last_day, current_date))::numeric / 365.0)))::numeric as score,
           'auto'::text as kind
    from mine m
    join public.search_term_relations r on r.a = m.t or r.b = m.t
  ),
  allrows as (
    select * from curated
    union all
    select * from neigh
  )
  select a.term, max(a.co_docs)::int as co_docs, round(max(a.score), 3) as score, min(a.kind) as kind
  from allrows a
  where a.term not in (select t from mine)
    and a.term not in (select e.name from public.search_entities e)
    and (a.kind = 'rel' or (
      a.co_docs >= 4
      and a.term !~ '(님과|님의|과|와|의|는|던|기|인줄|으나|는데|해서|이서|에서|으로|까지|부터|이고|하고|라고|다고|나요|네요|어요|아요|세요|봤어|했어|합니다|입니다|했다|한다|되는|있는|없는)$'
      and a.term !~ '^(일부|근황|확인|컨텐츠|게임|시작|종료|오늘|내일|이어서|다시|이제|그냥|정말|진짜)$'
    ))
  group by a.term
  order by max(a.score) desc, max(a.co_docs) desc
  limit greatest(1, least(coalesce(p_limit, 8), 30));
$$;

-- 줄임말 자동 채굴: 채팅 쪽은 18개월 안 방송만.
create or replace function public.search_synonyms_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare added int;
begin
  delete from public.search_synonyms where source = 'auto';
  with tw as (
    select v.title_no, lower(x) as w
    from public.vod_archive v, regexp_split_to_table(v.title, '[^가-힣a-zA-Z0-9]+') as x
    where length(x) >= 4 and length(x) <= 14
  ),
  cw as (
    select distinct c.title_no, lower(x) as s
    from public.vod_chapter_index c, regexp_split_to_table(c.label, '[^가-힣a-zA-Z0-9]+') as x
    where length(x) between 2 and 3 and x ~ '^[가-힣]+$'
    union
    select t.title_no, t.term
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no
    where t.cnt >= 5 and length(t.term) between 2 and 3 and t.term ~ '^[가-힣]+$'
      and v.broadcast_day >= current_date - interval '540 days'
  ),
  pairs as (
    select cw.s, tw.w, count(distinct tw.title_no) as n
    from cw join tw on tw.title_no = cw.title_no
    where substr(tw.w, 1, 1) = substr(cw.s, 1, 1)
      and public.search_abbrev_match(cw.s, tw.w)
      and not exists (select 1 from public.search_synonyms x where x.term = cw.s and x.alt = tw.w)
    group by cw.s, tw.w
    having count(distinct tw.title_no) >= 3
  ),
  ins as (
    insert into public.search_synonyms (term, alt, source, support)
    select s, w, 'auto', n from pairs
    union all
    select w, s, 'auto', n from pairs
    on conflict (term, alt) do nothing
    returning 1
  )
  select count(*) into added from ins;
  return added;
end;
$$;

-- 트렌딩: 이모티콘 제외(한글 단어만).
create or replace function public.search_trending(p_days integer default 30, p_limit integer default 10)
returns table (term text, recent integer, ratio numeric)
language sql
stable
security definer
set search_path = public
as $$
  with docs as (
    select v.broadcast_day as day, v.title as txt from public.vod_archive v where v.auth_no = 101
    union all
    select v.broadcast_day, c.label from public.vod_chapter_index c join public.vod_archive v on v.title_no = c.title_no and v.auth_no = 101
  ),
  words as (
    select day, lower(x) as w, 1 as n
    from docs, regexp_split_to_table(txt, '[^가-힣a-zA-Z0-9]+') as x
    where x ~ '^[가-힣]{2,6}$'
    union all
    select v.broadcast_day, t.term, least(t.cnt, 30)
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no = 101
    where t.term ~ '^[가-힣]{2,6}$'
  ),
  stop as (
    select unnest(array['토리님','토리','빅토리','빅토리님','방송','시작','종료','오늘','내일','시간','잠깐','다시','이야기','토리가','우리','그냥','정말','진짜','후열','엔딩','멘트','휴식','시청자','새로운','요즘','오늘도','이번','다음','처음','마지막','드디어','바로',
      'ㅋㅋㅋ','ㅋㅋ','ㅠㅠ','ㅎㅎ','아니','근데','뭐야','진짜','대박','와우','헐','오오','ㄷㄷ','ㄹㅇ','ㅇㅇ','ㄴㄴ','ㅇㅋ','ㄱㄱ','ㅈㅈ']) as w
  ),
  recent as (
    select w, sum(n)::int as n from words
    where day >= current_date - make_interval(days => greatest(1, coalesce(p_days, 30)))
      and w not in (select w from stop)
    group by w
  ),
  prior as (
    select w, sum(n)::numeric as n from words
    where day < current_date - make_interval(days => greatest(1, coalesce(p_days, 30)))
      and day >= current_date - make_interval(days => greatest(1, coalesce(p_days, 30)) + 180)
    group by w
  )
  select r.w as term, r.n as recent,
         round((r.n::numeric / greatest(1, coalesce(p.n, 0) * (greatest(1, coalesce(p_days, 30))::numeric / 180.0)))::numeric, 2) as ratio
  from recent r
  left join prior p on p.w = r.w
  where r.n >= 3
  order by ratio desc, r.n desc
  limit greatest(1, least(coalesce(p_limit, 10), 30));
$$;

select public.search_term_graph_rebuild();
select public.search_synonyms_rebuild();
