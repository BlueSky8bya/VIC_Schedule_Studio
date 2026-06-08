-- 서버 구간별 응답시간 표본(개발자 인사이트 "서버 성능" 패널용). timed()가 응답 후(after) fire-and-
-- forget로 한 행씩 남긴다. 라벨별 count/avg/p50/p95/max를 집계해 "여기가 평소/벤치보다 느리다"를 본다.
-- 내부 진단용이라 RLS deny-all(정책 없음) — service-role(서버 액션)로만 읽고 쓴다. 공개 노출 없음.
create table if not exists public.perf_samples (
  id bigint generated always as identity primary key,
  label text not null,         -- 예: "page:/ publicSchedule(viewer)", "publicSchedule:db(8 parallel queries)"
  dur_ms numeric(10, 1) not null,
  created_at timestamptz not null default now()
);

-- 집계 쿼리(라벨별, 최근 N시간)에서 created_at으로 거른 뒤 label로 묶으므로 둘 다 인덱스.
create index if not exists perf_samples_created_idx on public.perf_samples (created_at);
create index if not exists perf_samples_label_created_idx on public.perf_samples (label, created_at);

alter table public.perf_samples enable row level security;
-- 정책 없음 = 직접 접근 차단(서버 액션의 service-role만 접근).

-- 라벨별 집계(최근 p_since 이후): 표본수·평균·p50·p95·최대. 패널이 rpc로 호출한다.
-- security definer로 RLS(deny-all)를 우회해 읽는다(호출은 서버 액션의 개발자 권한 확인 뒤).
create or replace function public.get_perf_stats(p_since timestamptz)
returns table (
  label text,
  n bigint,
  avg_ms numeric,
  p50_ms numeric,
  p95_ms numeric,
  max_ms numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.label,
    count(*) as n,
    round(avg(s.dur_ms), 1) as avg_ms,
    round(percentile_cont(0.5) within group (order by s.dur_ms)::numeric, 1) as p50_ms,
    round(percentile_cont(0.95) within group (order by s.dur_ms)::numeric, 1) as p95_ms,
    round(max(s.dur_ms), 1) as max_ms
  from public.perf_samples s
  where s.created_at >= p_since
  group by s.label
  order by p95_ms desc;
$$;

