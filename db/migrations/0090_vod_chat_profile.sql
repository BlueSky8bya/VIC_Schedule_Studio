-- 0090: 다시보기 채팅 → 구간 프로필(반응·발화 밀도·웃음) + 채팅 속 스트리머 방문 + 은어 사전 초안.
--
-- 소유자(2026-09-18) 결정:
--  · 숫자(메시지 수·발화자 수)는 시청자에게 **절대 표기하지 않는다** — 비율(방송 안 최대 대비 0~1)만 내보낸다.
--  · 채팅에서 배우는 인물은 **아는 스트리머 이름만**(search_entities·seed-person 별칭). 시청자 이름은 수집 사고.
--    인사 줄임("샬하"=샬롯님 하이, "쵸하", "용하")도 아는 이름의 음절+하 로만 푼다(수집기가 그 표로 센다).
--  · 채팅 방문 = 합방이 아닐 수 있다(놀러온 것). 그래도 친분 근거로는 쓴다 → entities.visits, 관계는 'visit' 가중 0.5.
--  · 이모티콘 제외(0089), 옛 방송 감쇠(0089)는 그대로.
-- 저장: 원문·아이디·닉 **미저장**. 구간(30초)별 메시지 수·고유 발화자 수(수집기가 메모리에서만 세고 개수만)·웃음 점수·상위 단어.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0090_vod_chat_profile.sql

create table if not exists public.vod_chat_bins (
  title_no bigint not null references public.vod_archive(title_no) on delete cascade,
  bin integer not null,            -- 30초 구간 번호(0부터)
  msgs integer not null default 0,
  speakers integer not null default 0, -- 고유 발화자 수(개수만; 식별자는 저장 안 함)
  laugh integer not null default 0,    -- ㅋ 개수 합(메시지당 12 캡)
  terms text[] not null default '{}',  -- 구간 상위 단어(≤3, 이모티콘·불용어 제외)
  primary key (title_no, bin)
);
create table if not exists public.vod_chat_people (
  title_no bigint not null references public.vod_archive(title_no) on delete cascade,
  name text not null,              -- search_norm 된 스트리머 이름(아는 이름만)
  greetings integer not null default 0, -- "샬하"류 인사 수
  mentions integer not null default 0,  -- 이름 그대로("샬롯","샬롯님") 수
  primary key (title_no, name)
);
create table if not exists public.search_dictionary_notes (
  term text primary key,
  note text,                       -- 개발자가 적은 뜻
  ignored boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.vod_chat_bins enable row level security;
alter table public.vod_chat_people enable row level security;
alter table public.search_dictionary_notes enable row level security;
grant select, insert, update, delete on public.vod_chat_bins, public.vod_chat_people, public.search_dictionary_notes to service_role;

alter table public.search_entities add column if not exists visits integer not null default 0;

-- 다시 받기: 구간 프로필이 없는 옛 수집분은 처음부터(백필 초기라 비용 없음).
delete from public.vod_chat_sync;
delete from public.vod_chat_terms;

-- 수집기가 쓸 '아는 사람' 표: 이름 + 인사 줄임 후보(첫 음절+하, 끝 음절+하). 한 음절이 두 사람에 걸리면 뺀다.
create or replace function public.search_known_people()
returns table (name text, greeting text)
language sql
stable
security definer
set search_path = public
as $$
  with names as (
    -- 제목·챕터에서 자주(3문서↑) 또는 합방 표식과 함께 나온 이름만 — "작가님"·"단답님" 같은 보통명사 언급이 새지 않게
    select e.name from public.search_entities e where e.docs >= 3 or e.hapbang >= 1
    union
    select s.term from public.search_synonyms s where s.source = 'seed-person'
    union
    select s.alt from public.search_synonyms s where s.source = 'seed-person'
  ),
  ok as (
    select name from names where name ~ '^[가-힣]{2,8}$'
  ),
  cand as (
    select name, substr(name, 1, 1) || '하' as greeting from ok
    union
    select name, substr(name, length(name), 1) || '하' as greeting from ok
  ),
  uniq as (
    select greeting from cand group by greeting having count(distinct name) = 1
  )
  select c.name, c.greeting from cand c join uniq u on u.greeting = c.greeting
  union all
  select name, null from ok;
$$;
grant execute on function public.search_known_people() to service_role;

-- 시청자용 구간 프로필 — **비율만**. heat = 메시지 수/최대, density = 발화자 수/최대, laugh = 웃음/최대.
-- laugh_tier: 이 방송의 메시지당 웃음이 전체(20구간 이상 방송) 상위 25%면 'high'.
create or replace function public.vod_chat_profile(p_title_no bigint)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with b as (
    select bin, msgs, speakers, laugh, terms from public.vod_chat_bins where title_no = p_title_no
  ),
  mx as (
    select greatest(1, max(msgs)) as m, greatest(1, max(speakers)) as s, greatest(1, max(laugh)) as l from b
  ),
  mine as (
    select case when sum(msgs) > 0 then sum(laugh)::numeric / sum(msgs) else 0 end as lpm, count(*) as n from b
  ),
  others as (
    select title_no, sum(laugh)::numeric / greatest(1, sum(msgs)) as lpm
    from public.vod_chat_bins group by title_no having count(*) >= 20 and sum(msgs) >= 200
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
$$;
grant execute on function public.vod_chat_profile(bigint) to anon, authenticated, service_role;

-- 인물 언급에 채팅 방문 합류(0079 재정의): 아는 이름의 인사·언급이 충분한 방송에 '방문' 언급 한 줄(합방 표식 아님).
create or replace function public.search_person_mentions()
returns table (doc text, day date, is_hap boolean, name text, display text)
language sql
stable
set search_path = public
as $$
  with stop as (
    select unnest(array['여러분','시청자','구독자','팬','팬치','팬분','회원','선생','고객','너희','우리','저희','자기','손','형','누나','언니','오빠','님']) as w
  ),
  raw as (
    select 'v:' || v.title_no as doc, v.broadcast_day as day,
           v.title ~* '합방|콜라보|w\.|with' as is_hap,
           m[1] as disp
    from public.vod_archive v, regexp_matches(v.title, '([가-힣a-zA-Z0-9]{1,8})님', 'g') as m
    where v.auth_no = 101
    union all
    select 'v:' || c.title_no, v.broadcast_day,
           v.title ~* '합방|콜라보|w\.|with',
           m[1]
    from public.vod_chapter_index c
    join public.vod_archive v on v.title_no = c.title_no and v.auth_no = 101,
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
    join public.vod_archive v on v.title_no = p.title_no and v.auth_no = 101
    where (p.greetings >= 5 or p.mentions >= 8)
      and v.broadcast_day >= current_date - interval '540 days'
  )
  select doc, day, is_hap, name, display from norm
  where length(name) >= 2 and name not in (select w from stop) and name !~ '^[0-9]+$'
  union all
  select doc, day, is_hap, name, display from chat;
$$;

-- 그래프 재구축(0079 재정의): entities.visits = 채팅에서만 나온 방송 수(제목·챕터·일정엔 없음).
create or replace function public.search_graph_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n_entities int;
begin
  create temp table tmp_mentions on commit drop as
    select * from public.search_person_mentions();

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
    join public.vod_archive v on v.title_no = p.title_no and v.auth_no = 101
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
$$;

-- 관련 인물에 visits 추가(반환 형이 바뀌므로 drop 후 재생성).
drop function if exists public.search_related(text, integer);
create function public.search_related(p_q text, p_limit integer default 8)
returns table (name text, display text, co_docs integer, hapbang integer, visits integer, score numeric)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select public.search_norm(p_q) as qn
  ),
  me as (
    select e.name
    from public.search_entities e, q
    where e.name = q.qn or e.name || '님' = q.qn
       or e.name in (select s.alt from public.search_synonyms s where s.term = q.qn)
    order by e.docs desc
    limit 1
  )
  select
    case when r.a = me.name then r.b else r.a end as name,
    e.display,
    r.co_docs,
    r.hapbang,
    e.visits,
    round((r.ppmi * ln(1 + r.co_docs) + r.hapbang * 0.5)::numeric, 3) as score
  from me
  join public.search_relations r on r.a = me.name or r.b = me.name
  join public.search_entities e on e.name = case when r.a = me.name then r.b else r.a end
  where r.co_docs >= 2
  order by score desc, r.co_docs desc
  limit greatest(1, least(coalesce(p_limit, 8), 30));
$$;
grant execute on function public.search_related(text, integer) to anon, authenticated;

-- 은어 사전 초안(개발자 화면): 18개월 안 채팅에서 2방송 이상·합계 10회 이상 나온 말 중 사전(동의어·인물)에 없고
-- 제목·챕터 문서에도 없는 말. 처음/마지막 방송 날짜와 예시 방송 제목 2개.
create or replace function public.search_dictionary_draft(p_limit integer default 200)
returns table (term text, vods integer, total bigint, first_day date, last_day date, samples text[], note text)
language sql
stable
security definer
set search_path = public
as $$
  with t as (
    select c.term, count(distinct c.title_no)::int as vods, sum(c.cnt)::bigint as total,
           min(v.broadcast_day) as first_day, max(v.broadcast_day) as last_day
    from public.vod_chat_terms c
    join public.vod_archive v on v.title_no = c.title_no and v.auth_no = 101
    where v.broadcast_day >= current_date - interval '540 days'
      and c.term ~ '^[가-힣]{2,6}$' and c.cnt >= 2
    group by c.term
    having count(distinct c.title_no) >= 2 and sum(c.cnt) >= 10
  ),
  docs_words as (
    select distinct lower(x) as w
    from (
      select v.title as txt from public.vod_archive v where v.auth_no = 101
      union all
      select c.label from public.vod_chapter_index c
    ) d, regexp_split_to_table(d.txt, '[^가-힣a-zA-Z0-9]+') as x
  )
  select t.term, t.vods, t.total, t.first_day, t.last_day,
    (select array_agg(v.title order by c.cnt desc)
       from (select c.title_no, c.cnt from public.vod_chat_terms c where c.term = t.term order by c.cnt desc limit 2) c
       join public.vod_archive v on v.title_no = c.title_no) as samples,
    n.note
  from t
  left join public.search_dictionary_notes n on n.term = t.term
  where coalesce(n.ignored, false) = false
    and not exists (select 1 from public.search_synonyms s where s.term = t.term or s.alt = t.term)
    and not exists (select 1 from public.search_entities e where e.name = t.term)
    and not exists (select 1 from docs_words w where w.w = t.term)
    and not exists (select 1 from public.search_synonyms s where s.term = t.term || '님' or s.alt = t.term || '님')
  order by t.last_day desc, t.total desc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;
grant execute on function public.search_dictionary_draft(integer) to service_role;

select public.search_graph_rebuild();
