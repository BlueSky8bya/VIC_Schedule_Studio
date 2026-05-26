-- 공동 소유자 동기화. OWNER_EMAIL(콤마 목록)에 따라 calendar_co_owners를 맞춘다.
-- 주 소유자(calendars.owner_id, 목록의 첫 계정)는 0003이 잡고, 나머지 계정은 여기서
-- 공동 소유자로 등록된다. 목록에서 빠진 계정은 공동 소유자에서 제거한다(완전 동기화).
--
-- 사전 조건: 각 계정이 앱에 구글 로그인을 1회 완료해 auth.users에 행이 있어야 한다.
--
-- 사용법: scripts/apply-db.mjs가 .env.local의 OWNER_EMAIL을 app.owner_emails GUC로
--         주입한다. 즉 `node scripts/apply-db.mjs db/seeds/0013_sync_co_owners.sql`.
--
-- 멱등: 여러 번 실행해도 안전하다.

do $$
declare
  v_emails text := nullif(current_setting('app.owner_emails', true), '');
  v_slug text := 'vic';
  v_calendar uuid;
  v_email text;
  v_uid uuid;
  v_list text[];
begin
  if v_emails is null then
    raise exception '소유자 목록이 설정되지 않았습니다. apply-db.mjs로 실행하거나 "set app.owner_emails = ''a@x,b@y'';"을 먼저 실행하세요.';
  end if;

  select id into v_calendar from public.calendars where slug = v_slug;
  if v_calendar is null then
    raise exception '캘린더(%)를 찾을 수 없습니다.', v_slug;
  end if;

  -- 콤마 분리 + 소문자/공백 정규화
  select array_agg(lower(btrim(e))) into v_list
  from unnest(string_to_array(v_emails, ',')) as e
  where btrim(e) <> '';

  -- 목록에 있는 계정을 공동 소유자로 등록(auth.users에 있어야 함). 주 소유자도 함께
  -- 넣어 두며(무해·멱등), owner_id와 중복돼도 is_calendar_owner는 OR로 통과한다.
  foreach v_email in array v_list loop
    select id into v_uid from auth.users where lower(email) = v_email limit 1;
    if v_uid is null then
      raise notice '건너뜀: %는 auth.users에 없음 (먼저 그 계정으로 1회 로그인 필요)', v_email;
      continue;
    end if;
    insert into public.calendar_co_owners (calendar_id, owner_id)
    values (v_calendar, v_uid)
    on conflict (calendar_id, owner_id) do nothing;
  end loop;

  -- 목록에 없는 공동 소유자는 제거(동기화)
  delete from public.calendar_co_owners co
  where co.calendar_id = v_calendar
    and not exists (
      select 1 from auth.users u
      where u.id = co.owner_id
        and lower(u.email) = any (v_list)
    );

  raise notice '공동 소유자 동기화 완료(%): %', v_slug, v_emails;
end $$;
