-- 0068: 숲 다시보기(VOD) 아카이브 — PLAN-20260831-001 Phase 1.
-- 토리님 방송국의 다시보기 목록(chapi .../vods/review)을 서버가 주기 수집해 저장한다.
-- 시청자 화면에서 날짜 → 해당 다시보기 링크 + 영상 길이를 보여주는 원천 데이터.
--
-- 공개 성격: 여기 담기는 값(제목·영상 번호·길이·조회수)은 숲에서 누구나 보는 공개 정보다.
-- 그래서 다른 운영 테이블(deny-all + SECURITY DEFINER RPC)과 달리 anon SELECT를 허용해
-- 공개 로더가 직접 읽는다(집계 RPC 불필요). 쓰기는 service_role(수집기)만.
-- 단일 스트리머 앱이라 calendar_id 없음(broadcast_session과 같은 원칙).

create table if not exists public.vod_archive (
  -- SOOP VOD 번호(title_no) — 플레이어 URL(vod.sooplive.co.kr/player/{title_no})의 키.
  title_no bigint primary key,
  -- 방송번호 — broadcast_session.bno와 조인해 세션↔VOD를 정확히 잇는다(thumb rowKey에서 추출).
  bno text,
  -- 방송 '시작' 날짜(KST) 귀속 — thumb rowKey의 날짜(1순위), 없으면 reg_date-길이로 계산.
  -- broadcast_session.start_day와 같은 시작일 귀속 원칙.
  broadcast_day date not null,
  title text not null default '',
  duration_ms bigint not null default 0,
  -- VOD 등록 시각(≈뱅종, KST → UTC 변환 저장)
  reg_date timestamptz,
  comment_cnt integer not null default 0,
  like_cnt integer not null default 0,
  read_cnt integer not null default 0,
  synced_at timestamptz not null default now()
);

create index if not exists vod_archive_day_idx on public.vod_archive (broadcast_day);

alter table public.vod_archive enable row level security;

-- 공개 읽기(위 공개 성격 참조). 쓰기 정책은 만들지 않는다 — service_role은 RLS 우회 + grant로만.
drop policy if exists vod_archive_public_read on public.vod_archive;
create policy vod_archive_public_read on public.vod_archive
  for select to anon, authenticated using (true);

grant select on public.vod_archive to anon, authenticated;
-- service_role DML grant — RLS 테이블은 grant 없이는 서버 쓰기가 조용히 죽는다(0035/0043 교훈).
grant select, insert, update, delete on public.vod_archive to service_role;

comment on table public.vod_archive is
  '숲 다시보기(VOD) 아카이브(0068) — 공개 메타데이터만. 수집기: lib/broadcast/vod-archive.ts';
