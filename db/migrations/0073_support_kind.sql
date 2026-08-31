-- 0073: 업 도움 띠의 종류(support_kind) — 2026-09-01 사용자 요청
--
-- 'up'     = 기존 업 도움(숲에서 업을 눌러 도와주는 기간, CTA '도와주러 가기') — 기본값.
-- 'period' = 단순 기간 안내(예: 마비노기 언리얼 이터니티 알파테스트 9/4~6) — 도와주러 갈
--            필요가 없는 정보성 띠. CTA 없음, 링크는 선택(있으면 '자세히 보기').
--
-- 멱등: add column if not exists + 제약은 예외 무시 + 함수는 create or replace.
-- 적용: node scripts/apply-db.mjs db/migrations/0073_support_kind.sql

alter table public.events
  add column if not exists support_kind text not null default 'up';

do $$ begin
  alter table public.events
    add constraint events_support_kind_check check (support_kind in ('up', 'period'));
exception when duplicate_object then null; end $$;

-- save_event_atomic(0055)에 support_kind 반영 — 시그니처 동일, 본문만 교체.
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
