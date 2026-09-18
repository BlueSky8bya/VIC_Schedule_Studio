# db/migrations/ — 마이그레이션 인덱스

> 순번 SQL 파일(`NNNN_name.sql`). **파일명이 곧 목적**이라 보통 본문을 열 필요 없다.
> 적용: `node scripts/apply-db.mjs db/migrations/<file>.sql` (멱등, `.env.local` 읽음, 수동 적용).

## 규칙·함정
- 순번은 작성 순서. **중복 번호 있음**: `0024`(insights_grants / presence_ping), `0025`
  (merge_embargo / presence_active_days) — 같은 시기 병렬 기능이라 한 번호가 둘. 적용 시 둘 다.
- 🔴 **grants 함정**: RLS 테이블을 새로 만들면 `*_grants.sql`로 service_role DML 권한을
  안 주면 서버 쓰기가 조용히 `permission denied`로 죽는다(0024/0026/0035/0043가 그 짝).
- 시간은 항상 KST. 스키마 변경은 반드시 이 폴더에 파일로.

## 목록 (번호 → 목적)
| # | 영역 |
|---|---|
| 0001 | 초기 스키마 |
| 0002 | event_category |
| 0003 | calendar_memo |
| 0004 | event_end_date |
| 0005–0006 | event link group / link_next (일정 잇기) |
| 0007 | event_support (업 도움) |
| 0008–0010 | sticker: emoji / flip / text_effects |
| 0011 | calendar_hearts |
| 0012 | poster_theme |
| 0013–0015 | sticker text: font / align / more |
| 0016 | event_hearts |
| 0017–0018 | calendar_memo layout / lines |
| 0019 | calendar title drop monthly |
| 0020 | calendar_co_owners (오너 다계정) |
| 0021 | performance_indexes |
| 0022 | trusted_member_dual_roles (매니저+작업자) |
| 0023 | visit_log |
| 0024 | insights_grants · presence_ping *(중복번호)* |
| 0025 | merge_embargo_into_owner_private · presence_active_days *(중복번호)* |
| 0026 | presence_ping_grants |
| 0027 | owner_sessions |
| 0028–0031 | sticker: anim / text_fx / shape / locked |
| 0032–0035 | visit: account_hash / session / session_account_idx / session_grants |
| 0036–0038 | tag: parent(2계층) / kind / v3_only |
| 0039 | event_tentative (미정) |
| 0040 | event_hearts_anon (비로그인 하트) |
| 0041 | event_teaser (떡밥) |
| 0042–0043 | perf_samples / perf_samples_grants |
| 0044 | silver_color_open_run_tag |
| 0065 | retire_stickers_and_worker — 스티커 테이블 drop·작업자 컬럼 drop (ADR-0015; 코드 배포 후 적용) |
| 0066 | drop_legacy_presence_and_calendar_hearts — visit_log·presence_ping(+hourly/peak/active_days)·owner_sessions·calendar_hearts(+add_calendar_heart) drop (코드 소비자 0; 백업 `docs/agent/backups/2026-08-27_legacy-presence.json`; 코드 배포 후 적용) |
| 0067 | drop_unlock_sessions — `has_private_unlock()`를 private_unlock_grants(0057) 모델로 이식 후 legacy `unlock_sessions` drop (코드 배포 후 적용) |
| 0074 | retire_trusted_members — `trusted_members`·`trusted_role`·`is_active_trusted_member()` drop (ADR-0018; 행 0·참조 정책 0 실측; 코드 push 뒤 적용) |
| 0075 | vod_archive_guest — 합방 게스트 출연분(host_id·host_nick·guest) |
| 0076 | public_search — 시청자 검색: pg_trgm·`search_norm`·`vod_chapter_index`(타임라인 트리거 평탄화)·`search_public` RPC(공개 일정·다시보기·챕터 한 순위) |
| 0077 | public_search_p3 — 검색 P3: IDF 가중 토큰 비율·초성열(`search_choseong`, `label_cho`)·`exact` 플래그(RPC 반환형 변경) |
| 0078 | public_search_synonyms — 은어·줄임말: `search_synonyms`(seed 사전+auto 채굴 `search_synonyms_rebuild`)·`search_abbrev_match` 부분열·질의 확장·`popularity` 컬럼 |
| 0079 | public_search_graph — 은어 사전 보강 + 인물 관계 그래프(`search_entities`/`search_relations`, ○○님 공출현·합방·PPMI, `search_graph_rebuild`) + `search_related`·`search_trending` RPC |
| 0080 | public_search_related_terms — 관련어 kind(syn/rel)·큐레이션 관련어(할나~실크송)·단어 공출현 PPMI 그래프(`search_terms`/`search_term_relations`, `search_term_graph_rebuild`)·`search_related_terms` RPC·RPC 관련어 보너스 0.5 |
| 0081 | public_search_chapter_context — 챕터 색인에 코너(section)·상위 항목(parent)·depth, 코너/상위로도 검색(보너스 0.9), RPC section·parent·matched_on 반환, '노래·춤·빅이봤·소통' 관련어, 전수조사 줄임말(메·주보·구플뱅…)·사전에 있는 한 글자 질의 허용 |
| 0082 | public_search_song_intent — 곡 분류(song_kind sung/listen, 가수 사전 `search_artists`, `search_song_refresh`), 의도 사전 `search_intents`(노래→song), RPC: 노래 의도면 부른 곡 최상위(1.3)·들은 곡 0.8, limit 400 |
| 0083 | public_search_game_intent — 학습 게임 목록 `search_games`(코너 '게임 - X'+큐레이션 종겜) + 메이저 사전 `search_game_is_major`, 챕터 `game_norm`·`is_section_start`, 의도 종겜→minor_game(RPC 2.8/2.6) |
| 0084 | public_search_performance_kinds — song_kind 세분화 sung/listen/dance/hum(팬 이모지 🎤🎵🕺·코너·라벨 어휘·수다 제외), 의도 춤/챌린지·허밍, RPC 종류별 보너스 |
| 0085 | public_search_person_aliases — 스트리머 별칭 사전(seed-person: 풀네임↔줄임, 왁타버스 활동명) + 이름 오타 변형 자동 생성(auto-typo, 쵸↔초 등) |
| 0086 | public_search_typo_tolerance — `search_jamo`(자모 분해)·`search_correct`(자모 편집거리 사전어 교정, fuzzystrmatch)·챕터 `label_jamo` |
| 0087 | public_search_correction — 검색 RPC에 오타 교정 배선(사전에 없는 단일어만), 반환 `corrected` |
| 0088 | vod_chat_terms — 다시보기 채팅 리플레이 단어 빈도(`vod_chat_terms`/`vod_chat_sync`, 원문·닉 미저장) + 단어 그래프·줄임말 채굴·트렌딩에 채팅 합류, `search_chat_top_terms` |
| 0089 | 채팅 학습 손질 — 이모티콘(`/…/`) 행 삭제·수집 중단, `search_term_relations.last_day` + 관련어 점수 시간 감쇠(1년 ≈0.62배, 바닥 0.4), auto-rel 칩·채팅 줄임말·그래프 합류는 18개월 안 방송만, 트렌딩 이모티콘 제외 |
| 0090 | 채팅 구간 프로필·방문 인물·은어 초안 — `vod_chat_bins`(30초: 메시지·고유 발화자 **수**·웃음·상위 단어), `vod_chat_people`(아는 스트리머만), `search_dictionary_notes`, `search_known_people`(이름+인사 줄임 샬하/쵸하), `vod_chat_profile`(anon; **비율만**, 웃음 등급), `search_person_mentions`/`search_graph_rebuild`에 채팅 방문 합류 + `search_entities.visits`, `search_related`에 visits, `search_dictionary_draft`(개발자) |
| 0091 | 검색 품질 — 두 글자 한글 질의(사전 확장 없음)는 제목·설명·태그·챕터 **원문** 경계로만 적중("이게"≠"이 게임"), 두 글자엔 퍼지 끔; `search_trending` 채팅 단어는 말뭉치·사전에 있는 것만(누르면 결과 보장) + 불용어(아니야·사실…) |
| 0092 | 검색 결과에 `thumb`(SnapshotLoad 주소) 동봉(편집실 썸네일) + 소유자 은어 시드 `seed-owner`(프클=프로클럽=fc프로클럽, 잔디=fc/피파, rel 프클↔잔디) |
| 0093 | 채팅 단어 → 검색 적중: `vod_chat_terms.peak_bin/peak_cnt/bins`(그 말이 몰린 30초 구간), `search_public`에 `chat_scored`(단어 전체 일치·5회↑·팬 챕터가 못 잡은 방송만, section 채팅·matched_on chat) |
| 0094 | 장르 검색 — `search_genres`(장르→게임 이름 조각, 33개 장르·818행), `search_intents` genre/noise, 동의어 seed-genre(공겜=공포, 격겜=격투, 시뮬=시뮬레이션…), `search_public` hit_genre(제목·태그·챕터·코너·게임명, matched_on genre) |
| 0095 | 검색 일정 행에 그 날 다시보기 썸네일(첫 방송) 동봉 — 미래 일정은 null |
| 0096 | 검색어 제안 `search_suggest`(앞글자 우선, 초성, 굴절형 제거; 단어·인물·게임·장르·시드 동의어) + 단어 그래프 불용어 mic/on/off |
| 0097 | 검색 성능 — 채팅 적중을 정규식 전수 스캔 → `t.term = any(q.alts)` 인덱스 비교(1~3초·타임아웃 → 수백 ms), 트렌딩은 최근 210일 채팅만 |
| 0098 | 오타 교정 억제 — 질의가 말뭉치(단어·게임·인물·제목·챕터·일정)에 그대로/앞부분으로 있으면 교정 안 함("마비"→'뮤비' 사고) |
| 0099 | 검색어 제안 2순위 — 앞글자 후보가 적으면 씨앗(질의·상위 3개)의 공출현 이웃·동의어/관련어로 채움(kind related; 흔한 말·부사·추임새 불용어) |
| 0100 | 별칭 시드 진희 = 진솔(개명, 같은 사람), 젠황 = 젠투 = 사랑전도사 젠투 — seed-person syn 양방향 |
| 0101 | 별칭 시드 아마최 = 마최 = 아마데우스 최 |
| 0102 | 스트리머 별칭 웹 조사 시드 `seed-web` — 인물 그래프 150여 명(나무위키·왁타버스 위키) 정식명·줄임말·팬 별명·개명 102묶음·2,046짝, 일반어 별명 제외 |
| 0103 | 별칭 시드 엔젤 = 슈슈잉이 = 김수현(우왁굳 부인 아나운서) = 안경누나 |
| 0104 | 제안에 스트리머 별칭 포함 + 관련 인물 해석은 syn만(auto-rel이 "마최"→샬롯으로 풀던 사고) |
| 0105 | 인물 그래프 별칭 병합(마최→아마최, 젠황→젠투) + `search_doc_words`(제목·챕터·일정 단어) + 제안 관련어는 문서 말만 |
| 0106 | 제안 별칭은 실제 쓰이는 것만(3방송↑), 사람당 3개 |
| 0107 | 제안 관련어 품질: 씨앗은 문서 말·게임·인물·시드어만, 조사 꼬리 제외 |
| 0108 | 연구 브리프 반영: 자동완성 후보는 문서 어휘만(채팅 전용어는 관련 칩만), 이름 굴절형 오인 수정, 같은 사람 다른 이름 상위 3개 |
| 0109 | 제안 성능: 굴절형 판정 O(n²)→해시 조인, scored materialized |
| 0110 | 제안 관련어 불용어 — 용언 어미·흔한 일반명사·님께 꼬리 |
| 0111 | 제안 관련어 용언 어미 보강(왤케·걸린·드신·나온) |
