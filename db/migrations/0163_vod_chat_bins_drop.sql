-- 0163: ⚠ 0162 적용 + 실화면 확인 **뒤에만** 적용한다. 옛 구간 표를 지우고, 쓰이지 않는 색인을 걷고, 부푼 색인을 다시 만든다.
--
-- 적용 전 확인(모두 참이어야 한다):
--   1) 0162 적용 뒤 다시보기 화면의 채팅 그래프·구간 단어·'웃음 많은 방송' 표시가 전과 같다.
--   2) select count(*) from vod_chat_bin_pack = select count(distinct title_no) from vod_chat_bins.
--   3) 0162 뒤 새로 수집된 방송이 vod_chat_bin_pack에 들어온다(updated_at이 최근).
--
-- 무엇을:
--   · vod_chat_commit_job — 옛 표(vod_chat_bins) 이중 기록을 뺀다(0162와 나머지는 같다).
--   · drop table vod_chat_bins — 약 47MB(heap 26 + pkey 21).
--   · vod_chapter_index의 trigram GIN 3개 — 만든 뒤로 idx_scan 0(2026-11-13 실측). 검색은 이 열들을
--     `(case … then label_cho else label_norm end) ~ 정규식`, `(section_norm || '|' || parent_norm) ~ …`처럼
--     **식**으로만 읽어 단일 열 색인을 원리상 못 쓴다 → 결과·속도 변화 없이 약 13.5MB.
--     (label_norm 색인은 드물게 쓰여 남긴다.) 되살리기: 아래 주석의 create index 3줄.
--   · vod_chat_terms 색인 재작성 — 방송마다 '전부 지우고 다시 넣기'를 반복해 pkey가 실측 20MB(행 수로 기대 ~12MB).
--     수집이 끝난 방송은 다시 쓰이지 않아 다시 부풀 여지가 작다. 몇 초간 이 표 쓰기가 잠긴다.
-- 되돌리기: 0162를 다시 적용하면 commit_job 이중 기록이 돌아오지만, 지운 옛 표 행은 되살아나지 않는다
-- (새 표에서 다시 펼치려면 vod_chat_bin_pack을 unnest — 같은 정보를 그대로 담고 있다).
begin;

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
    -- 30초 구간은 방송 1개 = 1행 묶음(0162).
    insert into public.vod_chat_bin_pack(title_no,bins,msgs,speakers,laugh,term_bin,term_text,n_bins,sum_msgs,sum_laugh,updated_at)
      with x as (
        select r.bin, r.msgs, r.speakers, r.laugh, coalesce(r.terms,'{}'::text[]) as terms
        from jsonb_to_recordset(p_snapshot->'bins') as r(bin integer,msgs integer,speakers integer,laugh integer,terms text[])
      )
      select p_title_no,
        coalesce((select array_agg(x.bin::smallint order by x.bin) from x),'{}'),
        coalesce((select array_agg(x.msgs order by x.bin) from x),'{}'),
        coalesce((select array_agg(x.speakers order by x.bin) from x),'{}'),
        coalesce((select array_agg(x.laugh order by x.bin) from x),'{}'),
        coalesce((select array_agg(x.bin::smallint order by x.bin, w.ord) from x cross join lateral unnest(x.terms) with ordinality as w(term,ord)),'{}'),
        coalesce((select array_agg(w.term order by x.bin, w.ord) from x cross join lateral unnest(x.terms) with ordinality as w(term,ord)),'{}'),
        (select count(*)::integer from x),
        (select coalesce(sum(x.msgs),0)::integer from x),
        (select coalesce(sum(x.laugh),0)::integer from x),
        now()
      on conflict (title_no) do update set bins=excluded.bins, msgs=excluded.msgs, speakers=excluded.speakers,
        laugh=excluded.laugh, term_bin=excluded.term_bin, term_text=excluded.term_text, n_bins=excluded.n_bins,
        sum_msgs=excluded.sum_msgs, sum_laugh=excluded.sum_laugh, updated_at=excluded.updated_at;
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

drop table if exists public.vod_chat_bins;

-- create index idx_vod_chapter_cho_trgm on public.vod_chapter_index using gin (label_cho gin_trgm_ops);
-- create index idx_vod_chapter_section_trgm on public.vod_chapter_index using gin (section_norm gin_trgm_ops);
-- create index idx_vod_chapter_jamo_trgm on public.vod_chapter_index using gin (label_jamo gin_trgm_ops);
drop index if exists public.idx_vod_chapter_cho_trgm;
drop index if exists public.idx_vod_chapter_section_trgm;
drop index if exists public.idx_vod_chapter_jamo_trgm;

reindex index public.vod_chat_terms_pkey;
reindex index public.idx_vod_chat_terms_term;

commit;
notify pgrst, 'reload schema';
