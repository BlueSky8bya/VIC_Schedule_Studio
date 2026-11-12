-- ⚠ 역사 기록(2026-11-13): db/migrations/0159_retire_private_layer.sql이 이 파일이 만드는 비공개 레이어 객체
-- (event_private_meta·support_campaigns·has_private_unlock·is_active_worker·비공개 범위 정책)를 철수했다.
-- 다시 적용하지 말 것 — 지운 객체가 되살아나거나(테이블 없음으로) 실패한다. 현재 정의는 마이그레이션이 정본.
-- "Automatically expose new tables"를 끈 프로젝트라, 새 테이블에 API 역할 권한을
-- 수동으로 부여한다. 행 단위 접근 제어는 여전히 RLS가 담당한다.
-- platform_admins는 의도적으로 제외(잠금 유지) — security-definer 함수/service_role로만 접근.

grant usage on schema public to anon, authenticated;

-- 공개 읽기 (anon + authenticated). 비공개 행은 RLS가 걸러낸다.
grant select on
  public.calendars,
  public.broadcast_tags,
  public.color_palette,
  public.events,
  public.event_tags,
  public.support_campaigns
to anon, authenticated;

-- 비공개 읽기 (authenticated만; RLS가 unlock 세션/소유자 검사)
grant select on public.event_private_meta to authenticated;

-- owner/developer 쓰기 (authenticated; RLS가 행 단위로 owner/developer만 허용)
grant insert, update, delete on
  public.calendars,
  public.events,
  public.event_private_meta,
  public.event_tags,
  public.broadcast_tags,
  public.color_palette,
  public.support_campaigns,
  -- (public.trusted_members — 0074에서 drop, 2026-09-04 ADR-0018)
  public.private_layer_settings
to authenticated;

-- unlock 세션: 본인 세션 생성/조회 (RLS 정책은 Stage 4에서 추가)

-- service_role(서버 관리자 클라이언트)은 전체 접근. RLS는 우회하지만 테이블 권한은 필요.
grant all on all tables in schema public to service_role;
grant usage on schema public to service_role;
