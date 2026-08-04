-- 0063: 시청자는 '카운트만', 내부자는 타임라인 (PLAN-20260804-003 Phase C / ADR-0013 보강)
--
-- 사용자 결정(2026-08-04, 2차): 관리자·개발자 등 내부자는 입장/퇴장 시각까지 남기고,
-- 비로그인·시청자는 **개수만** 센다. 이유 둘:
--   1) 목적이 "어떤 버튼이 안 쓰이나"라 시청자 쪽은 합계면 충분하다.
--   2) 버튼 클릭을 전수로 남기면 행이 폭증한다 — 시청자는 수가 많고 개인 타임라인도 필요 없다.
--
-- 그래서 activity_event(0062)에는 이제 **내부자 이벤트만** 들어간다. 시청자·비로그인 이벤트는
-- 여기 (날짜 × 역할 × 종류 × 대상) 한 줄로 접혀 count만 올라간다. 신원은 물론이고
-- '개인 세션'조차 남지 않는다 — 익명성이 집계 구조 자체로 보장된다.
--
-- target은 PK에 들어가므로 null을 못 쓴다 → 대상 없는 이벤트는 빈 문자열('')로 둔다.
--
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0063_activity_counts.sql

create table if not exists public.activity_daily_count (
  day    date not null,
  role   text not null,
  kind   text not null,
  target text not null default '',   -- 버튼 id·라우트 경로 등. 없으면 ''
  count  integer not null default 0,
  primary key (day, role, kind, target)
);

-- 패널은 (기간 → 종류별 합계)로 훑는다. "덜 쓰이는 버튼" 목록이 주 질의.
create index if not exists activity_daily_count_kind_idx
  on public.activity_daily_count (kind, day);

comment on table public.activity_daily_count is
  '시청자·비로그인 행동 집계(개발자 전용). 개인 타임라인 없음 — 개수만. 내부자는 activity_event를 쓴다.';

-- 배치 증분 — 클라 한 번의 flush를 한 번의 왕복으로 올린다(행마다 upsert하면 왕복이 폭증).
-- p_rows: [{"day":"2026-08-04","role":"viewer","kind":"ui.click","target":"tag-filter","n":3}, ...]
create or replace function public.bump_activity_counts(p_rows jsonb)
returns void
language sql
as $$
  insert into public.activity_daily_count (day, role, kind, target, count)
  select
    (r->>'day')::date,
    r->>'role',
    r->>'kind',
    coalesce(r->>'target', ''),
    greatest(1, coalesce((r->>'n')::int, 1))
  from jsonb_array_elements(p_rows) as r
  on conflict (day, role, kind, target)
  do update set count = public.activity_daily_count.count + excluded.count;
$$;

-- service_role 전용: RLS 켜고 정책 없음 + service_role DML.
-- (새 테이블 grant 누락 시 서버 쓰기가 조용히 permission denied로 죽는 함정 — 0035/0043 재발 방지.)
alter table public.activity_daily_count enable row level security;
grant select, insert, update, delete on public.activity_daily_count to service_role;
revoke all on public.activity_daily_count from anon, authenticated;
revoke all on function public.bump_activity_counts(jsonb) from public, anon, authenticated;
grant execute on function public.bump_activity_counts(jsonb) to service_role;
