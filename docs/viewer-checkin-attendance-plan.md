# 시청자 출석 도장 · 개근 배지 구현계획 (Viewer Check-in / Attendance)

> 목적: 시청자에게 **"왜 다시 들어와?"** 하는 재방문 루프를 만든다. 방송이 있는 날 들어와
> 그 날짜에 **도장**을 찍고, **연속·개근 배지**와 **도장판**을 채운다. 공개 일정 + 본인 도장
> 데이터만 쓰고, 운영 데이터(방문·동시접속)는 절대 섞지 않는다.
>
> **도장 시점 = A안(오늘만)**: 방송일이 *오늘(KST)* 일 때만 그 날 도장을 찍을 수 있다.
> 과거/미래 방송일엔 못 찍는다 → "그날 와야 한다"는 복귀 동기가 핵심.

---

## §0. 한눈에 (요약)

- 새 테이블 `viewer_checkin (calendar_id, user_id, day)` — **하트(`event_hearts`)와 동일 패턴**:
  본인 것만 RLS로 읽고, 변경·집계는 `SECURITY DEFINER` 함수로만. user_id는 절대 공개 안 함.
- **A안 강제는 서버(RPC)에서**: `p_day == KST 오늘` & `p_day가 방송일` 을 RPC가 직접 검증
  (PostgREST로 RPC 직접 호출해도 못 뚫게).
- 연속/개근/도장판은 **공개 일정의 방송일 집합 + 본인 도장 집합**으로 계산(파생값, 저장 안 함).
- 단계: **Phase 1 도장+연속(MVP) → Phase 2 도장판+개근+공동카운트 → Phase 3 팬 카드 통합·내보내기**.

---

## §1. Planner — 영향 범위·경계·역할·KST

### 1.1 라우트/컴포넌트
- 시청자 표면: `components/poster/public-poster.tsx`(시청자 포스터/달력 — 하트·업 링크가 사는 곳).
- 공개 데이터 로더: `lib/schedules/public-loader.ts`(방송일 판정의 근거가 되는 공개 일정).
- 새 서버 액션: `lib/schedules/checkin-actions.ts`(하트의 `lib/schedules/heart-actions.ts`와 동형).
- 새 마이그레이션: `db/migrations/0028_viewer_checkin.sql`(번호 충돌 회피 — 0024·0025가 중복돼 있어 0028부터).
- 도메인 타입: `lib/domain/schedule-types.ts`(공개 DTO에 출석 관련 파생 필드 추가).

### 1.2 역할·권한 영향
- **시청자(+로그인 누구나)**: 도장 찍기·자기 출석/연속/개근·공동 카운트 보기. 하트와 동일하게
  "로그인 필요". (메모리: 모든 사용자 로그인 → user_id 항상 존재.)
- 소유자/매니저/작업자/개발자: 시청자 화면(미리보기 포함)에선 동일하게 동작(하트처럼). 편집실
  본 화면엔 도장 UI를 넣지 않는다(시청자 전용 몰입 요소).
- **편집 권한과 무관** — 일정 생성/수정/삭제 로직·낙관 큐·prop 동기화 가드엔 손대지 않는다.

### 1.3 공개/비공개 경계 (비협상)
- `viewer_checkin`은 **시청자 본인 데이터** — 소유자 비공개 일정과 무관. 본인 행만 RLS로 읽음.
- **방송일 판정은 공개 일정에서만** — 비공개/엠바고/작업자 일정은 판정 대상에서 원천 제외.
- 공동 카운트("오늘 N명 출석")는 **집계 수만** 공개(하트와 동일). 누가 찍었는지(이메일·user_id)는
  어떤 경로로도 노출 금지 → 집계는 `SECURITY DEFINER` 함수가 count만 반환.
- `app/(public)`·`app/api/public`은 여전히 `public-loader`만 import(스튜디오 로더 금지) — 출석
  관련 공개 노출도 전부 공개 경로로만.

### 1.4 KST 가정
- "오늘"·"방송일"·"day"는 전부 **Asia/Seoul** 기준. A안 강제(오늘만)는 RPC에서
  `(now() at time zone 'Asia/Seoul')::date` 로 서버 시계로 판정(클라 시계 불신).
- 자정 근처 경계: 클라 표시도 KST로, 서버 판정도 KST로 일치시켜 "오늘"이 어긋나지 않게.

### 1.5 "방송일"의 정의 (도장 가능 날)
공개 일정에서 **그 KST 날짜에 다음을 만족하는 이벤트가 1개 이상** 있으면 방송일:
- `is_public`(공개) & `status != 'draft'`,
- **휴뱅(REST_TAG="휴뱅") 마커가 아님** — 휴방일은 공개로 보이지만 방송이 아님(인사이트의
  REST_TAG 제외 로직과 동일하게 처리),
- **업 도움(`is_support`) 전용 항목이 아님** — 업 기간은 방송이 아니라 후원 캠페인.

→ 즉 "휴뱅도 업도 아닌 실제 방송 콘텐츠가 있는 날". 멀티데이 콘텐츠는 시작~종료 각 날을 방송일로
볼지(연속 도장) 시작일만 볼지는 Phase 1에선 **각 날을 독립 방송일**로 단순화(달력 칸 = 날 단위와 일치).

---

## §2. Builder — 데이터 모델 (마이그레이션 0028)

`event_hearts`(0016)를 그대로 본뜬다. 직접 INSERT/DELETE는 막고 RPC만 통로로.

```sql
-- db/migrations/0028_viewer_checkin.sql
-- 시청자 출석 도장. 방송일(공개)에 1인 1일 1도장. 본인 것만 읽고, 공동 집계는 함수로만.
create table if not exists public.viewer_checkin (
  calendar_id uuid not null references public.calendars(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null,                 -- 도장 찍은 KST 방송일
  created_at  timestamptz not null default now(),
  primary key (calendar_id, user_id, day)
);
create index if not exists viewer_checkin_cal_day_idx on public.viewer_checkin (calendar_id, day);

alter table public.viewer_checkin enable row level security;
-- 본인 도장만 읽기(연속·도장판 복원용). 공동 집계는 SECURITY DEFINER 함수로만 공개.
drop policy if exists "viewer_checkin_read_own" on public.viewer_checkin;
create policy "viewer_checkin_read_own" on public.viewer_checkin
  for select using (user_id = auth.uid());
grant select on public.viewer_checkin to authenticated;

-- 오늘(KST) 방송일에 도장 찍기. A안 강제 + 방송일 검증 + 1일 1회. 그 날 공동 카운트 반환.
create or replace function public.stamp_checkin(p_calendar_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  kst  date := (now() at time zone 'Asia/Seoul')::date;  -- 서버 시계의 KST 오늘
  cnt  bigint;
begin
  if uid is null then raise exception 'authentication required'; end if;

  -- A안: 오늘이 방송일일 때만. "방송일" = 그 KST 날짜에 공개·비초안·비휴뱅·비업 이벤트 존재.
  -- (정확한 휴뱅 태그 조인은 event_tags/tags 스키마에 맞춰 구현 시 확정 — §6 참고.)
  if not exists (
    select 1 from public.events e
    where e.calendar_id = p_calendar_id
      and e.is_public and e.status <> 'draft'
      and (e.starts_at at time zone 'Asia/Seoul')::date = kst
      and coalesce(e.is_support, false) = false
      and not public.is_rest_event(e.id)        -- 휴뱅 마커 제외(헬퍼 또는 인라인 조인)
  ) then
    raise exception 'not a broadcast day';
  end if;

  insert into public.viewer_checkin (calendar_id, user_id, day)
  values (p_calendar_id, uid, kst)
  on conflict do nothing;                       -- 1일 1도장(중복 무시)

  select count(*) into cnt from public.viewer_checkin
  where calendar_id = p_calendar_id and day = kst;
  return cnt;                                   -- 그 날 공동 출석 수(공개 안전)
end;
$$;
grant execute on function public.stamp_checkin(uuid) to authenticated;

-- 공동 집계: 월 범위의 날짜별 출석 수(누가 찍었는지는 비노출 → 공개 안전).
create or replace function public.get_checkin_counts(p_calendar_id uuid, p_start date, p_end date)
returns table (day date, count bigint)
language sql security definer set search_path = public
as $$
  select day, count(*)::bigint
  from public.viewer_checkin
  where calendar_id = p_calendar_id and day >= p_start and day < p_end
  group by day;
$$;
grant execute on function public.get_checkin_counts(uuid, date, date) to anon, authenticated;
```

> 본인 도장 목록(연속·도장판 렌더)은 RLS(read-own)로 `viewer_checkin`에서 직접 select하면 된다
> (하트의 read-own과 동일). 공동 카운트만 함수로.

적용: `node scripts/apply-db.mjs db/migrations/0028_viewer_checkin.sql`. **service_role grant 확인 필수**
(0026에서 겪은 함정: 새 객체에 권한 자동부여 안 됨 → RPC는 `authenticated`/`anon`에 grant, 테이블
직접 접근은 본인 RLS만).

---

## §3. Builder — 서버 액션 (`lib/schedules/checkin-actions.ts`)

`heart-actions.ts`와 동형. 사용자 세션 클라(`createSupabaseServerClient`) + RPC.

```ts
"use server";
export type CheckinResult = { ok: true; todayCount: number } | { ok: false; error: string };

// 오늘(KST) 방송일에 도장. 검증은 전부 RPC가(A안·방송일·1일1회). 그 날 공동 카운트 반환.
export async function stampCheckinAction(): Promise<CheckinResult> { /* actor 인증 → calendar id → rpc('stamp_checkin') */ }

// 이번 달 본인 도장 + 공동 카운트(도장판·연속·개근 렌더용). 공개 일정의 방송일 집합은 호출부에서.
export async function getCheckinStateAction(year: number, month: number): Promise<{
  ok: true;
  myDays: string[];          // 본인이 찍은 KST 날짜들(read-own select)
  countsByDay: Record<string, number>;  // 날짜별 공동 출석 수(get_checkin_counts)
} | { ok: false; error: string }>;
```

- 에러는 하트처럼 `{ok,error}`로 반환 → 호출부가 인라인 표기(아까 A 묶음에서 정한 "조용한 실패 금지").
- RPC 오류 메시지("not a broadcast day"/"authentication required")는 사용자 친화 문구로 매핑.

---

## §4. Builder — 파생 계산 (방송일·연속·개근)

전부 **공개 일정의 방송일 집합 + 본인 도장 집합**으로 계산. 저장하지 않는다(스키마 단순).

- **방송일 집합** `broadcastDays: string[]`: `public-loader`가 준 공개 이벤트에서 §1.5 규칙으로
  KST 날짜를 추출(휴뱅·업·초안 제외). 인사이트의 `REST_TAG="휴뱅"` 제외 로직을 공용 유틸로 뽑아
  (`lib/calendar/broadcast-days.ts`) 인사이트와 시청자가 같은 정의를 쓰게(일관성).
- **연속(streak)**: 방송일을 시간순으로 정렬 → **오늘(또는 마지막 방송일)부터 거꾸로** 연속으로
  도장 찍힌 방송일 수. A안이므로 지나간 방송일을 안 찍었으면 그 지점에서 끊김. 비방송일은 건너뜀.
  **달 경계를 넘어 연속**(롤링 윈도우 — 도장판은 월 단위지만 연속은 직전 방송일들까지 이어 셈).
- **주/월 개근**: 이번 KST 주/달의 방송일이 전부 도장 → "이번 주 개근 ⭐"/"이달 개근 🏆".
  진행 중엔 `N/M`(예: 이달 5/8) + 남은 방송일 수 표시.
- **오늘 상태**: 오늘이 방송일인가 / 이미 찍었나 / 아직 안 찍었나(=도장 버튼 활성).

엣지: 소유자가 사후에 일정을 바꿔 과거 방송일이 휴뱅이 되면, 방송일 집합은 **현재 공개 일정 기준**
재계산되므로 과거가 소급해 streak를 깨지 않게 자연 처리(없던 날로 취급). §6에 명시.

---

## §5. Builder — UI (시청자 포스터)

### Phase 1 (MVP)
- **오늘 도장 버튼**: 오늘이 방송일 & 미도장이면 그 날짜 칸(또는 포스터 상단 작은 배너)에
  "오늘 방송 도장 찍기 🟣" → 누르면 **도장 쾅 연출** + 햅틱(2단계: 누름 톡 → 서버확인 톡) + 카운트.
  이미 찍었으면 도장 표시. 비방송일/과거엔 버튼 없음.
- **연속 배지**: "🔥 N방송 연속 출석" + "이번 달 N/M 출석" 작은 칩. (수치가 큰 박스에 외롭지 않게
  — no-wasted-space: 도장 아이콘+숫자+라벨로 채움.)
- 낙관 반영(즉시 도장+count++) 후 서버 확정. 실패 시 롤백+인라인 에러.

### Phase 2
- **도장판(컬렉션)**: 이번 달 방송일을 슬롯으로 늘어놓고 채워진 도장/빈 슬롯 표시(커피 쿠폰판 톤).
  과거 미도장은 흐리게(읽기전용), 오늘은 강조. 주/월 **개근 배지**.
- **공동 카운트**: "오늘 N명이 출석했어요"(get_checkin_counts) — 하트처럼 따뜻한 집계만.

### Phase 3
- **팬 카드 통합**: 하트 TOP3 + 함께 누른 하트 합계 + 방송 N회/다음 방송 D-day + 태그 구성 +
  **출석/연속/개근**을 한 장의 귀여운 카드로(시청자 전용, 대시보드 아님). "📊 이번 달" 진입.
- **내보내기 "이달의 기록"**: 멀티 비율 내보내기(벤치마킹 항목)와 연결해 공유 이미지에 포함.

### 디자인 원칙(프로젝트 철학)
- 시청자 모드는 **귀엽고 포스터 우선** — 관리자 인사이트 같은 차가운 패널 금지.
- **모바일 컴팩트**: 칩·라벨은 폰에서 짧게. **웹 타이포는 크게**(작으면 defect).
- 모션은 기존 키프레임/토큰(`--ease`,`--dur-*`) 재사용, **전역 reduced-motion catch-all에 합류**.
- 햅틱은 Android 한정(스위치보드 통과) — 도장=2단계 톡, 개근 달성=`hapticSuccess`.

---

## §6. Evaluator — 검증 체크리스트

- [ ] **경계**: `viewer_checkin` 본인 RLS read-own만, 변경/집계는 `SECURITY DEFINER`로만. 공동
      카운트에 user_id/이메일 0 노출. 방송일 판정은 공개 일정에서만. 공개 API private-free 유지.
- [ ] **A안 서버 강제**: RPC가 `p_day(=서버 KST 오늘)`만 허용 + 방송일 검증 → PostgREST로 RPC를
      직접 때려도 과거/미래/비방송일 도장 불가. (e2e로 시도→거부 확인.)
- [ ] **KST**: 오늘·방송일·day 모두 Asia/Seoul. 자정 경계에서 클라/서버 "오늘" 일치.
- [ ] **휴뱅·업 제외**: 방송일 집합이 인사이트와 같은 정의(공용 유틸). 휴방/업만 있는 날은 도장 불가.
- [ ] **권한**: 새 RPC/테이블 grant 확인(0026 함정 재발 방지) — 인증 사용자만 stamp, 본인만 read.
- [ ] **회귀**: 일정 편집/낙관 큐/드래그/저장 순서·prop 가드에 영향 0(독립 표면).
- [ ] **체감/모션**: 낙관 도장 + 두 단계 햅틱, 실패 인라인 복구, reduced-motion 합류.
- [ ] **사후 일정 변경**: 과거 방송일이 휴뱅으로 바뀌면 방송일 집합 재계산으로 streak 자연 보정.
- [ ] **테스트**: 단위(streak/개근 계산: 방송일 기반·달 경계), e2e(비방송·비오늘 거부, 공개 API
      private-free), 공개 DTO 스냅샷에 출석 파생값이 비공개를 안 흘리는지.

### 미해결로 확정할 것(구현 진입 시)
1. **휴뱅 태그 조인 정확형**: `event_tags`/`tags(name='휴뱅')` 스키마 확인 후 `stamp_checkin`의
   방송일 검증과 공용 유틸 `broadcast-days.ts`를 같은 규칙으로 확정.
2. **멀티데이 방송**: Phase 1은 각 날 독립 방송일. 연속 막대(linkNext)와의 표시 정합은 Phase 2에서.
3. **"어제까지 1일 보충" 완충** 둘지(깜빡한 시청자 배려) — 기본은 A안 엄격, 완충은 옵션으로 보류.

---

## §7. 파일별 변경 요약

| 파일 | 변경 |
|---|---|
| `db/migrations/0028_viewer_checkin.sql` | 신규: 테이블·RLS·`stamp_checkin`·`get_checkin_counts` |
| `lib/schedules/checkin-actions.ts` | 신규: `stampCheckinAction`·`getCheckinStateAction` |
| `lib/calendar/broadcast-days.ts` | 신규(또는 인사이트에서 추출): 방송일 집합 공용 유틸 |
| `lib/domain/schedule-types.ts` | 공개 DTO/뷰모델에 출석 파생(today 상태 등) 필요 시 추가 |
| `components/poster/public-poster.tsx` | 도장 버튼·연속/개근 칩·도장판·공동 카운트(시청자 전용) |
| `components/poster/public-poster.css` | 도장 연출·도장판·칩 스타일(토큰·reduced-motion 합류) |
| `lib/ui/haptics.ts` | (재사용) 2단계 톡·개근 success |
| `tests/` | streak 단위 + 비방송/비오늘 거부 e2e + 공개 DTO private-free |

## §8. 권장 진행 순서
1. **Phase 1**: 0028 마이그레이션 → `checkin-actions` → 방송일 유틸 → "오늘 도장"+연속+`N/M`(시청자
   포스터). 빌드·경계 확인·커밋.
2. **Phase 2**: 도장판 + 주/월 개근 + 공동 카운트.
3. **Phase 3**: 팬 카드 통합(하트 TOP·방송요약·태그구성·출석) + 내보내기 "이달의 기록".
