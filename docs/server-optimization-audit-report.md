# VIC Schedule Studio 서버 통신 및 서버 최적화 재평가 보고서

작성일: 2026-05-27 KST  
재평가 사유: 포스터/모바일 UI 수정 이후 서버 통신 영향 재점검  
확인한 현재 변경사항: `components/poster/public-poster.css`의 agenda 월 표시 스타일 변경

## 1. 이번 재평가 결론

이번에 확인된 미커밋 UI 변경은 `.agenda-month`의 글자 크기, 굵기, 색상 조정이다.

```diff
-.agenda-month { font-size: 13px; font-weight: 700; color: rgb(20 20 20 / 42%); }
+.agenda-month { font-size: 14px; font-weight: 900; color: #1b1f29; }
```

이 변경은 순수 CSS 변경이라 서버 요청 수, server action 호출 빈도, Supabase query shape, 캐시 무효화에는 직접 영향을 주지 않는다.

다만 재검토 과정에서 `PublicPoster`의 현재 구조를 다시 확인한 결과, 이전 보고서보다 더 정확하게 반영해야 할 점이 있다.

- 포스터는 현재 `POSTER_DESIGN_W = 1840`, `POSTER_DESIGN_H = 1035`의 16:9 고정 캔버스로 설계되어 있다.
- 화면 폭이 좁아질 때 `.poster-scaler`가 `transform: scale(...)`로 통째로 축소한다.
- 스티커 키보드 미세 이동은 `scheduleCommit()`으로 350ms debounce 저장을 한다.
- 하지만 색상/효과/정렬/복제/undo/redo/삭제 등은 여전히 개별 `saveStickerAction` 또는 `deleteStickerAction`을 여러 번 호출할 수 있다.

따라서 서버 최적화의 우선순위는 기존과 거의 같다. UI 수정 자체보다 중요한 서버 리스크는 여전히 다음 세 가지다.

1. `public-loader.ts`의 공개 데이터 쿼리에 `calendar_id` scope가 빠진 부분.
2. studio page와 loader 사이의 actor/unlock/public schedule 중복 조회.
3. event/tag/sticker mutation이 여러 DB round trip과 broad cache invalidation으로 나뉘어 있는 점.

가장 먼저 고칠 것은 여전히 `public-loader.ts`의 calendar scoping이다. 이는 성능 최적화이면서 public/private 데이터 경계 안정성 문제이기도 하다.

## 2. 서버 통신 구조 요약

## 2.1 공개 viewer 로딩

파일: `lib/schedules/public-loader.ts`

현재 흐름:

1. `getPublicSchedule(calendarSlug)` 호출.
2. Supabase 미설정이면 sample data 반환.
3. 공개 공통 데이터는 `loadPublicScheduleData(calendarSlug)`에서 `unstable_cache`로 30초 캐시.
4. 로그인 사용자별 `myHeartIds`는 `loadMyHeartIds()`로 별도 조회.
5. 공개 데이터 조회에는 anon Supabase client를 사용한다.

좋은 점:

- 공개 공통 데이터와 사용자별 하트 상태가 분리되어 있다.
- 공개 데이터는 cacheable path로 묶여 있다.
- 하트 집계는 `get_event_heart_counts` RPC를 사용해 user_id를 노출하지 않는다.
- owner/studio 수정 후 `revalidatePublicSchedule()`로 공개 캐시를 무효화한다.

중요 문제:

`loadPublicScheduleData()`는 먼저 calendar를 찾지만, 이후 병렬 쿼리 일부에서 `calendar_id = calendar.id`를 명시하지 않는다.

현재 문제가 되는 쿼리:

```ts
supabase.from("broadcast_tags").select(...).eq("is_active", true)
supabase.from("color_palette").select(...).order("sort_order")
supabase.from("events").select(...).eq("visibility_scope", "public")
supabase.from("sticker_instances").select(...).eq("is_visible", true)
supabase.from("sticker_assets").select(...).order("created_at", { ascending: false })
```

단일 VIC 캘린더에서는 티가 덜 나지만, 캘린더가 2개 이상이 되는 순간 다른 공개 캘린더의 태그, 팔레트, 이벤트, 스티커가 섞일 수 있다. RLS가 public row를 허용하는 구조이므로 application-level calendar scoping은 반드시 필요하다.

권장 수정:

```ts
supabase
  .from("broadcast_tags")
  .select("id, tag_key, display_name, color_key, sort_order, is_default, is_active")
  .eq("calendar_id", calendar.id)
  .eq("is_active", true)
  .order("sort_order");

supabase
  .from("color_palette")
  .select("key, name, bg_color, text_color, border_color, sort_order")
  .eq("calendar_id", calendar.id)
  .order("sort_order");

supabase
  .from("events")
  .select("id, date_key, end_date_key, link_next, is_support, support_url, start_time, end_time, is_all_day, public_title, public_description, status, sort_order, category, event_tags(tag_id, is_primary, sort_order)")
  .eq("calendar_id", calendar.id)
  .eq("visibility_scope", "public")
  .neq("status", "draft")
  .order("date_key")
  .order("created_at");

supabase
  .from("sticker_instances")
  .select("id, emoji, text_content, text_color, font_weight, font_family, text_align, text_bg, italic, outline, shadow, year, month, x_ratio, y_ratio, width_ratio, rotation_deg, flip_x, flip_y, opacity, z_index, is_visible, asset_id, sticker_assets(name, file_url, file_type)")
  .eq("calendar_id", calendar.id)
  .eq("is_visible", true);

supabase
  .from("sticker_assets")
  .select("id, name, file_url, file_type")
  .eq("calendar_id", calendar.id)
  .order("created_at", { ascending: false });
```

`support_campaigns`도 현재 public/is_active filter만 있으므로 calendar scope를 추가하는 것이 맞다.

```ts
.eq("calendar_id", calendar.id)
.eq("is_public", true)
.eq("is_active", true)
```

## 2.2 Studio 로딩

파일: `lib/schedules/studio-loader.ts`

현재 흐름:

1. server Supabase client 생성.
2. calendar 조회.
3. `getPublicSchedule(calendarSlug)`, `resolveCurrentActor(calendarSlug)`, `getUnlockState(calendarSlug)` 병렬 호출.
4. tags/palette/events/support_campaigns 병렬 조회.
5. 서버에서 role/unlock 기준으로 private event를 한 번 더 필터링.

좋은 점:

- private data를 클라이언트에서 숨기는 방식이 아니라 서버 응답에서 제거한다.
- RLS와 서버 DTO 필터를 함께 사용한다.
- 주요 reads를 `Promise.all`로 병렬화한다.

중복 문제:

`app/page.tsx`와 `app/(studio)/studio/page.tsx`에서도 actor/unlock을 조회하고, `getStudioSchedule()` 내부에서도 다시 actor/unlock을 조회한다.

예:

```ts
const [actor, schedule, unlock] = await Promise.all([
  resolveCurrentActor("vic"),
  getStudioSchedule("vic"),
  getUnlockState("vic")
]);
```

그런데 `getStudioSchedule("vic")` 내부에서 다시:

```ts
const [viewerModePreview, actor, unlock] = await Promise.all([
  getPublicSchedule(calendarSlug),
  resolveCurrentActor(calendarSlug),
  getUnlockState(calendarSlug)
]);
```

권장:

`getStudioSchedule()`에 context를 주입한다.

```ts
export async function getStudioSchedule(
  calendarSlug: string,
  context?: {
    actor?: CurrentActor;
    unlock?: UnlockState;
    includeViewerHeartIds?: boolean;
  }
): Promise<StudioSchedule> {
  ...
}
```

그리고 page에서는 이미 구한 값을 전달한다.

```ts
const [actor, unlock] = await Promise.all([
  resolveCurrentActor("vic"),
  getUnlockState("vic")
]);
const schedule = await getStudioSchedule("vic", {
  actor,
  unlock,
  includeViewerHeartIds: false
});
```

Studio preview에서 개인 하트 ID가 꼭 필요하지 않다면 `getPublicSchedule(..., { includeMyHeartIds: false })` 형태도 고려할 수 있다.

## 2.3 Private layer unlock

파일:

- `app/api/unlock-private-layer/route.ts`
- `lib/private-layer/unlock.ts`
- `components/private-layer/private-layer-panel.tsx`

현재 흐름:

1. 클라이언트에서 `/api/unlock-private-layer` POST.
2. 서버에서 calendar/settings 조회.
3. passcode hash 검증.
4. 기존 unlock session delete.
5. 새 unlock session insert.
6. 클라이언트에서 `router.refresh()`.

좋은 점:

- passcode를 plaintext로 저장하지 않는다.
- `passcode_version`, `expires_at` 기반으로 session invalidation을 처리한다.
- unlock 후 private data를 다시 서버 렌더로 받아오므로 client-only permission check가 아니다.

개선점:

- `getUnlockState()`는 calendar, private_layer_settings, unlock_sessions를 순차 조회한다.
- page와 loader에서 중복 호출될 수 있다.
- `unlock_sessions(user_id, calendar_id, passcode_version, expires_at)` 계열 index가 있으면 unlock check 비용이 줄어든다.

권장 인덱스:

```sql
create index if not exists unlock_sessions_user_calendar_version_expires_idx
  on public.unlock_sessions (user_id, calendar_id, passcode_version, expires_at);
```

만료 세션 cleanup도 필요하다.

```sql
delete from public.unlock_sessions where expires_at < now();
```

## 3. UI 수정 이후 서버 영향 평가

## 3.1 현재 dirty CSS 변경 영향

현재 변경된 `components/poster/public-poster.css`는 agenda 월 표시 스타일만 바꾼다.

서버 영향:

- 추가 fetch 없음.
- server action 호출 없음.
- `router.refresh()` 추가 없음.
- export/action payload 변경 없음.
- cache invalidation 변경 없음.

결론: 서버 최적화 우선순위에는 영향이 없다.

## 3.2 고정 포스터 캔버스 구조의 서버 영향

현재 `PublicPoster`는 다음 상수를 사용한다.

```ts
const POSTER_DESIGN_W = 1840;
const POSTER_DESIGN_H = Math.round((POSTER_DESIGN_W * 9) / 16); // 1035
```

그리고 화면에서는 `posterScale`을 계산해 `.poster-scaler`에 scale을 적용한다.

서버 관점에서 좋은 점:

- 포스터 표면의 실제 좌표/비율이 viewport에 따라 reflow되지 않는다.
- 스티커 `xRatio`, `yRatio`, `widthRatio`가 더 안정적으로 유지된다.
- 화면 크기 변화 때문에 불필요한 sticker save가 발생하지 않는다.

주의할 점:

- 고정 캔버스가 되면서 sticker payload 자체는 변하지 않지만, 사용자가 꾸미기 모드에서 더 정밀하게 조작할 가능성이 커진다.
- 조작이 잦아질수록 `saveStickerAction` 호출 빈도가 성능 병목이 될 수 있다.

## 3.3 스티커 저장 흐름 평가

현재 저장 흐름:

- 새 emoji/text/image sticker 추가: 즉시 `saveStickerAction`
- sticker drag/gesture commit: `commitSticker`
- 키보드 미세 이동: `scheduleCommit()`으로 350ms debounce
- flip/effect/color/z-index 변경: 대부분 즉시 `commitSticker`
- undo/redo: 삭제/생성/수정을 순차로 서버 반영
- 여러 sticker 삭제: `for` loop로 `deleteStickerAction` 반복

좋은 점:

- 키보드 미세 이동에 debounce가 있다.
- temp id로 optimistic UI를 보여준다.
- 저장 실패 시 error를 표시한다.
- 삭제된 asset을 참조하는 sticker를 undo/복제에서 걸러 FK 오류를 줄인다.

병목 가능성:

- 다중 선택 삭제는 sticker 개수만큼 server action을 호출한다.
- undo/redo는 snapshot diff를 순차 처리하므로 sticker 수가 늘면 느려질 수 있다.
- text color, effect, z-index 같은 작은 변경도 매번 전체 public cache invalidation을 유발한다.
- `saveStickerAction`은 성공할 때마다 `revalidatePath("/")`, `revalidatePath("/studio/decorate", "layout")`, `revalidatePublicSchedule()`를 호출한다.

권장:

1. `saveStickerBatchAction` 추가.
2. `deleteStickerBatchAction` 추가.
3. undo/redo의 server 반영을 batch로 묶기.
4. sticker 저장의 cache invalidation을 debounce하거나 batch action 마지막에 한 번만 호출.

예:

```ts
export type StickerBatchInput = {
  upserts: SaveStickerInput[];
  deletes: string[];
};

export async function saveStickerBatchAction(input: StickerBatchInput) {
  // permission check once
  // calendar lookup once
  // upsert/delete in transaction or RPC
  // revalidate once
}
```

## 4. Mutation 최적화 평가

## 4.1 Event 저장

파일: `lib/schedules/event-actions.ts`

현재 `saveEventAction`은 다음 단계를 별도 쿼리로 실행한다.

1. actor resolve.
2. calendar id 조회.
3. event insert/update.
4. 기존 `event_tags` delete.
5. 새 `event_tags` insert.
6. private meta upsert/delete.
7. cache/path revalidate.

문제:

- DB round trip이 많다.
- 중간 실패 시 부분 저장 가능성이 있다.
- event/tag/private meta가 사용자는 "한 번 저장"으로 느끼는 작업인데 transaction이 아니다.

권장:

`save_event_with_tags` RPC로 묶는다.

효과:

- network round trip 감소.
- transaction consistency 확보.
- server action 코드 단순화.
- event update 성공 후 tag insert 실패 같은 중간 상태 방지.

## 4.2 Event reorder

현재 `reorderEventsAction`은 `orderedIds.map(...update...)`를 `Promise.all`로 날린다.

좋은 점:

- 병렬이라 단일 순차 update보다는 빠르다.

문제:

- update 개수만큼 요청이 생긴다.
- 전체 reorder가 하나의 transaction이 아니다.
- 일부 update 실패 시 sort_order가 어긋날 수 있다.

권장:

`reorder_events` RPC를 만든다.

입력 예:

```json
{
  "dateKey": "2026-05-27",
  "movedId": "event-id",
  "orderedIds": ["a", "b", "c"]
}
```

DB에서는 `unnest` 또는 `jsonb_to_recordset`으로 한 번에 update한다.

## 4.3 Tag 저장

현재 `saveTagsAction`은 다음을 수행한다.

- 태그 중복/이름 validation.
- calendar id 조회.
- 새 태그가 있으면 tag count 확인.
- 필요 시 palette insert.
- 새 tag insert 반복.
- 기존 tag update 병렬 처리.
- revalidate.

태그는 최대 20개라 지금도 성능상 아주 큰 문제는 아니다. 하지만 palette/tag 생성과 기존 update가 하나의 "저장" 작업이므로 transaction으로 묶는 것이 더 안전하다.

권장:

- 단기: 유지 가능.
- 중기: `save_tags` RPC로 palette insert + tag insert/update를 한 transaction으로 묶기.

## 4.4 Theme 변경

파일: `lib/schedules/theme-actions.ts`

poster theme 변경은 단일 update라 구조가 적절하다. 다만 테마 버튼을 연속 클릭하면 action이 여러 번 날아갈 수 있다.

권장:

- client에서 pending 상태 동안 버튼 disable.
- 마지막 선택만 저장하는 debounce 고려.

## 4.5 Heart toggle

파일: `lib/schedules/heart-actions.ts`, `db/migrations/0016_event_hearts.sql`

좋은 구조다.

- `toggle_event_heart` RPC가 insert/delete/count를 묶는다.
- public event에만 heart를 허용한다.
- user_id는 공개 DTO에 노출하지 않는다.
- heart toggle은 public schedule cache를 무효화하지 않는다.

개선점:

`loadMyHeartIds()`가 `event_hearts` 전체에서 본인 row를 가져온다. RLS 때문에 본인 것만 보이지만, calendar 범위를 제한하면 더 낫다.

권장:

- 현재 calendar의 public event IDs로 제한.
- 또는 RPC `get_my_event_heart_ids(p_calendar_id)` 추가.

```sql
select h.event_id
from public.event_hearts h
join public.events e on e.id = h.event_id
where h.user_id = auth.uid()
  and e.calendar_id = p_calendar_id
  and e.is_public;
```

## 5. 캐싱 전략 평가

## 5.1 현재 구조

파일: `lib/schedules/cache.ts`

```ts
export const PUBLIC_SCHEDULE_CACHE_TAG = "public-schedule";

export function revalidatePublicSchedule() {
  revalidateTag(PUBLIC_SCHEDULE_CACHE_TAG);
}
```

좋은 점:

- 공개 viewer traffic을 매번 DB에 태우지 않는다.
- owner/studio 수정 직후 공개 캐시를 명시적으로 무효화한다.

문제:

- tag가 전체 공개 schedule 하나뿐이다.
- 캘린더가 여러 개가 되면 한 캘린더 수정이 모든 공개 schedule cache를 무효화한다.
- sticker 미세 수정도 전체 공개 schedule cache를 무효화한다.

권장:

```ts
export function publicScheduleCacheTag(slug: string) {
  return `public-schedule:${slug}`;
}

export function publicScheduleMonthCacheTag(slug: string, year: number, month: number) {
  return `public-schedule:${slug}:${year}-${String(month).padStart(2, "0")}`;
}
```

단기적으로는 slug 단위만 도입해도 충분하다.

## 5.2 월별 캐시 분리

현재 public schedule은 모든 events/stickers/assets를 가져온다. 데이터가 적을 때는 단순해서 좋다. 하지만 일정과 스티커가 누적되면 월별 조회가 필요하다.

권장 분리:

- public shell: calendar/title/theme/tags/palette
- public month: events/support/stickers for visible month
- public assets: sticker assets list, 필요 시 lazy load

주의:

너무 빨리 API를 쪼개면 request 수가 늘어난다. 서버 컴포넌트 내부에서는 병렬 query를 묶는 것이 좋고, 클라이언트 API는 실제 필요한 화면 단위로만 분리한다.

## 6. DB/RLS 성능 평가

## 6.1 현재 장점

- 주요 테이블에 RLS가 켜져 있다.
- public/private/event_private_meta 경계가 DB policy에도 있다.
- private unlock은 `passcode_version`과 `expires_at`을 함께 본다.
- heart count는 security definer RPC로 public aggregate만 노출한다.

## 6.2 인덱스 보강 필요

현재 schema는 primary key/unique key 외에 성능용 index가 많지 않다. RLS 함수와 public/studio queries가 자주 쓰는 컬럼에는 index가 필요하다.

권장 migration:

```sql
create index if not exists calendars_slug_public_idx
  on public.calendars (slug, is_public);

create index if not exists events_calendar_date_sort_idx
  on public.events (calendar_id, date_key, sort_order);

create index if not exists events_public_calendar_date_idx
  on public.events (calendar_id, date_key, sort_order)
  where visibility_scope = 'public' and status <> 'draft';

create index if not exists broadcast_tags_calendar_sort_active_idx
  on public.broadcast_tags (calendar_id, sort_order)
  where is_active = true;

create index if not exists color_palette_calendar_sort_idx
  on public.color_palette (calendar_id, sort_order);

create index if not exists support_campaigns_calendar_public_idx
  on public.support_campaigns (calendar_id, starts_on, ends_on)
  where is_public = true and is_active = true;

create index if not exists sticker_instances_calendar_month_visible_idx
  on public.sticker_instances (calendar_id, year, month, z_index)
  where is_visible = true;

create index if not exists sticker_assets_calendar_created_idx
  on public.sticker_assets (calendar_id, created_at desc);

create index if not exists unlock_sessions_user_calendar_version_expires_idx
  on public.unlock_sessions (user_id, calendar_id, passcode_version, expires_at);

create index if not exists event_tags_tag_sort_idx
  on public.event_tags (tag_id, sort_order);
```

`trusted_members`는 현재 email 기반 join을 사용하므로 장기적으로 `user_id`를 추가하는 것이 좋다.

장기 권장:

```sql
alter table public.trusted_members
  add column if not exists user_id uuid references auth.users(id);

create index if not exists trusted_members_calendar_user_active_idx
  on public.trusted_members (calendar_id, user_id)
  where is_active = true;
```

## 7. API/DTO 최적화

## 7.1 Public events API

파일: `app/api/public/[calendarSlug]/events/route.ts`

현재:

```ts
const schedule = await getPublicSchedule(calendarSlug);
return NextResponse.json(schedule);
```

route 이름은 `events`인데 실제로는 전체 schedule DTO를 반환한다.

문제:

- 외부 API 소비자가 events만 필요해도 tags/palette/stickers/assets/heartCount까지 받는다.
- response size가 커질 수 있다.
- API 의미가 모호하다.

권장:

1. 유지할 거면 route 이름을 schedule에 맞춘다.
2. events endpoint라면 events만 반환한다.
3. query param으로 year/month를 받을 수 있게 한다.

예:

```ts
GET /api/public/vic/events?year=2026&month=5
GET /api/public/vic/schedule
GET /api/public/vic/decorations?year=2026&month=5
```

## 7.2 Studio DTO

`getStudioSchedule()`은 studio shell에 필요한 데이터를 한 번에 주는 구조다. 초기 개발에는 좋다. 하지만 기능이 늘어나면 다음처럼 분리할 수 있다.

- `getStudioMonthSchedule`
- `getStudioTagsAndPalette`
- `getStudioPrivateState`
- `getDecorateSchedule`

단, 분리할 때는 client fetch를 늘리는 방식보다 server component/page에서 병렬로 묶는 방식이 좋다.

## 8. 측정/관측 제안

최적화 전에 다음을 측정하면 방향이 선명해진다.

## 8.1 Loader duration

개발 환경에서 다음 함수의 duration을 로깅한다.

- `getPublicSchedule`
- `loadPublicScheduleData`
- `loadMyHeartIds`
- `getStudioSchedule`
- `getUnlockState`
- `saveEventAction`
- `saveStickerAction`
- `saveTagsAction`

간단 예:

```ts
const started = performance.now();
try {
  ...
} finally {
  if (process.env.NODE_ENV === "development") {
    console.log("[server-timing] getStudioSchedule", performance.now() - started);
  }
}
```

## 8.2 Response size

public schedule JSON size를 측정한다.

권장 기준:

- 200KB 이하: 양호.
- 500KB 이상: DTO split 검토.
- 1MB 이상: 월별 query/asset lazy loading 우선 도입.

## 8.3 Query explain

Supabase SQL editor에서 다음을 `explain analyze`로 확인한다.

- public events by calendar/date
- studio events by calendar/date
- sticker_instances by calendar/year/month/visible
- unlock session check
- event heart count RPC
- broadcast_tags by calendar/sort

## 9. 수정 로드맵

## Phase 1: 즉시 수정 권장

목표: 데이터 경계와 overfetch를 바로잡는다.

작업:

- `public-loader.ts` 모든 public query에 `.eq("calendar_id", calendar.id)` 추가.
- `loadMyHeartIds()`를 calendar-scoped RPC 또는 join query로 변경.
- public events API가 full schedule을 반환하는 이유를 정리하고, 필요 시 DTO 축소.

위험도: 낮음  
효과: 높음

## Phase 2: 중복 조회 제거

목표: 같은 request 안에서 actor/unlock/public schedule을 반복 조회하지 않는다.

작업:

- `getStudioSchedule()`에 actor/unlock context 주입.
- page에서 이미 구한 actor/unlock을 loader에 전달.
- studio preview에서는 `includeMyHeartIds: false` 옵션 검토.

위험도: 중간  
효과: 중간~높음

## Phase 3: 인덱스 추가

목표: public/studio 주요 read와 RLS check를 안정화한다.

작업:

- events public partial index.
- sticker_instances month/visible index.
- unlock_sessions user/calendar/version/expires index.
- tags/palette sort index.
- support campaigns public active index.

위험도: 낮음~중간  
효과: 데이터 증가 시 높음

## Phase 4: Sticker batch 저장

목표: 꾸미기 모드에서 server action 호출 수와 cache invalidation 횟수를 줄인다.

작업:

- `saveStickerBatchAction`.
- `deleteStickerBatchAction`.
- undo/redo server 반영 batch화.
- batch action 마지막에만 `revalidatePublicSchedule()`.

위험도: 중간  
효과: 꾸미기 모드 체감 성능 개선

## Phase 5: Event/tag RPC화

목표: transaction consistency와 round trip 감소.

작업:

- `save_event_with_tags` RPC.
- `reorder_events` RPC.
- `save_tags` RPC.

위험도: 중간~높음  
효과: 편집 안정성/성능 개선

## Phase 6: 월별 loader/cache 분리

목표: 일정/스티커 데이터가 누적되어도 viewer/studio가 가볍게 유지되게 한다.

작업:

- visible month range 계산 서버 util화.
- event overlap 조건을 RPC로 처리.
- public schedule cache tag를 slug/month 단위로 세분화.
- asset list lazy loading 검토.

위험도: 중간  
효과: 장기 확장성 개선

## 10. 최종 권장안

이번 UI 변경은 서버 통신에 직접 영향을 주지 않는다. 하지만 현재 포스터가 고정 캔버스와 꾸미기 도구 중심으로 더 명확해진 만큼, 앞으로 서버 최적화는 "viewer read 최적화"와 "decorate mutation 최적화"를 분리해서 봐야 한다.

가장 먼저 할 일은 `public-loader.ts`의 calendar scoping이다. 이건 속도 문제이면서 동시에 공개 데이터 경계 문제다.

그 다음은 studio loader 중복 조회 제거다. private layer unlock 후 `router.refresh()`가 들어가는 흐름에서는 actor/unlock 중복 조회가 체감 속도에 영향을 줄 수 있다.

꾸미기 모드는 현재 키보드 미세 이동에 debounce가 있어 방향이 좋다. 다음 단계는 다중 삭제, undo/redo, 복제, 연속 스타일 변경을 batch 저장으로 묶고 cache invalidation을 마지막에 한 번만 하는 것이다.

정리하면 우선순위는 다음과 같다.

1. Public loader calendar scope 보강.
2. Public/myHeartIds query 범위 제한.
3. Studio actor/unlock 중복 조회 제거.
4. DB index migration 추가.
5. Sticker batch action 도입.
6. Event/tag 저장 RPC화.
7. 월별 loader/cache 분리.
