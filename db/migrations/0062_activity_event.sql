-- 0062: 행동 기록 — 세션을 타임라인으로 재구성한다 (PLAN-20260804-003 Phase B)
--
-- 배경: 지금까지 남는 건 '언제·얼마나·어떤 기기·무슨 역할'뿐이었다. 어느 화면을 봤는지, 어떤
-- 일정을 열었는지, 무엇을 고쳤는지는 어떤 테이블에도 없어서 방문 목적을 추정할 수 없었다.
-- 목적은 감시가 아니라 니즈 파악 — 무엇을 찾다가 못 찾고 나갔는지를 보려는 것이다.
--
-- ⚠ 이 테이블은 프로젝트의 기존 방침("이메일·user_id 미저장, 익명 집계만")을 부분적으로
--   뒤집는다. 범위를 좁혀서 뒤집는다 — ADR docs/agent/decisions/ 참조.
--
-- ── 식별 범위(사용자 결정 2026-08-04) ──
-- account_hash는 **내부자(owner/manager/worker/developer)만** 채운다. viewer·비로그인은
-- 쓰기 시점에 null로 강제한다 — 읽는 쪽에서 거르는 게 아니라 애초에 저장하지 않는다.
-- 그래서 일반 시청자는 개인 타임라인을 만들고 싶어도 만들 수 없다(구조적 보장).
-- visit_key는 모두에게 남긴다: 익명이고 탭이 닫히면 끝나는 값이라 신원이 아니며, "시청자가
-- 무엇을 하다 나갔나"라는 익명 퍼널을 보려면 이게 필요하다.
--
-- ── 절대 저장 금지(이 설계의 최우선 제약) ──
-- meta에 일정 제목·본문을 넣지 않는다. target에는 uuid만 두고 제목은 **읽는 시점에 권한을
-- 확인한 뒤 조인**한다. 안 그러면 이 테이블이 owner_private 우회 경로가 되어, 비공개 본문
-- AES-256-GCM 암호화(2026-06-17)가 통째로 무의미해진다. 변경 로그도 "어떤 필드가 바뀜"까지만.
--
-- source: 'server' = 권한을 통과한 실제 변경(진실, 위조 불가) / 'client' = 열람·시선(의도).
-- 둘을 섞으면 "고쳤다"와 "고치려 했다"를 구분할 수 없다.
--
-- 보존 90일(사용자 결정). 크론 없이 조회할 때 지나가며 청소한다(private_unlock_attempts 패턴).
--
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0062_activity_event.sql

create table if not exists public.activity_event (
  id           bigint generated always as identity primary key,
  occurred_at  timestamptz not null default now(),
  day          date not null,               -- KST 날짜(범위 조회·보존 청소용)
  visit_key    text,                        -- 탭 방문(0061)과 결속 — 한 방문의 이벤트를 잇는다
  account_hash text,                        -- 내부자만. viewer/비로그인은 null(쓰기 시점 강제)
  role         text not null,
  device       text not null,
  source       text not null,               -- 'server' | 'client'
  kind         text not null,               -- 'route.enter' | 'event.update' | 'unlock.success' …
  target       text,                        -- 라우트 경로 / event uuid / tag key … (제목 금지)
  meta         jsonb,                       -- 월·필터값·바뀐 필드명 등 (본문·제목 금지)
  dur_ms       integer                      -- 체류형 이벤트(route.leave, event.close)
);

-- 패널은 (날짜 → 시각순)으로 훑고, 계정 타임라인은 (계정 → 시각순)으로 훑는다.
create index if not exists activity_event_day_time_idx
  on public.activity_event (day, occurred_at);
create index if not exists activity_event_visit_idx
  on public.activity_event (visit_key, occurred_at)
  where visit_key is not null;
create index if not exists activity_event_account_idx
  on public.activity_event (account_hash, occurred_at)
  where account_hash is not null;
-- 집계("이 달 가장 많이 열린 일정" 등)는 종류별로 묶는다.
create index if not exists activity_event_kind_idx
  on public.activity_event (day, kind);

comment on table public.activity_event is
  '행동 기록(개발자 전용). 내부자만 계정 식별, viewer/비로그인은 account_hash null. meta에 일정 제목·본문 금지. 보존 90일.';

-- service_role 전용: RLS 켜고 정책 없음(anon/authenticated 직접 접근 차단) + service_role DML.
-- (새 테이블 grant 누락 시 서버 쓰기가 조용히 permission denied로 죽는 함정 — 0035/0043 재발 방지.)
alter table public.activity_event enable row level security;
grant select, insert, update, delete on public.activity_event to service_role;
revoke all on public.activity_event from anon, authenticated;
