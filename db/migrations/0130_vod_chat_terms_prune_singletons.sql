-- 0130: 채팅 단어 표에서 아무도 안 읽는 cnt=1 행을 버린다(저장 시점부터 + 기존 행 일괄).
--
-- 소유자(2026-09-28): "전체 채팅을 뭐하러 다 저장해 — 처음 분석할 때 필요한 것만 얻고 나머지는 버려라."
-- 원문은 원래 안 남긴다(0088: 단어 빈도만). 새는 곳은 그 빈도 표였다: 1,338,056행 중 cnt=1이
-- 1,110,279행(83%)인데, 읽는 쪽 최소 임계가 cnt>=2(0115 사전 초안)이고 나머지는 3/5/10이라 한 번도 안 읽힌다.
-- 힙 92MB + 인덱스 120MB의 대부분이 이 행들 — 디스크 얇은 인스턴스(0129)에서 야간 집계까지 흔들었다.
--
-- 무손실인 이유: vod_chat_commit_job은 VOD 단위 스냅샷을 통째로 갈아끼우고, 누적 중인 원본 집계는
-- vod_chat_job.state(JSON)에 있다. 다음 조각에서 같은 낱말이 또 나오면 state에서 cnt 2가 되어 그때 저장된다.
-- 되돌리기: 0126의 vod_chat_commit_job 재적용(지운 행은 다음 커밋에 다시 채워진다 — 미완료 VOD만).
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0130_vod_chat_terms_prune_singletons.sql
-- 적용 뒤 별도로(트랜잭션 밖): vacuum full public.vod_chat_terms; — 지운 만큼 디스크를 실제로 돌려받는다.

create or replace function public.vod_chat_commit_job(
  p_title_no bigint, p_revision integer, p_job jsonb, p_snapshot jsonb default null
) returns boolean language plpgsql security definer set search_path = public as $$
declare current_revision integer;
begin
  if not exists(select 1 from public.vod_archive where title_no=p_title_no and auth_no=101) then return false; end if;
  insert into public.vod_chat_job(title_no) values(p_title_no) on conflict do nothing;
  select revision into current_revision from public.vod_chat_job where title_no=p_title_no for update;
  if current_revision <> p_revision then return false; end if;
  if p_snapshot is not null then
    -- Replace derived aggregates only for this VOD, atomically with its checkpoint.
    -- cnt=1 rows are never read (lowest reader threshold is 2) — keep them out of the table (0130).
    delete from public.vod_chat_terms where title_no=p_title_no;
    insert into public.vod_chat_terms(title_no,term,cnt,peak_bin,peak_cnt,bins)
      select p_title_no,x.term,x.cnt,x.peak_bin,x.peak_cnt,x.bins
      from jsonb_to_recordset(p_snapshot->'terms') as x(term text,cnt integer,peak_bin integer,peak_cnt integer,bins integer)
      where x.cnt >= 2;
    delete from public.vod_chat_bins where title_no=p_title_no;
    insert into public.vod_chat_bins(title_no,bin,msgs,speakers,laugh,terms)
      select p_title_no,x.bin,x.msgs,x.speakers,x.laugh,x.terms
      from jsonb_to_recordset(p_snapshot->'bins') as x(bin integer,msgs integer,speakers integer,laugh integer,terms text[]);
    delete from public.vod_chat_people where title_no=p_title_no;
    insert into public.vod_chat_people(title_no,name,greetings,mentions)
      select p_title_no,x.name,x.greetings,x.mentions
      from jsonb_to_recordset(p_snapshot->'people') as x(name text,greetings integer,mentions integer);
  end if;
  update public.vod_chat_job set revision=revision+1,
    state=nullif(p_job->'state','null'::jsonb), complete=(p_job->>'complete')::boolean,
    next_retry_at=(p_job->>'nextRetryAt')::timestamptz, updated_at=now()
    where title_no=p_title_no;
  insert into public.vod_chat_sync(title_no,chunks,messages,complete,synced_at)
    values(p_title_no,(p_job->>'chunks')::integer,(p_job->>'messages')::integer,(p_job->>'complete')::boolean,now())
    on conflict(title_no) do update set chunks=excluded.chunks,messages=excluded.messages,
      complete=excluded.complete,synced_at=excluded.synced_at;
  return true;
end;
$$;
revoke all on function public.vod_chat_commit_job(bigint,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.vod_chat_commit_job(bigint,integer,jsonb,jsonb) to service_role;

-- 기존 행 일괄 정리(멱등).
delete from public.vod_chat_terms where cnt < 2;
