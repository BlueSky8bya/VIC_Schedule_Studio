-- 0064: 촘촘한 진단 로그를 짧게만 보관 (사용자 결정 2026-08-04)
--
-- 배경: 최초공개(떡밥)가 시청자 화면에 반영되지 않는 문제를 쫓는 데 기존 로그로는 부족했다.
-- "저장했다"와 "카드가 어떤 상태로 그려졌다" 사이가 통째로 비어 있어, 캐시된 stub의 공개시각이
-- 지난 뒤 공개시각을 미래로 다시 잡으면 카드가 빈 채로 멈춘다는 걸 코드를 읽어서야 알았다.
--
-- 그래서 '진단(diag)' 층을 만든다
-- (컬럼명은 diag — verbose는 Postgres 키워드와 부딪혀 인덱스 술어에서 문법 오류가 난다.): 화면이 실제로 무엇을 그렸는지, 서버가 무엇을 돌려줬는지를
-- 촘촘히 남긴다. 대신 **3일만** 보관한다. 이유:
--   - 이 층은 버그를 쫓을 때만 쓴다. 사흘이면 "어제 그거"까지 커버된다.
--   - 촘촘한 만큼 행이 빨리 쌓인다(카드 한 장이 그려질 때마다 한 줄). 90일은 과하다.
--   - 일반 층(90일)은 '무엇을 했나'라 오래 볼 값어치가 있지만, 진단은 그 성격이 아니다.
--
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0064_activity_verbose.sql

alter table public.activity_event add column if not exists diag boolean not null default false;

comment on column public.activity_event.diag is
  '진단용 촘촘한 로그. 보존 3일(일반 기록은 90일). 화면이 무엇을 그렸는지·서버가 무엇을 돌려줬는지.';

-- 보존 청소는 (verbose, day)로 지운다 — 부분 인덱스로 진단 행만 빠르게 걷는다.
create index if not exists activity_event_verbose_day_idx
  on public.activity_event (day)
  where diag;

-- 타임라인 기본 조회는 진단 행을 제외한다(끼면 '무엇을 했나'가 안 보인다).
-- 기존 (day, occurred_at) 인덱스에 verbose를 얹어 필터가 인덱스에서 끝나게 한다.
create index if not exists activity_event_day_normal_idx
  on public.activity_event (day, occurred_at)
  where not diag;
