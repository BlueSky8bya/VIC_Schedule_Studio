-- 0051: '이 달 이전에 본 적 있는 계정' 집합을 서버에서 DISTINCT로 뽑는 RPC.
--
-- 배경: 새/재방문 판정(getVisitTrendsAction·getDayVisitDetailAction)이 이걸 알아내려고
-- visit_session 전체 이력을 select 해왔다. PostgREST는 1000행씩 끊어 주므로 fetchAllRows가
-- 페이지를 계속 넘겨야 하고(한 달 3500행 기준 1년이면 40회+ 순차 왕복), 받은 수만 행을 결국
-- Set 하나로 접었다. 필요한 건 '구분된 해시 목록'뿐이라 DB에서 접어서 한 번에 준다.
--
-- 경계: visit_session은 계속 RLS deny-all(0033). 이 함수는 운영 지표라 service_role만 실행한다
-- (anon/authenticated에는 grant하지 않는다 — 공개 인사이트는 0049/0050 집계 RPC만 쓴다).
create or replace function public.get_known_account_hashes(p_before date)
returns table (account_hash text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct s.account_hash
  from public.visit_session s
  where s.day < p_before
    and s.account_hash is not null;
$$;

comment on function public.get_known_account_hashes(date) is
  '지정일 이전에 기록된 방문 계정 해시(중복 제거). 새/재방문 판정용. 서버(service_role) 전용.';

-- day로 거른 뒤 account_hash만 읽으므로 이 인덱스면 테이블을 안 훑는다(인덱스 온리 스캔).
create index if not exists visit_session_day_acct_idx
  on public.visit_session (day, account_hash);

-- 기본 권한 회수 후 서버에만 실행 허용(운영 지표 — 시청자에게 열지 않는다).
revoke all on function public.get_known_account_hashes(date) from public, anon, authenticated;
grant execute on function public.get_known_account_hashes(date) to service_role;
