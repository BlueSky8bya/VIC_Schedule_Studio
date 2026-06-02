-- 방문/체류 통합 모델: '세션 이벤트' 한 줄 = 화면이 보이는 한 번의 방문.
-- 재진입(껐다 다시 봄)하면 또 한 줄이 생긴다(여러 번 기록). 들어온/나간 시각을 timestamptz로
-- 남겨 체류를 '초 단위'로 정확히 잰다(예전 분 단위 핑 버킷의 한계 제거).
--   started_at  = 화면이 보이기 시작한 시각(진입)
--   last_seen_at = 하트비트로 갱신되는 마지막 생존 시각(종료 비콘이 유실돼도 여기까지는 봄)
--   ended_at    = 나간 시각(visibilitychange→hidden/pagehide). null이면 last_seen_at을 종료로 본다.
--   유효 체류초 = coalesce(ended_at, last_seen_at) - started_at
-- 개인정보(이메일·user_id) 미저장 — account_hash(단방향)·역할·기기만. 쓰기/읽기는 서비스 롤 전용.

create table if not exists public.visit_session (
  id uuid primary key default gen_random_uuid(),
  day date not null,               -- KST 날짜(started_at 기준) — 월/일 범위 조회용
  account_hash text,               -- 익명 계정 해시(단방향). 비로그인/미상은 null 가능
  role text not null,
  device text not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists visit_session_day_idx on public.visit_session (day);
create index if not exists visit_session_started_idx on public.visit_session (started_at);

alter table public.visit_session enable row level security;
-- 일반 사용자(anon/authenticated)는 정책이 없으므로 읽기/쓰기 모두 불가. 서비스 롤은 RLS 우회.
revoke all on public.visit_session from anon, authenticated;
