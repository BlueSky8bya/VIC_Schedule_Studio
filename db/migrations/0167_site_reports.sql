-- 0167: 사이트 제보(2026-11-13 소유자 결정) — 버그·일정 오류·아이디어·기타 + 캡처 이미지 최대 4장, 답장용 이메일은 선택.
--
-- 받는 곳 = 개발자 화면의 제보함(/studio/reports). 보관 = 처리 완료 후 90일(개인정보처리방침과 같은 기준) —
-- 시간별 Workers Cron(/api/cron/insights-archive)이 lib/reports/report.ts purgeExpiredReports로 표 행과 저장소 파일을 함께 지운다
-- (저장소 파일은 SQL로 지우지 않는다 — Storage API로만).
-- 쓰기·읽기는 서버(service_role)만. RLS deny-all + service_role DML grant(0035·0043 함정).
-- 멱등. 되돌리기: drop table public.site_report; delete from storage.buckets where id = 'site-reports'(파일을 먼저 비운 뒤).

create table if not exists public.site_report (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  topic       text not null check (topic in ('bug', 'schedule', 'idea', 'etc')),
  body        text not null check (char_length(body) between 1 and 4000),
  reply_email text check (reply_email is null or char_length(reply_email) <= 254),
  page        text check (page is null or char_length(page) <= 200),   -- 제보를 보낸 화면 주소(경로만)
  device      text check (device is null or device in ('desktop', 'mobile')),
  images      text[] not null default '{}' check (cardinality(images) <= 4), -- 저장소(site-reports) 안 경로
  done_at     timestamptz                                                   -- 처리 완료 시각(보관 기한의 기준)
);

create index if not exists site_report_created_idx on public.site_report (created_at desc);
create index if not exists site_report_done_idx on public.site_report (done_at) where done_at is not null;

alter table public.site_report enable row level security;
revoke all on public.site_report from public, anon, authenticated;
grant select, insert, update, delete on public.site_report to service_role;

-- 캡처 이미지 저장소 — 비공개, 장당 2MB, 이미지 형식만(브라우저가 줄여서 webp로 올린다).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-reports', 'site-reports', false, 2097152, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
