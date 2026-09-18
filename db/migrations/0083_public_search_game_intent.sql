-- 0083: 시청자 검색 — '종겜' 의도: 실제로 종합게임(메이저가 아닌 게임)을 플레이한 방송·구간이 전부 나온다.
--
-- 소유자(2026-09-18): 종겜 = 롤·마크·배그·아르마·옵치 같은 메이저 게임이 아닌, 패키지·스팀·자잘한
-- 게임들(퀄리티·플레이타임 기준 아님). 그래서 두 사전:
--   · 게임 목록 search_games — 이 방송 말뭉치에서 배운다: 팬 타임라인 코너 "게임 - X" / 게임 이름 코너
--     (메이플스토리·명조·Hollow Knight…) + 큐레이션 종겜 이름(젤다·포켓몬·슬더스·8번출구…).
--   · 메이저 사전 — 소유자 정의를 따른 고정 목록(롤·마크·배그·아르마·옵치·발로·메이플·FC·스타·와우·
--     롤토체스·카트·던파·로아·디아·히오스·하스·검사·서든·마비노기·명조·원신·명방·VR챗). 나머지 = 종겜.
-- 색인: 챕터마다 game_norm(코너의 게임)·is_section_start(그 코너의 첫 항목). 다시보기·일정은 제목에서.
-- 의도 사전: 종겜·종합게임·종겜뱅·종겜러·스팀겜·패키지게임·인디겜 → minor_game.
-- RPC: 의도면 종겜 코너 시작점(챕터)·종겜 제목 다시보기·일정을 최상위(2.8). 의도 외 토큰으로 좁힘.
-- 멱등. 적용: node scripts/apply-db.mjs db/migrations/0083_public_search_game_intent.sql

alter table public.vod_chapter_index add column if not exists game_norm text not null default '';
alter table public.vod_chapter_index add column if not exists is_section_start boolean not null default false;
create index if not exists idx_vod_chapter_game on public.vod_chapter_index (game_norm) where game_norm <> '';

create table if not exists public.search_games (
  norm text primary key,
  display text not null,
  docs integer not null default 0,
  kind text not null default 'minor', -- major | minor
  source text not null default 'auto' -- auto | seed
);
alter table public.search_games enable row level security;
drop policy if exists search_games_public_read on public.search_games;
create policy search_games_public_read on public.search_games for select to anon, authenticated using (true);
grant select on public.search_games to anon, authenticated;
grant select, insert, update, delete on public.search_games to service_role;

insert into public.search_intents (term, intent)
select public.search_norm(t), 'minor_game' from unnest(array[
  '종겜','종합게임','종겜뱅','종겜러','종겜스','종합겜','스팀겜','스팀게임','패키지게임','패키지겜','인디겜','인디게임','신작겜','신작게임','겜찍먹','찍먹'
]) as t
on conflict (term) do update set intent = excluded.intent;

-- 메이저 판정: 정규화 이름(공백 없음)에 메이저 게임 이름이 들어 있으면 메이저. 짧은 줄임말은 맨 앞일 때만.
-- VR챗·릴동파(왁타버스 행사)는 게임이 아니라 무대라 '종겜'에서 뺀다.
create or replace function public.search_game_is_major(p_norm text)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(p_norm, '') ~ '(롤토체스|리그오브레전드|leagueoflegends|마인크래프트|minecraft|배틀그라운드|pubg|아르마|arma|오버워치|overwatch|발로란트|valorant|메이플|maplestory|fc2[0-9]|fc온라인|피파|스타크래프트|starcraft|월드오브워크래프트|카트라이더|던전앤파이터|로스트아크|디아블로|히어로즈오브더스톰|하스스톤|검은사막|서든어택|마비노기|명조|워더링웨이브|원신|명일방주|엔드필드|vrchat|vr챗|vrc|릴동파|왁타버스)'
    or coalesce(p_norm, '') ~ '^(롤|마크|배그|와우|옵치|발로|피파|로아|던파|vr)';
$$;

-- 코너 이름 → 게임 이름 후보(없으면 null). "게임 - X"는 항상 게임. 그 외 코너는 비게임 어휘가 없을 때만 후보이고
-- 최종 등재는 refresh가 '2방송 이상 또는 사전 등재' 조건으로 거른다.
create or replace function public.search_game_from_section(p_section text)
returns text
language sql
immutable
parallel safe
as $$
  with s as (
    select
      p_section ~ '^\s*게임\s*[-–—:]' as explicit,
      trim(regexp_replace(regexp_replace(regexp_replace(coalesce(p_section, ''),
        '^\s*게임\s*[-–—:]\s*', ''),
        '\s*(w\.|with|ft\.|feat\.).*$', '', 'i'),
        '\s*[\(（].*$', '')) as name
  )
  select case
    when s.name = '' then null
    when length(s.name) < 2 or length(s.name) > 40 then null
    when s.explicit then s.name
    when s.name ~* '소통|빅이봤|노래|래뱅|뱅종|방종|합방|월드컵|풀트|잡담|후열|시작|종료|엔딩|멘트|인사|보기|테스트|라운드|[0-9]+강$|댄스|dance|춤|연습|모임|생일|폐막|개막|구경|밥|먹방|토크|리캡|하이라이트|공지|휴식|잠깐|퀴즈|룰렛|대회|^op$|오프닝|의상|소개|타이틀|컨텐츠|사진|손캠|촉각|반응|모음|탐라|미니게임|여름나기|겨울나기|랭킹|medley|입학식|졸업식|왁네티|릴동파|캠퍼스|대학교|고멤|아카데미|여고|여교|체육|운동회|시상|파티|모임|스터디|면접|회의|방셀|주간|일차$' then null
    else s.name
  end
  from s;
$$;

create or replace function public.search_game_refresh()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  -- 0) 큐레이션 종겜 이름(먼저 — 아래 자동 등재의 '사전에 있음' 조건에 쓴다)
  insert into public.search_games (norm, display, docs, kind, source)
  select public.search_norm(t), t, 0, 'minor', 'seed' from unnest(array[
    '젤다의 전설','젤다','야숲','티오킹','포켓몬','포켓몬스터','몬스터헌터','몬헌','엘든링','다크소울','할로우나이트','실크송',
    '슬레이 더 스파이어','슬더스','마스터듀얼','스탠리 패러블','8번출구','Five Nights at Freddy''s','FNAF','BABA IS YOU',
    'A Dance of Fire and Ice','얼불춤','CATO','푸하하','리썰컴퍼니','팰월드','스타듀밸리','좀보이드','테라리아','폴가이즈',
    '어몽어스','갈틱폰','구스구스덕','프랫폴','철권','스트리트파이터','컵헤드','언더테일','데이브 더 다이버','피크민',
    '마리오카트','마리오','동물의숲','모동숲','스플래툰','젤다 야생의 숲','디스코 엘리시움','발더스 게이트','사이버펑크',
    'GTA','레드데드','문명','림월드','팩토리오','새티스팩토리','데바데','데드바이데이라이트','피닉스 라이트','역전재판',
    '킹덤하츠','파이널판타지','페르소나','메타포','드래곤퀘스트','옥토패스','유니콘 오버로드','슈퍼마리오','카타마리',
    '하데스','데스티니','고스트러너','셀레스테','핫라인 마이애미','인사이드','림보','리틀 나이트메어','It Takes Two',
    '스플릿 픽션','오버쿡드','문어아빠','휴먼폴플랫','겟팅오버잇','온리업','치킨호러','The Exit 8','Lethal Company','Palworld',
    '마추기io','IQ 테스트','FoodStars','IRacing','How to Fish','Goose Goose Duck','Gartic Phone','Silksong','Hollow Knight'
  ]) as t
  on conflict (norm) do nothing;

  -- 1) 게임 목록: 코너에서 배운 것 + 큐레이션 종겜 이름
  delete from public.search_games where source = 'auto';
  insert into public.search_games (norm, display, docs, kind, source)
  select public.search_norm(g.name), min(g.name), count(distinct g.title_no)::int,
         case when public.search_game_is_major(public.search_norm(g.name)) then 'major' else 'minor' end, 'auto'
  from (
    select c.title_no, public.search_game_from_section(c.section) as name,
           c.section ~ '^\s*게임\s*[-–—:]' as explicit
    from public.vod_chapter_index c
    where c.section <> ''
  ) g
  where g.name is not null and length(public.search_norm(g.name)) >= 2
  group by public.search_norm(g.name)
  -- "게임 - X"로 적힌 것은 1회여도 게임. 그 외 코너 이름은 2방송 이상이거나 큐레이션 목록에 있을 때만.
  having bool_or(g.explicit) or count(distinct g.title_no) >= 2
      or exists (select 1 from public.search_games sg where sg.source = 'seed' and sg.norm = public.search_norm(min(g.name)))
  on conflict (norm) do update set docs = excluded.docs, display = excluded.display;


  -- 2) 챕터 색인: 코너의 게임 + 코너 시작 항목
  update public.vod_chapter_index c
  set game_norm = coalesce(x.gn, ''),
      is_section_start = x.first_sec = c.sec
  from (
    select c2.title_no, c2.section,
      (select g.norm from public.search_games g where g.norm = public.search_norm(public.search_game_from_section(c2.section)) limit 1) as gn,
      min(c2.sec) as first_sec
    from public.vod_chapter_index c2
    where c2.section <> ''
    group by c2.title_no, c2.section
  ) x
  where x.title_no = c.title_no and x.section = c.section
    and (c.game_norm <> coalesce(x.gn, '') or c.is_section_start <> (x.first_sec = c.sec));
  get diagnostics n = row_count;
  return n;
end;
$$;
grant execute on function public.search_game_refresh() to service_role;
select public.search_game_refresh();

-- 검색 RPC: minor_game 의도.
drop function if exists public.search_public(uuid, text, integer);
create function public.search_public(p_calendar_id uuid, p_q text, p_limit integer default 50)
returns table (
  kind text,
  event_id uuid,
  title_no bigint,
  sec integer,
  date_key date,
  start_time time,
  title text,
  snippet text,
  duration_ms bigint,
  host_nick text,
  score numeric,
  exact boolean,
  popularity numeric,
  section text,
  parent text,
  matched_on text
)
language sql
stable
security definer
set search_path = public
as $$
  with q0 as (
    select
      public.search_norm(p_q) as qn,
      public.search_norm(p_q) ~ '^[ㄱ-ㅎ]+$' as is_cho,
      (length(public.search_norm(p_q)) >= 2
        or exists (select 1 from public.search_synonyms s where s.term = public.search_norm(p_q))) as min_ok,
      array_remove(array(
        select public.search_norm(t) from regexp_split_to_table(coalesce(p_q, ''), '\s+') as t
        where length(public.search_norm(t)) >= 2
           or exists (select 1 from public.search_synonyms s where s.term = public.search_norm(t))
      ), '') as toks
  ),
  q1 as (
    select
      q0.qn, q0.is_cho, q0.toks, q0.min_ok,
      case when q0.is_cho then array[q0.qn]
           when length(q0.qn) = 1 then array(select s.alt from public.search_synonyms s where s.term = q0.qn and s.kind = 'syn')
           else array_prepend(q0.qn, array(select s.alt from public.search_synonyms s where s.term = q0.qn and s.kind = 'syn')) end as alts,
      case when q0.is_cho then array[]::text[]
           else array(select s.alt from public.search_synonyms s where s.term = q0.qn and s.kind = 'rel') end as rels,
      case when q0.is_cho then q0.toks
           else array(
             select t.tok || coalesce('|' || string_agg(s.alt, '|'), '')
             from unnest(q0.toks) with ordinality as t(tok, ord)
             left join public.search_synonyms s on s.term = t.tok and s.kind = 'syn'
             group by t.tok, t.ord order by t.ord
           ) end as tokg,
      (not q0.is_cho and (
        exists (select 1 from public.search_intents i where i.intent = 'song' and (i.term = q0.qn or i.term = any(q0.toks)))
        or exists (select 1 from public.search_intents i join public.search_synonyms s on s.alt = i.term and s.kind = 'syn' where i.intent = 'song' and s.term = q0.qn)
      )) as song_intent,
      (not q0.is_cho and exists (select 1 from public.search_intents i where i.intent = 'minor_game' and (i.term = q0.qn or i.term = any(q0.toks)))) as game_intent,
      array(select t from unnest(q0.toks) t where not exists (select 1 from public.search_intents i where i.term = t)) as rest_toks
    from q0
  ),
  -- 종겜 이름 정규식(제목 대조용): 종겜으로 분류된 게임 이름 전부. 짧은 이름(2자)은 단어 경계 없이도 잡히므로 3자 이상만.
  games as (
    select '(' || string_agg(regexp_replace(g.norm, '([.^$|()\[\]{}*+?\\])', '\\\1', 'g'), '|') || ')' as re
    from public.search_games g where g.kind = 'minor' and length(g.norm) >= 3
  ),
  ev as (
    select
      e.id, e.date_key, e.start_time, e.public_title,
      coalesce(e.public_description, '') as descr,
      public.search_norm(e.public_title) as tn,
      public.search_norm(e.public_description) as dn,
      public.search_norm(coalesce((
        select string_agg(bt.display_name, ' ')
        from public.event_tags et join public.broadcast_tags bt on bt.id = et.tag_id
        where et.event_id = e.id
      ), '')) as tagn
    from public.events e
    where e.calendar_id = p_calendar_id
      and e.deleted_at is null
      and e.visibility_scope = 'public'
      and e.status <> 'draft'
      and not (coalesce(e.teaser, false) and e.teaser_reveal_at is not null and e.teaser_reveal_at > now())
  ),
  vods as (
    select
      v.title_no, v.broadcast_day, v.title, v.duration_ms, v.host_nick,
      v.read_cnt, v.like_cnt, v.comment_cnt,
      public.search_norm(v.title) as tn,
      coalesce(t.entry_count, 0) as entry_count
    from public.vod_archive v
    left join public.vod_timeline t on t.title_no = v.title_no
    where v.auth_no = 101
  ),
  corpus as (
    select case when q.is_cho then public.search_choseong(ev.tn || ev.tagn || ev.dn) else ev.tn || ev.tagn || ev.dn end as norm
    from ev, q1 q
    union all
    select case when q.is_cho then public.search_choseong(v.tn) else v.tn end from vods v, q1 q
    union all
    select case when q.is_cho then c.label_cho else c.label_norm || '|' || c.section_norm || '|' || c.parent_norm end from public.vod_chapter_index c, q1 q
  ),
  q as (
    select
      q1.qn, q1.is_cho, q1.alts, q1.tokg as toks, q1.min_ok, q1.song_intent, q1.game_intent, q1.rest_toks,
      case when cardinality(q1.alts) = 0 then '(?!)' else '(' || array_to_string(q1.alts, '|') || ')' end as qre,
      case when cardinality(q1.rels) = 0 then null else '(' || array_to_string(q1.rels, '|') || ')' end as qrel,
      case when cardinality(q1.rest_toks) = 0 then null else '(' || array_to_string(q1.rest_toks, '|') || ')' end as qrest,
      (select re from games) as gre,
      (not q1.is_cho and length(q1.qn) between 2 and 4) as abbrev_on,
      '%' || substr(q1.qn, 1, 1) || '%' || substr(q1.qn, length(q1.qn), 1) || '%' as ablike,
      array(
        select (ln(((select count(*) from corpus) + 1.0) / ((select count(*) from corpus where corpus.norm ~ ('(' || t.tok || ')')) + 1.0)) + 1)::numeric
        from unnest(q1.tokg) with ordinality as t(tok, ord)
        order by t.ord
      ) as tokw,
      cardinality(q1.toks) as ntok
    from q1
  ),
  ev_hearts as (
    select h.event_id, count(*)::numeric as n
    from (select event_id from public.event_hearts union all select event_id from public.event_hearts_anon) h
    group by h.event_id
  ),
  ev_max as (select greatest(1, coalesce(max(n), 1)) as mx from ev_hearts),
  evm as (
    select ev.*,
      case when q.is_cho then public.search_choseong(ev.tn) else ev.tn end as tnm,
      case when q.is_cho then public.search_choseong(ev.dn) else ev.dn end as dnm,
      case when q.is_cho then public.search_choseong(ev.tagn) else ev.tagn end as tagnm,
      (case when q.is_cho then public.search_choseong(ev.tn) else ev.tn end) ~ q.qre as hit_t,
      (case when q.is_cho then public.search_choseong(ev.tagn) else ev.tagn end) ~ q.qre as hit_g,
      (case when q.is_cho then public.search_choseong(ev.dn) else ev.dn end) ~ q.qre as hit_d,
      (q.qrel is not null and (ev.tn || ev.tagn || ev.dn) ~ q.qrel) as hit_r,
      (q.game_intent and q.gre is not null and ev.tn ~ q.gre and not public.search_game_is_major(ev.tn)
        and (q.qrest is null or (ev.tn || ev.tagn) ~ q.qrest)) as hit_game,
      (case when not q.abbrev_on or ev.tn !~~ q.ablike or (ev.tn ~ q.qre) then false
            else public.search_abbrev_match(q.qn, ev.public_title) end) as hit_ab,
      coalesce((select n from ev_hearts where ev_hearts.event_id = ev.id), 0) / (select mx from ev_max) as pop
    from ev, q
  ),
  ev_scored as (
    select
      'event'::text as kind, ev.id as event_id, null::bigint as title_no, null::integer as sec,
      ev.date_key, ev.start_time, ev.public_title as title,
      case
        when not q.is_cho and hit_d and position(lower(trim(coalesce(p_q, ''))) in lower(ev.descr)) > 0 then
          substr(ev.descr, greatest(1, position(lower(trim(coalesce(p_q, ''))) in lower(ev.descr)) - 30), 120)
        when hit_d then substr(ev.descr, 1, 120)
        else ''
      end as snippet,
      null::bigint as duration_ms, null::text as host_nick,
      (
        greatest(3.0 * similarity(ev.tnm, q.qn), 1.2 * similarity(ev.tagnm, q.qn), 0.7 * similarity(ev.dnm, q.qn))
        + case
            when hit_game then 2.6
            when hit_t then 1.2
            when hit_g or hit_d then 0.6
            when q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0
              then 1.0 * public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw)
            when hit_r then 0.5
            when hit_ab then 0.4
            else 0
          end
        + 0.4 * pop
        + 0.3 * exp(-greatest(0, (current_date - ev.date_key))::numeric / 365.0)
      )::numeric as score,
      (hit_game or hit_t or hit_g or hit_d or hit_r or (q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)) as exact,
      pop::numeric as popularity,
      ''::text as section, ''::text as parent,
      case when hit_game then 'game' when hit_t then 'title' when hit_g then 'tag' when hit_d then 'description' when q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0 then 'tokens' when hit_r then 'related' when hit_ab then 'abbrev' else 'fuzzy' end as matched_on
    from evm ev, q
    where q.min_ok and (
      hit_game or hit_t or hit_g or hit_d or hit_r or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(ev.tnm || ev.tagnm || ev.dnm, q.toks, q.tokw) > 0)
      or (length(q.qn) >= 2 and similarity(ev.tnm, q.qn) >= 0.25)
    )
  ),
  vod_max as (
    select greatest(1, coalesce(max(read_cnt), 1))::numeric as mx_read,
           greatest(1, coalesce(max(like_cnt + comment_cnt), 1))::numeric as mx_react,
           greatest(1, coalesce(max(entry_count), 1))::numeric as mx_ch
    from vods
  ),
  vod_engage as (
    select v.title_no,
      0.4 * ln(1 + v.read_cnt) / ln(1 + m.mx_read)
      + 0.2 * ln(1 + v.like_cnt + v.comment_cnt) / ln(1 + m.mx_react)
      + 0.2 * v.entry_count / m.mx_ch as engagement,
      0.3 * exp(-greatest(0, (current_date - v.broadcast_day))::numeric / 365.0) as freshness
    from vods v, vod_max m
  ),
  vodm as (
    select v.*,
      case when q.is_cho then public.search_choseong(v.tn) else v.tn end as tnm,
      (case when q.is_cho then public.search_choseong(v.tn) else v.tn end) ~ q.qre as hit_t,
      (q.qrel is not null and v.tn ~ q.qrel) as hit_r,
      -- 종겜 다시보기: 제목에 종겜 이름, 또는 종겜 코너를 가진 방송
      (q.game_intent and (
        (q.gre is not null and v.tn ~ q.gre)
        or exists (select 1 from public.vod_chapter_index c join public.search_games g on g.norm = c.game_norm where c.title_no = v.title_no and g.kind = 'minor')
      ) and (q.qrest is null or v.tn ~ q.qrest)) as hit_game,
      (case when not q.abbrev_on or v.tn !~~ q.ablike or (v.tn ~ q.qre) then false
            else public.search_abbrev_match(q.qn, v.title) end) as hit_ab
    from vods v, q
  ),
  vod_scored as (
    select
      'vod'::text as kind, null::uuid as event_id, v.title_no, null::integer as sec,
      v.broadcast_day as date_key, null::time as start_time, v.title, ''::text as snippet,
      v.duration_ms, nullif(v.host_nick, '') as host_nick,
      (
        2.0 * similarity(v.tnm, q.qn)
        + case
            when hit_game then 2.8
            when hit_t then 1.2
            when q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0 then 1.0 * public.search_tok_ratio(v.tnm, q.toks, q.tokw)
            when hit_r then 0.5
            when hit_ab then 0.4
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (hit_game or hit_t or hit_r or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)) as exact,
      (g.engagement / 0.8)::numeric as popularity,
      ''::text as section, ''::text as parent,
      case when hit_game then 'game' when hit_t then 'title' when q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0 then 'tokens' when hit_r then 'related' when hit_ab then 'abbrev' else 'fuzzy' end as matched_on
    from vodm v
    join vod_engage g on g.title_no = v.title_no, q
    where q.min_ok and (
      hit_game or hit_t or hit_r or hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(v.tnm, q.toks, q.tokw) > 0)
      or (length(q.qn) >= 2 and similarity(v.tnm, q.qn) >= 0.25)
    )
  ),
  chm as (
    select c.title_no, c.sec, c.label, c.section, c.parent, c.song_kind,
      case when q.is_cho then c.label_cho else c.label_norm end as cm,
      c.label_norm || '|' || c.section_norm || '|' || c.parent_norm as cmx,
      (case when q.is_cho then c.label_cho else c.label_norm end) ~ q.qre as hit_t,
      (not q.is_cho and (c.section_norm || '|' || c.parent_norm) ~ q.qre) as hit_s,
      (q.qrel is not null and (c.label_norm || '|' || c.section_norm || '|' || c.parent_norm) ~ q.qrel) as hit_r,
      (q.song_intent and c.song_kind = 'sung' and (q.qrest is null or (c.label_norm || '|' || c.section_norm) ~ q.qrest)) as hit_song,
      (q.song_intent and c.song_kind = 'listen' and (q.qrest is null or (c.label_norm || '|' || c.section_norm) ~ q.qrest)) as hit_listen,
      -- 종겜 코너의 시작 항목 = "여기서부터 그 게임"
      (q.game_intent and c.is_section_start and c.game_norm <> ''
        and exists (select 1 from public.search_games g where g.norm = c.game_norm and g.kind = 'minor')
        and (q.qrest is null or (c.label_norm || '|' || c.section_norm) ~ q.qrest)) as hit_game,
      (case when not q.abbrev_on or c.label_norm !~~ q.ablike or (c.label_norm ~ q.qre) then false
            else public.search_abbrev_match(q.qn, c.label) end) as hit_ab
    from public.vod_chapter_index c, q
  ),
  ch_scored as (
    select
      'chapter'::text as kind, null::uuid as event_id, c.title_no, c.sec,
      v.broadcast_day as date_key, null::time as start_time, c.label as title, v.title as snippet,
      v.duration_ms, nullif(v.host_nick, '') as host_nick,
      (
        1.5 * similarity(c.cm, q.qn)
        + case
            when c.hit_game then 2.4
            when c.hit_song then 2.8
            when c.hit_t then 1.2
            when c.hit_s then 0.9
            when c.hit_listen then 0.8
            when q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) > 0 then 1.0 * public.search_tok_ratio(c.cmx, q.toks, q.tokw)
            when c.hit_r then 0.5
            when c.hit_ab then 0.4
            else 0
          end
        + g.engagement + g.freshness
      )::numeric as score,
      (c.hit_game or c.hit_song or c.hit_listen or c.hit_t or c.hit_s or c.hit_r or (q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) >= 0.5)) as exact,
      (g.engagement / 0.8)::numeric as popularity,
      c.section, c.parent,
      case when c.hit_game then 'game' when c.hit_song then 'song' when c.hit_t then 'label' when c.hit_s then 'section' when c.hit_listen then 'listen' when q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) > 0 then 'tokens' when c.hit_r then 'related' when c.hit_ab then 'abbrev' else 'fuzzy' end as matched_on
    from chm c
    join vods v on v.title_no = c.title_no
    join vod_engage g on g.title_no = c.title_no, q
    where q.min_ok and (
      c.hit_game or c.hit_song or c.hit_listen or c.hit_t or c.hit_s or c.hit_r or c.hit_ab
      or (q.ntok > 1 and public.search_tok_ratio(c.cmx, q.toks, q.tokw) >= 0.5)
      or (length(q.qn) >= 2 and similarity(c.cm, q.qn) >= 0.3)
    )
  ),
  merged as (
    select * from ev_scored union all select * from vod_scored union all select * from ch_scored
  )
  select kind, event_id, title_no, sec, date_key, start_time, title, snippet, duration_ms, host_nick,
         round(score, 4) as score, exact, round(popularity, 4) as popularity, section, parent, matched_on
  from merged
  order by exact desc, score desc, date_key desc, sec asc nulls first
  limit greatest(1, least(coalesce(p_limit, 50), 400));
$$;
comment on function public.search_public(uuid, text, integer) is
  '시청자 검색(0076~0083) — 종겜 의도(학습 게임 목록 - 메이저 사전), 노래 의도, 챕터 코너·상위, 동의어/관련어/줄임말/IDF/초성. 공개 데이터만.';
grant execute on function public.search_public(uuid, text, integer) to anon, authenticated;
