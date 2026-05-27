# VIC Schedule Studio 서버 통신 및 서버 최적화 평가 보고서

작성일: 2026-05-27 KST  
대상 영역:

- Next.js App Router page/server action/route handler
- Supabase Postgres/RLS/RPC/Storage
- 공개 viewer 데이터 로딩
- studio/editor 데이터 로딩
- sticker/tag/event mutation 흐름
- private layer unlock 흐름

주요 참고 자료:

- Next.js Caching and Revalidating: https://nextjs.org/docs/app/getting-started/caching-and-revalidating
- Next.js Caching deep dive: https://nextjs.org/docs/app/deep-dive/caching
- Next.js `useRouter` reference: https://nextjs.org/docs/app/api-reference/functions/use-router
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth/RLS performance guidance: https://supabase.com/docs/guides/auth/auth-deep-dive/auth-row-level-security

## 1. 결론 요약

현재 서버 구조는 방향이 나쁘지 않다. 공개 viewer 데이터는 `unstable_cache`로 30초 캐시하고, 수정 server action 이후 `revalidateTag`로 공개 캐시를 무효화한다. 하트 토글/집계도 Postgres RPC로 묶어둔 점이 좋다. 비공개 레이어도 서버에서 actor/unlock 상태를 판단하고, client-only 숨김에 의존하지 않으려는 설계가 보인다.

하지만 지금 구조에서 가장 먼저 손봐야 할 서버 최적화 포인트는 세 가지다.

1. 공개 loader의 calendar scope를 모든 쿼리에 명시해야 한다.
2. studio/page와 loader 사이에서 actor/unlock/public schedule 로딩이 중복된다.
3. 이벤트/태그/스티커 저장이 여러 round trip으로 쪼개져 있어, transaction/RPC로 묶을 여지가 크다.

현재는 VIC 단일 캘린더 전제라 문제가 작게 보일 수 있다. 하지만 캘린더가 2개 이상이 되거나 공개 viewer 트래픽이 늘면, overfetch와 RLS 비용이 바로 병목이 된다. 특히 `public-loader.ts`는 `calendars`에서 특정 slug를 찾은 뒤에도 `events`, `broadcast_tags`, `color_palette`, `sticker_instances`, `sticker_assets` 일부 쿼리에 `calendar_id = calendar.id` 필터가 빠져 있다. 이건 성능 이슈이면서 동시에 public/private boundary 관점에서도 조심해야 하는 부분이다.

권장 우선순위:

1. `getPublicSchedule` 쿼리 calendar scoping 수정.
2. DB 인덱스 보강.
3. `getStudioSchedule`에 이미 구한 actor/unlock을 주입해 중복 resolve 제거.
4. save/reorder/tag/sticker mutation을 RPC 또는 batch endpoint로 통합.
5. 공개 캐시 tag를 calendar/month 단위로 세분화.
6. visual/export와 별도로 API response size 및 query count 관측 추가.

## 2. 현재 구조 개요

## 2.1 공개 viewer 로딩

파일: `lib/schedules/public-loader.ts`

흐름:

1. `getPublicSchedule(calendarSlug)` 호출.
2. Supabase 미설정이면 sample data 반환.
3. `loadPublicScheduleData(calendarSlug)`는 `unstable_cache`로 30초 캐시.
4. 로그인 사용자의 `myHeartIds`는 별도 uncached query로 로딩.
5. 공개 데이터는 anon Supabase client로 조회.

좋은 점:

- 공개 데이터와 사용자별 데이터가 분리되어 있다.
- 공개 데이터는 캐시되고, 사용자별 하트 목록은 캐시하지 않는다.
- 공개 client는 anon key + RLS 기반이라 service role overexposure 위험이 낮다.
- heart count는 `get_event_heart_counts` RPC를 사용해 user_id를 노출하지 않는다.

문제점:

- 공개 데이터 쿼리 중 calendar scope가 빠진 곳이 있다.
- 캐시 tag가 `public-schedule` 하나라 캘린더/월별 세분화가 안 되어 있다.
- `loadMyHeartIds()`가 모든 `event_hearts`를 가져온다. RLS가 본인 것만 보이게 하더라도 calendar/event 범위 필터가 없어 사용자 활동이 많아질수록 불필요한 데이터가 늘어난다.
- public API route `/api/public/[calendarSlug]/events`가 전체 schedule DTO를 그대로 반환한다. 필요 API가 "events"라면 response가 과하다.

## 2.2 Studio 로딩

파일: `lib/schedules/studio-loader.ts`

흐름:

1. `createSupabaseServerClient()`
2. calendar 조회.
3. `getPublicSchedule(calendarSlug)`, `resolveCurrentActor(calendarSlug)`, `getUnlockState(calendarSlug)` 병렬 호출.
4. tags/palette/events/support_campaigns 조회.
5. 서버에서 role/unlock 기준으로 private event를 한번 더 필터링.

좋은 점:

- private data를 client CSS로 숨기는 방식이 아니라 서버 응답에서 필터링한다.
- RLS와 서버 필터를 함께 사용한다.
- Supabase query를 `Promise.all`로 병렬화한다.
- `event_private_meta`를 studio loader에서만 포함한다.

문제점:

- `app/page.tsx`와 `app/(studio)/studio/page.tsx`에서 이미 actor/unlock을 구하는데, `getStudioSchedule()` 안에서 다시 `resolveCurrentActor()`와 `getUnlockState()`를 호출한다.
- `getStudioSchedule()`이 `getPublicSchedule()`을 호출하고, public loader는 다시 `loadMyHeartIds()`를 호출할 수 있다. Studio preview에 개인 하트 ID가 꼭 필요하지 않다면 불필요한 쿼리다.
- studio events는 한 번에 전체 events를 가져온다. 데이터가 커지면 기본 월 또는 인접 월 범위로 제한하는 전략이 필요하다.
- sticker data는 studio schedule의 top-level에서는 비어 있고 viewer preview에만 들어간다. 의도라면 괜찮지만, decorate/studio page별 loader를 더 명확히 나누면 쿼리와 DTO가 줄어든다.

## 2.3 Mutation 흐름

주요 파일:

- `lib/schedules/event-actions.ts`
- `lib/schedules/tag-actions.ts`
- `lib/schedules/sticker-actions.ts`
- `lib/schedules/sticker-asset-actions.ts`
- `lib/schedules/theme-actions.ts`
- `lib/schedules/link-actions.ts`
- `lib/schedules/heart-actions.ts`
- `lib/private-layer/actions.ts`

좋은 점:

- 대부분 server action에서 role 검사를 먼저 한다.
- 수정 후 `revalidatePath("/")`, `revalidatePath("/studio")`, `revalidatePublicSchedule()`를 호출해 viewer/studio 반영을 맞춘다.
- 하트 토글은 RPC로 처리되어 insert/delete/count가 한 서버-side transaction 안에서 처리된다.
- sticker upload 실패 시 storage 파일을 제거하는 보정 로직이 있다.

문제점:

- `saveEventAction`은 event upsert, event_tags delete, event_tags insert, private_meta upsert/delete가 여러 네트워크 round trip으로 나뉜다.
- 중간 단계 실패 시 부분 반영 가능성이 있다. 예를 들어 event update는 성공했는데 tag insert가 실패하면 UI/DB 상태가 어긋날 수 있다.
- `reorderEventsAction`, `updateTagsAction`, `saveTagsAction`은 여러 update를 `Promise.all`로 날린다. 병렬이라 빠르지만 요청 수는 많고 transaction consistency가 없다.
- sticker drag/resize 저장이 자주 발생하면 매번 `revalidatePath`와 public cache invalidation이 발생한다.
- 모든 공개 수정이 동일한 broad invalidation을 사용한다.

## 3. 가장 중요한 발견: 공개 loader calendar scoping

현재 `loadPublicScheduleData()`는 먼저 calendar를 찾는다.

```ts
const { data: calendar } = await supabase
  .from("calendars")
  .select(...)
  .eq("slug", calendarSlug)
  .eq("is_public", true)
  .maybeSingle();
```

그런데 이후 병렬 쿼리 일부에는 `calendar_id = calendar.id`가 없다.

예:

```ts
supabase.from("broadcast_tags").select(...).eq("is_active", true)
supabase.from("color_palette").select(...).order("sort_order")
supabase.from("events").select(...).eq("visibility_scope", "public").neq("status", "draft")
supabase.from("sticker_instances").select(...).eq("is_visible", true)
supabase.from("sticker_assets").select(...).order("created_at", { ascending: false })
```

현재 VIC 단일 캘린더라면 실사용에서 티가 덜 날 수 있다. 하지만 멀티 캘린더가 되면 다음 문제가 생긴다.

- 다른 공개 캘린더의 이벤트/태그/스티커가 섞일 수 있다.
- 데이터가 많아질수록 공개 viewer 요청이 모든 캘린더 데이터를 훑는다.
- RLS policy가 public row를 허용하므로, application-level scoping이 더 중요하다.
- cache도 calendar별 data가 아닌 aggregate public data처럼 커진다.

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
  .select(...)
  .eq("calendar_id", calendar.id)
  .eq("visibility_scope", "public")
  .neq("status", "draft")
  .order("date_key")
  .order("created_at");

supabase
  .from("sticker_instances")
  .select(...)
  .eq("calendar_id", calendar.id)
  .eq("is_visible", true);

supabase
  .from("sticker_assets")
  .select("id, name, file_url, file_type")
  .eq("calendar_id", calendar.id)
  .order("created_at", { ascending: false });
```

이건 서버 최적화 보고서의 1순위 수정사항이다. 성능보다도 데이터 경계가 더 중요하다.

## 4. 캐싱 평가

## 4.1 현재 캐싱

현재 공개 schedule은 다음과 같이 캐시된다.

```ts
const PUBLIC_SCHEDULE_REVALIDATE_SECONDS = 30;

const loadPublicScheduleData = unstable_cache(
  async (calendarSlug: string): Promise<PublicSchedule> => { ... },
  ["public-schedule-data"],
  { revalidate: PUBLIC_SCHEDULE_REVALIDATE_SECONDS, tags: [PUBLIC_SCHEDULE_CACHE_TAG] }
);
```

그리고 mutation 후:

```ts
revalidatePath("/");
revalidatePath("/studio");
revalidatePublicSchedule();
```

좋은 점:

- 공개 viewer traffic을 DB에서 분리하려는 의도가 명확하다.
- owner가 수정하면 30초 TTL을 기다리지 않고 공개 캐시를 무효화한다.
- 사용자별 하트 목록은 public cache에 섞지 않는다.

개선점:

1. tag 세분화

현재 tag는 하나다.

```ts
export const PUBLIC_SCHEDULE_CACHE_TAG = "public-schedule";
```

단일 VIC 캘린더만 유지한다면 괜찮다. 하지만 확장성을 생각하면 다음이 좋다.

```ts
public-schedule:vic
public-schedule:vic:2026-05
public-schedule:vic:stickers
public-schedule:vic:palette
```

2. mutation별 invalidation 분리

- event/tag/palette 수정: 공개 schedule invalidation 필요.
- sticker 위치 수정: 공개 schedule invalidation 필요하지만, 아주 잦으면 debounce/batch 필요.
- heart toggle: 공개 schedule cache invalidation을 하지 않는 현재 구조가 맞다. 하트는 RPC response로 즉시 count를 받고, 전체 공개 schedule 캐시를 매번 날리면 캐시가 무의미해진다.
- private-only 수정: public cache invalidation이 꼭 필요한지 판단해야 한다. `visibilityScope`가 public이 아니고 공개 필드가 바뀌지 않았다면 public schedule invalidation은 피할 수 있다.

3. `revalidateTag` 동작 확인

Next.js 최신 문서에서는 `revalidateTag(tag, "max")`를 stale-while-revalidate 방식으로 권장하고, Server Action에서 즉시 read-your-own-writes가 필요하면 `updateTag`를 설명한다. 현재 프로젝트는 Next 15라 Cache Components 전환 전 모델을 쓰고 있지만, 향후 Next 업그레이드 시 cache API 정책을 재검토해야 한다.

## 4.2 API route caching

`app/api/public/[calendarSlug]/events/route.ts`는 `getPublicSchedule()`을 그대로 JSON으로 반환한다.

```ts
const schedule = await getPublicSchedule(calendarSlug);
return NextResponse.json(schedule);
```

이 route가 외부 공개 API라면 다음을 고려할 수 있다.

- HTTP `Cache-Control` 헤더 추가.
- `events` endpoint라면 events만 반환하거나 query param으로 필요한 slice를 받기.
- `ETag` 또는 `Last-Modified` 계열 사용.
- `calendarSlug`, `year`, `month` 기반 DTO 제공.

주의:

Next.js의 server cache와 CDN cache는 다르다. 공식 문서에서도 CDN-level cache는 `revalidateTag`/`revalidatePath`와 별도로 동작할 수 있다고 설명한다. Vercel/Next cache와 CDN header를 같이 쓸 때는 "owner 수정 직후 공개 페이지 즉시 반영" 요구를 해치지 않도록 TTL을 짧게 잡거나 SWR 전략을 써야 한다.

## 5. 데이터베이스/RLS 성능 평가

## 5.1 현재 RLS 구조

RLS는 모든 주요 테이블에 enable되어 있다.

- calendars
- trusted_members
- private_layer_settings
- unlock_sessions
- color_palette
- broadcast_tags
- events
- event_private_meta
- event_tags
- support_campaigns
- sticker_assets
- sticker_instances

좋은 점:

- Supabase public schema 노출 기준으로 RLS를 켠 것은 맞다.
- public/private boundary를 DB layer에서도 방어한다.
- private unlock은 `unlock_sessions`, `private_layer_settings.passcode_version`, `expires_at`를 함께 본다.
- owner_private은 별도 scope로 분리되어 있다.

## 5.2 RLS 함수 비용

RLS policy에서 다음 함수들이 자주 쓰인다.

- `is_developer()`
- `is_calendar_owner(target_calendar_id)`
- `is_calendar_admin(target_calendar_id)`
- `is_active_trusted_member(target_calendar_id)`
- `has_private_unlock(target_calendar_id)`

Supabase 공식 문서에서도 RLS policy에 사용되는 컬럼에는 index를 추가하라고 안내한다. 현재 schema에는 primary key/unique key 외에 명시 index가 많지 않다. 특히 row가 늘어날 수 있는 테이블은 인덱스를 보강해야 한다.

권장 인덱스:

```sql
create index if not exists calendars_slug_public_idx
  on public.calendars (slug, is_public);

create index if not exists events_calendar_date_idx
  on public.events (calendar_id, date_key, sort_order);

create index if not exists events_public_calendar_date_idx
  on public.events (calendar_id, date_key, sort_order)
  where visibility_scope = 'public' and status <> 'draft';

create index if not exists broadcast_tags_calendar_sort_idx
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

create index if not exists unlock_sessions_user_calendar_expires_idx
  on public.unlock_sessions (user_id, calendar_id, expires_at);

create index if not exists trusted_members_calendar_email_active_idx
  on public.trusted_members (calendar_id, lower(email))
  where is_active = true;
```

주의:

- `trusted_members`의 `lower(email)` index는 expression index라 실제 migration에서 문법 확인이 필요하다.
- `events_public_calendar_date_idx`는 public viewer 최적화용 partial index다.
- month별 sticker query를 도입한다면 `year, month` index 효율이 좋아진다.

## 5.3 Email join 개선

현재 trusted member 판단은 `trusted_members.email`과 `auth.users.email`을 lower-case join하는 방식이다.

이 방식은 구현이 단순하지만, 성능과 안정성 면에서 장기적으로는 `user_id`를 저장하는 편이 좋다.

권장:

- `trusted_members.user_id uuid references auth.users(id)` 추가.
- 초대/등록 단계에서 email을 user_id로 resolve.
- 기존 email은 표시/초대용으로 유지.
- RLS 함수는 `user_id = auth.uid()`를 우선 사용.

이렇게 하면 RLS 함수가 auth.users join과 lower 비교를 덜 하게 된다.

## 6. Query shape와 DTO 최적화

## 6.1 Public DTO

현재 public schedule DTO는 꽤 크다.

포함:

- calendar
- tags
- palette
- events
- supportCampaigns
- stickers
- stickerAssets
- heartCount
- myHeartIds

공개 viewer 첫 화면에는 이 전체가 필요할 수 있지만, API endpoint나 모바일 agenda에는 전부 필요하지 않을 수 있다.

권장 DTO 분리:

- `getPublicScheduleFull(slug)`: 현재 viewer/page용
- `getPublicEvents(slug, year, month)`: 외부 API/agenda용
- `getPosterDecoration(slug, year, month)`: stickers/assets/theme용
- `getPaletteAndTags(slug)`: tags/palette용

단, 너무 빨리 쪼개면 요청 수가 늘 수 있다. 서버 컴포넌트에서는 내부적으로 병렬 query를 묶을 수 있으므로, "외부 API response size"와 "서버 내부 query count"를 따로 판단해야 한다.

## 6.2 Month range filtering

현재 public/studio events query는 전체 이벤트를 가져온다.

초기에는 괜찮다. 하지만 일정이 1년 이상 쌓이면 viewer는 이번 달과 인접 월 일부만 필요하다.

월간 캘린더에 필요한 범위:

- 보이는 달의 첫 번째 주 시작일
- 보이는 달의 마지막 주 종료일
- multi-day event가 앞에서 시작해 현재 달까지 걸치는 경우

간단한 1차 개선:

```ts
.gte("date_key", visibleStart)
.lte("date_key", visibleEnd)
```

하지만 multi-day event가 visibleStart 이전에 시작해서 visibleStart 이후에 끝나는 경우가 빠질 수 있다. 더 정확한 조건은 다음 형태다.

```sql
date_key <= visible_end
and coalesce(end_date_key, date_key) >= visible_start
```

Supabase query builder에서는 `or` 조건이 복잡해질 수 있으므로, 월간 이벤트 조회 RPC를 만드는 편이 더 깔끔하다.

예:

```sql
create or replace function public.get_public_month_schedule(
  p_calendar_id uuid,
  p_visible_start date,
  p_visible_end date
)
returns setof public.events
...
```

## 7. Mutation 최적화 제안

## 7.1 `saveEventAction`

현재:

1. actor resolve
2. calendar id 조회
3. event insert/update
4. event_tags delete
5. event_tags insert
6. private_meta upsert/delete
7. revalidate

권장:

Postgres RPC `save_event_with_tags`로 묶는다.

장점:

- 네트워크 round trip 감소.
- transaction consistency 확보.
- 서버 액션 코드 단순화.
- tag/private meta 실패 시 event만 저장되는 중간 상태 방지.

개략:

```sql
begin
  -- check calendar/permission can remain in app or be repeated in function
  -- upsert events
  -- delete/insert event_tags
  -- upsert/delete event_private_meta
  return event_id;
end;
```

보안상 주의:

- RPC를 `security definer`로 만들 경우 내부 권한 검사를 반드시 넣는다.
- 아니면 server action에서 role 검사 후 service/admin client로 RPC를 호출하되, 입력값 검증을 더 엄격하게 한다.
- owner_private 생성 제한은 DB 함수에도 중복 방어가 있으면 좋다.

## 7.2 `reorderEventsAction`

현재는 `orderedIds.map(update)`를 `Promise.all`로 보낸다. 이벤트가 10개면 update 10개다.

권장:

`jsonb_to_recordset` 또는 `unnest(uuid[], int[])` 기반 RPC.

예:

```sql
create or replace function public.reorder_events(
  p_calendar_id uuid,
  p_date_key date,
  p_items jsonb
)
returns void
...
```

장점:

- 요청 1회.
- 한 transaction.
- moved event date update와 sort_order update를 같이 처리.
- 실패 시 전체 rollback.

## 7.3 `saveTagsAction` / `updateTagsAction`

현재 tag updates는 병렬 update다. tag는 최대 20개라 큰 문제는 아니지만, 색상 중복/생성/삭제까지 포함하면 transaction으로 묶는 편이 안전하다.

권장:

- 지금 구조를 유지하되, 태그 수 20개 제한이면 성능보다 consistency를 우선해 RPC 전환.
- palette 생성 + tag 생성 + update를 한 transaction으로 묶기.

## 7.4 Sticker 저장

현재 sticker 저장은 단일 sticker 기준으로 잘 작성되어 있다. 다만 꾸미기 모드에서 drag/resize/toolbar 조작이 잦다면 server action 호출과 cache invalidation이 많아질 수 있다.

권장:

1. drag 중에는 local state만 변경.
2. pointer up 또는 toolbar commit 때만 저장.
3. 여러 sticker 선택 이동/삭제/복제는 batch action 제공.
4. sticker 위치 수정은 공개 캐시를 즉시 날리되, 연속 commit에 debounce를 둘 수 있는지 검토.

예:

```ts
saveStickerBatchAction({
  updates: [{ id, xRatio, yRatio, widthRatio, ... }]
})
```

## 8. Private Layer 서버 최적화

현재 unlock 흐름:

- `/api/unlock-private-layer` POST
- calendar id 조회
- private_layer_settings 조회
- passcode verify
- 기존 session delete
- unlock_sessions insert
- client `router.refresh()`

좋은 점:

- passcode hash를 사용한다.
- unlock session에 version과 expires_at이 있다.
- passcode 변경 시 기존 session invalidation 구조가 있다.

개선점:

1. unlock 상태 확인 쿼리 최적화

`getUnlockState()`는 `calendars`, `private_layer_settings`, `unlock_sessions`를 조회한다. 페이지와 studio loader에서 중복 호출되는 경우가 있으므로 상위에서 한 번만 조회해 전달하는 게 좋다.

2. unlock_sessions 정리

매 unlock 시 해당 user/calendar session을 delete하고 insert한다. 괜찮은 방식이다. 다만 만료 세션이 쌓일 수 있으므로 주기적 cleanup을 고려한다.

```sql
delete from public.unlock_sessions where expires_at < now();
```

3. index

`unlock_sessions(user_id, calendar_id, expires_at)` index는 unlock check에 중요하다.

## 9. Server Component / Client Refresh 평가

현재 client에서는 private unlock 후 `router.refresh()`를 사용한다. Next.js 공식 문서 기준으로 `router.refresh()`는 현재 route의 client cache를 새로고침하지만, server-side cache 자체를 무효화하지 않는다. 서버 캐시는 `revalidatePath`/`revalidateTag`가 담당한다.

이 앱에서는 unlock 후 private data가 사용자별 dynamic data이므로 `router.refresh()`가 적절하다. 다만 같은 페이지에서 이미 actor/unlock을 여러 번 resolve하면 refresh 비용이 커진다.

권장:

- `getStudioSchedule(calendarSlug, context)`처럼 actor/unlock을 인자로 받을 수 있게 한다.
- page에서 actor/unlock을 한 번만 resolve한다.
- loader 내부에서 필요 시 fallback으로만 resolve한다.

예:

```ts
export async function getStudioSchedule(
  calendarSlug: string,
  context?: { actor: CurrentActor; unlock: UnlockState }
) {
  const [viewerModePreview, actor, unlock] = await Promise.all([
    getPublicSchedule(calendarSlug, { includeMyHeartIds: false }),
    context?.actor ?? resolveCurrentActor(calendarSlug),
    context?.unlock ?? getUnlockState(calendarSlug)
  ]);
}
```

## 10. 관측/측정 제안

최적화는 측정 없이 하면 위험하다. 다음을 추가하면 좋다.

## 10.1 Query count logging

개발 환경에서 loader별 query count와 duration을 기록한다.

대상:

- `getPublicSchedule`
- `getStudioSchedule`
- `saveEventAction`
- `saveStickerAction`
- `saveTagsAction`
- `unlock-private-layer`

간단한 방식:

- action 시작/끝에서 `performance.now()` 측정.
- Supabase query wrapper를 만들기 어렵다면 주요 block 단위만 기록.
- production에서는 sampling 또는 disabled.

## 10.2 Response size 확인

공개 schedule JSON size를 체크한다.

목표:

- 모바일 viewer initial payload가 과도하게 커지지 않게 한다.
- sticker asset list가 커질 때 lazy load/월별 load로 전환할 기준을 잡는다.

권장 threshold:

- public schedule JSON 200KB 이하 유지.
- 500KB를 넘으면 DTO split 검토.
- 1MB를 넘으면 즉시 쿼리 범위/asset strategy 재검토.

## 10.3 Database explain

Supabase SQL editor에서 주요 쿼리 `explain analyze`를 확인한다.

우선 확인:

- public events by calendar/date
- studio events by calendar/date
- unlock session check
- event heart counts
- broadcast_tags by calendar/sort
- sticker_instances by calendar/month/visible

## 11. 단계별 개선 로드맵

## Phase 1: 안전한 스코프와 인덱스

목표: 데이터 경계와 기본 성능을 바로잡는다.

작업:

1. `public-loader.ts` 모든 query에 `calendar_id` 필터 추가.
2. `loadMyHeartIds()`에 calendar/event 범위 제한 추가.
3. DB 인덱스 migration 추가.
4. public events API response가 정말 full schedule이어야 하는지 재검토.

위험도: 낮음  
효과: 높음

## Phase 2: 중복 loader 제거

목표: 같은 request 안에서 actor/unlock/public schedule을 반복 조회하지 않는다.

작업:

1. `getStudioSchedule()`에 optional context 인자 추가.
2. `app/page.tsx`, `app/(studio)/studio/page.tsx`에서 actor/unlock 전달.
3. Studio preview용 `getPublicSchedule(..., { includeMyHeartIds: false })` 옵션 추가.
4. `resolveCurrentActor` 내부 결과가 같은 request 안에서 memoize 가능한지 검토.

위험도: 중간  
효과: 중간~높음

## Phase 3: Mutation RPC화

목표: event/tag/reorder 저장의 round trip과 부분 실패를 줄인다.

작업:

1. `save_event_with_tags` RPC 설계.
2. `reorder_events` RPC 설계.
3. `save_tags` RPC 설계.
4. server action은 validation/permission/error mapping 중심으로 축소.

위험도: 중간~높음  
효과: 높음

## Phase 4: 캐시 세분화

목표: 작은 변경이 전체 공개 캐시를 매번 날리지 않게 한다.

작업:

1. cache tag를 `public-schedule:${slug}`로 변경.
2. 필요하면 `public-schedule:${slug}:${year}-${month}` 추가.
3. public loader를 full/month/decorations로 나눌지 결정.
4. Next 업그레이드 시 `revalidateTag(tag, "max")` 또는 `updateTag` 전략 검토.

위험도: 중간  
효과: 트래픽 증가 시 높음

## Phase 5: 데이터 범위 제한

목표: 일정이 누적되어도 월간 viewer/studio가 빠르게 유지되도록 한다.

작업:

1. 월간 visible range 계산을 서버 loader로 이동하거나 공유 util화.
2. public/studio events query를 range 기반으로 제한.
3. multi-day overlap 조건을 RPC로 처리.
4. 필요 시 과거 월은 pagination/lazy loading.

위험도: 중간  
효과: 데이터 증가 시 높음

## 12. 구체 수정 후보 체크리스트

바로 할 수 있는 것:

- [ ] `public-loader.ts`의 tags/palette/events/stickers/assets query에 `.eq("calendar_id", calendar.id)` 추가.
- [ ] `loadMyHeartIds()`가 현재 calendar의 public event만 대상으로 하도록 수정.
- [ ] `PUBLIC_SCHEDULE_CACHE_TAG`를 slug 기반으로 확장할 수 있게 함수화.
- [ ] `getStudioSchedule()`에 actor/unlock context 주입.
- [ ] `app/page.tsx`와 `app/(studio)/studio/page.tsx`의 중복 actor/unlock 조회 제거.
- [ ] 인덱스 migration 추가.

그 다음 할 것:

- [ ] `saveEventAction` RPC화.
- [ ] `reorderEventsAction` RPC화.
- [ ] sticker batch save 추가.
- [ ] public API route DTO 축소.
- [ ] loader duration logging 추가.

장기 과제:

- [ ] trusted_members에 `user_id` 추가.
- [ ] 월별 schedule loader로 분리.
- [ ] cache tag 월별 세분화.
- [ ] Supabase Edge Function 또는 Postgres RPC로 public schedule aggregation 검토.

## 13. 최종 권장안

서버 최적화의 첫 단계는 "더 빠르게"가 아니라 "덜 가져오게" 만드는 것이다. 현재 public loader가 단일 VIC 캘린더에서는 잘 동작해도, 쿼리 scope가 캘린더에 고정되어 있지 않은 부분이 있어 멀티 캘린더/데이터 증가 상황에서 가장 먼저 병목과 경계 문제가 된다. 이 부분을 고치는 것이 1순위다.

두 번째는 중복 조회 제거다. 지금 page에서 actor/unlock을 구하고, studio loader 안에서 다시 actor/unlock을 구하는 구조가 있다. private layer unlock 후 `router.refresh()`가 들어갈 때 이런 중복은 체감 속도에 바로 영향을 준다.

세 번째는 mutation transaction화다. 이벤트 저장, 태그 저장, 정렬 변경은 사용자가 "한 번 저장"으로 인식하지만 서버에서는 여러 요청으로 쪼개져 있다. RPC로 묶으면 속도뿐 아니라 실패 일관성도 좋아진다.

현재 구조에서 이미 잘하고 있는 부분도 분명하다. 공개 데이터 캐시, 사용자별 하트 분리, heart RPC, server-side private filtering은 좋은 기반이다. 여기에 calendar scoping, 인덱스, 중복 loader 제거, mutation RPC화를 얹으면 서버 비용과 응답 지연이 꽤 안정적으로 줄어들 것이다.
