-- #미정 기능: 일정이 아직 확정 아님(tentative)을 표시. 공개해도 안전한 상태값(시청자도 봄).
-- 기본 false(확정). idempotent.
alter table public.events
  add column if not exists is_tentative boolean not null default false;
