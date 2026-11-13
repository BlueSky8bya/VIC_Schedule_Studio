-- 0168: 사이트 제보 — 캡처 최대 10장, 답장 표시(2026-11-13 소유자).
-- ① 캡처 한도 4 → 10장(lib/reports/topics.ts REPORT_MAX_IMAGES와 같은 값).
-- ② replied_at: 제보함에서 답장 메일을 보냈다고 표시한 시각(Gmail 쓰기 창으로 보낸 뒤 개발자가 누른다).
-- 멱등. 되돌리기: alter table public.site_report drop column replied_at; 한도는 4로 다시 바꿀 수 있다(10장 행이 있으면 실패).

alter table public.site_report drop constraint if exists site_report_images_check;
alter table public.site_report add constraint site_report_images_check check (cardinality(images) <= 10);
alter table public.site_report add column if not exists replied_at timestamptz;

notify pgrst, 'reload schema';
