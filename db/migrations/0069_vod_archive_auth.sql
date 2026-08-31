-- 0069: vod_archive에 SOOP 시청 권한(auth_no) 저장 — 구독(플러스) 전용 다시보기 구분.
-- 실측: auth_no=101 전체 공개(365개), 107 구독자 전용(11개 — '플러스뱅송' 제목 + 제목 표기
-- 없는 구독뱅 2개까지 정확히 표식). 일반 시청자는 107을 클릭해도 재생 불가이므로
-- 공개 포스터의 '다시보기' 칩에서는 101만 내보낸다(2026-08-31 사용자 결정 — 플러스뱅송 제외).
-- 아카이브 자체는 전부 보관한다(체인·통계·Phase 2 타임라인은 전체가 필요).

alter table public.vod_archive
  add column if not exists auth_no integer not null default 101;

comment on column public.vod_archive.auth_no is
  'SOOP 시청 권한(101=전체 공개, 107=구독자 전용). 공개 칩은 101만.';
