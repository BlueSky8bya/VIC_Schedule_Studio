-- 0078: 시청자 검색 — 은어·줄임말·동의어(PLAN-20260918-023 후속, 소유자 2026-09-18).
--
-- "배그"로 쳐도 "배틀그라운드" 일정이 나와야 한다. 세 겹:
--   1) 큐레이션 사전 search_synonyms(source='seed'): 방송 은어·게임 줄임말(양방향).
--   2) 자동 채굴(source='auto'): 같은 다시보기의 **제목 단어 ↔ 팬 챕터 단어**에서 '첫 음절 부분열'
--      관계(마인크래프트 ↔ 마크)가 3개 이상 방송에서 반복되면 동의어로 승격. 클릭 로그 없이도
--      데이터에서 배우는 유일한 신호(유튜브의 공기어 학습 대응). search_synonyms_rebuild()로 갱신 —
--      타임라인 수집(lib/broadcast/vod-timeline.ts)이 끝날 때마다 부른다.
--   3) 줄임말 부분열 매칭: 2~4글자 질의가 필드 안에서 **순서대로, 첫 글자가 단어 첫 음절**로 나타나면
--      낮은 등급 적중(exact=false → '비슷한 결과'). 사전에 없는 새 줄임말의 안전망.
-- 질의 확장: 각 토큰 → {토큰} ∪ 동의어 → 필드가 그중 하나라도 포함하면 적중(Lucene synonym_graph 방식).
-- 추가: popularity 컬럼(정렬 '인기순' 용).
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0078_public_search_synonyms.sql

create table if not exists public.search_synonyms (
  term text not null,      -- 정규화된 말(search_norm)
  alt text not null,       -- 정규화된 동의어
  source text not null default 'seed', -- seed | auto
  support integer not null default 0,  -- auto: 근거 방송 수
  primary key (term, alt)
);
alter table public.search_synonyms enable row level security;
-- 정책 없음 = 직접 접근 차단. 검색 RPC(security definer)만 읽는다.
grant select, insert, update, delete on public.search_synonyms to service_role;

-- 큐레이션 사전 — 양방향으로 넣는다. 정규화는 삽입 시 적용.
create or replace function public.search_synonyms_seed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  groups text[] := array[
    '배그|배틀그라운드|pubg|battlegrounds',
    '마크|마인크래프트|minecraft',
    '옵치|오버워치|overwatch',
    '롤|리그오브레전드|lol|leagueoflegends',
    '발로|발로란트|valorant',
    '메이플|메이플스토리|maplestory',
    '젤다|젤다의전설|zelda',
    '야숲|야생의숲|브레스오브더와일드|botw',
    '티오킹|티어스오브더킹덤|totk|왕눈',
    '데바데|데드바이데이라이트|dbd',
    '피파|fc온라인|피파온라인|eafc|fc',
    '스타|스타크래프트|starcraft',
    '포켓몬|포켓몬스터|pokemon',
    '명조|명조워더링웨이브|wutheringwaves',
    '로아|로스트아크|lostark',
    '디아|디아블로|diablo',
    '히오스|히어로즈오브더스톰',
    '하스|하스스톤|hearthstone',
    '던파|던전앤파이터',
    '카러플|카트라이더러쉬플러스',
    '카트|카트라이더',
    '모동숲|모여봐요동물의숲|동물의숲|동숲',
    '엘든|엘든링|eldenring',
    '몬헌|몬스터헌터|monsterhunter',
    '리썰|리썰컴퍼니|lethalcompany',
    '스듀|스타듀밸리|stardew',
    '좀보이드|프로젝트좀보이드|zomboid',
    '갈틱|갈틱폰|garticphone',
    '어몽|어몽어스|amongus',
    '풀트|풀트래킹|풀트뱅',
    '손캠|손캠방|손캠뱅',
    '휴뱅|휴방|쉬는날',
    '합방|콜라보|합동방송',
    '왁굳|우왁굳',
    '이세돌|이세계아이돌',
    '왁타|왁타버스',
    '고멤|고정멤버',
    '시참|시청자참여',
    '겜|게임',
    '노래뱅|노래방송|노래',
    '소통뱅|소통방송|소통',
    '엔딩|결말|클리어',
    '빅이봤|비디오봤|영상보기|영상',
    '공포겜|공포게임|호러',
    '플스|플레이스테이션|ps5|ps4',
    '닌텐도|스위치|switch'
  ];
  g text[];
  i int; j int; k int;
begin
  delete from public.search_synonyms where source = 'seed';
  for i in 1 .. array_length(groups, 1) loop
    g := array_remove(array(select public.search_norm(x) from unnest(string_to_array(groups[i], '|')) as x), '');
    for j in 1 .. array_length(g, 1) loop
      for k in 1 .. array_length(g, 1) loop
        if j <> k then
          insert into public.search_synonyms (term, alt, source) values (g[j], g[k], 'seed')
          on conflict (term, alt) do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

-- 줄임말 부분열: p_q(정규화, 2~4자)가 p_text(원문) 안에서 **순서대로** 나타나되 첫 글자는 어떤 단어의
-- 첫 음절이고, 전체 폭이 (질의 길이×4+2) 이내면 참. 단어 경계를 넘어도 된다 —
-- "배그"∈"배틀그라운드", "데바데"∈"데드바이데이라이트", "츠온"∈"츠쿠요미 온라인".
-- "마크"∈"마지막 크리스마스"도 참이 되지만 낮은 등급이라 소음은 '비슷한 결과'에 머문다.
create or replace function public.search_abbrev_match(p_q text, p_text text)
returns boolean
language plpgsql
immutable
parallel safe
as $$
declare
  n text := lower(regexp_replace(coalesce(p_text, ''), '[^가-힣a-zA-Z0-9]+', ' ', 'g'));
  qlen int := length(p_q);
  nlen int;
  start int;
  qi int;
  ti int;
  ch text;
begin
  if qlen < 2 or qlen > 4 then return false; end if;
  nlen := length(n);
  for start in 1 .. nlen loop
    -- 단어 첫 음절(문자열 시작이거나 앞이 공백)이고 질의 첫 글자와 같아야 출발점.
    if substr(n, start, 1) <> substr(p_q, 1, 1) then continue; end if;
    if start > 1 and substr(n, start - 1, 1) <> ' ' then continue; end if;
    qi := 2; ti := start + 1;
    while qi <= qlen and ti <= nlen and ti - start <= qlen * 4 + 2 loop
      ch := substr(n, ti, 1);
      if ch = substr(p_q, qi, 1) then qi := qi + 1; end if;
      ti := ti + 1;
    end loop;
    if qi > qlen then return true; end if;
  end loop;
  return false;
end;
$$;

-- 자동 채굴: 같은 다시보기의 제목 단어(긴 것, ≥4자) ↔ 챕터 단어(짧은 것, 2~3자)가 줄임말 부분열
-- 관계이고 3개 이상 방송에서 반복되면 동의어(양방향). 큐레이션 항목은 건드리지 않는다.
create or replace function public.search_synonyms_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare added int;
begin
  delete from public.search_synonyms where source = 'auto';
  with tw as (
    select v.title_no, lower(x) as w
    from public.vod_archive v, regexp_split_to_table(v.title, '[^가-힣a-zA-Z0-9]+') as x
    where length(x) >= 4 and length(x) <= 14
  ),
  cw as (
    select distinct c.title_no, lower(x) as s
    from public.vod_chapter_index c, regexp_split_to_table(c.label, '[^가-힣a-zA-Z0-9]+') as x
    where length(x) between 2 and 3 and x ~ '^[가-힣]+$'
  ),
  pairs as (
    select cw.s, tw.w, count(distinct tw.title_no) as n
    from cw join tw on tw.title_no = cw.title_no
    where substr(tw.w, 1, 1) = substr(cw.s, 1, 1)
      and public.search_abbrev_match(cw.s, tw.w)
      and not exists (select 1 from public.search_synonyms x where x.term = cw.s and x.alt = tw.w)
    group by cw.s, tw.w
    having count(distinct tw.title_no) >= 3
  ),
  ins as (
    insert into public.search_synonyms (term, alt, source, support)
    select s, w, 'auto', n from pairs
    union all
    select w, s, 'auto', n from pairs
    on conflict (term, alt) do nothing
    returning 1
  )
  select count(*) into added from ins;
  return added;
end;
$$;

grant execute on function public.search_synonyms_rebuild() to service_role;

select public.search_synonyms_seed();
select public.search_synonyms_rebuild();

-- 토큰 그룹 적중 비율: 토큰 하나 = '토큰|동의어|동의어' — 그중 하나라도 포함이면 적중(IDF 가중 유지).
create or replace function public.search_group_hit(p_norm text, p_group text)
returns boolean
language sql
immutable
parallel safe
as $$
  select exists (select 1 from unnest(string_to_array(p_group, '|')) as a where a <> '' and position(a in coalesce(p_norm, '')) > 0);
$$;

create or replace function public.search_tok_ratio(p_norm text, p_toks text[], p_w numeric[])
returns numeric
language sql
immutable
parallel safe
as $$
  select case
    when p_toks is null or cardinality(p_toks) = 0 then 0
    else coalesce(
      (select sum(w) filter (where coalesce(p_norm, '') ~ ('(' || t || ')')) from unnest(p_toks, p_w) as u(t, w))
        / nullif((select sum(w) from unnest(p_w) as w), 0),
      0)
  end;
$$;

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
  -- 질의 확장: 구 전체 대안(alts) + 토큰별 그룹('토큰|동의어…'). 초성 모드는 확장 없음.
  q1 as (
    select
      q0.qn, q0.is_cho, q0.toks,
      case when q0.is_cho then array[q0.qn]
           else array_prepend(q0.qn, array(select s.alt from public.search_synonyms s where s.term = q0.qn)) end as alts,
      case when q0.is_cho then q0.toks
           else array(
             select t.tok || coalesce('|' || string_agg(s.alt, '|'), '')
             from unnest(q0.toks) with ordinality as t(tok, ord)
             left join public.search_synonyms s on s.term = t.tok
             group by t.tok, t.ord order by t.ord
           ) end as tokg
    from q0
  ),
  ev as (
    select
      e.id,
      e.date_key,
      e.start_time,
      e.public_title,
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
      -- 대안 전부를 정규식 하나로(정규화열은 글자·숫자뿐이라 이스케이프 불필요) — 행마다 unnest 서브쿼리 3개보다 싸다.
      '(' || array_to_string(q1.alts, '|') || ')' as qre,
      (not q1.is_cho and length(q1.qn) between 2 and 4) as abbrev_on,
      -- 줄임말 전 싼 거름망: 첫 글자…끝 글자가 그 순서로 있어야 후보(LIKE) — plpgsql 루프를 1.7만 행에 다 돌리지 않는다.
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
    from (
      select event_id from public.event_hearts
      union all
      select event_id from public.event_hearts_anon
    ) h
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
      -- 줄임말 검사는 비싸다(plpgsql 루프) — 이미 적중이면 건너뛴다(CASE는 지연 평가).
      (case when not q.abbrev_on or ev.tn !~~ q.ablike or (ev.tn ~ q.qre) then false
            else public.search_abbrev_match(q.qn, ev.public_title) end) as hit_ab,
      coalesce((select n from ev_hearts where ev_hearts.event_id = ev.id), 0) / (select mx from ev_max) as pop
    from ev, q
  ),
  ev_scored as (
    select
      'event'::text as kind,
      ev.id as event_id,
      null::bigint as title_no,
      null::integer as sec,
      ev.date_key,
      ev.start_time,
      ev.public_title as title,
      case
        when not q.is_cho and hit_d and position(lower(trim(coalesce(p_q, ''))) in lower(ev.descr)) > 0 then
          substr(ev.descr, greatest(1, position(lower(trim(coalesce(p_q, ''))) in lower(ev.descr)) - 30), 120)
        when hit_d then substr(ev.descr, 1, 120)
        else ''
      end as snippet,
      null::bigint as duration_ms,
      null::text as host_nick,
      (
        greatest(
          3.0 * similarity(ev.tnm, q.qn),
          1.2 * similarity(ev.tagnm, q.qn),
          0.7 * similarity(ev.dnm, q.qn)
        )
        + case
            when hit_t then 1.2
            when hit_g or hit_d then 0.6
            when q.ntok > 1 then 1.0 * public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw)
            when hit_ab then 0.4
            else 0
          end
        + 0.4 * pop
        + 0.3 * exp(-greatest(0, (current_date - ev.date_key))::numeric / 365.0)
      )::numeric as score,
      (hit_t or hit_g or hit_d or (q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)) as exact,
      pop::numeric as popularity
    from evm ev, q
    where length(q.qn) >= 2 and (
      hit_t or hit_g or hit_d or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)
      or similarity(ev.tnm, q.qn) >= 0.25
    )
  ),
  vod_max as (
    select
      greatest(1, coalesce(max(read_cnt), 1))::numeric as mx_read,
      greatest(1, coalesce(max(like_cnt + comment_cnt), 1))::numeric as mx_react,
      greatest(1, coalesce(max(entry_count), 1))::numeric as mx_ch
    from vods
  ),
  vod_engage as (
    select
      v.title_no,
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
      (case when not q.abbrev_on or v.tn !~~ q.ablike or (v.tn ~ q.qre) then false
            else public.search_abbrev_match(q.qn, v.title) end) as hit_ab
    from vods v, q
  ),
  vod_scored as (
    select
      'vod'::text as kind,
      null::uuid as event_id,
      v.title_no,
      null::integer as sec,
      v.broadcast_day as date_key,
      null::time as start_time,
      v.title,
      ''::text as snippet,
      v.duration_ms,
      nullif(v.host_nick, '') as host_nick,
      (
        2.0 * similarity(v.tnm, q.qn)
        + case
            when hit_t then 1.2
            when q.ntok > 1 then 1.0 * public.search_tok_ratio(v.tnm, q.toks, q.tokw)
            when hit_ab then 0.4
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (hit_t or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)) as exact,
      (g.engagement / 0.8)::numeric as popularity
    from vodm v
    join vod_engage g on g.title_no = v.title_no, q
    where length(q.qn) >= 2 and (
      hit_t or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)
      or similarity(v.tnm, q.qn) >= 0.25
    )
  ),
  chm as (
    select c.title_no, c.sec, c.label,
      case when q.is_cho then c.label_cho else c.label_norm end as cm,
      (case when q.is_cho then c.label_cho else c.label_norm end) ~ q.qre as hit_t,
      (case when not q.abbrev_on or c.label_norm !~~ q.ablike or (c.label_norm ~ q.qre) then false
            else public.search_abbrev_match(q.qn, c.label) end) as hit_ab
    from public.vod_chapter_index c, q
  ),
  ch_scored as (
    select
      'chapter'::text as kind,
      null::uuid as event_id,
      c.title_no,
      c.sec,
      v.broadcast_day as date_key,
      null::time as start_time,
      c.label as title,
      v.title as snippet,
      v.duration_ms,
      nullif(v.host_nick, '') as host_nick,
      (
        1.5 * similarity(c.cm, q.qn)
        + case
            when c.hit_t then 1.2
            when q.ntok > 1 then 1.0 * public.search_tok_ratio(c.cm, q.toks, q.tokw)
            when c.hit_ab then 0.4
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (c.hit_t or (q.ntok > 1 and public.search_tok_ratio(c.cm, q.toks, q.tokw) >= 0.5)) as exact,
      (g.engagement / 0.8)::numeric as popularity
    from chm c
    join vods v on v.title_no = c.title_no
    join vod_engage g on g.title_no = c.title_no, q
    where length(q.qn) >= 2 and (
      c.hit_t or c.hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(c.cm, q.toks, q.tokw) >= 0.5)
      or similarity(c.cm, q.qn) >= 0.3
    )
  ),
  merged as (
    select * from ev_scored
    union all
    select * from vod_scored
    union all
    select * from ch_scored
  )
  select kind, event_id, title_no, sec, date_key, start_time, title, snippet, duration_ms, host_nick,
         round(score, 4) as score, exact, round(popularity, 4) as popularity
  from merged
  order by exact desc, score desc, date_key desc, sec asc nulls first
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

comment on function public.search_public(uuid, text, integer) is
  '시청자 검색(0076~0078) — 공개 일정·다시보기·챕터 한 순위. 동의어/줄임말 확장·IDF·초성·exact·popularity. 비공개/초안/미공개 떡밥/구독 VOD 제외.';

grant execute on function public.search_public(uuid, text, integer) to anon, authenticated;
