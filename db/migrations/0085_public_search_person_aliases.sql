-- 0085: 시청자 검색 — 스트리머 별칭 사전(풀네임 ↔ 줄임 ↔ 흔한 오타).
--
-- 소유자(2026-09-18): 프리터 = 아르바 = 바이터, 불독 = (보디가드) 불곰, 쵸로키 = 데스헤머 쵸로키(초로키로
-- 잘못 써도), 시리안 = 시리안 레인 … 같은 사람. 풀네임·줄임말을 기록해 검색어에 잘 나오게.
-- 출처: 소유자 제공 + 왁타버스 공개 활동명(고정멤버·아카데미·이세돌) + 이 말뭉치의 인물 그래프(0079).
-- 같은 사람은 kind='syn'(동의어, 정확 적중 보너스). 오타 변형은 자동 생성(쵸↔초, 쟈↔자, 챠↔차, 셔↔서,
-- 쥬↔주, 캐↔케, 럴↔롤 등 이중모음·유사 자모)으로 모든 인물 이름에 적용한다.
-- 잘못된 짝이 있으면 이 파일의 목록 한 줄만 고치면 된다.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0085_public_search_person_aliases.sql

create or replace function public.search_person_alias_seed()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  groups text[] := array[
    -- 소유자 제공
    '프리터|아르바|바이터|아르바이터',
    '불독|불곰|보디가드불곰|보디가드 불곰',
    '쵸로키|데스헤머쵸로키|데스헤머 쵸로키|데스헤머|초로키|쵸록',
    '시리안|시리안레인|시리안 레인|시리안님',
    -- 빅토리
    '토리|빅토리|토리님|빅토리님|빅토|토리야',
    -- 우왁굳·이세돌
    '왁굳|우왁굳|왁굳형|왁굳님|왁굳이형',
    '아이네|아이네님|이네',
    '징버거|버거|징버거님|버거님|버거씨',
    '릴파|릴파님|릴파쨩',
    '주르르|르르|주르르님|르르님',
    '고세구|세구|세구님|고세구님',
    '비챤|챤|비챤님|챤님',
    -- 고정멤버·아카데미(공개 활동명)
    '뢴트게늄|뢴트|뢴트님|뢴트게늄님',
    '비밀소녀|비소|비소님|비밀소녀님',
    '천양|천양님',
    '해루석|루석|루석님|해루석님',
    '미미짱짱세용|세용|세용님|미미짱짱세용님',
    '캘리칼리데이비슨|캘리|캘리님|캘리칼리',
    '왁파고|왁파고님',
    '독고혜지|혜지|혜지님|독고혜지님',
    '도파민박사|도파민|도파민님',
    '곽춘식|춘식|춘식님|곽춘식님',
    '권민|권민님',
    '김치만두번영택사스가|김치만두|만두|김치만두님',
    '단답벌레|단답|단답님',
    '부정형인간|부정형|부정형님',
    '비즈니스킴|비킴|비킴님|비즈니스킴님',
    '이덕수할아바이|이덕수|이덕수님|덕수',
    '진희|진희님',
    '하쿠0089|하쿠|하쿠님',
    '히키킹|히키킹님|히키',
    '아마추어최|아마최|아마최님',
    '마이곰이|곰이|곰이님|마이곰이님',
    '닌닌|닌닌님',
    '로마니|로마니님',
    '카르나르융터르|융터르|융터르님|카르나르',
    '소피아|소피아님',
    '샬롯|샬롯님',
    '타요|타요님|아바타요',
    '루딘|루딘님',
    '로즈|로즈님',
    '버터우스|버터우스님|버터',
    '길버트|길버트님',
    '드라구노프|드라구노프님|드라',
    '머독|머독님',
    '뽀린걸|뽀린걸님|뽀린',
    '봉준|봉준님',
    '진솔|진솔님',
    '여르미|여르미님',
    '예다|예다님',
    '빕어|빕어님',
    '진호|진호님',
    '난워니|난워니님|워니',
    '수셈이|셈이|셈이님|수셈이님',
    '양도끼|양도끼님',
    '티파니|티파니님',
    '마왕|마왕님',
    '상득|상득님',
    '빙밍|빙밍님',
    '감블러|감블러님',
    '설리반|설리반님',
    '조디악|조디악님',
    '제갈금자|금자|금자님|제갈금자님',
    '세노|세노님',
    '감스트|감스트님',
    '께끼|께끼님',
    '깐숙|깐숙님',
    '하로하|하로하님',
    '비몽|비몽님',
    '단즈|단즈님',
    '한결|한결님',
    '마다옴|마다옴님',
    '나나문|나나문님',
    '또오냥|또오냥님',
    '챈나|챈나님',
    '젠투|젠투님',
    '고봉|고봉님',
    '유샥크|유샥크님',
    '빔밥|빔밥님'
  ];
  g text[];
  i int; j int; k int;
begin
  delete from public.search_synonyms where source = 'seed-person';
  for i in 1 .. array_length(groups, 1) loop
    g := array_remove(array(select distinct public.search_norm(x) from unnest(string_to_array(groups[i], '|')) as x), '');
    for j in 1 .. array_length(g, 1) loop
      for k in 1 .. array_length(g, 1) loop
        if j <> k then
          insert into public.search_synonyms (term, alt, source, kind) values (g[j], g[k], 'seed-person', 'syn')
          on conflict (term, alt) do nothing;
        end if;
      end loop;
    end loop;
  end loop;
end;
$$;

-- 흔한 오타 변형: 이중모음·유사 자모를 바꾼 이름도 같은 사람으로(쵸로키→초로키, 샬롯→샬럿, 캘리→켈리).
-- 인물 그래프(0079)의 이름 + 위 시드의 이름 전부에 적용. 변형이 다른 실제 이름과 겹치면 넣지 않는다.
create or replace function public.search_person_typo_variants(p text)
returns setof text
language sql
immutable
parallel safe
as $$
  with pairs as (
    select * from (values
      ('쵸','초'),('쟈','자'),('챠','차'),('셔','서'),('쥬','주'),('죠','조'),('뎌','더'),('텨','터'),
      ('캐','케'),('개','게'),('래','레'),('내','네'),('매','메'),('배','베'),('새','세'),('애','에'),('재','제'),('채','체'),('패','페'),('해','헤'),
      ('롯','럿'),('릴','릴'),('럴','롤'),('뤼','리'),('퀴','키'),('쉬','시'),('휘','히')
    ) as v(a, b)
  )
  select distinct replace(p, a, b) from pairs where position(a in p) > 0 and replace(p, a, b) <> p
  union
  select distinct replace(p, b, a) from pairs where position(b in p) > 0 and replace(p, b, a) <> p;
$$;

create or replace function public.search_person_typos_rebuild()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  delete from public.search_synonyms where source = 'auto-typo';
  with names as (
    select name from public.search_entities where docs >= 3
    union
    select term from public.search_synonyms where source = 'seed-person'
  ),
  vars as (
    select n.name, v as typo
    from names n
    cross join lateral public.search_person_typo_variants(n.name) v
    where length(n.name) >= 2
      and not exists (select 1 from names x where x.name = v)          -- 다른 실제 이름과 겹치면 제외
      and not exists (select 1 from public.search_synonyms s where s.term = v) -- 이미 사전에 있는 말도 제외
  )
  insert into public.search_synonyms (term, alt, source, kind, support)
  select typo, name, 'auto-typo', 'syn', 0 from vars
  on conflict (term, alt) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.search_person_typos_rebuild() to service_role;

select public.search_person_alias_seed();
select public.search_person_typos_rebuild();
