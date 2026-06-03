-- 태그 분류 재배치 v3.1 (docs/tag-taxonomy-classification.md).
--  - 종겜 → 게임 리네임, 노래뱅 → 노래 리네임
--  - kind=modifier: 합방·시참·풀트뱅·짧뱅·대회 (+ 구플뱅 신설)
--  - 외부출연(신설 대분류) ─ 토크쇼·타스뱅송을 자식으로 reparent
--  - 별별랭킹(신설 대분류), 구플뱅(부활, modifier)
--  - 게임 세부 시드: 와우·오버워치·마스터듀얼·할로우나이트·배그·철권
--  - 조공 → 기타로 흡수(event_tags 이전 후 비활성)
-- event_tags 연결 보존. idempotent(재실행 안전).
do $$
declare
  v_cal uuid;
  v_game uuid;
  v_extcast uuid;
  v_etc uuid;
  v_jojong uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;

  -- 1) 리네임
  update public.broadcast_tags set display_name = '게임'
    where calendar_id = v_cal and tag_key = 'variety_game';
  update public.broadcast_tags set display_name = '노래'
    where calendar_id = v_cal and tag_key = 'tag-m7yevq';
  select id into v_game from public.broadcast_tags where calendar_id = v_cal and tag_key = 'variety_game';

  -- 2) 수식어 지정 (셀 색 X·통계 제외는 후속 렌더 PR에서 kind로 분기)
  update public.broadcast_tags set kind = 'modifier'
    where calendar_id = v_cal and tag_key in ('collab', 'song', 'full_track', 'tag-fkvi4c', 'tournament');

  -- 3) 신설 대분류 색 (고유 키 → 렌더 그대로, 기존 색과 안 겹침)
  insert into public.color_palette (calendar_id, key, name, bg_color, text_color, border_color, sort_order)
  values
    (v_cal, 'gen-cross-extcast', '외부출연', '#c5f1d4', '#206f3a', '#83d89f', 50),
    (v_cal, 'gen-grid-bbr',      '별별랭킹', '#f1c5e6', '#6f205b', '#d883c3', 51),
    (v_cal, 'gen-dots-guplus',   '구플뱅',   '#cdc5f1', '#2d206f', '#9183d8', 52)
  on conflict (calendar_id, key) do nothing;

  -- 4) 외부출연(대분류) + 토크쇼·타스뱅송 reparent
  insert into public.broadcast_tags (calendar_id, tag_key, display_name, color_key, sort_order, is_default, is_active, kind)
  values (v_cal, 'extcast', '외부출연', 'gen-cross-extcast', 18, false, true, 'content')
  on conflict (calendar_id, tag_key) do update
    set display_name = excluded.display_name, color_key = excluded.color_key,
        is_active = true, kind = 'content', parent_id = null;
  select id into v_extcast from public.broadcast_tags where calendar_id = v_cal and tag_key = 'extcast';

  update public.broadcast_tags set parent_id = v_extcast
    where calendar_id = v_cal and tag_key in ('worldcup', 'tag-laiooy');  -- 토크쇼, 타스뱅송

  -- 5) 별별랭킹(대분류, content)
  insert into public.broadcast_tags (calendar_id, tag_key, display_name, color_key, sort_order, is_default, is_active, kind)
  values (v_cal, 'byeolranking', '별별랭킹', 'gen-grid-bbr', 19, false, true, 'content')
  on conflict (calendar_id, tag_key) do update
    set display_name = excluded.display_name, color_key = excluded.color_key, is_active = true, kind = 'content';

  -- 6) 구플뱅 부활(modifier) — 플러스 구독자 대상
  insert into public.broadcast_tags (calendar_id, tag_key, display_name, color_key, sort_order, is_default, is_active, kind)
  values (v_cal, 'guplus', '구플뱅', 'gen-dots-guplus', 20, false, true, 'modifier')
  on conflict (calendar_id, tag_key) do update
    set display_name = excluded.display_name, color_key = excluded.color_key, is_active = true, kind = 'modifier';

  -- 7) 게임 세부 시드 (부모=게임, 색은 부모 상속이라 orange 저장값만, kind content)
  if v_game is not null then
    insert into public.broadcast_tags (calendar_id, tag_key, display_name, color_key, sort_order, is_default, is_active, kind, parent_id)
    values
      (v_cal, 'game-wow',    '와우',        'orange', 2, false, true, 'content', v_game),
      (v_cal, 'game-ow',     '오버워치',     'orange', 3, false, true, 'content', v_game),
      (v_cal, 'game-mtg',    '마스터듀얼',   'orange', 4, false, true, 'content', v_game),
      (v_cal, 'game-hollow', '할로우나이트', 'orange', 5, false, true, 'content', v_game),
      (v_cal, 'game-pubg',   '배그',        'orange', 6, false, true, 'content', v_game),
      (v_cal, 'game-tekken', '철권',        'orange', 7, false, true, 'content', v_game)
    on conflict (calendar_id, tag_key) do update set parent_id = excluded.parent_id, is_active = true;
  end if;

  -- 8) 조공 → 기타 흡수
  select id into v_jojong from public.broadcast_tags where calendar_id = v_cal and tag_key = 'easy';
  select id into v_etc    from public.broadcast_tags where calendar_id = v_cal and tag_key = 'tag-6w3u5u';
  if v_jojong is not null and v_etc is not null then
    -- 조공이 붙은 이벤트에 기타가 아직 없으면 기타로 옮긴다(이미 있으면 중복이라 건너뜀).
    update public.event_tags set tag_id = v_etc
      where tag_id = v_jojong
        and event_id not in (select event_id from public.event_tags where tag_id = v_etc);
    delete from public.event_tags where tag_id = v_jojong;  -- 남은 중복 연결 제거
    update public.broadcast_tags set is_active = false where id = v_jojong;
  end if;
end $$;
