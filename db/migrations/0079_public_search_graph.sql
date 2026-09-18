-- 0079: 시청자 검색 — 방송 은어 사전 보강 + 인물 관계 그래프(자동 채굴 강화) + 관련·트렌딩 제안.
--
-- 소유자(2026-09-18): 숲·스트리머·버튜버 은어에 민감해야 하고, 빅토리(토리)님이 우왁굳(왁굳형)
-- 왁타버스에서 나온 스트리머라 그 관계망을 계속 배워 자동 채굴에 쓰자.
--
-- 1) 사전 보강: search_synonyms_seed()를 숲(뱅온·뱅종·별풍…)·왁타버스(왁굳형·고멤·이세돌·왁물원…)·
--    버튜버(데뷔·졸업·3D…) 은어까지 넓힌다. 인명은 '이름|이름님|본명' 묶음만(멤버십은 그래프가 배운다).
-- 2) 관계 그래프: 다시보기 제목·팬 챕터·공개 일정에서 "○○님"(존칭이 곧 인물 표지 — 이 말뭉치에서
--    토리님 2,475회·왁굳님 445회…)을 뽑아 인물(search_entities)과 같은 방송 공출현 간선
--    (search_relations)을 센다. 간선 가중 = 공출현 방송 수 + 합방 표식(제목에 합방·콜라보·w.·with)
--    이면 한 번 더, PPMI(양의 점별 상호정보량)로 '우연보다 얼마나 자주'를 함께 둔다.
--    차원: 인접행렬(인물 × 인물, PPMI 가중) — 임베딩은 이 행렬의 행이다. 2D 배치는 필요할 때
--    이 행렬에서 뽑는다(지금은 화면 없음).
-- 3) 이름 변형 자동 동의어: 두 인물 이름이 접두/접미 포함 관계(왁굳⊂우왁굳, 세구⊂고세구, 뢴트⊂뢴트게늄)
--    이고 둘 다 자주 나오면 동의어(source='auto-entity'). 검색 "왁굳"이 "우왁굳님" 표기도 찾게.
-- 4) 제안 RPC(공개 안전 — 이름은 공개 제목·챕터에서 온 것):
--    search_related(q): 질의 인물과 함께 자주 나온 인물(구글 'People also search for'·스포티파이 related)
--    search_trending(days): 최근 N일 챕터·제목에 갑자기 많이 나온 말(트위치 '지금 뜨는' 대응)
-- 갱신: search_graph_rebuild()를 이 파일과 타임라인 수집(lib/broadcast/vod-timeline.ts) 뒤에 부른다.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0079_public_search_graph.sql

-- ── 1) 사전 보강 ─────────────────────────────────────────────────────────────
create or replace function public.search_synonyms_seed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  groups text[] := array[
    -- 게임 줄임말
    '배그|배틀그라운드|pubg|battlegrounds',
    '마크|마인크래프트|minecraft',
    '옵치|오버워치|overwatch',
    '롤|리그오브레전드|lol|leagueoflegends',
    '발로|발로란트|valorant',
    '메이플|메이플스토리|maplestory',
    '젤다|젤다의전설|zelda',
    '야숲|야생의숲|브레스오브더와일드|botw',
    '티오킹|티어스오브더킹덤|totk|왕눈',
    '데바데|데드바이데이라이트|dbd',
    '피파|fc온라인|피파온라인|eafc|fc',
    '스타|스타크래프트|starcraft',
    '포켓몬|포켓몬스터|pokemon',
    '명조|명조워더링웨이브|wutheringwaves',
    '로아|로스트아크|lostark',
    '디아|디아블로|diablo',
    '히오스|히어로즈오브더스톰',
    '하스|하스스톤|hearthstone',
    '던파|던전앤파이터',
    '카러플|카트라이더러쉬플러스',
    '카트|카트라이더',
    '모동숲|모여봐요동물의숲|동물의숲|동숲',
    '엘든|엘든링|eldenring',
    '몬헌|몬스터헌터|monsterhunter',
    '리썰|리썰컴퍼니|lethalcompany',
    '스듀|스타듀밸리|stardew',
    '좀보이드|프로젝트좀보이드|zomboid',
    '갈틱|갈틱폰|garticphone',
    '어몽|어몽어스|amongus',
    '할나|할로우나이트|hollowknight',
    '와우|월드오브워크래프트|wow',
    '롤토체스|tft|전략적팀전투',
    '픽크타|픽크로스|피크민',
    '공포겜|공포게임|호러',
    '플스|플레이스테이션|ps5|ps4',
    '닌텐도|스위치|switch',
    -- 방송 형식
    '풀트|풀트래킹|풀트뱅',
    '손캠|손캠방|손캠뱅',
    '휴뱅|휴방|쉬는날|휴식',
    '합방|콜라보|합동방송|w',
    '시참|시청자참여',
    '겜|게임',
    '겜방|게임방송',
    '노래뱅|노래방송|노래|싱스트림',
    '소통뱅|소통방송|소통|잡담|노가리|토크',
    '새벽뱅|새벽방송',
    '종겜|종합게임',
    '엔딩|결말|클리어',
    '빅이봤|영상보기|리액션|영상',
    '리캡|하이라이트|요약',
    '월드컵|이상형월드컵',
    -- 숲(SOOP) 은어
    '뱅온|방송시작|방송켬|방송온',
    '뱅종|방송종료|방종|방송끝',
    '뱅송|방송',
    '별풍|별풍선|도네|후원|도네이션',
    '애드벌룬|애벌',
    '팬치|팬|시청자|팬분',
    '숲|soop|아프리카|아프리카tv',
    '스트리머|bj|방송인',
    '다시보기|vod|다시보기영상',
    -- 왁타버스 관계 은어
    '왁굳|우왁굳|왁굳형|왁굳님',
    '토리|빅토리|토리님|빅토리님',
    '왁타|왁타버스',
    '고멤|고정멤버',
    '고멤아카데미|아카데미|고멤아카',
    '이세돌|이세계아이돌',
    '세구|고세구',
    '버거|징버거',
    '왁물원|팬카페',
    '왁피스|왁타버스원피스',
    '방셀|방셀룰렛',
    -- 버튜버 은어
    '버튜버|브이튜버|vtuber|버추얼|버츄얼',
    '데뷔|첫방|첫방송',
    '졸업|활동종료|은퇴',
    '3d|3d화|3d데뷔',
    '모캡|모션캡쳐|모션캡처'
  ];
  g text[];
  i int; j int; k int;
begin
  delete from public.search_synonyms where source = 'seed';
  for i in 1 .. array_length(groups, 1) loop
    g := array_remove(array(select public.search_norm(x) from unnest(string_to_array(groups[i], '|')) as x), '');
    for j in 1 .. array_length(g, 1) loop
      for k in 1 .. array_length(g, 1) loop
        if j <> k then
          insert into public.search_synonyms (term, alt, source) values (g[j], g[k], 'seed')
          on conflict (term, alt) do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

-- ── 2) 인물·관계 ────────────────────────────────────────────────────────────
create table if not exists public.search_entities (
  name text primary key,          -- 정규화 이름(님 제거)
  display text not null,          -- 가장 흔한 원문 표기
  mentions integer not null default 0, -- 언급 횟수(제목+챕터+일정)
  docs integer not null default 0,     -- 나온 문서(방송/일정) 수
  hapbang integer not null default 0,  -- 합방 표식 문서 수
  first_day date,
  last_day date,
  updated_at timestamptz not null default now()
);
create table if not exists public.search_relations (
  a text not null,
  b text not null,                -- a < b
  co_docs integer not null default 0,  -- 공출현 문서 수
  hapbang integer not null default 0,  -- 그중 합방 표식
  weight numeric not null default 0,   -- co_docs + hapbang
  ppmi numeric not null default 0,     -- max(0, ln(co·N / (da·db)))
  last_day date,
  primary key (a, b)
);
create index if not exists idx_search_relations_b on public.search_relations (b);
alter table public.search_entities enable row level security;
alter table public.search_relations enable row level security;
drop policy if exists search_entities_public_read on public.search_entities;
create policy search_entities_public_read on public.search_entities for select to anon, authenticated using (true);
drop policy if exists search_relations_public_read on public.search_relations;
create policy search_relations_public_read on public.search_relations for select to anon, authenticated using (true);
grant select on public.search_entities, public.search_relations to anon, authenticated;
grant select, insert, update, delete on public.search_entities, public.search_relations to service_role;

-- 인물 후보 추출: "○○님". 존칭 앞말이 인물이 아닌 흔한 말은 뺀다.
create or replace function public.search_person_mentions()
returns table (doc text, day date, is_hap boolean, name text, display text)
language sql
stable
set search_path = public
as $$
  with stop as (
    select unnest(array['여러분','시청자','구독자','팬','팬치','팬분','회원','선생','고객','너희','우리','저희','자기','손','형','누나','언니','오빠','님']) as w
  ),
  raw as (
    -- 다시보기 제목
    select 'v:' || v.title_no as doc, v.broadcast_day as day,
           v.title ~* '합방|콜라보|w\.|with' as is_hap,
           m[1] as disp
    from public.vod_archive v, regexp_matches(v.title, '([가-힣a-zA-Z0-9]{1,8})님', 'g') as m
    where v.auth_no = 101
    union all
    -- 팬 챕터(그 방송 문서에 합침)
    select 'v:' || c.title_no, v.broadcast_day,
           v.title ~* '합방|콜라보|w\.|with',
           m[1]
    from public.vod_chapter_index c
    join public.vod_archive v on v.title_no = c.title_no and v.auth_no = 101,
    regexp_matches(c.label, '([가-힣a-zA-Z0-9]{1,8})님', 'g') as m
    union all
    -- 공개 일정 제목·설명
    select 'e:' || e.id, e.date_key,
           (e.public_title || ' ' || coalesce(e.public_description, '')) ~* '합방|콜라보|w\.|with',
           m[1]
    from public.events e,
    regexp_matches(e.public_title || ' ' || coalesce(e.public_description, ''), '([가-힣a-zA-Z0-9]{1,8})님', 'g') as m
    where e.deleted_at is null and e.visibility_scope = 'public' and e.status <> 'draft'
      and not (coalesce(e.teaser, false) and e.teaser_reveal_at is not null and e.teaser_reveal_at > now())
  )
  select raw.doc, raw.day, raw.is_hap, public.search_norm(raw.disp) as name, raw.disp as display
  from raw
  where length(public.search_norm(raw.disp)) >= 2
    and public.search_norm(raw.disp) not in (select public.search_norm(w) from stop)
    -- 접미가 조사/숫자로 끝나는 잘못된 잘림 완화: 끝 글자가 숫자만인 이름은 뺀다
    and public.search_norm(raw.disp) !~ '^[0-9]+$';
$$;

create or replace function public.search_graph_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n_entities int;
begin
  create temp table tmp_mentions on commit drop as
    select * from public.search_person_mentions();

  -- 인물
  delete from public.search_entities;
  insert into public.search_entities (name, display, mentions, docs, hapbang, first_day, last_day)
  select
    m.name,
    (select display from tmp_mentions x where x.name = m.name group by display order by count(*) desc, display limit 1),
    count(*)::int,
    count(distinct doc)::int,
    count(distinct doc) filter (where is_hap)::int,
    min(day), max(day)
  from tmp_mentions m
  group by m.name
  having count(distinct doc) >= 2;
  get diagnostics n_entities = row_count;

  -- 관계(공출현): 문서 안의 서로 다른 두 인물
  delete from public.search_relations;
  with docs as (
    select doc, day, bool_or(is_hap) as is_hap, array_agg(distinct name) as names
    from tmp_mentions
    where name in (select name from public.search_entities)
    group by doc, day
  ),
  pairs as (
    select least(a, b) as a, greatest(a, b) as b, d.is_hap, d.day
    from docs d, unnest(d.names) a, unnest(d.names) b
    where a < b
  ),
  agg as (
    select a, b, count(*)::int as co_docs, count(*) filter (where is_hap)::int as hap, max(day) as last_day
    from pairs group by a, b
  ),
  n as (select greatest(1, count(distinct doc))::numeric as total from tmp_mentions)
  insert into public.search_relations (a, b, co_docs, hapbang, weight, ppmi, last_day)
  select
    agg.a, agg.b, agg.co_docs, agg.hap,
    (agg.co_docs + agg.hap)::numeric,
    greatest(0, ln((agg.co_docs::numeric * n.total) / (ea.docs::numeric * eb.docs::numeric)))::numeric,
    agg.last_day
  from agg
  join public.search_entities ea on ea.name = agg.a
  join public.search_entities eb on eb.name = agg.b, n;

  -- 이름 변형 → 자동 동의어(접두/접미 포함, 짧은 쪽 2자 이상, 긴 쪽이 자주 나옴)
  delete from public.search_synonyms where source = 'auto-entity';
  insert into public.search_synonyms (term, alt, source, support)
  select s.name, l.name, 'auto-entity', least(s.docs, l.docs)
  from public.search_entities s
  join public.search_entities l
    on l.name <> s.name
   and length(s.name) >= 2
   and length(l.name) > length(s.name)
   and length(l.name) - length(s.name) <= 2
   and (l.name like s.name || '%' or l.name like '%' || s.name)
  where s.docs >= 3 and l.docs >= 3
    and not exists (select 1 from public.search_synonyms x where x.term = s.name and x.alt = l.name)
  union all
  select l.name, s.name, 'auto-entity', least(s.docs, l.docs)
  from public.search_entities s
  join public.search_entities l
    on l.name <> s.name
   and length(s.name) >= 2
   and length(l.name) > length(s.name)
   and length(l.name) - length(s.name) <= 2
   and (l.name like s.name || '%' or l.name like '%' || s.name)
  where s.docs >= 3 and l.docs >= 3
    and not exists (select 1 from public.search_synonyms x where x.term = l.name and x.alt = s.name)
  on conflict (term, alt) do nothing;

  -- 이름 ↔ 이름님: 사용자가 "왁굳님"이라고 쳐도 "왁굳"으로 확장(양방향)
  insert into public.search_synonyms (term, alt, source, support)
  select e.name || '님', e.name, 'auto-entity', e.docs from public.search_entities e
  union all
  select e.name, e.name || '님', 'auto-entity', e.docs from public.search_entities e
  on conflict (term, alt) do nothing;

  return n_entities;
end;
$$;
grant execute on function public.search_graph_rebuild() to service_role;

-- ── 4) 제안 RPC ─────────────────────────────────────────────────────────────
-- 질의 → 인물 매칭(이름 / 이름님 / 동의어) → 함께 자주 나온 인물 상위 N.
create or replace function public.search_related(p_q text, p_limit integer default 8)
returns table (name text, display text, co_docs integer, hapbang integer, score numeric)
language sql
stable
security definer
set search_path = public
as $$
  with q as (
    select public.search_norm(p_q) as qn
  ),
  me as (
    select e.name
    from public.search_entities e, q
    where e.name = q.qn or e.name || '님' = q.qn
       or e.name in (select s.alt from public.search_synonyms s where s.term = q.qn)
    order by e.docs desc
    limit 1
  )
  select
    case when r.a = me.name then r.b else r.a end as name,
    e.display,
    r.co_docs,
    r.hapbang,
    round((r.ppmi * ln(1 + r.co_docs) + r.hapbang * 0.5)::numeric, 3) as score
  from me
  join public.search_relations r on r.a = me.name or r.b = me.name
  join public.search_entities e on e.name = case when r.a = me.name then r.b else r.a end
  where r.co_docs >= 2
  order by score desc, r.co_docs desc
  limit greatest(1, least(coalesce(p_limit, 8), 30));
$$;
grant execute on function public.search_related(text, integer) to anon, authenticated;

-- 최근 N일에 '갑자기 많이 나온 말' — 챕터·제목 단어(한글 2~6자). 이전 180일 대비 비율.
create or replace function public.search_trending(p_days integer default 30, p_limit integer default 10)
returns table (term text, recent integer, ratio numeric)
language sql
stable
security definer
set search_path = public
as $$
  with docs as (
    select v.broadcast_day as day, v.title as txt from public.vod_archive v where v.auth_no = 101
    union all
    select v.broadcast_day, c.label from public.vod_chapter_index c join public.vod_archive v on v.title_no = c.title_no and v.auth_no = 101
  ),
  words as (
    select day, lower(x) as w
    from docs, regexp_split_to_table(txt, '[^가-힣a-zA-Z0-9]+') as x
    where x ~ '^[가-힣]{2,6}$'
  ),
  stop as (
    select unnest(array['토리님','토리','빅토리','빅토리님','방송','시작','종료','오늘','내일','시간','잠깐','다시','이야기','토리가','우리','그냥','정말','진짜','후열','엔딩','멘트','휴식','시청자','새로운','요즘','오늘도','이번','다음','처음','마지막','드디어','바로']) as w
  ),
  recent as (
    select w, count(*)::int as n from words
    where day >= current_date - make_interval(days => greatest(1, coalesce(p_days, 30)))
      and w not in (select w from stop)
    group by w
  ),
  prior as (
    select w, count(*)::numeric as n from words
    where day < current_date - make_interval(days => greatest(1, coalesce(p_days, 30)))
      and day >= current_date - make_interval(days => greatest(1, coalesce(p_days, 30)) + 180)
    group by w
  )
  select r.w as term, r.n as recent,
         round((r.n::numeric / greatest(1, coalesce(p.n, 0) * (greatest(1, coalesce(p_days, 30))::numeric / 180.0)))::numeric, 2) as ratio
  from recent r
  left join prior p on p.w = r.w
  where r.n >= 3
  order by ratio desc, r.n desc
  limit greatest(1, least(coalesce(p_limit, 10), 30));
$$;
grant execute on function public.search_trending(integer, integer) to anon, authenticated;

-- 실행
select public.search_synonyms_seed();
select public.search_graph_rebuild();
select public.search_synonyms_rebuild();
