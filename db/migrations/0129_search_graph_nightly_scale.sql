-- 0129: 야간 말 그래프가 자라는 데이터에 죽지 않게 — 정수 키 집계 + 크론 statement_timeout + 놓치면 재시도.
--
-- 사고(2026-09-28 03:20 KST): `vic-search-graph`가 "canceling statement due to statement timeout"로 실패,
-- 검색 시트 '화제' 칩(search_trends)이 하루 굳었다. 실측(read-only, prod):
--   · 야간 전체 70→79초로 매일 늘다가 120초(세션 기본 statement_timeout)에 걸렸다. 채팅 단어 표가
--     0112 때 75만 → 133만 행(수집 크론이 5분마다 채움, 완료 152/388이라 앞으로 ~2배 더).
--   · 시간의 정체는 search_term_graph_rebuild의 동시등장 쌍 집계 하나: 1,760만 쌍을 텍스트 키
--     (a text, b text)로 hash aggregate → work_mem 2MB라 770MB 디스크 스필, 47초. 나머지 단계 다 합쳐 5초.
--   · 에러 메시지가 synonyms_rebuild를 가리킨 건 타이머가 그 단계에서 울렸을 뿐 — 예외 블록도 취소는 못 넘긴다.
--   · 낱말·문서를 정수 id로 바꿔 같은 집계: 47 → 27초(결과 동일). work_mem 96/256MB는 이 인스턴스에서
--     오히려 160~255초(0119의 관찰과 같음) — 기본값 유지.
-- 조치 세 겹:
--   1) search_term_graph_rebuild v3 — 낱말 id(int)·문서 id(int)로 쌍을 세고 마지막에 글자로 되돌린다.
--      id 순서 = 글자 순서(row_number over (order by w))라 a<b 관계·결과 표 내용은 그대로.
--      집계는 16조각(a % 16)으로 나눠 임시 파일 넘침을 1/16로 묶는다 — 손으로 돌린 첫 판이 정수 키만으로는
--      "No space left on device"(pgsql_tmp)로 죽었다. DB 601MB + WAL 336MB인 인스턴스라 디스크 여유가 얇다.
--   2) 크론 명령에 `set statement_timeout = '20min'`을 앞세운다. 함수 안 SET은 이미 켜진 타이머를 못
--      바꾼다(타이머는 문장 시작 시 무장) — 명령 문자열의 앞 문장이어야 다음 문장(select)에 먹는다.
--   3) 놓치면 재시도 — 05:20·07:20 KST에 search_graph_nightly_if_stale(): 오늘치 search_trends가 없을 때만 돈다.
-- 되돌리기: cron.unschedule('vic-search-graph-retry-1'/'-2'); 0119 함수 재적용.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0129_search_graph_nightly_scale.sql

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
    having count(*) >= 3;
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
  '말 그래프 재빌드(0079 → 0118/0119 → 0129 정수 키) — 제목·챕터·일정·채팅 낱말의 문서 빈도와 동시등장(PPMI).';

-- 놓친 밤을 메우는 문지기 — 오늘(KST) 계산된 search_trends가 없을 때만 야간 일괄을 다시 돈다.
-- (search_trending_rebuild가 표를 비우고 다시 채우므로 computed_at = 마지막 성공 시각.)
create or replace function public.search_graph_nightly_if_stale()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare last_kst date;
begin
  select max(computed_at at time zone 'Asia/Seoul')::date into last_kst from public.search_trends;
  if last_kst is not null and last_kst >= (now() at time zone 'Asia/Seoul')::date then
    raise notice 'search_graph_nightly_if_stale: fresh (%), skip', last_kst;
    return false;
  end if;
  raise notice 'search_graph_nightly_if_stale: stale (%), rerun', last_kst;
  perform public.search_graph_nightly();
  return true;
end;
$$;
comment on function public.search_graph_nightly_if_stale() is
  '야간 일괄 재시도 문지기(0129) — 오늘치 search_trends가 없으면 search_graph_nightly()를 다시 돈다. pg_cron이 부른다.';

revoke all on function public.search_graph_nightly_if_stale() from public, anon, authenticated;

-- 크론: 같은 이름으로 다시 부르면 일정·명령이 갱신된다(멱등). 명령 앞의 SET이 다음 문장의 타이머를 정한다.
select cron.schedule('vic-search-graph', '20 18 * * *',
  $cmd$set statement_timeout = '20min'; select public.search_graph_nightly();$cmd$);
-- 05:20 · 07:20 KST 재시도(= 20:20 · 22:20 UTC). 성공한 밤에는 문지기가 바로 돌아온다.
select cron.schedule('vic-search-graph-retry-1', '20 20 * * *',
  $cmd$set statement_timeout = '20min'; select public.search_graph_nightly_if_stale();$cmd$);
select cron.schedule('vic-search-graph-retry-2', '20 22 * * *',
  $cmd$set statement_timeout = '20min'; select public.search_graph_nightly_if_stale();$cmd$);
