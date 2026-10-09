-- 0150: 실제로 쓰이는 노래 줄임말만(2026-10-10 소유자: "규칙으로 첫 글자 따지 말고, 웹에서 사람들이 보통 그렇게 줄여 부른다고
-- 확인된 것만 — 사스가처럼"). 다시보기 노래 542곡을 조사해 실제 쓰임(나무위키·기사·커뮤니티·유튜브)이 확인된 것만 넣었다.
-- 줄임말 → 곡 제목 한쪽만(source seed-songabbr). 새 줄임말은 같은 방식(웹에서 확인 → 여기 추가)으로만 늘린다.
--   사스가 = 사랑하긴 했었나요 스쳐가는 인연이었나요 짧지않은 우리 함께했던 시간들이 자꾸 내 마음을 가둬두네 (잔나비) — https://news.mt.co.kr/mtview.php?no=2020110913278282357 (머니투데이 '가요광장' 잔나비 "'사스가' 긴 제목")
--   다만세 = 다시 만난 세계 (소녀시대) — https://www.mindlenews.com/news/articleView.html?idxno=11168 (소녀시대 '다만세' 어떻게 민중가요가 됐을까)
--   내제잘 = 내가 제일 잘나가 (2NE1) — namu.wiki/w/내가 제일 잘 나가 ('내제잘 인트로' caption)
--   너모순 = 너의 모든 순간 (성시경) — https://www.youtube.com/watch?v=34_HeF5ta-E (성시경 ... full 너모순 ...)
--   미메크 = 미리 메리 크리스마스 (아이유) — https://news.nate.com/view/20251225n13838 (아일릿 원희, 아이유로 변신… '미메크')
--   잔테제 = 잔혹한 천사의 테제 (마젯, 타카하시 요코) — https://m.dcinside.com/board/evangelion/28135 (잔테제 가사 분석)
--   잔테제 = 잔혹한 천사의 태제 (타카하시 요코) — https://m.dcinside.com/board/evangelion/28135 (잔테제 가사 분석)
--   그마힘 = 그댈 마주하는건 힘들어 (버스커버스커) — https://music.bugs.co.kr/track/2689971 (official title '그댈 마주하는건 힘들어 (그마힘)')
--   이그말 = 이럴거면 그러지말지 (백아연) — https://www.fnnews.com/news/202403180810221086 ('이그말 챌린지')
--   카와다메 = 귀엽기만 하면 안 되나요? (CUTIE STREET, 조적단, 천타버스) — namu.wiki/w/かわいいだけじゃだめですか？(싱글) ('음반 약칭은 카와다메이다')
--   내죽생 = 내가 죽으려고 생각한 것은 (amazarashi) — https://m.dcinside.com/board/amazarashi/12300 (아마자라시 갤 '내죽생 뭔가 밈취급...')
--   내죽생 = 내가 죽으려고 생각한 것은 (키마님) — https://m.dcinside.com/board/amazarashi/28830 ('제가 자주듣는분이 내죽생 불러주셨내')
--   사전싶 = 사랑을 전하고 싶다던가 (Aimyon, 아이묭) — https://gall.dcinside.com/mgallery/board/view/?id=aimyon&no=27190 ('마리골드,사전싶 등등')
--   사전싶 = 사랑을 전하고 싶다든가 (Aimyon, 아이묭) — https://gall.dcinside.com/mgallery/board/view/?id=aimyon&no=27190 ('마리골드,사전싶 등등')
--   럽미라익 = Love Me Like This (NMIXX) — https://www.youtube.com/playlist?list=PLRmtxKiPIcX6MH2Lm510pgC4eNfndIIyg ('NMIXX Love Me L
--   걸네다 = Girls Never Die (고세구) — https://www.news1.kr/entertain/music/5780439 (트리플에스 "'걸네다' 처럼 위로되길")
--   기걷시 = 기억을 걷는 시간 (넬) — https://www.newstomato.com/ReadNews.aspx?no=1198378 ((권익도의 밴드유랑)넬 '기걷시')
--   완감 = 완전 감각 Dreamer (ONE OK ROCK) — https://gall.dcinside.com/mgallery/board/view/?id=oneokrock&no=29898 (원 오크 록 갤 '갑자기 든 생각인데
--   BBBB = Bling-Bang-Bang-Born (Creepy Nuts) — namu.wiki/w/Bling-Bang-Bang-Born (#BBBB dance challenge tag)
-- 적용: SUPABASE_DB_CA_PATH=.scratch-pw/supabase-ca.crt node scripts/apply-db.mjs db/migrations/0150_search_song_abbr_verified.sql

insert into public.search_synonyms (term, alt, source, kind) values
  ('사스가', '사랑하긴했었나요스쳐가는인연이었나요짧지않은우리함께했던시간들이자꾸내마음을가둬두네', 'seed-songabbr', 'syn'),
  ('다만세', '다시만난세계', 'seed-songabbr', 'syn'),
  ('내제잘', '내가제일잘나가', 'seed-songabbr', 'syn'),
  ('너모순', '너의모든순간', 'seed-songabbr', 'syn'),
  ('미메크', '미리메리크리스마스', 'seed-songabbr', 'syn'),
  ('잔테제', '잔혹한천사의테제', 'seed-songabbr', 'syn'),
  ('잔테제', '잔혹한천사의태제', 'seed-songabbr', 'syn'),
  ('그마힘', '그댈마주하는건힘들어', 'seed-songabbr', 'syn'),
  ('이그말', '이럴거면그러지말지', 'seed-songabbr', 'syn'),
  ('카와다메', '귀엽기만하면안되나요', 'seed-songabbr', 'syn'),
  ('내죽생', '내가죽으려고생각한것은', 'seed-songabbr', 'syn'),
  ('사전싶', '사랑을전하고싶다던가', 'seed-songabbr', 'syn'),
  ('사전싶', '사랑을전하고싶다든가', 'seed-songabbr', 'syn'),
  ('럽미라익', 'lovemelikethis', 'seed-songabbr', 'syn'),
  ('걸네다', 'girlsneverdie', 'seed-songabbr', 'syn'),
  ('기걷시', '기억을걷는시간', 'seed-songabbr', 'syn'),
  ('완감', '완전감각dreamer', 'seed-songabbr', 'syn'),
  ('bbbb', 'blingbangbangborn', 'seed-songabbr', 'syn')
on conflict (term, alt) do nothing;
