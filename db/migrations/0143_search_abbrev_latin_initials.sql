-- 0143: 영문 줄임말은 '머리글자'만(2026-10-10 소유자: "IU라고 쳤는데 왜 AKMU - I Love You가 나오지?").
-- search_abbrev_match(0078)는 질의 글자를 '단어 첫 글자에서 시작해 가까운 범위 안에 차례로 있으면' 줄임말로 본다 —
-- 한글 줄임말(마크 ← 마인크래프트, 프클 ← 프로클럽)에는 맞지만, 영문은 글자 하나하나가 흔해 'iu'가
-- "I love yoU"(i…u)에 걸렸다. 영문·숫자만인 질의는 각 글자가 **단어 첫 글자**여야 한다(ily = I Love You, iu ≠ I Love You).
-- 한글이 섞인 질의는 예전 그대로.
-- 적용: SUPABASE_DB_CA_PATH=.scratch-pw/supabase-ca.crt node scripts/apply-db.mjs db/migrations/0143_search_abbrev_latin_initials.sql

create or replace function public.search_abbrev_match(p_q text, p_text text)
returns boolean
language plpgsql
immutable
parallel safe
as $$
declare
  n text := lower(regexp_replace(coalesce(p_text, ''), '[^가-힣a-zA-Z0-9]+', ' ', 'g'));
  qlen int := length(p_q);
  latin boolean := p_q ~ '^[a-z0-9]+$';
  nlen int;
  start int;
  qi int;
  ti int;
  ch text;
begin
  if qlen < 2 or qlen > 4 then return false; end if;
  if latin then
    -- 머리글자: 단어들의 첫 글자를 이어 붙인 것 안에 질의가 연달아 있어야 한다.
    return position(p_q in (
      select coalesce(string_agg(left(w, 1), '' order by ord), '')
      from regexp_split_to_table(btrim(n), ' +') with ordinality as t(w, ord)
      where w <> ''
    )) > 0;
  end if;
  nlen := length(n);
  for start in 1 .. nlen loop
    -- 단어 첫 음절(문자열 시작이거나 앞이 공백)이고 질의 첫 글자와 같아야 출발점.
    if substr(n, start, 1) <> substr(p_q, 1, 1) then continue; end if;
    if start > 1 and substr(n, start - 1, 1) <> ' ' then continue; end if;
    qi := 2; ti := start + 1;
    while qi <= qlen and ti <= nlen and ti - start <= qlen * 4 + 2 loop
      ch := substr(n, ti, 1);
      if ch = substr(p_q, qi, 1) then qi := qi + 1; end if;
      ti := ti + 1;
    end loop;
    if qi > qlen then return true; end if;
  end loop;
  return false;
end;
$$;
