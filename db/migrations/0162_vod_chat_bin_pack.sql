-- 0162: 다시보기 채팅 30초 구간(vod_chat_bins)을 방송 1개 = 1행 배열 묶음(vod_chat_bin_pack)으로 옮긴다.
--
-- 왜: vod_chat_bins는 31.8만 행·47MB(heap 26 + pkey 21)로 DB에서 둘째로 컸다. 한 행(평균 66B)의 대부분이
-- 행 머리(24B)·정렬·인덱스 몫이고, 66%의 행은 단어가 빈 배열이다. 읽는 쪽은 vod_chat_profile 하나뿐이고 항상
-- "방송 1개 통째"로 읽는다 → 행 단위로 둘 이유가 없다. 배열은 방송당 ~10KB라 TOAST가 압축한다.
-- 덤으로 vod_chat_profile의 '다른 방송 웃음 비율'(others)이 31.8만 행 집계 → 방송 수(~430) 스캔으로 줄어든다.
--
-- 순서: 이 파일은 **추가만** 한다 — 새 표를 만들고, 기존 행을 방송별로 나눠 채우고(나노 DB용: 방송 하나씩),
-- vod_chat_commit_job은 옛 표와 새 표에 **둘 다** 쓰고, vod_chat_profile은 새 표를 읽는다.
-- 옛 표 삭제는 0163(실화면 확인 뒤에만). 되돌리기: 0130(commit_job)·0125(profile)를 다시 적용 + drop table vod_chat_bin_pack.
-- 멱등.
begin;

create table if not exists public.vod_chat_bin_pack (
  title_no bigint primary key references public.vod_archive(title_no) on delete cascade,
  -- 같은 길이의 평행 배열: i번째 = 구간 bins[i]. bin은 30초 단위(최대 32767 = 273시간)라 smallint.
  bins smallint[] not null default '{}',
  msgs integer[] not null default '{}',
  speakers integer[] not null default '{}',
  laugh integer[] not null default '{}',
  -- 구간 상위 단어(구간당 0~3개)를 펼친 평행 배열: term_bin[j] 구간의 단어 term_text[j](원래 순서 유지).
  term_bin smallint[] not null default '{}',
  term_text text[] not null default '{}',
  -- vod_chat_profile의 비교 집계용 미리 계산값(= 위 배열의 count/sum).
  n_bins integer not null default 0,
  sum_msgs integer not null default 0,
  sum_laugh integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.vod_chat_bin_pack enable row level security;
revoke all on public.vod_chat_bin_pack from anon, authenticated;
grant select, insert, update, delete on public.vod_chat_bin_pack to service_role;

-- 채우기: 방송 하나씩(정렬·집계가 work_mem 2MB 안에서 끝나게). 이미 채운 방송도 다시 덮어 써 멱등.
do $$
declare t bigint;
begin
  for t in select distinct title_no from public.vod_chat_bins loop
    insert into public.vod_chat_bin_pack(title_no,bins,msgs,speakers,laugh,term_bin,term_text,n_bins,sum_msgs,sum_laugh,updated_at)
    select t,
      coalesce((select array_agg(b.bin::smallint order by b.bin) from public.vod_chat_bins b where b.title_no=t),'{}'),
      coalesce((select array_agg(b.msgs order by b.bin) from public.vod_chat_bins b where b.title_no=t),'{}'),
      coalesce((select array_agg(b.speakers order by b.bin) from public.vod_chat_bins b where b.title_no=t),'{}'),
      coalesce((select array_agg(b.laugh order by b.bin) from public.vod_chat_bins b where b.title_no=t),'{}'),
      coalesce((select array_agg(b.bin::smallint order by b.bin, w.ord) from public.vod_chat_bins b
        cross join lateral unnest(b.terms) with ordinality as w(term,ord) where b.title_no=t),'{}'),
      coalesce((select array_agg(w.term order by b.bin, w.ord) from public.vod_chat_bins b
        cross join lateral unnest(b.terms) with ordinality as w(term,ord) where b.title_no=t),'{}'),
      (select count(*)::integer from public.vod_chat_bins b where b.title_no=t),
      (select coalesce(sum(b.msgs),0)::integer from public.vod_chat_bins b where b.title_no=t),
      (select coalesce(sum(b.laugh),0)::integer from public.vod_chat_bins b where b.title_no=t),
      now()
    where exists(select 1 from public.vod_archive v where v.title_no=t)
    on conflict (title_no) do update set bins=excluded.bins, msgs=excluded.msgs, speakers=excluded.speakers,
      laugh=excluded.laugh, term_bin=excluded.term_bin, term_text=excluded.term_text, n_bins=excluded.n_bins,
      sum_msgs=excluded.sum_msgs, sum_laugh=excluded.sum_laugh, updated_at=excluded.updated_at;
  end loop;
end $$;

-- 쓰기: 0130과 같고, 구간 묶음을 새 표에도 쓴다(0163 전까지 옛 표와 이중 기록 — 되돌리기 안전망).
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

-- 읽기: 0125와 같은 JSON을 새 표에서 만든다(구간 순서·단어 순서·빈 배열 []까지 동일).
create or replace function public.vod_chat_profile(p_title_no bigint)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with p as (
    select * from public.vod_chat_bin_pack
    where title_no = p_title_no and exists(select 1 from public.vod_archive v where v.title_no=p_title_no and v.auth_no=101)
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
    where exists(select 1 from public.vod_archive v where v.title_no=k.title_no and v.auth_no=101)
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
$$;
grant execute on function public.vod_chat_profile(bigint) to anon, authenticated, service_role;

commit;
notify pgrst, 'reload schema';
