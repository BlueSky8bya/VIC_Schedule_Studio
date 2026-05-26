-- 캘린더 + 기본 팔레트 10색 + 기본 태그 10개 + 샘플 공개 일정 시드.
--
-- 사전 조건: 소유자(OWNER_EMAIL 계정)가 앱에서 구글 로그인을 1회 완료해 auth.users에
-- 행이 있어야 한다. calendars.owner_id가 그 사용자를 참조하기 때문.
-- (로그인 전 실행하면 아래에서 명시적 오류를 던진다.)
--
-- 소유자 이메일은 GUC로 주입한다(공개 저장소에 개인 이메일을 박지 않기 위함):
--   set app.owner_email = 'owner@example.com';   -- 실제 소유자 구글 이메일
--   \i db/seeds/0002_calendar_and_defaults.sql    (또는 Supabase SQL 에디터에 함께 실행)
-- 소유자를 바꿀 때(예: 운영 핸드오프)도 새 이메일로 set 후 다시 실행하면 owner_id가
-- 그 계정으로 이전된다(on conflict do update). 멱등이라 여러 번 실행해도 안전하다.

do $$
declare
  v_owner_email text := nullif(current_setting('app.owner_email', true), '');
  v_owner uuid;
  v_cal uuid;
begin
  if v_owner_email is null then
    raise exception '소유자 이메일이 설정되지 않았습니다. 먼저 "set app.owner_email = ''소유자구글이메일'';"을 실행한 뒤 다시 시도하세요.';
  end if;

  select id into v_owner
  from auth.users
  where lower(email) = lower(v_owner_email)
  limit 1;

  if v_owner is null then
    raise exception '소유자 계정(%)이 auth.users에 없습니다. 먼저 그 계정으로 앱에 1회 로그인한 뒤 다시 실행하세요.', v_owner_email;
  end if;

  -- 1) 캘린더 (slug = vic)
  insert into public.calendars (owner_id, slug, display_name, title, timezone, is_public)
  values (v_owner, 'vic', '빅토리 일정표', '빅토리 일정표', 'Asia/Seoul', true)
  on conflict (slug) do update set owner_id = excluded.owner_id
  returning id into v_cal;

  if v_cal is null then
    select id into v_cal from public.calendars where slug = 'vic';
  end if;

  -- 2) 팔레트 10색 (휴뱅용 회색 포함)
  insert into public.color_palette (calendar_id, key, name, bg_color, text_color, border_color, sort_order)
  values
    (v_cal, 'gray',     '회색', '#c2c7d0', '#1f2937', '#8b91a0', 1),
    (v_cal, 'lavender', '보라', '#c9a7f0', '#3b1a66', '#a577e0', 2),
    (v_cal, 'blue',     '파랑', '#8fbaf5', '#0f2f63', '#5b94e8', 3),
    (v_cal, 'pink',     '분홍', '#f7a8cf', '#6e1244', '#ec7db0', 4),
    (v_cal, 'mint',     '청록', '#74d6c4', '#0c4439', '#3fbfa8', 5),
    (v_cal, 'yellow',   '노랑', '#ffe066', '#6b5200', '#f0c419', 6),
    (v_cal, 'orange',   '주황', '#ffb066', '#6e3500', '#f59331', 7),
    (v_cal, 'beige',    '갈색', '#d2a679', '#4d2e12', '#b9854f', 8),
    (v_cal, 'sky',      '하늘', '#6fd0f5', '#0a3f57', '#34b3e0', 9),
    (v_cal, 'lime',     '연두', '#a8e063', '#2f5212', '#7fc23a', 10)
  on conflict (calendar_id, key) do nothing;

  -- 3) 기본 태그 10개 (이름은 owner가 나중에 수정 가능)
  insert into public.broadcast_tags (calendar_id, tag_key, display_name, color_key, sort_order, is_default, is_active)
  values
    (v_cal, 'dayoff',       '휴뱅',     'gray',     1,  true, true),
    (v_cal, 'worldcup',     '구플뱅',   'orange',   2,  true, true),
    (v_cal, 'collab',       '합방',     'lavender', 3,  true, true),
    (v_cal, 'big_server',   '대형서버', 'blue',     4,  true, true),
    (v_cal, 'full_track',   '풀트뱅',   'pink',     5,  true, true),
    (v_cal, 'calm',         '잔잔뱅',   'mint',     6,  true, true),
    (v_cal, 'variety_game', '종겜',     'yellow',   7,  true, true),
    (v_cal, 'song',         '노래뱅',   'sky',      8,  true, true),
    (v_cal, 'hype',         '기대컨',   'lime',     9,  true, true),
    (v_cal, 'easy',         '기타',     'beige',    10, true, true)
  on conflict (calendar_id, tag_key) do nothing;

  -- 4) 샘플 공개 일정 (캘린더가 비어있을 때 한 번만). 태그도 연결한다.
  if not exists (select 1 from public.events where calendar_id = v_cal) then
    -- 6/1 픽크타 1일차 (대형서버)
    with e as (
      insert into public.events
        (calendar_id, date_key, start_time, end_time, public_title, public_description, visibility_scope, status, sort_order)
      values (v_cal, '2026-06-01', '20:00', '23:00', '픽크타 1일차', '6월 첫 방송', 'public', 'scheduled', 1)
      returning id
    )
    insert into public.event_tags (event_id, tag_id, is_primary, sort_order)
    select e.id, t.id, true, 1 from e
    join public.broadcast_tags t on t.calendar_id = v_cal and t.tag_key = 'big_server';

    -- 6/7 휴뱅 (종일)
    with e as (
      insert into public.events
        (calendar_id, date_key, is_all_day, public_title, visibility_scope, status, sort_order)
      values (v_cal, '2026-06-07', true, '휴뱅', 'public', 'scheduled', 1)
      returning id
    )
    insert into public.event_tags (event_id, tag_id, is_primary, sort_order)
    select e.id, t.id, true, 1 from e
    join public.broadcast_tags t on t.calendar_id = v_cal and t.tag_key = 'dayoff';

    -- 6/15 풀트뱅
    with e as (
      insert into public.events
        (calendar_id, date_key, start_time, end_time, public_title, visibility_scope, status, sort_order)
      values (v_cal, '2026-06-15', '20:00', '23:00', '풀트뱅', 'public', 'scheduled', 1)
      returning id
    )
    insert into public.event_tags (event_id, tag_id, is_primary, sort_order)
    select e.id, t.id, true, 1 from e
    join public.broadcast_tags t on t.calendar_id = v_cal and t.tag_key = 'full_track';
  end if;
end $$;
