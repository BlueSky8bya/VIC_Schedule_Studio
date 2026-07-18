# 태그 색 커스텀화 계획 v3 — 3계층 resolver + 커스텀 색 + 무늬→글리프 + WCAG 자동 글자

작성: 2026-07-18 · 상태: **계획(미구현)** · **v3가 v2를 supersede**(코덱스 2차 리뷰 Go-with-fixes 반영).
관련: `lib/calendar/month.ts`, `lib/tags/color-gen.ts`, `lib/schedules/{public,studio}-loader.ts`,
`lib/insights/actions.ts`, `components/tags/tag-legend-editor.tsx`, `app/globals.css`,
ADR-0004(지오), ADR-0006(keepalive), `.claude/rules/public-private-boundary.md`

## 정정 이력 (2라운드 적대 리뷰 — 다음 에이전트가 같은 착각 안 하게)
- v1 FALSE 5건: hex 배관 "이미 있음"(신규 gen 태그 INSERT뿐)·자동잉크 "모든 경로"(#RRGGBB만·2색
  첫색만·칩/범례/insights 미적용)·무늬 "파스텔용"(실은 **색맹 단서 WCAG 1.4.1**)·백필=렌더불변(X)·
  롤백 안전(팔레트행+CSS 필요).
- v2 잔여 5건(코덱스 2차): ①단일 resolver 시그니처로 draft·2색·표면별 scrim 표현 불가 ②CVD 편집자
  도구는 **시청자에게 안 남음**(1.4.1 미보상) ③고아 '기타'(palette 행 없음)로 백필 오판 ④"pixel 동일"과
  "AA 미달 수정"이 모순 ⑤tone 저장 여부 미확정. + 동적 font-weight가 지오 결합을 만든다(신규).

## 확정 결정 (2026-07-18, 코덱스 2차 후)
- **글자색 = 자동, 단일 잉크 로직을 모든 표면에.** (칩·범례·insights 포함)
- **동적 font-weight 제거.** APCA advisory인 이상 굵기를 색으로 바꾸지 않는다 → 굵기는 **표면 CSS
  고정값**, 대비는 **잉크색 + scrim(텍스트 뒤 헤일로)** 로만 확보. **이러면 recolor가 glyph 폭·
  줄바꿈·카드높이·스티커 좌표에 영향을 주지 않는다**(ADR-0004 결합 자체 제거).
- **무늬(체크 텍스처) 전면 제거 + 대체 = 작은 글리프/이니셜.** 태그마다 1개 아이콘 또는 1~2자
  이니셜을 **카드 구석 + 범례**에 지속 표시(비색상 단서 = WCAG 1.4.1 충족, 글자와 안 싸움).
  글리프는 export/decorate/viewer 동일.
- **대비 = WCAG 2.1 AA 하드.** 동적 굵기 없이 잉크+scrim이면 임의 bg에서 AA는 **항상 달성 가능**
  (최악도 흑/백+scrim) → "AA 실패 저장"은 없다(동의 예외 없음). APCA는 참고 지표만.
- **톤 컬럼 저장 안 함.** hex가 유일 진실. 프리셋(파스텔/부드럽게/선명/깊게)은 **피커 입력 UI 전용**;
  피커 재열 때 hex→HSLuv→가장 가까운 프리셋을 표시만. polarity(흰/검 글자)는 luminance에서 산출.
- **백필 = 팔레트 hex 복사** + **LEFT JOIN preflight**(고아 0건 assertion, 고아 시 abort).
- **의존성**: HSLuv 공식 JS(MIT) OK. APCA 공식 lib 안 씀(라이선스·beta). 공유 파생 모듈이 client
  poster 번들에 들어가는 크기 확인.

## 아키텍처 — resolver 3계층 (단일 시그니처 폐기)
`lib/tags/tag-visual.ts`:
```
createTagVisualResolver(tags, palette, mode)   // 1회 Map 구축(반복 find() 회피)
  → visualOf(tagId): { bg, border, glyph }     // 색 원천 + 상속(자식→최상위 부모) + 글리프
  → visualOfDraft(draft): { bg, border, glyph } // 미저장 피커 색(tags에 없음) 지원
resolveInk(bg, textContext)                     // 표면별 글자크기/scrim 판단, WCAG AA 잉크
resolveMixedVisual(visualA, visualB, run, textContext) // 2색 카드: 양쪽 대비 각각 검증
```
- **상속·modifier·2색·draft·표면별 컨텍스트**가 각 계층에 명확히 분리(코덱스 지적 해소).
- `mode`(legacy|custom)로 롤백 분기(아래 Phase 3).
- 자식 태그는 색을 못 가짐 — DB CHECK로 강제 + 서버가 무시.

## Phase 순서

### Phase 0-pre — 선행 정지작업
1. **공개 경계 분리**: `public-loader`가 `StudioScheduleEvent`·`sampleStudioSchedule`를 실제로 import
   (변환은 sanctioned지만 색 DTO 확장이 이 공유물을 건드림). → `sample-public-data.ts`로 공개 전용
   sample/type 분리 + **import-boundary 테스트**(public-loader가 studio-loader/service-role/studio
   sample 미import) + **공개 tag DTO schema 테스트**(bgHex 형식·private 필드 부재 구조 검증).
2. **비주얼 스위트 복구**: `test:visual`이 없는 `tests/visual`을 가리킴. **production build** 기반
   Playwright suite 신설 — 고정 fixture(월/데이터/KST), 폰트 ready, 애니메이션 off, viewport·DPR
   고정, 네트워크 격리, snapshot 갱신 승인 규칙. **decorate는 로컬 인증 막힘** → 전용 테스트 계정+
   storageState 또는 PublicPoster(decorate)를 fixture로 렌더하는 비프로덕션 harness(**프로덕션 auth
   bypass 금지**).

### Phase 0A — lookup 통일 (pixel 동일, 값어치 독립)
- 흩어진 색 lookup을 전부 `tag-visual.ts` resolver로 이관: 포스터/스튜디오 단색·2색 카드, modifier 점,
  상세 chip, 피커, 범례, 모바일 바, 필터, insights(4곳), export.
- **출력 = 오늘과 완전 동일**(동적 굵기·무늬 포함 그대로) → **pixel + geometry diff 0** 로 증명.
  순수 리팩터라 시각 변화 없음. JSX 직접 palette lookup 금지(lint/grep 가드).

### Phase 0B — 의도된 시각 변경 (승인된 diff)
- (i) **AA 미달 수정**: 현재 모캡 3.43·리캡 3.45·카페 4.20 등 잉크 교정 → 그 태그 글자색만 바뀜.
- (ii) **동적 굵기 제거**: 표면 CSS 고정 굵기로 정규화 + scrim 도입. **일회성 지오 변경** →
  변경 전/후 [data-export-surface]·42칸·카드·**동일 비율 스티커 자연좌표**를 각각 비교(전부 Δ0 요구,
  스티커는 이 배포에서 한 번 재-baseline). 이후 커스텀 색은 굵기 불변이라 지오 영구 안정.
- 두 변경 모두 **승인된 expected pixel diff**(0A의 불변과 명확히 구분).

### Phase 1 — 데이터 모델
```
ALTER TABLE broadcast_tags
  ADD COLUMN bg_hex text CHECK (bg_hex IS NULL OR bg_hex ~ '^#[0-9a-fA-F]{6}$'),
  ADD COLUMN glyph  text CHECK (glyph IS NULL OR char_length(glyph) <= 4),
  ADD CONSTRAINT tag_child_no_color
    CHECK (parent_id IS NULL OR bg_hex IS NULL);   -- 자식은 색 못 가짐(상속)
-- tone 컬럼 없음(hex가 진실). 적용 전 동일 preflight SELECT로 위반 행 0 확인(현재 21행 전부 NULL→통과).
```
- `bg_hex` 있으면 resolver가 그걸, 없으면 `color_key`→palette(폴백). 모든 로더/매퍼/타입/sample
  (`public-loader`·`studio-loader`·`insights/actions`(4맵)·분리된 공개 sample)을 같은 단위로 갱신.

### Phase 2 — 서버 쓰기
- **recolor를 기존 `saveTagsAction` 경로에 통합**(별도 action이면 dayoff 잠금·calendar scope 재구현
  필요 → 통합이 나음). bg_hex는 **서버에서 6자리 hex 검증·정규화**, glyph 길이 검증. text/border/
  굵기 저장 안 함(resolver 파생). 권한 owner/developer(기존 검사 재사용) + **롤 테스트**(manager/
  trusted/viewer 실패). **reparent(top→child) 시 bg_hex를 같은 SQL로 NULL**(CHECK 실패 방지).
  - 주: 태그 정의 저장은 명시적 "전체 저장" 모달이라 ADR-0006(per-toggle 낙관적 keepalive) 범위 밖 —
    기존처럼 server action 직접 호출 유지(코덱스의 keepalive 강제는 과적용, 채택 안 함).

### Phase 3 — 피커 + 무늬 제거 + 글리프 (동시)
- `components/tags/color-wheel.tsx`: **HSLuv 색환**(hue 링 + S/L 좌표, Clip Studio식) + 톤 프리셋 4단
  (hue 전수 검증표로 밴드 확정, 예시값 아님) + **실시간 카드 미리보기 + 대비 배지**(WCAG, APCA 참고) +
  **글리프/이니셜 선택** + **CVD: hue<20° 경고 + 색약 3종 시뮬**(편집 보조).
- 무늬 CSS 제거 + **글리프를 카드/범례에 지속 렌더**(비색상 단서 = 시청자 1.4.1 충족).
- 롤백: `calendars.tag_visual_mode = legacy|custom`. 공개/studio DTO에 mode 전달, resolver가 mode로
  bg_hex↔palette 선택, DOM `[data-tag-visual-mode]`, **legacy mode에서만 무늬 CSS 활성**, custom write는
  custom mode에서만, mode 변경 시 `revalidatePublicSchedule()`. (env 플래그는 재배포 필요 → 부적합.)

### Phase 4 — 백필 (선택)
`color_key`→`bg_hex` 복사. **LEFT JOIN preflight**(고아 '기타' 등 palette 없는 행 탐지→abort 또는
명시 처리). 무늬 gen 10개(소통·풀트·서버·게임·합방·타스뱅송·CK/핀볼·대회·월드컵·시네티)는 단색화로
시각 변함 → 전후 CVD·PNG baseline 승인. `audit-colors.mjs` INNER→LEFT JOIN 수정, sample·운영 스크립트 갱신.

## 테스트 게이트 (착수 조건)
잘못된/3·8자리 hex, 경계 luminance, mixed 밝음/어두움 양쪽 대비, 자식 상속, reparent 색 NULL,
CVD 혼동쌍, 모든 표면 동일 resolver, **0A pixel+geo Δ0 / 0B 승인 diff + 스티커 절대좌표 Δ0**,
browser/official PNG, role matrix, legacy↔custom 롤백, 고아 백필 preflight, import-boundary, 공개 DTO schema.

## 착수 전 blocker (코덱스 2차 목록 = 전부 v3에 반영)
① 0A/0B 분리 ② resolver 3계층+draft ③ 동적 굵기 제거 ④ production visual fixture+decorate 인증
⑤ 무늬 대체 = 지속 글리프(경고·시뮬만으론 배포 금지) ⑥ tone 미저장 ⑦ 롤백 mode의 DB·DTO·DOM·CSS 분기.

## 판정
코덱스 2차 **Go-with-fixes 수용**. 7개 blocker를 v3 설계에 흡수. **Phase 0-pre부터 착수 가능**
(공개 경계 분리 + 비주얼 스위트 = 시각 변화 0, 안전망부터).
