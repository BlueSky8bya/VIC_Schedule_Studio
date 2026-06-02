-- 2계층 태그: broadcast_tags에 parent_id 추가.
--   parent_id IS NULL  → 대분류(색 보유)
--   parent_id 설정      → 세부(렌더 색은 최상위 대분류 색을 상속, 자기 color_key는 무시)
-- 기존 태그는 전부 parent_id NULL = 대분류로 자동 해석 → 렌더 무변경(안전).
-- idempotent.
alter table public.broadcast_tags
  add column if not exists parent_id uuid references public.broadcast_tags(id) on delete cascade;

-- 대분류/세부 조회·정렬용 인덱스.
create index if not exists broadcast_tags_parent_idx
  on public.broadcast_tags (calendar_id, parent_id, sort_order);
