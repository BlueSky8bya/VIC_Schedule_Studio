-- 0076: 시청자 검색 — PLAN-20260918-023 P0.
-- "예전에 이런 게 있었던 것 같은데 어느 날짜, 어디 시간대였지?"를 공개 데이터 세 원천으로 답한다:
--   · 일정(events, 공개분): 제목·설명·태그명
--   · 다시보기(vod_archive, auth_no=101 전체 공개분): 제목
--   · 팬 타임라인 챕터(vod_timeline.entries): 초·라벨 — "어느 시간대"의 원천
--
-- 공개 경계: RPC는 security definer지만 반환 컬럼은 공개 화면에 이미 나가는 값뿐이다.
-- 비공개·엠바고·작업자 일정, 초안, 삭제(tombstone), 아직 안 풀린 떡밥, 구독 전용 VOD는
-- 후보에서 제외한다(공개 로더와 같은 필터를 SQL로 복제). 원본 행·개인 필드 비노출.
--
-- 한글 매칭: Postgres 전문검색은 한글 형태소가 없어 pg_trgm(글자 3개 조각) + 정규화 문자열
-- 부분 포함으로 간다. 정규화 = 소문자 + 공백·기호 제거("야 숲!" = "야숲").
-- 순위(유튜브 검색 벤치마킹, 계획서 §3): 필드 가중 × 유사도 + 정확 포함 보너스 + 참여 신호 + 최신 가산.
-- 검색어는 저장하지 않는다(소유자 결정) → 클릭 학습 없이 정적 신호만.
--
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0076_public_search.sql

create extension if not exists pg_trgm;

-- 정규화: NFKC는 PG 기본에 없어 소문자 + 공백/기호 제거만. 인덱스 식에 쓰므로 immutable.
create or replace function public.search_norm(p text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(regexp_replace(coalesce(p, ''), '[[:space:][:punct:]]+', '', 'g'));
$$;

-- 토큰 적중 비율(0~1, 길이 가중): 다단어 검색은 유튜브처럼 일부만 맞아도 후보로 두되 비율만큼만 보너스.
create or replace function public.search_tok_ratio(p_norm text, p_toks text[])
returns numeric
language sql
immutable
parallel safe
as $$
  -- 토큰 길이 가중: 긴 토큰이 보통 더 희귀하다("마크 왁피스"에서 왁피스만 맞은 쪽 > 마크만 맞은 쪽).
  -- 문서 빈도(IDF)까지는 P3.
  select case
    when p_toks is null or cardinality(p_toks) = 0 then 0
    else (select sum(length(t)) filter (where position(t in coalesce(p_norm, '')) > 0) from unnest(p_toks) t)::numeric
         / (select sum(length(t)) from unnest(p_toks) t)
  end;
$$;

-- 챕터 평탄화 — entries jsonb는 검색 불가라 (title_no, sec, label) 행으로 펼쳐 둔다.
-- vod_timeline 갱신 트리거가 유지하므로 수집기(lib/broadcast/vod-timeline.ts)는 손대지 않는다.
create table if not exists public.vod_chapter_index (
  title_no bigint not null references public.vod_timeline(title_no) on delete cascade,
  sec integer not null,
  label text not null,
  label_norm text not null,
  primary key (title_no, sec, label)
);

alter table public.vod_chapter_index enable row level security;

drop policy if exists vod_chapter_index_public_read on public.vod_chapter_index;
create policy vod_chapter_index_public_read on public.vod_chapter_index
  for select to anon, authenticated using (true);

grant select on public.vod_chapter_index to anon, authenticated;
-- service_role DML grant — 트리거는 호출자 권한으로 돌아 grant 없으면 수집기 upsert가 죽는다(0035/0043).
grant select, insert, update, delete on public.vod_chapter_index to service_role;

create or replace function public.vod_chapter_index_rebuild(p_title_no bigint, p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.vod_chapter_index where title_no = p_title_no;
  insert into public.vod_chapter_index (title_no, sec, label, label_norm)
  select distinct on (p_title_no, (e->>'sec')::int, e->>'label')
    p_title_no,
    (e->>'sec')::int,
    e->>'label',
    public.search_norm(e->>'label')
  from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) as e
  where jsonb_typeof(e) = 'object'
    and (e->>'sec') ~ '^[0-9]+$'
    and length(coalesce(e->>'label', '')) > 0
    and length(public.search_norm(e->>'label')) > 0;
end;
$$;

create or replace function public.vod_timeline_chapter_index_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.vod_chapter_index_rebuild(new.title_no, new.entries);
  return new;
end;
$$;

drop trigger if exists vod_timeline_chapter_index on public.vod_timeline;
create trigger vod_timeline_chapter_index
  after insert or update of entries on public.vod_timeline
  for each row execute function public.vod_timeline_chapter_index_trg();

-- 백필: 기존 타임라인 전부 한 번 펼친다(멱등 — rebuild가 지우고 다시 넣음).
do $$
declare r record;
begin
  for r in select title_no, entries from public.vod_timeline where entry_count > 0 loop
    perform public.vod_chapter_index_rebuild(r.title_no, r.entries);
  end loop;
end $$;

-- 트라이그램 인덱스(부분 포함 ILIKE·% 연산자 가속). 데이터가 작아 없어도 돌지만 챕터는 수만 행이 된다.
create index if not exists idx_events_title_trgm
  on public.events using gin (public.search_norm(public_title) gin_trgm_ops)
  where deleted_at is null and visibility_scope = 'public';
create index if not exists idx_events_desc_trgm
  on public.events using gin (public.search_norm(public_description) gin_trgm_ops)
  where deleted_at is null and visibility_scope = 'public';
create index if not exists idx_vod_archive_title_trgm
  on public.vod_archive using gin (public.search_norm(title) gin_trgm_ops);
create index if not exists idx_vod_chapter_label_trgm
  on public.vod_chapter_index using gin (label_norm gin_trgm_ops);

-- 검색 RPC. 반환 = (종류, 일정 id | VOD 번호·초, 날짜, 시각, 제목, 발췌, 길이, 합방 호스트 닉, 점수).
-- 점수 식(계획서 §3):
--   score = field_w × similarity + exact_bonus + engagement + freshness
--   field_w: 일정 제목 3.0 · 다시보기 제목 2.0 · 챕터 1.5 · 태그명 1.2 · 일정 설명 0.7
--   exact_bonus: 정규화 구 전체 포함 1.0 · 토큰 전부 포함 0.5 · 유사도만 0
--   engagement: VOD/챕터 = 0.4·ln(1+read)/ln(1+max) + 0.2·ln(1+like+comment)/ln(1+max) + 0.2·챕터수/max
--               일정 = 0.4·하트(계정+익명)/max
--   freshness: 0.3·exp(-경과일/365)
create or replace function public.search_public(p_calendar_id uuid, p_q text, p_limit integer default 50)
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
  score numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select
      public.search_norm(p_q) as qn,
      array_remove(array(
        select public.search_norm(t) from regexp_split_to_table(coalesce(p_q, ''), '\s+') as t
        where length(public.search_norm(t)) >= 2
      ), '') as toks
  ),
  -- 후보 판정: 구 전체 포함 or 토큰 일부 포함(비율 보너스) or 트라이그램 유사도 ≥ 0.25
  -- 토큰은 2글자 이상만(한 글자는 잡음).
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
  ev_scored as (
    select
      'event'::text as kind,
      ev.id as event_id,
      null::bigint as title_no,
      null::integer as sec,
      ev.date_key,
      ev.start_time,
      ev.public_title as title,
      -- 발췌: 원문에서 검색어(소문자) 위치 근처 120자. 정규화 위치는 원문과 어긋나 원문 기준으로 찾는다.
      case
        when position(q.qn in ev.dn) > 0 then
          substr(ev.descr, greatest(1, position(lower(trim(coalesce(p_q, ''))) in lower(ev.descr)) - 30), 120)
        else ''
      end as snippet,
      null::bigint as duration_ms,
      null::text as host_nick,
      (
        greatest(
          3.0 * similarity(ev.tn, q.qn),
          1.2 * similarity(ev.tagn, q.qn),
          0.7 * similarity(ev.dn, q.qn)
        )
        + case
            when position(q.qn in ev.tn) > 0 then 1.0
            when position(q.qn in ev.tagn) > 0 or position(q.qn in ev.dn) > 0 then 0.6
            when cardinality(q.toks) > 1 then 0.5 * public.search_tok_ratio(ev.tn || ev.tagn || ev.dn, q.toks)
            else 0
          end
        + 0.4 * coalesce((select n from ev_hearts where ev_hearts.event_id = ev.id), 0) / (select mx from ev_max)
        + 0.3 * exp(-greatest(0, (current_date - ev.date_key))::numeric / 365.0)
      )::numeric as score
    from ev, q
    where length(q.qn) >= 2 and (
      position(q.qn in ev.tn) > 0
      or position(q.qn in ev.tagn) > 0
      or position(q.qn in ev.dn) > 0
      or (cardinality(q.toks) > 1 and public.search_tok_ratio(ev.tn || ev.tagn || ev.dn, q.toks) > 0)
      or similarity(ev.tn, q.qn) >= 0.25
    )
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
        2.0 * similarity(v.tn, q.qn)
        + case
            when position(q.qn in v.tn) > 0 then 1.0
            when cardinality(q.toks) > 1 then 0.5 * public.search_tok_ratio(v.tn, q.toks)
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score
    from vods v
    join vod_engage g on g.title_no = v.title_no, q
    where length(q.qn) >= 2 and (
      position(q.qn in v.tn) > 0
      or (cardinality(q.toks) > 1 and public.search_tok_ratio(v.tn, q.toks) > 0)
      or similarity(v.tn, q.qn) >= 0.25
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
        1.5 * similarity(c.label_norm, q.qn)
        + case
            when position(q.qn in c.label_norm) > 0 then 1.0
            when cardinality(q.toks) > 1 then 0.5 * public.search_tok_ratio(c.label_norm, q.toks)
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score
    from public.vod_chapter_index c
    join vods v on v.title_no = c.title_no
    join vod_engage g on g.title_no = c.title_no, q
    where length(q.qn) >= 2 and (
      position(q.qn in c.label_norm) > 0
      or (cardinality(q.toks) > 1 and public.search_tok_ratio(c.label_norm, q.toks) >= 0.5)
      or similarity(c.label_norm, q.qn) >= 0.3
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
         round(score, 4) as score
  from merged
  order by score desc, date_key desc, sec asc nulls first
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

comment on function public.search_public(uuid, text, integer) is
  '시청자 검색(0076) — 공개 일정·다시보기·팬 타임라인 챕터를 한 순위로. 비공개/초안/미공개 떡밥/구독 VOD 제외. 원본 비노출.';

grant execute on function public.search_public(uuid, text, integer) to anon, authenticated;
