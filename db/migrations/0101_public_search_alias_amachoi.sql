-- 0101: 소유자 별칭 시드 — 아마최 = 마최 = 아마데우스 최(같은 사람). seed-person syn 양방향(0085 규약).
-- 소유자(2026-09-18). 이후 웹 조사로 모은 스트리머 별칭은 0102에 이어 넣는다.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0101_public_search_alias_amachoi.sql

insert into public.search_synonyms (term, alt, source, kind) values
  ('아마최', '마최', 'seed-person', 'syn'), ('마최', '아마최', 'seed-person', 'syn'),
  ('아마최', '아마데우스최', 'seed-person', 'syn'), ('아마데우스최', '아마최', 'seed-person', 'syn'),
  ('마최', '아마데우스최', 'seed-person', 'syn'), ('아마데우스최', '마최', 'seed-person', 'syn')
on conflict (term, alt) do nothing;
