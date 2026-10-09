-- 0149: RYKY = 빅토리(RY · VICTORY) + 쵸로키(KY · CHOROKY) 유닛(2026-10-10 소유자 설명).
-- 그룹 → 멤버 한쪽만(seed-member): RYKY를 치면 두 사람 이름이 든 곡·챕터도. 빅토리·쵸로키를 쳐도 RYKY 전체로 넓히지 않는다
-- (두 사람은 방송 어디에나 나오므로 반대 방향은 잡음).
-- 자동 읽기(auto-xlit)가 만든 '라이키 → ryky'는 지운다 — 라이키는 TWICE 'LIKEY'의 읽기(seed-title)다.
-- 자동 읽기 대기 목록(0145)은 사람이 이미 다룬 말(동의어의 앞쪽 term으로 있는 것)도 건너뛴다 — 안 그러면 RYKY처럼
-- 짝을 일부러 고친 말에 엉뚱한 읽기가 다시 붙는다.
-- 적용: SUPABASE_DB_CA_PATH=.scratch-pw/supabase-ca.crt node scripts/apply-db.mjs db/migrations/0149_search_ryky_unit.sql

delete from public.search_synonyms where term = '라이키' and alt = 'ryky';

insert into public.search_synonyms (term, alt, source, kind) values
  ('ryky', '빅토리', 'seed-member', 'syn'),
  ('ryky', '쵸로키', 'seed-member', 'syn')
on conflict (term, alt) do nothing;

create or replace function public.search_xlit_pending(p_limit integer default 300)
returns table (latin text, norm text)
language sql
stable
security definer
set search_path = public
as $$
  with phrases as (
    select btrim(regexp_replace(x.p, '\s*[\(\[（].*$', '')) as p
    from public.vod_chapter_index c
    cross join lateral public.search_song_split(c.label) sp
    cross join lateral (values (sp.artist), (sp.title)) as x(p)
    where c.song_kind is not null and x.p ~ '[A-Za-z]'
  )
  select min(p) as latin, public.search_norm(p) as norm
  from phrases
  where p ~ '[A-Za-z]{2}' and length(public.search_norm(p)) between 2 and 40
    and not exists (select 1 from public.search_synonyms s where (s.alt = public.search_norm(p) or s.term = public.search_norm(p)) and s.kind = 'syn')
  group by public.search_norm(p)
  order by count(*) desc
  limit greatest(1, least(p_limit, 1000));
$$;
revoke all on function public.search_xlit_pending(integer) from public, anon, authenticated;
grant execute on function public.search_xlit_pending(integer) to service_role;

