-- 다시보기 채팅 큐 — 최신 방송 먼저(2026-09-27).
-- 0126의 재시도 레인은 next_retry_at 오름차순이라, 진행 중인 옛 백필(8월 방송, 커서 90~120)이 항상 앞에
-- 섰고 9/26 방송은 52/65 조각에서 9시간째 기다렸다(실측: 우선순위 8번째). 시청자가 보는 건 최근 방송이므로
-- 같은 등급 안에서는 broadcast_day 최신순으로 뽑는다. 레인 교대(신규/재시도)·등급(진행 중 > 틈 재시도)은 유지.
-- 멱등. 롤백: 0126의 함수 본문으로 되돌린다.
create or replace function public.vod_chat_pick_jobs(p_limit integer default 4)
returns table(title_no bigint)
language sql security definer set search_path = public as $$
  with due as (
    select v.title_no, (j.title_no is null) as fresh,
      row_number() over(partition by (j.title_no is null)
        order by case when j.state is null and not j.complete then 0
          when not j.complete and coalesce((j.state->>'retries')::integer,0)=0 then 1 else 2 end,
          v.broadcast_day desc, v.title_no desc,
          coalesce(j.next_retry_at, '-infinity'::timestamptz)) as lane_rank
    from public.vod_archive v left join public.vod_chat_job j on j.title_no=v.title_no
    where v.auth_no=101 and (j.title_no is null or j.next_retry_at<=now())
  )
  select d.title_no from due d
  order by d.lane_rank, case when (extract(epoch from now())::bigint / 1800) % 2=0
    then d.fresh::integer else (not d.fresh)::integer end
  limit greatest(1, least(coalesce(p_limit, 4), 20));
$$;
revoke all on function public.vod_chat_pick_jobs(integer) from public, anon, authenticated;
grant execute on function public.vod_chat_pick_jobs(integer) to service_role;
notify pgrst, 'reload schema';
