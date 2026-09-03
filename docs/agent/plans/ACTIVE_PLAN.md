# Active ExecPlan

Plan ID: PLAN-20260904-002
Status: Completed (2026-09-04 — 실측은 CURRENT_STATE ㉑; 같은 날 추가 결정: 차분한 편집실 토글 제거·항상 ON)
Task Risk: L2 (구조적 — 계절 레이어를 CSS DOM에서 상호작용 캔버스 엔진으로 교체; gfx 판정 v3(3단계·WebGL 소프트웨어
렌더 감지·2회 판정·사용자 우선순위); 설정 세대 재시딩; 계절 스위치 의미 변경)
Created / Updated: 2026-09-04

## Objective (사용자 5건)

1. **계절 배경 OFF = 전부 내려감.** 물결은 여름 전용이므로 OFF면 물결도 없다(옛 "OFF = 사철 물결" 폐기).
2. **봄/가을/겨울을 여름 물결급으로, 전부 위에서 내려다보는 시점 + 상호작용(애플 감성·귀엽게).**
   겨울 = 소복한 눈밭 + 걸어간 발자국 + 내려앉는 눈 + 바탕 클릭 → 발자국·눈가루. 가을 = 낙엽 풍성 + 물리(원 충돌·
   바닥 마찰·돌풍) + 포인터 바람 + 잎 집어 끌기. 봄 = 풀밭 + 클로버·데이지 + 나비(그림자·회피) + 나비 클릭 → 꽃잎 폭발.
   구현 = 전체 화면 `<canvas>` 하나 + 장면 엔진(`components/shared/ambient/scene-engine.ts`, `scenes/*`), 스프라이트·
   바탕은 한 번 굽고 매 프레임 drawImage만, 동적 import. 여름은 기존 CSS 물결 유지.
3. **다음 배포부터 설정 4종(생동감·눈 편한·차분·계절) 기본 ON 재시딩** — `SETTINGS_EPOCH` 올리고 페인트-전 스크립트가
   네 키를 지운다. 그 뒤 만진 값만 남는다.
4. **토리님 PC에서 물결이 몇 초 뒤 사라짐 = gfx 판정 lite.** v3: `full | lite | soft` 3단계 — soft(WebGL 렌더러가
   SwiftShader/llvmpipe/software·코어 ≤2)만 배경 OFF + 눈 편한 팔레트, lite(프레임 나쁨 **2회 방문 연속**)는 물결
   1겹·캔버스 입자 절반으로 **보이게 유지**, 필터는 GPU가 있으면 그대로. 설정 "배경 효과" 자동/항상 최대/가볍게로
   사용자가 덮어쓴다. 자동으로 내려가면 토스트로 알린다.
5. **눈 편한 테마가 OFF로 보인 원인** = 4와 같은 뿌리: lite 판정 → 루트 필터 대신 토큰 팔레트("lite") → 태그·카드
   원색이 그대로라 OFF처럼 보임(스위치는 ON). v3에선 소프트웨어 렌더가 아니면 필터를 유지한다.

## 검증
- fixture `?ambient=` 4계절 스크린샷(편집실·시청자) + 상호작용(포인터 이동 → 잎 이동, 나비 클릭 → 반짝이, 눈 클릭 →
  발자국) + 스위치 OFF → `.gs-tide`·`.gs-season` 둘 다 없음 + 생동감 OFF → 정지 + gfx soft → 숨김 + 세대 재시딩(옛 키
  'off' 심고 로드 → 전부 ON) + 헤드리스 드래그 스펙 + tsc/lint/vitest/build/비주얼 + perf-frames(nogpu).

## 롤백
- `AmbientLayer`를 이전 커밋의 CSS 계절 컴포넌트로 되돌리고 gfx.ts v2 복원. 저장 키(`vic.gfxPref`)는 무해.

---

# (보관) 이전 계획

Plan ID: PLAN-20260904-001
Status: Phase 1·2 Completed (2026-09-04) / Phase 3·4 Proposed
Task Risk: L2 (구조적 — 배경 시스템을 레지스트리 하나로; 편집실·시청자 공용 마운트 교체; 새 설정 스위치)
Created / Updated: 2026-09-04

## Objective (사용자: "계절별 배경(물결=여름)+ON/OFF, 특정일 배경, 따로 관리하는 루트, 사주 원리 보정 — 시작")

1. **레지스트리**(`components/shared/ambient/registry.ts`) — KST 절기 계절 판정 + `SPECIAL_DAYS`(3단계) + `pickAmbient`.
   `<AmbientLayer />`가 물결(상수) + 계절 레이어(강세) 마운트, 편집실·시청자 공용(옛 `<WaterTide />` 직접 마운트 대체).
2. **레이어**: 봄 초목 그림자 얼룩·풀빛 필름·이슬(木·水), 여름 = 물결만, 가을 물 위 낙엽 8장(채도 낮춘 갈색·와인) +
   은빛 서리 안개(金), 겨울 눈 26송이 + 서리 광택 + 찬 필름(水·金). 전부 transform/opacity, fixed z:-1, 표면 밖.
3. **스위치 "계절 배경"**(`vic.ambient`, 기본 ON, 설정 톱니 목록) → `html[data-ambient="off"]`면 계절만 숨김.
4. 3단계 특정일(성탄 눈+숨은 요소 → 할로윈 보랏빛 안개 → 24절기 표), 4단계 포스터 테마 셀렉트 `auto/none` 축소 + 옛 7종 CSS 철거.

## 검증
- fixture `?ambient=spring|summer|autumn|winter` 편집실·시청자 스크린샷 + 게이트(계절 OFF → 물결만, 생동감 OFF → 둘 다
  숨김, 모바일 숨김) + 스위치 저장/즉시 반영 + 헤드리스 드래그 스펙(비용 게이트) + tsc/lint/vitest/build/비주얼.

## 롤백
- `<AmbientLayer />` → `<WaterTide />`, `app/ambient.css` import 제거. 저장 키 `vic.ambient`는 무해.

---

# (보관) 이전 계획

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
4. **금생수(金生水) 스킨(ADR-0016, 사용자 2차 지시)** — 일(팝오버·띠·버튼·타일·칩·카드 테두리·달 이동 링) = 금,
   품는 것(바탕·표면·칸·요일·패널·상단바·힌트·역할 팝오버) = 수. 토큰 `--gs-*`(app/metal-water.css) + 편집실
   studio-calm-layer.css ④(차분 아래) + 시청자 poster-metal-water.css(기본, 미리보기·export 포함). 의미색·태그색·
   기하 불변. 비주얼 기준선은 색 변화라 전수 갱신(치수 스펙은 그대로 통과해야 한다).
5. **아바타 알약 겹침(사용자 3차 지시)** — 쉼 상태 반투명(.62)·블러 없음, 호버/포커스 불투명, workspace 아래
   72px 여백(스크롤 끝 겹침 0).
6. **설정 허브(2026-09-04)** — 도구 카드 '멤버 관리' 타일 → '설정(톱니)'. 스위치 4종·포스터 테마·멤버 관리 입구를
   `studio-settings.tsx` 한 목록으로(웹 = 톱니 팝오버 body 포털+fixed, 모바일 = 역할 배지 슬롯). 편집 팝오버 왼쪽 우선,
   챕터 레일 분절 제거·라벨 "타임라인 N개". 계절/특정일 배경은 `docs/ux/seasonal-ambient-plan.md`(제안, 미착수).

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
