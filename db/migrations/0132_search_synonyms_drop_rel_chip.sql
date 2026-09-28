-- 0132: 아무도 안 읽는 자동 관련어 칩(auto-rel / rel-chip) 동의어 행을 더 만들지 않고 지운다.
--
-- 0130·0131과 같은 원칙(소유자 2026-09-28: 읽히는 것만 저장). search_synonyms 312K행 중 308K행이
-- source='auto-rel', kind='rel-chip'인데 읽는 곳이 없다(2026-09-28 전수 확인):
--   · 공개 검색 RPC(0117): 동의어는 kind='syn', 관련어는 kind='rel'만 읽는다 — 'rel-chip'은 안 잡힌다.
--   · 검색 제안 related(0111): `s.source not in ('auto-rel', …)`로 명시 제외.
--   · search_related_terms(0089)·search_related(0104): 관계 표(search_term_relations)를 직접 읽는다.
-- 이 행들은 관계 표(ppmi>=2 ∧ co_docs>=4)의 양방향 사본일 뿐이라 언제든 다시 만들 수 있다.
-- 야간 재빌드에서 그 파생 단계를 뺀다(함수 본문은 0131과 같고 마지막 블록만 없다).
-- 되돌리기: 0131 함수 재적용 → 다음 밤에 다시 채워진다.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0132_search_synonyms_drop_rel_chip.sql
-- 적용 뒤 별도로(트랜잭션 밖): vacuum full public.search_synonyms;

create or replace function public.search_term_graph_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$

declare n_terms int; bucket int;
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
  create index on tmp_tw (doc);
  analyze tmp_tw;

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

  create temp table tmp_terms on commit drop as
  select row_number() over (order by w)::int as id, w as term, count(distinct doc)::int as docs, max(day) as last_day
  from tmp_tw group by w having count(distinct doc) >= 3;
  create unique index on tmp_terms (term);

  delete from public.search_terms;
  insert into public.search_terms (term, docs, last_day)
  select term, docs, last_day from tmp_terms;
  get diagnostics n_terms = row_count;

  create temp table tmp_pwi on commit drop as
  select dense_rank() over (order by t.doc)::int as d, s.id as w, t.day
  from tmp_tw t join tmp_terms s on s.term = t.w;
  create index on tmp_pwi (d, w);
  analyze tmp_pwi;

  create temp table tmp_pairs (a int, b int, co int, last_day date) on commit drop;
  for bucket in 0..15 loop
    insert into tmp_pairs (a, b, co, last_day)
    select x.w, y.w, count(*)::int, max(x.day)
    from tmp_pwi x
    join tmp_pwi y on y.d = x.d and y.w > x.w
    where x.w % 16 = bucket
    group by 1, 2
    having count(*) >= 4;
  end loop;

  delete from public.search_term_relations;
  with n as (select greatest(1, count(distinct doc))::numeric as total from tmp_tw),
  scored as (
    select ta.term as a, tb.term as b, p.co, p.last_day,
      greatest(0, ln((p.co::numeric * n.total) / (ta.docs::numeric * tb.docs::numeric)))::numeric as ppmi
    from tmp_pairs p
    join tmp_terms ta on ta.id = p.a
    join tmp_terms tb on tb.id = p.b, n
  )
  insert into public.search_term_relations (a, b, co_docs, ppmi, last_day)
  select a, b, co, ppmi, last_day from scored where ppmi >= 0.5;

  -- (0132) auto-rel / rel-chip 동의어 파생은 없앴다 — 읽는 곳이 없다. 관계 표가 곧 그 정보다.
  return n_terms;
end;

$$;
comment on function public.search_term_graph_rebuild() is
  '말 그래프 재빌드(0079 → 0118/0119 → 0129 정수 키 → 0131 co_docs≥4 → 0132 rel-chip 파생 제거) — 제목·챕터·일정·채팅 낱말의 문서 빈도와 동시등장(PPMI).';

delete from public.search_synonyms where source = 'auto-rel';
