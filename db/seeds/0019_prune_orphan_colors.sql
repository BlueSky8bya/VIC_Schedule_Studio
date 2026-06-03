-- 어떤 태그도 안 쓰는 생성색(gen-*) 팔레트 정리. SQL로 태그를 지울 때 색이 안 치워져 남은
-- orphan(예: 삭제된 외부출연의 gen-cross-extcast)을 제거 → 편집기 스와치 개수 = 태그 색 개수.
-- 기본 13색(gray..teal)은 표준 팔레트라 안 건드린다. idempotent.
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;
  delete from public.color_palette
    where calendar_id = v_cal
      and key like 'gen-%'
      and key not in (select color_key from public.broadcast_tags where calendar_id = v_cal);
end $$;
