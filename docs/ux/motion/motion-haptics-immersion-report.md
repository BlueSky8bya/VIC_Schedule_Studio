# 모션·햅틱·몰입 강화 제안 보고서 (Motion / Haptics / Immersion)

> 작성일: 2026-05-29 · 대상: VIC Schedule Studio
> 목적: CLAUDE.md의 제품 목적성("immersion")과 사용자 철학에 근거해, 추가/개선하면
> 좋은 **모션·햅틱·인터랙션** 기능을 **웹 전용 / 모바일 전용 / 웹·모바일 공통**으로
> 나눠 제안하고, 각 항목마다 CLAUDE.md 하니스(Planner→Builder→Evaluator)에 맞춘
> **구현안**과 **회귀·디자인 통일성 점검표**를 함께 둔다.
>
> 이 문서는 N차 보고서다: ① 코드베이스 4축 정밀 매핑 → ② 1차 초안 → ③ 내 철학·목적성
> 대비 자기검토 → ④ 의심 구간(웹 햅틱 실제 지원, 터치 드래그 한계, View Transitions
> 성숙도) 재서칭 → ⑤ 최종 정리. 끝의 "§8 자기검토 로그"에 의심·반박·근거를 남겼다.

---

## §0. 30초 요약 (TL;DR)

- **지금 모션 자산은 이미 훌륭하다.** 외부 애니메이션 라이브러리 없이 순수 CSS keyframe
  50여 개 + 포인터 이벤트 드래그(진자 물리) + `prefers-reduced-motion` **전면 대응**까지
  되어 있다. 새 기능은 **새 라이브러리 없이** 기존 토큰(`--ease`, `--dur-1/2/3`)과
  키프레임(`pill-settle`, `pill-poof`, `cell-select-pop`, `drop-line-pulse`,
  `lock-pop` 등)을 **재사용**하는 방향이 맞다.
- **햅틱(진동)은 지금 0% 활용.** 다만 플랫폼 현실이 까다롭다(아래 §1). 결론부터:
  **Android = `navigator.vibrate` 프로그래밍 진동 가능**, **iOS = 프로그래밍 진동 영구
  불가**(단 *사용자가 직접 누르는 진짜 `<input type="checkbox" switch>`*만 Taptic 발생).
  → "진동은 Android 점진적 향상 + iOS는 스위치형 컨트롤에서만"으로 설계하고, **항상
  사용자 설정 + 기능감지 뒤**에 둔다.
- **모바일 일정 이동(드래그)은 현재 없다**(웹 전용). 추가는 가치 크지만 **가장 위험**한
  작업이다(터치-스크롤 충돌, iOS 롱프레스 간섭). 단계적으로(같은 날 재정렬 → 인접일
  이동) 가고, **반드시 기존 직렬화 큐(`enqueueMovePersist`)를 그대로 태운다**(CLAUDE.md
  불변식: 낙관적 쓰기는 경쟁이 아니라 큐).
- **모바일 생성/삭제 애니메이션은 현재 전무**하다(웹은 settle/poof 있음). 패리티 맞추는 건
  저위험·고효용 → 우선 착수 권장.
- 권장 순서: **Phase 0 햅틱 기반공사 → Phase 1 저위험 몰입(탭 손맛·모바일 생성/삭제·드롭
  안착·하트/잠금 햅틱) → Phase 2 연결/끊김 시seam·FLIP 재정렬·스와이프 햅틱 → Phase 3
  모바일 드래그 이동(고위험) → 탐색 View Transitions 라우팅**.

---

## §1. 플랫폼 현실 (모든 제안의 전제 — 먼저 읽을 것)

새 기능을 "구현했다가 또 문제 생기는" 일을 막기 위해, 가장 함정이 많은 3개 영역의 2026년
현재 사실관계를 먼저 못 박는다.

### 1.1 햅틱(진동) — 가장 오해가 많은 부분

| 플랫폼 | `navigator.vibrate()` | 비고 |
|---|---|---|
| **Chrome/Edge/삼성 인터넷 (Android)** | ✅ 동작 | **sticky user activation 필요**(사용자 탭 등 상호작용 이후에만). 무음/방해금지 모드면 무시될 수 있음 |
| **iOS Safari (모든 버전)** | ❌ 미구현(영구) | WebKit이 사양에 공식 반대. iPhone/iPad 전부 no-op |
| **Firefox 129+** | ❌ 제거됨 | 데스크톱은 원래 no-op, Android는 버그로 제거 |
| **데스크톱 일반** | 호출은 `true` 반환해도 하드웨어 없으면 무진동 | — |

- **호출 규약**: `navigator.vibrate(ms)` 또는 `vibrate([진동,멈춤,진동,…])`. **예외를 던지지
  않는다.** 미지원이면 그냥 효과 없음. 안전 감지: `if ('vibrate' in navigator)`.
- **iOS 우회(중요·시한부였음)**: `<input type="checkbox" switch>`(Safari 17.4+)는
  사용자가 토글하면 Taptic을 울린다. 한때 `label.click()`로 **프로그래밍 트리거**가
  가능했으나 **Apple이 iOS 26.5에서 패치**해 막았다(오늘 2026-05-29 기준 최신 iOS에서
  프로그래밍 햅틱 불가). **단, 사용자가 직접 스위치를 누르면 여전히 햅틱이 난다.**
  → 우리에게 주는 함의: iOS에서 "버튼을 코드로 눌러 진동" 같은 건 포기. 대신 **하트·비공개
  토글 같은 컨트롤을 *진짜 스위치 인풋*으로 만들면 iOS 사용자도 손끝 진동을 느낀다.** 이게
  iOS에서 합법적으로 햅틱을 얻는 유일한 길이다.
- **설계 원칙**: 진동은 (1) `'vibrate' in navigator` 기능감지, (2) 사용자 **진동 on/off
  설정**(기본값은 켜되 iOS는 어차피 no-op), (3) 과하지 않은 짧은 패턴(틱 10–15ms), 세
  조건을 모두 통과한 **점진적 향상**으로만. 절대 핵심 동작의 전제 조건으로 삼지 않는다.

### 1.2 모바일 터치 드래그 — `touch-action`의 구조적 한계

- 드래그 대상엔 `touch-action`을 **CSS로 미리** 지정해야 한다. **포인터다운 이후엔 바꿀 수
  없다**(w3c pointerevents #178). 그래서 "평소엔 세로 스크롤 허용 + 길게 누르면 드래그"
  UX는 포인터 이벤트만으론 깔끔히 안 된다.
- 현실적 패턴: 어젠다는 `touch-action: pan-y`(현재 `.agenda`에 이미 적용, studio-shell.css
  `.agenda` 부근) 유지하고, **롱프레스(~250ms) 타이머로 "드래그 무장" 상태**가 되면 그때부터
  **Touch Events의 `touchmove`에서 `preventDefault()`** 로 스크롤을 막고 직접 위치를
  옮긴다. `setPointerCapture(pointerId)`로 제스처 유실 방지.
- **iOS 롱프레스 간섭**: 길게 누르면 iOS가 텍스트 선택/콜아웃/확대 + 자체 햅틱을 띄운다.
  `-webkit-user-select:none; -webkit-touch-callout:none` + `contextmenu`
  `preventDefault`로 억제하되 **iOS에선 완벽하지 않다**(실제 기기 테스트 필수).
- **이미 검증된 자산 재사용**: 웹 드래그의 드롭 판정(`document.elementFromPoint` →
  `data-isodate`/`data-eventid`)과 **직렬화 큐**(`enqueueMovePersist`/`runMovePersist`,
  prop 동기화 가드 `pendingPersistRef`, `beforeunload` 경고)는 모바일에서도 **그대로
  태운다**. 새 저장 경로를 만들지 말 것.

### 1.3 View Transitions API — 성숙했지만 큰 변경

- **Same-document(SPA) 트랜지션은 2025-10 Baseline**(Chrome/Edge 111+, FF 133+,
  Safari 18+). 리스트 재정렬·연결/끊김에 이상적이고 `view-transition-name: match-element`
  자동 네이밍까지 생겼다.
- 그러나 현재 월 전환은 **key 리마운트 + CSS 슬라이드**로 이미 구현돼 있어, 섣불리 갈아끼우면
  회귀 위험이 크다. → **신규 시각효과(연결/끊김, 재정렬)는 우선 FLIP/CSS로 외과적으로**
  하고, View Transitions는 **라우트 전환(studio↔decorate↔viewer)** 탐색 과제로만 둔다.

---

## §2. 현재 보유 모션 자산 (재사용 카탈로그)

새 모션은 아래를 **재사용**해 디자인 통일성을 지킨다(임의 일회성 스타일 = 결함).

- **모션 토큰** — `app/globals.css:75-78`
  `--ease: cubic-bezier(0.22,0.61,0.36,1)`, `--dur-1:120ms`, `--dur-2:180ms`, `--dur-3:240ms`
- **저장 안착** — `pill-settle`(0.8→1.06→0.97→1) + `pill-settle-ring`(금빛 링),
  `studio-shell.css:2472-2481`, 트리거 `.just-saved`(studio-shell.tsx `markJustSaved`)
- **삭제 뿅** — `pill-poof`(축소+회전+페이드), `studio-shell.css:2483-2492`, `.deleting`
- **드롭 라인 맥동** — `drop-line-pulse`, `studio-shell.css:2542-2550`
- **셀 선택 팝** — `cell-select-pop`, `studio-shell.css:2353-2364`
- **잠금 팝/배너 드롭** — `lock-pop`(418-423), `private-banner-in`(404-417)
- **하트 부유** — `heart-rise`(public-poster.css:685-697 / 1418-1431), 인기도
  `pop-warm/hot/blaze/top`(1629-1657)
- **월 슬라이드** — `studio-grid-next/prev`, `agendaInNext/Prev`, 모바일 `.agenda-flow[data-enter]`
- **모바일 시트 업** — `m-sheet-up`(studio-shell.css:4581 부근)
- **reduced-motion** — 전역 와일드카드 무력화(`app/globals.css:206-214`) + 기능별 블록 +
  JS `prefersReducedMotion()`(studio-shell.tsx:1549-1550). **신규 모션은 반드시 여기에 합류**.
- 외부 모션 라이브러리 **없음**(framer-motion/gsap 미사용) — 유지 권장.

---

## §3. 웹 전용 제안 (Web-only)

### A1. 일정 카드 "연결/끊김" seam 애니메이션 ⭐(사용자 요청)
- **무엇**: 두 일정의 맞닿는 엣지가 같아져 **연결**되거나(태그 변경·`linkNext` 지정·드래그로
  인접) 달라져 **끊길** 때, 그 *이음새(seam)* 에 짧은 연출을 준다. 연결 시 두 pill이 살짝
  맞물리며(미세 scale) 이음새를 따라 빛이 한 번 흐른다(드롭라인 스타일 재사용). 끊길 때는
  둥근 모서리가 톡 되살아나며 살짝 바깥으로 튕긴다("tear").
- **왜(몰입)**: "왜 갑자기 붙었지/떨어졌지?"의 인지 부하를 없애고, 일정 편집을 *살아있는*
  경험으로. CLAUDE.md "playful motion" + "preserve position across state changes".
- **Planner**: 라우트/컴포넌트 = `components/studio/studio-shell.tsx` 렌더 루프(2945–3072) +
  `lib/calendar/month.ts:getEventSpan`(479–519)의 `roundLeft/roundRight` 산출.
  역할/권한 영향 = 없음(시각만). 공개/비공개 경계 = 없음. KST = 무관.
- **Builder**:
  1. 이벤트별 직전 렌더의 `{roundLeft,roundRight}`를 `useRef<Map<id,…>>`에 저장.
  2. 렌더에서 값이 바뀐 pill에 `.seam-joining` 또는 `.seam-breaking`을 ~240ms 부여(타이머로
     자동 제거). **border-radius는 합성(compositor) 친화적이지 않으니** 모서리 변경은 즉시
     적용하고, *연출은 오버레이 의사요소(`::after`) opacity/transform*로만(60fps 유지).
  3. 새 키프레임 `seam-heal`(이음새 빛 스윕, `drop-line-pulse` 톤)·`seam-tear`(짧은
     ±2px 튕김) 추가. 토큰 `--ease`/`--dur-3` 사용.
  4. `prefers-reduced-motion`: 두 클래스 모두 `animation:none`.
- **Evaluator/회귀**: 멀티데이 체인·paint group·"셀당 대표색 2개" 렌더 불변 확인. 드래그
  고스트와 동시 발생 안 함(드래그 중엔 seam 연출 억제). 좌우 패딩 대칭 유지.
- **효용/위험/공수**: 효용 高 · 위험 中 · 공수 中.

### A2. FLIP 재정렬·이동 활주 애니메이션
- **무엇**: 현재 web 재정렬/이동은 `sortOrder` 갱신 시 **즉시 점프**(드래그 고스트만 움직이고
  형제 카드는 순간이동). FLIP으로 형제 카드들이 새 자리로 *미끄러져* 가게 한다.
- **왜**: HCI "위치 보존" — 눈이 튀지 않게. 드래그 후 결과가 자연스럽게 안착.
- **Planner**: 컴포넌트 = studio-shell 렌더 루프. 권한/경계/KST 무관(순수 시각).
- **Builder**: `useRef`로 직전 bounding rect 캐시 → `useLayoutEffect`에서 First/Last 비교,
  Inverse `transform: translate()` 적용 후 다음 프레임에 제거(Play). **`useState` 쓰지 말
  것**(불필요 리렌더). transform/opacity만(합성 전용). reduced-motion이면 FLIP 스킵.
  드래그 중인 pill(`.dragging-src`)과 `.just-saved` 바운스는 제외해 충돌 방지.
- **Evaluator/회귀**: 낙관적 상태·직렬 큐·prop 동기화 가드(338–347)에 **절대 손대지 않음**(이건
  순수 뷰 레이어). 드래그 드롭 후 settle 애니메이션과 겹치지 않는지 확인.
- **효용/위험/공수**: 효용 中 · 위험 中 · 공수 中.

### A3. 드롭 "안착" 마무리 (저비용 재사용)
- **무엇**: 드래그한 pill이 착지하면 그 자리에서 `pill-settle`(기존)을 한 번 재생 + 대상 날짜
  셀에 `cell-select-pop`(기존). 거의 배선만으로 손맛↑.
- **Builder**: `dropEventInto`(studio-shell.tsx:1219–1276) 성공 직후 착지 pill에 짧게
  `.just-saved` 토글(이미 있는 메커니즘). reduced-motion 자동 합류(기존 블록).
- **효용/위험/공수**: 효용 中 · 위험 低 · 공수 低. → **빠른 승리**.

### A4. 드래그 가능 pill의 hover "lift" 어포던스
- **무엇**: 마우스 호버 시 draggable pill을 `translateY(-1px)` + 옅은 그림자로 "집을 수 있음"을
  암시(Fitts/어포던스). `@media (hover:hover)`로 터치기기 제외.
- **Builder**: `.studio-event-pill.draggable:hover` 트랜지션(`--dur-1`). reduced-motion 시
  transform 제거(그림자만).
- **효용/위험/공수**: 효용 低~中 · 위험 低 · 공수 低.

---

## §4. 모바일 전용 제안 (Mobile-only) — *모바일은 컴팩트가 생명*

### B1. 모바일 일정 이동(롱프레스 드래그) ⭐(사용자 요청) — **고위험·단계화 필수**
- **무엇**: `.m-event`를 ~250ms 길게 누르면 카드가 "들리고"(scale↑+그림자+햅틱 틱), 어젠다
  안에서 끌어 **같은 날 재정렬 / 다른 날로 이동**. 현재 모바일은 *탭→수정시트*만 가능(이동 없음).
- **왜**: 웹/모바일 기능 패리티 + "role-specific flow"(소유자 편집 경험을 폰에서도). 사용자가
  직접 요청.
- **Planner**:
  - 라우트/컴포넌트 = `studio-shell.tsx` `renderMobile()`(1891–2260), 어젠다 리스트(`.m-event`).
  - 권한 = **owner/developer만**(`canEdit`); 매니저/작업자/뷰어 불가(현행 유지). 서버 권한
    체크(`reorderEventsAction`, event-actions.ts:106 owner/dev) 변경 없음.
  - 공개/비공개 경계 = 영향 없음(이동은 날짜/순서만; 비공개 스코프 그대로).
  - KST = 날짜 delta는 웹과 동일하게 UTC 자정 기준 일수 계산(기존 `dropEventInto` 로직 재사용).
- **Builder(단계화)**:
  - **MVP(B1a) 같은 날 재정렬만**: 어젠다 한 날(day) 안에서 위/아래로. 드롭 메타포 단순(1D
    리스트). 롱프레스 무장 → Touch Events `touchmove` `preventDefault` → `elementFromPoint`로
    같은 day 내 형제 위치 판정 → `dropEventInto`로 `orderedIds` 산출 → **기존
    `enqueueMovePersist` 큐**에 그대로 투입.
  - **B1b 인접/가시일 이동**: 화면에 보이는 다른 `.agenda-day`로 끌면 그 날로 이동(`data-isodate`
    재사용). 드래그 중 어젠다 상/하단 80px 근접 시 **스크롤 컨테이너 오토스크롤**(웹은 window
    기준이므로 모바일은 `.m-scroll-region` 기준으로 적응).
  - 무장 상태 시 `-webkit-user-select:none; -webkit-touch-callout:none` + `contextmenu`
    `preventDefault`로 iOS 콜아웃 억제. `setPointerCapture`.
  - 들기/드롭에 햅틱(C1): 들기=`hapticTick()`, 드롭 성공=`hapticSuccess()`.
  - 멀티데이/연결(`span.isMulti`)·support는 웹과 동일하게 **드래그 제외**(웹 규칙 일치).
- **Evaluator/회귀**: ① 어젠다 세로 스크롤이 평상시 멀쩡한가(무장 전엔 `pan-y` 유지). ②
  월 스와이프 핸들러(904–920)와 충돌 안 하는가(롱프레스 타이머 vs 스와이프 임계 56px 분리). ③
  **직렬 큐/`beforeunload`/prop 가드** 그대로 통과하는가(새 저장경로 금지). ④ 권한 밖 역할은
  드래그 불가. ⑤ 실제 iOS 기기에서 롱프레스 텍스트선택/확대 안 뜨는지.
- **효용/위험/공수**: 효용 高 · **위험 高** · 공수 高. → **Phase 3, 반드시 단독 브랜치+기기 테스트.**

### B2. 카드 탭 "손맛" 피드백 ⭐(사용자 요청)
- **무엇**: `.m-event` 탭(수정시트 열기) 시 ① 즉각 시각 눌림(active scale 0.97 + 옅은 글로우),
  ② 햅틱 틱(Android `vibrate(12)`; iOS는 프로그래밍 불가 → 시각으로 보강). 시트는 기존
  `m-sheet-up`으로 올라옴. 현재는 탭→시트뿐, 누름 피드백 0.
- **왜**: 터치의 즉각 반응 = 체감 성능 + 손맛. "perceived performance".
- **Planner**: 컴포넌트 = 모바일 이벤트 버튼(2173–2196). 권한/경계/KST 무관.
- **Builder**: `.m-event:active{transform:scale(.97)}` + 탭 시 짧은 글로우 클래스(120ms,
  `cell-select-pop` 톤 축소판). `onClick` 진입부에서 `hapticTick()`(C1). reduced-motion 시
  transform 제거. 진동은 설정+감지 뒤.
- **효용/위험/공수**: 효용 中~高 · 위험 低 · 공수 低. → **빠른 승리**.

### B3. 모바일 생성/삭제 애니메이션 패리티 ⭐(사용자 요청)
- **무엇**: 모바일은 현재 생성/삭제 애니메이션이 **전무**. 웹의 `pill-settle`(생성 안착)·
  `pill-poof`(삭제 뿅)를 `.m-event`/`.m-add-event`/수정시트 흐름에 도입. 삭제 시 행 높이가
  부드럽게 접히고(레이아웃 점프 방지), 생성 시 "+버튼에서 떨어지듯" 슬라이드+settle.
- **왜**: 웹/모바일 모션 통일성(디자인 유니티) + 작업의 결과를 명확히("user-system bond").
- **Planner**: 컴포넌트 = `openMobileAdd`(1842)/`deleteEvent`(1560–1573)/`commitDelete`
  (1576–1613)/수정시트(2451–2577). 권한 = `canEdit`만 생성/삭제(현행). 경계/KST 무관.
- **Builder**: `.m-event.just-saved`/`.m-event.deleting`에 기존 키프레임 재사용(웹과 동일
  타이밍). 행 접힘은 `max-height`+`opacity` 트랜지션 또는 FLIP로(점프 방지). 삭제는 **낙관적
  제거 후 큐**(기존 `commitDelete` 경로 유지). 햅틱: 생성=success, 삭제=짧은 더블틱(Android).
  reduced-motion 합류.
- **Evaluator/회귀**: 삭제 시 어젠다 높이 점프 없는지, 낙관적 롤백(실패 시 스냅샷 복원
  1609) 그대로인지.
- **효용/위험/공수**: 효용 高 · 위험 低~中 · 공수 中. → **우선 착수 권장**.

### B4. 월 스와이프 햅틱 + 러버밴드 추종
- **무엇**: 현재 스와이프는 *끝났을 때* 슬라이드만. (1) 커밋 순간 햅틱 틱, (2) 손가락을 따라
  어젠다가 실시간으로 살짝 끌려갔다 스프링 복귀(rubber-band).
- **Planner**: 핸들러 = `onAgendaTouchStart/End`(904–920). `touchmove` 추가 필요.
- **Builder**: `touchmove`에서 `translateX`를 손가락 dx에 감쇠 적용(경계 저항), 커밋/취소 시
  `--ease` 스프링 복귀. 임계 56px·1.5 비율 로직 유지. 커밋 시 `hapticTick()`. reduced-motion
  시 실시간 추종 끄고 기존 슬라이드만.
- **Evaluator/회귀**: 세로 스크롤 방해 금지(`pan-y` 유지, dx>dy일 때만 가로 처리). B1 롱프레스와
  제스처 충돌 정리.
- **효용/위험/공수**: 효용 中 · 위험 中 · 공수 中.

### B5. (선택) 오버스크롤 글로우 / 당겨서 새로고침 느낌
- 어젠다 최상/최하단 당김 시 브랜드 톤 글로우. 낮은 우선순위. 효용 低~中 · 위험 低.

---

## §5. 웹·모바일 공통 제안 (Common)

### C1. 햅틱 유틸 + 사용자 설정 (모든 햅틱의 기반공사) ⭐
- **무엇**: `lib/ui/haptics.ts` 신설. `haptic(pattern)`이 ① `'vibrate' in navigator`
  감지, ② 사용자 **진동 on/off**(localStorage) 확인, ③ 짧은 시맨틱 헬퍼 제공:
  `hapticTick()`=12ms, `hapticSuccess()`=`[12,40,12]`, `hapticWarn()`=`[20,60,20]`,
  `hapticError()`=`[30,40,30,40,30]`. iOS는 자동 no-op(예외 없음).
- **왜**: 진동을 **한 곳에서** 안전하게 게이트(기능감지·설정·과용방지). B1/B2/B3/B4/C2/C3가
  전부 여기에 의존.
- **Planner**: 신규 유틸 + 설정 토글 1개. 권한/경계 무관(클라이언트 한정, 서버 전송 없음 —
  하트 카운팅처럼 로컬). KST 무관.
- **Builder**: 순수 함수 + `try/catch`(silent). 설정 기본값 ON(iOS는 어차피 무동작).
  `prefers-reduced-motion: reduce`는 *모션*이지 *햅틱*이 아니므로 자동 연동하지 않되, 설정
  UI에서 "동작 줄이기 사용 중" 안내. 1.1의 **iOS는 진짜 스위치만 햅틱** 주석 명시.
- **효용/위험/공수**: 효용 高(기반) · 위험 低 · 공수 低.

### C2. 하트 햅틱 + iOS 네이티브(진짜 스위치) ⭐
- **무엇**: 뷰어 어항 하트 토글 시 (Android) 진동 틱 + (iOS) **하트의 내부 컨트롤을 진짜
  `<input type="checkbox" switch>`로 만들어 사용자 탭에서 Taptic** 발생. iOS에서 합법적
  햅틱을 얻는 **유일한 지점**. 토글 순간 어항이 한 번 "쿵" 출렁(미세 scale).
- **Planner**: 컴포넌트 = `components/poster/public-poster.tsx`의 `LiquidHeart`/하트 토글.
  역할 = 뷰어 포함 전원(하트는 공개 상호작용). 경계 = 하트 카운트는 로컬 지속(기존), 서버
  유출 없음. KST = 월 스코프 비율(기존) 유지.
- **Builder**: 하트 버튼을 시각상 동일하되 접근성 라벨 가진 `<input type="checkbox" switch>`
  + `<label>`로 재구성(스타일은 현 디자인 그대로). 토글 effect에서 `hapticTick()`. **기존
  localStorage 지속·비율 채움(`interestRatio`)·`heart-rise` 부유 회귀 없는지** 집중 검증.
  reduced-motion 시 "쿵" 출렁 생략.
- **효용/위험/공수**: 효용 高(iOS 유일 햅틱+몰입) · 위험 中 · 공수 中.

### C3. 비공개 잠금 해제/실패 연출 + 햅틱
- **무엇**: 패스코드 **성공** 시 `lock-pop`(기존) + `private-banner-in`(기존) + `hapticSuccess()`;
  **실패** 시 입력 흔들림(shake) + `hapticError()`. 비공개 모드의 "경고-heavy" 톤 강화.
- **Planner**: 컴포넌트 = 비공개 잠금 해제 UI(`/studio/private-layer` 흐름,
  `unlock-private-layer`). 권한 = 비공개 접근 자격자(소유자·작업자·개발자; **매니저 제외**,
  CLAUDE.md). 경계 = 서버 검증 유지(클라 게이트 단독 금지).
- **Builder**: 성공/실패 분기에서 햅틱 호출 + shake 키프레임(신규, ±4px 3회, `--dur-2`).
  reduced-motion 시 shake 생략(색/메시지로 대체).
- **효용/위험/공수**: 효용 中 · 위험 低 · 공수 低.

### C4. (탐색) 라우트 전환 View Transitions
- **무엇**: studio↔decorate↔viewer 전환을 same-document View Transitions로 매끄럽게(현 로더/
  스켈레톤은 유지하되 morph 추가). 1.3 참고.
- **Planner/위험**: Next App Router + View Transitions 통합은 실험적. 현 월 전환(key 리마운트)
  과의 상호작용 검증 필요. reduced-motion 분기 필수.
- **효용/위험/공수**: 효용 中 · **위험 中~高** · 공수 中. → **탐색 과제(스파이크 먼저)**.

### C5. 저장/낙관 피드백 일관화
- 웹·모바일이 **같은** settle+ring(저장)·poof(삭제)를 쓰도록 정리(B3와 연동). 신규 키프레임
  없이 배선 정합만. 효용 中 · 위험 低 · 공수 低.

### C6. "동작·진동" 설정 표면
- `prefers-reduced-motion`은 자동 존중하되, **진동 on/off** 명시 토글을 어딘가(설정/역할 바
  근처)에 둔다. C1 의존. 모바일은 *컴팩트* 원칙대로 라벨 최소화. 효용 中 · 위험 低 · 공수 低.

---

## §6. 우선순위 매트릭스 & 권장 시퀀스

| ID | 제안 | 분류 | 효용 | 위험 | 공수 | Phase |
|---|---|---|---|---|---|---|
| C1 | 햅틱 유틸+설정(기반) | 공통 | 高 | 低 | 低 | **0** |
| C6 | 동작·진동 설정 표면 | 공통 | 中 | 低 | 低 | **0** |
| B2 | 카드 탭 손맛 | 모바일 | 中~高 | 低 | 低 | **1** |
| B3 | 모바일 생성/삭제 애니 | 모바일 | 高 | 低~中 | 中 | **1** |
| A3 | 드롭 안착 마무리 | 웹 | 中 | 低 | 低 | **1** |
| C2 | 하트 햅틱(iOS 스위치) | 공통 | 高 | 中 | 中 | **1** |
| C3 | 잠금 해제/실패 연출 | 공통 | 中 | 低 | 低 | **1** |
| A4 | hover lift 어포던스 | 웹 | 低~中 | 低 | 低 | **1** |
| A1 | 연결/끊김 seam | 웹 | 高 | 中 | 中 | **2** |
| A2 | FLIP 재정렬 | 웹 | 中 | 中 | 中 | **2** |
| B4 | 스와이프 햅틱+러버밴드 | 모바일 | 中 | 中 | 中 | **2** |
| B1 | 모바일 드래그 이동 | 모바일 | 高 | **高** | 高 | **3** |
| C4 | View Transitions 라우팅 | 공통 | 中 | 中~高 | 中 | **탐색** |
| B5 | 오버스크롤 글로우 | 모바일 | 低~中 | 低 | 低 | 선택 |

**권장 흐름**: Phase 0(기반) → Phase 1(저위험 몰입 묶음, 사용자가 체감 큰 손맛/패리티) →
Phase 2(시각 고급화) → Phase 3(모바일 드래그, 단독 브랜치·실기기 테스트) → 탐색(C4).

---

## §7. 전 항목 공통 — Evaluator 점검표 (CLAUDE.md 하니스)

각 PR 종료 전 반드시:
- [ ] **비공개 유출 0** — 모션/햅틱은 공개/비공개 데이터에 무관해야(시각·촉각만).
- [ ] **소유자 전용 편집 불변** — 드래그/생성/삭제 권한은 `canEdit`(owner/dev). 매니저/작업자
      편집화 금지. 서버 권한 체크 유지(클라 게이트 단독 금지).
- [ ] **직렬 큐 불변** — 모바일 드래그/삭제도 `enqueueMovePersist`/`commitDelete` 경로.
      마지막 동작이 저장 진실. prop 동기화 가드(338–347)·`beforeunload`(351–360) 그대로.
- [ ] **reduced-motion 합류** — 신규 키프레임은 전부 `@media (prefers-reduced-motion: reduce)`
      에서 무력화. JS 모션은 `prefersReducedMotion()` 확인.
- [ ] **햅틱 3중 게이트** — 기능감지 + 사용자 설정 + 과용 방지. iOS 프로그래밍 진동 의존 0.
- [ ] **디자인 통일성** — 토큰(`--ease`,`--dur-*`)·기존 키프레임 재사용. 좌우 패딩 대칭. 일회성
      스타일·버튼 모양 불일치 금지. 모바일은 카피/컨트롤 *덜어내기*(컴팩트).
- [ ] **회귀 재검증** — 구조 변경 후 생성/드래그/재정렬/저장 순서·낙관 vs 서버 prop 동기·버튼
      enabled 범위·인접 surface 패딩 재확인.
- [ ] **60fps** — transform/opacity 위주(합성). border-radius/top/left 애니 지양. 필요 시
      `will-change` 신중히.
- [ ] **빌드 게이트** — TypeScript + lint + `next build` 통과 → 공개/비공개 경계 재확인 →
      커밋·푸시(main, Vercel 자동배포) → 커밋 해시 보고.

---

## §8. 자기검토 로그 (N차 — 내 철학·목적성 대비 반박과 근거)

> 사용자 요청: "내 철학과 프로젝트 목적성에 의심 가는 부분 있으면 다시 정리해 재서칭."
> 아래는 초안을 스스로 반박하고 재조사한 기록.

1. **"웹에서도 진동을 주자"고 쓸 뻔함 → 철회.** 재서칭 결과 데스크톱은 하드웨어/지원 부재로
   사실상 무동작이고 Firefox는 제거됨. 진동은 *모바일(주로 Android) 점진적 향상*으로 한정해야
   목적성("정직한 체감 성능")에 부합. → §1.1, C1에 반영.
2. **iOS 햅틱 핵(`label.click()`)을 핵심 수단으로 제안할 뻔함 → 철회.** **iOS 26.5에서 패치**
   되어 프로그래밍 트리거 불가(오늘 기준 최신). 다만 *진짜 스위치 사용자 탭*은 유효 →
   하트/잠금 토글을 스위치로 만드는 C2가 iOS에서 유일하게 정직한 햅틱. 과장 없이 명시.
3. **연결/끊김을 border-radius 트랜지션으로 애니메이트하려 함 → 수정.** radius/위치 속성은
   합성 비친화적이라 60fps 위협. → 모서리는 즉시, 연출은 opacity/transform 오버레이로(A1).
   "playful but not janky" 철학 유지.
4. **모바일 드래그를 Phase 1로 둘 뻔함 → Phase 3로 강등.** `touch-action` 구조적 한계 + iOS
   롱프레스 간섭으로 회귀 위험이 가장 큼. CLAUDE.md "구조 변경 후 회귀 재검증" 원칙상 단독
   브랜치·실기기 검증 전제 → 우선순위 현실화.
5. **View Transitions로 월 전환까지 갈아끼우려 함 → 탐색으로 격하.** 이미 검증된 key
   리마운트 슬라이드를 대체하면 회귀 위험. 신규 효과는 FLIP/CSS로 외과적으로, VT는 라우트
   전환 스파이크만(C4). "imbalance/회귀 = 결함" 원칙.
6. **"무지성 진동 남발"은 몰입을 해친다 → 3중 게이트 + 짧은 패턴.** 과한 햅틱은 admin-panel
   스러운 거슬림. 시맨틱 헬퍼로 강도/빈도 절제(C1).
7. **모바일에 웹 카피를 그대로 얹을 뻔함 → 컴팩트 원칙 재확인.** 설정/라벨은 폰에서 덜어낸다(C6,
   B 전반). "모바일은 컴팩트가 생명".

---

## §9. 참고 출처 (2026-05 기준 재확인)

- Vibration API / 지원·제약: MDN [Navigator.vibrate](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate),
  MDN [Vibration API](https://developer.mozilla.org/en-US/docs/Web/API/Vibration_API),
  caniuse [navigator.vibrate](https://caniuse.com/mdn-api_navigator_vibrate)
- iOS 햅틱(스위치/패치): [ios-haptics (tijnjh)](https://github.com/tijnjh/ios-haptics),
  [WebKit Safari 18 beta](https://webkit.org/blog/15443/news-from-wwdc24-webkit-in-safari-18-beta/),
  Ionic issue [#29942](https://github.com/ionic-team/ionic-framework/issues/29942)
- View Transitions: [Chrome — what's new in view transitions (2025)](https://developer.chrome.com/blog/view-transitions-in-2025),
  MDN [View Transition API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API),
  caniuse [view-transitions](https://caniuse.com/view-transitions)
- FLIP: [Josh W. Comeau — FLIP](https://www.joshwcomeau.com/react/animating-the-unanimatable/),
  [CSS-Tricks — FLIP in React](https://css-tricks.com/everything-you-need-to-know-about-flip-animations-in-react/)
- 터치/포인터·`touch-action`: MDN [touch-action](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action),
  w3c pointerevents [#178](https://github.com/w3c/pointerevents/issues/178),
  Chrome [scrolling intervention](https://developer.chrome.com/blog/scrolling-intervention)
- iOS 롱프레스 콜아웃 억제: WebKit bug [231161](https://bugs.webkit.org/show_bug.cgi?id=231161)

---

### 부록 A — 핵심 코드 앵커 (Builder 착수용)

- 모션 토큰: `app/globals.css:75-78` · reduced-motion 전역: `app/globals.css:206-214`
- 저장/삭제/드롭라인/셀팝 키프레임: `components/studio/studio-shell.css:2353-2364, 2472-2492, 2542-2550`
- 웹 드래그: `studio-shell.tsx` `onPillPointerDown:1147-1169`, 드롭판정 `1058-1145`, `dropEventInto:1219-1276`
- 직렬 큐: `enqueueMovePersist:1182-1195`, `runMovePersist:1197-1216`, prop가드 `338-347`, `beforeunload:351-360`
- 서버 액션: `lib/schedules/event-actions.ts` `reorderEventsAction:100-155`(권한 106), `deleteEventAction:275-298`
- 연결 판정: `lib/calendar/month.ts:getEventSpan:479-519`(`edgesMatch:492-496`)
- 연결 바 CSS: `studio-shell.css:3358-3389`, `public-poster.css:2934-2959`
- 모바일: `renderMobile:1891-2260`, 스와이프 `904-920`, 탭 `2173-2196`, `openMobileAdd:1842`, 삭제 `1560-1613`, 수정시트 `2451-2577`, 시트키프레임 `m-sheet-up ~4581`
- 브레이크포인트: `lib/ui/breakpoints.ts`(`MOBILE_QUERY`/`BREAKPOINTS.mobile=640`), `isNarrow:305`
- 하트: `components/poster/public-poster.tsx` `LiquidHeart`, `heart-rise:685-697/1418-1431`
- 터치액션: `.agenda{touch-action:pan-y}`, `.draggable{touch-action:none}`, `.event-drag-ghost{touch-action:none}`

### 부록 B — 예시 스니펫 (착수 마찰 제거용, 그대로 복붙 아님 — 방향 제시)

**C1 — `lib/ui/haptics.ts` (기반공사)**
```ts
// 진동은 항상 점진적 향상: 기능감지 + 사용자 설정 + 짧은 패턴. iOS는 자동 no-op(예외 없음).
const KEY = "vic.haptics";
export function hapticsEnabled(): boolean {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return false;
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; } // 기본 ON
}
export function setHaptics(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
}
function buzz(p: number | number[]) {
  if (!hapticsEnabled()) return;
  try { navigator.vibrate(p); } catch {} // 예외 안 던지지만 방어
}
export const hapticTick    = () => buzz(12);
export const hapticSuccess = () => buzz([12, 40, 12]);
export const hapticWarn    = () => buzz([20, 60, 20]);
export const hapticError   = () => buzz([30, 40, 30, 40, 30]);
// iOS 유일 합법 햅틱: 하트/잠금 토글을 '진짜' <input type="checkbox" switch>로 만들어
// '사용자 직접 탭'에서 Taptic이 나게 한다(코드 트리거는 iOS 26.5+에서 불가).
```

**A1 — seam 키프레임 (radius는 즉시, 연출은 opacity/transform 오버레이)**
```css
/* 연결: 이음새를 따라 빛이 한 번 흐름. 합성 전용 속성만. */
@keyframes seam-heal {
  0%   { opacity: 0; transform: scaleY(0.4); }
  40%  { opacity: 0.9; }
  100% { opacity: 0; transform: scaleY(1); }
}
.studio-event-pill.seam-joining::after { /* 이음새 위치에 절대배치된 가는 빛 */
  content: ""; position: absolute; inset: 0 0 0 auto; width: 2px;
  animation: seam-heal var(--dur-3) var(--ease) both;
}
.studio-event-pill.seam-breaking { animation: seam-tear var(--dur-2) var(--ease); }
@keyframes seam-tear { 50% { transform: translateX(2px); } } /* 끊김: 살짝 튕김 */
@media (prefers-reduced-motion: reduce) {
  .studio-event-pill.seam-joining::after,
  .studio-event-pill.seam-breaking { animation: none; }
}
```

**A2 — FLIP 골격 (useRef + useLayoutEffect, setState 금지)**
```ts
const rects = useRef<Map<string, DOMRect>>(new Map());
useLayoutEffect(() => {
  if (prefersReducedMotion()) return;
  document.querySelectorAll<HTMLElement>("[data-eventid]").forEach((el) => {
    const id = el.dataset.eventid!; const last = el.getBoundingClientRect();
    const first = rects.current.get(id);
    if (first) { // Inverse → Play
      const dx = first.left - last.left, dy = first.top - last.top;
      if (dx || dy) {
        el.style.transform = `translate(${dx}px,${dy}px)`; el.style.transition = "none";
        requestAnimationFrame(() => {
          el.style.transition = `transform var(--dur-3) var(--ease)`;
          el.style.transform = "";
        });
      }
    }
    rects.current.set(id, last);
  }); // 드래그 중(.dragging-src)·.just-saved 요소는 건너뛰도록 가드 추가
});
```
