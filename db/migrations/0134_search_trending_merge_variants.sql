-- 0134: 화제 칩 — 비슷한 말 합치기(조사 꼬리·모음 표기 변형).
-- 문제(0133 적용 뒤 실측): 상위 칩에 '소시지 · 소세지 · 소시지가', '뉴바타 · 뉴바타를'처럼 같은 말이 여러 칸을 먹는다.
-- 고침(재계산 함수 안에서, 후보끼리만):
--   1) 조사 꼬리: 꼬리(가·를·은·는·님·에서 …)를 뗀 몸통이 **같은 후보 목록에 있을 때만** 몸통으로 합친다
--      (사전 없이 떼면 '소개 → 소'처럼 망가진다 — 몸통 2자 이상 + 실제로 뜨는 말이어야 한다).
--      뗀 몸통이 불용어면('빅토리님과' → '빅토리님') 그 말은 버린다.
--   2) 표기 변형: 길이 같고(3자 이상) 한 음절의 **모음만** 헷갈리는 짝(ㅐ/ㅔ, ㅔ/ㅣ, ㅛ/ㅕ, ㅗ/ㅜ, ㅙ/ㅚ/ㅞ, ㅒ/ㅖ, ㅢ/ㅣ/ㅔ)
--      으로 다르면 점수 높은 쪽으로 합친다(소세지 → 소시지). 아무 모음이나 허용하면 '하루카/하루코' 같은
--      다른 이름이 붙으므로 짝을 좁혔다. 상위 200개 안에서만 본다(O(n²) 상한).
--   합친 말의 횟수·가중 점수·이전 기대치는 모두 더한다. 나머지(14일 창·반감기 3일)는 0133 그대로.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0134_search_trending_merge_variants.sql
-- 되돌리기: 0133 재적용.

create or replace function public.search_trend_vowel_variant(a text, b text)
returns boolean
language sql
immutable
set search_path = public
as $FN$
  select length(a) = length(b) and length(a) >= 3 and a <> b and (
    select count(*) filter (where x <> y) = 1
       and bool_and(
         x = y or (
           ascii(x) between 44032 and 55203 and ascii(y) between 44032 and 55203
           and (ascii(x) - 44032) / 588 = (ascii(y) - 44032) / 588        -- 초성 같음
           and (ascii(x) - 44032) % 28 = (ascii(y) - 44032) % 28          -- 종성 같음
           and array[least(((ascii(x) - 44032) % 588) / 28, ((ascii(y) - 44032) % 588) / 28),
                     greatest(((ascii(x) - 44032) % 588) / 28, ((ascii(y) - 44032) % 588) / 28)]
               in (array[1,5], array[3,7], array[5,20], array[6,12], array[8,13],
                   array[10,11], array[10,15], array[11,15], array[19,20], array[5,19])
         ))
    from unnest(string_to_array(a, null), string_to_array(b, null)) as t(x, y)
  );
$FN$;
revoke all on function public.search_trend_vowel_variant(text, text) from public, anon, authenticated;
grant execute on function public.search_trend_vowel_variant(text, text) to service_role;

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
  ),
  cand as materialized (
    select r.w, r.n, r.hot, coalesce(p.n, 0) as pn
    from recent r left join prior p on p.w = r.w
    where r.n >= 2
  ),
  tails as (
    select unnest(array['이','가','을','를','은','는','의','도','에','로','와','과','랑','만','야','아','님',
      '에서','으로','이랑','한테','까지','부터','처럼','보다','이다','이야','이네','인데','님과','님이','님은','님도','님의','이가','이는','이를']) as t
  ),
  stripped as (
    select c.w, left(c.w, length(c.w) - length(t.t)) as b
    from cand c, tails t
    where length(c.w) - length(t.t) >= 2 and right(c.w, length(t.t)) = t.t
  ),
  m1 as (
    select c.w, c.n, c.hot, c.pn,
           coalesce((select s.b from stripped s join cand b on b.w = s.b where s.w = c.w order by length(s.b) limit 1), c.w) as canon
    from cand c
    where not exists (select 1 from stripped s join stop x on x.w = s.b where s.w = c.w)
  ),
  g1 as (
    select canon as w, sum(n) as n, sum(hot) as hot, sum(pn) as pn
    from m1 group by canon having sum(n) >= 3
  ),
  top as materialized (
    select g.w, g.n, g.hot, g.pn from g1 g
    order by g.hot / greatest(1, g.pn * (eff / 180.0)) desc, g.n desc
    limit 200
  ),
  m2 as (
    select a.w, a.n, a.hot, a.pn,
           coalesce((select b.w from top b
                     where public.search_trend_vowel_variant(a.w, b.w) and (b.hot > a.hot or (b.hot = a.hot and b.w < a.w))
                     order by b.hot desc, b.w limit 1), a.w) as canon
    from top a
  ),
  g2 as (
    select canon as w, sum(n) as n, sum(hot) as hot, sum(pn) as pn from m2 group by canon
  )
  select g.w as term, round(g.n)::int as recent,
         round(g.hot / greatest(1, g.pn * (eff / 180.0)), 2) as ratio
  from g2 g
  order by ratio desc, g.n desc
  limit 60;
  get diagnostics n_rows = row_count;
  return n_rows;
end;
$BODY$;
revoke all on function public.search_trending_rebuild(integer) from public, anon, authenticated;
grant execute on function public.search_trending_rebuild(integer) to service_role;
comment on function public.search_trending_rebuild(integer) is
  '화제 칩 캐시 재계산(0133·0134) — 14일 창·반감기 3일 가중, 조사 꼬리·모음 변형 병합. 야간 일괄과 채팅/타임라인 수집 뒤에 불린다.';

select public.search_trending_rebuild();
notify pgrst, 'reload schema';
