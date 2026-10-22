-- 0156: 구독·구독+ 영상을 일반 다시보기와 같은 파이프라인(채팅 분석·팬 타임라인·검색)에 태운다 (2026-10-23 소유자).
--
-- 1) 업로드 영상(숲 '구독' 배지)을 vod_archive로 합친다: upload=true 행(guest 행과 같은 방식의 '방송 아닌 행').
--    0155의 별도 표(vod_upload)는 검색·타임라인 말뭉치가 전부 vod_archive를 읽어 합류가 어려웠다 — 데이터만 옮기고
--    표 삭제는 앱 배포 뒤 0157에서(배포 중인 앱이 아직 vod_upload를 읽는다).
-- 2) 공개 읽기·검색·채팅 분석의 auth_no=101 문을 101·107로 넓힌다. 숲이 로그인 없이 내주는 메타·댓글·채팅이다.
-- 3) 방송이 아닌 행(upload)은 방송 시간 통계·전체 스윕 삭제·채팅 큐·트렌드 '최근 방송일'에서 뺀다(guest와 같은 자리).
-- 함수 본문은 운영 DB의 현재 정의(pg_get_functiondef, 2026-10-23)에서 위 치환만 한 것이다. 권한은 create or replace가 유지한다.
-- Rollback: 0156 이전 정의로 함수·정책을 되돌리고(101), upload 행을 지운 뒤 열을 지운다. 멱등.
begin;

alter table public.vod_archive add column if not exists upload boolean not null default false;
comment on column public.vod_archive.upload is
  '숲 업로드 영상(file_type NORMAL, 0156) — 방송 다시보기가 아님. 방송 통계·스윕 삭제·채팅 큐에서 제외.';

insert into public.vod_archive (title_no, bno, broadcast_day, title, duration_ms, reg_date, auth_no, thumb, upload, guest, synced_at)
select u.title_no, null, u.upload_day, u.title, u.duration_ms, u.reg_date, u.auth_no, u.thumb, true, false, u.synced_at
from public.vod_upload u
on conflict (title_no) do nothing;

alter policy vod_timeline_public_read on public.vod_timeline
  using (exists (select 1 from public.vod_archive v where v.title_no = vod_timeline.title_no and v.auth_no in (101, 107)));
alter policy vod_chapter_index_public_read on public.vod_chapter_index
  using (exists (select 1 from public.vod_archive v where v.title_no = vod_chapter_index.title_no and v.auth_no in (101, 107)));

-- search_person_mentions()
CREATE OR REPLACE FUNCTION public.search_person_mentions()
 RETURNS TABLE(doc text, day date, is_hap boolean, name text, display text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with stop as (
    select unnest(array['여러분','시청자','구독자','팬','팬치','팬분','회원','선생','고객','너희','우리','저희','자기','손','형','누나','언니','오빠','님']) as w
  ),
  raw as (
    select 'v:' || v.title_no as doc, v.broadcast_day as day,
           v.title ~* '합방|콜라보|w\.|with' as is_hap,
           m[1] as disp
    from public.vod_archive v, regexp_matches(v.title, '([가-힣a-zA-Z0-9]{1,8})님', 'g') as m
    where v.auth_no in (101, 107)
    union all
    select 'v:' || c.title_no, v.broadcast_day,
           v.title ~* '합방|콜라보|w\.|with',
           m[1]
    from public.vod_chapter_index c
    join public.vod_archive v on v.title_no = c.title_no and v.auth_no in (101, 107),
    regexp_matches(c.label, '([가-힣a-zA-Z0-9]{1,8})님', 'g') as m
    union all
    select 'e:' || e.id, e.date_key,
           (e.public_title || ' ' || coalesce(e.public_description, '')) ~* '합방|콜라보|w\.|with',
           m[1]
    from public.events e,
    regexp_matches(e.public_title || ' ' || coalesce(e.public_description, ''), '([가-힣a-zA-Z0-9]{1,8})님', 'g') as m
    where e.deleted_at is null and e.visibility_scope = 'public' and e.status <> 'draft'
      and not (coalesce(e.teaser, false) and e.teaser_reveal_at is not null and e.teaser_reveal_at > now())
  ),
  norm as (
    select doc, day, is_hap, public.search_norm(disp) as name, disp as display from raw
  ),
  chat as (
    -- 채팅 방문: 인사 5회 이상 또는 이름 8회 이상, 18개월 안 방송만(0089 감쇠 규칙과 같은 창)
    select 'v:' || p.title_no as doc, v.broadcast_day as day, false as is_hap, p.name,
           coalesce((select e.display from public.search_entities e where e.name = p.name), p.name) as display
    from public.vod_chat_people p
    join public.vod_archive v on v.title_no = p.title_no and v.auth_no in (101, 107)
    where (p.greetings >= 5 or p.mentions >= 8)
      and v.broadcast_day >= current_date - interval '540 days'
  )
  select doc, day, is_hap, name, display from norm
  where length(name) >= 2 and name not in (select w from stop) and name !~ '^[0-9]+$'
  union all
  select doc, day, is_hap, name, display from chat;
$function$;

-- search_term_graph_rebuild()
CREATE OR REPLACE FUNCTION public.search_term_graph_rebuild()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$

declare n_terms int; bucket int;
begin
  create temp table tmp_tw on commit drop as
  with docs as (
    select 'v:' || v.title_no as doc, v.broadcast_day as day, v.title as txt
    from public.vod_archive v where v.auth_no in (101, 107)
    union all
    select 'v:' || c.title_no, v.broadcast_day, c.label
    from public.vod_chapter_index c join public.vod_archive v on v.title_no = c.title_no and v.auth_no in (101, 107)
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
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no in (101, 107)
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
    select v.title as txt from public.vod_archive v where v.auth_no in (101, 107)
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

$function$;

-- search_graph_rebuild()
CREATE OR REPLACE FUNCTION public.search_graph_rebuild()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    join public.vod_archive v on v.title_no = p.title_no and v.auth_no in (101, 107)
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
$function$;

-- search_public(uuid,text,integer)
CREATE OR REPLACE FUNCTION public.search_public(p_calendar_id uuid, p_q text, p_limit integer DEFAULT 50)
 RETURNS TABLE(kind text, event_id uuid, title_no bigint, sec integer, date_key date, start_time time without time zone, title text, snippet text, duration_ms bigint, host_nick text, thumb text, score numeric, exact boolean, popularity numeric, section text, parent text, matched_on text, corrected text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with qc as materialized (
    -- 오타 교정(0086/0087): 질의가 사전에 없으면 가장 가까운 사전어로. 초성·한 글자·다단어는 교정 안 함.
    select
      public.search_norm(p_q) as qn0,
      case
        when public.search_norm(p_q) ~ '^[ㄱ-ㅎ]+$' or length(public.search_norm(p_q)) < 2 or p_q ~ '\s' then null
        when exists (select 1 from public.search_synonyms s where s.term = public.search_norm(p_q))
          or exists (select 1 from public.search_intents i where i.term = public.search_norm(p_q))
          or exists (select 1 from public.search_entities e where e.name = public.search_norm(p_q))
          or exists (select 1 from public.search_games g where g.norm = public.search_norm(p_q))
          -- 0098: 말뭉치에 이미 있는 말(그대로 또는 앞부분)은 교정하지 않는다 — "마비"가 '뮤비'로 바뀌어 마비노기를 못 찾던 사고
          or exists (select 1 from public.search_terms t where t.term like public.search_norm(p_q) || '%')
          or exists (select 1 from public.search_games g where g.norm like public.search_norm(p_q) || '%')
          or exists (select 1 from public.search_entities e where e.name like public.search_norm(p_q) || '%')
          or exists (select 1 from public.vod_archive v where v.auth_no in (101, 107) and public.search_norm(v.title) like '%' || public.search_norm(p_q) || '%')
          or exists (select 1 from public.vod_chapter_index c where c.label_norm like '%' || public.search_norm(p_q) || '%')
          or exists (select 1 from public.events e where e.deleted_at is null and e.visibility_scope = 'public'
                     and public.search_norm(e.public_title) like '%' || public.search_norm(p_q) || '%') then null
        else public.search_correct(public.search_norm(p_q))
      end as corr
  ),
  q0 as (
    select
      coalesce(qc.corr, qc.qn0) as qn,
      qc.corr as corrected,
      coalesce(qc.corr, qc.qn0) ~ '^[ㄱ-ㅎ]+$' as is_cho,
      (length(coalesce(qc.corr, qc.qn0)) >= 2
        or exists (select 1 from public.search_synonyms s where s.term = coalesce(qc.corr, qc.qn0))) as min_ok,
      case when qc.corr is not null then array[qc.corr] else array_remove(array(
        select public.search_norm(t) from regexp_split_to_table(coalesce(p_q, ''), '\s+') as t
        where length(public.search_norm(t)) >= 2
           or exists (select 1 from public.search_synonyms s where s.term = public.search_norm(t))
      ), '') end as toks
    from qc
  ),
  q1 as (
    select
      q0.qn, q0.is_cho, q0.toks, q0.min_ok, q0.corrected,
      case when q0.is_cho then array[q0.qn]
           when length(q0.qn) = 1 then array(select s.alt from public.search_synonyms s where s.term = q0.qn and s.kind = 'syn')
           else array_prepend(q0.qn, array(select s.alt from public.search_synonyms s where s.term = q0.qn and s.kind = 'syn')) end as alts,
      case when q0.is_cho then array[]::text[]
           else array(select s.alt from public.search_synonyms s where s.term = q0.qn and s.kind = 'rel') end as rels,
      case when q0.is_cho then q0.toks
           else array(
             select t.tok || coalesce('|' || string_agg(s.alt, '|'), '')
             from unnest(q0.toks) with ordinality as t(tok, ord)
             left join public.search_synonyms s on s.term = t.tok and s.kind = 'syn'
             group by t.tok, t.ord order by t.ord
           ) end as tokg,
      (not q0.is_cho and (
        exists (select 1 from public.search_intents i where i.intent = 'song' and (i.term = q0.qn or i.term = any(q0.toks)))
        or exists (select 1 from public.search_intents i join public.search_synonyms s on s.alt = i.term and s.kind = 'syn' where i.intent = 'song' and s.term = q0.qn)
      )) as song_intent,
      (not q0.is_cho and exists (select 1 from public.search_intents i where i.intent = 'dance' and (i.term = q0.qn or i.term = any(q0.toks)))) as dance_intent,
      (not q0.is_cho and exists (select 1 from public.search_intents i where i.intent = 'hum' and (i.term = q0.qn or i.term = any(q0.toks)))) as hum_intent,
      (not q0.is_cho and exists (select 1 from public.search_intents i where i.intent = 'minor_game' and (i.term = q0.qn or i.term = any(q0.toks)))) as game_intent,
      array(select t from unnest(q0.toks) t where not exists (
        select 1 from public.search_intents i
        where i.term = t or exists (select 1 from public.search_synonyms s where s.term = t and s.alt = i.term and s.kind = 'syn')
      )) as rest_toks,
      -- 장르 의도(0094): 질의(또는 토큰)가 장르어(공포·코옵·오픈월드·rpg…)이거나 그 동의어(공겜→공포)면 그 장르들.
      case when q0.is_cho then array[]::text[] else array(
        select distinct i.term from public.search_intents i
        where i.intent = 'genre' and (
          i.term = q0.qn or i.term = any(q0.toks)
          or exists (select 1 from public.search_synonyms s where s.alt = i.term and s.kind = 'syn' and (s.term = q0.qn or s.term = any(q0.toks)))
        )
      ) end as genre_terms
    from q0
  ),
  genre_games as (
    -- 그 장르에 속한 게임 이름 조각들의 정규식(정규화 문자열 위에서 부분 일치). 없으면 null.
    select case when count(*) = 0 then null else '(' || string_agg(g.game_re, '|') || ')' end as re
    from public.search_genres g, q1
    where g.genre = any(q1.genre_terms)
  ),
  games as (
    select '(' || string_agg(regexp_replace(g.norm, '([.^$|()\[\]{}*+?\\])', '\\\1', 'g'), '|') || ')' as re
    from public.search_games g where g.kind = 'minor' and length(g.norm) >= 3
  ),
  ev as (
    select
      e.id, e.date_key, e.start_time, e.public_title,
      coalesce(e.public_description, '') as descr,
      public.search_norm(e.public_title) as tn,
      public.search_norm(e.public_description) as dn,
      lower(e.public_title) as traw,
      lower(coalesce(e.public_description, '')) as draw,
      lower(coalesce((
        select string_agg(bt.display_name, ' ')
        from public.event_tags et join public.broadcast_tags bt on bt.id = et.tag_id
        where et.event_id = e.id
      ), '')) as graw,
      public.search_norm(coalesce((
        select string_agg(bt.display_name, ' ')
        from public.event_tags et join public.broadcast_tags bt on bt.id = et.tag_id
        where et.event_id = e.id
      ), '')) as tagn
    from public.events e
    where e.calendar_id = p_calendar_id
      and e.deleted_at is null
      and e.visibility_scope = 'public'
      and e.status <> 'draft'
      and not (coalesce(e.teaser, false) and e.teaser_reveal_at is not null and e.teaser_reveal_at > now())
  ),
  vods as (
    select
      v.title_no, v.broadcast_day, v.title, v.duration_ms, v.host_nick, v.thumb,
      v.read_cnt, v.like_cnt, v.comment_cnt,
      public.search_norm(v.title) as tn,
      coalesce(t.entry_count, 0) as entry_count
    from public.vod_archive v
    left join public.vod_timeline t on t.title_no = v.title_no
    where v.auth_no in (101, 107)
  ),
  corpus as (
    select case when q.is_cho then public.search_choseong(ev.tn || ev.tagn || ev.dn) else ev.tn || ev.tagn || ev.dn end as norm
    from ev, q1 q
    union all
    select case when q.is_cho then public.search_choseong(v.tn) else v.tn end from vods v, q1 q
    union all
    select case when q.is_cho then c.label_cho else c.label_norm || '|' || c.section_norm || '|' || c.parent_norm end from public.vod_chapter_index c, q1 q
  ),
  q as (
    select
      q1.qn, q1.is_cho, q1.alts, q1.tokg as toks, q1.min_ok, q1.corrected, q1.song_intent, q1.dance_intent, q1.hum_intent, q1.game_intent, q1.rest_toks,
      (cardinality(q1.genre_terms) > 0) as genre_intent,
      (select re from genre_games) as gre2,
      case when cardinality(q1.alts) = 0 then '(?!)' else '(' || array_to_string(q1.alts, '|') || ')' end as qre,
      case when cardinality(q1.rels) = 0 then null else '(' || array_to_string(q1.rels, '|') || ')' end as qrel,
      -- 0113/0114: 대안어를 세 무리로 나눈다.
      --   qre_o  = 한글 두 글자도, 한글 세 글자 이상도 아닌 것(영문·숫자 섞임·초성) → 정규화 문자열에서 그대로
      --   qre_s  = 한글 두 글자 → 원문에서 붙어 있어야
      --   qre_h  = 한글 세 글자 이상 → 정규화 문자열 + 원문 낱말 머리(qre_hb)
      (select '(' || string_agg(a, '|') || ')' from unnest(q1.alts) a where a !~ '^[가-힣]{2,}$') as qre_o,
      (select '(' || string_agg(a, '|') || ')' from unnest(q1.alts) a where a ~ '^[가-힣]{2}$') as qre_s,
      (select '(' || string_agg(a, '|') || ')' from unnest(q1.alts) a where a ~ '^[가-힣]{3,}$') as qre_h,
      (select '(' || string_agg(public.search_word_start_re(a), '|') || ')' from unnest(q1.alts) a where a ~ '^[가-힣]{3,}$') as qre_hb,
      (select '(' || string_agg(a, '|') || ')' from unnest(q1.rels) a where a !~ '^[가-힣]{2,}$') as qrel_o,
      (select '(' || string_agg(a, '|') || ')' from unnest(q1.rels) a where a ~ '^[가-힣]{2}$') as qrel_s,
      (select '(' || string_agg(a, '|') || ')' from unnest(q1.rels) a where a ~ '^[가-힣]{3,}$') as qrel_h,
      (select '(' || string_agg(public.search_word_start_re(a), '|') || ')' from unnest(q1.rels) a where a ~ '^[가-힣]{3,}$') as qrel_hb,
      case when cardinality(q1.rest_toks) = 0 then null else '(' || array_to_string(q1.rest_toks, '|') || ')' end as qrest,
      (select re from games) as gre,
      -- 두 글자 한글 질의: 트라이그램 퍼지 바닥(similarity)을 끈다. 두 글자는 trigram이 하나뿐이라
      -- 아무 데나 0.3을 넘어 쓰레기를 끌고 온다. 적중 여부 자체는 qre_s(원문 인접)가 판단한다(0113).
      (not q1.is_cho and length(q1.qn) = 2 and q1.qn ~ '^[가-힣]+$') as short2,
      lower(trim(coalesce(p_q, ''))) as qraw,
      (not q1.is_cho and length(q1.qn) between 2 and 4) as abbrev_on,
      '%' || substr(q1.qn, 1, 1) || '%' || substr(q1.qn, length(q1.qn), 1) || '%' as ablike,
      -- IDF 가중치는 **두 낱말 이상일 때만** 만든다(0116). 아래 쓰임새가 전부 `q.ntok > 1` 뒤에 있어
      -- 한 낱말 질의에서는 만들어 놓고 안 썼는데, 만드는 값이 말뭉치 18,824행 전수 스캔 두 번이었다.
      case when cardinality(q1.toks) > 1 then array(
        select (ln(((select count(*) from corpus) + 1.0) / ((select count(*) from corpus where corpus.norm ~ ('(' || t.tok || ')')) + 1.0)) + 1)::numeric
        from unnest(q1.tokg) with ordinality as t(tok, ord)
        order by t.ord
      ) else array[]::numeric[] end as tokw,
      cardinality(q1.toks) as ntok
    from q1
  ),
  ev_hearts as (
    select h.event_id, count(*)::numeric as n
    from (select event_id from public.event_hearts union all select event_id from public.event_hearts_anon) h
    group by h.event_id
  ),
  ev_max as (select greatest(1, coalesce(max(n), 1)) as mx from ev_hearts),
  evm as (
    select ev.*,
      case when q.is_cho then public.search_choseong(ev.tn) else ev.tn end as tnm,
      case when q.is_cho then public.search_choseong(ev.dn) else ev.dn end as dnm,
      case when q.is_cho then public.search_choseong(ev.tagn) else ev.tagn end as tagnm,
      public.search_hit(case when q.is_cho then public.search_choseong(ev.tn) else ev.tn end, ev.traw,
        q.qre_o, q.qre_s, q.qre_h, q.qre_hb) as hit_t,
      public.search_hit(case when q.is_cho then public.search_choseong(ev.tagn) else ev.tagn end, ev.graw,
        q.qre_o, q.qre_s, q.qre_h, q.qre_hb) as hit_g,
      public.search_hit(case when q.is_cho then public.search_choseong(ev.dn) else ev.dn end, ev.draw,
        q.qre_o, q.qre_s, q.qre_h, q.qre_hb) as hit_d,
      public.search_hit(ev.tn || ev.tagn || ev.dn, ev.traw || ' ' || ev.graw || ' ' || ev.draw,
        q.qrel_o, q.qrel_s, q.qrel_h, q.qrel_hb) as hit_r,
      (q.game_intent and q.gre is not null and ev.tn ~ q.gre and not public.search_game_is_major(ev.tn)
        and (q.qrest is null or (ev.tn || ev.tagn) ~ q.qrest)) as hit_game,
      (case when not q.abbrev_on or ev.tn !~~ q.ablike or (ev.tn ~ q.qre) then false
            else public.search_abbrev_match(q.qn, ev.public_title) end) as hit_ab,
      (q.genre_intent and q.gre2 is not null and (ev.tn || ev.tagn) ~ q.gre2
        and (q.qrest is null or (ev.tn || ev.tagn) ~ q.qrest)) as hit_genre,
      coalesce((select n from ev_hearts where ev_hearts.event_id = ev.id), 0) / (select mx from ev_max) as pop
    from ev, q
  ),
  ev_scored as (
    select
      'event'::text as kind, ev.id as event_id, null::bigint as title_no, null::integer as sec,
      ev.date_key, ev.start_time, ev.public_title as title,
      case
        when not q.is_cho and hit_d and position(lower(trim(coalesce(p_q, ''))) in lower(ev.descr)) > 0 then
          substr(ev.descr, greatest(1, position(lower(trim(coalesce(p_q, ''))) in lower(ev.descr)) - 30), 120)
        when hit_d then substr(ev.descr, 1, 120)
        else ''
      end as snippet,
      null::bigint as duration_ms, null::text as host_nick,
      -- 일정 행에도 그 날 다시보기 썸네일(0095, 소유자): 지난 날이라 방송이 있으면 첫 방송 것. 미래 일정은 null.
      (select x.thumb from vods x where x.broadcast_day = ev.date_key order by x.title_no limit 1) as thumb,
      (
        greatest(3.0 * similarity(ev.tnm, q.qn), 1.2 * similarity(ev.tagnm, q.qn), 0.7 * similarity(ev.dnm, q.qn))
        + case
            when hit_game then 2.6
            when hit_genre then 2.2
            when hit_t then 1.2
            when hit_g or hit_d then 0.6
            when q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0
              then 1.0 * public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw)
            when hit_r then 0.5
            when hit_ab then 0.4
            else 0
          end
        + 0.4 * pop
        + 0.3 * exp(-greatest(0, (current_date - ev.date_key))::numeric / 365.0)
      )::numeric as score,
      (hit_game or hit_genre or hit_t or hit_g or hit_d or hit_r or (q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)) as exact,
      pop::numeric as popularity,
      ''::text as section, ''::text as parent,
      case when hit_game then 'game' when hit_genre then 'genre' when hit_t then 'title' when hit_g then 'tag' when hit_d then 'description' when q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0 then 'tokens' when hit_r then 'related' when hit_ab then 'abbrev' else 'fuzzy' end as matched_on,
      coalesce(q.corrected, '') as corrected
    from evm ev, q
    where q.min_ok and (
      hit_game or hit_genre or hit_t or hit_g or hit_d or hit_r or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)
      or (length(q.qn) >= 2 and not q.short2 and similarity(ev.tnm, q.qn) >= 0.25)
    )
  ),
  vod_max as (
    select greatest(1, coalesce(max(read_cnt), 1))::numeric as mx_read,
           greatest(1, coalesce(max(like_cnt + comment_cnt), 1))::numeric as mx_react,
           greatest(1, coalesce(max(entry_count), 1))::numeric as mx_ch
    from vods
  ),
  vod_engage as (
    select v.title_no,
      0.4 * ln(1 + v.read_cnt) / ln(1 + m.mx_read)
      + 0.2 * ln(1 + v.like_cnt + v.comment_cnt) / ln(1 + m.mx_react)
      + 0.2 * v.entry_count / m.mx_ch as engagement,
      0.3 * exp(-greatest(0, (current_date - v.broadcast_day))::numeric / 365.0) as freshness
    from vods v, vod_max m
  ),
  vodm as (
    select v.*,
      case when q.is_cho then public.search_choseong(v.tn) else v.tn end as tnm,
      public.search_hit(case when q.is_cho then public.search_choseong(v.tn) else v.tn end, lower(v.title),
        q.qre_o, q.qre_s, q.qre_h, q.qre_hb) as hit_t,
      public.search_hit(v.tn, lower(v.title), q.qrel_o, q.qrel_s, q.qrel_h, q.qrel_hb) as hit_r,
      (q.game_intent and (
        (q.gre is not null and v.tn ~ q.gre)
        or exists (select 1 from public.vod_chapter_index c join public.search_games g on g.norm = c.game_norm where c.title_no = v.title_no and g.kind = 'minor')
      ) and (q.qrest is null or v.tn ~ q.qrest)) as hit_game,
      (case when not q.abbrev_on or v.tn !~~ q.ablike or (v.tn ~ q.qre) then false
            else public.search_abbrev_match(q.qn, v.title) end) as hit_ab,
      (q.genre_intent and q.gre2 is not null and (
        v.tn ~ q.gre2
        or exists (select 1 from public.vod_chapter_index c where c.title_no = v.title_no and (c.game_norm || '|' || c.section_norm) ~ q.gre2)
      ) and (q.qrest is null or v.tn ~ q.qrest)) as hit_genre
    from vods v, q
  ),
  vod_scored as (
    select
      'vod'::text as kind, null::uuid as event_id, v.title_no, null::integer as sec,
      v.broadcast_day as date_key, null::time as start_time, v.title, ''::text as snippet,
      v.duration_ms, nullif(v.host_nick, '') as host_nick, v.thumb,
      (
        2.0 * similarity(v.tnm, q.qn)
        + case
            when hit_game then 2.8
            when hit_genre then 2.3
            when hit_t then 1.2
            when q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0 then 1.0 * public.search_tok_ratio(v.tnm, q.toks, q.tokw)
            when hit_r then 0.5
            when hit_ab then 0.4
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (hit_game or hit_genre or hit_t or hit_r or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)) as exact,
      (g.engagement / 0.8)::numeric as popularity,
      ''::text as section, ''::text as parent,
      case when hit_game then 'game' when hit_genre then 'genre' when hit_t then 'title' when q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0 then 'tokens' when hit_r then 'related' when hit_ab then 'abbrev' else 'fuzzy' end as matched_on,
      coalesce(q.corrected, '') as corrected
    from vodm v
    join vod_engage g on g.title_no = v.title_no, q
    where q.min_ok and (
      hit_game or hit_genre or hit_t or hit_r or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)
      or (length(q.qn) >= 2 and not q.short2 and similarity(v.tnm, q.qn) >= 0.25)
    )
  ),
  chm as (
    select c.title_no, c.sec, c.label, c.section, c.parent, c.song_kind,
      case when q.is_cho then c.label_cho else c.label_norm end as cm,
      c.label_norm || '|' || c.section_norm || '|' || c.parent_norm as cmx,
      public.search_hit(case when q.is_cho then c.label_cho else c.label_norm end, lower(c.label),
        q.qre_o, q.qre_s, q.qre_h, q.qre_hb) as hit_t,
      (not q.is_cho and public.search_hit(c.section_norm || '|' || c.parent_norm,
        lower(c.section || '|' || c.parent), q.qre_o, q.qre_s, q.qre_h, q.qre_hb)) as hit_s,
      public.search_hit(c.label_norm || '|' || c.section_norm || '|' || c.parent_norm,
        lower(c.label || '|' || c.section || '|' || c.parent),
        q.qrel_o, q.qrel_s, q.qrel_h, q.qrel_hb) as hit_r,
      (q.qrest is null or (c.label_norm || '|' || c.section_norm) ~ q.qrest) as rest_ok,
      (q.song_intent and c.song_kind = 'sung') as hit_song,
      (q.song_intent and c.song_kind = 'listen') as hit_listen,
      ((q.song_intent or q.hum_intent) and c.song_kind = 'hum') as hit_hum,
      (q.dance_intent and c.song_kind = 'dance') as hit_dance,
      (q.game_intent and c.is_section_start and c.game_norm <> ''
        and exists (select 1 from public.search_games g where g.norm = c.game_norm and g.kind = 'minor')) as hit_game,
      (case when not q.abbrev_on or c.label_norm !~~ q.ablike or (c.label_norm ~ q.qre) then false
            else public.search_abbrev_match(q.qn, c.label) end) as hit_ab,
      (q.genre_intent and q.gre2 is not null and (c.label_norm || '|' || c.section_norm || '|' || c.game_norm) ~ q.gre2) as hit_genre
    from public.vod_chapter_index c, q
  ),
  ch_scored as (
    select
      'chapter'::text as kind, null::uuid as event_id, c.title_no, c.sec,
      v.broadcast_day as date_key, null::time as start_time, c.label as title, v.title as snippet,
      v.duration_ms, nullif(v.host_nick, '') as host_nick, v.thumb,
      (
        1.5 * similarity(c.cm, q.qn)
        + case
            when c.rest_ok and c.hit_game then 2.4
            when c.rest_ok and c.hit_genre then 2.0
            when c.rest_ok and c.hit_song then 2.8
            when c.rest_ok and c.hit_dance then 2.8
            when c.rest_ok and c.hit_hum and q.hum_intent then 2.8
            when c.hit_t then 1.2
            when c.rest_ok and c.hit_hum then 1.0
            when c.hit_s then 0.9
            when c.rest_ok and c.hit_listen then 0.8
            when q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) > 0 then 1.0 * public.search_tok_ratio(c.cmx, q.toks, q.tokw)
            when c.hit_r then 0.5
            when c.hit_ab then 0.4
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      ((c.rest_ok and (c.hit_game or c.hit_genre or c.hit_song or c.hit_dance or c.hit_hum or c.hit_listen)) or c.hit_t or c.hit_s or c.hit_r or (q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) >= 0.5)) as exact,
      (g.engagement / 0.8)::numeric as popularity,
      c.section, c.parent,
      case
        when c.rest_ok and c.hit_game then 'game'
        when c.rest_ok and c.hit_genre then 'genre'
        when c.rest_ok and c.hit_song then 'song'
        when c.rest_ok and c.hit_dance then 'dance'
        when c.rest_ok and c.hit_hum then 'hum'
        when c.hit_t then 'label'
        when c.hit_s then 'section'
        when c.rest_ok and c.hit_listen then 'listen'
        when q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) > 0 then 'tokens'
        when c.hit_r then 'related' when c.hit_ab then 'abbrev' else 'fuzzy' end as matched_on,
      coalesce(q.corrected, '') as corrected
    from chm c
    join vods v on v.title_no = c.title_no
    join vod_engage g on g.title_no = c.title_no, q
    where q.min_ok and (
      (c.rest_ok and (c.hit_game or c.hit_genre or c.hit_song or c.hit_dance or c.hit_hum or c.hit_listen))
      or c.hit_t or c.hit_s or c.hit_r or c.hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) >= 0.5)
      or (length(q.qn) >= 2 and not q.short2 and similarity(c.cm, q.qn) >= 0.3)
    )
  ),
  -- 그 말을 이미 잡은 방송(챕터 라벨·코너 또는 다시보기 제목) — 한 번만 모아 둔다(0117).
  -- 예전엔 채팅 후보 행마다 chm/vodm을 다시 훑어 중첩 반복이 됐다.
  chat_excluded as materialized (
    select c.title_no from chm c where c.hit_t or c.hit_s
    union
    select x.title_no from vodm x where x.hit_t
  ),
  -- 채팅 반응 적중(0093): 시청자 채팅에서 그 말이 많이 나온 방송 → 가장 몰린 30초 구간으로 가는 챕터 모양 행.
  -- 단어 전체가 질의(또는 동의어)와 같을 때만("이게"가 "이게임" 안에 걸리지 않게), 방송당 5회 이상.
  -- 팬 챕터가 이미 같은 말을 잡은 방송은 뺀다(같은 방송이 두 번 나오지 않게). 원문은 없다 — 단어·구간뿐.
  chat_scored as (
    select
      'chapter'::text as kind, null::uuid as event_id, t.title_no, (coalesce(t.peak_bin, 0) * 30)::integer as sec,
      v.broadcast_day as date_key, null::time as start_time,
      ('채팅 "' || t.term || '" 반응 구간')::text as title, v.title as snippet,
      v.duration_ms, nullif(v.host_nick, '') as host_nick, v.thumb,
      (0.9 + least(1.0, ln(1 + t.cnt) / 5.0) + g.engagement + g.freshness)::numeric as score,
      (t.cnt >= 10) as exact,
      (g.engagement / 0.8)::numeric as popularity,
      '채팅'::text as section, ''::text as parent,
      'chat'::text as matched_on,
      coalesce(q.corrected, '') as corrected
    from public.vod_chat_terms t
    join vods v on v.title_no = t.title_no
    join vod_engage g on g.title_no = t.title_no, q
    where q.min_ok and not q.is_cho and t.cnt >= 5 and t.peak_bin is not null
      and t.term = any(q.alts) -- 정규식 전수 스캔(0093) → 인덱스 동등 비교(0097): 백만 행 테이블에서 1~3초 → 수 ms
      and not exists (select 1 from chat_excluded e where e.title_no = t.title_no)
  ),
  merged as (
    select * from ev_scored union all select * from vod_scored union all select * from ch_scored union all select * from chat_scored
  )
  select kind, event_id, title_no, sec, date_key, start_time, title, snippet, duration_ms, host_nick, thumb,
         round(score, 4) as score, exact, round(popularity, 4) as popularity, section, parent, matched_on, corrected
  from merged
  order by exact desc, score desc, date_key desc, sec asc nulls first
  limit greatest(1, least(coalesce(p_limit, 50), 400));
$function$;

-- search_dictionary_draft(integer)
CREATE OR REPLACE FUNCTION public.search_dictionary_draft(p_limit integer DEFAULT 200)
 RETURNS TABLE(term text, vods integer, total bigint, first_day date, last_day date, samples text[], note text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with t as (
    select c.term, count(distinct c.title_no)::int as vods, sum(c.cnt)::bigint as total,
           min(v.broadcast_day) as first_day, max(v.broadcast_day) as last_day
    from public.vod_chat_terms c
    join public.vod_archive v on v.title_no = c.title_no and v.auth_no in (101, 107)
    where v.broadcast_day >= current_date - interval '540 days'
      and c.term ~ '^[가-힣]{2,6}$' and c.cnt >= 2
    group by c.term
    having count(distinct c.title_no) >= 2 and sum(c.cnt) >= 10
  ),
  docs_words as (
    select distinct lower(x) as w
    from (
      select v.title as txt from public.vod_archive v where v.auth_no in (101, 107)
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
$function$;

-- vod_chat_profile(bigint)
CREATE OR REPLACE FUNCTION public.vod_chat_profile(p_title_no bigint)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with b as (
    select bin, msgs, speakers, laugh, terms from public.vod_chat_bins where title_no = p_title_no and exists(select 1 from public.vod_archive v where v.title_no=p_title_no and v.auth_no in (101,107))
  ),
  mx as (
    select greatest(1, max(msgs)) as m, greatest(1, max(speakers)) as s, greatest(1, max(laugh)) as l from b
  ),
  mine as (
    select case when sum(msgs) > 0 then sum(laugh)::numeric / sum(msgs) else 0 end as lpm, count(*) as n from b
  ),
  others as (
    select title_no, sum(laugh)::numeric / greatest(1, sum(msgs)) as lpm
    from public.vod_chat_bins where exists(select 1 from public.vod_archive v where v.title_no=vod_chat_bins.title_no and v.auth_no in (101,107)) group by title_no having count(*) >= 20 and sum(msgs) >= 200
  ),
  tier as (
    -- 비교 대상 방송이 8개는 있어야 '상위 25%'가 뜻을 가진다(백필 초기엔 등급 없음).
    select case
      when (select n from mine) >= 20 and (select count(*) from others) >= 8
       and (select lpm from mine) >= coalesce((select percentile_cont(0.75) within group (order by lpm) from others), 1e9) then 'high'
      else null end as t
  )
  select json_build_object(
    'binSec', 30,
    'laughTier', (select t from tier),
    'bins', coalesce((
      select json_agg(json_build_object(
        'i', b.bin,
        'h', round(b.msgs::numeric / mx.m, 2),
        'd', round(b.speakers::numeric / mx.s, 2),
        'l', round(b.laugh::numeric / mx.l, 2),
        't', b.terms
      ) order by b.bin)
      from b, mx
    ), '[]'::json)
  );
$function$;

-- vod_chat_commit_job(bigint,integer,jsonb,jsonb)
CREATE OR REPLACE FUNCTION public.vod_chat_commit_job(p_title_no bigint, p_revision integer, p_job jsonb, p_snapshot jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare current_revision integer;
begin
  if not exists(select 1 from public.vod_archive where title_no=p_title_no and auth_no in (101,107)) then return false; end if;
  insert into public.vod_chat_job(title_no) values(p_title_no) on conflict do nothing;
  select revision into current_revision from public.vod_chat_job where title_no=p_title_no for update;
  if current_revision <> p_revision then return false; end if;
  if p_snapshot is not null then
    -- Replace derived aggregates only for this VOD, atomically with its checkpoint.
    -- cnt=1 rows are never read (lowest reader threshold is 2) — keep them out of the table (0130).
    delete from public.vod_chat_terms where title_no=p_title_no;
    insert into public.vod_chat_terms(title_no,term,cnt,peak_bin,peak_cnt,bins)
      select p_title_no,x.term,x.cnt,x.peak_bin,x.peak_cnt,x.bins
      from jsonb_to_recordset(p_snapshot->'terms') as x(term text,cnt integer,peak_bin integer,peak_cnt integer,bins integer)
      where x.cnt >= 2;
    delete from public.vod_chat_bins where title_no=p_title_no;
    insert into public.vod_chat_bins(title_no,bin,msgs,speakers,laugh,terms)
      select p_title_no,x.bin,x.msgs,x.speakers,x.laugh,x.terms
      from jsonb_to_recordset(p_snapshot->'bins') as x(bin integer,msgs integer,speakers integer,laugh integer,terms text[]);
    delete from public.vod_chat_people where title_no=p_title_no;
    insert into public.vod_chat_people(title_no,name,greetings,mentions)
      select p_title_no,x.name,x.greetings,x.mentions
      from jsonb_to_recordset(p_snapshot->'people') as x(name text,greetings integer,mentions integer);
  end if;
  update public.vod_chat_job set revision=revision+1,
    state=nullif(p_job->'state','null'::jsonb), complete=(p_job->>'complete')::boolean,
    next_retry_at=(p_job->>'nextRetryAt')::timestamptz, updated_at=now()
    where title_no=p_title_no;
  insert into public.vod_chat_sync(title_no,chunks,messages,complete,synced_at)
    values(p_title_no,(p_job->>'chunks')::integer,(p_job->>'messages')::integer,(p_job->>'complete')::boolean,now())
    on conflict(title_no) do update set chunks=excluded.chunks,messages=excluded.messages,
      complete=excluded.complete,synced_at=excluded.synced_at;
  return true;
end;
$function$;

-- search_trending_rebuild(integer)
CREATE OR REPLACE FUNCTION public.search_trending_rebuild(p_days integer DEFAULT 14)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  n_rows int;
  d int := greatest(1, least(coalesce(p_days, 14), 60));
  hl numeric := 3.0;                                   -- 반감기(일)
  today date := (now() at time zone 'Asia/Seoul')::date;
  eff numeric;                                         -- 창 안 가중치의 합 = 가중 일수
  lday date;                                           -- (0139) 가장 최근 방송일
  have int;                                            -- 그날 말이 이미 상위 8에 몇 개
  want int;                                            -- 끼울 자리 수
  r3 numeric; r4 numeric; r5 numeric;                  -- 끼울 자리 앞뒤 ratio
  first_docs text[];                                   -- 이미 자리 잡은 그날 말들이 나온 글
  pick record;
  slot int := 0;
begin
  select sum(power(0.5, g / hl)) into eff from generate_series(0, d - 1) as g;

  delete from public.search_trends;
  insert into public.search_trends (term, recent, ratio)

  with docs as (
    select v.broadcast_day as day, v.title as txt from public.vod_archive v where v.auth_no in (101, 107)
    union all
    select v.broadcast_day, c.label from public.vod_chapter_index c join public.vod_archive v on v.title_no = c.title_no and v.auth_no in (101, 107)
    union all
    select e.date_key, e.public_title || ' ' || coalesce(e.public_description, '')
    from public.events e
    where e.deleted_at is null and e.visibility_scope = 'public' and e.status <> 'draft'
      and not (coalesce(e.teaser, false) and e.teaser_reveal_at is not null and e.teaser_reveal_at > now())
  ),
  doc_words as (
    select distinct lower(x) as w from docs, regexp_split_to_table(txt, '[^가-힣a-zA-Z0-9]+') as x where x ~ '^[가-힣]{2,6}$'
  ),
  known as (
    select w from doc_words
    union select s.term from public.search_synonyms s
    union select s.alt from public.search_synonyms s
    union select e.name from public.search_entities e
    union select g.norm from public.search_games g
    union select i.term from public.search_intents i
  ),
  words as (
    select day, lower(x) as w, 1::numeric as n
    from docs, regexp_split_to_table(txt, '[^가-힣a-zA-Z0-9]+') as x
    where x ~ '^[가-힣]{2,6}$'
    union all
    select v.broadcast_day, t.term, least(t.cnt, 30) + sqrt(greatest(t.cnt - 30, 0))::numeric
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no in (101, 107)
    where v.broadcast_day >= today - (d + 180)
      and t.cnt >= 3 and t.term ~ '^[가-힣]{2,6}$' and t.term in (select w from known)
  ),
  stop as (
    select unnest(array['토리님','토리','빅토리','빅토리님','방송','시작','종료','오늘','내일','시간','잠깐','다시','이야기','토리가','우리','그냥','정말','진짜','후열','엔딩','멘트','휴식','시청자','새로운','요즘','오늘도','이번','다음','처음','마지막','드디어','바로',
      'ㅋㅋㅋ','ㅋㅋ','ㅠㅠ','ㅎㅎ','아니','근데','뭐야','진짜','대박','와우','헐','오오','ㄷㄷ','ㄹㅇ','ㅇㅇ','ㄴㄴ','ㅇㅋ','ㄱㄱ','ㅈㅈ',
      '아니야','이게','그게','저게','이거','그거','저거','이제','지금','여기','거기','저기','사실','아마','약간','조금','많이','이미','계속','다시','거의','정말로','솔직히','하는','있는','없는','같은','너무','이런','그런','저런','어떻게','왜요','뭐지','뭔데','맞아','맞다','그치','네네','아하']) as w
  ),
  recent as (
    -- 미래 날짜(예정 일정 제목)는 나이 0으로 본다.
    select w, sum(n) as n, sum(n * power(0.5, greatest(0, today - day) / hl)) as hot
    from words
    where day > today - d
      and w not in (select w from stop)
    group by w
  ),
  prior as (
    select w, sum(n) as n from words
    where day <= today - d
      and day > today - (d + 180)
    group by w
  ),
  cand as materialized (
    select r.w, r.n, r.hot, coalesce(p.n, 0) as pn
    from recent r left join prior p on p.w = r.w
    where r.n >= 2
  ),
  tails as (
    select unnest(array['이','가','을','를','은','는','의','도','에','로','와','과','랑','만','야','아','님',
      '에서','으로','이랑','한테','까지','부터','처럼','보다','이다','이야','이네','인데','님과','님이','님은','님도','님의','이가','이는','이를']) as t
  ),
  stripped as (
    select c.w, left(c.w, length(c.w) - length(t.t)) as b
    from cand c, tails t
    where length(c.w) - length(t.t) >= 2 and right(c.w, length(t.t)) = t.t
  ),
  -- 용언·인용 꼬리(0135): '빗토리된다' → '빗토리'. 두 글자 이상 꼬리라 조사보다 안전하므로 몸통이 후보가 아니어도
  -- **어딘가에 실제로 쓰인 말**(문서 어휘·사전 또는 채팅 단어)이면 몸통으로 바꾼다.
  vtails as (
    select unnest(array['된다','한다','했다','됐다','하다','되다','라고','이라고','합니다','됩니다','했어','됐어','해요','돼요',
      '하네','되네','했네','됐네','하자','한대','된대','하는','되는','하면','되면','해서','돼서','하고','되고']) as t
  ),
  vstripped as materialized (
    select c.w, left(c.w, length(c.w) - length(t.t)) as b
    from cand c, vtails t
    where length(c.w) - length(t.t) >= 2 and right(c.w, length(t.t)) = t.t
  ),
  vstem as (
    select s.w, s.b from vstripped s
    where s.b in (select w from cand) or s.b in (select w from known)
       or exists (select 1 from public.vod_chat_terms ct where ct.term = s.b)
  ),
  m1 as (
    select c.w, c.n, c.hot, c.pn,
           coalesce(
             (select s.b from stripped s join cand b on b.w = s.b where s.w = c.w order by length(s.b) limit 1),
             (select s.b from vstem s where s.w = c.w order by length(s.b) limit 1),
             c.w) as canon
    from cand c
    where not exists (select 1 from stripped s join stop x on x.w = s.b where s.w = c.w)
      and not exists (select 1 from vstripped s join stop x on x.w = s.b where s.w = c.w)
  ),
  g1 as (
    select canon as w, sum(n) as n, sum(hot) as hot, sum(pn) as pn
    from m1 group by canon having sum(n) >= 3
  ),
  top as materialized (
    select g.w, g.n, g.hot, g.pn from g1 g
    order by g.hot / greatest(1, g.pn * (eff / 180.0)) desc, g.n desc
    limit 200
  ),
  m2 as (
    select a.w, a.n, a.hot, a.pn,
           coalesce((select b.w from top b
                     where public.search_trend_vowel_variant(a.w, b.w) and (b.hot > a.hot or (b.hot = a.hot and b.w < a.w))
                     order by b.hot desc, b.w limit 1), a.w) as canon
    from top a
  ),
  g2 as (
    select canon as w, sum(n) as n, sum(hot) as hot, sum(pn) as pn from m2 group by canon
  )
  select g.w as term, round(g.n)::int as recent,
         round(g.hot / greatest(1, g.pn * (eff / 180.0)), 2) as ratio
  from g2 g
  order by ratio desc, g.n desc
  limit 60;
  get diagnostics n_rows = row_count;

  -- ── (0139) 가장 최근 방송 몫 1~2자리 ─────────────────────────────────────────
  select max(v.broadcast_day) into lday
  from public.vod_archive v
  where v.auth_no in (101, 107) and not v.upload and v.broadcast_day <= today;
  if lday is null or lday <= today - 7 then
    return n_rows;
  end if;
  -- 채팅 분석이 그날 다시보기 전부에서 끝나야 한다(분석 중이면 다음 재계산 때).
  if exists (
    select 1 from public.vod_archive v
    left join public.vod_chat_job j on j.title_no = v.title_no
    where v.auth_no in (101, 107) and not v.upload and v.broadcast_day = lday and not coalesce(j.complete, false)
  ) then
    return n_rows;
  end if;

  drop table if exists tmp_fresh;
  create temp table tmp_fresh on commit drop as
  with ldocs as (
    select 'v' || v.title_no as doc, 'title' as kind, v.title as txt
    from public.vod_archive v where v.auth_no in (101, 107) and v.broadcast_day = lday
    union all
    select 'c' || c.title_no || ':' || c.sec, 'chapter', c.label
    from public.vod_chapter_index c join public.vod_archive v on v.title_no = c.title_no and v.auth_no in (101, 107)
    where v.broadcast_day = lday
    union all
    select 'e' || e.id, 'event', e.public_title || ' ' || coalesce(e.public_description, '')
    from public.events e
    where e.deleted_at is null and e.visibility_scope = 'public' and e.status <> 'draft' and e.date_key = lday
      and not (coalesce(e.teaser, false) and e.teaser_reveal_at is not null and e.teaser_reveal_at > now())
  ),
  raw as (
    select distinct d.doc, d.kind, regexp_replace(lower(x), '님$', '') as w
    from ldocs d, regexp_split_to_table(d.txt, '[^가-힣a-zA-Z0-9]+') as x
    where x ~ '^[가-힣]{2,6}$'
  ),
  stop as (
    select unnest(array['토리님','토리','빅토리','빅토리님','방송','시작','종료','오늘','내일','시간','잠깐','다시','이야기','토리가','우리','그냥',
      '정말','진짜','후열','엔딩','멘트','휴식','시청자','새로운','요즘','오늘도','이번','다음','처음','마지막','드디어','바로','하루','게임','소통',
      '등장','반응','후기','인사','방종인사','시점','받은','오늘부터','영원한','보고','보기','해보기','하기','정리','강화']) as w
  ),
  -- 꼴 규칙의 '몸통이 실제 말' 판정에 불용어도 넣는다 — '빅토리로'의 몸통 '빅토리'는 어휘표에 없어 안 떼어졌다.
  vocab as (
    select w from raw union select term from public.search_terms union select w from stop
  ),
  -- 화제 칩과 같은 꼴 규칙: 용언 꼬리(입주합니다 → 입주) 먼저, 그다음 조사 꼬리(빅토리로 → 빅토리). 몸통이 실제 말일 때만.
  canon as (
    select r.doc, r.kind, r.w,
      coalesce(
        (select left(r.w, length(r.w) - length(t)) from unnest(array['된다','한다','했다','됐다','하다','되다','라고','이라고','합니다','됩니다',
           '했어','됐어','해요','돼요','하네','되네','했네','됐네','하자','한대','된대','하는','되는','하면','되면','해서','돼서','하고','되고',
           '하기','해보기','보기','해보나','해보자']) as t
         where length(r.w) - length(t) >= 2 and right(r.w, length(t)) = t
           and left(r.w, length(r.w) - length(t)) in (select w from vocab)
         order by length(t) desc limit 1),
        (select left(r.w, length(r.w) - length(t)) from unnest(array['이','가','을','를','은','는','의','도','에','로','와','과','랑','만','야','아',
           '에서','으로','이랑','한테','까지','부터','처럼','보다','이다','이야','이네','인데','이가','이는','이를']) as t
         where length(r.w) - length(t) >= 2 and right(r.w, length(t)) = t
           and left(r.w, length(r.w) - length(t)) in (select w from vocab)
         order by length(t) desc limit 1),
        r.w) as c
    from raw r
  ),
  dw as (
    select c as w,
      6 * max(case when kind = 'title' then 1 else 0 end)
      + 6 * max(case when kind = 'event' then 1 else 0 end)
      + 2 * least(count(*) filter (where kind = 'chapter'), 3) as ds,
      array_agg(distinct doc) as docs
    from canon
    where c not in (select w from stop) and length(c) >= 2
    group by c
  ),
  lchat as (
    select t.term as w, sum(least(t.cnt, 30))::numeric as cn
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no in (101, 107)
    where v.broadcast_day = lday group by 1
  ),
  prior as (
    -- n = 그 전 180일 쓰임(늘 쓰는 말 눌러 주기), n14 = 그 전 14일 쓰임(이미 직전 방송에서 뜨던 말 가려내기).
    select w, sum(n) as n, sum(n) filter (where bd >= lday - 14) as n14 from (
      select regexp_replace(lower(x), '님$', '') as w, 1::numeric as n, dd.bd
      from (
        select v.title as txt, v.broadcast_day as bd from public.vod_archive v where v.auth_no in (101, 107)
        union all
        select c.label, v.broadcast_day from public.vod_chapter_index c join public.vod_archive v on v.title_no = c.title_no and v.auth_no in (101, 107)
      ) dd, regexp_split_to_table(dd.txt, '[^가-힣a-zA-Z0-9]+') as x
      where dd.bd < lday and dd.bd >= lday - 180 and x ~ '^[가-힣]{2,6}$'
      union all
      select t.term, least(t.cnt, 30)::numeric, v.broadcast_day as bd
      from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no in (101, 107)
      where v.broadcast_day < lday and v.broadcast_day >= lday - 180
    ) z group by w
  )
  select d.w, d.docs, round(d.ds + coalesce(c.cn, 0))::int as recent,
         -- 그날의 새 말 = 직전 14일 쓰임이 그날 몫보다 작다(뉴토리처럼 10/1에 뜨던 말은 10/4 챕터에 나와도 아니다).
         coalesce(p.n14, 0) < d.ds + coalesce(c.cn, 0) as is_new,
         (d.ds + 1.5 * coalesce(c.cn, 0)) / (1 + coalesce(p.n, 0) / 20.0) as score
  from dw d
  left join lchat c on c.w = d.w
  left join prior p on p.w = d.w
  where d.ds + 1.5 * coalesce(c.cn, 0) >= 6;

  -- 그날의 새 말이 이미 상위 8에 몇 개 있나(있으면 그만큼 덜 끼운다).
  select count(*) into have
  from (select term from public.search_trends order by ratio desc, recent desc limit 8) t
  where t.term in (select w from tmp_fresh where is_new);
  want := greatest(0, 2 - have);
  if want = 0 then
    return n_rows;
  end if;

  select ratio into r3 from public.search_trends order by ratio desc, recent desc offset 2 limit 1;
  select ratio into r4 from public.search_trends order by ratio desc, recent desc offset 3 limit 1;
  select ratio into r5 from public.search_trends order by ratio desc, recent desc offset 4 limit 1;
  if r5 is null then
    return n_rows; -- 칩이 몇 개 안 되면 끼울 필요 없다(전부 보인다)
  end if;

  -- 이미 상위 8에 있는 그날의 새 말이 나온 글 — 같은 글에만 나오는 말은 같은 이야기라 또 끼우지 않는다.
  select array_agg(distinct x) into first_docs
  from tmp_fresh f, unnest(f.docs) as x
  where f.is_new and f.w in (select term from (select term from public.search_trends order by ratio desc, recent desc limit 8) t8);

  for pick in
    select f.w, f.recent, f.docs from tmp_fresh f
    where f.is_new
      and f.w not in (select term from (select term from public.search_trends order by ratio desc, recent desc limit 8) t8)
    order by f.score desc, f.w
  loop
    exit when slot >= want;
    -- 이미 고른(또는 상위 8에 있던) 말과 같은 글에만 나온 말이면 건너뛴다(그냥서버·입주 = 같은 제목 한 덩이).
    if first_docs is not null and pick.docs <@ first_docs then
      continue;
    end if;
    first_docs := coalesce(first_docs, '{}') || pick.docs;
    delete from public.search_trends where term = pick.w;
    insert into public.search_trends (term, recent, ratio)
    values (pick.w, pick.recent, case when slot = 0 then round((r3 + r4) / 2, 2) else round((r4 + r5) / 2, 2) end);
    slot := slot + 1;
  end loop;
  return n_rows;
end;
$function$;

-- vod_chat_pick_jobs(integer)
CREATE OR REPLACE FUNCTION public.vod_chat_pick_jobs(p_limit integer DEFAULT 4)
 RETURNS TABLE(title_no bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with due as (
    select v.title_no, (j.title_no is null) as fresh,
      row_number() over(partition by (j.title_no is null)
        order by case when j.state is null and not j.complete then 0
          when not j.complete and coalesce((j.state->>'retries')::integer,0)=0 then 1 else 2 end,
          v.broadcast_day desc, v.title_no desc,
          coalesce(j.next_retry_at, '-infinity'::timestamptz)) as lane_rank
    from public.vod_archive v left join public.vod_chat_job j on j.title_no=v.title_no
    where v.auth_no in (101,107) and not v.upload and (j.title_no is null or j.next_retry_at<=now())
  )
  select d.title_no from due d
  order by d.lane_rank, case when (extract(epoch from now())::bigint / 1800) % 2=0
    then d.fresh::integer else (not d.fresh)::integer end
  limit greatest(1, least(coalesce(p_limit, 4), 20));
$function$;

-- vod_archive_sweep_commit(bigint,jsonb,boolean)
CREATE OR REPLACE FUNCTION public.vod_archive_sweep_commit(p_revision bigint, p_state jsonb, p_complete boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare current_revision bigint; removed integer := 0; gone bigint[]; started timestamptz;
begin
  perform pg_advisory_xact_lock(hashtextextended('vod-archive-sweep',0));
  select revision into current_revision from public.broadcast_work_state where key='vod-archive-sweep';
  if coalesce(current_revision,0) <> p_revision then return jsonb_build_object('accepted',false,'deleted',0); end if;
  if jsonb_typeof(p_state) is distinct from 'object' or jsonb_typeof(p_state->'rows') is distinct from 'array'
    or jsonb_array_length(p_state->'rows') > 10000 or pg_column_size(p_state) > 8388608 then
    raise exception 'Invalid archive checkpoint';
  end if;
  started := (p_state->>'startedAt')::timestamptz;
  if started is null or started > now() + interval '1 minute' then raise exception 'Invalid sweep clock'; end if;
  if p_complete then
    if jsonb_typeof(p_state->'dbRows') is distinct from 'array' or jsonb_array_length(p_state->'dbRows') <> jsonb_array_length(p_state->'rows') then raise exception 'Invalid archive projection'; end if;
    if jsonb_array_length(p_state->'rows')=0 or coalesce((p_state->>'nextPage')::int <= (p_state->>'lastPage')::int,true)
      or coalesce((p_state->>'lastPage')::int not between 1 and 500,true) then
      raise exception 'Incomplete archive sweep';
    end if;
    if exists(select 1 from jsonb_array_elements(p_state->'dbRows') r where
      (r->>'title_no')::bigint <= 0 or r->>'broadcast_day' is null) then raise exception 'Invalid archive row'; end if;
    insert into public.vod_archive(title_no,bno,broadcast_day,title,duration_ms,reg_date,comment_cnt,like_cnt,read_cnt,auth_no,thumb,synced_at)
    select r.title_no,r.bno,r.broadcast_day,r.title,r.duration_ms,r.reg_date,r.comment_cnt,r.like_cnt,r.read_cnt,r.auth_no,r.thumb,now()
    from jsonb_to_recordset(p_state->'dbRows') as r(title_no bigint,bno text,broadcast_day date,title text,duration_ms bigint,
      reg_date timestamptz,comment_cnt integer,like_cnt integer,read_cnt integer,auth_no integer,thumb text)
    on conflict(title_no) do update set bno=excluded.bno,broadcast_day=excluded.broadcast_day,title=excluded.title,
      duration_ms=excluded.duration_ms,reg_date=excluded.reg_date,comment_cnt=excluded.comment_cnt,
      like_cnt=excluded.like_cnt,read_cnt=excluded.read_cnt,auth_no=excluded.auth_no,thumb=excluded.thumb,synced_at=excluded.synced_at
    -- Preserve guest rows and incremental updates completed after this snapshot started.
    where not vod_archive.guest and not vod_archive.upload and vod_archive.synced_at <= started;
    select array_agg(v.title_no) into gone from public.vod_archive v
      where not v.guest and not v.upload and v.synced_at <= started and not exists(
        select 1 from jsonb_array_elements(p_state->'dbRows') r where (r->>'title_no')::bigint=v.title_no);
    if cardinality(gone) between 1 and 20 then
      delete from public.vod_timeline where title_no=any(gone);
      delete from public.vod_archive where title_no=any(gone);
      get diagnostics removed=row_count;
    end if;
  end if;
  insert into public.broadcast_work_state(key,revision,state,completed_at)
    values('vod-archive-sweep',p_revision+1,case when p_complete then null else p_state end,
      case when p_complete then clock_timestamp() else null end)
    on conflict(key) do update set revision=excluded.revision,state=excluded.state,
      completed_at=case when p_complete then excluded.completed_at else broadcast_work_state.completed_at end,updated_at=now();
  return jsonb_build_object('accepted',true,'deleted',removed);
end $function$;

-- get_public_broadcast_stats(date)
CREATE OR REPLACE FUNCTION public.get_public_broadcast_stats(p_from_day date)
 RETURNS TABLE(ym text, hours numeric, days integer, sessions integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with sess as (
    select
      start_day,
      extract(epoch from (coalesce(ended_at, last_live_at) - started_at)) as sec
    from public.broadcast_session
    where start_day >= p_from_day
  ),
  vod as (
    select v.broadcast_day as start_day, (v.duration_ms / 1000.0) as sec
    from public.vod_archive v
    where v.broadcast_day >= p_from_day
      and v.duration_ms > 0
      and v.guest = false and not v.upload
      and not exists (
        select 1 from public.broadcast_session b where b.start_day = v.broadcast_day
      )
  ),
  merged as (
    select * from sess
    union all
    select * from vod
  )
  select
    to_char(start_day, 'YYYY-MM') as ym,
    round((sum(sec) / 3600.0)::numeric, 1) as hours,
    count(distinct start_day)::int as days,
    count(*)::int as sessions
  from merged
  group by 1
  order by 1;
$function$;

-- get_public_broadcast_daily(date,date)
CREATE OR REPLACE FUNCTION public.get_public_broadcast_daily(p_from_day date, p_to_day date)
 RETURNS TABLE(day date, hours numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with sess as (
    select
      start_day as day,
      extract(epoch from (coalesce(ended_at, last_live_at) - started_at)) as sec
    from public.broadcast_session
    where start_day >= p_from_day and start_day <= p_to_day
  ),
  vod as (
    select v.broadcast_day as day, (v.duration_ms / 1000.0) as sec
    from public.vod_archive v
    where v.broadcast_day >= p_from_day and v.broadcast_day <= p_to_day
      and v.duration_ms > 0
      and v.guest = false and not v.upload
      and not exists (
        select 1 from public.broadcast_session b where b.start_day = v.broadcast_day
      )
  ),
  merged as (
    select * from sess
    union all
    select * from vod
  )
  select day, round((sum(sec) / 3600.0)::numeric, 2) as hours
  from merged
  group by 1
  order by 1;
$function$;

commit;
