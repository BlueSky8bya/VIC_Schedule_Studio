-- 0157: 0155의 vod_upload 표 삭제 — 0156에서 업로드 영상이 vod_archive(upload=true)로 합쳐졌다.
-- **0156 적용 + 그 표를 안 읽는 앱 배포 뒤에** 적용한다(옛 앱의 공개 로더가 이 표를 읽는다).
-- 데이터는 0156이 옮겼다(30건). Rollback: 0155를 다시 적용하고 scripts/backfill-vod-uploads.mjs 이전 판으로 채운다.
begin;
drop table if exists public.vod_upload;
commit;
