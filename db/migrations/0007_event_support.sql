-- 업 도움: 일정에 통합. is_support=true면 업 도움 기간(date_key~end_date_key)이고
-- support_url(숲 게시글 링크)을 가진다. 달력엔 레인 끈으로, 시청자엔 업 도움 카드로 표시.
alter table public.events
  add column if not exists is_support boolean not null default false;
alter table public.events
  add column if not exists support_url text;
