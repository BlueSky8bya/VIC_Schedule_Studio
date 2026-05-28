-- 개발자 인사이트 "방문 추이"용 익명 방문 로그.
-- 브라우저당 하루 1회만 역할/기기/날짜를 남긴다(개인정보 없음 — 이메일·user_id 미저장).
-- session_hash는 그날 고유 방문 집계용 무작위 식별자(PII 아님).
-- 쓰기/읽기는 서비스 롤(서버 액션)로만 — RLS 정책을 두지 않아 일반 사용자는 접근 불가.

create table if not exists public.visit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  day date not null,
  role text not null,
  device text not null,
  session_hash text not null
);

create index if not exists visit_log_day_idx on public.visit_log (day);
create index if not exists visit_log_occurred_idx on public.visit_log (occurred_at);

alter table public.visit_log enable row level security;

-- 일반 사용자(anon/authenticated)는 정책이 없으므로 읽기/쓰기 모두 불가.
-- 서버 액션이 쓰는 서비스 롤 키는 RLS를 우회하므로 별도 grant가 필요 없다.
revoke all on public.visit_log from anon, authenticated;
