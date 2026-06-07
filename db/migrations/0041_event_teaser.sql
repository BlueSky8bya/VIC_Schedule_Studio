-- 떡밥(가림) 일정: 공개 시각 전엔 제목·태그를 숨기고 전용 룩 + 카운트다운만 보여준다.
-- 실제 제목/태그는 서버(public-loader)가 공개 시각 전엔 응답에서 빼므로 시청자에게 유출되지 않는다.
-- teaser=true이고 teaser_reveal_at이 미래면 '가림 상태'. 공개 시각이 지나면 평범한 일정처럼 보인다.
alter table public.events
  add column if not exists teaser boolean not null default false,
  add column if not exists teaser_reveal_at timestamptz;
