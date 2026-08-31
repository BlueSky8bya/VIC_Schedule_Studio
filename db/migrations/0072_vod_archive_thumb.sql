-- 0072: vod_archive에 대표 썸네일 URL 저장 — 날짜 다시보기 '창'의 미리보기 화면(0068 확장).
-- SOOP가 주는 공개 스냅샷 URL(SnapshotLoad rowKey) 그대로다(시간 지정 불가 — 단일 대표컷, 실측).

alter table public.vod_archive
  add column if not exists thumb text not null default '';

comment on column public.vod_archive.thumb is
  'SOOP 대표 썸네일 URL(//videoimg... 형태). 공개 미리보기용.';
