-- 세부(자식) 태그 전면 폐기 → flat 대분류 + 방식(modifier)만. 게임 이름 등 인스턴스는 제목으로.
--  - 외부출연 묶음 해제: 토크쇼·타스뱅송을 최상위로 올리고 부모(외부출연) 삭제
--  - 게임 세부 전부 삭제(실크송·명조·와우·오버워치·마스터듀얼·할로우나이트·배그·철권). event_tags는 cascade.
--  - 풀트뱅: 방식(modifier) → 콘텐츠(content)
-- idempotent.
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  -- 1) 외부출연 자식을 먼저 최상위로(부모 삭제 cascade에 휩쓸리지 않게)
  update public.broadcast_tags set parent_id = null
    where calendar_id = v_cal and tag_key in ('worldcup', 'tag-laiooy');  -- 토크쇼, 타스뱅송

  -- 2) 외부출연 부모 삭제
  delete from public.broadcast_tags where calendar_id = v_cal and tag_key = 'extcast';

  -- 3) 게임 세부 전부 삭제 — 게임 이름은 제목으로 관리(태그 노가다 제거)
  delete from public.broadcast_tags
    where calendar_id = v_cal
      and tag_key in (
        'tag-m7ye1z', 'tag-7f0di3',  -- 실크송, 명조
        'game-wow', 'game-ow', 'game-mtg', 'game-hollow', 'game-pubg', 'game-tekken'
      );

  -- 4) 풀트뱅: 방식 → 콘텐츠
  update public.broadcast_tags set kind = 'content'
    where calendar_id = v_cal and tag_key = 'full_track';
end $$;
