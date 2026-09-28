-- 0131: 관계 표(search_term_relations)도 읽히는 행만 — co_docs >= 4.
--
-- 0130과 같은 원칙(소유자 2026-09-28: 처음 분석할 때 필요한 것만 남기고 버려라). 관계 표는 오늘 채팅 백필로
-- 437K → 1,577K행(335MB, 가장 큰 표)이 됐는데, 읽는 곳은 둘뿐이고 둘 다 co_docs >= 4를 요구한다:
--   · 검색 제안 related(0111): `where r.co_docs >= 4`
--   · rel-chip 동의어 파생(0129 함수 끝): `ppmi >= 2 and co_docs >= 4`
-- co_docs = 3인 582K행은 한 번도 읽히지 않는다. 야간 집계의 having을 4로 올리고 기존 행을 지운다.
-- (ppmi >= 0.5 저장 문턱은 그대로.) 되돌리기: 0129 함수 재적용 — 다음 밤에 3짜리 쌍이 다시 채워진다.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0131_search_relations_floor.sql
-- 적용 뒤 별도로(트랜잭션 밖): vacuum full public.search_term_relations; — 2026-09-28 실행 11초, 335MB → 113MB.

create or replace function public.search_term_graph_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$

declare n_terms int; bucket int;
begin
  -- (work_mem 상향은 0119·0129 두 번 실측 모두 역효과 — 기본값을 쓴다.)
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

  -- 제목·챕터·일정에서 온 말만 따로(0105) — 제안의 관련어 2순위는 채팅에만 있는 말을 쓰지 않는다.
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

  -- 낱말 사전(문서 3개 이상) — 정수 id를 붙인다. id 순서 = 글자 순서라 아래 y.id > x.id가 곧 b > a(text).
  create temp table tmp_terms on commit drop as
  select row_number() over (order by w)::int as id, w as term, count(distinct doc)::int as docs, max(day) as last_day
  from tmp_tw group by w having count(distinct doc) >= 3;
  create unique index on tmp_terms (term);

  delete from public.search_terms;
  insert into public.search_terms (term, docs, last_day)
  select term, docs, last_day from tmp_terms;
  get diagnostics n_terms = row_count;

  -- 동시등장 쌍은 정수로만 센다(0129): (doc int, term int). 텍스트 키 hash aggregate가 디스크로 넘치던 것이
  -- 8바이트 키로 줄어 같은 결과를 절반 시간에 낸다. tmp_pwi는 (d, w)가 유일 → count(*) = 문서 수.
  create temp table tmp_pwi on commit drop as
  select dense_rank() over (order by t.doc)::int as d, s.id as w, t.day
  from tmp_tw t join tmp_terms s on s.term = t.w;
  create index on tmp_pwi (d, w);
  analyze tmp_pwi;

  -- 쌍 집계는 16조각으로 나눠 돈다(a의 id % 16). 한 번에 다 세면 hash aggregate가 수백 MB를 디스크에
  -- 쏟는데(2026-09-28 실측 770MB), 이 인스턴스는 디스크 여유가 그만큼 없어 "No space left on device"로
  -- 죽었다. 조각마다 그룹이 1/16이라 넘침이 1/16이고, 조각이 끝나면 임시 파일이 바로 돌아온다.
  -- last_day = 이 쌍이 마지막으로 같이 나온 날(0119와 같은 뜻).
  create temp table tmp_pairs (a int, b int, co int, last_day date) on commit drop;
  for bucket in 0..15 loop
    insert into tmp_pairs (a, b, co, last_day)
    select x.w, y.w, count(*)::int, max(x.day)
    from tmp_pwi x
    join tmp_pwi y on y.d = x.d and y.w > x.w
    where x.w % 16 = bucket
    group by 1, 2
    having count(*) >= 4; -- 0131: 읽는 쪽 최소 co_docs가 4 — 3짜리 쌍은 저장해도 아무도 안 읽는다
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
  '말 그래프 재빌드(0079 → 0118/0119 → 0129 정수 키 → 0131 co_docs≥4) — 제목·챕터·일정·채팅 낱말의 문서 빈도와 동시등장(PPMI).';

-- 기존 행 일괄 정리(멱등). 지운 자리는 다음 밤 insert가 재사용한다(plain vacuum).
delete from public.search_term_relations where co_docs < 4;
