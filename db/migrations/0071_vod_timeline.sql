-- 0071: 팬 타임라인(다시보기 챕터) 저장 — PLAN-20260831-001 Phase 2 A안.
-- 숲 다시보기 댓글의 팬 타임라인(HH:MM:SS 라벨 + [코너] 헤더)을 파싱해 VOD당 한 행으로 둔다.
-- 시청자 화면의 '챕터' 목록(항목 탭 = 그 시각으로 점프, ?change_second= — 2026-08-31 실측 확정) 원천.
--
-- 공개 성격: 원문이 숲 공개 댓글(누구나 봄)이라 anon SELECT를 허용한다(0068 vod_archive와 같은
-- 예외 계열). 작성자 닉은 공개 화면에 '타임라인 · ○○님' 크레딧으로 표기된다(팬 기여 명시).

create table if not exists public.vod_timeline (
  title_no bigint primary key,
  author_nick text not null default '',
  comment_no bigint,
  entry_count integer not null default 0,
  -- [{ sec: number, label: string, section: string|null }] — 방송 내 초 단위 시각순.
  entries jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now()
);

alter table public.vod_timeline enable row level security;

drop policy if exists vod_timeline_public_read on public.vod_timeline;
create policy vod_timeline_public_read on public.vod_timeline
  for select to anon, authenticated using (true);

grant select on public.vod_timeline to anon, authenticated;
-- service_role DML grant — RLS 테이블 grant 누락 시 서버 쓰기가 조용히 죽는다(0035/0043 교훈).
grant select, insert, update, delete on public.vod_timeline to service_role;

comment on table public.vod_timeline is
  '팬 타임라인 챕터(0071) — 숲 공개 댓글 파싱본. 수집기: lib/broadcast/vod-timeline.ts';
