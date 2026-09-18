-- 0088: 다시보기 채팅 리플레이 → 단어 빈도 학습(검색 은어·유행어·관련어의 새 원천).
--
-- 소유자(2026-09-18): 숲 비공식 API로 방송 중 시청자 댓글까지 가져와 은어·유행어·관련어를 배우자.
-- 원천: VOD 보기 API(station/video/a/view)의 files[].chat = ChatLoadSplit.php?rowKey=…_c&startTime=N
-- (600초 단위 XML). 수집기: lib/broadcast/vod-chat.ts.
--
-- 저장 원칙(개인정보): 채팅 원문·아이디·닉네임은 **저장하지 않는다**. 방송(title_no)별 **단어 빈도**만 남긴다.
-- 이모티콘(/빅하/ 같은 숲 표기)은 단어로 친다 — 팬덤 은어의 큰 부분이다.
--
-- 학습 배선: 단어 공출현 그래프(0080)·트렌딩(0079)·줄임말 자동 채굴(0078)의 문서에 채팅 단어(방송당
-- 빈도 ≥ 3)를 합친다. 제목·챕터에 없는 팬덤 말("빅하", "토리야" 같은 인사말·밈)이 그래프에 들어온다.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0088_vod_chat_terms.sql

create table if not exists public.vod_chat_terms (
  title_no bigint not null references public.vod_archive(title_no) on delete cascade,
  term text not null,          -- 정규화 단어(소문자) 또는 이모티콘("/빅하/")
  cnt integer not null default 0,
  primary key (title_no, term)
);
create index if not exists idx_vod_chat_terms_term on public.vod_chat_terms (term);
create table if not exists public.vod_chat_sync (
  title_no bigint primary key references public.vod_archive(title_no) on delete cascade,
  synced_at timestamptz not null default now(),
  chunks integer not null default 0,    -- 받은 600초 조각 수
  messages integer not null default 0,  -- 센 메시지 수(원문은 버림)
  complete boolean not null default false
);
alter table public.vod_chat_terms enable row level security;
alter table public.vod_chat_sync enable row level security;
-- 정책 없음 = anon 직접 조회 차단(집계는 security definer 함수·개발자 화면만). service_role DML grant 필수(0035/0043).
grant select, insert, update, delete on public.vod_chat_terms, public.vod_chat_sync to service_role;

-- 단어 그래프(0080)에 채팅 단어 합치기.
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
    union all
    -- 채팅 단어(방송당 3회 이상) — 이모티콘 포함
    select 'v:' || t.title_no, v.broadcast_day, t.term
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no = 101
    where t.cnt >= 3
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

  delete from public.search_synonyms where source = 'auto-rel';
  insert into public.search_synonyms (term, alt, source, kind, support)
  select r.a, r.b, 'auto-rel', 'rel-chip', r.co_docs from public.search_term_relations r where r.ppmi >= 2 and r.co_docs >= 4
  union all
  select r.b, r.a, 'auto-rel', 'rel-chip', r.co_docs from public.search_term_relations r where r.ppmi >= 2 and r.co_docs >= 4
  on conflict (term, alt) do nothing;

  return n_terms;
end;
$$;

-- 줄임말 자동 채굴(0078)에 채팅 단어 합치기: 채팅의 짧은 말(2~3자, 방송당 5회 이상) ↔ 제목 긴 단어.
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
    union
    select t.title_no, t.term
    from public.vod_chat_terms t
    where t.cnt >= 5 and length(t.term) between 2 and 3 and t.term ~ '^[가-힣]+$'
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

-- 트렌딩(0079)에 채팅 단어 합치기 — 최근 N일 채팅에서 갑자기 많이 친 말.
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
  ),
  words as (
    select day, lower(x) as w, 1 as n
    from docs, regexp_split_to_table(txt, '[^가-힣a-zA-Z0-9]+') as x
    where x ~ '^[가-힣]{2,6}$'
    union all
    -- 채팅: 방송당 빈도를 그대로 더하되 폭주(도배)를 눌러 방송당 최대 30으로 센다
    select v.broadcast_day, t.term, least(t.cnt, 30)
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no = 101
    where t.term ~ '^[가-힣]{2,6}$' or t.term ~ '^/[가-힣a-zA-Z0-9]{1,8}/$'
  ),
  stop as (
    select unnest(array['토리님','토리','빅토리','빅토리님','방송','시작','종료','오늘','내일','시간','잠깐','다시','이야기','토리가','우리','그냥','정말','진짜','후열','엔딩','멘트','휴식','시청자','새로운','요즘','오늘도','이번','다음','처음','마지막','드디어','바로',
      'ㅋㅋㅋ','ㅋㅋ','ㅠㅠ','ㅎㅎ','아니','근데','뭐야','진짜','대박','와우','헐','오오','ㄷㄷ','ㄹㅇ','ㅇㅇ','ㄴㄴ','ㅇㅋ','ㄱㄱ','ㅈㅈ']) as w
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

-- 개발자 확인용: 채팅에서 많이 쓰이는 말(전체) — 은어 사전 후보 살피기.
create or replace function public.search_chat_top_terms(p_limit integer default 100)
returns table (term text, total bigint, vods bigint)
language sql
stable
security definer
set search_path = public
as $$
  select term, sum(cnt)::bigint as total, count(distinct title_no)::bigint as vods
  from public.vod_chat_terms
  group by term
  having count(distinct title_no) >= 2
  order by total desc
  limit greatest(1, least(coalesce(p_limit, 100), 1000));
$$;
grant execute on function public.search_chat_top_terms(integer) to service_role;
