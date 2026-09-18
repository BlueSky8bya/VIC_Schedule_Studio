-- 0120: 무거운 말 그래프 재빌드를 **DB 스케줄러(pg_cron)**로 옮긴다.
--
-- 문제(0118/0119에서 드러남): search_term_graph_rebuild()는 최적화 뒤에도 63초가 걸리는데,
-- app/api/cron/vod-chat 라우트의 maxDuration은 60초다. 그래서 채팅 조각이 들어오는 날마다 크론이
-- 타임아웃했고, 말 그래프·줄임말·요즘 말이 **한 번도 갱신되지 않고 있었다**.
--
-- 두 갈래를 재 보고 골랐다.
--   A) pg_cron으로 DB 안에서 야간 실행 — HTTP 타임아웃이라는 제약 자체가 사라진다. 결과·의미 무변화.
--   B) 문서당 낱말 수 상한(120) — 쌍을 500만 → 168만으로 줄여 ~25초. 그러나 실측해 보니
--      관계가 382,228 → 57,286(15%)로 줄고, 관련어 칩의 재료(ppmi ≥ 2 ∧ co_docs ≥ 4)가
--      42,310 → 8,304(19.6%)만 남는다. 검색 시트의 '관련' 칩 중 80%가 사라진다는 뜻이라 기각.
-- → A를 택한다. 배치 작업은 요청-응답 수명에 매달 일이 아니다.
--
-- 되돌리기: select cron.unschedule('vic-search-graph');
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0120_search_graph_pg_cron.sql

create extension if not exists pg_cron;

-- 야간 일괄 — 순서가 중요하다(그래프 → 줄임말 → 요즘 말). 하나가 실패해도 다음을 시도하고,
-- 무엇이 얼마나 걸렸는지 로그로 남긴다(cron.job_run_details에 남는 notice).
create or replace function public.search_graph_nightly()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare t0 timestamptz; n int;
begin
  t0 := clock_timestamp();
  begin
    select public.search_term_graph_rebuild() into n;
    raise notice 'search_term_graph_rebuild: % terms, % ms', n, round(extract(epoch from clock_timestamp() - t0) * 1000);
  exception when others then
    raise warning 'search_term_graph_rebuild failed: %', sqlerrm;
  end;
  t0 := clock_timestamp();
  begin
    perform public.search_synonyms_rebuild();
    raise notice 'search_synonyms_rebuild: % ms', round(extract(epoch from clock_timestamp() - t0) * 1000);
  exception when others then
    raise warning 'search_synonyms_rebuild failed: %', sqlerrm;
  end;
  t0 := clock_timestamp();
  begin
    perform public.search_trending_rebuild();
    raise notice 'search_trending_rebuild: % ms', round(extract(epoch from clock_timestamp() - t0) * 1000);
  exception when others then
    raise warning 'search_trending_rebuild failed: %', sqlerrm;
  end;
end;
$$;
comment on function public.search_graph_nightly() is
  '말 그래프·줄임말·요즘 말 야간 일괄(0120) — pg_cron이 부른다. HTTP 크론에서 부르지 말 것(60초 한도 초과).';

-- 03:20 KST = 18:20 UTC — 방송이 끝난 뒤, 채팅 수집 크론과 겹치지 않는 시간.
-- 같은 이름으로 다시 부르면 일정이 갱신된다(멱등).
select cron.schedule('vic-search-graph', '20 18 * * *', 'select public.search_graph_nightly()');
