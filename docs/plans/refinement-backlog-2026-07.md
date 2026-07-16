# 개선안 백로그 — 2026-07 전면 감사

> **성격**: 새 기능 추가는 **없다**. 이미 있는 기능을 *덜 불편하게 · 더 재밌게 · 더 빠르게* 다듬는 것만.
> **작성**: 2026-07-17. 4갈래 병렬 감사(죽은 코드 · 서버/성능 · 시청자 몰입 · 편집실 UX) 후,
> 각 주장을 코드로 재확인해 오탐을 걷어낸 목록. 감사 원문이 아니라 **검증된 것만** 남겼다.
> **상태**: 📋 계획 — 아직 아무것도 구현 안 함.

## 읽는 법

- **W**(win) = 사용자 체감/성능 이득, **E**(effort) = S(30분 내) · M(반나절) · L(하루+).
- 파일:줄은 2026-07-17 `main`(`adcf3c0`) 기준.
- 배치 단위로 커밋하면 회귀 검토가 쉽다. 배치 순서는 아래 "권장 순서" 참고.

---

## A. 지금 당장 (W 큼 / E 작음)

### A1. 하트에 '서버 확정 톡'이 없다 — 우리 컨벤션을 우리가 어긴 유일한 곳 · W:상 E:S
`lib/ui/haptics.ts:11-14`가 **"누름 → 서버 확인 = 톡 두 번"** 을 명문화했고 스티커 경로는 지킨다
(`public-poster.tsx:1984`, `2006`). 그런데 앱에서 제일 많이 눌리는 하트는 누를 때만 톡
(`public-poster.tsx:1396`), 서버 확정(`:1441`)엔 아무 반응이 없다.
→ `:1441`의 `result.ok && isLatest` 분기에 `hapticTick()` 한 줄.

### A2. 하트 실패가 완전히 침묵한다 · W:상 E:S
`public-poster.tsx:1442-1450` — 실패하면 하트·집계·델타를 조용히 되돌린다. 시청자 눈엔
"♥ 켜졌다가 혼자 꺼짐". `hapticWarn`/`hapticError`는 `lib/ui/haptics.ts:51-52`에 정의만 되고
**아무 데서도 안 쓴다**(주석: "추후 단계용").
→ 그 분기에서 `hapticWarn()` + 이미 있는 `setHeartToast`(`:1409-1418`, 타이머 ref까지 있음)로
"하트를 저장하지 못했어요 — 잠시 뒤 다시 눌러주세요". **새 UI 0개.**

### A3. 태그 고르기가 '무관한 저장' 때문에 죽는다 — CLAUDE.md가 명시한 결함 · W:상 E:S
`studio-shell.tsx:2685` `disabled={pending}` — `pending`은 저장/삭제/태그/이동이 **공유하는**
`useTransition`(`:350`). 라벨은 "누르면 바로 적용"(`:2681`)이라 말하면서 죽는다.
정작 태그 쓰기 경로(`:2587-2634`)는 이 파일에서 가장 잘 만든 경로다 — 일정별 직렬 체인,
의도 ref, 중복 제거, 실패 재동기화, 2단계 햅틱까지. **빠른 연타를 위해 설계된 경로를 게이트가 막고 있다.**
→ `disabled={pending}` 삭제. 표시가 필요하면 `tagWriteChainRef.has(event.id)`로 스피너만.

### A4. 같은 결함 2곳 더 · W:중 E:S
- `components/tags/tag-legend-editor.tsx:719` — `disabled={locked || busy || deleteLock}`.
  `busy`는 에디터 전체 공용 transition(`:72`) → 어느 한 줄을 저장 중이면 **모든 행**의 삭제가 죽는다.
  이중삭제 방지는 `deleteLock`(`:78`)이 이미 한다. 게다가 죽어 있는 동안 tooltip은 여전히
  "이 태그 삭제"라고 거짓말한다. → `busy` 빼기.
- `components/private-layer/private-layer-panel.tsx:140` — **취소** 버튼에 `disabled={pending}`.
  onClick은 순수 클라이언트(`onDone()`/`setChanging(false)`). 저장 중이라고 취소를 막을 이유 없다.
  (옆 저장 버튼 `:157`의 게이트는 정당.)

### A5. 태그/팔레트 낙관적 상태가 서버 revalidation에 덮인다 · W:중 E:S
`studio-shell.tsx:699-704`는 무방비:
```js
useEffect(() => { setTags(schedule.tags); }, [schedule.tags]);
useEffect(() => { setPalette(schedule.palette); }, [schedule.palette]);
```
바로 위 `events`(`:672-678`)는 제대로 가드한다(`pendingRef || pendingPersistRef>0 || inflightWritesRef.size>0`).
`applyTagAdd/Remove/Updates`(`:3266-3283`)가 낙관적으로 쓰므로, 쓰기 도중 `router.refresh()`가
착지하면 이름변경/재채색/삭제가 옛 값으로 **깜빡 되돌아간다**. → `events`와 같은 가드 한 줄 복사.

### A6. Esc로 스티커 선택 해제가 안 된다 (게다가 월 이동까지 막힌다) · W:중 E:S
`public-poster.tsx:1511-1546`은 Ctrl+D/C, Delete, 화살표 미세이동을 처리하는데 **Escape가 없다**.
`:1578-1581`은 `decorate && selectedSticker`면 월 이동 화살표를 양보한다. 합치면 — 스티커를 고른 상태에선
**키보드로 해제도, 월 이동도 불가**. 마우스로 빈 캔버스를 찾아 눌러야 한다. → Escape 케이스 한 줄.

### A7. 단축키 안내가 Ctrl+C/V를 숨긴다 · W:소 E:S
`public-poster.tsx:4075-4097`에 Del·Ctrl+D·Z·Y·S·화살표·Shift+클릭은 있는데 **복사/붙여넣기가 없다**.
구현은 돼 있고(`:1523`, `:1553-1574`), 심지어 토스트가 "다른 달에서 Ctrl+V"라고 안내한다(`:2407`).
앱이 스스로 알려주는 단축키를 앱의 안내판이 숨기는 상태. → `<li>` 두 줄.

### A8. 월 이동 화살표만 촉감이 없다 · W:소 E:S
스와이프는 톡(`public-poster.tsx:2629`), 화살표(`:4390`, `:4446`)는 맨손. 같은 동작, 다른 감촉.
→ 핸들러에서 `hapticTick()`. **주의**: `moveMonth`(`:2552`) 안에 넣으면 `jumpToday`(`:2587`)·스와이프가
이미 톡을 울려 두 번 된다.

### A9. '내 관심' 토글 3곳 중 2곳만 촉감 없음 · W:소 E:S
`:4404`(모바일 하단 레일)는 톡. `:2993`(모바일 범례), `:3535`(웹 토글)는 맨손. 같은 상태를 바꾸는
같은 토글인데 누르는 위치에 따라 감촉이 다르다. → `:4404`와 동일하게.

---

## B. 코드 정리 (죽은 코드) — 동작 변화 0

> 전부 "저장소 전수 grep으로 참조 0건"을 **직접 확인**함. 동적 클래스
> (`sticker-anim-${x}`, `tier-${key}`, `wc-team-${team}`, `avatar-${side}` 등)는 제외했다 — 살아 있다.

### B1. 죽은 CSS ~1,350줄 · W:유지보수 E:M
| 파일 | 죽은 줄 | 대표 |
|---|---|---|
| `components/poster/public-poster.css` | ~645 | `.memo-line-*`/`.memo-edit-*`(1991-2137), `.text-panel`/`.text-*-group`(3805-3869), `.heart-button`(1158), `.view-switch`(1126), `.month-controls`(1255), `.event-toggle`(2809), `.pi-trend*`/`.pi-dist*`, `.sticker-panel`, `.opacity-control` |
| `components/studio/studio-shell.css` | ~507 | `.campaign*`(6493+), `.teaser-toggle*`(1218-1331), `.memo-line*`(6222-6244), `.tag-add-sub`(5874), `.pill-toggle`(4843), `.developer-warning`(693) |
| `app/globals.css` | ~100 | `.memo-editor`(994-1007), `.private-layer-block/-controls/-status`(913-937), `.role-route-list`(791-808), `.app-shell`, `.fade-up` |
| `app/home.css` | **53 (파일 통째)** | `.home-grid`/`.home-panel`/`.home-actions` — 이 파일의 base 클래스 3개가 전부 죽음. `app/layout.tsx:16`에서 아직 전역 import 중 → **파일 + import 줄 삭제** |
| `components/studio/insights-charts.css` | ~39 | `.insight-list`(772-790), `.insights-toolbar`(901), `.insight-roletags`(684 **및** 1025 — 중복 정의, 둘 다 죽음) |
| `components/seasonal/worldcup-ball-goal.css` | ~15 | `.wc-keeper-left/right`(438/441 — 실제로는 `classList`로 `catch/def-red/def-blue/ingoal`만 붙음), `.wc-tg-short`(1493 **및** 1554 중복) |

빈 블록 2개: `studio-shell.css:863-865`, `:4144-4146` — `@media (min-width: 641px) { }` 알맹이 없음.

**주의**: 지우기 전 `npm run build` + 공개 포스터/편집실 실물 스크린샷 대조(표면 지오메트리 ADR-0004).
CSS 삭제가 표면 안 레이아웃을 건드리면 스티커가 밀린다.

### B2. 호출자 0인 export 14개 (~280줄) · W:유지보수 E:S
`updateTagsAction`(`tag-actions.ts:321`), `updateTagAction`(`:34`), `getSpanRun`(`month.ts:463` —
쓰이는 건 `getSpanRunRange`), `moveEventAction`(`event-actions.ts:80`),
`getRepresentativeTagColors`(`month.ts:673`), `unlinkEventAction`(`link-actions.ts:73`),
`clearUnlockSessionsAction`(`private-layer/actions.ts:16`), `areAdjacentEvents`(`month.ts:162`),
`getCampaignsForDate`(`:663`), `formatKstTime`(`:699`), `getMonthLabel`(`:104`),
`tagsForRole`(`tags/taxonomy.ts:34`), `timedSync`(`perf/perf.ts:36`), `hapticWarn`(A2에서 되살림).
- `updateTagAction`/`updateTagsAction`은 `docs/tags/tag-tier-plan.md`·`tag-tier-report.md` 산문에만
  등장 → **문서가 코드보다 낡음**. 지울 때 문서도 같이.
- 이들은 서버 액션이다. 지우기 전 "정말 UI가 없는가"만 한 번 더 확인.

### B3. 코드가 안 쓰는 DB 객체 7개 — **삭제 금지, 기록만** · W:소 E:S
`visit_log`(0023), `presence_ping`(0024), `presence_hourly`·`presence_peak`(0024/0026),
`presence_active_days`(0025), `owner_sessions` 뷰(0027), `add_calendar_heart` RPC(0011).
전부 `visit_session`(0033+)으로 대체됐고 코드 참조 0건(주석 1줄 제외). 관리자 접속 세션도 이제
RPC가 아니라 TS에서 계산한다(`lib/insights/actions.ts:502` `ownerSessionsFrom`).
**그러나 과거 데이터가 들어 있다.** DROP은 파괴적(`docs/agent/domain-rules/DESTRUCTIVE_DATA.md`).
→ 이번 정리에선 **마이그레이션 파일 주석**으로 "superseded by 0033"만 남기고 테이블은 둔다.

### B4. 축구 RL 기반(~1,250줄)은 죽은 게 아니라 **테스트에서만 도달** · W:정보 E:0
`lib/football/rl/*`, `rules/*`, `core/actions.ts` 등은 앱에서 안 부르고 `tests/unit/football/`만 부른다.
의도된 기반(`docs/sim/worldcup-rl-foundation-report.ko.md`, 68테스트) — **삭제 후보 아님**. 오해 방지용 기록.

---

## C. 서버 · 성능

### C1. `getEventsForDate`가 O(N²·log N)이고 렌더마다 42번 돈다 · W:상 E:M ⚠ 최우선
`lib/calendar/month.ts:126-137`:
```js
const connected = (e) => ... || events.some((o) => o.linkNext === e.id) ? 1 : 0;  // ← O(N) 스캔
return events.filter(...).sort((a, b) => connected(b) - connected(a) || ...);     // ← 비교자 안에서 호출
```
`events.some()`이 **정렬 비교자 안**에 있다. 호출부는 전부 렌더 경로:
`public-poster.tsx:2636`(칸마다 = 42회, memo 없음), `:846`(또 42회), `studio-shell.tsx:4886`, `:1274`.
게다가 `liveEvents`(`public-poster.tsx:832`)는 **이번 달이 아니라 전체 공개 일정**이다(C4 참조).
N=500이면 렌더 1회에 ≈9천만 연산 — 하트 토글·호버·리사이즈·1초 타이머마다 이 값을 낸다.
→ 비교자 밖에서 `linkNext` Set 한 번 만들고 `connected` 랭크를 이벤트별로 선계산(슈워츠 변환),
그 다음 `Map<isoDate, T[]>`를 `liveEvents` 바뀔 때 한 번만. **동작 변화 없는 순수 알고리즘 수정.**

### C2. 미들웨어가 25초 하트비트마다 `auth.getUser()`를 부른다 · W:상 E:S
`middleware.ts:36`에서 무조건 `await supabase.auth.getUser()`, matcher(`:41-43`)는 **`/api/*` 전부** 포함.
그런데 25초마다 도는 클라가 둘: `use-soop-live.ts:15`(`/api/soop-live`), `presence-beacon.tsx:16`(`/api/presence`).
둘 다 actor를 안 읽는다. 동접 200명이면 초당 ~16건이 쓸데없이 GoTrue를 왕복한다.
→ matcher에서 `/api/soop-live`·`/api/presence`·`/api/public` 제외. 미들웨어는 **탐색 가능한 페이지**의
쿠키 갱신만 하면 된다.

### C3. 인사이트 열 때마다 `visit_session` **전체 이력**을 긁는다 · W:상 E:M
`lib/insights/actions.ts:1336-1343`, `1539-1546`: `select("account_hash").lt("day", monthStart)` —
하한이 없다. 1000행씩 페이지네이션(`fetchAllRows`)이라 월 3,500행 × 1년이면 **~42회 순차 왕복**으로
42k행을 받아 Set 하나 만든다. 무한 성장.
→ `SELECT DISTINCT account_hash FROM visit_session WHERE day < $1` RPC 하나로. (왕복 1회)
곁들여: `fetchAllRows`(`:393-403`)는 `day`로 거르고 `id`로 정렬하는데 복합 인덱스가 없다
(`visit_session_day_idx(day)`와 PK가 따로, `0033_visit_session.sql:21`) → `(day, id)` 인덱스면 keyset이 인덱스 순.

### C4. 축구 sim **6,461줄**이 시청자 첫 로드 번들에 정적으로 들어간다 · W:상 E:S
`public-poster.tsx:47-48`이 `WorldCupBallGoal`/`WorldCupStudioBall`을 **정적** import.
바로 아래 3줄(`:52-61`, `:124`)은 전부 `dynamic()`인데 이것만 예외. 실제 렌더는 월드컵 달 뿐(`:3441`).
`/`의 First Load JS 177 kB 중 공유분 103 kB을 빼면 라우트 몫 ~74 kB — 이 sim이 큰 지분.
→ 옆 패턴 그대로 `dynamic(() => import(...).then(m => m.WorldCupBallGoal), { ssr: false })`.
`studio-shell.tsx:79`도 동일.

### C5. perf 계측이 **페이지 뷰마다 DB에 쓴다** · W:중 E:S
`lib/perf/record.ts:6-19` — `timed()`/`ServerTiming.measure()`가 부를 때마다 `after()`에서
admin 클라이언트를 새로 만들어 `perf_samples`에 insert. `app/page.tsx`만 해도 익명 로드 1회당 2 insert.
응답 지연은 없지만(`after`) 무제한 쓰기 증폭 + 서버리스 인스턴스 유지.
→ 1/N 샘플링(예: 5%) 또는 요청당 1행 배치.

### C6. `emailFor`가 GoTrue에 N+1 · W:중 E:M
`lib/insights/actions.ts:729-741`, `1633-1644` — `auth.admin.getUserById(id)`를 **사람 수만큼**.
`:1655-1659`는 심지어 `for` + `await` **직렬**. → `listUsers()` 1회 또는 `.in("id", ids)` 1회.

### C7. 독립인데 줄 세운 await들 · W:중 E:S
- `insights/actions.ts:1317` → `:1336` → `:1361` 세 쿼리 독립 → `Promise.all` (RTT 3→1).
- `:1292`의 `.select("id").limit(1)`은 순수 준비확인 → 본 쿼리 에러 처리로 흡수(왕복 1회 제거).
- `app/page.tsx:15-19`: 익명 분기에선 schedule이 actor와 무관 → `Promise.all([actor, getPublicSchedule("vic")])`로 TTFB 단축.
- `:591`, `:972`, `:1817`: `loadTagCategoryMap`이 위 `Promise.all` **뒤**에 홀로 await — `calendarId`만 필요하니 그 배치 안으로.

### C8. 공개 로더가 월 범위 없이 전부 가져온다 — 1000행 절단 위험 · W:중 E:M
`lib/schedules/public-loader.ts:187-196`(events), `:205-211`(stickers): 날짜 바운드도 `.limit()`도 없고
`fetchAllRows`도 아닌 raw `.select()`. 저장소가 이미 데인 적 있는 함정(`PROJECT_MAP.md:38`).
스티커가 더 위험 — `calendar_id`+`is_visible`만 걸어 **모든 달의 모든 스티커**를 받는데,
인덱스는 `(calendar_id, year, month, z_index)`(`0021:33-35`)라 접두사만 쓴다. 꾸미기는 달마다 무한 증가.
→ 이 배열들이 클라 월 이동을 지탱하므로 하드 스코프는 동작 변경. 안전한 첫 걸음: **±13개월 롤링 윈도**
(포스터가 실제로 갈 수 있는 범위) — 인덱스도 완전히 쓰게 된다. C1의 N도 같이 줄어든다.

### C9. ResizeObserver가 스로틀 없이 4,400줄 트리를 리렌더 · W:중 E:S
`public-poster.tsx:1220-1234` — 콜백마다 layout 읽고 state 2개 set. 리사이즈 드래그 중 매 프레임
포스터 전체 리렌더 + C1의 O(N²)를 매번 지불. (정리는 정상, 누수 없음.)
→ `requestAnimationFrame` + pending 플래그, 값이 그대로면 early return.

### C10. `createSupabaseAdminClient()`가 호출마다 새 클라이언트 · W:소 E:S
`lib/auth/admin.ts:4-18` — 메모이제이션 없음. service-role 키 + `persistSession:false` + 쿠키 무관 =
요청 스코프가 아니다 → 모듈 싱글턴으로 승격 가능. (반대로 `createSupabaseServerClient`는
`cookies()`를 닫아 잡으므로 **요청마다가 맞다** — 건드리지 말 것.)

### C11. 공개 API 캐시 헤더 · W:소 E:S
- `app/api/public/[calendarSlug]/broadcast/route.ts:28` — `Cache-Control` 없음. 밑단 로더는 이미
  `unstable_cache` 300초(`public-loader.ts:627`,`662`)라 데이터는 공유되는데, 시트를 여는 시청자마다
  람다를 왕복한다. `s-maxage=300`이면 CDN에서 합쳐진다. (`/api/soop-live:26`은 이미 제대로 함.)
- ~~`/api/public/.../events` 삭제~~ — **오진 정정**: 앱 내부 소비자는 없지만 이건 **공개 API 계약**이다.
  `tests/e2e/public-api.spec.ts:4`, `docs/deployment.md:168`(보안 체크리스트), `README.md:17`이 물고 있다.
  삭제 금지. 다만 `loadMyHeartIds`(`public-loader.ts:271-281`)가 쿠키 바인딩이라 엣지 캐시는 불가 — 현행 유지.

---

## D. 시청자 몰입 · 손맛

### D1. 모바일·태블릿에서 '이 달 기록'을 **아예 못 연다** (ISSUE-002) · W:상 E:S
`public-poster.tsx:3548-3558`의 `.insights-open`이 `.public-calendar-header` 안에 있는데,
그 헤더가 `{showAgenda ? null : (…)}`(`:3506`)로 꺼진다. `showAgenda`는 `POSTER_AGENDA_QUERY`
(`lib/ui/breakpoints.ts:48`, **≤1040px**) → 폰·태블릿 전부 진입점 없음. (2026-07-17 Playwright 실측:
모바일에서 `.insights-open` 개수 **0**.) 기능은 이미 만들어져 검증까지 끝났는데 **다수 플랫폼에서 도달 불가**.
→ 새 크롬 없이: 모바일 범례 레일에 **같은 버튼**을 렌더(`:3026` `previewNav` 옆). 그 자리 주석이
이미 "엄지 닿는 아래쪽이라 누르기 쉽다"며 인사이트 버튼을 언급한다.

### D2. 인사이트 시트: 로딩 자리표시가 실제 콘텐츠 자리에 없다 · W:중 E:S
`public-insights.tsx:329-338` — 로딩 중엔 한 줄짜리 `<p className="pi-empty">`(≈20px), 로드되면
`BroadcastHours`(6개월 막대+일별 막대+요약, 수백 px). 도착 순간 아래 3개 카드가 **와르르 밀린다**.
CLAUDE.md가 콕 집은 케이스("스켈레톤은 실제 콘텐츠가 착지할 자리에").
→ `.pi-card.pi-broadcast`에 로드 후 높이만큼 `min-height`. 그것만으로 점프 제거.

### D3. 방송 기록 fetch 실패가 '0일 방송'으로 둔갑 · W:중 E:S
`public-insights.tsx:94` `.catch(() => {})` → `broadcast=[]` → 시트가 당당하게 "0일"과 빈 차트를 보여준다.
**네트워크 실패와 방송 없는 달이 구별 불가.** → `failed` 상태 + 이미 있는 `.pi-empty`로
"방송 기록을 못 불러왔어요 · 다시 시도".

### D4. 필터 누르면 달력이 **뚝** 끊긴다 (트랜지션 누락) · W:중 E:S
`public-poster.css:2708-2710`의 `.public-event`는 `transform`·`box-shadow`만 트랜지션.
정작 `.dimmed`(`:1713-1716`)가 바꾸는 건 `opacity`(1→0.28)·`filter`(grayscale) — **둘 다 목록에 없다**.
칩 → 흐려짐은 웹에서 "시스템이 내 말을 들었다"를 보여주는 최고의 순간인데 하드컷이다.
→ 트랜지션 목록에 `opacity`·`filter` 추가(둘 다 GPU 친화). `html[data-reduce-motion]` 블록도 같이.

### D5. 하트 탭 타깃이 18×18px · W:중 E:S
`public-poster.css:1914-1917`. 모바일 아젠다(`tsx:3197`)·웹 칸(`:2838`)의 **주 상호작용**인데 44px 기준 미달.
→ `.event-heart::after { content:""; position:absolute; inset:-13px; }` — 버튼이 이미
`.public-event{position:relative}`(`css:2699`) 안. **의사요소라 레이아웃 0 변화** → ADR-0004 표면
지오메트리 그대로(= 스티커 안 밀림). 이게 이 방식을 택하는 이유.

### D6. 모바일 필터 칩이 정적 + 27px · W:중 E:M(작음)
`public-poster.css:106-133` `.agenda-legend-tag` — `transition` 없음, `:active` 없음. 형제들은 전부
있다(`.mb-step:active` `:418`, `.mb-act:active` `:462`, `.agenda-gap:active` `:556`). "정적 = 회귀"가 규칙.
높이도 ~27px(44px 미달).
→ 트랜지션 + `:active { transform: scale(0.94) }`, 타깃은 `::after { inset:-8px }` 패드(레일이 92px
높이 제약이라 padding으로 키우는 것보다 안전).

### D7. `.legend-clear` / `.agenda-legend-clear` 정적 · W:소 E:S
`css:1696-1707`, `:180-190` — 트랜지션·`:active` 없음. `.legend-clear`는 이미 자리 예약이라는
정교한 HCI 처리(`tsx:4331-4334`)를 받았는데 **누름 감촉만 빠졌다**.

### D8. `.pi-close`는 조용하고 백드롭은 톡 · W:소 E:S
`public-insights.tsx:285` 맨손, `:272-277` 백드롭은 `hapticTick()`. 조준해서 X를 누른 쪽이 더 죽어 있다.

### D9. `clearFilters`에 촉감 없음 · W:소 E:S
`public-poster.tsx:1500-1503`. 바로 위 `toggleTagFilter`(`:1495`)는 톡. 필터 전부를 지우는
'확정' 성격 동작. → **함수가 아니라 두 버튼 핸들러**에 넣기(`jumpToday`가 `clearFilters`를 부르며
이미 톡을 울려 이중이 된다).

### D10. `.mb-step` 48px vs `.mb-act` 40px — 같은 레일, 들쭉날쭉 · W:소 E:S
`css:406-410` vs `:452`. "형제 높이 불일치 = 결함"이고 40px는 44px 미달. → `.mb-act { min-height: 44px }`.

### D11. 인사이트 시트에 모바일 재단이 **전혀** 없다 · W:중 E:M
`.pi-*`를 건드리는 미디어쿼리는 `css:4949-4955`의 `min-width:641px`(글자 2개 키움)뿐 — **≤640px 블록 0개**.
결과: 백드롭이 `align-items:center`(`:4666-4681`)라 폰에서 바텀시트가 아니라 **가운데 뜬 카드**
(CLAUDE.md 모바일 규칙이 "bottom-sheets"를 명시, 편집실엔 이미 `m-sheet-up` 어휘가 있다).
X 버튼은 엄지에서 가장 먼 우상단. `.pi-stats`(`:4772`)는 어느 폭에서나 `repeat(3,1fr)`인데 통계는 5개
(`tsx:294-315`) → 3+2 고아 행.
→ `@media (max-width: 640px)` 한 블록: 백드롭 `align-items:flex-end; padding:0`, 시트 `width:100%;
max-height:88vh;` 위쪽만 라운드, `.pi-stats { repeat(2,1fr) }`, 등장은 아래에서 올라오게.
**D1 먼저** — 지금은 모바일에서 열 수조차 없다.

### D12. 시트에 등장은 있고 퇴장이 없다 · W:소 E:M
`css:4689-4707` — `.pi-sheet`는 `pi-rise`, 백드롭은 `pi-fade`. 닫기는 `setInsightsOpen(false)`
(`tsx:3291`)로 **즉시 언마운트**. 우아하게 올라온 시트가 프로세스 죽듯 사라지면 관리자 패널 느낌.
→ `closing` 상태 + `pi-sink`(`--ease-exit` 토큰 이미 있음) + `animationend`에 `onClose`.
`html[data-reduce-motion]` 블록(`css:4709-4712`)에 반드시 합류.

### D13. `jumpToday`가 360ms 하드코딩 타이머로 월 슬라이드를 쫓는다 · W:소 E:M
`public-poster.tsx:2596-2597` — React 커밋 + 슬라이드 종료 시점을 **숫자로 추측**한다. 슬라이드는
토큰 기반이라 나중에 값을 바꾸면 조용히 어긋난다. 동작 줄이기가 켜지면 슬라이드가 없는데도 360ms를 기다린다.
→ `[view.year, view.month]` 이펙트 + pending ref, 또는 `.agenda-flow`의 `animationend`.
최소한 `reduceMotionEnabled()`(이미 `:1364`에서 씀)일 때 0으로.

---

## E. 편집실 UX

### E1. 드래그 이동에 undo가 없다 (생성·삭제·붙여넣기는 있는데) · W:상 E:M
`studio-shell.tsx:188-190` — `UndoAction`이 `recreate | remove` 뿐. push 지점 3곳(`:2985` 삭제,
`:3070` 생성, `:3351` 붙여넣기)이 딱 그것만 덮는다. 그런데 `enqueueMovePersist`(`:2454`)/
`runMovePersist`(`:2471`)는 일정의 **날짜를 바꾸는데** 히스토리를 안 남긴다.
잘못 떨어뜨리면 방송이 조용히 옮겨가고, Ctrl+Z는 **엉뚱하게 그 전 작업**을 되돌린다 —
삭제 토스트(`:1972`)가 "Ctrl+Z로 되돌리기"라고 학습시켜 놨기에 더 나쁘다. undo 구멍 중 가장 치명적.
→ `{ type:"move"; id; fromDate; orderedIds }` 추가, 낙관적 적용 전에 push, `:3173-3197` 스위치에서 역이동.

---

## 이미 잘 돼 있어서 **건드리면 안 되는** 것 (감사에서 확인)

- **공개 포스터 캐시**: `unstable_cache` 300초 + 태그 무효화(`public-loader.ts:128`, `:265`), 쓰기 27곳 전부
  `revalidatePublicSchedule()` 호출. 매 요청 캐시 파괴 없음.
- 공개 쿼리 8개 병렬(`public-loader.ts:170-227`), 스튜디오 로더도 4개 배치(`studio-loader.ts:68-77`).
- `resolveCurrentActor`/`getCurrentSupabaseUser`는 `cache()` 래핑 — 렌더 내 중복 getUser 없음.
  익명 경로는 권한을 안 부른다(`app/page.tsx:32` 단락, `loadMyHeartIds`는 익명이면 쿼리 0).
- `html2canvas` 이중 지연(`public-poster.tsx:124` + `poster-export-actions.tsx:59`).
- **쓰기 경로**: `/api/studio-write`·`/api/sticker-write`는 얇은 디스패처. 스티커는 낙관적이라 태그 무효화만
  쓰는 것도 의도적(`sticker-actions.ts:161-163`).
- `beforeunload`는 **살아있는 op 수**로 판정(타이머 아님) — `studio-shell.tsx:686-695`, `public-poster.tsx:777-787`.
- 이동 저장은 직렬 체인 + temp-id 해소(`studio-shell.tsx:2462-2468`), 하트도 일정별 직렬 + seq 가드(`:1421-1452`).
- `decorate-palette.tsx:255`의 `disabled={pending}`은 **오탐** — 에셋별(`pendingAssetIds.has(id)`)로 이미 좁다.
- 편집실 햅틱 커버리지(~25곳)와 2단계 컨벤션은 잘 지켜짐. `renderReadonlyDetail`(`:2639`)은
  "비활성 오너 컨트롤 대신 역할별 화면"의 교과서 사례.
- 타이머/리스너 누수 없음. 1Hz `setInterval`(`public-poster.tsx:330`)은 `TeaserCountdown` 잎에만 스코프.
- npm 의존성 21개 전부 실사용(`html2canvas`·`pg`·`zod` 포함) — 뺄 것 없음.
- TODO/FIXME·주석 처리된 코드 **0건**.

---

## 권장 순서

| 배치 | 내용 | 왜 이 순서 |
|---|---|---|
| **1** | A1·A2·A8·A9·D8·D9 (햅틱/피드백 컨벤션 닫기) | 전부 S, 핸들러 6개, 새 UI 0 — 체감 즉시 |
| **2** | A3·A4·A5 (브로드 게이팅 + 낙관 상태 가드) | CLAUDE.md가 결함이라 명시. 전부 S, 위험 낮음 |
| **3** | C2·C4 (미들웨어 matcher · sim 지연로드) | S인데 서버 부하·번들에서 가장 큰 이득 |
| **4** | C1 (+C9) | 최대 성능 이득이지만 M — 렌더 경로라 회귀 검토 필요 |
| **5** | D4·D5·D7·D10·D6 (CSS 손맛·탭 타깃) | CSS만. **단, 표면 안 변경이면 지오메트리 실측 필수** |
| **6** | D1 → D11 (모바일 도달 → 모바일 재단) | 열 수 있게 먼저, 그 다음 다듬기 |
| **7** | D2·D3 (레이아웃 점프·정직한 실패) | |
| **8** | A6·A7·E1 (Esc·단축키 안내·이동 undo) | E1은 M |
| **9** | C3·C5·C6·C7·C11 (서버 왕복 정리) | 사용자 체감보다 비용/확장성 |
| **10** | B1·B2·B3 (죽은 코드) | 마지막 — 위 작업들이 끝나야 "지금 죽음"이 확정 |
| **보류** | C8 (±13개월 윈도) | 동작 변경 소지 → 별도 판단 |

## 검증 규칙 (모든 배치 공통)

```bash
npm run typecheck && npm run lint && npm run build && npm run test
```
- 표면 안(`[data-export-surface]`)을 건드렸으면 **꾸미기 == 시청자 == PNG 지오메트리** 실측
  (2026-07-17에 쓴 방식: 임시 라우트로 `PublicPoster(decorate)` 띄워 `/`와 Playwright 대조 → 라우트 삭제).
- 편집실은 로그인이 필요해 로컬 실물 확인이 막혀 있다(ISSUE-001) → 사용자 확인 요청 또는 임시 라우트.
- 공개 경계: 공개 응답에 비공개 필드 0건(`tests/e2e/public-api.spec.ts`).
