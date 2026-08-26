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
  public.trusted_members,
  public.private_layer_settings
to authenticated;

-- unlock 세션: 본인 세션 생성/조회 (RLS 정책은 Stage 4에서 추가)
grant select, insert, delete on public.unlock_sessions to authenticated;

-- service_role(서버 관리자 클라이언트)은 전체 접근. RLS는 우회하지만 테이블 권한은 필요.
grant all on all tables in schema public to service_role;
grant usage on schema public to service_role;
