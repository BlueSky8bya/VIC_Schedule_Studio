-- 0144: 새 일정은 그 날 **맨 아래**에 생긴다(2026-10-10 소유자: "붙여넣기 미리보기는 칸 맨 아래에 뜨는데,
-- 붙여넣으면 맨 위에 생긴다 — 의도 불일치"). 예전엔 새 행의 sort_order가 기본값 0이라 그 날 첫 일정(0)과 동률이
-- 되어 위로 올라갔다. 이제 insert 때 그 날 가장 큰 sort_order + 1. 편집실 화면(낙관적 반영)도 같은 규칙.
-- save_event_atomic(0073) 본문 그대로 + insert의 sort_order만 추가. 수정(update)은 순서를 건드리지 않는다.
-- 적용: SUPABASE_DB_CA_PATH=.scratch-pw/supabase-ca.crt node scripts/apply-db.mjs db/migrations/0144_new_event_sorts_last.sql

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
      is_all_day, is_tentative, is_support, support_kind, support_url,
      public_title, public_description, secret_cipher,
      visibility_scope, status, category, teaser, teaser_reveal_at, sort_order, updated_at
    ) values (
      (p_row->>'calendar_id')::uuid,
      (p_row->>'date_key')::date,
      (p_row->>'end_date_key')::date,
      (p_row->>'start_time')::time,
      (p_row->>'end_time')::time,
      coalesce((p_row->>'is_all_day')::boolean, false),
      coalesce((p_row->>'is_tentative')::boolean, false),
      coalesce((p_row->>'is_support')::boolean, false),
      coalesce(p_row->>'support_kind', 'up'),
      p_row->>'support_url',
      p_row->>'public_title',
      p_row->>'public_description',
      p_row->>'secret_cipher',
      (p_row->>'visibility_scope')::public.visibility_scope,
      (p_row->>'status')::public.event_status,
      (p_row->>'category')::public.event_category,
      coalesce((p_row->>'teaser')::boolean, false),
      (p_row->>'teaser_reveal_at')::timestamptz,
      -- 새 일정은 그 날 맨 아래(지금 가장 큰 순서 + 1)
      (select coalesce(max(e.sort_order) + 1, 0) from public.events e
        where e.calendar_id = (p_row->>'calendar_id')::uuid and e.date_key = (p_row->>'date_key')::date),
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
      support_kind = coalesce(p_row->>'support_kind', 'up'),
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
