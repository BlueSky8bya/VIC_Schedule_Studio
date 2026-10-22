-- 0155: 구독 전용 업로드 영상(SOOP file_type=NORMAL, auth_no=107) — 2026-10-23 소유자 요청.
-- 숲 카드의 '구독' 배지 = 업로드 영상 + 107, '구독+' = 다시보기(REVIEW) + 107(0154, vod_archive).
-- 날짜 다시보기 창에서 일반 < 구독 < 구독+ 단계로 보여 준다. vod_archive와 분리한 이유: 방송 통계·
-- 세션 매칭·삭제 스윕·검색·타임라인이 vod_archive를 '방송 다시보기'로 가정한다(섞으면 통계 오염).
-- 공개 메타만(숲 목록 API가 무인증으로 주는 값). 재생 권한은 숲 플레이어 몫. 멱등.
-- 배포 순서: 이 마이그레이션 먼저(공개 로더는 조회 실패를 캐시하지 않고 503으로 다룬다). Rollback: 앱의 조회부터 되돌린 뒤 표 삭제.
begin;
create table if not exists public.vod_upload (
  title_no bigint primary key,
  upload_day date not null,            -- KST 귀속일(제목의 'M월 D일' 우선, 없으면 등록 시각 − 6시 경계)
  title text not null default '',
  duration_ms bigint not null default 0,
  thumb text not null default '',
  reg_date timestamptz,
  auth_no integer not null,
  synced_at timestamptz not null default now()
);
create index if not exists vod_upload_day_idx on public.vod_upload (upload_day desc);
alter table public.vod_upload enable row level security;
revoke all on public.vod_upload from public, anon, authenticated;
grant select on public.vod_upload to anon, authenticated;
grant select, insert, update, delete on public.vod_upload to service_role;
drop policy if exists vod_upload_public_read on public.vod_upload;
create policy vod_upload_public_read on public.vod_upload for select to anon, authenticated
  using (auth_no = 107);
commit;
