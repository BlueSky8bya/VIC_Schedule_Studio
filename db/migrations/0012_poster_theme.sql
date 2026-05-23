-- C9/C10: 포스터 테마 팩(계절/배경 꾸미기). 캘린더당 하나의 테마를 둔다.
-- 임의 CSS가 아니라 미리 정의된 테마 키만 저장한다(none/sakura/summer/autumn/winter/christmas/night).
alter table public.calendars
  add column if not exists poster_theme text not null default 'none';
