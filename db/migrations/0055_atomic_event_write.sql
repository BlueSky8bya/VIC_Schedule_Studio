-- 0055: 일정 쓰기 원자화(P0-DATA-2, ADR-0012 불변식)
--
-- 문제: 일정 저장이 events UPDATE/INSERT → event_tags DELETE→INSERT → event_private_meta
-- UPSERT/DELETE 의 개별 호출이라, 중간 실패 시 DB가 어중간한 상태(본문은 바뀌고 태그는 옛것)로
-- 남았다. 이동+정렬, 체인 연결도 다건 UPDATE라 같은 문제.
--
-- 해법: 한 함수 = 한 트랜잭션. **SECURITY INVOKER** — 함수는 호출자(authenticated)의 권한과
-- RLS 그대로 실행된다(권한 상승 없음). 앱 서버 액션이 역할·잠금해제 검증을 마친 뒤 호출하며,
-- 직접 JWT 호출도 기존 테이블 직접 쓰기와 동일한 RLS 제약을 받는다(그 경로 자체의 폐쇄는
-- P0-PRIV-2에서). 실행 중 어떤 문장이 실패해도 전체가 롤백된다.
--
-- 멱등: create or replace. 적용: node scripts/apply-db.mjs db/migrations/0055_atomic_event_write.sql

-- ── 일정 저장(본문 + 태그 + 공개 평문 메타)을 한 트랜잭션으로 ──
-- p_event_id null이면 INSERT, 아니면 UPDATE. 반환: 확정된 event id.
-- p_tags: [{"tag_id": uuid, "is_primary": bool, "sort_order": int}, ...] (전체 재설정)
-- p_meta: null → 평문 메타 삭제 / 객체 → upsert (비공개 일정은 앱이 null을 보낸다 — 본문이
--          secret_cipher에 들어가므로 평문 메타 행을 남기지 않는 기존 계약 유지)
create or replace function public.save_event_atomic(
  p_event_id uuid,
  p_row jsonb,
  p_tags jsonb,
  p_meta jsonb
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid := p_event_id;
begin
  if v_id is null then
    insert into public.events (
      calendar_id, date_key, end_date_key, start_time, end_time,
      is_all_day, is_tentative, is_support, support_url,
      public_title, public_description, secret_cipher,
      visibility_scope, status, category, teaser, teaser_reveal_at, updated_at
    ) values (
      (p_row->>'calendar_id')::uuid,
      (p_row->>'date_key')::date,
      (p_row->>'end_date_key')::date,
      (p_row->>'start_time')::time,
      (p_row->>'end_time')::time,
      coalesce((p_row->>'is_all_day')::boolean, false),
      coalesce((p_row->>'is_tentative')::boolean, false),
      coalesce((p_row->>'is_support')::boolean, false),
      p_row->>'support_url',
      p_row->>'public_title',
      p_row->>'public_description',
      p_row->>'secret_cipher',
      (p_row->>'visibility_scope')::public.visibility_scope,
      (p_row->>'status')::public.event_status,
      (p_row->>'category')::public.event_category,
      coalesce((p_row->>'teaser')::boolean, false),
      (p_row->>'teaser_reveal_at')::timestamptz,
      now()
    ) returning id into v_id;
  else
    update public.events set
      date_key = (p_row->>'date_key')::date,
      end_date_key = (p_row->>'end_date_key')::date,
      start_time = (p_row->>'start_time')::time,
      end_time = (p_row->>'end_time')::time,
      is_all_day = coalesce((p_row->>'is_all_day')::boolean, false),
      is_tentative = coalesce((p_row->>'is_tentative')::boolean, false),
      is_support = coalesce((p_row->>'is_support')::boolean, false),
      support_url = p_row->>'support_url',
      public_title = p_row->>'public_title',
      public_description = p_row->>'public_description',
      secret_cipher = p_row->>'secret_cipher',
      visibility_scope = (p_row->>'visibility_scope')::public.visibility_scope,
      status = (p_row->>'status')::public.event_status,
      category = (p_row->>'category')::public.event_category,
      teaser = coalesce((p_row->>'teaser')::boolean, false),
      teaser_reveal_at = (p_row->>'teaser_reveal_at')::timestamptz,
      updated_at = now()
    where id = v_id;
    if not found then
      raise exception 'event % not found or not writable', v_id;
    end if;
  end if;

  -- 태그 전체 재설정(빈 배열이면 0개 = 흰 카드).
  delete from public.event_tags where event_id = v_id;
  if p_tags is not null and jsonb_array_length(p_tags) > 0 then
    insert into public.event_tags (event_id, tag_id, is_primary, sort_order)
    select v_id,
           (t->>'tag_id')::uuid,
           coalesce((t->>'is_primary')::boolean, false),
           coalesce((t->>'sort_order')::int, 0)
    from jsonb_array_elements(p_tags) as t;
  end if;

  -- 공개 일정 평문 메타: null → 삭제, 객체 → upsert.
  if p_meta is null then
    delete from public.event_private_meta where event_id = v_id;
  else
    insert into public.event_private_meta (event_id, private_title, private_memo, editor_note, updated_at)
    values (
      v_id,
      nullif(p_meta->>'private_title', ''),
      nullif(p_meta->>'private_memo', ''),
      nullif(p_meta->>'editor_note', ''),
      now()
    )
    on conflict (event_id) do update set
      private_title = excluded.private_title,
      private_memo = excluded.private_memo,
      editor_note = excluded.editor_note,
      updated_at = now();
  end if;

  return v_id;
end;
$$;

-- ── 날짜 이동 + 같은 날 정렬을 한 트랜잭션으로 ──
-- p_moved_id가 있으면 그 일정의 date_key(+멀티데이면 end_date_key도 같은 폭으로)를 옮긴 뒤,
-- p_ordered_ids 순서대로 sort_order 0..n을 부여한다. 어느 UPDATE가 실패해도 전체 롤백.
create or replace function public.reorder_events_atomic(
  p_date_key date,
  p_ordered_ids uuid[],
  p_moved_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_old date;
  v_old_end date;
  v_delta int;
  v_id uuid;
  v_idx int := 0;
begin
  if p_moved_id is not null then
    select date_key, end_date_key into v_old, v_old_end
    from public.events where id = p_moved_id;
    if not found then
      raise exception 'moved event % not found', p_moved_id;
    end if;
    if v_old is distinct from p_date_key then
      v_delta := p_date_key - v_old;
      update public.events
      set date_key = p_date_key,
          end_date_key = case when v_old_end is null then null else v_old_end + v_delta end,
          updated_at = now()
      where id = p_moved_id;
    end if;
  end if;

  foreach v_id in array p_ordered_ids loop
    update public.events set sort_order = v_idx, updated_at = now() where id = v_id;
    v_idx := v_idx + 1;
  end loop;
end;
$$;

-- ── 체인 연결을 한 트랜잭션으로 ──
-- ordered[i].link_next = ordered[i+1]. 중간 실패 시 반쪽 체인이 남지 않는다.
create or replace function public.link_chain_atomic(
  p_ordered_ids uuid[]
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  i int;
begin
  if array_length(p_ordered_ids, 1) < 2 then
    raise exception 'need at least 2 events to link';
  end if;
  for i in 1 .. array_length(p_ordered_ids, 1) - 1 loop
    update public.events
    set link_next = p_ordered_ids[i + 1], updated_at = now()
    where id = p_ordered_ids[i];
  end loop;
end;
$$;

-- 실행 권한: 서버(서비스 롤)와 로그인 사용자(RLS 하). anon은 불필요.
grant execute on function public.save_event_atomic(uuid, jsonb, jsonb, jsonb) to authenticated, service_role;
grant execute on function public.reorder_events_atomic(date, uuid[], uuid) to authenticated, service_role;
grant execute on function public.link_chain_atomic(uuid[]) to authenticated, service_role;
revoke execute on function public.save_event_atomic(uuid, jsonb, jsonb, jsonb) from anon;
revoke execute on function public.reorder_events_atomic(date, uuid[], uuid) from anon;
revoke execute on function public.link_chain_atomic(uuid[]) from anon;
