# Active ExecPlan

Plan ID: PLAN-20260831-001
Status: Proposed (사용자 방향 확정 대기 — 아래 "결정 필요" 참조)
Task Risk: L2 (구조적 — 새 외부 데이터 소스(SOOP VOD/댓글) + 마이그레이션 + 공개 API 확장 + 시청자 UI)
Created / Updated: 2026-08-31

## Objective

토리님 숲 방송국의 **다시보기(VOD) 탭 전체 + 댓글(팬 타임라인)** 을 서버가 주기 수집해:
1) 시청자 화면에서 방송 날짜 클릭 → 해당 다시보기로 바로 이동(+영상 길이 표시),
2) 팬이 남긴 타임라인 댓글을 파싱해 사이트 데이터로 활용(활용 방식은 사용자와 결정).

## 사전 조사 결과 (2026-08-31 실측 — 전부 무인증 공개 API)

- **VOD 목록**: `chapi.sooplive.co.kr/api/toryvac/vods/review?page=N&per_page=20&orderby=reg_date`
  → 총 **376개 · 19페이지**. 항목마다 `title_no`(VOD id), `title_name`, `reg_date`(등록≈뱅종, KST),
  `ucc.total_file_duration`(ms), `ucc.thumb`(rowKey에 **방송 시작 날짜 + bno** 포함 —
  `broadcast_session.bno`와 정확 조인 가능, 기존 `fetchSoopVodTimes`가 이미 이 매칭 사용),
  `count.comment_cnt/like_cnt/read_cnt`. `auto_delete_remain_hours`는 빈 값(만료 예정 없음).
- **댓글**: `chapi.sooplive.co.kr/api/toryvac/title/{title_no}/comment?page=N` (per_page 최대 30,
  페이지네이션 meta 제공). 대댓글은 `c_comment_cnt`로 존재만 확인(필요 시 별도 엔드포인트 탐사).
- **타임라인 댓글 커버리지**: 표본 5페이지(96개 VOD) 스캔 → **81개(84%)에 타임라인 존재**.
  최근 페이지들은 사실상 전부(1·10·15페이지 각 20/20), 유일한 공백은 채널 초창기(19페이지 3/16 —
  타임라인 문화 정착 전). 판정 휴리스틱: 타임스탬프 3개 이상 or '타임라인' 포함.
  주 작성자 두 분(리야-, 소요카). 포맷 일정: `HH:MM:SS 설명` 줄 + 섹션 헤더 `[소통]`/`[게임] - FC26`.
  최대 108줄짜리도 존재(2,590자).
- **플레이어 URL**: `https://vod.sooplive.co.kr/player/{title_no}` → 200 OK.
  특정 시각 점프 파라미터(`?changeSecond=초`)는 **브라우저 실측 필요**(코드 반영 전 검증).
- 기존 자산: `lib/broadcast/soop.ts`(BJ_ID, VOD API 일부 사용), `broadcast_session.bno`(0051),
  외부 크론(cron-job.org) 패턴, 뱅종 시 VOD 조회 훅(broadcast-poll).

## Phase 1 — VOD 아카이브 + 시청자 날짜→다시보기 (방향 확정됨)

1. **마이그레이션 `vod_archive`**: `title_no` pk, `bno`, `broadcast_day`(KST 귀속 — rowKey 날짜 1순위,
   없으면 reg_date−duration), `title`, `duration_ms`, `reg_date`, `comment_cnt`, `like_cnt`, `read_cnt`,
   `synced_at`. RLS deny-all + service_role grant(**0035/0043 교훈 — grants 파일 필수**).
2. **수집기**: 서버 액션/크론 — 증분(1페이지 폴링, 새 title_no만) + 초기 백필 스크립트(19페이지,
   376개 · 요청 간 250ms). 뱅종 감지 훅(broadcast-poll)에서도 1회 트리거.
3. **공개 경계**: VOD 링크·길이는 공개 데이터 → public-loader에 날짜별 `{vodUrl, durationMs}` 명시적
   DTO로 추가(스프레드 금지). 캐시 revalidate 3줄 규칙 준수.
4. **시청자 UI**: 날짜 상세(카드/시트)에 "다시보기 ▶ (5시간 12분)" 칩 — 과거 날짜 + VOD 있을 때만.
   하루 여러 VOD면 목록. 인사이트 '방송 시간' 데이터도 VOD 길이로 **과거(세션 기록 이전) 백필** 가능.

## Phase 2 — 팬 타임라인 수집 + 활용 (활용처 미정 — 사용자와 결정)

1. **수집**: 새 VOD의 댓글 1~2페이지 → 휴리스틱(타임스탬프 ≥3 or '타임라인')으로 후보 →
   파싱 `{sec, label, section}` + 작성자 닉 → `vod_timeline`(+`vod_timeline_entry` or JSONB).
2. **활용 후보** (하나 이상 선택):
   A. 날짜 상세에 챕터 목록 — 항목 클릭 = 해당 시각으로 VOD 점프
   B. 전체 검색 — "기타 친 날 언제였지?" → 타임라인 전문 검색
   C. 인사이트 — 섹션 헤더 파싱으로 코너별(소통/게임/노래) 시간 배분 트렌드
   D. 타임라인 작성자 크레딧 표시(팬 기여 부각)
3. **주의**: 타임라인은 **팬 창작물** — 사이트 게재 시 닉네임 크레딧 + 가능하면 사전 동의(리야-,
   소요카 두 분). 닉네임은 공개 댓글의 공개 정보지만 최소 수집 원칙 유지.

## 공통 리스크

- 비공식 API — 필드 소멸 전례 있음(station broad_start, 2026-08). 실패는 조용히 스킵 + 기존 데이터
  유지(fail-soft), 파서에 이상치 가드.
- 크롤링 부하 최소화: 증분 위주, 백필 1회, 요청 간격 두기, User-Agent 명시.
- 공개 경계: 댓글 원문·닉은 운영 데이터로 시작(개발자만) → 공개 표면에 내보낼 때 별도 DTO 심사.

## 결정 필요 (사용자)

1. Phase 2 활용 방식 A~D 중 무엇부터? (A가 Phase 1과 시너지 최대)
2. 타임라인 게재 시 작성자 닉 표시 여부 / 동의 구할지
3. Phase 1 바로 착수 여부
