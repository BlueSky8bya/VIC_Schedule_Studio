-- 단계 배포 플래그: v3_only = 이번 분류 v3에서 새로 생긴 태그(레거시 뷰에서는 숨김).
--   true  → 외부출연·별별랭킹·구플뱅·게임 세부 시드(와우 등). 개발자(v3) 뷰에서만 보임.
--   false → 그 외 전부(레거시·v3 공통). 기본값 false.
-- 레거시 뷰(비-개발자) = v3_only 숨김 + v3 부모 밑 자식 재최상위화 + kind 무시. 데이터는 그대로.
-- idempotent.
alter table public.broadcast_tags
  add column if not exists v3_only boolean not null default false;

do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug = 'vic';
  if v_cal is null then return; end if;
  update public.broadcast_tags set v3_only = true
    where calendar_id = v_cal
      and tag_key in (
        'extcast', 'byeolranking', 'guplus',
        'game-wow', 'game-ow', 'game-mtg', 'game-hollow', 'game-pubg', 'game-tekken'
      );
end $$;
