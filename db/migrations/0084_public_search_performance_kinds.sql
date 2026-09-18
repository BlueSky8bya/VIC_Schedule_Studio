-- 0084: 시청자 검색 — 공연 종류 세분화: 부른 곡 / 틀어준 곡 / 춤(챌린지) / 허밍 / 수다.
--
-- 소유자(2026-09-18): "노래"에 춤·챌린지·수다까지 섞여 나온다. 잼민토리 시절의 스토리(수다), 예나 - 캐치캐치
-- (춤 챌린지), 나비보벳따우(허밍)를 갈라 달라.
-- 신호(전부 팬 타임라인 텍스트·구조에서):
--   · 팬 이모지: 🎤 = 직접 부름. 🎵/🎶 = 곡인데, 같은 방송에서 🎤도 쓰였다면 🎵는 '틀어준 곡'(작성자가 둘을
--     구분한 것), 춤 코너 안이면 춤곡, 아니면 부른 곡. 🕺💃 = 춤.
--   · 코너: 춤·댄스·안무·챌린지·짤래뱅 = 춤 / 노래뱅·래뱅·뱅종곡·노래방 = 부름 / 월드컵·빅이봤·플리 = 듣기.
--   · 라벨: 챌린지·댄스·커버댄스·안무·숏츠·릴스·틱톡 = 춤. 허밍·흥얼·콧노래·나비보벳따우·랄랄라 = 허밍.
--     스토리·썰·이야기·시절·근황·반응·질문·ㅋㅋ… = 수다(코너가 노래뱅이어도 곡 아님).
-- song_kind: sung | listen | dance | hum | null(수다·기타). 의도: 노래→sung(허밍은 뒤에), 춤/챌린지→dance, 허밍→hum.
-- 화면: 종류별 아이콘 하나(♪ 부름·🎧 듣기·춤·허밍), 팬 이모지는 표시에서 뗀다(중복 방지, 원문은 툴팁).
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0084_public_search_performance_kinds.sql

insert into public.search_intents (term, intent)
select public.search_norm(t), 'dance' from unnest(array[
  '춤','댄스','안무','챌린지','챌','커버댄스','춤뱅','댄스뱅','풀트춤','짤래뱅','숏츠','쇼츠','릴스','틱톡','tiktok','dance','challenge','춤추기','춤추는'
]) as t
on conflict (term) do update set intent = excluded.intent;
insert into public.search_intents (term, intent)
select public.search_norm(t), 'hum' from unnest(array['허밍','흥얼','흥얼거림','콧노래','나비보벳따우','랄랄라']) as t
on conflict (term) do update set intent = excluded.intent;

create or replace function public.search_song_section_kind(p_section text)
returns text
language sql
immutable
parallel safe
as $$
  select case
    when p_section is null or p_section = '' then null
    when p_section ~* '춤|댄스|dance|안무|챌린지|challenge|짤래뱅' then 'dance'
    when p_section ~* '월드컵|[0-9]+강|라운드|round|빅이봤|영상|플리|리스닝|playlist|추천|듣기' then 'listen'
    when p_section ~* '노래|노래방|빅래뱅|래뱅|뱅종곡|방종곡|커버|싱스트림|sing|karaoke' then 'sung'
    else null
  end;
$$;

create or replace function public.search_song_refresh()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  -- 1) 가수 사전: 부르는·춤 코너의 "가수 - 곡"에서. 진행 표식·사람 언급 제외.
  delete from public.search_artists;
  insert into public.search_artists (name, display, songs)
  select public.search_norm(sp.artist), min(sp.artist), count(*)::int
  from public.vod_chapter_index c
  cross join lateral public.search_song_split(c.label) sp
  where public.search_song_section_kind(c.section) in ('sung', 'dance')
    and length(public.search_norm(sp.artist)) between 1 and 20
    and sp.artist !~ '님|시작|종료|끝|인사|멘트|가리|준비|세팅|연습|게임|라운드|번째|시절|스토리'
  group by public.search_norm(sp.artist)
  having count(*) >= 2;

  -- 2) 항목 분류
  update public.vod_chapter_index c
  set song_kind = x.kind, artist = x.artist
  from (
    with mic as (
      select title_no from public.vod_chapter_index where label ~ '🎤' group by title_no
    )
    select c2.title_no, c2.sec, c2.label,
      coalesce(sp.artist, '') as artist,
      case
        -- 진행 표식·수다는 곡이 아니다
        when c2.label ~ '뱅종|방종|멘트$|^(시작|종료|끝|가리|준비|세팅|인사|휴식|쉬는|잠깐)' then null
        when c2.label ~ '허밍|흥얼|콧노래|나비보벳따우|랄랄라' then 'hum'
        when c2.label ~ '🕺|💃' or c2.label ~* '챌린지|챌\M|커버댄스|안무|댄스|숏츠|쇼츠|릴스|틱톡|tiktok' then 'dance'
        when c2.label ~ '🎤' then 'sung'
        -- '부르는·불러' 표현은 듣는 코너(빅이봤·영상)가 아닐 때만 부른 곡('노래 부르는 공주님' 영상은 듣기)
        when c2.label ~ '부르는|불러보|불러주|불렀|(?<!배)불러\M' and public.search_song_section_kind(c2.section) is distinct from 'listen' then 'sung'
        when public.search_song_section_kind(c2.section) = 'dance' then
          case when sp.artist is not null or c2.label ~ '🎵|🎶|춤' then 'dance' else null end
        when c2.label ~ '🎵|🎶' then
          case when exists (select 1 from mic where mic.title_no = c2.title_no) then 'listen' else 'sung' end
        when c2.label ~* '스토리|썰\M|이야기|시절|근황|반응|질문|답변|설명|고민|잡담|소통|토크|ㅋㅋ|ㅎㅎ|모먼트|근데|왜|어떻게|만들래|타임리프' then null
        when public.search_song_section_kind(c2.section) = 'sung' then
          case when sp.artist is not null then 'sung' when length(c2.label) <= 25 then 'sung' else null end
        when public.search_song_section_kind(c2.section) = 'listen' and sp.artist is not null then 'listen'
        when sp.artist is not null and exists (select 1 from public.search_artists a where a.name = public.search_norm(sp.artist))
          then case when c2.section ~* '빅이봤|영상|월드컵' then 'listen' else 'sung' end
        when c2.label ~* 'cover|커버|live$|라이브$' and sp.artist is not null then 'sung'
        else null
      end as kind
    from public.vod_chapter_index c2
    left join lateral public.search_song_split(c2.label) sp on true
  ) x
  where x.title_no = c.title_no and x.sec = c.sec and x.label = c.label
    and (c.song_kind is distinct from x.kind or c.artist <> x.artist);
  get diagnostics n = row_count;

  -- 3) 춤곡 전파: 어디선가 춤으로 분류된 "가수 - 곡"은 다른 방송에서 🎤 없이 나오면 춤으로 본다
  --    (🎵예나 - 캐치캐치가 소통 코너에 있어도 챌린지곡). 이 방송 데이터에서 배운 춤곡 목록.
  --    (UPDATE … FROM 안에서 대상 테이블 컬럼을 LATERAL로 못 쓰므로 EXISTS 서브쿼리로.)
  update public.vod_chapter_index c
  set song_kind = 'dance'
  where c.song_kind in ('sung', 'listen')
    and c.label !~ '🎤'
    and exists (
      select 1
      from public.search_song_split(c.label) cs
      join (
        select distinct public.search_norm(sp.artist) || '|' || public.search_norm(sp.title) as key
        from public.vod_chapter_index d
        cross join lateral public.search_song_split(d.label) sp
        where d.song_kind = 'dance' and sp.artist is not null
      ) dl on dl.key = public.search_norm(cs.artist) || '|' || public.search_norm(cs.title)
      where cs.artist is not null
    );
  return n;
end;
$$;
select public.search_song_refresh();

-- RPC: 의도 → 종류. 노래(sung 2.8, hum 1.0 뒤에, listen 0.8), 춤(dance 2.8), 허밍(hum 2.8).
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
      array(select t from unnest(q0.toks) t where not exists (select 1 from public.search_intents i where i.term = t)) as rest_toks
    from q0
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
      q1.qn, q1.is_cho, q1.alts, q1.tokg as toks, q1.min_ok, q1.song_intent, q1.dance_intent, q1.hum_intent, q1.game_intent, q1.rest_toks,
      case when cardinality(q1.alts) = 0 then '(?!)' else '(' || array_to_string(q1.alts, '|') || ')' end as qre,
      case when cardinality(q1.rels) = 0 then null else '(' || array_to_string(q1.rels, '|') || ')' end as qrel,
      case when cardinality(q1.rest_toks) = 0 then null else '(' || array_to_string(q1.rest_toks, '|') || ')' end as qrest,
      (select re from games) as gre,
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
      (q.game_intent and q.gre is not null and ev.tn ~ q.gre and not public.search_game_is_major(ev.tn)
        and (q.qrest is null or (ev.tn || ev.tagn) ~ q.qrest)) as hit_game,
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
            when hit_game then 2.6
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
      (hit_game or hit_t or hit_g or hit_d or hit_r or (q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)) as exact,
      pop::numeric as popularity,
      ''::text as section, ''::text as parent,
      case when hit_game then 'game' when hit_t then 'title' when hit_g then 'tag' when hit_d then 'description' when q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0 then 'tokens' when hit_r then 'related' when hit_ab then 'abbrev' else 'fuzzy' end as matched_on
    from evm ev, q
    where q.min_ok and (
      hit_game or hit_t or hit_g or hit_d or hit_r or hit_ab
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
      (q.game_intent and (
        (q.gre is not null and v.tn ~ q.gre)
        or exists (select 1 from public.vod_chapter_index c join public.search_games g on g.norm = c.game_norm where c.title_no = v.title_no and g.kind = 'minor')
      ) and (q.qrest is null or v.tn ~ q.qrest)) as hit_game,
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
            when hit_game then 2.8
            when hit_t then 1.2
            when q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0 then 1.0 * public.search_tok_ratio(v.tnm, q.toks, q.tokw)
            when hit_r then 0.5
            when hit_ab then 0.4
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (hit_game or hit_t or hit_r or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)) as exact,
      (g.engagement / 0.8)::numeric as popularity,
      ''::text as section, ''::text as parent,
      case when hit_game then 'game' when hit_t then 'title' when q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0 then 'tokens' when hit_r then 'related' when hit_ab then 'abbrev' else 'fuzzy' end as matched_on
    from vodm v
    join vod_engage g on g.title_no = v.title_no, q
    where q.min_ok and (
      hit_game or hit_t or hit_r or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)
      or (length(q.qn) >= 2 and similarity(v.tnm, q.qn) >= 0.25)
    )
  ),
  chm as (
    select c.title_no, c.sec, c.label, c.section, c.parent, c.song_kind,
      case when q.is_cho then c.label_cho else c.label_norm end as cm,
      c.label_norm || '|' || c.section_norm || '|' || c.parent_norm as cmx,
      (case when q.is_cho then c.label_cho else c.label_norm end) ~ q.qre as hit_t,
      (not q.is_cho and (c.section_norm || '|' || c.parent_norm) ~ q.qre) as hit_s,
      (q.qrel is not null and (c.label_norm || '|' || c.section_norm || '|' || c.parent_norm) ~ q.qrel) as hit_r,
      (q.qrest is null or (c.label_norm || '|' || c.section_norm) ~ q.qrest) as rest_ok,
      (q.song_intent and c.song_kind = 'sung') as hit_song,
      (q.song_intent and c.song_kind = 'listen') as hit_listen,
      ((q.song_intent or q.hum_intent) and c.song_kind = 'hum') as hit_hum,
      (q.dance_intent and c.song_kind = 'dance') as hit_dance,
      (q.game_intent and c.is_section_start and c.game_norm <> ''
        and exists (select 1 from public.search_games g where g.norm = c.game_norm and g.kind = 'minor')) as hit_game,
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
            when c.rest_ok and c.hit_game then 2.4
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
      ((c.rest_ok and (c.hit_game or c.hit_song or c.hit_dance or c.hit_hum or c.hit_listen)) or c.hit_t or c.hit_s or c.hit_r or (q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) >= 0.5)) as exact,
      (g.engagement / 0.8)::numeric as popularity,
      c.section, c.parent,
      case
        when c.rest_ok and c.hit_game then 'game'
        when c.rest_ok and c.hit_song then 'song'
        when c.rest_ok and c.hit_dance then 'dance'
        when c.rest_ok and c.hit_hum then 'hum'
        when c.hit_t then 'label'
        when c.hit_s then 'section'
        when c.rest_ok and c.hit_listen then 'listen'
        when q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) > 0 then 'tokens'
        when c.hit_r then 'related' when c.hit_ab then 'abbrev' else 'fuzzy' end as matched_on
    from chm c
    join vods v on v.title_no = c.title_no
    join vod_engage g on g.title_no = c.title_no, q
    where q.min_ok and (
      (c.rest_ok and (c.hit_game or c.hit_song or c.hit_dance or c.hit_hum or c.hit_listen))
      or c.hit_t or c.hit_s or c.hit_r or c.hit_ab
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
  limit greatest(1, least(coalesce(p_limit, 50), 400));
$$;
comment on function public.search_public(uuid, text, integer) is
  '시청자 검색(0076~0084) — 공연 종류(부름/틀어줌/춤/허밍) 의도, 종겜 의도, 챕터 코너·상위, 동의어/관련어/줄임말/IDF/초성. 공개 데이터만.';
grant execute on function public.search_public(uuid, text, integer) to anon, authenticated;
