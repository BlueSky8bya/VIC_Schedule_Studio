# 태그 2-tier(테두리/채움) + 휴뱅 잠금 — 구현 계획서

작성: 2026-05-31 · 상태: 설계 확정, 구현 전

## 1. 배경 / 문제

지금은 한 일정 카드 = **태그 2개 = 색 2개(그라데이션)** 가 전부다. 그래서 방송의
서로 다른 두 축이 같은 슬롯을 두고 경쟁한다.

- **형식/규모 축** (어떻게/어디서 방송하나): 합방, 풀트뱅, 짧뱅, 대회, 타스뱅 출연…
- **내용/소재 축** (무엇을 하나): 소통뱅, 노래뱅, 종겜, 시참, 서버…

예) `짧뱅 + 소통뱅 + 노래뱅` → 표현할 게 3개인데 2개만 들어가서 애매. 휴뱅도 평범한
태그라 다른 태그와 충돌(휴뱅인데 타 스트리머 방송 출연 = 휴뱅+타스뱅을 못 그림).

## 2. 벤치마킹 요약

- **Notion 분류 패턴**: 단일선택(Select)=한 개만 고르는 "분류", 다중선택(Multi-select)=
  여러 개 붙이는 "라벨". 우리 모델과 1:1 대응 → **테두리=단일(형식 분류)**,
  **채움=다중(내용 라벨, 최대 2)**.
- **데이터 시각화 double/redundant encoding** (color + border 두 채널):
  - 두 채널을 분리해 두 변수를 인코딩하는 건 권장. 색맹 접근성에도 유리.
  - 단 **두꺼운 테두리/과한 외곽선은 데이터에서 시선을 뺏으니 금지** → 테두리는
    "굵은 링"보다 **절제된 강조 링**으로.
  - 효과는 **카테고리 5~8개**에서 가장 큼 → 테두리(형식) 태그는 5~8개 이내로 유지.

출처:
- https://data.europa.eu/apps/data-visualisation-guide/double-encoding
- https://www.displayr.com/improve-the-quality-of-data-visualizations-using-redundancy/
- https://noteforms.com/notion-glossary/multi-select

## 3. 최종 모델 — 시각 채널 3개

| 채널 | 의미 | 카드당 | 표현 |
|---|---|---|---|
| 🎨 채움(fill) | 내용/소재 | 0~2 | 카드 배경색. 2개면 그라데이션(현행 유지) |
| 🟥 테두리(highlight) | 형식/규모 | 0~1 | 절제된 강조 링(외곽) |
| 🩶 휴뱅(system) | 본인 방송 없음 | 0~1 | 채움을 회색 고정·내용 채움 무시. 테두리는 그대로. 출연처는 본문 텍스트 |

### 케이스별 렌더

| 케이스 | 채움 | 테두리 |
|---|---|---|
| 일반 (소통+노래) | 소통↔노래 그라데이션 | 짧뱅 링(있으면) |
| 휴뱅 단독 | 전체 회색 | 없음 |
| 휴뱅 + 타스뱅 출연 | 회색 | 타스뱅 색 링 + 본문 텍스트 |
| 휴뱅 + 대회 출연 | 회색 | 대회 색 링 + 본문 텍스트 |

### 태그 분류 시작값 (편집기에서 언제든 변경 가능)

현재 시드(db/seeds/0008_default_tags_v2.sql) 13종 기준 추천 분류:

| tag_key | 이름 | 색 | tier(추천) | 비고 |
|---|---|---|---|---|
| dayoff | 휴뱅 | gray | **system** | 잠금 |
| collab | 합방 | lavender | **highlight** | 형식 |
| full_track | 풀트뱅 | pink | **highlight** | 형식 |
| tournament | 대회 | indigo | **highlight** | 형식/이벤트 |
| worldcup | 구플뱅 | orange | highlight? | owner 판단(형식성 강함) |
| big_server | 서버 | blue | fill | 내용(서버 컨텐츠) — owner 판단 |
| variety_game | 종겜 | yellow | fill | 내용 |
| song | 시참의날 | sky | fill | 내용 |
| hype | 소통뱅 | lime | fill | 내용 |
| calm | VRChat | mint | fill | 내용 |
| ck | CK | red | fill | 내용 |
| cineti | 시네티 | teal | fill | 내용 |
| easy | 기타 | beige | fill | 내용 |

> 향후 owner가 추가할 **짧뱅·타스뱅송·노래뱅** 등은 짧뱅·타스뱅=highlight(형식),
> 노래뱅=fill(내용)이 기본 방향. 테두리(highlight)는 5~8개를 넘기지 않도록 유지.

## 4. 데이터 모델 변경 (최소)

핵심: **tier는 태그 자체의 속성**이므로 `broadcast_tags`에만 컬럼 추가.
`event_tags`는 스키마 변경 없이, 렌더 시 각 태그의 tier로 역할을 파생한다.

- `broadcast_tags.tier text not null default 'fill'` 추가. 값: `'highlight' | 'fill' | 'system'`.
- 휴뱅(`tag_key='dayoff'`)을 `tier='system'`로, 위 표대로 나머지 분류.
- `event_tags`: **무변경**. `is_primary`는 더 이상 색 결정에 쓰지 않음(현재도 사실상
  전부 primary라 무의미). 향후 정리 대상이되 이번엔 그대로 두고 무시.
- 용량 규칙(앱 레벨): 한 일정에 highlight ≤1, fill ≤2, system ≤1.

마이그레이션 파일: `db/migrations/00XX_tag_tier.sql`
(idempotent, `add column if not exists` + tag_key별 update). 적용:
`node scripts/apply-db.mjs db/migrations/00XX_tag_tier.sql`

## 5. 레이어별 변경안 (현재 → 변경)

### 5.1 타입 / 도메인 — lib/domain/schedule-types.ts
- `BroadcastTag`에 `tier: 'highlight' | 'fill' | 'system'` 추가.
- `BroadcastTag`에 잠금 표식 `isLocked?: boolean`(또는 `isSystem`) 추가 — 편집기/서버에서 사용.
- `PublicScheduleEvent`/`StudioScheduleEvent`의 `tagIds`/`primaryTagIds`는 유지(파생은 렌더에서).

### 5.2 데이터 로더 — lib/schedules/public-loader.ts, studio-loader.ts
- `broadcast_tags` select에 `tier` 컬럼 추가(두 로더의 `mapTag` 모두).
  - public-loader: 약 131–136행 select, 309–327행 `mapTag`.
  - studio-loader: 약 105–109행 select, 매핑부.
- event_tags 쿼리는 그대로(`tag_id, is_primary, sort_order`).
- **경계 점검**: tier는 비밀 데이터가 아니므로 공개 DTO에 노출 OK. 단
  .claude/rules/public-private-boundary 준수 — 명시적 DTO 구성 유지(스프레드 금지).

### 5.3 공개 API — app/api/public/[calendarSlug]/events/route.ts
- 변경 거의 없음. 태그에 tier 필드가 따라 나가는지만 확인(공개 안전).

### 5.4 색 함수 — lib/calendar/month.ts (핵심)
현재 `getEventTagColors`(182–194)가 색 ≤2개를 한 번에 반환 → **역할별로 분리**:

- `getFillColors(event, tags, palette): ColorPaletteEntry[]`
  - 이벤트 태그 중 `tier==='system'`(휴뱅) 있으면 → `[gray]` 반환(내용 채움 무시).
  - 아니면 `tier==='fill'` 태그 색 ≤2 반환(현행 그라데이션 로직 그대로).
- `getHighlightColor(event, tags, palette): ColorPaletteEntry | null`
  - `tier==='highlight'` 태그(첫 1개) 색 반환.
- `eventColorStyle`(196–207), `mixedEventStyle`(333–359), `mixedPatternMaskStyle`(364–383)는
  **fill 색**을 입력으로 그대로 사용.
- `getEventTagColors`는 내부적으로 `getFillColors`로 위임하거나 deprecate.
- `getRepresentativeTagColors`(531–555, 레전드 요약)도 fill 기준으로 정리.

### 5.5 카드 렌더 — 채움 + 테두리 링 레이어
적용 지점 3곳 모두 "fill = 배경, highlight = 외곽 링" 2레이어로:

- **스튜디오 데스크톱 pill**: components/studio/studio-shell.tsx 3259–3386.
  - `const fill = getFillColors(...); const ring = getHighlightColor(...);`
  - 배경 스타일은 fill로(기존 `eventColorStyle`/`mixedEventStyle`).
  - ring 있으면 `data-ring-color`/CSS 변수로 외곽 링 추가.
- **스튜디오 모바일 agenda-bar**: studio-shell.tsx 2357–2479.
  - `.agenda-bar` 배경 = fill, 링은 카드 좌측 막대/외곽으로 표현(모바일 컴팩트 고려).
- **공개 포스터**: components/poster/public-poster.tsx 캘린더 그리드 렌더.
  - 동일 2레이어. 포스터/익스포트에도 테두리 링 노출(시각 정보 — 어드민 UI 아님,
    .claude/rules/export 위반 아님).

### 5.6 CSS — components/studio/studio-shell.css, public-poster.css
- 새 규칙: `.studio-event-pill[data-ring] { box-shadow/outline 절제된 링 }`
  - 벤치마킹대로 **두껍지 않게**. 예: `outline: 2px solid var(--ring); outline-offset: -1px`
    또는 안쪽 box-shadow ring. 기존 비공개 점선 outline(embargo/work, 2872행 근처)과
    충돌하지 않게 레이어 분리(점선 outline vs 색 링).
- 모바일 `.agenda-event` 링 변형 규칙.
- 기존 `.filter-dim`, `.just-saved`, gradient(`[data-mixed]`) 규칙은 유지.

### 5.7 태그 편집기 — components/tags/tag-legend-editor.tsx
- **tier 토글 추가**: 각 행(506–564) 색 스와치와 삭제 버튼 사이에
  "테두리/내용" 세그먼트 토글. `Draft`에 `tier` 필드 추가, `TagUpdate`/`TagCreateInput`에 tier 추가.
- 새 태그 생성(334–355 `addTag`) 시 기본 `tier='fill'`.
- 저장(420–485 `saveAll`)에서 tier를 updates/creates에 포함.
- **휴뱅(system) 잠금**: `isLocked`이면 그 행에서
  - 이름 input 비활성(526), 색 스와치 비활성(533–551), tier 토글 비활성,
    삭제 버튼 숨김/비활성(552–561), **드래그 핸들 제거**(517–525, 순서 이동 불가).
  - 잠금 아이콘 + 안내. 항상 목록 최상단 고정.
- 읽기전용/필터 모드(278–324)는 5.10에서 재구성.

### 5.8 이벤트 태그 피커(2구역) — components/studio/studio-shell.tsx
- `toggleEventTag`(1522–1552)를 tier 인식으로 분리:
  - highlight 태그 누름 → 기존 highlight 교체(단일선택, 0/1).
  - fill 태그 누름 → 기존 ≤2 로직.
  - system(휴뱅) 누름 → 토글. 켜지면 내용(fill) 선택 비활성/회색 처리.
- 데스크톱 피커(1595–1629)와 모바일 시트(2637–2693)를 **두 섹션**으로:
  - "형식(테두리) · 1개" 단일선택 그룹.
  - "내용(채움) · 최대 2개" 그룹(휴뱅이면 비활성).
  - 휴뱅 토글은 별도 위치(상단) — "이 날 본인 방송 쉼".
- `primaryTagIds`는 호환을 위해 `tagIds`와 동일하게 보내되 렌더는 tier 파생을 사용.

### 5.9 서버 액션 — lib/schedules/event-actions.ts, tag-actions.ts
- `updateEventTagsAction`(360–411): `slice(0,2)` 제거 →
  **tier별 검증**(서버에서 태그 tier 조회 후 highlight ≤1, fill ≤2, system ≤1로 정리).
  매니저 권한 경계는 그대로.
- `saveEventAction`(157–273)의 태그 저장부(228–241)도 동일 규칙.
- `updateTagAction`/`saveTagsAction`/`removeTagAction`/`updateTagsAction`:
  **`isLocked`(휴뱅) 대상 수정·이름변경·색변경·순서이동·삭제 요청을 서버에서 거부**
  (클라 잠금만으론 안 됨 — CLAUDE.md 규칙). tier 변경도 휴뱅엔 불가.
- tier 값 화이트리스트 검증(`'highlight'|'fill'|'system'`), system은 생성 불가(휴뱅 고정).

### 5.10 색상 필터(레전드) — tag-legend-editor.tsx 읽기전용(278–324) + 사용처
- 레전드를 **"형식(테두리)" / "내용(채움)" 두 섹션**으로 그룹화, **휴뱅 별도 핀**.
- 필터 매칭: 선택된 태그가 highlight면 그 형식의 이벤트, fill이면 그 내용의 이벤트.
  `isDimmedByFilter`(studio-shell.tsx 약 423–431) 로직은 tagIds 매칭 그대로라 동작하나,
  섹션 구분 표시만 추가.
- 사용처: studio-shell 좌측 패널(3114–3123), 공개 포스터 레전드.

### 5.11 인사이트 통계 — lib/insights/actions.ts (가장 큰 영향, 반드시 재설계)
현재 태그 집계는 모두 "태그를 한 덩어리"로 본다. tier 분리 후 **형식/내용은 다른 축**이라
한 랭킹에 섞으면 의미가 깨진다. 변경:

1. **휴뱅 식별 견고화**: 현재 `display_name === REST_TAG`(이름 비교)로 제외하는 곳
   (getInsightsAction 262–328, getMemberInsightsAction 1314–1332, public-poster 935–952)을
   모두 **`tier==='system'`(또는 `tag_key==='dayoff'`)** 기준으로 교체. 이름 바뀌어도 안 깨지게.
2. **"이번 달 컨텐츠 순위"**(getInsightsAction 302–328, member 1314–1332):
   - 추천안: **내용(fill) 태그만 집계** = "무슨 컨텐츠가 많았나"의 본래 의미에 충실.
   - 추가로 작은 **"방송 형식 분포"(테두리 태그)** 위젯 신설(도넛/막대).
3. **6개월 트렌드**(getTrendAction 608–658, member 1286–1426):
   - `contentByTag` → **fill 트렌드**로(내용 축).
   - 선택: `formatByTag`(highlight 트렌드) 신설. 휴뱅 일수는 별도 "휴뱅 추이"로 빼도 좋음.
   - `heartsByTag`도 fill 기준(어떤 내용이 하트를 받나).
4. 소비 컴포넌트: components/developer/insights-dashboard.tsx(301, 670–699),
   components/studio/member-insights.tsx(377–383), StackTrendChart의 데이터 키/범례 조정.

> 이 부분은 "통계 한 개를 둘로 나눌지(형식/내용)" 제품 결정이 필요 — 6절 열린 결정 참조.

### 5.12 샘플/시드 데이터
- lib/schedules/sample-data.ts `defaultTags`(26–40)에 tier 추가, 위 분류 반영.
- db/seeds: 신규 시드 또는 마이그레이션에서 tag_key별 tier 세팅(0008과 정합).
- 샘플 이벤트(55–150)는 그대로 두되, 가능하면 highlight+fill 조합 예시 1~2개 추가.

## 6. 휴뱅 잠금 상세 (요구사항)

- 이동(순서)·이름변경·색변경·tier변경·삭제 **전부 불가** — 편집기 UI 비활성 + 서버 거부.
- 항상 존재(시스템 태그). 회색 고정.
- 휴뱅은 내용(fill)과 공존하지 않음(붙으면 fill 무시·회색). 단 highlight(형식) 링은 공존 →
  "휴뱅 + 타스뱅 출연" 표현. 출연 상세는 일정 제목 텍스트.
- 하트 집계에서 휴뱅 일정 제외 로직 유지하되 `tier==='system'` 기준으로.

## 7. 마이그레이션 / 데이터 정합

- 기존 event_tags는 변경 없음 → 기존 일정은 각 태그의 새 tier로 자동 재해석.
  - 두 태그가 [형식, 내용]이던 일정 → 테두리+채움으로 자연 분해(개선).
  - 두 태그가 [내용, 내용]이던 일정 → 그라데이션 유지.
  - 두 태그가 [형식, 형식]이던 드문 일정 → 렌더는 첫 highlight만 링으로(나머지 무시).
    데이터 정리는 선택(필수 아님). 발생 빈도 낮음.
- 롤백: tier 컬럼 default 'fill'이라 컬럼만 무시하면 구버전 동작과 호환.

## 8. 회귀 체크리스트 (CLAUDE.md Evaluator)

- 생성/드래그이동/순서변경/저장 순서 — 낙관적 큐 유지(keepalive 경로 studio-write/sticker-write).
- 낙관적 상태 vs 서버 props 동기화(태그 토글 후 revalidate 덮어쓰기 없는지).
- 버튼 활성 범위 — tier 토글/잠금이 무관한 액션(새 카드 등) 막지 않게(narrow gating).
- 모바일 컴팩트: 2구역 피커·링이 좁은 폭에서 넘치지 않게(라벨 축약).
- 공개/비공개 경계: tier가 공개 안전, 비밀 누출 없음.
- 포스터/익스포트: 링 포함 깨끗(어드민 UI 없음).
- 디자인 통일: 링 두께·여백 좌우 대칭, 기존 점선 outline과 충돌 없음.
- 인사이트: 휴뱅 제외 정확, 형식/내용 분리 집계 정확.

## 9. 단계별 실행 순서 (PR 분할 제안)

1. **PR1 — 모델 토대**: 마이그레이션(tier) + 타입 + 로더 select + 시드 분류. (렌더 영향 0,
   tier만 흘려보냄) → build·경계 점검 후 머지.
2. **PR2 — 렌더 분리**: month.ts(getFillColors/getHighlightColor) + 카드 3곳 링 + CSS.
   시각만 바뀜.
3. **PR3 — 편집기/피커/서버**: tier 토글, 2구역 피커, 휴뱅 잠금(클라+서버), 액션 검증.
4. **PR4 — 인사이트 재설계**: 휴뱅 식별 교체 + 형식/내용 분리 통계 + 차트.
5. **PR5 — 필터 레전드 2섹션 + 마무리 QA**.

각 PR: TypeScript + lint + `next build` 통과, 공개/비공개 경계 재확인 후 commit/push(main).

## 10. 열린 결정 (착수 전 확인)

1. **통계 분리 방식**: "컨텐츠 순위"를 (a) 내용(fill)만 집계 + 형식 분포 위젯 신설
   vs (b) 형식/내용 두 랭킹 나란히 vs (c) 기존처럼 합쳐서. → 추천 (a).
2. **테두리 링 스타일**: 절제된 실선 outline vs 안쪽 glow ring. → 추천 절제된 실선(접근성/명료).
3. **구플뱅/서버 tier**: highlight(형식) vs fill(내용) — owner 판단 필요.
4. **휴뱅+형식 본문 표기 가이드**: "휴뱅 (○○ 뱅송 출연)" 문구 컨벤션 고정 여부.
