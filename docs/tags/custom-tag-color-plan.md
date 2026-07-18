# 태그 색 커스텀화 계획 v2 — 단일 resolver + 커스텀 색 + 무늬 제거 + WCAG 자동 글자

작성: 2026-07-18 · 상태: **계획(미구현)** · **v2가 v1을 supersede**(코덱스 적대 리뷰 반영, No-go→재범위).
관련: [[tag-tier-plan]], `lib/tags/color-gen.ts`, `lib/calendar/month.ts`,
`components/tags/tag-legend-editor.tsx`, `app/globals.css`, `lib/schedules/{public,studio}-loader.ts`,
`lib/insights/actions.ts`

## v1에서 틀렸던 전제 (코덱스가 코드로 반증 — 기록해 둠)
1. **FALSE: "커스텀 hex 배관이 이미 있다."** 실제로는 *신규 최상위 태그 + colorKey가 `gen-`* 일
   때만, 클라이언트가 보낸 bg/text/border를 **검증 없이** `color_palette`에 INSERT
   (`tag-actions.ts`). 기존 색 recolor 경로 없음. hue 28° 분리도 curated family 선택에만 적용,
   fallback은 4° 격자라 미보장. **→ 서버 hex 검증 + recolor action이 새 작업.**
2. **FALSE: "임의 배경에서 모든 렌더 경로가 글자색을 자동 산출한다."** `eventInkStyle`은
   `#RRGGBB`만 파싱(그 외 luminance 0), `mixedEventStyle`은 2색 카드에서 **첫 색만** 보고 글자
   결정. 칩/피커/범례/insights는 `eventInkStyle`을 **안 거치고** 팔레트 text를 직접 씀(그래서
   현재 모캡 3.43·리캡 3.45·카페 4.20 = **AA 미달 방치**).
3. **FALSE: "무늬의 목적은 파스텔 구분뿐."** `recolor-tags.mjs`가 명시: 무늬 = **색맹(적/녹) 구분
   단서, WCAG 1.4.1("색만으로 구분 금지")**. hue 가까운 태그끼리 무늬를 손배치("게임 초록과
   타스뱅송 오렌지 적색맹 혼동 → 무늬 다르게"). **→ 제거는 접근성 회귀**(아래 완화 필수).
4. **FALSE: "백필=렌더 불변."** bg가 같아도 새 알고리즘이 글자·보더·굵기를 재산출하고 무늬를
   지우므로 결과가 달라진다. "불변"은 *잉크 resolver가 기존 팔레트 입력에 오늘과 동일 출력을 내는
   것*에만 국한. 무늬 제거·굵기 변경은 **눈에 보이는 변화 → baseline 승인 필요.**
5. **FALSE: "bg_hex=NULL 폴백이면 즉시 안전 롤백."** 롤백엔 `color_palette` 행 + 무늬 CSS가
   둘 다 필요. 계획이 그것들을 동시에 지우면 롤백 불가. **→ fallback 종료까지 팔레트·legacy CSS를
   기능 플래그 뒤에 보존.**

## 핵심 재범위 (v1 → v2)
v1은 `eventInkStyle` 하나만 손댔다. 실제 코어는 **색 lookup이 흩어진 것**이다 — 포스터 카드/범례/
모바일 바/필터 스와치/태그 칩/피커/insights(4곳)/export가 제각각 `color_key`→`color_palette`를 찾는다.
→ **Phase 0 = 단일 visual resolver로 통일.** 이게 진짜 최대 작업이고, 그 자체로 지금 AA 미달을 고친다.

## 결정 (2026-07-18, 코덱스 리뷰 후 확정)
- **글자색 = 자동** (수동 없음). 단 resolver 하나가 *모든* 표면에 적용(칩·범례·insights 포함).
- **무늬 = 전면 제거(사용자 확정)**. **트레이드오프 명시: WCAG 1.4.1 색맹 단서 상실.**
  완화(**필수, 옵션 아님**): ①피커에서 기존 콘텐츠 태그와 hue<20°면 경고 ②색약(protan/deutan/
  tritan) 미리보기 토글 ③커스텀 색이라 near-duplicate 파스텔 대신 *진짜 다른 hue*를 고를 수 있음
  → 실측상 현재보다 CVD 혼동이 되레 줄 여지. 이 완화 없이 무늬 제거 배포 금지.
- **대비 = WCAG 2.1 AA 하드 표준**(법적·기계검증). **APCA는 advisory 지표만**(제한 라이선스 +
  WCAG3 초안 불안정 → 하드 기준으로 안 씀). AA는 **배경을 조용히 바꾸지 말고** 잉크/scrim으로 확보;
  불가 조합만 저장 전 사유 표시 후 동의.
- **톤 = 프리셋 4단**(파스텔/부드럽게/선명/깊게). **저장은 hex만 진실 원천**, tone은 피커 입력
  프리셋일 뿐(저장 안 하거나 저장 시 hex에서 재분류 — dual-source desync 방지).
- **백필 = 팔레트 hex 그대로 복사.** 단 무늬 gen 태그(아래 10개)는 **명시적 시각 마이그레이션 대상.**
- **의존성**: HSLuv 공식 JS(MIT) 사용 OK. APCA 공식 lib(apca-w3)는 라이선스·beta라 **직접 안 씀**
  (advisory 계산이 필요하면 conformance vector로 최소 구현). 공유 파생 모듈이 client poster에
  import되면 공개 번들 증가 → budget 확인.

## 설계

### Phase 0 — 단일 visual resolver (신설·최대·값어치 독립)
`lib/tags/tag-visual.ts`:
```
resolveTagVisual(tagId, tags, palette): { bg, ink, border, weight, scrim }
```
- **상속 포함**: 자식이면 최상위 부모의 색을 찾아 적용(현재 `categoryColorKey` 로직 흡수).
  자식의 bg_hex/tone은 **DB CHECK로 NULL 강제** + 서버 무시(상속 깨짐 원천 차단).
- **잉크**: 기존 `eventInkStyle`(WCAG 상대휘도) 흡수 + `#RRGGBB` 외 입력 방어(정규화/거부).
  브랜드 동색 진한 글씨 우선 → AA 미달이면 흑/백.
- **모든 표면이 이 resolver만 쓴다**: 포스터 카드·범례·모바일 바·필터·칩·피커·insights(4곳)·
  export. JSX에서 palette 직접 lookup 금지(회귀 방지 = lint/grep 가드).
- **2색 카드**: 양쪽 배경 각각 대비 검증 + 필요시 텍스트 scrim(첫 색만 보던 버그 수정).
- **출력 = 오늘과 동일**을 목표(무늬 제외). pixel/geometry baseline로 증명.
- **부산물**: 현재 AA 미달(모캡·리캡·카페 등) 자동 해소.

### Phase 0 선행 — 비주얼 테스트 스위트 복구
`test:visual`이 존재하지 않는 `tests/visual`을 가리킴(dangling). production build 기반 Playwright
visual suite를 먼저 만들고 baseline 생성 → 이후 색·굵기 변경의 **지오/PNG 불변을 실제로 증명**.
(스냅샷 "렌더 불변" 주장만으론 부족 — 코덱스 지적 수용.)

### Phase 1 — 데이터 모델 (커스텀 색)
```
ALTER TABLE broadcast_tags
  ADD COLUMN bg_hex text
    CHECK (bg_hex IS NULL OR bg_hex ~ '^#[0-9a-fA-F]{6}$'),
  ADD COLUMN tone text
    CHECK (tone IS NULL OR tone IN ('pastel','soft','vivid','deep'));
-- 자식(세부)은 색을 못 갖는다(부모 상속):
ALTER TABLE broadcast_tags
  ADD CONSTRAINT tag_child_no_color
    CHECK (parent_id IS NULL OR (bg_hex IS NULL AND tone IS NULL));
```
- nullable(폴백). `bg_hex` 있으면 resolver가 그걸, 없으면 `color_key`→palette. tone은 저장하되
  진실 원천은 hex(desync 방지 위해 저장 시 hex에서 재검증).
- `broadcast_tags` 읽는 **모든 로더/매퍼/타입/sample**을 같은 변경 단위로: `public-loader.ts`,
  `studio-loader.ts`, `insights/actions.ts`(4 맵), `sample-data.ts`.

### Phase 2 — 서버 쓰기 (검증·권한)
- **recolor action 신설**(또는 기존 saveTags 확장): bg_hex를 **서버에서 6자리 hex 검증·정규화**,
  text/border/weight는 **저장 안 함(resolver 파생)**. 클라이언트 생성색 신뢰 금지.
- **권한**: owner/developer만(기존 `saveTagsAction` 검사 재사용). **롤 테스트 필수**(manager/
  trusted/viewer 실패, owner/dev 성공).

### Phase 3 — 피커 UI + 무늬 제거 (동시 배포)
- `components/tags/color-wheel.tsx`: **HSLuv 색환**(바깥 hue 링 + 안쪽 S/L 좌표, Clip Studio식).
  톤 프리셋 4단은 HSLuv (S,L) **밴드값을 hue 전수로 사전 검증한 표**로(예시값 아님 — 각 밴드가 AA
  통과하는 hue 범위를 산출물로). deep 톤은 흰 글씨 극성 전환(resolver가 tone 인지).
- **실시간 미리보기**: 실제 카드(제목+소제목) + 대비 배지(WCAG 비, AA 통과여부; APCA Lc는 참고).
- **CVD 완화(필수)**: hue<20° 경고 + 색약 3종 시뮬 토글.
- 무늬 CSS(`[data-color^="gen-*"]`, indigo/mint/sky, `.evt-pat`) 제거는 이 배포에 함께.
  단 **팔레트 행·legacy CSS는 기능 플래그 뒤에 보존**(롤백 경로).

### Phase 4 — 백필 (선택)
`color_key`→`bg_hex` 복사 스크립트. **무늬 gen 태그 10개는 명시적 시각 마이그레이션**: 소통·풀트·
서버·게임·합방·타스뱅송·CK/핀볼·대회·월드컵·시네티 → 단색화로 시각 변함. 전후 CVD·PNG baseline 승인.
운영 스크립트(`audit-colors.mjs`·`recolor-tags.mjs`·`sort-tags-by-usage.mjs`)·sample-data도 갱신/폐기.

## 토리님 색-의미 (현재 DB 경향 = 목표와 일치)
노랑/주황=소통·풀트(노력), 파랑=합방, 빨강=게임 — 이미 그 경향. 피커 색환에 **의미 hue 앵커**(선택
가이드, 강제 아님). 자동 일괄 이동 없음; 토리님이 원하면 피커에서 하나씩.

## 불변식·리스크 (수용 조건 = DoD)
- **공개 경계**: bg_hex/tone은 공개 시각 데이터(누출 아님). 단 `public-loader`가 studio 타입/sample에
  결합돼 있으면(코덱스 지적) 색 DTO 확장 전 public sample/type 독립 + 명시적 공개 mapper 테스트.
  public-loader가 studio-loader/service-role import 안 하는 import 테스트 유지.
- **지오메트리(ADR-0004)**: **font-weight 변경이 줄바꿈→카드 높이→비율 스티커 좌표를 밀 수 있다.**
  기존 굵기 유지 또는 viewer==decorate bounding-box zero-delta + 스티커 좌표 회귀 테스트를 통과 조건.
- **PNG export**: 무늬 제거로 단순화. viewer/decorate/official 각각 admin UI 부재 + 색 일치 검증.
- **롤백**: bg_hex 비우면 복귀 — **단 팔레트 행 + 무늬 CSS가 플래그로 살아있을 때만.** 양방향 플래그.
- **KST·owner-only**: 색은 시간·권한 데이터 불변경(직접 충돌 없음) — 체크리스트에 명시만.

## 테스트 게이트 (Phase 0 시작 조건 = 코덱스 목록 수용)
잘못된/3·8자리 hex, 경계 luminance, mixed 밝음/어두움, 자식 상속, CVD 혼동쌍, picker/chip/insights
동일 resolver, viewer/decorate geometry zero-delta, browser/official PNG, role matrix,
rollback-after-pattern-removal. "렌더 불변"은 **pixel + geometry diff**로 증명.

## 판정
코덱스 **No-go 수용**. v1의 5개 FALSE 전제 정정, Phase 0(단일 resolver+비주얼 스위트 복구)를 앞에
세우고, 무늬 제거엔 CVD 완화를 하드 조건으로 묶었다. **이 v2대로면 Phase 0부터 착수 가능(Go-with-fixes).**
