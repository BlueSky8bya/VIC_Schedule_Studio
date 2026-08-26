-- 0065: 달력 꾸미기(스티커) 기능·작업자(worker) 역할 철수 — ADR-0015 (2026-08-27).
-- 사용자 결정: "깔끔하게 drop". 삭제 전 백업: docs/agent/backups/2026-08-27_stickers.json
-- (sticker_assets 12행, sticker_instances 2행). 신뢰 멤버는 0명이라 작업자 컬럼 삭제는 무손실.
-- 멱등: 여러 번 실행해도 안전.

-- 1) 스티커 테이블 — 정책·인덱스·FK는 cascade로 함께 사라진다.
drop table if exists public.sticker_instances cascade;
drop table if exists public.sticker_assets cascade;

-- 2) 스티커 스토리지 정책·헬퍼(0006_sticker_uploads). 버킷 안 객체는 scripts로 먼저 비운다
--    (SQL에서 storage.objects/buckets를 지우지 않는다 — Supabase가 금지).
drop policy if exists "sticker assets read" on storage.objects;
drop policy if exists "sticker assets insert" on storage.objects;
drop policy if exists "sticker assets update" on storage.objects;
drop policy if exists "sticker assets delete" on storage.objects;
drop function if exists public.can_decorate_vic();
-- 버킷 행은 SQL로 지울 수 없다(Supabase: "Direct deletion from storage tables is not allowed") →
-- scripts/cleanup-sticker-storage.mjs --delete 가 Storage API로 객체·버킷을 지운다.

-- 3) 작업자 역할 — RLS의 is_active_worker()는 항상 false(정책 본문은 그대로 두어 work 범위 행이
--    관리자(owner/dev) + 잠금해제에만 열린다). 그 다음 컬럼을 지운다(함수가 더는 참조하지 않으므로).
create or replace function public.is_active_worker(target_calendar_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  -- 작업자 역할 철수(0065, ADR-0015): 항상 false. 인자는 정책 호환용.
  select false;
$$;

alter table public.trusted_members drop column if exists is_worker;
-- 남아 있을 수 있는 옛 작업자 행은 매니저로 승격(현재 0행 — 방어용).
update public.trusted_members
set trusted_role = 'manager', is_manager = true
where trusted_role = 'worker';
-- enum public.trusted_role의 'worker' 값은 Postgres가 값 삭제를 지원하지 않아 남긴다(사용 안 함).
