-- 0112: 요즘 뜨는 말 — 무거운 집계를 캐시 표로(채팅 단어 75만 행이 되자 조회가 statement timeout).
-- search_trends에 미리 계산해 두고 search_trending은 그걸 읽는다. 갱신은 단어 그래프 재구축 끝에서.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0112_public_search_trending_cache.sql

create table if not exists public.search_trends (
  term text primary key,
  recent integer not null default 0,
  ratio numeric not null default 0,
  computed_at timestamptz not null default now()
);
alter table public.search_trends enable row level security;
drop policy if exists search_trends_public_read on public.search_trends;
create policy search_trends_public_read on public.search_trends for select using (true);
grant select on public.search_trends to anon, authenticated, service_role;
grant insert, delete, update on public.search_trends to service_role;

create or replace function public.search_trending_rebuild(p_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public
as $BODY$
declare n_rows int;
begin
  delete from public.search_trends;
  insert into public.search_trends (term, recent, ratio)

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
  limit 60;
  get diagnostics n_rows = row_count;
  return n_rows;
end;
$BODY$;
grant execute on function public.search_trending_rebuild(integer) to service_role;

-- 조회는 캐시만 읽는다(수 ms).
create or replace function public.search_trending(p_days integer default 30, p_limit integer default 10)
returns table (term text, recent integer, ratio numeric)
language sql
stable
security definer
set search_path = public
as $BODY$
  select t.term, t.recent, t.ratio
  from public.search_trends t
  order by t.ratio desc, t.recent desc
  limit greatest(1, least(coalesce(p_limit, 10), 30));
$BODY$;
grant execute on function public.search_trending(integer, integer) to anon, authenticated;

select public.search_trending_rebuild(30);
