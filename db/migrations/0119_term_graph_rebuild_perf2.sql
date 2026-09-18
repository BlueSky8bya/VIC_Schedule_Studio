-- 0119: 말 그래프 재빌드 2차 — 동시등장 집계에서 쓸데없는 일을 뺀다.
--
-- 0118(재료 먼저 줄이기 + 인덱스)로 98.5 → 85초였다. 남은 비용의 정체는 쌍 4,577,925개를 묶는
-- 집계 자체였다(문서 922개, 한 문서 최대 낱말 523개).
--   · count(distinct x.doc) → count(*): tmp_pw는 (doc, w)가 유일해 한 문서에서 같은 쌍이 두 번 나올 수
--     없다. 값은 같고, 그룹마다 돌던 distinct 정렬이 통째로 사라진다.
--   · least/greatest 제거: 조인 조건이 y.w > x.w라 x.w가 늘 작은 쪽이다 — 함수 호출 9백만 번이 공짜로 없어진다.
-- (work_mem 상향은 실측 후 철회 — 이 인스턴스에서는 오히려 5분을 넘겼다.)
-- 결과 테이블 내용은 그대로. 멱등.
-- 적용: node scripts/apply-db.mjs db/migrations/0119_term_graph_rebuild_perf2.sql

create or replace function public.search_term_graph_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$

declare n_terms int;
begin
  -- (work_mem을 256MB로 올려 봤다가 되돌림 — 이 인스턴스에서는 5분을 넘겨 오히려 훨씬 느려졌다.
  --  해시 집계가 커지면 메모리 압박이 병렬 작업자마다 곱해진다. 기본값을 쓴다.)
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
  -- 아래 동시등장 자기조인(doc 기준)이 중첩 반복으로 떨어지지 않게 인덱스·통계를 준다(0118).
  create index on tmp_tw (doc);
  analyze tmp_tw;

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

  -- 동시등장 쌍은 **search_terms에 남은 낱말**(문서 3개 이상)로만 만든다(0118).
  -- 예전에는 tmp_tw 전체를 자기조인한 뒤 where로 걸렀는데, 조인이 먼저라 문서 하나에 낱말이 k개면
  -- k²/2 쌍을 다 만들고 나서 버렸다 — 이 함수가 98초를 쓰던 이유. 먼저 줄이고 조인한다.
  create temp table tmp_pw on commit drop as
  select t.doc, t.w, t.day from tmp_tw t join public.search_terms s on s.term = t.w;
  create index on tmp_pw (doc);
  analyze tmp_pw;

  delete from public.search_term_relations;
  with n as (select greatest(1, count(distinct doc))::numeric as total from tmp_tw),
  pairs as (
    -- y.w > x.w라 x.w가 항상 작은 쪽 — least/greatest는 하는 일 없이 함수 호출만 4백만 번이었다(0119).
    -- tmp_pw는 (doc, w)가 유일하므로 한 문서에서 같은 쌍이 두 번 나올 수 없다 →
    -- count(distinct x.doc)는 count(*)와 같은 값이고, 그룹마다 도는 distinct 정렬이 사라진다.
    select x.w as a, y.w as b, count(*)::int as co, max(x.day) as last_day
    from tmp_pw x
    join tmp_pw y on y.doc = x.doc and y.w > x.w
    group by 1, 2
    having count(*) >= 3
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
comment on function public.search_term_graph_rebuild() is
  '말 그래프 재빌드(0079 → 0118/0119 성능) — 제목·챕터·일정·채팅 낱말의 문서 빈도와 동시등장(PPMI).';
