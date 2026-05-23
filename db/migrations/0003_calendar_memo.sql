-- 시청자 화면에 표시되는 공개 메모(소유자가 편집). 캘린더에 컬럼으로 둔다.
alter table public.calendars
  add column if not exists public_memo text not null default '';
