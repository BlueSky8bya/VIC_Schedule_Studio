# Active ExecPlan

Plan ID: PLAN-20260903-002
Status: Completed (2026-09-03 — 실측: GPU 60fps 0드롭, 소프트웨어 렌더 물결 ON 47fps/게이트 OFF 100fps →
gfx 판정 v2로 접음; 필터 잘림 1720×1000 0px · 1600×1000 51px(옛 44px 동급); 3역할·3게이트 스크립트 통과)
Task Risk: L2 (구조적 — 편집실 웹 크롬 재배치: 액션바 행 소멸, 도구는 서쪽 rail, 계정은 북동 모서리;
새 배경 애니 레이어; 설정 스위치 극성 뒤집기)
Created / Updated: 2026-09-03

## Objective (사용자: "휴식 넛지처럼 배치 대개편 + 물·금 물결 애니(애플 감성, 동작 줄이기면 OFF) + 동작 스위치 ON 기본")

1. **배치 대개편(방위 규칙 + 30일 사용 데이터)** — 편집실 웹(≥641px)만. 모바일 크롬은 불변.
   - 북(상단 한 줄): 제목 · ‹ 달 › · 저장 상태 · 시청자 화면 보여주기(개발자는 역할 미리보기) · 관리자 ? · 로그아웃.
     **액션바 두 번째 행 소멸** → 달력이 그 높이(≈50px)를 얻는다(핫 존 = 칸·카드·저장).
   - 서(좌측 rail = 금/도구): 태그 필터 카드 아래 **도구 카드**(태그 편집 · 멤버 관리 · 월별 인사이트 · 단축키
     — 아이콘+짧은 라벨 타일, 30일 0~2회 콜드 존). 아바타 rail이면 [필터 | 도구 | 아바타 자리] 순, 아니면
     `.studio-left-panel`에 같은 카드.
   - 아바타 좌/우 세그먼트는 **하단 중앙 플로팅 행**(`.bottom-float-row`, 확대 배율과 같은 줄)으로. (처음엔
     아바타 자리 박스 안 — rail과 함께 반대편으로 옮겨가 되돌릴 때 마우스 왕복이 화면 폭만큼이라 사용자
     지적으로 철회. 화면 중앙 고정 = 어느 쪽에서든 같은 거리.)
   - 2026-08의 "관리 3종 드롭다운 접기 철회"는 이 지시(대개편)로 대체 — 접지 않고 rail 타일로 상시 노출.
2. **물결 레이어(`.studio-tide`)** — `html[data-studio-calm]` + 동작 줄이기 OFF + `data-gfx≠lite`일 때만.
   fixed 배경(z:-1, 셸 배경 투명), 큰 물빛 스웰 2 + 물결 채움 2 + **은선(stroke, 금)** 1, 상단바 헤어라인 글린트.
   전부 transform/opacity(합성기) — 무한 애니 규칙(frame-jank 메모리). 약한 기기(vic.gfx lite)·동작 줄이기·
   차분 OFF·모바일엔 렌더/표시 안 함.
3. **설정 스위치 극성** — "동작 줄이기(기본 OFF)" → "생동감 있는 동작(기본 ON)". 저장 키(`vic.reduceMotion`)·
   `html[data-reduce-motion]` 의미는 불변(라벨·체크 방향만 반전). 세대(epoch) 로직 무관.

## 검증 계획
- Playwright(3111): owner(아바타 rail 좌/우)·manager(rail 없음)·developer 스크린샷; 차분 OFF·동작 줄이기 ON·gfx lite에서
  `.studio-tide` display none; 팝오버 도크 top(`--dock-top`) 상단바 아래; 편집 팝오버 클램프 기준(getChromeBottomV) 정상.
- perf-frames.mjs studio (gpu/nogpu): 물결 켜진 idle fps가 기존 대비 −5% 이내.
- tsc · lint · vitest(라벨 사전 가드) · next build · 비주얼 기준선(studio-owner-web-light 등) 갱신.

## 롤백
- 커밋 단위 revert. 도구 타일은 `data-act` 키(manage-tags/-members/-insights/kbd-hints-btn/avatar-ctl-toggle) 불변 →
  인사이트 집계 연속.

---

# (보관) 이전 계획 — VOD 아카이브

Plan ID: PLAN-20260831-001
Status: Phase 1 Completed (2026-08-31, CHG-20260831-001 — 백필 376건·칩 실측 완료) /
Phase 2 Proposed (타임라인 활용 방식 사용자 결정 대기)
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
