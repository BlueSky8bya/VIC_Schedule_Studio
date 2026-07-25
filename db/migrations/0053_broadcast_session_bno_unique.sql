-- 0053: 같은 방송(bno)의 세션 행을 유일하게 강제 — 중복 유령 세션 원천 차단.
--
-- 배경(버그, 2026-07-26 실제 발생): recordLiveTick은 시청자 폴링마다 fire-and-forget으로 불린다.
--   동시 폴링 두 개가 겹치면 둘 다 "열린 세션 없음"을 읽고 둘 다 insert하는 read-then-insert 레이스로
--   같은 bno의 세션 행이 중복 생성됐다. 자정(KST) 이후에 생긴 중복 행은 start_day가 다음날로 귀속돼
--   방송을 시작하지도 않은 날에 "1분" 유령 막대가 떴다(공개/관리자 인사이트 모두).
--
-- 처치: (1) 기존 중복을 병합 — bno별로 가장 이른 started_at 행만 남기고, 남는 행의
--   last_live_at/ended_at을 그룹 최대값으로 확장한 뒤 나머지를 삭제. (2) bno unique index로
--   재발을 DB 차원에서 차단(레거시 bno null 행은 여러 개 허용 — Postgres unique는 null끼리 비충돌).
--   앱 코드는 insert가 unique 충돌로 실패하면 기존 행을 잇는다(lib/broadcast/session.ts).

with agg as (
  select
    bno,
    min(started_at) as min_started,
    max(last_live_at) as max_live,
    max(coalesce(ended_at, last_live_at)) as max_end,
    bool_and(ended_at is not null) as all_ended,
    count(*) as n
  from public.broadcast_session
  where bno is not null
  group by bno
),
keep as (
  select distinct on (s.bno) s.id, s.bno
  from public.broadcast_session s
  join agg a on a.bno = s.bno
  where a.n > 1
  order by s.bno, s.started_at asc
)
update public.broadcast_session s
set
  last_live_at = a.max_live,
  ended_at = case when a.all_ended then a.max_end else null end
from keep k
join agg a on a.bno = k.bno
where s.id = k.id;

with agg as (
  select bno, count(*) as n
  from public.broadcast_session
  where bno is not null
  group by bno
),
keep as (
  select distinct on (s.bno) s.id, s.bno
  from public.broadcast_session s
  join agg a on a.bno = s.bno
  where a.n > 1
  order by s.bno, s.started_at asc
)
delete from public.broadcast_session s
using keep k
where s.bno = k.bno and s.id <> k.id;

create unique index if not exists broadcast_session_bno_uq
  on public.broadcast_session (bno);

comment on index public.broadcast_session_bno_uq is
  '한 방송(bno) = 한 세션 행. 동시 폴링 read-then-insert 레이스의 중복 유령 세션 차단(0053).';
