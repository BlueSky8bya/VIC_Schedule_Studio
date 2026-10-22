-- 0154: 구독플러스(구독자 전용) 다시보기 메타를 공개 읽기에 포함 (2026-10-23 소유자 요청).
-- 날짜 다시보기 창이 구플 방송을 별도 탭(프리미엄 색)으로 보여 준다. auth_no=107은 SOOP 방송국
-- 목록 API가 무인증으로 내보내는 값(제목·길이·썸네일)이라 공개 메타다 — 재생 권한은 SOOP 플레이어가 판단.
-- 0069의 '101만 칩' 결정과 0125의 101 제한을 이 표 SELECT에 한해 넓힌다. 그 외(102 등 미상·비공개)는 계속 차단.
-- vod_chat_profile·vod_timeline/챕터 RLS(101 전용)는 그대로. 데이터·grant 변경 없음. 멱등.
-- Rollback: 0125의 정책(using (auth_no=101))으로 되돌리면 앱은 101만 받아 구플 탭이 사라질 뿐 깨지지 않는다.
begin;
drop policy if exists vod_archive_public_read on public.vod_archive;
create policy vod_archive_public_read on public.vod_archive for select to anon, authenticated
  using (auth_no in (101, 107));
commit;
