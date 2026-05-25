-- #5: 공개 메모의 정렬(가로) / 위치(세로)를 저장한다.
alter table public.calendars
  add column if not exists public_memo_align text not null default 'left',
  add column if not exists public_memo_valign text not null default 'top';
