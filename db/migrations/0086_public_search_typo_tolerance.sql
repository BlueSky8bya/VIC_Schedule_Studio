-- 0086: 시청자 검색 — 일반 오타 허용(한글 자모 유사도) + 사전어 자동 교정.
--
-- 소유자(2026-09-18): 스트리머 이름 말고도 모든 단어의 오타를 알아듣게(영타 shfo→노래는 서버 로더가
-- 두벌식 변환으로 처리: lib/search/hangul.ts). 여기서는 한글 오타:
--   · search_jamo(text): 음절을 초·중·종성 자모열로 푼다("노래" → "ㄴㅗㄹㅐ"). 음절 트라이그램은 한 글자만
--     달라도 거의 안 겹치지만(노레/노래 = 0.2), 자모열 트라이그램은 잘 겹친다(0.6+).
--   · 사전어 교정(did-you-mean): 질의가 동의어·의도 사전에 없고 결과가 빈약할 때, 자모 유사도 ≥ 0.62인
--     가장 가까운 사전어로 확장한다(노레→노래, 배긍→배그, 마인크래프→마인크래프트). 교정어의 동의어·의도가
--     그대로 붙는다. 반환 행에 corrected 컬럼(교정된 말, 없으면 '').
--   · 후보 완화: 라벨·제목의 자모 유사도 ≥ 0.55도 '비슷한 결과'(exact=false)에 든다.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0086_public_search_typo_tolerance.sql

create or replace function public.search_jamo(p text)
returns text
language sql
immutable
parallel safe
as $$
  with cho as (select array['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'] as a),
  jung as (select array['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'] as a),
  jong as (select array['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'] as a)
  select coalesce(string_agg(
    case
      when c >= '가' and c <= '힣' then
        (select a from cho)[((ascii(c) - 44032) / 588) + 1]
        || (select a from jung)[(((ascii(c) - 44032) % 588) / 28) + 1]
        || (select a from jong)[((ascii(c) - 44032) % 28) + 1]
      else c
    end, '' order by ord), '')
  from regexp_split_to_table(public.search_norm(p), '') with ordinality as t(c, ord)
  where c <> '';
$$;

-- 사전어 교정 후보: 동의어 term + 의도 term + 인물 이름 + 게임 이름 중 가장 가까운 것.
-- 거리 = 자모열 편집거리(fuzzystrmatch levenshtein): 2음절 이하 ≤1, 3음절 ≤2, 그 이상 ≤3. 첫 자모는 같아야 한다.
-- 동률이면 자모 트라이그램 유사도가 높은 쪽.
create extension if not exists fuzzystrmatch;
create or replace function public.search_correct(p_qn text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with qj as (select public.search_jamo(p_qn) as j, length(p_qn) as n),
  dict as (
    select term as t from public.search_synonyms
    union select term from public.search_intents
    union select name from public.search_entities where docs >= 3
    union select norm from public.search_games
  ),
  cand as (
    select d.t,
      levenshtein(public.search_jamo(d.t), qj.j) as dist,
      similarity(public.search_jamo(d.t), qj.j) as s
    from dict d, qj
    where d.t <> p_qn
      and length(d.t) between greatest(1, qj.n - 1) and qj.n + 1
      and left(public.search_jamo(d.t), 1) = left(qj.j, 1)
  )
  select t from cand, qj
  where dist <= case when qj.n <= 2 then 1 when qj.n = 3 then 2 else 3 end
  order by dist, s desc, length(t)
  limit 1;
$$;
grant execute on function public.search_correct(text) to anon, authenticated;

-- 챕터 색인에 자모열 저장(질의마다 17,844행 변환은 비싸다).
alter table public.vod_chapter_index add column if not exists label_jamo text not null default '';
update public.vod_chapter_index set label_jamo = public.search_jamo(label) where label_jamo = '';
create index if not exists idx_vod_chapter_jamo_trgm on public.vod_chapter_index using gin (label_jamo gin_trgm_ops);

create or replace function public.vod_chapter_index_rebuild(p_title_no bigint, p_entries jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.vod_chapter_index where title_no = p_title_no;
  insert into public.vod_chapter_index (title_no, sec, label, label_norm, label_cho, label_jamo, section, section_norm, parent, parent_norm, depth)
  select distinct on (p_title_no, x.sec, x.label)
    p_title_no, x.sec, x.label,
    public.search_norm(x.label),
    public.search_choseong(x.label),
    public.search_jamo(x.label),
    x.section,
    public.search_norm(x.section),
    x.parent,
    public.search_norm(x.parent),
    x.depth
  from (
    select
      (e->>'sec')::int as sec,
      e->>'label' as label,
      coalesce(e->>'section', '') as section,
      coalesce((e->>'depth')::int, 0) as depth,
      case when coalesce((e->>'depth')::int, 0) > 0 then
        coalesce((
          select p->>'label'
          from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) with ordinality as q(p, pord)
          where pord < ord and coalesce((p->>'depth')::int, 0) = 0 and length(coalesce(p->>'label', '')) > 0
          order by pord desc limit 1
        ), '')
      else '' end as parent
    from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) with ordinality as t(e, ord)
    where jsonb_typeof(e) = 'object'
      and (e->>'sec') ~ '^[0-9]+$'
      and length(coalesce(e->>'label', '')) > 0
      and length(public.search_norm(e->>'label')) > 0
  ) x;
end;
$$;
