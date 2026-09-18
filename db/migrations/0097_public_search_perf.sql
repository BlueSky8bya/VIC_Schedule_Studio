-- 0097: 검색 성능 — 채팅 적중(0093)을 정규식 전수 스캔에서 인덱스 동등 비교로, 트렌딩은 최근 방송 채팅만.
-- 실측(2026-09-18): 백필로 vod_chat_terms가 커지자 search_public 1~3초, 부하 땐 "canceling statement due to statement timeout"
-- → 시청자 화면 "검색이 잠시 안 돼요". 원인은 chat_scored의 t.term ~ '^(…)$'(백만 행 regex). q.alts(질의+동의어 배열) 동등 비교로.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0097_public_search_perf.sql

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
  thumb text,
  score numeric,
  exact boolean,
  popularity numeric,
  section text,
  parent text,
  matched_on text,
  corrected text
)
language sql
stable
security definer
set search_path = public
as $$
  with qc as materialized (
    -- 오타 교정(0086/0087): 질의가 사전에 없으면 가장 가까운 사전어로. 초성·한 글자·다단어는 교정 안 함.
    select
      public.search_norm(p_q) as qn0,
      case
        when public.search_norm(p_q) ~ '^[ㄱ-ㅎ]+$' or length(public.search_norm(p_q)) < 2 or p_q ~ '\s' then null
        when exists (select 1 from public.search_synonyms s where s.term = public.search_norm(p_q))
          or exists (select 1 from public.search_intents i where i.term = public.search_norm(p_q))
          or exists (select 1 from public.search_entities e where e.name = public.search_norm(p_q))
          or exists (select 1 from public.search_games g where g.norm = public.search_norm(p_q)) then null
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
      q1.qn, q1.is_cho, q1.alts, q1.tokg as toks, q1.min_ok, q1.corrected, q1.song_intent, q1.dance_intent, q1.hum_intent, q1.game_intent, q1.rest_toks,
      (cardinality(q1.genre_terms) > 0) as genre_intent,
      (select re from genre_games) as gre2,
      case when cardinality(q1.alts) = 0 then '(?!)' else '(' || array_to_string(q1.alts, '|') || ')' end as qre,
      case when cardinality(q1.rels) = 0 then null else '(' || array_to_string(q1.rels, '|') || ')' end as qrel,
      case when cardinality(q1.rest_toks) = 0 then null else '(' || array_to_string(q1.rest_toks, '|') || ')' end as qrest,
      (select re from games) as gre,
      -- 두 글자 한글 질의(사전 확장 없음)는 정규화(띄어쓰기 제거) 문자열이 아니라 **원문**에서 붙어 있어야 적중
      -- (0091, 소유자: "이게"가 "이 게임"에 걸렸다). 사전어(메·롤 확장, 배그)는 alts가 2개 이상이라 제외.
      (not q1.is_cho and q1.corrected is null and length(q1.qn) = 2 and cardinality(q1.alts) = 1 and q1.qn ~ '^[가-힣]+$') as short2,
      lower(trim(coalesce(p_q, ''))) as qraw,
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
      ((case when q.is_cho then public.search_choseong(ev.tn) else ev.tn end) ~ q.qre and (not q.short2 or ev.traw like '%' || q.qraw || '%')) as hit_t,
      ((case when q.is_cho then public.search_choseong(ev.tagn) else ev.tagn end) ~ q.qre and (not q.short2 or ev.graw like '%' || q.qraw || '%')) as hit_g,
      ((case when q.is_cho then public.search_choseong(ev.dn) else ev.dn end) ~ q.qre and (not q.short2 or ev.draw like '%' || q.qraw || '%')) as hit_d,
      (q.qrel is not null and (ev.tn || ev.tagn || ev.dn) ~ q.qrel) as hit_r,
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
      ((case when q.is_cho then public.search_choseong(v.tn) else v.tn end) ~ q.qre and (not q.short2 or lower(v.title) like '%' || q.qraw || '%')) as hit_t,
      (q.qrel is not null and v.tn ~ q.qrel) as hit_r,
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
      or (length(q.qn) >= 2 and similarity(v.tnm, q.qn) >= 0.25)
    )
  ),
  chm as (
    select c.title_no, c.sec, c.label, c.section, c.parent, c.song_kind,
      case when q.is_cho then c.label_cho else c.label_norm end as cm,
      c.label_norm || '|' || c.section_norm || '|' || c.parent_norm as cmx,
      ((case when q.is_cho then c.label_cho else c.label_norm end) ~ q.qre and (not q.short2 or lower(c.label) like '%' || q.qraw || '%')) as hit_t,
      (not q.is_cho and (c.section_norm || '|' || c.parent_norm) ~ q.qre and (not q.short2 or lower(c.section || '|' || c.parent) like '%' || q.qraw || '%')) as hit_s,
      (q.qrel is not null and (c.label_norm || '|' || c.section_norm || '|' || c.parent_norm) ~ q.qrel) as hit_r,
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
      and not exists (select 1 from chm c where c.title_no = t.title_no and (c.hit_t or c.hit_s))
      and not exists (select 1 from vodm x where x.title_no = t.title_no and x.hit_t)
  ),
  merged as (
    select * from ev_scored union all select * from vod_scored union all select * from ch_scored union all select * from chat_scored
  )
  select kind, event_id, title_no, sec, date_key, start_time, title, snippet, duration_ms, host_nick, thumb,
         round(score, 4) as score, exact, round(popularity, 4) as popularity, section, parent, matched_on, corrected
  from merged
  order by exact desc, score desc, date_key desc, sec asc nulls first
  limit greatest(1, least(coalesce(p_limit, 50), 400));
$$;
comment on function public.search_public(uuid, text, integer) is
  '시청자 검색(0076~0097) — 오타 교정(자모 편집거리) + 공연 종류·종겜 의도·챕터 코너·동의어/관련어/줄임말/IDF/초성. 공개 데이터만.';
grant execute on function public.search_public(uuid, text, integer) to anon, authenticated;


-- 트렌딩(0079/0088/0089 재정의): 채팅 단어는 말뭉치·사전에 있는 것만.
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
    select day, lower(x) as w, 1 as n
    from docs, regexp_split_to_table(txt, '[^가-힣a-zA-Z0-9]+') as x
    where x ~ '^[가-힣]{2,6}$'
    union all
    select v.broadcast_day, t.term, least(t.cnt, 30)
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no = 101
    where v.broadcast_day >= current_date - make_interval(days => greatest(1, coalesce(p_days, 30)) + 180)
      and t.cnt >= 3 and t.term ~ '^[가-힣]{2,6}$' and t.term in (select w from known)
  ),
  stop as (
    select unnest(array['토리님','토리','빅토리','빅토리님','방송','시작','종료','오늘','내일','시간','잠깐','다시','이야기','토리가','우리','그냥','정말','진짜','후열','엔딩','멘트','휴식','시청자','새로운','요즘','오늘도','이번','다음','처음','마지막','드디어','바로',
      'ㅋㅋㅋ','ㅋㅋ','ㅠㅠ','ㅎㅎ','아니','근데','뭐야','진짜','대박','와우','헐','오오','ㄷㄷ','ㄹㅇ','ㅇㅇ','ㄴㄴ','ㅇㅋ','ㄱㄱ','ㅈㅈ',
      '아니야','이게','그게','저게','이거','그거','저거','이제','지금','여기','거기','저기','사실','아마','약간','조금','많이','이미','계속','다시','거의','정말로','솔직히','하는','있는','없는','같은','너무','이런','그런','저런','어떻게','왜요','뭐지','뭔데','맞아','맞다','그치','네네','아하']) as w
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
