-- 커스텀 태그 색: '대분류'가 자기 색(bg_hex)을 직접 가진다. NULL이면 기존 color_key→color_palette로
-- 폴백(무중단). 세부(자식)는 색을 못 가진다 — 부모 대분류 색을 상속하므로 bg_hex는 NULL 강제.
-- (무늬는 이미 전면 제거됨 → pattern_key 같은 컬럼은 없다.)
-- 기존 행은 전부 bg_hex NULL로 추가되어 렌더가 바뀌지 않는다(안전). 컬럼 추가라 service_role grant는
-- 기존 broadcast_tags DML 권한을 그대로 쓴다(새 grants 파일 불필요). idempotent.
alter table public.broadcast_tags
  add column if not exists bg_hex text;

do $$
begin
  -- 6자리 hex(#RRGGBB)만 허용. 서버 recolor에서도 검증하지만 DB 방어선.
  if not exists (select 1 from pg_constraint where conname = 'broadcast_tags_bg_hex_chk') then
    alter table public.broadcast_tags
      add constraint broadcast_tags_bg_hex_chk
      check (bg_hex is null or bg_hex ~ '^#[0-9a-fA-F]{6}$');
  end if;
  -- 자식(세부, parent_id 있음)은 색을 못 가진다(상속). reparent(대분류→세부) 시 서버가 bg_hex를
  -- 같은 트랜잭션에서 NULL로 비운다.
  if not exists (select 1 from pg_constraint where conname = 'broadcast_tags_child_no_color_chk') then
    alter table public.broadcast_tags
      add constraint broadcast_tags_child_no_color_chk
      check (parent_id is null or bg_hex is null);
  end if;
end $$;
