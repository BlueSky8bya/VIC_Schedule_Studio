-- 0170: 구독자 전용 다시보기(auth_no 107)의 채팅 분석을 되살린다.
-- 0156이 수집 큐·저장·프로필을 101·107로 넓혔는데, 0162/0163이 0130(101 전용) 본을 바탕으로
-- vod_chat_commit_job·vod_chat_profile을 다시 써서 107이 빠졌다(2026-11-13 회귀).
--   · commit_job이 107을 거절(false) → 큐(pick_jobs, 101·107)는 같은 107 세 편을 5분마다 계속 골라
--     4칸 중 3칸을 헛돌았고, 107 방송은 채팅 집계가 저장되지 않았다.
--   · profile이 107을 읽지 않아 그 다시보기의 '댓글 몰림' 그래프가 비었다.
-- 본문은 2026-11-15 운영 DB의 현재 정의(pg_get_functiondef)에서 auth_no=101 세 곳만 in (101,107)로 바꾼 것이다.
-- 멱등. 권한은 create or replace가 그대로 둔다. 되돌리기: 0163(commit_job)·0162(profile)을 다시 적용.
begin;

CREATE OR REPLACE FUNCTION public.vod_chat_commit_job(p_title_no bigint, p_revision integer, p_job jsonb, p_snapshot jsonb DEFAULT NULL::jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare current_revision integer;
begin
  if not exists(select 1 from public.vod_archive where title_no=p_title_no and auth_no in (101,107)) then return false; end if;
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
$function$
;

CREATE OR REPLACE FUNCTION public.vod_chat_profile(p_title_no bigint)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  with p as (
    select * from public.vod_chat_bin_pack
    where title_no = p_title_no and exists(select 1 from public.vod_archive v where v.title_no=p_title_no and v.auth_no in (101,107))
  ),
  tb as (
    select w.bin::integer as bin, array_agg(w.term order by w.ord) as terms
    from p cross join lateral unnest(p.term_bin, p.term_text) with ordinality as w(bin,term,ord)
    group by w.bin
  ),
  b as (
    select u.bin::integer as bin, u.msgs, u.speakers, u.laugh, coalesce(tb.terms,'{}'::text[]) as terms
    from p cross join lateral unnest(p.bins, p.msgs, p.speakers, p.laugh) as u(bin,msgs,speakers,laugh)
    left join tb on tb.bin = u.bin
  ),
  mx as (
    select greatest(1, max(msgs)) as m, greatest(1, max(speakers)) as s, greatest(1, max(laugh)) as l from b
  ),
  mine as (
    select case when sum(msgs) > 0 then sum(laugh)::numeric / sum(msgs) else 0 end as lpm, count(*) as n from b
  ),
  others as (
    select k.title_no, k.sum_laugh::numeric / greatest(1, k.sum_msgs) as lpm
    from public.vod_chat_bin_pack k
    where exists(select 1 from public.vod_archive v where v.title_no=k.title_no and v.auth_no in (101,107))
      and k.n_bins >= 20 and k.sum_msgs >= 200
  ),
  tier as (
    -- 비교 대상 방송이 8개는 있어야 '상위 25%'가 뜻을 가진다(백필 초기엔 등급 없음).
    select case
      when (select n from mine) >= 20 and (select count(*) from others) >= 8
       and (select lpm from mine) >= coalesce((select percentile_cont(0.75) within group (order by lpm) from others), 1e9) then 'high'
      else null end as t
  )
  select json_build_object(
    'binSec', 30,
    'laughTier', (select t from tier),
    'bins', coalesce((
      select json_agg(json_build_object(
        'i', b.bin,
        'h', round(b.msgs::numeric / mx.m, 2),
        'd', round(b.speakers::numeric / mx.s, 2),
        'l', round(b.laugh::numeric / mx.l, 2),
        't', b.terms
      ) order by b.bin)
      from b, mx
    ), '[]'::json)
  );
$function$
;

commit;
notify pgrst, 'reload schema';
