-- 신뢰 멤버가 매니저·작업자 역할을 동시에 가질 수 있게 한다(한 계정에 두 태그).
-- 권한상 매니저가 작업자를 포함하므로, 앱이 유지하는 effective trusted_role은 is_manager면
-- 'manager', 아니면 'worker'다. RLS(is_trusted_member)는 is_active만 보므로 영향 없음.
-- 멱등: 여러 번 실행해도 안전하다.

alter table public.trusted_members
  add column if not exists is_manager boolean not null default false,
  add column if not exists is_worker boolean not null default false;

-- 기존 단일 trusted_role에서 플래그 백필.
update public.trusted_members
  set is_manager = true
  where trusted_role = 'manager' and is_manager = false;

update public.trusted_members
  set is_worker = true
  where trusted_role = 'worker' and is_worker = false;
