-- 0115: 은어 사전 초안이 열리는 데 ~29초 걸리던 것을 고친다(2026-09-19 소유자 "엄청 오래 걸린다").
--
-- 원인(EXPLAIN ANALYZE 실측): 후보를 걸러 내는 두 조건이
--     not exists (select 1 from search_synonyms s where s.term = X or s.alt = X)
-- 꼴이라 **OR 때문에 인덱스를 못 쓴다**. search_synonyms는 87,950행이고 후보가 1,927개였으니
-- 조건 둘을 합쳐 3억 행 남짓을 훑었다 — 전체 41초 중 37초가 이 두 Nested Loop Anti Join.
--
-- 고침: 동의어의 term·alt를 **한 번만** 모은 집합(known_syn)을 만들고 동등 비교 한 번으로 바꾼다.
-- 인물·제목/챕터 낱말까지 합친 known_all도 같은 방식. 집합은 materialized라 한 번만 만들어지고,
-- 비교가 등호라 해시 안티조인이 된다. 의미는 그대로다:
--   · 사전(동의어 양쪽)·인물·제목/챕터 낱말에 있으면 후보 아님
--   · "○○님" 꼴이 사전에 있으면 후보 아님(이 검사는 예전처럼 **동의어만** 본다)
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0115_dictionary_draft_perf.sql

create or replace function public.search_dictionary_draft(p_limit integer default 200)
returns table (term text, vods integer, total bigint, first_day date, last_day date, samples text[], note text)
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select c.term, count(distinct c.title_no)::int as vods, sum(c.cnt)::bigint as total,
           min(v.broadcast_day) as first_day, max(v.broadcast_day) as last_day
    from public.vod_chat_terms c
    join public.vod_archive v on v.title_no = c.title_no and v.auth_no = 101
    where v.broadcast_day >= current_date - interval '540 days'
      and c.term ~ '^[가-힣]{2,6}$' and c.cnt >= 2
    group by c.term
    having count(distinct c.title_no) >= 2 and sum(c.cnt) >= 10
  ),
  docs_words as (
    select distinct lower(x) as w
    from (
      select v.title as txt from public.vod_archive v where v.auth_no = 101
      union all
      select c.label from public.vod_chapter_index c
    ) d, regexp_split_to_table(d.txt, '[^가-힣a-zA-Z0-9]+') as x
  ),
  -- 동의어에 등장하는 모든 말(양쪽 컬럼) — 한 번만 모아 해시로 견준다.
  known_syn as materialized (
    select s.term as w from public.search_synonyms s
    union
    select s.alt from public.search_synonyms s
  ),
  -- 사전·인물·제목/챕터 낱말을 합친 '이미 아는 말'.
  known_all as materialized (
    select w from known_syn
    union
    select e.name from public.search_entities e
    union
    select w from docs_words
  )
  select t.term, t.vods, t.total, t.first_day, t.last_day,
    (select array_agg(v.title order by c.cnt desc)
       from (select c.title_no, c.cnt from public.vod_chat_terms c where c.term = t.term order by c.cnt desc limit 2) c
       join public.vod_archive v on v.title_no = c.title_no) as samples,
    n.note
  from t
  left join public.search_dictionary_notes n on n.term = t.term
  where coalesce(n.ignored, false) = false
    and not exists (select 1 from known_all k where k.w = t.term)
    and not exists (select 1 from known_syn k where k.w = t.term || '님')
  order by t.last_day desc, t.total desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;
comment on function public.search_dictionary_draft(integer) is
  '은어 사전 초안(0090 → 0115 성능) — 채팅에서 새로 배운 말 중 사전·인물·제목에 없는 것. 개발자 전용.';
grant execute on function public.search_dictionary_draft(integer) to service_role;

-- search_synonyms.alt 단독 조회용 인덱스 — pkey는 (term, alt)라 alt만 찾을 땐 못 쓴다.
-- 위 집합 방식이 주경로지만, 다른 곳(동의어 되짚기)에서도 alt 단독 조회가 쓰인다.
create index if not exists idx_search_synonyms_alt on public.search_synonyms (alt);
