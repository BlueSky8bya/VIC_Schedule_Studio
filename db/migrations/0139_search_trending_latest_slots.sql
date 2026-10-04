-- 0139: 화제 칩 — 가장 최근 방송 몫 1~2자리(소유자 2026-10-05).
-- 10/1 1주년 방송 화력이 커서 그 뒤 10/4 방송(마크 그냥서버·빅이봤)의 말이 칩에 하나도 안 떴다. 반감기를 줄이면
-- 최신 것만 뜨므로 점수 체계(0133~0135)는 그대로 두고, **가장 최근 방송**의 새 말을 4·6번째 자리에 끼운다.
--   · 대상 방송 = 오늘(KST) 이전·7일 안의 마지막 방송일. 그날 다시보기 **채팅 분석이 전부 끝난 뒤에만**(vod_chat_job.complete).
--   · 후보 = 그날 다시보기 제목·팬 챕터·공개 일정 글의 말(+같은 날 채팅 횟수). 점수 = 제목 6 + 일정 6 + 챕터 2×(최대 3)
--     + 채팅 1.5×(회당 30 상한)을, 그 전 180일 쓰임으로 나눈다(1 + prior/20) — 늘 쓰는 말(게임·소통·마크)은 밀린다.
--   · 말 꼴은 화제 칩과 같은 규칙: '님' 떼기, 용언 꼬리(입주합니다 → 입주), 조사 꼬리(빅토리로 → 빅토리 → 불용어로 버림).
--   · 이미 고른 말·상위 8에 있는 그날 말과 **같은 글에만** 나온 말은 건너뛴다(그냥서버·입주 = 같은 제목 한 덩이).
--   · '그날의 새 말' = 직전 14일 쓰임이 그날 몫보다 작은 말(10/1에 뜨던 뉴토리는 10/4 챕터에 나와도 아님).
--   · 그날의 새 말이 이미 상위 8에 2개 이상이면 끼우지 않고, 1개면 1자리만. 자리는 ratio를 3·4번 사이, 4·5번 사이 값으로 둬
--     읽는 쪽(search_trending: ratio 순)은 그대로다.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0139_search_trending_latest_slots.sql  (되돌리기: 0135 재적용)

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
  lday date;                                           -- (0139) 가장 최근 방송일
  have int;                                            -- 그날 말이 이미 상위 8에 몇 개
  want int;                                            -- 끼울 자리 수
  r3 numeric; r4 numeric; r5 numeric;                  -- 끼울 자리 앞뒤 ratio
  first_docs text[];                                   -- 이미 자리 잡은 그날 말들이 나온 글
  pick record;
  slot int := 0;
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
  -- 용언·인용 꼬리(0135): '빗토리된다' → '빗토리'. 두 글자 이상 꼬리라 조사보다 안전하므로 몸통이 후보가 아니어도
  -- **어딘가에 실제로 쓰인 말**(문서 어휘·사전 또는 채팅 단어)이면 몸통으로 바꾼다.
  vtails as (
    select unnest(array['된다','한다','했다','됐다','하다','되다','라고','이라고','합니다','됩니다','했어','됐어','해요','돼요',
      '하네','되네','했네','됐네','하자','한대','된대','하는','되는','하면','되면','해서','돼서','하고','되고']) as t
  ),
  vstripped as materialized (
    select c.w, left(c.w, length(c.w) - length(t.t)) as b
    from cand c, vtails t
    where length(c.w) - length(t.t) >= 2 and right(c.w, length(t.t)) = t.t
  ),
  vstem as (
    select s.w, s.b from vstripped s
    where s.b in (select w from cand) or s.b in (select w from known)
       or exists (select 1 from public.vod_chat_terms ct where ct.term = s.b)
  ),
  m1 as (
    select c.w, c.n, c.hot, c.pn,
           coalesce(
             (select s.b from stripped s join cand b on b.w = s.b where s.w = c.w order by length(s.b) limit 1),
             (select s.b from vstem s where s.w = c.w order by length(s.b) limit 1),
             c.w) as canon
    from cand c
    where not exists (select 1 from stripped s join stop x on x.w = s.b where s.w = c.w)
      and not exists (select 1 from vstripped s join stop x on x.w = s.b where s.w = c.w)
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

  -- ── (0139) 가장 최근 방송 몫 1~2자리 ─────────────────────────────────────────
  select max(v.broadcast_day) into lday
  from public.vod_archive v
  where v.auth_no = 101 and v.broadcast_day <= today;
  if lday is null or lday <= today - 7 then
    return n_rows;
  end if;
  -- 채팅 분석이 그날 다시보기 전부에서 끝나야 한다(분석 중이면 다음 재계산 때).
  if exists (
    select 1 from public.vod_archive v
    left join public.vod_chat_job j on j.title_no = v.title_no
    where v.auth_no = 101 and v.broadcast_day = lday and not coalesce(j.complete, false)
  ) then
    return n_rows;
  end if;

  drop table if exists tmp_fresh;
  create temp table tmp_fresh on commit drop as
  with ldocs as (
    select 'v' || v.title_no as doc, 'title' as kind, v.title as txt
    from public.vod_archive v where v.auth_no = 101 and v.broadcast_day = lday
    union all
    select 'c' || c.title_no || ':' || c.sec, 'chapter', c.label
    from public.vod_chapter_index c join public.vod_archive v on v.title_no = c.title_no and v.auth_no = 101
    where v.broadcast_day = lday
    union all
    select 'e' || e.id, 'event', e.public_title || ' ' || coalesce(e.public_description, '')
    from public.events e
    where e.deleted_at is null and e.visibility_scope = 'public' and e.status <> 'draft' and e.date_key = lday
      and not (coalesce(e.teaser, false) and e.teaser_reveal_at is not null and e.teaser_reveal_at > now())
  ),
  raw as (
    select distinct d.doc, d.kind, regexp_replace(lower(x), '님$', '') as w
    from ldocs d, regexp_split_to_table(d.txt, '[^가-힣a-zA-Z0-9]+') as x
    where x ~ '^[가-힣]{2,6}$'
  ),
  stop as (
    select unnest(array['토리님','토리','빅토리','빅토리님','방송','시작','종료','오늘','내일','시간','잠깐','다시','이야기','토리가','우리','그냥',
      '정말','진짜','후열','엔딩','멘트','휴식','시청자','새로운','요즘','오늘도','이번','다음','처음','마지막','드디어','바로','하루','게임','소통',
      '등장','반응','후기','인사','방종인사','시점','받은','오늘부터','영원한','보고','보기','해보기','하기','정리','강화']) as w
  ),
  -- 꼴 규칙의 '몸통이 실제 말' 판정에 불용어도 넣는다 — '빅토리로'의 몸통 '빅토리'는 어휘표에 없어 안 떼어졌다.
  vocab as (
    select w from raw union select term from public.search_terms union select w from stop
  ),
  -- 화제 칩과 같은 꼴 규칙: 용언 꼬리(입주합니다 → 입주) 먼저, 그다음 조사 꼬리(빅토리로 → 빅토리). 몸통이 실제 말일 때만.
  canon as (
    select r.doc, r.kind, r.w,
      coalesce(
        (select left(r.w, length(r.w) - length(t)) from unnest(array['된다','한다','했다','됐다','하다','되다','라고','이라고','합니다','됩니다',
           '했어','됐어','해요','돼요','하네','되네','했네','됐네','하자','한대','된대','하는','되는','하면','되면','해서','돼서','하고','되고',
           '하기','해보기','보기','해보나','해보자']) as t
         where length(r.w) - length(t) >= 2 and right(r.w, length(t)) = t
           and left(r.w, length(r.w) - length(t)) in (select w from vocab)
         order by length(t) desc limit 1),
        (select left(r.w, length(r.w) - length(t)) from unnest(array['이','가','을','를','은','는','의','도','에','로','와','과','랑','만','야','아',
           '에서','으로','이랑','한테','까지','부터','처럼','보다','이다','이야','이네','인데','이가','이는','이를']) as t
         where length(r.w) - length(t) >= 2 and right(r.w, length(t)) = t
           and left(r.w, length(r.w) - length(t)) in (select w from vocab)
         order by length(t) desc limit 1),
        r.w) as c
    from raw r
  ),
  dw as (
    select c as w,
      6 * max(case when kind = 'title' then 1 else 0 end)
      + 6 * max(case when kind = 'event' then 1 else 0 end)
      + 2 * least(count(*) filter (where kind = 'chapter'), 3) as ds,
      array_agg(distinct doc) as docs
    from canon
    where c not in (select w from stop) and length(c) >= 2
    group by c
  ),
  lchat as (
    select t.term as w, sum(least(t.cnt, 30))::numeric as cn
    from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no = 101
    where v.broadcast_day = lday group by 1
  ),
  prior as (
    -- n = 그 전 180일 쓰임(늘 쓰는 말 눌러 주기), n14 = 그 전 14일 쓰임(이미 직전 방송에서 뜨던 말 가려내기).
    select w, sum(n) as n, sum(n) filter (where bd >= lday - 14) as n14 from (
      select regexp_replace(lower(x), '님$', '') as w, 1::numeric as n, dd.bd
      from (
        select v.title as txt, v.broadcast_day as bd from public.vod_archive v where v.auth_no = 101
        union all
        select c.label, v.broadcast_day from public.vod_chapter_index c join public.vod_archive v on v.title_no = c.title_no and v.auth_no = 101
      ) dd, regexp_split_to_table(dd.txt, '[^가-힣a-zA-Z0-9]+') as x
      where dd.bd < lday and dd.bd >= lday - 180 and x ~ '^[가-힣]{2,6}$'
      union all
      select t.term, least(t.cnt, 30)::numeric, v.broadcast_day as bd
      from public.vod_chat_terms t join public.vod_archive v on v.title_no = t.title_no and v.auth_no = 101
      where v.broadcast_day < lday and v.broadcast_day >= lday - 180
    ) z group by w
  )
  select d.w, d.docs, round(d.ds + coalesce(c.cn, 0))::int as recent,
         -- 그날의 새 말 = 직전 14일 쓰임이 그날 몫보다 작다(뉴토리처럼 10/1에 뜨던 말은 10/4 챕터에 나와도 아니다).
         coalesce(p.n14, 0) < d.ds + coalesce(c.cn, 0) as is_new,
         (d.ds + 1.5 * coalesce(c.cn, 0)) / (1 + coalesce(p.n, 0) / 20.0) as score
  from dw d
  left join lchat c on c.w = d.w
  left join prior p on p.w = d.w
  where d.ds + 1.5 * coalesce(c.cn, 0) >= 6;

  -- 그날의 새 말이 이미 상위 8에 몇 개 있나(있으면 그만큼 덜 끼운다).
  select count(*) into have
  from (select term from public.search_trends order by ratio desc, recent desc limit 8) t
  where t.term in (select w from tmp_fresh where is_new);
  want := greatest(0, 2 - have);
  if want = 0 then
    return n_rows;
  end if;

  select ratio into r3 from public.search_trends order by ratio desc, recent desc offset 2 limit 1;
  select ratio into r4 from public.search_trends order by ratio desc, recent desc offset 3 limit 1;
  select ratio into r5 from public.search_trends order by ratio desc, recent desc offset 4 limit 1;
  if r5 is null then
    return n_rows; -- 칩이 몇 개 안 되면 끼울 필요 없다(전부 보인다)
  end if;

  -- 이미 상위 8에 있는 그날의 새 말이 나온 글 — 같은 글에만 나오는 말은 같은 이야기라 또 끼우지 않는다.
  select array_agg(distinct x) into first_docs
  from tmp_fresh f, unnest(f.docs) as x
  where f.is_new and f.w in (select term from (select term from public.search_trends order by ratio desc, recent desc limit 8) t8);

  for pick in
    select f.w, f.recent, f.docs from tmp_fresh f
    where f.is_new
      and f.w not in (select term from (select term from public.search_trends order by ratio desc, recent desc limit 8) t8)
    order by f.score desc, f.w
  loop
    exit when slot >= want;
    -- 이미 고른(또는 상위 8에 있던) 말과 같은 글에만 나온 말이면 건너뛴다(그냥서버·입주 = 같은 제목 한 덩이).
    if first_docs is not null and pick.docs <@ first_docs then
      continue;
    end if;
    first_docs := coalesce(first_docs, '{}') || pick.docs;
    delete from public.search_trends where term = pick.w;
    insert into public.search_trends (term, recent, ratio)
    values (pick.w, pick.recent, case when slot = 0 then round((r3 + r4) / 2, 2) else round((r4 + r5) / 2, 2) end);
    slot := slot + 1;
  end loop;
  return n_rows;
end;
$BODY$;
revoke all on function public.search_trending_rebuild(integer) from public, anon, authenticated;
grant execute on function public.search_trending_rebuild(integer) to service_role;
comment on function public.search_trending_rebuild(integer) is
  '화제 칩 캐시 재계산(0133~0135, 0139) — 14일 창·반감기 3일 가중, 조사·용언 꼬리·모음 변형 병합 + 가장 최근 방송(채팅 분석 끝) 몫 4·6번째 자리. 야간 일괄과 채팅/타임라인 수집 뒤에 불린다.';

select public.search_trending_rebuild();
notify pgrst, 'reload schema';
