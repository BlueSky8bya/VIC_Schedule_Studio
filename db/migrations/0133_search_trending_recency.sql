-- 0133: 화제 칩을 '요즘'에 예민하게 — 최근성 가중(반감기 3일) 점수.
-- 문제(2026-10-03 실측, prod read-only): 갱신은 매일 돌고 있었지만(computed_at = 그날 03:20 KST) 순위가 굳어 있었다.
--   · 0112 점수 = 최근 30일 **평평한 합계** ÷ 이전 180일 기대치. 3주 전 굿즈 방송의 '포토카드·텀블러·담요'가
--     어제 방송의 말과 같은 무게라 30일 창을 빠져나갈 때까지 상위를 지킨다.
--   · 채팅 단어는 방송당 30으로 잘려(least(cnt,30)) 큰 방송의 말들이 전부 같은 점수로 묶인다 → 새 방송이 못 밀어낸다.
-- 고침:
--   1) 창 30일 → 14일, 날마다 0.5^(나이/3일) 가중. 어제 방송 ≈ 0.79, 일주일 전 ≈ 0.20, 2주 전 ≈ 0.04.
--   2) 기대치도 같은 가중 일수(≈4.7일)로 환산 — 늘 나오는 말은 계속 눌린다.
--   3) 방송당 상한은 부드럽게: 30 + sqrt(초과분). 한 방송 도배는 막되 동점은 풀린다.
--   4) 날짜 기준을 KST로(current_date는 UTC — 자정~09시 사이 하루 어긋남).
-- recent 열 = 창 안의 실제 횟수(칩 툴팁), ratio 열 = 가중 점수 비(정렬 키). 표·조회 함수는 0112 그대로.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0133_search_trending_recency.sql
-- 되돌리기: 0112 재적용.

create or replace function public.search_trending_rebuild(p_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = public
as $BODY$
declare
  n_rows int;
  d int := greatest(1, least(coalesce(p_days, 14), 60));
  hl numeric := 3.0;                                   -- 반감기(일)
  today date := (now() at time zone 'Asia/Seoul')::date;
  eff numeric;                                         -- 창 안 가중치의 합 = 가중 일수
begin
  select sum(power(0.5, g / hl)) into eff from generate_series(0, d - 1) as g;

  delete from public.search_trends;
  insert into public.search_trends (term, recent, ratio)

  with docs as (
    select v.broadcast_day as day, v.title as txt from public.vod_archive v where v.auth_no = 101
    union all
    select v.broadcast_day, c.label from public.vod_chapter_index c join public.vod_archive v on v.title_no = c.title_no and v.auth_no = 101
    union all
    select e.date_key, e.public_title || ' ' || coalesce(e.public_description, '')
    from public.events e
    where e.deleted_at is null and e.visibility_scope = 'public' and e.status <> 'draft'
      and not (coalesce(e.teaser, false) and e.teaser_reveal_at is not null and e.teaser_reveal_at > now())
  ),
  doc_words as (
    select distinct lower(x) as w from docs, regexp_split_to_table(txt, '[^가-힣a-zA-Z0-9]+') as x where x ~ '^[가-힣]{2,6}$'
  ),
  known as (
    select w from doc_words
    union select s.term from public.search_synonyms s
    union select s.alt from public.search_synonyms s
    union select e.name from public.search_entities e
    union select g.norm from public.search_games g
    union select i.term from public.search_intents i
  ),
  words as (
    select day, lower(x) as w, 1::numeric as n
    from docs, regexp_split_to_table(txt, '[^가-힣a-zA-Z0-9]+') as x
    where x ~ '^[가-힣]{2,6}$'
    union all
    select v.broadcast_day, t.term, least(t.cnt, 30) + sqrt(greatest(t.cnt - 30, 0))::numeric
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no = 101
    where v.broadcast_day >= today - (d + 180)
      and t.cnt >= 3 and t.term ~ '^[가-힣]{2,6}$' and t.term in (select w from known)
  ),
  stop as (
    select unnest(array['토리님','토리','빅토리','빅토리님','방송','시작','종료','오늘','내일','시간','잠깐','다시','이야기','토리가','우리','그냥','정말','진짜','후열','엔딩','멘트','휴식','시청자','새로운','요즘','오늘도','이번','다음','처음','마지막','드디어','바로',
      'ㅋㅋㅋ','ㅋㅋ','ㅠㅠ','ㅎㅎ','아니','근데','뭐야','진짜','대박','와우','헐','오오','ㄷㄷ','ㄹㅇ','ㅇㅇ','ㄴㄴ','ㅇㅋ','ㄱㄱ','ㅈㅈ',
      '아니야','이게','그게','저게','이거','그거','저거','이제','지금','여기','거기','저기','사실','아마','약간','조금','많이','이미','계속','다시','거의','정말로','솔직히','하는','있는','없는','같은','너무','이런','그런','저런','어떻게','왜요','뭐지','뭔데','맞아','맞다','그치','네네','아하']) as w
  ),
  recent as (
    -- 미래 날짜(예정 일정 제목)는 나이 0으로 본다.
    select w, sum(n) as n, sum(n * power(0.5, greatest(0, today - day) / hl)) as hot
    from words
    where day > today - d
      and w not in (select w from stop)
    group by w
  ),
  prior as (
    select w, sum(n) as n from words
    where day <= today - d
      and day > today - (d + 180)
    group by w
  )
  select r.w as term, round(r.n)::int as recent,
         round(r.hot / greatest(1, coalesce(p.n, 0) * (eff / 180.0)), 2) as ratio
  from recent r
  left join prior p on p.w = r.w
  where r.n >= 3
  order by ratio desc, r.n desc
  limit 60;
  get diagnostics n_rows = row_count;
  return n_rows;
end;
$BODY$;
revoke all on function public.search_trending_rebuild(integer) from public, anon, authenticated;
grant execute on function public.search_trending_rebuild(integer) to service_role;
comment on function public.search_trending_rebuild(integer) is
  '화제 칩 캐시 재계산(0133) — 14일 창·반감기 3일 가중. 야간 일괄과 채팅/타임라인 수집 뒤에 불린다.';

select public.search_trending_rebuild();
notify pgrst, 'reload schema';
