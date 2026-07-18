# 태그 색 커스텀화 계획 v4 (디스코프) — 무늬 유지 + 가독성 수정 + 커스텀 hex + 단일 resolver

작성: 2026-07-18 · 상태: **계획(미구현)** · **v4가 v3을 supersede**(코덱스 3차 후 디스코프 결정).
관련: `lib/calendar/month.ts`, `lib/schedules/{public,studio}-loader.ts`, `lib/insights/actions.ts`,
`components/tags/tag-legend-editor.tsx`, `app/globals.css`, `app/api/studio-write/route.ts`,
ADR-0004(지오)·ADR-0006(keepalive)·공개경계 규칙·`scripts/audit-colors.mjs`

## 왜 디스코프했나 (3라운드 적대 리뷰의 결론)
v1→v3 검수에서 STILL-OPEN/REGRESSED 대부분이 **"무늬 제거" 한 결정에서 파생**됐다:
무늬 제거→색맹 단서 상실→글리프 필요→**카드 네 귀퉁이 이미 점유(놓을 자리 없음, REGRESSED)**→
모바일 바·modifier 점도 색만 남음→글리프 2차 지오 변경→스티커 이동. 별개로 **동적 굵기 제거**(지오
결합 없애려던 것)가 **그 자체로 기존 스티커를 옮기는** 지오 변경(아이러니).
→ **토리님 실제 불만 #2 = "글자가 안 보인다"(무늬 자체가 아님).** 무늬는 색맹 구분을 위해
`recolor-tags.mjs`가 혼동 그룹에 **사람이 손배치**한 것이라 **유지**하고 **가독성만** 고친다 → 글리프·
2차 지오·1.4.1·mode 롤백 문제가 전부 소멸. (주의: `audit-colors.mjs`는 solid bg의 CVD ΔE만 계산 —
무늬 shape/alpha의 식별성은 **미검증**. 무늬 유지 결정의 유효성 입증엔 CVD 스크린샷+grayscale+무늬
충돌표를 **별도 gate**로 둘 것. 무늬 알파를 낮추면 CVD 단서가 유지되는지도 테스트 필요.)

## 철회한 내 반박 2건 (지적 정직성 기록)
- **keepalive**: 나는 "태그 정의 저장은 명시적 모달이라 ADR-0006 밖"이라 했으나 **틀림**. ADR-0006은
  "**모든 편집 쓰기**는 `/api/studio-write` + keepalive, 새 쓰기는 dispatch op"라 명시. 현재
  `saveTagsAction` 직접 호출은 **현존 위반**. → recolor/저장을 studio-write dispatch op로.
- **CVD ΔE 수치**: 코덱스가 `audit-colors.mjs` 재실행해 실측(적색맹 0.8~8.4, 녹색맹 3.9~12, 청색맹
  8.7~10.3). 내 "미검증"은 정직함이지 반박 아님 → 수용. 무늬 유지의 근거로 오히려 채택.

## 확정 결정 (2026-07-18, 코덱스 3차 후)
- **무늬 유지**(색맹 단서). 커스텀 색도 CVD 위해 `pattern_key`를 갖는다(hue 근접 시 자동/선택).
- **가독성 = 텍스트 span scrim + 무늬 불투명도↓.** 제목/소제목을 감싸는 inline `<span>`에 **opaque/
  adaptive 배경(scrim)**을 주고(패딩 없어 flow 불변, **반드시 geometry 측정**). **text-shadow는
  scrim으로 불인정**(대비 보장 못 함). 무늬 알파 조정은 부차(현재 알파는 균일 9%가 아니라 indigo 34%·
  mint 10%·sky 11%·gen 8~10% — 색별 제각각이라 "일괄 5~6%"는 틀림. 무늬 위 잉크는 §무늬-잉크 계약 참고).
- **동적 굵기 그대로 유지**(안 건드림) → 스티커 지오 안전. 단 인기 기반(data-tier) 굵기와 색 기반
  굵기는 개념 분리(색 기반은 오늘 로직 그대로 보존).
- **커스텀 색 = `bg_hex` + `pattern_key`**(태그당). 없으면 `color_key`→palette 폴백(무중단). tone/glyph/
  mode 컬럼 없음. **무늬는 지금 `color_key` 문자열 CSS 셀렉터에 걸려 있어 커스텀 색엔 안 걸린다 →
  메커니즘 재작업 필요(§무늬 메커니즘).**
- **대비 = WCAG 2.1 AA 하드.** 잉크는 **순수 #000/#fff**(모든 불투명 단색 배경에서 ≥4.58) 또는
  실제 합성색 재계산; 2색 양쪽 실패 시 **opaque text-box scrim**. (v3의 "#0a0a0a+미정의 scrim이면
  항상 AA"는 거짓 — #777에서 흰 4.478/#0a 4.421 둘 다 실패. 코덱스 반례 수용.) APCA는 참고만.
- **쓰기 = studio-write dispatch op**(keepalive, ADR-0006 준수) + 서버 hex 검증.
- 롤백 = `bg_hex` 비우면 팔레트 폴백. **무늬 CSS·팔레트 그대로 유지하므로 mode 플래그 불필요**(v3의
  `tag_visual_mode` 삭제 — 디스코프의 최대 이득).

## 아키텍처 — 단일 resolver (레거시 정확 재현 계약)
`lib/tags/tag-visual.ts` (순수·서버/클라 공용, Map 1회 구축):
```
createTagVisualResolver(tags, palette)
  → visualOf(tagId): { rootTagId, kind, colorKey, bg, border, legacyTextColor, patternKey, missing }
  → visualOfDraft(tagId, draftGraph): 위와 동일 (미저장 draftTags/draftPalette overlay 입력)
resolveEventVisuals(tagIds, primaryTagIds, resolver): { fills(≤2), extras, order }  // month.ts:246~291 분배 이관
resolveInk(visual, textContext): { color, weight, shadow, scrim }  // visual = bg + effectivePattern(무늬 잉크·알파)
resolveMixedVisual(visA, visB, run, textContext) // 2색: 양쪽 대비 각각 검증
```
- 반환형은 union: **`MissingVisual | ResolvedVisual`**(missing이면 bg 등 없음 — 현재처럼 표면에서
  탈락할지 폴백할지 명시). `effectivePattern = { shape, ink: black|white, alpha }`(§무늬 메커니즘).
- **0A는 `eventInkStyle()`을 그대로 호출**(pixel 동일 — `--evt-weight/--evt-shadow` 포함 재현).
  `resolveInk()`로의 전환은 **0B로 한정**. resolveInk가 bg만 받으면 무늬 최악점을 못 재므로 visual을 받음.
- 이벤트 집계 dedup은 **첫 태그 우선(first-wins)·태그 순서 유지·같은 색 content/modifier 공존** 계약을
  golden test로 고정(Map이 last-wins라 순서 뒤집히면 카드색↔점 스왑됨).
- 고아 팔레트(색 없는 태그, 예: 활성 '기타' gen-plain)는 `missing:true`로 명시(현재 undefined 탈락).
- `textContext`는 최소 event-title / event-subtitle / chip-label 4.5:1 적용. 범례·insights·모바일
  타이틀은 태그 배경 위 텍스트가 아니라 잉크 대상 아님. export는 동일 DOM 캡처라 별도 context 없음.

## 무늬 메커니즘 재작업 (커스텀 색이 무늬를 받게) — 코덱스 4차 필수 지적
현재: DOM `data-color={color.key}`, CSS `[data-color="indigo"]`/`[data-color^="gen-diag-"]`, JS
`isPatternColor(colorKey)`. 즉 무늬가 **color_key 문자열**에 묶임. `color_key`는 NOT NULL이라 커스텀
`bg_hex` 태그도 옛 color_key의 **잘못된 무늬**를 계속 받는다. Phase 4가 bg_hex만 백필하면 pattern_key
NULL → "bg_hex면 pattern_key 사용" 계약상 **기존 무늬 전부 소실**.
- **DOM을 `data-pattern="diag|dots|grid|cross|dash|plain"`로 분리** — 단색·2색 `.evt-pat`·범례·피커·
  모바일 바·studio 전부. CSS를 pattern 기준으로 재작성.
- **pattern spec = `{ shape, ink: black|white, alpha }`** — shape만으론 부족: legacy indigo = **흰**
  대각선 **34%**, gen-diag = **검은** 대각선 **8%**. 같은 "diag"라도 잉크·알파가 달라 재현 불가.
- **effectivePattern precedence**: `bg_hex` 있으면 `pattern_key`, 없으면 `patternOf(color_key)`(레거시).
  `bg_hex`만 비우고 `pattern_key` 남았을 때 **무시**(원자적 reset 계약).
- 백필 시 pattern도 파생하거나, `pattern_key` NULL이면 color_key 파생 폴백 유지.

## 무늬-잉크 계약 (무늬 위 AA) — 코덱스 4차 수용
"순수 #000/#fff면 항상 AA"는 **불투명 단색에만** 참. 무늬 픽셀 포함 시 깨진다: 최악 crossover 배경
solid 4.583 → 같은 방향 잉크 5% 오버레이 후 ≈4.16~4.21, 6% 후 ≈4.08~4.14 → **AA 미달**. 그래서:
- `resolveInk(visual, ctx)`가 **무늬 합성의 최소/최대 luminance 양끝을 모두 4.5 검증**. 실패면
  **opaque scrim**(무늬까지 덮음). chip-label 등 무늬 걸린 텍스트도 이 계약 적용(0B 범위에 포함).

## Phase 순서

### Phase 0-pre — 선행
1. **공개 경계 분리**(실재 결합, 코덱스 4차 = 첫 슬라이스 No-go→범위 확장): `sampleStudioSchedule`를
   import하는 공개 코드는 **2곳** — `public-loader.ts`(9,21) + `app/api/public/[slug]/proposals/
   route.ts`(3). (broadcast route는 주석에 "studio-loader" 문자열만 있어 grep 오탐이었음 — 실제
   import 아님.) → `sample-public-data.ts`에
   공개 전용 fixture(calendar/tags/palette/events/campaigns/stickers/proposals) 배치, `sample-data.ts`가
   그걸 import해 studio 전용 private/draft로 확장(**역방향 import 금지**), 세 route 모두 studio sample
   import 제거. **import-boundary 테스트는 `app/(public)` + `app/api/public` 전체 트리 스캔**(한 파일
   아님). `toPublicEvent()` 직렬화 JSON을 golden으로 고정(isTentative:false·공개 campaign/sticker
   필터 누락 방지). studio 로더의 fallback viewerModePreview도 새 fixture로 golden parity 검증.
   → 이 슬라이스는 production DB·schema·UI geometry·write 경로 안 건드려 **독립 머지 가능**(저위험).
2. **비주얼 스위트 복구**: `test:visual`이 없는 `tests/visual`을 가리키고 config는 dev 서버. →
   **production build** Playwright suite + 고정 fixture(월/데이터/KST)·폰트 ready·애니 off·viewport/DPR
   고정·네트워크 격리. **decorate 인증**: 로컬은 Google identity 필요라 막힘 → **비프로덕션 fixture
   route**(`VISUAL_TEST_FIXTURE=1`일 때만 고정 public fixture로 PublicPoster(decorate) 렌더, 프로덕션
   404). 실제 권한은 별도 auth E2E. (프로덕션 auth bypass 금지.)

### Phase 0A — lookup 통일 (pixel 동일)
흩어진 색 lookup 전부 resolver로: 포스터/스튜디오 단색·2색 카드, modifier 점, 상세 chip, 피커, 범례,
모바일 바, 필터, insights(4곳), export. **출력 오늘과 완전 동일**(무늬·굵기 포함) → pixel+geo Δ0 증명.
JSX 직접 palette lookup 금지(lint/grep 가드). 계약 golden test(first-wins·순서·cross-kind 동일색·고아).

### Phase 0B — 가독성 수정 (작은 승인된 diff)
- 제목/소제목 **inline span 래퍼**(viewer/decorate 항상 렌더, background 유무만 토글) + **opaque/
  adaptive scrim**(무늬-잉크 계약) + 현재 AA 미달(모캡 3.43·리캡 3.45·카페 4.20 등) 잉크 교정.
  wrapped line 배경엔 `box-decoration-break:clone` 필요할 수 있음(browser/html2canvas 동일성 검증).
- **geometry Δ0 = 배포 hard gate**([data-export-surface]·42칸·카드·surface height·동일비율 스티커
  자연좌표 전부 Δ0 + clipboard PNG). **Δ0 아니면 이 구현 폐기**(스티커 재-baseline은 기존 사용자
  배치를 못 지킴 — 안전책 아님, 코덱스 수용). span은 flow 불변이 목표라 Δ0 달성 가능성 높음(측정 확정).

### Phase 1 — 데이터 모델
```
ALTER TABLE broadcast_tags
  ADD COLUMN bg_hex text CHECK (bg_hex IS NULL OR bg_hex ~ '^#[0-9a-fA-F]{6}$'),
  ADD COLUMN pattern_key text
    CHECK (pattern_key IS NULL OR pattern_key IN ('plain','diag','dots','grid','cross','dash')),
  ADD CONSTRAINT tag_child_no_color
    CHECK (parent_id IS NULL OR (bg_hex IS NULL AND pattern_key IS NULL));  -- 자식은 색·무늬 둘 다 상속
-- 적용 전 preflight SELECT로 위반 0 확인(현재 21행 전부 NULL·자식 0개 → 통과).
```
effectivePattern precedence: `bg_hex` 있으면 `pattern_key`, 없으면 `patternOf(color_key)`. 모든 로더/
매퍼/타입/공개 sample/insights(4맵) 같은 단위 갱신.

### Phase 2 — 서버 쓰기
`/api/studio-write`에 `saveTags`/`recolorTag`/`removeTag` **dispatch op 추가**(ADR-0006), 응답에
`created[]` 지원. bg_hex **서버 hex 검증·정규화**, 이름/payload 길이 상한. 권한 owner/developer(기존
검사) + **롤 테스트**(manager/trusted/viewer 실패). **reparent(top→child) 시 bg_hex 같은 SQL로 NULL.**

### Phase 3 — 피커
`components/tags/color-wheel.tsx`: HSLuv 색환(hue 링 + S/L) + 톤 프리셋 4단(hue 전수 검증표) +
실시간 카드 미리보기 + 대비 배지(WCAG; APCA 참고). **무늬 자동 배정 = 실제 CVD 충돌 그래프**(코덱스
4차 — `pickPattern`은 hue 아닌 전역 최소사용 무작위라 재사용 불가): 새 색을 protan/deutan/tritan
변환→활성 root와 ΔE 비교→ΔE<12 이웃과 **다른 무늬를 결정적 배정**, 후보 소진 시 저장 전 경고+수동.
서버도 무늬 enum·충돌 검증(랜덤 금지). + CVD hue 경고 + 색약 3종 시뮬. 저장 = bg_hex + pattern_key
(studio-write op). 톤은 UI 전용(hex→HSLuv→가까운 프리셋 표시).

### Phase 4 — 백필 (선택·지연 가능)
팔레트 폴백이 남아 **필수 아님**. 하려면 `color_key`→`bg_hex` 복사 + **LEFT JOIN preflight**(고아 탐지
→abort). `audit-colors.mjs` INNER→LEFT 수정.

## 테스트 게이트
잘못된/3·8자리 hex, 경계 luminance, mixed 양쪽 대비, 자식 상속·reparent NULL, first-wins·순서·
cross-kind 동일색·고아, 모든 표면 동일 resolver, **0A pixel+geo Δ0 / 0B geo Δ0 hard gate**, browser/
official PNG, role matrix, import-boundary, 공개 DTO schema.

## 판정 (코덱스 4차: Go-with-fixes)
디스코프로 3차 STILL-OPEN 중 글리프(REGRESSED)·굵기제거 지오·mode 롤백이 소멸. 4차가 남긴 필수 보정을
v4.1에 반영: ①첫 슬라이스에 proposals+broadcast route 포함 + 공개 전체트리 import guard + fallback
golden parity ②**무늬 메커니즘 재작업**(data-pattern + {shape,ink,alpha}, precedence, CHECK, 백필 파생)
③무늬 위 AA(resolveInk가 visual 받아 합성 양끝 검증+opaque scrim) ④무늬 자동배정=CVD 충돌그래프
⑤0A는 eventInkStyle 그대로(resolveInk는 0B) ⑥사실오류 정정(무늬 알파 색별 상이·audit는 solid만·
pickPattern 무작위).
- **착수 순서**: Phase 0-pre **첫 슬라이스(공개 sample/type 분리)** 부터 — production DB·schema·UI
  geometry·write 안 건드려 독립·저위험. **pattern_key CSS 재작업·무늬 자동배정은 Phase 1 진입 전 필수.**
- 무늬 텍스처 자체가 여전히 거슬리면 → 가독성 배포 후 반응 보고 "무늬 제거+글리프+지오"를 **별도 예산
  프로젝트**로(지금 끼워넣지 않음).
