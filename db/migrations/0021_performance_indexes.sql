-- [서버 최적화 Phase 3] public/studio 주요 read와 RLS check가 자주 거는 컬럼에 인덱스 보강.
-- 모두 비파괴적이고 idempotent(create index if not exists)이라 언제 적용해도 안전하다.
-- 행이 적을 땐 Postgres가 seq-scan을 택할 수 있어 즉시 효과는 작지만, 동접/데이터가 늘수록
-- (수십 명 동시 시청, 일정·스티커 누적, 캘린더 증가) read 안정화에 직접 도움이 된다.

-- 캘린더 slug 조회(모든 로더의 첫 단계) + 공개 여부.
create index if not exists calendars_slug_public_idx
  on public.calendars (slug, is_public);

-- 스튜디오 달력: 캘린더+날짜+정렬 순.
create index if not exists events_calendar_date_sort_idx
  on public.events (calendar_id, date_key, sort_order);

-- 공개 달력: 공개·비초안 일정만 partial index로 좁게.
create index if not exists events_public_calendar_date_idx
  on public.events (calendar_id, date_key, sort_order)
  where visibility_scope = 'public' and status <> 'draft';

-- 태그/팔레트: 캘린더별 정렬.
create index if not exists broadcast_tags_calendar_sort_active_idx
  on public.broadcast_tags (calendar_id, sort_order)
  where is_active = true;

create index if not exists color_palette_calendar_sort_idx
  on public.color_palette (calendar_id, sort_order);

-- 지원 캠페인: 공개·활성만.
create index if not exists support_campaigns_calendar_public_idx
  on public.support_campaigns (calendar_id, starts_on, ends_on)
  where is_public = true and is_active = true;

-- 스티커 인스턴스: 캘린더+해당 월+표시순.
create index if not exists sticker_instances_calendar_month_visible_idx
  on public.sticker_instances (calendar_id, year, month, z_index)
  where is_visible = true;

-- 스티커 에셋: 캘린더별 최신순.
create index if not exists sticker_assets_calendar_created_idx
  on public.sticker_assets (calendar_id, created_at desc);

-- 비공개 레이어 unlock 체크(RLS has_private_unlock가 매 요청 평가).
create index if not exists unlock_sessions_user_calendar_version_expires_idx
  on public.unlock_sessions (user_id, calendar_id, passcode_version, expires_at);

-- event_tags 정렬 조회.
create index if not exists event_tags_tag_sort_idx
  on public.event_tags (tag_id, sort_order);

-- 본인 관심 일정 목록(loadMyHeartIds: user_id 필터 + events 조인). PK가 (event_id, user_id)라
-- user_id 선두 조회를 못 타므로 별도 인덱스.
create index if not exists event_hearts_user_idx
  on public.event_hearts (user_id);
