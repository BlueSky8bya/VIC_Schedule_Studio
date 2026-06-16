# 방송 태그 2-tier(테두리/채움) + 휴뱅 잠금 — 설계·구현 명세 보고서 (v3)

- 문서 종류: 설계 명세(Spec) — 구현 전, 외부 검토(LLM/사람) 가능하도록 자기완결적으로 작성
- 작성일: 2026-05-31 (KST)
- 대상 제품: VIC Schedule Studio (스트리머 방송 일정 스튜디오, Next.js + Supabase)
- 상태: 설계 확정(§3 결정 잠금) · 구현 미착수
- 버전 이력:
  - v1: 초안(`docs/tag-tier-plan.md`)
  - v2: 외부 LLM 검토안 — **연결/paint-group 영향**을 추가로 발견(정확). 단 그 해결책
    "signature 완전일치 연결"은 기존 이음새 동작을 회귀시킴(오류).
  - **v3(본 문서)**: v1의 설계근거·검토질문 + v2의 연결/테스트/롤백 보강을 병합하고,
    연결 해결책을 **"fill 기준 대표태그 재정의"**로 교정.

---

## 0. 검토자용 빠른 안내 (How to verify)

두 종류의 검토자를 가정한다.

1. **코드 접근 없는 검토자(LLM)**: §1~§4, §12(설계 근거), §15(리스크), §17(검증 질문)으로
   설계의 논리 일관성·UX·정보구조·통계 의미를 검증.
2. **코드 접근 있는 검토자**: §5~§11의 파일·함수·라인 참조와 제안 로직이 현재 코드와
   일치하는지, 누락 레이어가 없는지 검증. 특히 §7(연결/paint-group)이 핵심.

검토자가 답할 질문은 §17에 모았다.

### 핵심 한 줄 요약

"카드 태그 최대 2개 = 배경색 2개" 구조를 **채움(fill, 내용, ≤2 그라데이션) + 테두리
(highlight, 형식, ≤1 절제된 링) + 휴뱅(system, 회색 고정·잠금)** 3채널로 분리한다.
DB 변경은 `broadcast_tags.tier` 컬럼 1개. `event_tags`는 무변경. **단, 색 계산과
이음새/병합 판단이 같은 "대표 태그" 기준을 공유하므로 둘을 함께 옮긴다(§7).**

---

## 1. 문제 정의

### 1.1 현재 동작 (확인된 사실)

- 한 일정은 태그 최대 2개. 색 계산은 `lib/calendar/month.ts`
  `getEventTagColors`(182–194): `primaryTagIds || tagIds`를 2개로 잘라 색 반환.
  2색이면 `mixedEventStyle`(333–359), 1색이면 `eventColorStyle`(197–207).
- 상한 강제: 서버 `updateEventTagsAction` `tagIds.slice(0,2)`
  (`lib/schedules/event-actions.ts` 394), 클라 `toggleEventTag`
  (`components/studio/studio-shell.tsx` 1522–1552).
- `event_tags.is_primary`(DB 0001:114–120)는 색 대상 표시용이나, 피커가 선택 태그
  전부를 primary로 보내 **사실상 무의미**.
- **대표 태그(repTagIds)는 색뿐 아니라 이음새/병합 판단에도 쓰인다**(§7, 중요).
- 휴뱅은 평범한 태그(`tag_key='dayoff'`, 회색, `db/seeds/0008_default_tags_v2.sql`:11).
  특별 동작은 하트/인사이트 제외뿐이며 식별을 **표시 이름 문자열 비교**로 한다
  (`components/poster/public-poster.tsx`:205·935–952, `lib/insights/actions.ts`
  `display_name === REST_TAG`).

### 1.2 한계

방송에는 직교하는 두 축이 있는데 2개 슬롯이 동시에 못 담는다.

- **형식/규모 축**: 합방, 풀트뱅, 짧뱅, 대회, 타스뱅 출연, 구플뱅…
- **내용/소재 축**: 소통뱅, 노래뱅, 종겜, 시참, 서버, VRChat…

예) `짧뱅 + 소통뱅 + 노래뱅`(형식1 + 내용2 = 3요소)을 2개로 못 담는다.
`휴뱅 + 타스뱅 출연`(본인 휴방이나 타 방송 출연)도 휴뱅이 평범한 색 태그면 충돌.

---

## 2. 목표 / 비목표

### 2.1 목표
- 카드가 **형식 링 1개 + 내용 채움 ≤2**를 동시에 표현.
- 휴뱅을 시스템 잠금 태그로, 식별을 이름이 아닌 구조로 견고화.
- 휴뱅은 회색 채움 고정 + 형식 링과 공존(내용 채움과는 비공존).
- **색 계산과 이음새/병합 로직을 같은 fill 기준으로 정합 유지**.
- 인사이트 통계를 내용/형식 축으로 분리.
- 기존 `event_tags` 데이터 무손실 재해석. 공개/비공개 경계 유지.

### 2.2 비목표
- 일정 본문·비공개 레이어·엠바고·역할 권한 모델 변경 없음.
- 색 팔레트·동적 색 생성(`lib/tags/color-gen.ts`) 변경 없음.
- 카드당 태그 총량을 3개(테두리1+내용2) 초과로 늘리지 않음.

---

## 3. 확정 결정 (잠금)

| # | 결정 | 값 |
|---|---|---|
| D1 | tier 저장 위치 | `broadcast_tags.tier` 컬럼. `event_tags` 무변경 |
| D2 | tier 분류 주체 | **관리자(오너/개발자)가 편집기에서 태그별 지정**(코드 하드코딩 X) |
| D3 | 카드 용량 | highlight ≤1 + fill ≤2 + system ≤1 |
| D4 | 형식(highlight) 의미 | 방송 형식/규모/장소/관계 |
| D5 | 내용(fill) 의미 | 방송에서 실제 하는 소재 |
| D6 | 휴뱅 | `tier='system'`, 완전 잠금, 회색 채움 고정 |
| D7 | 휴뱅 공존 | **fill과 비공존(저장 시 fill 제거)**, highlight와는 공존 |
| D8 | 휴뱅 식별 | 우선 `tier==='system'`, 보조 `tag_key==='dayoff'`. 이름 비교 폐기 |
| D9 | **통계(A안)** | 컨텐츠 순위=내용(fill)만 + "방송 형식 분포"(highlight) 위젯 신설 |
| D10 | 링 스타일 | **절제된 실선/inset ring**(두꺼운 glow 금지 — §12.2) |
| D11 | 구플뱅 / 서버 | 구플뱅=highlight, 서버=fill |
| D12 | 휴뱅 본문 표기 | 컨벤션 고정 안 함(자유 텍스트, 예: "휴뱅 (○○ 뱅송 출연)") |
| D13 | **연결/이음새 기준** | **signature 완전일치 아님.** 기존 edge-match 의미 유지하되 기준을 **fill 대표태그**로 재정의(§7) |

---

## 4. 용어

- **tier**: 태그 역할. `highlight`(형식/테두리) · `fill`(내용/채움) · `system`(휴뱅).
- **채움(fill)**: 카드 배경. 내용 ≤2 → 단색/그라데이션.
- **테두리(highlight)**: 카드 외곽 절제된 실선 링. 형식 1개 색.
- **휴뱅(system)**: 본인 방송 없음. 채움 회색 고정·내용 비공존. 형식 링과 공존.
- **대표 fill(repFillIds)**: 실제 배경으로 칠해지는 fill 색 식별자(이음새/병합 기준). §7.

---

## 5. 데이터 모델

### 5.1 현재 스키마 (확인됨)

```sql
-- db/migrations/0001_initial_schema.sql:73-85
create table public.broadcast_tags (
  id uuid primary key default gen_random_uuid(),
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  tag_key text not null,
  display_name text not null,
  color_key text not null,
  sort_order integer not null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, tag_key)
);
-- db/migrations/0001_initial_schema.sql:114-120
create table public.event_tags (
  event_id uuid not null references public.events(id) on delete cascade,
  tag_id uuid not null references public.broadcast_tags(id) on delete cascade,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  primary key (event_id, tag_id)
);
```

### 5.2 변경 (마이그레이션, idempotent)

```sql
-- db/migrations/00XX_tag_tier.sql
alter table public.broadcast_tags
  add column if not exists tier text not null default 'fill';

do $$ begin
  alter table public.broadcast_tags
    add constraint broadcast_tags_tier_chk check (tier in ('highlight','fill','system'));
exception when duplicate_object then null; end $$;

-- 시드 캘린더(slug='vic') 분류 backfill — §6
do $$
declare v_cal uuid;
begin
  select id into v_cal from public.calendars where slug='vic';
  if v_cal is null then return; end if;
  update public.broadcast_tags set tier='system'    where calendar_id=v_cal and tag_key='dayoff';
  update public.broadcast_tags set tier='highlight' where calendar_id=v_cal and tag_key in ('collab','full_track','tournament','worldcup');
  update public.broadcast_tags set tier='fill'      where calendar_id=v_cal and tag_key in ('big_server','calm','variety_game','song','hype','easy','ck','cineti');
end $$;
```

적용: `node scripts/apply-db.mjs db/migrations/00XX_tag_tier.sql`.
`event_tags` 무변경. `is_primary`는 legacy로 두되(삭제 안 함) 새 로직은 의존하지 않음.

### 5.3 휴뱅 DB 안전장치 (선택 — 권장)

태그 변이 액션이 **service-role admin 클라이언트로 RLS를 우회**한다
(`event-actions.ts`:370 `createSupabaseAdminClient`, tag-actions도 동일 계열).
따라서 클라/서버 검증을 통과하지 못한 admin·SQL 콘솔 경로의 실수를 막으려면 DB 트리거가 의미 있다.

권장 트리거 규칙(필수 아님, 서버 검증을 대체하지 않음):
- `tag_key='dayoff'` 행 삭제 금지.
- `tag_key='dayoff'`의 `tag_key/tier/color_key/sort_order/display_name/is_active` 변경 금지.
- `tier='system'` 신규 INSERT 금지(캘린더당 dayoff 1개만).

### 5.4 불변식
- 한 일정: highlight ≤1, fill ≤2, system ≤1. system 있으면 fill 없음(D7).
- system 태그는 캘린더당 1개(휴뱅), 생성/삭제 불가.
- `event_tags`는 (event_id, tag_id) 유일. 렌더는 `event.tagIds`(=event_tags sort_order 순) 보존.

---

## 6. 태그 분류 시작값

현 시드 13종(`db/seeds/0008_default_tags_v2.sql`) 기준(D11 반영):

| tag_key | 이름 | color_key | tier | 근거 |
|---|---|---|---|---|
| dayoff | 휴뱅 | gray | **system** | 잠금 |
| collab | 합방 | lavender | **highlight** | 형식(누구와) |
| full_track | 풀트뱅 | pink | **highlight** | 길이/규모 |
| tournament | 대회 | indigo | **highlight** | 이벤트 형식 |
| worldcup | 구플뱅 | orange | **highlight** | D11 |
| big_server | 서버 | blue | **fill** | D11(내용) |
| variety_game | 종겜 | yellow | **fill** | 내용 |
| song | 시참의날 | sky | **fill** | 내용 |
| hype | 소통뱅 | lime | **fill** | 내용 |
| calm | VRChat | mint | **fill** | 내용 |
| ck | CK | red | **fill** | 내용 |
| cineti | 시네티 | teal | **fill** | 내용 |
| easy | 기타 | beige | **fill** | 내용 |

- highlight 4개 → §12.2 "5~8 카테고리" 가이드 내. 향후 짧뱅·타스뱅=highlight, 노래뱅=fill 권장.
- 모두 편집기에서 변경 가능(D2).

---

## 7. ★ 렌더 색 + 연결/paint-group — 단일 기준으로 통일 (핵심)

### 7.1 왜 함께 바꿔야 하나 (v2가 발견한 갭)

현재 색 계산과 이음새/병합 판단이 **같은 대표태그 기준**을 공유한다(전부 확인됨):

- `repTagIds`(170–179): `primaryTagIds||tagIds` 2개 → **칸 좌/우 변 색**.
  `leftEdgeTag`(173)=`[0]`, `rightEdgeTag`(176)=`[last]`.
- `getEventTagColors`(182–194): 같은 기준으로 **배경색**.
- `buildPaintGroups`(255–305)의 `repKey`(258–259): 같은 기준 join → **그라데이션 묶음**.
- `getEventSpan`(479–519)의 `edgesMatch`(492–496): link_next 일정의 **이음새 병합**.
- `buildLinkChain`(414–444): `rightEdgeTag/leftEdgeTag/repTagIds`로 **체인 연결**.
- `getRepresentativeTagColors`(531–555): 레전드 요약.
- (`getLinkedChainIds`(448–475)는 linkNext만 보고 색 무관 → **영향 없음**.)

→ `getEventTagColors`만 tier로 바꾸면 **칠해지는 fill과 이음새 로직이 어긋난다**
(색 다른 두 일정이 억지로 붙거나 그 반대). v1은 이 점을 빠뜨렸다.

### 7.2 ★ 올바른 해결책 — fill 기준 대표태그 재정의 (signature 완전일치 아님)

v2는 "signature 완전일치 시에만 연결(보수안)"을 추천했으나, 이는 **기존 의도된 동작을 회귀**시킨다.
현 `edgesMatch`(492–496)는 `"A|B"+"B"`를 **이어지게**(맞닿는 변 B==B), `"A|B"+"C"`를 끊는다
(주석 487–491에 명시). signature 완전일치는 `"A|B"+"B"`도 분리시켜 **매끄러운 이음새 기능을 깬다.**

**채택안**: signature를 새로 만들지 말고, 기존 edge-match 의미는 그대로 두되 **대표태그의
기준을 "실제 칠해지는 fill 색 식별자"로 재정의**한다.

```ts
// lib/calendar/month.ts — 이음새/색 공통 기준
// 실제 배경으로 칠해지는 fill 식별자(이벤트 tagIds 순서 보존, ≤2).
// 휴뱅(system)이면 [systemTag.id](회색 단색). highlight는 링이라 변 색에서 제외.
function repFillIds(event, tags): string[] {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const ordered = event.tagIds.map((id) => byId.get(id)).filter(Boolean);
  const system = ordered.find((t) => t.tier === "system");
  if (system) return [system.id];
  return ordered.filter((t) => t.tier === "fill").slice(0, 2).map((t) => t.id);
}
```

- `repTagIds`를 `repFillIds`로 교체 → `leftEdgeTag/rightEdgeTag/edgesMatch/buildPaintGroups/
  buildLinkChain`이 **동작 그대로, 기준만 fill로 정합**. `"A|B"+"B"` 매끄러운 이음새 보존.
- highlight-only 이벤트(fill·system 없음): `repFillIds=[]` → 변 색 없음 → 자연히 병합 안 함
  (배경이 없으니 이음새 근거 없음). 이는 v2 §7.2 결론과 동일하며 올바르다.
- 휴뱅끼리: 같은 systemTag.id → 매끄럽게 이어짐. 휴뱅 vs 일반: id 달라 끊김. 의미 정확.

### 7.3 시각 파생 함수 (색·링 한 곳)

```ts
export type EventVisual = {
  fillColors: ColorPaletteEntry[];   // 0~2 (system이면 [gray] 1개)
  ringColor: ColorPaletteEntry | null; // highlight 1개 or null
  isRest: boolean;
};
export function deriveEventVisual(event, tags, palette): EventVisual {
  const byId = new Map(tags.map((t) => [t.id, t]));
  const byColor = new Map(palette.map((c) => [c.key, c]));
  const ordered = event.tagIds.map((id) => byId.get(id)).filter(Boolean);
  const system = ordered.find((t) => t.tier === "system");
  const highlight = ordered.find((t) => t.tier === "highlight");
  const fills = system ? [] : ordered.filter((t) => t.tier === "fill").slice(0, 2);
  const fillColors = (system ? [system] : fills)
    .map((t) => byColor.get(t.colorKey)).filter(Boolean);
  return {
    fillColors, // system이면 회색 단색
    ringColor: highlight ? (byColor.get(highlight.colorKey) ?? null) : null,
    isRest: Boolean(system)
  };
}
```

- `getEventTagColors`는 `deriveEventVisual(...).fillColors`로 위임(호환).
- `eventColorStyle/mixedEventStyle/mixedPatternMaskStyle`은 fillColors를 그대로 사용(무변경).
- `repFillIds`와 `deriveEventVisual.fillColors`는 **같은 fill 집합**에서 나오므로 항상 일치.

---

## 8. 도메인 타입 / 로더 / API

### 8.1 타입 — `lib/domain/schedule-types.ts`
```ts
export type TagTier = "highlight" | "fill" | "system";
export type BroadcastTag = {
  id: string; tagKey: string; displayName: string; colorKey: ColorKey;
  sortOrder: number; isDefault: boolean; isActive: boolean;
  tier: TagTier;       // 신규
  isLocked?: boolean;  // 신규(loader가 tier==='system'||tagKey==='dayoff'로 세팅)
};
```
`PublicScheduleEvent`/`StudioScheduleEvent`(39–72)의 `tagIds`/`primaryTagIds` 유지.

### 8.2 로더 — `public-loader.ts`, `studio-loader.ts`
- select(public 131–136 / studio 105–109)에 `tier` 추가. `mapTag`(public 309–327)에서
  `tier`·`isLocked` 매핑. event_tags 쿼리/매핑(public 285–306, tagIds 303·primaryTagIds 304) 유지.
- 공개 경계(.claude/rules/public-private-boundary): tier 비밀 아님 → 공개 노출 OK,
  명시적 DTO 구성 유지(스프레드 금지).

### 8.3 공개 API — `app/api/public/[calendarSlug]/events/route.ts`
- 변경 없음. tier가 따라 나가는지만 확인.

---

## 9. 서버 정규화 + 휴뱅 잠금

### 9.1 정규화 유틸 — `lib/schedules/event-actions.ts`
공용 `normalizeEventTags(calendarId, tagIds)` 신설. 클라 피커 불신.
규칙:
- 존재하지 않는/다른 캘린더 태그 제거.
- system ≤1, highlight ≤1, fill ≤2.
- **system 있으면 fill 제거(D7)**.
- 저장 순서: system → highlight → fill1 → fill2(피커/상세 안정). fill 내부 순서는 사용자 선택 보존.
- `primaryTagIds`는 legacy 호환으로 최종 `tagIds`와 동일 저장(새 렌더는 미의존).

적용: `updateEventTagsAction`(360–411, **`slice(0,2)`(394) 제거**), `saveEventAction`(228–241),
복붙 생성 경로. 매니저/작업자 `canEditEventTags` 권한 경계 유지.

### 9.2 휴뱅 잠금
| 행위 | 클라(`tag-legend-editor.tsx`) | 서버(`tag-actions.ts`) |
|---|---|---|
| 이름/색/tier 변경 | input·swatch·토글 비활성 | `updateTagAction`(30)·`saveTagsAction`(68)·`updateTagsAction`(262) 거부 |
| 순서 이동 | 드래그 핸들(517–525) 제거 | sort_order 변경 거부 |
| 삭제 | 버튼(552–561) 비활성 | `removeTagAction`(214) 거부 |
| system 신규 생성 | 새 태그는 tier=fill만 | INSERT 거부 |
| 일정에 휴뱅 부여 | 허용(fill 비활성) | 정규화로 허용 |

tier 값 화이트리스트 검증. DB 트리거(§5.3)는 선택적 3중 방어.

---

## 10. UI 변경

### 10.1 이벤트 태그 피커 — `studio-shell.tsx`
`toggleEventTag`(1522–1552)를 tier 인식으로:
- highlight → 단일선택 교체(0/1), fill → ≤2, system(휴뱅) → 토글(켜면 fill 비활성+클라에서 fill 제거).
- 데스크톱 피커(1595–1629)/모바일 시트(2637–2693): **휴뱅 토글(상단) + 형식(단일) + 내용(≤2)** 3구역.
- `primaryTagIds`는 `tagIds`와 동일 전송(렌더는 tier 파생).

### 10.2 태그 편집기 — `tag-legend-editor.tsx`
- 행(506–564)에 tier 세그먼트(테두리/채움). `Draft`·`TagUpdate`·`TagCreateInput`에 tier 추가,
  `saveAll`(420–485) 포함. `addTag`(334–355) 기본 fill. system은 새 태그에서 선택 불가.
- 휴뱅 = locked row(§9.2), 최상단 고정 + 잠금 아이콘.

### 10.3 필터 레전드 — `tag-legend-editor.tsx` 읽기전용(278–324)
- **휴뱅 / 형식(테두리) / 내용(채움)** 그룹화. 필터 매칭은 `event.tagIds.includes(tagId)` 유지
  (`isDimmedByFilter` 423–431). 사용처: 좌측 패널(3114–3123), 공개 포스터 레전드.

---

## 11. 카드 렌더 (3곳) + CSS

적용: 스튜디오 데스크톱 pill(3259–3386, `eventColors` 1019–1021), 모바일 agenda(2357–2479),
공개 포스터/export 그리드.

- 배경 = `deriveEventVisual().fillColors` (0=기본, 1=단색, 2=그라데이션, system=회색단색).
- 링 = `ringColor`를 CSS 변수로:
```tsx
style={{ ...bg, ["--event-ring"]: visual.ringColor?.borderColor } as CSSProperties}
```
```css
/* D10: 절제된 inset 링 — 두꺼운 glow 금지 */
.studio-event-pill[data-ring]{ box-shadow: inset 0 0 0 2px var(--event-ring); }
```
- **비공개 점선 outline 충돌 주의**: embargo/work 카드는 점선 `outline`(2872 근처) 사용 중 →
  링은 `outline`이 아닌 **`inset box-shadow`**로 두어 둘이 동시에 보이게(§15 R3).
- 모바일은 좁은 폭 고려: 링을 좌측 막대 색/얇은 inset로.

---

## 12. 설계 근거 (벤치마킹)

### 12.1 분류 구조 — Notion 패턴
단일선택(Select)=한 개 "분류" / 다중선택(Multi-select)=여러 "라벨". → **테두리=단일(형식)**,
**채움=다중(내용 ≤2)** 와 1:1. 출처: https://noteforms.com/notion-glossary/multi-select

### 12.2 시각 인코딩 — double/redundant encoding
색 + 외곽선 두 채널 분리는 권장(색맹 접근성↑). 단 **두꺼운 외곽선은 데이터에서 시선을
뺏으니 금지**(→ D10 절제된 inset 링). 효과는 **카테고리 5~8개**에서 최대(→ 형식 5~8개 유지).
출처:
- https://data.europa.eu/apps/data-visualisation-guide/double-encoding
- https://www.displayr.com/improve-the-quality-of-data-visualizations-using-redundancy/

---

## 13. 인사이트 재설계 (D9 = A안)

### 13.1 현재 (확인됨) — `lib/insights/actions.ts`
- `getInsightsAction`(193–489): "이번 달 컨텐츠 순위" = 태그별 이벤트 수 Top8(262–328),
  휴뱅을 `display_name===REST_TAG`로 제외(269).
- `getTrendAction`(529–686): 6개월 `contentByTag`(608–631), `heartsByTag`(633–658).
- `getMemberInsightsAction`(1174–1492): 멤버 안전(비율) 버전 — 랭킹(1314–1332),
  콘텐츠 트렌드(1286–1312), 하트 트렌드(1387–1426).
- 소비: `components/developer/insights-dashboard.tsx`(301,670–699),
  `components/studio/member-insights.tsx`(377–383), 공용 `StackTrendChart`.

### 13.2 변경
1. **휴뱅 식별 교체**: 모든 `display_name===REST_TAG` → `tier==='system'`(보조 `tag_key==='dayoff'`).
   `public-poster.tsx` 935–952, 향후 출석/체크인 제외 포함.
2. **컨텐츠 순위 = fill만**: tier==='fill' 태그만 카운트(이벤트당 fill ≤2 각 1 기여). system/highlight 제외.
3. **"방송 형식 분포" 위젯 신설(highlight)**: tier==='highlight' 태그별 이벤트 수.
   이벤트당 형식 ≤1이라 깔끔한 분할(파이/100% 막대). 형식 없는 이벤트="형식 없음".
4. **하트/트렌드**: `heartsByTag`·`contentByTag` = fill 기준. 선택적 `formatByTag`(highlight) 추가.
   휴뱅 일수는 별도 콜아웃/6개월 라인.

| 위젯 | 모집단 | 휴뱅 | 멤버뷰 |
|---|---|---|---|
| 이번 달 컨텐츠 순위 | tier=fill | 제외 | 비율만 |
| 방송 형식 분포(신규) | tier=highlight + "없음" | 별도 | 비율만 |
| 휴뱅 일수(신규) | tier=system | 대상 | 수/비율 |
| 6개월 컨텐츠/하트 트렌드 | tier=fill | 제외 | 0–100 |

대시보드에 "컨텐츠 순위는 내용 기준으로 바뀜" 짧은 안내 권장(과거치 단절).

---

## 14. 마이그레이션 / 데이터 해석 / 롤백

- `[fill,fill]` → 그라데이션 유지. `[highlight,fill]` → 링+채움 자연 분해.
  `[highlight,highlight]`(드묾) → 첫 highlight만 링, 저장 시 1개로 정규화.
  `[system,fill]` → 저장 시 fill 제거(D7). `[system,highlight]` → 회색 채움 + 링.
- 롤백: `tier` default 'fill' → 컬럼 무시 시 구버전 근사. 단 **서버가 3태그 저장 시작 후
  구버전 롤백 시 앞 2개만 색**으로 보임 → 서버 정규화와 렌더 변경은 같은 배포 흐름으로 묶는다.

---

## 15. 리스크 & 완화

- **R1 month.ts 연결 누락(가장 중요)**: repTagIds→repFillIds 교체를 §7대로. **PR2에서
  paint-group/edge 단위 테스트를 먼저 추가**해 회귀 방지.
- **R2 휴뱅+내용 동시 부여**: 피커에서 fill 비활성 + 서버 정규화로 fill 제거(D7). 렌더는 회색 우선.
- **R3 링 vs 비공개 점선 outline 충돌**: 링은 `inset box-shadow`, 비공개는 `outline` → 분리 공존.
- **R4 병합 막대의 링 불일치(엣지케이스)**: link_next로 병합된 두 일정의 highlight가 다르면
  내부 이음새에서 링이 어긋날 수 있음. 권장: 병합은 fill 기준 유지(현 동작 보존), 링은
  세그먼트별 렌더 허용 또는 내부 이음새 링 억제. 구현 시 결정.
- **R5 낙관적 쓰기 큐**: 태그 토글은 keepalive(`/api/studio-write`) 직렬 큐·롤백 스냅샷 유지.
- **R6 모바일 폭**: 3구역 피커·링 넘침 → 라벨 축약, 링 얇게.
- **R7 통계 의미 단절**: 컨텐츠 순위 기준 변경 안내 문구.

---

## 16. PR 분할 / 테스트 / 완료 기준

### 16.1 PR 분할
1. **PR1 모델 토대**: 마이그레이션(tier)+제약+backfill, 타입, 로더 select, sample-data tier. 렌더 영향 0.
2. **PR2 정규화+렌더 파생(연결 포함)**: `normalizeEventTags`, `deriveEventVisual`,
   **`repTagIds→repFillIds` 교체(§7)**, `getEventTagColors` 위임. **단위 테스트 동반.**
3. **PR3 카드 시각**: 데스크톱/모바일/포스터 링, 비공개 outline 충돌 확인.
4. **PR4 편집기/피커/휴뱅 잠금**: tier 토글, 3구역 피커, 클라+서버 잠금, (선택)DB 트리거.
5. **PR5 인사이트/필터/QA**: 휴뱅 식별 교체, fill 컨텐츠 순위, highlight 형식 분포, 레전드 그룹화.

각 PR: TypeScript+lint+`next build` 통과, 공개/비공개 경계 재확인, commit/push(main), 커밋 해시 보고.

### 16.2 테스트 (`tests/unit/event-span.test.ts` 선례 존재)
- `deriveEventVisual`: fill 1 / fill 2 순서보존 / highlight+fill / system 단독 / system+highlight /
  system+fill(=fill 무시).
- `normalizeEventTags`: highlight 2→1 / fill 3→2 / system+fill→fill 제거 / 타 캘린더 거부.
- **연결(핵심)**: `repFillIds` 기준 `getEventSpan`·`buildPaintGroups`·`buildLinkChain` —
  `"A|B"+"B"` 이어짐 / `"A|B"+"C"` 끊김(기존 동작 보존) / 휴뱅 vs 일반 분리 / highlight-only 비병합.
- e2e: 오너 tier 변경 저장 / 휴뱅 편집·삭제·이동 불가 / 매니저 태그할당만 / `짧뱅+소통+노래`=링+2색 /
  `휴뱅+타스뱅`=회색+링 / export 링 깨끗 / 공개 API private 미노출.

### 16.3 완료 기준
- 카드가 `highlight ring + fill bg + system gray` 정확 표현(3곳).
- **칠해지는 색과 이음새/병합이 항상 일치(§7).**
- 휴뱅 이동/이름/색/tier/삭제 불가, fill 비공존·highlight 공존.
- 인사이트가 fill 컨텐츠 순위 + highlight 형식 분포 분리, 휴뱅 tier 식별.
- 공개/비공개 경계 유지, lint/build/unit/e2e 통과.

---

## 17. 검토자용 검증 질문

설계(코드 무관):
1. 테두리=형식 단일 / 채움=내용 다중의 축 분리가 방송 도메인에서 직교적인가? 반례는?
2. 휴뱅이 fill을 덮고 highlight와 공존하는 규칙이 모든 케이스를 덮는가?
3. 통계 A안(컨텐츠=내용만 + 형식 분포 별도)이 의도와 맞는가? 형식을 순위에서 빼는 게 손실인가?
4. 절제된 inset 링이 그라데이션 위에서 식별되면서 과하지 않은가?

구현(코드 접근):
5. **§7 교정이 맞는가** — `repTagIds→repFillIds`로 기존 edge-match(`"A|B"+"B"` 병합)가 보존되는가?
   v2의 signature 완전일치가 회귀인 게 맞는가?
6. §7 영향 함수 목록에 빠진 곳이 있는가?(특히 export Playwright 경로, `getRepresentativeTagColors`,
   모바일 agenda, 비공개 로더)
7. 휴뱅 서버 잠금이 모든 변이 액션에서 누락 없이 막히는가? DB 트리거가 service-role 우회를 실제로 막는가?
8. `display_name` 이름 비교 잔존이 insights/poster 외에 더 있는가?
9. 공개 DTO tier 노출이 public-private-boundary 규칙을 위반하지 않는가?
10. 롤백 시 3태그 저장과 렌더 배포를 묶는 전략이 충분한가?
