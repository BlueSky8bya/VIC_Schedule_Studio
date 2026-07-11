-- 0048: 커스텀 이모지(sticker_assets)에 분류(kind)와 정렬 순서(sort_order)를 준다.
--   kind    : avatar(토리님 아바타) / static(작은 이모티콘·정적) / anim(작은 이모티콘·동적)
--   sort_order: 꾸미기 팔레트에서 사용자가 드래그로 정한 순서(오름차순).
-- 기존 행은 지금 보이던 순서(created_at DESC = 최신순)를 그대로 굳혀 백필한다.

alter table public.sticker_assets
  add column if not exists kind text not null default 'static',
  add column if not exists sort_order integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sticker_assets_kind_check'
  ) then
    alter table public.sticker_assets
      add constraint sticker_assets_kind_check check (kind in ('avatar', 'static', 'anim'));
  end if;
end $$;

-- GIF는 무조건 움직이는 이모티콘. (애니메이션 WebP는 MIME으로 구분 불가 → 사용자가 팔레트에서 옮긴다.)
update public.sticker_assets
set kind = 'anim'
where file_type = 'image/gif' and kind = 'static';

-- 백필: 아직 순서가 없는(0) 행만 최신순으로 1..N 부여. 재실행해도 이미 정한 순서는 건드리지 않는다
-- (신규 업로드는 항상 min-1(≤ -1)을 받으므로 0으로 되돌아오지 않는다).
with ranked as (
  select id, row_number() over (partition by calendar_id order by created_at desc) as rn
  from public.sticker_assets
  where sort_order = 0
)
update public.sticker_assets a
set sort_order = ranked.rn
from ranked
where ranked.id = a.id;

create index if not exists sticker_assets_calendar_order_idx
  on public.sticker_assets (calendar_id, sort_order);
