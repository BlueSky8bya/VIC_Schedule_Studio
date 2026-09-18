-- 0103: 소유자 별칭 시드 — 엔젤 = 우왁굳 부인 김수현 아나운서(슈슈잉이, 안경누나). seed-person syn 양방향.
-- 소유자(2026-09-18): 웹 조사(0102)가 '엔젤'을 특정 못 했는데, 왁굳형 부인 엔젤님이 맞다고 확인.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0103_public_search_alias_angel.sql

insert into public.search_synonyms (term, alt, source, kind) values
  ('엔젤', '슈슈잉이', 'seed-person', 'syn'), ('슈슈잉이', '엔젤', 'seed-person', 'syn'),
  ('엔젤', '김수현', 'seed-person', 'syn'), ('김수현', '엔젤', 'seed-person', 'syn'),
  ('엔젤', '안경누나', 'seed-person', 'syn'), ('안경누나', '엔젤', 'seed-person', 'syn'),
  ('슈슈잉이', '김수현', 'seed-person', 'syn'), ('김수현', '슈슈잉이', 'seed-person', 'syn'),
  ('슈슈잉이', '안경누나', 'seed-person', 'syn'), ('안경누나', '슈슈잉이', 'seed-person', 'syn'),
  ('엔젤님', '슈슈잉이', 'seed-person', 'syn'), ('엔젤님', '김수현', 'seed-person', 'syn')
on conflict (term, alt) do nothing;
