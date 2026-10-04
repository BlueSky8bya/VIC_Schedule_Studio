-- 0137: 관계 표 재빌드를 '옆 표에 짓고 이름 맞바꾸기'로 — 밤 재빌드 중에도 검색이 막히지 않게.
--
-- 0136의 truncate는 부풀림을 없앴지만, truncate 잠금이 야간 일괄 트랜잭션 끝까지(그래프 → 줄임말 → 화제)
-- 이어져 그동안 관련어·검색 제안이 기다리다 실패할 수 있었다(anon statement_timeout 3초).
--   · 재빌드는 search_term_relations_next(아무도 안 읽는 옆 표)를 truncate하고 채운다.
--   · 야간 일괄의 맨 끝에서 search_term_relations_swap()이 두 표 이름을 맞바꾸고, 옛 표를 truncate한다.
--     이름 바꾸기 잠금은 곧바로 커밋까지라 몇 ms. lock_timeout 5초 — 못 잡으면 바꾸지 않고 하루 옛 데이터 유지.
--   · 옆 표가 비어 있으면 바꾸지 않는다(재빌드 실패 시 빈 표가 공개되는 것 방지).
--   · 두 표는 권한·RLS 정책이 같아야 한다(맞바꾸면 서로 역할이 바뀐다). 인덱스 이름은 바뀔 때마다 엇갈린다 — 이름으로 참조하는 곳 없음.
--   · 표를 직접 읽는 곳은 search_related_terms·search_suggest(language sql, 호출마다 이름으로 찾는다)뿐, REST 직접 조회 없음.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0137_search_relations_swap.sql

create table if not exists public.search_term_relations_next (like public.search_term_relations including all);
alter table public.search_term_relations_next enable row level security;
drop policy if exists search_term_relations_next_public_read on public.search_term_relations_next;
create policy search_term_relations_next_public_read on public.search_term_relations_next for select to anon, authenticated using (true);
grant select on public.search_term_relations_next to anon, authenticated;
grant select, insert, update, delete on public.search_term_relations_next to service_role;

create or replace function public.search_term_relations_swap()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.search_term_relations_next) then
    raise warning 'search_term_relations_swap: next is empty, keeping current';
    return false;
  end if;
  set local lock_timeout = '5s';
  alter table public.search_term_relations rename to search_term_relations_old;
  alter table public.search_term_relations_next rename to search_term_relations;
  alter table public.search_term_relations_old rename to search_term_relations_next;
  truncate public.search_term_relations_next;
  return true;
end;
$$;
revoke all on function public.search_term_relations_swap() from public, anon, authenticated;
comment on function public.search_term_relations_swap() is
  '관계 표 맞바꾸기(0137) — search_graph_nightly 맨 끝에서만 부른다. 커밋까지 잠금이 이어지므로 뒤에 무거운 일을 두지 말 것.';

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

  -- (0137) 옆 표에 짓는다 — 공개는 search_graph_nightly 끝의 search_term_relations_swap()이 한다.
  -- (0136) delete 대신 truncate — delete+insert는 같은 트랜잭션에서 빈자리를 못 써서 표가 매일 밤 두 배로 부푼다.
  truncate public.search_term_relations_next;
  with n as (select greatest(1, count(distinct doc))::numeric as total from tmp_tw),
  scored as (
    select ta.term as a, tb.term as b, p.co, p.last_day,
      greatest(0, ln((p.co::numeric * n.total) / (ta.docs::numeric * tb.docs::numeric)))::numeric as ppmi
    from tmp_pairs p
    join tmp_terms ta on ta.id = p.a
    join tmp_terms tb on tb.id = p.b, n
  ),
  -- 읽는 쪽(search_related_terms·search_suggest)과 같은 점수
  sc as (
    select a, b, co, ppmi, last_day,
      ppmi * ln(1 + co) * (0.4 + 0.6 * exp(-greatest(0, current_date - coalesce(last_day, current_date))::numeric / 365.0)) as s
    from scored where ppmi >= 0.5
  ),
  -- (0136) 낱말마다 상위 60 이웃 + 제안에 나올 수 있는 이웃 상위 60만 — 읽는 쪽은 많아야 30개를 보여 준다.
  -- 어느 한쪽 끝에서라도 순위 안이면 남긴다.
  ends as (
    select a, b, a as t, b as o, s from sc
    union all
    select a, b, b as t, a as o, s from sc
  ),
  ranked as (
    select a, b, s, t, (o in (select term from public.search_term_rel_eligible())) as el from ends
  ),
  keep as (
    select distinct a, b from (
      select a, b, el,
        row_number() over (partition by t order by s desc, a, b) as rn,
        row_number() over (partition by t, el order by s desc, a, b) as rn_el
      from ranked
    ) r where rn <= 60 or (el and rn_el <= 60)
  )
  insert into public.search_term_relations_next (a, b, co_docs, ppmi, last_day)
  select sc.a, sc.b, sc.co, sc.ppmi, sc.last_day from sc join keep k on k.a = sc.a and k.b = sc.b;

  -- (0132) auto-rel / rel-chip 동의어 파생은 없앴다 — 읽는 곳이 없다. 관계 표가 곧 그 정보다.
  return n_terms;
end;

$$;
comment on function public.search_term_graph_rebuild() is
  '말 그래프 재빌드(0079 → 0118/0119 → 0129 정수 키 → 0131 co_docs≥4 → 0132 rel-chip 파생 제거 → 0136 낱말당 상위 60 → 0137 옆 표에 짓기, 공개는 search_term_relations_swap) — 제목·챕터·일정·채팅 낱말의 문서 빈도와 동시등장(PPMI).';

create or replace function public.search_graph_nightly()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare t0 timestamptz; n int; graph_ok boolean := false;
begin
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
comment on function public.search_graph_nightly() is
  '말 그래프·줄임말·요즘 말 야간 일괄(0120) — pg_cron이 부른다. HTTP 크론에서 부르지 말 것(60초 한도 초과).';

-- 지금 바로 한 번: 옆 표에 짓고 맞바꾼다(2026-10-05 실측 약 1분 20초).
set statement_timeout = '20min';
select public.search_term_graph_rebuild();
select public.search_term_relations_swap();
