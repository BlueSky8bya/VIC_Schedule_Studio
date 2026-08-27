-- 0067: legacy unlock_sessions 정리 (2026-08-27, 0057이 미뤄둔 후속)
--
-- 0057(P0-PRIV-2)부터 잠금해제의 정본은 private_unlock_grants(브라우저 auth 세션 결속)다. 코드는
-- unlock_sessions를 읽지 않고 '혹시 남은 행 지우기'만 호출했는데(이번 배포에서 제거), RLS 함수
-- has_private_unlock()만 아직 옛 테이블을 읽어 사실상 항상 false였다(새 행이 안 생기므로).
-- 테이블을 drop하면 그 함수가 깨져 events/event_private_meta/event_tags 정책 4개의 평가가 실패하므로,
-- 먼저 함수를 grants 모델로 이식한다: 같은 사용자 + 같은 브라우저 auth 세션(JWT session_id) + 현재
-- 비밀번호 버전 + 미만료 grant가 있을 때만 true — 서버 판정(lib/private-layer/unlock.ts)과 같은 규칙.
-- 멱등. 적용 순서: 코드 배포(unlock_sessions delete 호출 제거) 확인 → 이 파일.
-- 롤백: 0001_rls 함수 본문(옛 unlock_sessions 조회) + 0009/0057 테이블 재생성 — 데이터 가치 없음(만료 세션 1행).

begin;

create or replace function public.has_private_unlock(target_calendar_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.private_unlock_grants g
    join public.private_layer_settings p on p.calendar_id = g.calendar_id
    where g.calendar_id = target_calendar_id
      and g.user_id = auth.uid()
      and g.auth_session_id = coalesce(auth.jwt() ->> 'session_id', '')
      and g.passcode_version = p.passcode_version
      and g.expires_at > now()
  );
$$;

drop table if exists public.unlock_sessions cascade;

commit;
