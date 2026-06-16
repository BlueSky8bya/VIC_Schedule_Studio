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
