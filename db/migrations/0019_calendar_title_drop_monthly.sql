-- "빅토리 월간 일정표" 등 제목에서 "월간"을 제거한다. (헤더는 calendars.title을 표시)
-- 시드의 on conflict는 owner_id만 갱신하므로 기존 캘린더 제목은 직접 갱신해야 한다.
update public.calendars
set title = replace(title, '월간 ', ''),
    display_name = replace(display_name, '월간 ', '')
where title like '%월간 %' or display_name like '%월간 %';
