-- 캘린더 소유자 이전(핸드오프). 기존 DB를 재사용하면서 소유자만 바꿀 때 쓴다.
-- calendars.owner_id를 OWNER_EMAIL 계정으로 옮긴다(RLS의 is_calendar_owner 기준).
--
-- 사전 조건: 새 소유자가 앱에 구글 로그인을 1회 완료해 auth.users에 행이 있어야 한다.
--
-- 사용법(Supabase SQL 에디터 또는 psql에서 두 줄을 함께 실행):
--   set app.owner_email = 'owner@example.com';   -- 새 소유자 구글 이메일
--   \i db/seeds/0003_transfer_owner.sql
--
-- 멱등: 여러 번 실행해도 안전하다.

do $$
declare
  v_owner_email text := nullif(current_setting('app.owner_email', true), '');
  v_owner uuid;
begin
  if v_owner_email is null then
    raise exception '소유자 이메일이 설정되지 않았습니다. 먼저 "set app.owner_email = ''소유자구글이메일'';"을 실행하세요.';
  end if;

  select id into v_owner
  from auth.users
  where lower(email) = lower(v_owner_email)
  limit 1;

  if v_owner is null then
    raise exception '소유자 계정(%)이 auth.users에 없습니다. 먼저 그 계정으로 앱에 1회 로그인한 뒤 다시 실행하세요.', v_owner_email;
  end if;

  update public.calendars
  set owner_id = v_owner
  where slug = 'vic';

  raise notice '캘린더(vic) 소유자를 %로 이전했습니다.', v_owner_email;
end $$;
