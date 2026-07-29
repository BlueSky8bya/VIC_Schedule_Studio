-- 0057: 비공개 잠금해제를 '브라우저 auth 세션 단위'로 (P0-PRIV-2, ADR-0011 L8)
--
-- 기존 unlock_sessions는 user+calendar 단위라, 한 브라우저에서 비밀번호를 풀면 같은 Google
-- 계정의 다른 기기/브라우저까지 열렸다(shared-device 위협). 새 grants는:
--   opaque 256-bit 토큰(HttpOnly 쿠키에만) → DB에는 sha256 해시 + Supabase auth session_id 결속.
--   쿠키 토큰과 auth 세션이 모두 일치해야 열림 → 다른 세션은 각자 비밀번호 입력.
-- unlock_sessions 테이블은 당장 drop하지 않는다(코드가 더 이상 읽지 않음 → 자연 만료.
-- 정리는 후속 마이그레이션에서). RLS 정책 없음 + service_role 전용(기존 관례와 동일).
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0057_private_unlock_grants.sql

create table if not exists public.private_unlock_grants (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  -- Supabase access JWT의 session_id claim — 이 grant가 유효한 브라우저 auth 세션.
  auth_session_id text not null,
  passcode_version integer not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_unlock_grants_user_cal
  on public.private_unlock_grants (user_id, calendar_id, expires_at);

-- 무차별 대입 방어용 시도 기록(성공/실패). 오래된 행은 잠금해제 시도 때 지나가며 청소.
create table if not exists public.private_unlock_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  ok boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_unlock_attempts_user_time
  on public.private_unlock_attempts (user_id, created_at desc);

-- service_role 전용: RLS 켜고 정책 없음(anon/authenticated 직접 접근 차단) + service_role DML.
-- (새 테이블 grant 누락 시 서버 쓰기가 조용히 죽는 함정 — 0035/0043 재발 방지.)
alter table public.private_unlock_grants enable row level security;
alter table public.private_unlock_attempts enable row level security;
grant select, insert, update, delete on public.private_unlock_grants to service_role;
grant select, insert, update, delete on public.private_unlock_attempts to service_role;
revoke all on public.private_unlock_grants from anon, authenticated;
revoke all on public.private_unlock_attempts from anon, authenticated;
