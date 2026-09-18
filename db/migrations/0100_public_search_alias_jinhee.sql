-- 0100: 소유자 별칭 시드 — 진희 = 진솔(스트리머가 중간에 이름을 바꿈, 같은 사람), 젠황 = 젠투(사랑전도사 젠투)의 별명.
-- 소유자(2026-09-18). 시드 인물 별칭(0085)과 같은 source 'seed-person', kind 'syn' 양방향.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0100_public_search_alias_jinhee.sql

insert into public.search_synonyms (term, alt, source, kind) values
  ('진희', '진솔', 'seed-person', 'syn'), ('진솔', '진희', 'seed-person', 'syn'),
  ('진희님', '진솔', 'seed-person', 'syn'), ('진솔님', '진희', 'seed-person', 'syn'),
  ('젠황', '젠투', 'seed-person', 'syn'), ('젠투', '젠황', 'seed-person', 'syn'),
  ('젠황', '사랑전도사젠투', 'seed-person', 'syn'), ('사랑전도사젠투', '젠황', 'seed-person', 'syn'),
  ('젠투', '사랑전도사젠투', 'seed-person', 'syn'), ('사랑전도사젠투', '젠투', 'seed-person', 'syn')
on conflict (term, alt) do nothing;
