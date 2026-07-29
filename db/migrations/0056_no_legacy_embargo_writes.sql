-- 0056: legacy 'embargo' scope 신규 쓰기 차단(P0-PRIV-3)
--
-- 0025가 기존 embargo 행을 owner_private로 통합했고(현재 embargo 행 0 — 2026-07-29 감사),
-- enum 값 자체는 Postgres 특성상 제거가 비싸므로 CHECK 제약으로 "새로 못 들어오게"만 막는다.
-- 앱 코드의 embargo 분기는 유사시 fail-closed 방어(비공개 취급)로 남긴다.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0056_no_legacy_embargo_writes.sql

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'events_no_legacy_embargo' and conrelid = 'public.events'::regclass
  ) then
    alter table public.events
      add constraint events_no_legacy_embargo
      check (visibility_scope <> 'embargo');
  end if;
end $$;
