-- 방송 ON/OFF 세션 기록 — 토리님 SOOP 라이브 상태를 서버가 폴링(soop-live 라우트 + 백업 cron)하며
-- 켜짐→꺼짐 한 번을 한 줄로 남긴다. 개발자 인사이트 "트렌드 > 방송 시간" 집계용(일별 막대 + 월별 합계).
--   started_at   = 라이브가 처음 감지된 시각(방송 시작 추정)
--   last_live_at = 마지막으로 라이브가 확인된 시각(폴링 간격만큼만 늦음 — 종료시각 추정에 사용)
--   ended_at     = 방송 종료 확정 시각(= 종료가 감지된 시점의 last_live_at). null이면 진행 중(미확정).
--   유효 방송시간 = coalesce(ended_at, last_live_at) - started_at
-- 귀속(start_day): 23일 21시 시작→24일 03시 종료라도 '23일 방송'으로 통째 친다(스트리머 멘탈모델:
--   방송 1회 = 1세션). 자정/월경계로 쪼개지 않는다 — 원본(started_at/ended_at)은 남으니 추후 재계산 가능.
-- 단일 스트리머 앱이라 calendar_id 없이 전역 1행 흐름. 내부 진단용 — RLS deny-all(서비스 롤만 접근).
create table if not exists public.broadcast_session (
  id uuid primary key default gen_random_uuid(),
  start_day date not null,             -- KST 시작일(귀속일) — 월/일 범위 조회용
  started_at timestamptz not null,
  last_live_at timestamptz not null,
  ended_at timestamptz,                -- null = 진행 중
  title text,                          -- 시작 시점의 방송 제목(맥락용; 공개 스트림 제목)
  created_at timestamptz not null default now()
);

-- 범위 집계(start_day로 거름) + 열린 세션(ended_at is null) 빠른 조회용.
create index if not exists broadcast_session_start_day_idx on public.broadcast_session (start_day);
create index if not exists broadcast_session_open_idx on public.broadcast_session (ended_at, last_live_at);

alter table public.broadcast_session enable row level security;
-- 정책 없음 = anon/authenticated 직접 접근 차단(서비스 롤만 접근).
revoke all on public.broadcast_session from anon, authenticated;
