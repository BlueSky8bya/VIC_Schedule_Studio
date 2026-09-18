-- 0077: 시청자 검색 P3 — PLAN-20260918-023 §3 나머지.
--   · IDF 가중: 다단어 검색에서 희귀한 토큰이 더 무겁다("마크 왁피스" → 왁피스만 맞은 다시보기가
--     마크만 맞은 것보다 위). 문서 빈도는 세 원천(일정·다시보기·챕터) 합집합에서 질의 시 센다.
--   · 초성 검색: 질의가 전부 초성(ㄱ~ㅎ)이면 각 필드의 초성열과 대조("ㅈㄷ" → 젤다).
--   · 보너스: 구 전체 포함 1.2 · 토큰 IDF 가중 비율 ×1.0(전부 맞으면 1.0) — 부분 적중이 참여·최신 가산에 묻히지 않게.
--   · exact 플래그: 정규화 구/토큰이 실제로 포함된 적중인지(아니면 트라이그램 유사도만) — 화면이
--     "비슷한 결과"로 구분해 보여준다(유튜브 '혹시 이 검색어를 찾으셨나요' 대응).
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0077_public_search_p3.sql

-- 초성열: 한글 음절 → 초성, 그 외 글자는 그대로(정규화 후). 인덱스 컬럼 계산에 쓰므로 immutable.
create or replace function public.search_choseong(p text)
returns text
language sql
immutable
parallel safe
as $$
  select coalesce(string_agg(
    case
      when c >= '가' and c <= '힣' then
        (array['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'])
          [((ascii(c) - 44032) / 588) + 1]
      else c
    end, '' order by ord), '')
  from regexp_split_to_table(public.search_norm(p), '') with ordinality as t(c, ord)
  where c <> '';
$$;

-- 챕터 색인에 초성열 추가(1.7만 행 — 질의마다 계산하면 느리다).
alter table public.vod_chapter_index add column if not exists label_cho text not null default '';
create index if not exists idx_vod_chapter_cho_trgm
  on public.vod_chapter_index using gin (label_cho gin_trgm_ops);

create or replace function public.vod_chapter_index_rebuild(p_title_no bigint, p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.vod_chapter_index where title_no = p_title_no;
  insert into public.vod_chapter_index (title_no, sec, label, label_norm, label_cho)
  select distinct on (p_title_no, (e->>'sec')::int, e->>'label')
    p_title_no,
    (e->>'sec')::int,
    e->>'label',
    public.search_norm(e->>'label'),
    public.search_choseong(e->>'label')
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e
  where jsonb_typeof(e) = 'object'
    and (e->>'sec') ~ '^[0-9]+$'
    and length(coalesce(e->>'label', '')) > 0
    and length(public.search_norm(e->>'label')) > 0;
end;
$$;

-- 백필(초성열) — 비어 있는 행만.
update public.vod_chapter_index set label_cho = public.search_choseong(label) where label_cho = '';

-- 가중 토큰 적중 비율(0~1): 토큰별 가중치 배열(IDF)을 받는다. 옛 길이 가중 2-인자판은 제거.
drop function if exists public.search_tok_ratio(text, text[]);
create or replace function public.search_tok_ratio(p_norm text, p_toks text[], p_w numeric[])
returns numeric
language sql
immutable
parallel safe
as $$
  select case
    when p_toks is null or cardinality(p_toks) = 0 then 0
    else coalesce(
      (select sum(w) filter (where position(t in coalesce(p_norm, '')) > 0) from unnest(p_toks, p_w) as u(t, w))
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
  exact boolean
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
  -- 문서 빈도(IDF)용 말뭉치: 일정(제목+태그+설명) · 다시보기 제목 · 챕터 라벨. 초성 모드면 초성열.
  corpus as (
    select case when q0.is_cho then public.search_choseong(ev.tn || ev.tagn || ev.dn) else ev.tn || ev.tagn || ev.dn end as norm
    from ev, q0
    union all
    select case when q0.is_cho then public.search_choseong(v.tn) else v.tn end from vods v, q0
    union all
    select case when q0.is_cho then c.label_cho else c.label_norm end from public.vod_chapter_index c, q0
  ),
  q as (
    select
      q0.qn, q0.is_cho, q0.toks,
      -- idf = ln((N+1)/(df+1)) + 1 — 어디에나 있는 토큰은 1, 희귀 토큰은 커진다.
      array(
        select (ln(((select count(*) from corpus) + 1.0) / ((select count(*) from corpus where position(t.tok in corpus.norm) > 0) + 1.0)) + 1)::numeric
        from unnest(q0.toks) with ordinality as t(tok, ord)
        order by t.ord
      ) as tokw
    from q0
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
  -- 매칭 문자열: 초성 모드면 초성열, 아니면 정규화열(m 접미).
  evm as (
    select ev.*,
      case when q.is_cho then public.search_choseong(ev.tn) else ev.tn end as tnm,
      case when q.is_cho then public.search_choseong(ev.dn) else ev.dn end as dnm,
      case when q.is_cho then public.search_choseong(ev.tagn) else ev.tagn end as tagnm
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
        when not q.is_cho and position(q.qn in ev.dnm) > 0 then
          substr(ev.descr, greatest(1, position(lower(trim(coalesce(p_q, ''))) in lower(ev.descr)) - 30), 120)
        when q.is_cho and position(q.qn in ev.dnm) > 0 then substr(ev.descr, 1, 120)
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
            when position(q.qn in ev.tnm) > 0 then 1.2
            when position(q.qn in ev.tagnm) > 0 or position(q.qn in ev.dnm) > 0 then 0.6
            when cardinality(q.toks) > 1 then 1.0 * public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw)
            else 0
          end
        + 0.4 * coalesce((select n from ev_hearts where ev_hearts.event_id = ev.id), 0) / (select mx from ev_max)
        + 0.3 * exp(-greatest(0, (current_date - ev.date_key))::numeric / 365.0)
      )::numeric as score,
      (position(q.qn in ev.tnm) > 0 or position(q.qn in ev.tagnm) > 0 or position(q.qn in ev.dnm) > 0
       or (cardinality(q.toks) > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)) as exact
    from evm ev, q
    where length(q.qn) >= 2 and (
      position(q.qn in ev.tnm) > 0
      or position(q.qn in ev.tagnm) > 0
      or position(q.qn in ev.dnm) > 0
      or (cardinality(q.toks) > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)
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
    select v.*, case when q.is_cho then public.search_choseong(v.tn) else v.tn end as tnm
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
            when position(q.qn in v.tnm) > 0 then 1.2
            when cardinality(q.toks) > 1 then 1.0 * public.search_tok_ratio(v.tnm, q.toks, q.tokw)
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (position(q.qn in v.tnm) > 0
       or (cardinality(q.toks) > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)) as exact
    from vodm v
    join vod_engage g on g.title_no = v.title_no, q
    where length(q.qn) >= 2 and (
      position(q.qn in v.tnm) > 0
      or (cardinality(q.toks) > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)
      or similarity(v.tnm, q.qn) >= 0.25
    )
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
        1.5 * similarity(cm, q.qn)
        + case
            when position(q.qn in cm) > 0 then 1.2
            when cardinality(q.toks) > 1 then 1.0 * public.search_tok_ratio(cm, q.toks, q.tokw)
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (position(q.qn in cm) > 0
       or (cardinality(q.toks) > 1 and public.search_tok_ratio(cm, q.toks, q.tokw) >= 0.5)) as exact
    from public.vod_chapter_index c
    join vods v on v.title_no = c.title_no
    join vod_engage g on g.title_no = c.title_no, q,
    lateral (select case when q.is_cho then c.label_cho else c.label_norm end as cm) x
    where length(q.qn) >= 2 and (
      position(q.qn in cm) > 0
      or (cardinality(q.toks) > 1 and public.search_tok_ratio(cm, q.toks, q.tokw) >= 0.5)
      or similarity(cm, q.qn) >= 0.3
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
         round(score, 4) as score, exact
  from merged
  order by exact desc, score desc, date_key desc, sec asc nulls first
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

comment on function public.search_public(uuid, text, integer) is
  '시청자 검색(0076/0077) — 공개 일정·다시보기·팬 타임라인 챕터를 한 순위로. IDF 가중·초성·exact 플래그. 비공개/초안/미공개 떡밥/구독 VOD 제외. 원본 비노출.';

grant execute on function public.search_public(uuid, text, integer) to anon, authenticated;
