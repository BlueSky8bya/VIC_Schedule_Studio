-- 0081: 시청자 검색 — 챕터 맥락(코너·상위 항목)으로 찾고, 보여준다.
--
-- 소유자(2026-09-18): "노래"를 치면 라벨에 '노래'가 든 챕터만이 아니라 **노래를 부른 구간 전부**가
-- 나와야 한다. 또 결과의 챕터가 방송의 어느 부분인지(빅이봤에서 듣는 노래인지, 직접 부르는 노래뱅인지)
-- 시각·글만으로는 모른다.
-- 팬 타임라인은 이미 [코너] 헤더(section: 소통·빅이봤·노래뱅·뱅종곡…, 전체 항목의 81%)와 "ㄴ" 계층
-- (depth, 19%)을 갖고 있다. 이것이 맥락이다:
--   · 색인에 section·parent(가장 가까운 상위 항목)를 함께 둔다.
--   · 검색은 라벨 + 코너 + 상위 항목에서 찾는다: "노래" → 코너 '노래뱅/풀트노래뱅/뱅종곡' 아래 모든 곡.
--     코너 적중 보너스 0.9(라벨 1.2 > 코너 0.9 > 관련어 0.5). 다단어는 세 필드를 합쳐 본다
--     ("빅이봤 노래" = 빅이봤 코너 안의 노래 항목).
--   · RPC가 section·parent를 돌려주고, 화면은 챕터 줄 위에 코너를 소제목처럼 붙인다(같은 코너가
--     이어지면 한 번만) — 유튜브 챕터 목록·넷플릭스 에피소드 그룹의 '섹션 헤더' 문법.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0081_public_search_chapter_context.sql

alter table public.vod_chapter_index
  add column if not exists section text not null default '',
  add column if not exists section_norm text not null default '',
  add column if not exists parent text not null default '',
  add column if not exists parent_norm text not null default '',
  add column if not exists depth integer not null default 0;
create index if not exists idx_vod_chapter_section_trgm
  on public.vod_chapter_index using gin (section_norm gin_trgm_ops);

-- 재구성: 시각순으로 훑으며 depth 0 항목을 '상위'로 기억한다. 코너는 항목이 가진 section.
create or replace function public.vod_chapter_index_rebuild(p_title_no bigint, p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.vod_chapter_index where title_no = p_title_no;
  insert into public.vod_chapter_index (title_no, sec, label, label_norm, label_cho, section, section_norm, parent, parent_norm, depth)
  select distinct on (p_title_no, x.sec, x.label)
    p_title_no, x.sec, x.label,
    public.search_norm(x.label),
    public.search_choseong(x.label),
    x.section,
    public.search_norm(x.section),
    x.parent,
    public.search_norm(x.parent),
    x.depth
  from (
    select
      (e->>'sec')::int as sec,
      e->>'label' as label,
      coalesce(e->>'section', '') as section,
      coalesce((e->>'depth')::int, 0) as depth,
      -- 상위 항목: 자기보다 앞선(ord) 마지막 depth 0 항목의 라벨(자기가 depth 0이면 없음)
      case when coalesce((e->>'depth')::int, 0) > 0 then
        coalesce((
          select p->>'label'
          from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) with ordinality as q(p, pord)
          where pord < ord and coalesce((p->>'depth')::int, 0) = 0 and length(coalesce(p->>'label', '')) > 0
          order by pord desc limit 1
        ), '')
      else '' end as parent
    from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) with ordinality as t(e, ord)
    where jsonb_typeof(e) = 'object'
      and (e->>'sec') ~ '^[0-9]+$'
      and length(coalesce(e->>'label', '')) > 0
      and length(public.search_norm(e->>'label')) > 0
  ) x;
end;
$$;

-- 백필(코너·상위 항목 채우기) — 전 타임라인 한 번.
do $$
declare r record;
begin
  for r in select title_no, entries from public.vod_timeline where entry_count > 0 loop
    perform public.vod_chapter_index_rebuild(r.title_no, r.entries);
  end loop;
end $$;

-- '노래' 의도 보강: 부르는 구간을 가리키는 코너·표현을 관련어로.
create or replace function public.search_related_seed_extra()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  groups text[] := array[
    '노래|노래뱅|풀트노래뱅|뱅종곡|엔딩곡|커버|라이브|노래방|싱스트림|노래타임|곡',
    '춤|댄스|안무|커버댄스|풀트춤',
    '빅이봤|영상|리액션|유튜브|클립|영상보기',
    '소통|후열소통|풀트소통|잡담|토크|노가리'
  ];
  g text[];
  i int; j int; k int;
begin
  delete from public.search_synonyms where source = 'seed-rel2';
  for i in 1 .. array_length(groups, 1) loop
    g := array_remove(array(select public.search_norm(x) from unnest(string_to_array(groups[i], '|')) as x), '');
    for j in 1 .. array_length(g, 1) loop
      for k in 1 .. array_length(g, 1) loop
        if j <> k then
          insert into public.search_synonyms (term, alt, source, kind) values (g[j], g[k], 'seed-rel2', 'rel')
          on conflict (term, alt) do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;
select public.search_related_seed_extra();

-- 전수조사(2026-09-18, 말뭉치 1·2자 토큰·태그·긴 단어 빈도)로 채운 줄임말 — 한 글자 포함.
create or replace function public.search_synonyms_seed_extra()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  groups text[] := array[
    '메|메이플|메이플스토리|메이플의날',
    '주보|주간보스',
    '맵|유즈맵',
    '구플뱅|구플|플러스뱅송|플러스방송|플러스',
    '리캡보기|리캡',
    '카페보기|카페',
    '오픈런|오픈',
    '체육대회|왁타버스체육대회|왁체',
    '고카상사|고카',
    '슬더스|슬레이더스파이어|슬더스2',
    '명방|명일방주',
    '마듀|마스터듀얼|유희왕',
    '팰월드|palworld',
    '배크|배틀크러쉬',
    '릴동파|릴동파2',
    '아카데미|하루고멤아카데미|고멤아카데미|고멤아카',
    '천타|천타버스',
    '뢴가|뢴가스터디',
    '명조의날|명조',
    'fc|fc25|fc26|피파',
    '비방|비밀방송',
    '시참|시청자참여|시청자참여방송'
  ];
  g text[];
  i int; j int; k int;
begin
  delete from public.search_synonyms where source = 'seed2';
  for i in 1 .. array_length(groups, 1) loop
    g := array_remove(array(select public.search_norm(x) from unnest(string_to_array(groups[i], '|')) as x), '');
    for j in 1 .. array_length(g, 1) loop
      for k in 1 .. array_length(g, 1) loop
        if j <> k then
          insert into public.search_synonyms (term, alt, source, kind) values (g[j], g[k], 'seed2', 'syn')
          on conflict (term, alt) do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;
select public.search_synonyms_seed_extra();

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
  popularity numeric,
  section text,
  parent text,
  matched_on text
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
      -- 한 글자 질의는 사전에 있을 때만(메·롤·숲·겜) — 아니면 소음. 토큰도 같은 규칙.
      (length(public.search_norm(p_q)) >= 2
        or exists (select 1 from public.search_synonyms s where s.term = public.search_norm(p_q))) as min_ok,
      array_remove(array(
        select public.search_norm(t) from regexp_split_to_table(coalesce(p_q, ''), '\s+') as t
        where length(public.search_norm(t)) >= 2
           or exists (select 1 from public.search_synonyms s where s.term = public.search_norm(t))
      ), '') as toks
  ),
  q1 as (
    select
      q0.qn, q0.is_cho, q0.toks, q0.min_ok,
      -- 한 글자 질의(메·롤)는 글자 자체로는 찾지 않는다("메카"·"메이린"이 다 걸린다) — 사전 확장만.
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
    select case when q.is_cho then c.label_cho else c.label_norm || '|' || c.section_norm || '|' || c.parent_norm end from public.vod_chapter_index c, q1 q
  ),
  q as (
    select
      q1.qn, q1.is_cho, q1.alts, q1.tokg as toks, q1.min_ok,
      case when cardinality(q1.alts) = 0 then '(?!)' else '(' || array_to_string(q1.alts, '|') || ')' end as qre,
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
      pop::numeric as popularity,
      ''::text as section, ''::text as parent,
      case when hit_t then 'title' when hit_g then 'tag' when hit_d then 'description' when q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0 then 'tokens' when hit_r then 'related' when hit_ab then 'abbrev' else 'fuzzy' end as matched_on
    from evm ev, q
    where q.min_ok and (
      hit_t or hit_g or hit_d or hit_r or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)
      or (length(q.qn) >= 2 and similarity(ev.tnm, q.qn) >= 0.25)
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
      (g.engagement / 0.8)::numeric as popularity,
      ''::text as section, ''::text as parent,
      case when hit_t then 'title' when q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0 then 'tokens' when hit_r then 'related' when hit_ab then 'abbrev' else 'fuzzy' end as matched_on
    from vodm v
    join vod_engage g on g.title_no = v.title_no, q
    where q.min_ok and (
      hit_t or hit_r or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)
      or (length(q.qn) >= 2 and similarity(v.tnm, q.qn) >= 0.25)
    )
  ),
  -- 챕터: 라벨(cm) + 코너/상위(ctx). 초성 모드는 라벨 초성열만.
  chm as (
    select c.title_no, c.sec, c.label, c.section, c.parent,
      case when q.is_cho then c.label_cho else c.label_norm end as cm,
      c.label_norm || '|' || c.section_norm || '|' || c.parent_norm as cmx,
      (case when q.is_cho then c.label_cho else c.label_norm end) ~ q.qre as hit_t,
      (not q.is_cho and (c.section_norm || '|' || c.parent_norm) ~ q.qre) as hit_s,
      (q.qrel is not null and (c.label_norm || '|' || c.section_norm || '|' || c.parent_norm) ~ q.qrel) as hit_r,
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
            when c.hit_s then 0.9
            when q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) > 0 then 1.0 * public.search_tok_ratio(c.cmx, q.toks, q.tokw)
            when c.hit_r then 0.5
            when c.hit_ab then 0.4
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (c.hit_t or c.hit_s or c.hit_r or (q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) >= 0.5)) as exact,
      (g.engagement / 0.8)::numeric as popularity,
      c.section, c.parent,
      case when c.hit_t then 'label' when c.hit_s then 'section' when q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) > 0 then 'tokens' when c.hit_r then 'related' when c.hit_ab then 'abbrev' else 'fuzzy' end as matched_on
    from chm c
    join vods v on v.title_no = c.title_no
    join vod_engage g on g.title_no = c.title_no, q
    where q.min_ok and (
      c.hit_t or c.hit_s or c.hit_r or c.hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) >= 0.5)
      or (length(q.qn) >= 2 and similarity(c.cm, q.qn) >= 0.3)
    )
  ),
  merged as (
    select * from ev_scored union all select * from vod_scored union all select * from ch_scored
  )
  select kind, event_id, title_no, sec, date_key, start_time, title, snippet, duration_ms, host_nick,
         round(score, 4) as score, exact, round(popularity, 4) as popularity, section, parent, matched_on
  from merged
  order by exact desc, score desc, date_key desc, sec asc nulls first
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;
comment on function public.search_public(uuid, text, integer) is
  '시청자 검색(0076~0081) — 챕터는 라벨+코너+상위 항목으로 찾고 section/parent/matched_on을 돌려준다. 공개 데이터만.';
grant execute on function public.search_public(uuid, text, integer) to anon, authenticated;
