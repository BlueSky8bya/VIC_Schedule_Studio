-- 태그 kind 축: content(콘텐츠, 색·통계 차지) vs modifier(수식어, 색 X·통계 제외).
--   content  = 게임/노래/VRChat/서버/CK/시네티/월드컵/소통뱅/별별랭킹/외부출연/기타/휴뱅 …
--   modifier = 시참/합방/대회/짧뱅/풀트/구플 (콘텐츠 위에 얹힘, 셀 색은 점으로만, 컨텐츠 순위서 제외)
-- 기존 태그는 전부 content 기본 → 렌더 무변경(안전). 실제 modifier 지정은 후속 재배치 시드(PR2)에서.
-- idempotent.
alter table public.broadcast_tags
  add column if not exists kind text not null default 'content';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'broadcast_tags_kind_chk'
  ) then
    alter table public.broadcast_tags
      add constraint broadcast_tags_kind_chk check (kind in ('content', 'modifier'));
  end if;
end $$;
