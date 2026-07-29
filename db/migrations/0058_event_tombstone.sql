-- 0058: 일정 삭제 tombstone (P0-DATA-1, ADR-0011 L5)
--
-- 삭제를 즉시 hard delete 하지 않고 deleted_at을 찍는다(soft delete). 태그/연결/하트/비공개
-- 메타가 FK 그대로 보존되므로 '실행 취소'가 **같은 id로** 완전 복구한다(예전 재생성 방식은
-- 새 id라 하트·연결이 유실됐다). 24시간 뒤 실제 삭제(purge)는 삭제 액션이 지나가며 수행
-- (별도 크론 불요 — 낮은 트래픽에 충분).
-- 모든 일정 조회 경로는 deleted_at is null 필터를 건다(앱 코드에서 일괄 적용).
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0058_event_tombstone.sql

alter table public.events add column if not exists deleted_at timestamptz;

-- 살아있는 일정 조회가 지배적 → 부분 인덱스로 필터 비용 제거.
create index if not exists idx_events_alive
  on public.events (calendar_id, date_key)
  where deleted_at is null;
