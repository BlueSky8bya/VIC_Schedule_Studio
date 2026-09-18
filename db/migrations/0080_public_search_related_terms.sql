-- 0080: 시청자 검색 — 관련어(동의어보다 약한 관계) + 단어 공출현 그래프(PPMI).
--
-- 소유자(2026-09-18): "할나"(할로우나이트)로 치면 "실크송"도 같이 나오고, 반대도. 둘은 같은 말이
-- 아니라 **관련된** 말이다. 그래서 두 등급으로 나눈다:
--   · syn(동의어): 같은 것(배그=배틀그라운드) → 정확 적중과 같은 보너스(1.2).
--   · rel(관련어): 같은 시리즈/짝(할나~실크송, 야숲~티오킹) → 낮은 보너스(0.5)로 **결과에 포함**되되
--     직접 적중 아래에 선다. 출처 = 큐레이션(seed) + 말뭉치 자동(auto).
-- 자동 관련어는 토리님 방송 말뭉치에서 배운다(웹 일반 사전보다 이 방송에 맞는 것이 우선이라는 소유자
-- 결정): 같은 방송(제목+챕터) 안 단어 공출현 PPMI 행렬 = 단어 임베딩(행 = 단어 벡터). 이웃 상위가
-- 관련어. 사람 이름 그래프(0079)와 같은 구조를 모든 단어로 넓힌 것.
-- 화면: 결과 위 "관련 검색어" 칩(유튜브·구글 related searches) — 탭하면 그 말로 검색.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0080_public_search_related_terms.sql

alter table public.search_synonyms add column if not exists kind text not null default 'syn';

-- 큐레이션 관련어(양방향, kind='rel'). 동의어 묶음과 달리 '같은 시리즈·짝'만.
create or replace function public.search_related_seed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  groups text[] := array[
    '할나|할로우나이트|실크송|hollowknight|silksong',
    '젤다|젤다의전설|야숲|티오킹|왕눈|시간의오카리나',
    '포켓몬|포켓몬스터|포켓몬레전드|레전드za|포켓몬고',
    '엘든|엘든링|나이트레인|다크소울|프롬',
    '몬헌|몬스터헌터|와일즈|월드|라이즈',
    '옵치|오버워치|오버워치2',
    '롤|리그오브레전드|롤토체스|tft',
    '배그|배틀그라운드|치킨',
    '마크|마인크래프트|서버|건축|야생',
    '스타|스타크래프트|스타2|유즈맵',
    '발로|발로란트|배치고사',
    '데바데|데드바이데이라이트|공포겜|공포게임',
    '메이플|메이플스토리|주간보스|보스',
    '명조|명조워더링웨이브|원신|붕스|붕괴스타레일',
    '갈틱|갈틱폰|어몽|어몽어스|마피아|파티겜',
    '노래뱅|노래|싱스트림|노래방',
    '합방|콜라보|게스트',
    '풀트|풀트래킹|모캡|3d'
  ];
  g text[];
  i int; j int; k int;
begin
  delete from public.search_synonyms where source = 'seed-rel';
  for i in 1 .. array_length(groups, 1) loop
    g := array_remove(array(select public.search_norm(x) from unnest(string_to_array(groups[i], '|')) as x), '');
    for j in 1 .. array_length(g, 1) loop
      for k in 1 .. array_length(g, 1) loop
        if j <> k then
          insert into public.search_synonyms (term, alt, source, kind) values (g[j], g[k], 'seed-rel', 'rel')
          on conflict (term, alt) do nothing; -- 이미 동의어(syn)면 그대로 둔다(더 강한 관계 우선)
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

-- 단어 공출현 그래프(모든 단어) — 인물 그래프(0079)와 같은 꼴.
create table if not exists public.search_terms (
  term text primary key,   -- 정규화 단어
  docs integer not null default 0,
  last_day date
);
create table if not exists public.search_term_relations (
  a text not null,
  b text not null,         -- a < b
  co_docs integer not null default 0,
  ppmi numeric not null default 0,
  primary key (a, b)
);
create index if not exists idx_search_term_relations_b on public.search_term_relations (b);
alter table public.search_terms enable row level security;
alter table public.search_term_relations enable row level security;
drop policy if exists search_terms_public_read on public.search_terms;
create policy search_terms_public_read on public.search_terms for select to anon, authenticated using (true);
drop policy if exists search_term_relations_public_read on public.search_term_relations;
create policy search_term_relations_public_read on public.search_term_relations for select to anon, authenticated using (true);
grant select on public.search_terms, public.search_term_relations to anon, authenticated;
grant select, insert, update, delete on public.search_terms, public.search_term_relations to service_role;

-- 단어 추출 규칙: 한글 2~6자 또는 영숫자 3~12자. 존칭 "님"은 뗀다(인물 그래프와 이름이 맞도록).
-- 불용어: 방송 진행 상투어.
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
    select least(x.w, y.w) as a, greatest(x.w, y.w) as b, count(distinct x.doc)::int as co
    from tmp_tw x
    join tmp_tw y on y.doc = x.doc and y.w > x.w
    where x.w in (select term from public.search_terms) and y.w in (select term from public.search_terms)
    group by 1, 2
    having count(distinct x.doc) >= 3
  ),
  scored as (
    select p.a, p.b, p.co,
      greatest(0, ln((p.co::numeric * n.total) / (ta.docs::numeric * tb.docs::numeric)))::numeric as ppmi
    from pairs p
    join public.search_terms ta on ta.term = p.a
    join public.search_terms tb on tb.term = p.b, n
  )
  insert into public.search_term_relations (a, b, co_docs, ppmi)
  select a, b, co, ppmi from scored where ppmi >= 0.5;

  -- 자동 관련어(kind='rel', source='auto-rel'): 강한 이웃만(ppmi ≥ 2, 공출현 ≥ 4) — 순위 포함은 이
  -- 등급이 아니라 '관련 검색어' 칩용. 순위에 넣는 관련어는 큐레이션(seed-rel)뿐(소음 방지).
  delete from public.search_synonyms where source = 'auto-rel';
  insert into public.search_synonyms (term, alt, source, kind, support)
  select r.a, r.b, 'auto-rel', 'rel-chip', r.co_docs from public.search_term_relations r where r.ppmi >= 2 and r.co_docs >= 4
  union all
  select r.b, r.a, 'auto-rel', 'rel-chip', r.co_docs from public.search_term_relations r where r.ppmi >= 2 and r.co_docs >= 4
  on conflict (term, alt) do nothing;

  return n_terms;
end;
$$;
grant execute on function public.search_term_graph_rebuild() to service_role;

-- 관련 검색어: 질의 단어(또는 동의어)의 이웃 상위 N — 동의어 자체와 질의는 뺀다. 사람 이름도 섞인다.
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
    -- 큐레이션 관련어는 항상 앞에(있으면)
    select s.alt as term, 9999 as co_docs, 100::numeric as score, 'rel'::text as kind
    from public.search_synonyms s, q where s.term = q.qn and s.kind = 'rel'
  ),
  neigh as (
    select case when r.a = m.t then r.b else r.a end as term, r.co_docs,
           (r.ppmi * ln(1 + r.co_docs))::numeric as score, 'auto'::text as kind
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
    and a.term not in (select e.name from public.search_entities e) -- 사람은 search_related가 따로 준다
    -- 자동 이웃의 잡음 거름: 조사·어미로 끝나는 조각("인줄","알았으나","불독님과")·너무 흔한 말은 뺀다
    and (a.kind = 'rel' or (
      a.co_docs >= 4
      and a.term !~ '(님과|님의|과|와|의|는|던|기|인줄|으나|는데|해서|이서|에서|으로|까지|부터|이고|하고|라고|다고|나요|네요|어요|아요|세요|봤어|했어|합니다|입니다|했다|한다|되는|있는|없는)$'
      and a.term !~ '^(일부|근황|확인|컨텐츠|게임|시작|종료|오늘|내일|이어서|다시|이제|그냥|정말|진짜)$'
    ))
  group by a.term
  order by max(a.score) desc, max(a.co_docs) desc
  limit greatest(1, least(coalesce(p_limit, 8), 30));
$$;
grant execute on function public.search_related_terms(text, integer) to anon, authenticated;

-- 검색 RPC: 관련어(kind='rel') 확장 추가 — 낮은 보너스(0.5), exact=true(결과 본문에 포함).
drop function if exists public.search_public(uuid, text, integer);
create function public.search_public(p_calendar_id uuid, p_q text, p_limit integer default 50)
returns table (
  kind text,
  event_id uuid,
  title_no bigint,
  sec integer,
  date_key date,
  start_time time,
  title text,
  snippet text,
  duration_ms bigint,
  host_nick text,
  score numeric,
  exact boolean,
  popularity numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with q0 as (
    select
      public.search_norm(p_q) as qn,
      public.search_norm(p_q) ~ '^[ㄱ-ㅎ]+$' as is_cho,
      array_remove(array(
        select public.search_norm(t) from regexp_split_to_table(coalesce(p_q, ''), '\s+') as t
        where length(public.search_norm(t)) >= 2
      ), '') as toks
  ),
  q1 as (
    select
      q0.qn, q0.is_cho, q0.toks,
      case when q0.is_cho then array[q0.qn]
           else array_prepend(q0.qn, array(select s.alt from public.search_synonyms s where s.term = q0.qn and s.kind = 'syn')) end as alts,
      case when q0.is_cho then array[]::text[]
           else array(select s.alt from public.search_synonyms s where s.term = q0.qn and s.kind = 'rel') end as rels,
      case when q0.is_cho then q0.toks
           else array(
             select t.tok || coalesce('|' || string_agg(s.alt, '|'), '')
             from unnest(q0.toks) with ordinality as t(tok, ord)
             left join public.search_synonyms s on s.term = t.tok and s.kind = 'syn'
             group by t.tok, t.ord order by t.ord
           ) end as tokg
    from q0
  ),
  ev as (
    select
      e.id, e.date_key, e.start_time, e.public_title,
      coalesce(e.public_description, '') as descr,
      public.search_norm(e.public_title) as tn,
      public.search_norm(e.public_description) as dn,
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
      v.title_no, v.broadcast_day, v.title, v.duration_ms, v.host_nick,
      v.read_cnt, v.like_cnt, v.comment_cnt,
      public.search_norm(v.title) as tn,
      coalesce(t.entry_count, 0) as entry_count
    from public.vod_archive v
    left join public.vod_timeline t on t.title_no = v.title_no
    where v.auth_no = 101
  ),
  corpus as (
    select case when q.is_cho then public.search_choseong(ev.tn || ev.tagn || ev.dn) else ev.tn || ev.tagn || ev.dn end as norm
    from ev, q1 q
    union all
    select case when q.is_cho then public.search_choseong(v.tn) else v.tn end from vods v, q1 q
    union all
    select case when q.is_cho then c.label_cho else c.label_norm end from public.vod_chapter_index c, q1 q
  ),
  q as (
    select
      q1.qn, q1.is_cho, q1.alts, q1.tokg as toks,
      '(' || array_to_string(q1.alts, '|') || ')' as qre,
      case when cardinality(q1.rels) = 0 then null else '(' || array_to_string(q1.rels, '|') || ')' end as qrel,
      (not q1.is_cho and length(q1.qn) between 2 and 4) as abbrev_on,
      '%' || substr(q1.qn, 1, 1) || '%' || substr(q1.qn, length(q1.qn), 1) || '%' as ablike,
      array(
        select (ln(((select count(*) from corpus) + 1.0) / ((select count(*) from corpus where corpus.norm ~ ('(' || t.tok || ')')) + 1.0)) + 1)::numeric
        from unnest(q1.tokg) with ordinality as t(tok, ord)
        order by t.ord
      ) as tokw,
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
      (case when q.is_cho then public.search_choseong(ev.tn) else ev.tn end) ~ q.qre as hit_t,
      (case when q.is_cho then public.search_choseong(ev.tagn) else ev.tagn end) ~ q.qre as hit_g,
      (case when q.is_cho then public.search_choseong(ev.dn) else ev.dn end) ~ q.qre as hit_d,
      (q.qrel is not null and (ev.tn || ev.tagn || ev.dn) ~ q.qrel) as hit_r,
      (case when not q.abbrev_on or ev.tn !~~ q.ablike or (ev.tn ~ q.qre) then false
            else public.search_abbrev_match(q.qn, ev.public_title) end) as hit_ab,
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
      (
        greatest(3.0 * similarity(ev.tnm, q.qn), 1.2 * similarity(ev.tagnm, q.qn), 0.7 * similarity(ev.dnm, q.qn))
        + case
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
      (hit_t or hit_g or hit_d or hit_r or (q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)) as exact,
      pop::numeric as popularity
    from evm ev, q
    where length(q.qn) >= 2 and (
      hit_t or hit_g or hit_d or hit_r or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)
      or similarity(ev.tnm, q.qn) >= 0.25
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
      (case when q.is_cho then public.search_choseong(v.tn) else v.tn end) ~ q.qre as hit_t,
      (q.qrel is not null and v.tn ~ q.qrel) as hit_r,
      (case when not q.abbrev_on or v.tn !~~ q.ablike or (v.tn ~ q.qre) then false
            else public.search_abbrev_match(q.qn, v.title) end) as hit_ab
    from vods v, q
  ),
  vod_scored as (
    select
      'vod'::text as kind, null::uuid as event_id, v.title_no, null::integer as sec,
      v.broadcast_day as date_key, null::time as start_time, v.title, ''::text as snippet,
      v.duration_ms, nullif(v.host_nick, '') as host_nick,
      (
        2.0 * similarity(v.tnm, q.qn)
        + case
            when hit_t then 1.2
            when q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0 then 1.0 * public.search_tok_ratio(v.tnm, q.toks, q.tokw)
            when hit_r then 0.5
            when hit_ab then 0.4
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (hit_t or hit_r or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)) as exact,
      (g.engagement / 0.8)::numeric as popularity
    from vodm v
    join vod_engage g on g.title_no = v.title_no, q
    where length(q.qn) >= 2 and (
      hit_t or hit_r or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)
      or similarity(v.tnm, q.qn) >= 0.25
    )
  ),
  chm as (
    select c.title_no, c.sec, c.label,
      case when q.is_cho then c.label_cho else c.label_norm end as cm,
      (case when q.is_cho then c.label_cho else c.label_norm end) ~ q.qre as hit_t,
      (q.qrel is not null and c.label_norm ~ q.qrel) as hit_r,
      (case when not q.abbrev_on or c.label_norm !~~ q.ablike or (c.label_norm ~ q.qre) then false
            else public.search_abbrev_match(q.qn, c.label) end) as hit_ab
    from public.vod_chapter_index c, q
  ),
  ch_scored as (
    select
      'chapter'::text as kind, null::uuid as event_id, c.title_no, c.sec,
      v.broadcast_day as date_key, null::time as start_time, c.label as title, v.title as snippet,
      v.duration_ms, nullif(v.host_nick, '') as host_nick,
      (
        1.5 * similarity(c.cm, q.qn)
        + case
            when c.hit_t then 1.2
            when q.ntok > 1 and public.search_tok_ratio(c.cm, q.toks, q.tokw) > 0 then 1.0 * public.search_tok_ratio(c.cm, q.toks, q.tokw)
            when c.hit_r then 0.5
            when c.hit_ab then 0.4
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (c.hit_t or c.hit_r or (q.ntok > 1 and public.search_tok_ratio(c.cm, q.toks, q.tokw) >= 0.5)) as exact,
      (g.engagement / 0.8)::numeric as popularity
    from chm c
    join vods v on v.title_no = c.title_no
    join vod_engage g on g.title_no = c.title_no, q
    where length(q.qn) >= 2 and (
      c.hit_t or c.hit_r or c.hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(c.cm, q.toks, q.tokw) >= 0.5)
      or similarity(c.cm, q.qn) >= 0.3
    )
  ),
  merged as (
    select * from ev_scored union all select * from vod_scored union all select * from ch_scored
  )
  select kind, event_id, title_no, sec, date_key, start_time, title, snippet, duration_ms, host_nick,
         round(score, 4) as score, exact, round(popularity, 4) as popularity
  from merged
  order by exact desc, score desc, date_key desc, sec asc nulls first
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
comment on function public.search_public(uuid, text, integer) is
  '시청자 검색(0076~0080) — 동의어(syn)·관련어(rel, 낮은 보너스)·줄임말·IDF·초성·exact·popularity. 공개 데이터만.';
grant execute on function public.search_public(uuid, text, integer) to anon, authenticated;

select public.search_related_seed();
select public.search_term_graph_rebuild();
