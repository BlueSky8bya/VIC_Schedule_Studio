-- 0169: 사이트 제보 '확인함' 표시(2026-11-13 소유자: "확인 안 한 제보가 쌓이면 제보함에 숫자").
-- seen_at = 개발자가 제보함을 열어 처음 본 시각. 헤더의 제보함 단추 숫자 = seen_at이 빈 제보 수.
-- 여러 PC에서 같은 숫자가 보이도록 기기(브라우저)가 아닌 DB에 둔다.
-- 멱등. 되돌리기: alter table public.site_report drop column seen_at;

alter table public.site_report add column if not exists seen_at timestamptz;
create index if not exists site_report_unseen_idx on public.site_report (created_at) where seen_at is null;

notify pgrst, 'reload schema';
