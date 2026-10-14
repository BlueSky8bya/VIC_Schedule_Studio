# 시청자 최초공개 전체 무대 연출 — 구현 계획

- 작성: 2026-10-14 KST · 상태: **Superseded** by [PLAN-027](PLAN-20261014-027-teaser-premiere-final.md) — 상태·동기화·검증 근거 자료.
- 범위: 공개 시청자·비로그인·편집실 시청자 미리보기. 이번 산출물은 이 문서 하나이며 제품 코드·DB·설정은 변경하지 않는다.
- 기준: 현재 작업 트리. 아래 `file:line`은 조사 시점 위치다. 기존 미추적 `PLAN-20261014-025-teaser-premiere-stage.md`는 읽거나 덮어쓰지 않았다.
- 우선순위: 공개 경계 → KST/권한 → 읽기·조작 가능성 → 무대 품질 → 유지보수. 승인된 기능은 유지하고, 새 수치는 소유자 검토용 기본안으로 제안한다.

## 0. 한 줄 요약

**공개 180초 전부터 주변이 차례로 물러나고, 68초 전 떡밥이 중앙 스크린으로 올라와 기존 고조 곡선·마지막 10초의 고요·0초의 단발 빅뱅을 거친 뒤 일정표로 돌아오는, 서버 공개 판정과 다중 일정 지휘자를 공유하는 한 무대를 만든다.**

## 1. 현재 구조 진단

### 1.1 근거와 막히는 지점

| 현재 구조·근거 `file:line` | 전체 무대에서 생기는 문제 | 계획 방향 |
|---|---|---|
| `components/poster/public-poster.tsx:345`, `:370`, `:386`, `:420` — 카드별 초 시계와 100ms writer | 초 경계는 맞추지만 카드 수만큼 timer/writer가 생긴다. 화면 전체 연출을 지휘하는 단일 상태가 없다. 주석과 달리 해당 effect에는 60초 밖 timer 자체를 막는 조건도 없다. | 한 coordinator가 대상·phase·공개 요청·시각 채널을 소유. 카드/팝오버/스크린은 구독자. |
| `lib/ui/use-remain-seconds.ts:19` — `Date.now()`로 diff 계산, `:21` — ceil | 사용자 PC 시계가 빠르면 0초도 빨라진다. 공용 훅은 공용 서버 시계가 아니라 컴포넌트마다 실행되는 훅이다. | 서버 기준 epoch + `performance.now()` 진행을 공용 source로 제공. ceil 의미는 보존. |
| `components/poster/public-poster.tsx:1790`, `:1802`, `:1815`, `:1850`, `:4884` — 열린 상세의 이벤트·시계·writer·링 | `.dt-count` 무대가 상세 열린 상태에 종속된다. 전체 화면과 별도로 추가하면 두 무대·두 타이머·두 축하가 된다. | 링/숫자/공개 내용을 공용 부품으로 추출, 상세와 전체 무대의 표시권을 한곳에서 결정. |
| `lib/ui/hype-curve.ts:12`, `:47`, `:63`, `:84`, `:164` | 이미 60초 고조, 66→58초 등장, 11.8→10초 고요, 위상 적분이 있다. 새 곡선을 만들면 기존 카드와 박자가 갈라진다. | 기존 함수를 정본으로 유지. 180초 전주·퇴장 진행도만 별도 추가. |
| `components/poster/public-poster.tsx:626`, `:1080`, `:1093` | `resolveTeaserView`로 카드/상세가 같은 최신 캐시를 쓰는 수정은 존재한다. 그러나 mount/props 변경 때만 최신 상태를 받는다. 다른 탭에서 공개 시각을 당겨도 기존 탭에 새 props가 저절로 오지 않는다. | 공개 상태 갱신 통로를 coordinator에 연결. resolver를 교체하지 않고 revision을 확인한 최신 응답을 그 입력으로 사용. |
| `lib/schedules/event-actions.ts:268`, `:323`, `:357`; `lib/schedules/cache.ts:9` | 저장/삭제 때 캐시 무효화는 한다. 이것만으로 열린 브라우저 메모리를 푸시 갱신하지는 않는다. | 저장 성공 후 공개 상태 revision 무효화도 수행. 열린 탭은 공용 상태 응답으로 따라간다. |
| `lib/schedules/public-loader.ts:66`, `:217`; `app/api/public/[calendarSlug]/events/route.ts:27` | 일반 일정 Data Cache는 300초. events API는 CDN 300초가 더해질 수 있음을 코드 자체가 명시한다. 초 단위 무대의 상태 채널로 쓰기 어렵다. | 기존 전체 일정 캐시는 유지. 작은 최초공개 전용 상태 경로만 짧게 갱신. |
| `components/poster/public-poster.tsx:429`, `:692`, `:1657` | 카드/placeholder가 각각 2초 재시도하고 요청은 `[id]` 단위다. 동시 공개 N개 × 시청자 V명일 때 요청 수가 곱해진다. 응답 순서 역전 방어도 revision 기준이 아니다. | 배치 요청 하나, 한 in-flight, 공용 서버 캐시·분산 잠금. 카드의 공개 네트워크 timer 제거. |
| `lib/schedules/public-loader.ts:185`, `:192`; `lib/schedules/teaser-actions.ts:18` | 현재 공개 액션은 달력 조회+일정 조회, 공개 결과가 있으면 `settle_teaser_hopes`까지 호출한다. 조회 폴링에 재사용하면 공개 읽기와 부수 쓰기를 시청자 수만큼 반복한다. | 공개 상태 경로는 read-only. 공개 읽기·reconcile은 재사용하되 기대→하트 정산 실행은 기존 서버 작업으로 분리. |
| `db/migrations/0138_public_events_tentative_teaser.sql:9`, `:16`, `:20`, `:25`, `:29`; `lib/schedules/public-loader.ts:472` | DB 뷰는 DB `now()`로 실제 제목·시간·태그를 가린다. 앱 mapEvent는 앱 시계로 다시 상태를 고른다. 앱이 빠르면 내용은 SQL 덕분에 가려져 있어도 빈 DTO를 공개본으로 오인할 가능성이 있다. 이는 잠재적 상태 불일치이며 운영 재현 주장은 아니다. | DB가 계산한 `masked/released` 판정을 응답 envelope에 넣는다. 빈 제목이나 앱 시계만으로 공개 완료를 판정하지 않는다. |
| `lib/schedules/teaser-reconcile.ts:27` | 확인 실패와 삭제를 구별하는 좋은 계약이 있다. 다만 canonical 전체 목록과 부분 배치 응답을 혼동하면 전부 삭제로 판정할 수 있다. | `ok=false` 보존. 응답의 coverage/완전성·revision을 검사한 뒤, 실제 확인 범위에 대해서만 gone 처리. |
| `components/poster/public-poster.tsx:1649`, `:1651`, `:1695` | watched/celebrated는 id 단위이고 visible·숨김 복귀·공개 시각 변경 버전이 분리되지 않는다. 축포는 카드와 상세에서 각각 발생한다. | `(eventId, premiereGeneration)` 단위 관람 기록, cohort 단위 효과권. 숨겨진 카드의 mount를 실제 관람으로 간주하지 않는다. |
| `components/poster/public-poster.tsx:489`, `:552`, `:1714` | ScrambleText와 유지 시간은 제목 길이에 비례한다. 동시 다중·긴 제목에서는 전체 화면 체류가 길어질 수 있다. | 같은 ScrambleText를 재사용하되 스크린의 읽기 대기를 막지 않도록 해독 총 시간 상한 제안. 접근성 텍스트는 완성본 한 번. |
| `components/poster/public-poster.tsx:254`, `:5395`, `:5402`; `components/poster/public-poster.css:3105` | 1840 설계 표면 + scaler. 원본을 `fixed`로 바꾸거나 grid에서 제거하면 표면 기하·배율 계산·캡처가 변한다. | 레이아웃 원본은 그 자리에 보존. 표면 밖 viewport overlay의 공용 presenter로 FLIP. |
| `components/poster/public-poster.tsx:4493`, `:5479`, `:5485`, `:5489`, `:5510`, `:5553` | 배경·패널·하단 버튼은 포스터와 다른 좌표/부모에 있다. 큰 부모 하나를 transform하면 클릭·z-index·캡처가 엉킨다. | 영역별 motion shell 등록. 기능 상태와 배치를 바꾸지 않고 표시 레이어만 퇴장. |
| `lib/ui/ambient-pause.ts:19`, `:31`; `components/poster/public-poster.tsx:2211`; `docs/ux/UI_RULES.md:39` | ambient pause는 마지막 프레임을 보존한다. 모바일은 ambient engine을 만들지 않으며 달력 배경은 원래 정적이다. | 배경을 새로 시뮬레이션하지 않는다. 기존 wrapper의 퇴장 + pause holder만 추가. |
| `tests/visual/teaser-reveal.spec.ts:14`, `:41`; `tests/visual/teaser-hype.spec.ts:14`; `tests/visual/teaser-hype-craft.spec.ts:19`; `app/visual-fixture/poster/page.tsx:25` | 기존 fixture는 떡밥 하나. 공개 요청 테스트는 실패 응답 중심이고 일부 시각 검사는 DOM/옛 수식 주입이다. 다중·응답 역전·성공 공개·실제 전체 무대는 검증하지 못한다. | 서버와 클라이언트가 공유하는 fixture 시나리오 + mock transport로 실제 공용 구현을 검증. |

### 1.2 경계·권한·시간 전제

- 공개 전 클라이언트가 받을 수 있는 것은 기존 공개 stub의 id·공개용 날짜·공개 예정 시각·미정 여부 등 명시 허용 필드뿐. 실제 방송 시작/종료 시각·제목·본문·태그·실제 카테고리·support URL은 금지. 공개 예정 시각과 실제 방송 시각을 구별한다. `startsAt`의 기존 KST 자정은 날짜 배치용이지 실제 방송 시각이 아니다.
- DB `public_schedule_events`의 마스킹과 calendar/public/draft/deleted 스코프를 보존. 공개 route는 `public-loader`만 호출. studio-loader, service-role helper, private DTO, raw events Realtime payload를 새 경로에 연결하지 않는다.
- owner/developer의 기존 일반 일정 편집만 사용. viewer는 공개 읽기만. `owner_private`는 owner 전용이며 Google 인증·패스코드 grant의 만료/회수/세션 결속을 건드리지 않는다. 최초공개 관람은 비공개 언락이 아니다.
- `/`, 비로그인 `/`, 편집실 viewer preview는 동일 `PublicPoster`와 동일 coordinator. 일반 편집 화면에는 전체 무대를 자동 실행하지 않는다. 편집실 게이트 카운터는 기존 공용 숫자·시계를 계승한다. `/onair`는 같은 구현을 사용하되 전체 연출 기본 활성 여부는 §10 결정.
- 월/날짜 귀속·표시·fixture 파일명은 KST helper 기준. 공개 순간은 ISO epoch로 비교하고, 계절은 **보고 있는 달**, 특별한 날은 **실제 KST 날짜** 기준을 유지한다.

## 2. 단계 타임라인 표

`T` = 서버가 확인한 현재 cohort의 공개 시각, `r = T - syncedNow`. 아래 phase는 긴 setTimeout 사슬이 아니라 매 tick에 절대 시간·최신 revision·사용자 선택으로 다시 도출한다. 중간 진입·변경 시 지난 안무를 몰아 재생하지 않는다.

| 구간 | 화면 | 트리거·종료 조건 |
|---|---|---|
| `r > 180초` · idle | 기존 일정표. 카드 카운터·상세 기능 유지. | 유효한 공개 stub이 현재 보는 달에 존재하고 공개 상태 동기화 성공 시 준비. |
| `180→150초` · prelude 1 | 데뷔 안내 상자의 보라 별이 스크린 방향을 가리킨 뒤 상자가 가볍게 인사하며 물러남. 작은 `최초공개 준비 중` 안내. | 180초 경계. 안전 버튼은 첫 퇴장부터 존재. |
| `150→120초` · prelude 2 | 태그 필터 상자가 서랍처럼 접혀 가까운 화면 가장자리로 나감. 다른 일정은 계속 읽을 수 있음. | r 기반 슬롯 순서. 필터 선택값·panel.open은 수정하지 않음. |
| `120→90초` · prelude 3 | 검색·기록·계절 감상·월 이동 등 chrome이 80~120ms 간격의 짧은 행렬로 퇴장. | 보이는 영역만, 개별 퇴장은 360~520ms. 원래 숨겨진 영역은 생략. |
| `90→76초` · curtain | 배경이 아래/옆으로 밀려나듯 사라지고 저채도 어둠이 스며듦. 계절별 작은 SVG 장식만 잔류. | 배경 wrapper 종료 후 `useAmbientPause(true, instanceKey)` 획득. 배경 OFF면 퇴장 생략. |
| `76→68초` · evacuation | 최초공개 대상 외 일정이 주 단위 물결로 들썩인 뒤 바깥으로 빠짐. 날짜/격자도 opacity로 잠잠해짐. | 현재 대상 cohort + 가까운 후속 cohort를 제외. 마지막 군집 종료 시 집중 화면 준비. |
| `68→60초` · screen | 대상 stub이 원래 카드에서 중앙 영화 스크린으로 520ms FLIP. `hypeEmerge`의 66→58초 흐름으로 시계→링을 자연스럽게 연결. | 대상 DOM 측정 가능하면 FLIP, 없으면 중앙에서 짧게 등장. |
| `60→11.8초` · build | 기존 `hypeIntensity`, `hypeChannels`, `hypeMotionFrame`으로 스크린 주변 궤도·별의 밀도·운동이 점차 고조. | 단일 10Hz writer. 숫자만 1Hz. 새 전역 흔들림·밝기 점멸 없음. |
| `11.8→10초` · settle | 궤도/주변 떨림이 기존 `hypeCalm`으로 잦아들고 주변 장식이 물러남. | 기존 1.8초 smootherstep. 정확히 10초가 됐을 때 이미 고요함. |
| `10→0초` · eye | 넓은 여백, 중앙 숫자. 기존 `hypeFinale`로 숫자 존재감만 증가. 외곽 박동은 낮은 대비의 1Hz 이하. | countdown과 focus가 한 clock을 사용. 후속 cohort 장식도 함께 조용해짐. |
| `T` · ignition | 스크린 중심에서 보라/은백의 단발 확장 링 + 별조각. 숫자는 0 뒤 사라짐. | visible 상태에서 실제로 T를 통과했고 skip되지 않은 generation에 한 번. 데이터 미도착이면 내용은 계속 가림. |
| `T→응답` · waiting | 같은 스크린에 `공개 내용을 불러오는 중`. 가짜 제목·빈 일반 카드·음수 카운터 없음. | DB가 released라고 확인한 최신 DTO가 도착하면 공개. 5초 초과면 안전하게 무대를 접고 일정표에서 재시도. |
| `공개 확인 후 0→4~6초` · reveal/read | 이미 받은 공개 DTO로 같은 스크린의 제목→세부·시간→태그. ScrambleText는 동작 ON일 때만, 총 1.8초 상한 제안. | 실제 내용은 수신 즉시 공개 저장소에 반영. 안무 때문에 데이터 공개를 지연시키지 않음. 긴 내용은 읽기 영역 스크롤. |
| `이후 약 1.2~2초` · return | 공개 카드가 원래 자리로 FLIP, 다른 일정→격자→chrome→배경 순서로 귀환. | 가까운 후속 공개가 없거나 skip/취소/안전 제한. 보존한 필터·스크롤·패널 상태로 복귀. |

전주부터 `일정표 보기`를 항상 제공한다. 집중 스크린은 한 번에 최대 **90초**, 연속 공개가 계속되면 90초에서 비침습 배너·카드 공개로 전환하고 최소 30초는 전체 무대를 재점유하지 않는다. 일반 타임라인의 68초 집중+읽기+귀환은 이 예산 안에 들어온다.

## 3. 퇴장/귀환 안무

### 3.1 영역별 공통 규칙

- 영역은 `data-premiere-region` 같은 명시적 ref/속성으로 등록한다. 전역 `querySelectorAll('button')`로 로그인·편집·외부 모달까지 끌고 가지 않는다. 각 shell은 기존 레이아웃을 그대로 차지한다.
- 퇴장하는 장식/일정의 **시각 shell**만 transform/opacity. grid·표면 width/height/gap·panel 배치 상태·poster scale는 바꾸지 않는다. 기존 hover/선택 transform과 충돌하지 않게 한 겹의 motion shell을 두고 크기 불변을 검증한다.
- 목표 바깥 좌표는 viewport와 현 rect에서 계산한다. 퇴장 완료 시 shell은 inert/표시 차단, 자리 보존. 사용자 포커스를 가진 영역은 먼저 안전 컨트롤로 포커스를 옮기거나 무대를 보류한다.
- 퇴장/귀환은 공유 spring과 `flipSpring`을 사용한다. 취소 때 단순 역재생 시간을 믿지 않고 **현재 rect→현재 목표 rect**로 복구한다. 애니메이션 cancel 후 남은 inline transform/opacity/inert를 정리한다.

| 영역·현재 연결점 | PC | 모바일/agenda | 귀환 |
|---|---|---|---|
| 데뷔 안내 `railInfoCard`, `components/poster/public-poster.tsx:4333`, `.avatar-top-cards` | 작은 기울기 후 패널 쪽 바깥으로 나감. | `.agenda-debut`/헤더 안내만 4~8px 인사 후 위로. 안내가 없으면 빈 단계 생략. | 원래 자리로 짧은 spring. D+·실제 날짜 계산 유지. |
| 태그 `.slot-legend`, `:5489`; fallback `.public-right`, `:5446` | 상자를 통째로, 현재 panel.side 쪽으로 퇴장. 태그마다 DOM 수만큼 애니메이션하지 않음. | `.agenda-legend-rail`, `:3789`를 한 묶음으로 짧게 좌측 퇴장. | 선택·스크롤 위치 보존. 이미 접힌 패널은 계속 접힘. |
| 버튼 `.public-calendar-header`, `.poster-panel-ctl`, `:5286`, `:5510` | 검색/기록→계절→계정 chrome→월 이동/패널 버튼 순서. | `.agenda-header`와 `.agenda-monthbar`, `:5223`, `:5553`; 손가락 접근 가능한 안전 버튼은 하단 safe-area 안에 유지. | 월 이동은 원래 달로, 로그인 상태·설정은 현 상태 그대로. 미리보기 나가기/무대 종료는 연출 중에도 접근 가능. |
| 계절 `AmbientLayer`, `:4493` | 이미 그린 배경 wrapper가 천천히 바깥으로 이동/페이드. 새로운 날씨·지진 시뮬레이션 없음. | **ambient canvas 없음.** 작은 정적 계절 SVG/색만 활용, canvas·world art 요청을 새로 만들지 않음. | holder 해제 후 현재 설정/보고 있는 달 기준으로 복원. 꺼져 있던 배경을 켜지 않음. |
| 일반 일정 `.public-event`, `.agenda-item`, 업 도움/기간 띠 | 대상 기준 바깥 방향으로 주/행별 60~90ms 물결. 내용만 1~2px 준비 반동, 화면 전체는 흔들지 않음. 여러 날 띠는 연결된 논리 묶음으로 움직임. | 화면 안 행만 좌우로 아주 짧게 물러난 뒤 opacity 0. 세로 스크롤 위치·날짜 sticky 영역은 보존. | 날짜/논리 묶음 순서대로 짧게 돌아옴. 실제 변경으로 삭제된 일정은 복원하지 않음. |
| 최초공개 카드 | cohort를 대표하는 원본 rect에서 overlay screen으로 확대. 같은 시각 대상이 여럿이면 한 대표 출발점+묶음 표시. | 화면 안 원본이 없으면 중앙에서 등장. 강제 scrollIntoView/월 이동 없음. | 살아 있는 새 DOM rect를 다시 측정. 필터로 안 보이거나 월이 바뀌었으면 FLIP 대신 페이드. |
| 격자·요일·오늘 표시 `.public-calendar-area`, `:5414` | 카드 퇴장 뒤 opacity로 물러남. 크기·날짜 geometry는 고정. | 현재 agenda 구조를 보존한 채 시각적으로만 물러남. | 기존 today ring·밴드 z 규칙 그대로. 별도 날짜 스타일 신설 없음. |

DOM 수가 많으면 개별 카드 대신 행/주 단위로 묶는다. 활성 compositor layer 상한 기본안 PC 24개, agenda 8개; 나머지는 동일 shell의 opacity로 처리한다. 상한은 성능 검증 후 확정한다. viewport 밖 요소는 애니메이션 없이 최종 상태만 적용한다.

### 3.2 상태 복원 계약

보관 대상은 현재 viewed month·스크롤·필터·내 관심 조건·panel 상태·포커스 복귀 후보다. **사용자 설정 값을 과거 값으로 덮어쓰는 snapshot 복원은 하지 않는다.** 무대 중 설정/월이 바뀌면 그 최신 의도를 따른다. 무대 종료·삭제·오류·route unmount마다 overlay, timer, observer, ambient holder, body scroll lock, inert, CSS 변수와 effect token을 정리한다.

## 4. 스크린·어둠 연출 구조

### 4.1 한 스크린, 한 표시권

구조는 `PublicPoster → useTeaserPremiere → PremiereStage`다. stage는 `[data-export-surface]`와 `.poster-scaler` **밖**의 portal root에 놓고 viewport 좌표를 쓴다. 순서는 기존 페이지 → 어둠 → 효과 → 스크린 → 안전 컨트롤. 관련 overlay stack 정책 안에서 공용 z token으로 정의하고 임의의 큰 z-index 경쟁은 피한다.

- 원본 카드의 레이아웃 slot은 유지한다. 화면에 보이는 스크린은 **공용 presenter를 별도로 렌더한 sanitized DTO 표현**이다. `cloneNode`로 팝오버/카드 전체를 복제하지 않는다. id 중복·입력·iframe·개인정보 복사 위험을 피한다.
- `flipSpring(screen, fromTransform)`에 원본 `getBoundingClientRect`→스크린 rect 변환을 전달. 반환 시 최신 대상 rect로 다시 측정한다. poster scale·studio zoom을 다시 곱하지 않는다. 기존 helper가 transitionend를 기다리므로 중단/무모션 전환에서는 coordinator가 별도 정리 경로를 보장한다.
- 스크린은 PC 최대 폭 기본안 760px, 높이는 visual viewport의 72% 안. 긴 제목을 읽을 수 있게 실제 내용은 scale된 원본 텍스트가 아니라 공용 text token으로 최종 크기에 렌더한다. 모바일은 viewport−좌우 16px, 최대 높이 safe-area 제외 80dvh. 숫자·본문·태그 presenter는 공용이고 topology에 따른 배치만 다르다. 이 차이의 이유를 코드 옆에 적는다.
- 원본과 스크린 중 하나만 접근성/클릭 대상으로 노출한다. 이동하는 echo/particle은 `aria-hidden`, 원본은 시각·접근성 노출을 중복하지 않는다. 포스터 표면의 offsetWidth는 계속 1840, 행 높이·달력 컬럼 문법도 유지한다.
- 상세가 대상 떡밥을 열고 있으면 같은 presenter를 스크린 표시권으로 넘긴다. 대상 팝오버·리더·카드 축포를 별도로 실행하지 않는다. 무대를 종료하면 열린 상세는 최신 공개 DTO로 이어진다.

### 4.2 재질과 어둠

- 어둠은 고정 저채도 slate/violet scrim의 opacity를 0→기본안 0.72로 올린다. 배경 blur·전역 filter·전체 화면 hue/saturation 애니메이션은 사용하지 않는다. 정적 vignette texture도 필요하면 한 겹만 사용.
- 스크린은 금속 hairline 프레임 + 기존 `--glass-*` RGB 기반 물/유리 면 + 보라 `--teaser-*` 액센트. 금색은 기존 curve의 제한된 공개 하이라이트로 계승하며 새 빨강/주황 경보 분위기를 만들지 않는다. 눈 편한 테마에서도 같은 토큰 경로를 쓴다.
- 고조는 화면 전체 밝기 대신 궤도 회전·별의 이동·scale·밀도의 변화로 전달. halo/그림자는 정적으로 만들어 opacity/transform만 바꾼다. 마지막 10초에는 주변 운동·입자 spawn이 멎는다.
- 0초 빅뱅은 스크린 중심에서 바깥으로 한 번 퍼지는 링·별조각·프레임 확장이다. 전면 whiteout 없음. 효과 overlay와 데이터 reveal은 별개 사건이며 서버 확인 전에는 `???`/대기 문구만 존재한다.
- 기존 `hypeCalm`, `hypeFinale`, phase LUT는 정본. 링 presenter도 `.dt-count-ringbox`의 숫자/링/라벨 분리 구조를 유지하고 SVG gradient id는 인스턴스별 고유값으로 만든다.

## 5. 시계 동기화와 데이터 갱신 방식

### 5.1 시계: 숫자·무대·DB 공개 권한을 분리

1. 서버가 읽은 DB 시각과 snapshot 상태를 같은 DB statement에서 얻는다. 신규 공개 전용 **security-invoker** read RPC 또는 동등한 조회 envelope를 검토한다. 공개 뷰의 마스킹·anon 권한을 그대로 거치며 raw events를 읽는 새 SECURITY DEFINER 본문 API는 만들지 않는다.
2. `masked/released/gone`은 DB 판정, `revision`은 공개 관련 변경 순서, `sampledAtDbMs`는 snapshot 시각이다. 앱 `Date.now()`나 `publicTitle !== ''`로 released를 추정하지 않는다. 서버가 앞서도 SQL이 가린 빈 내용이 공개 완료로 바뀌면 안 된다.
3. 브라우저 시계 샘플 요청은 DB가 아닌 서버 런타임의 no-store 응답을 사용한다. 응답에 서버 수신/송신 시각을 싣고, 클라이언트 단조 시각의 왕복 중간점으로 offset을 계산한다. 서버 런타임↔DB 차이는 공용 snapshot의 DB 시각/조회 왕복에서 추정하며 그 나이와 오차도 보관한다.
4. 시작/복귀에는 작은 샘플 3개의 RTT와 처리시간을 비교해 최소 지연 샘플을 채택. 이후 `syncedNow = baseServerEpoch + (performance.now() - baseMono)`를 사용한다. 사용자 OS 시각 변경을 따라 점프하지 않는다. `HTTP Date` 또는 CDN에 캐시된 body의 시각을 수신 순간의 현재 시각으로 쓰지 않는다.
5. `useRemainSeconds`는 이 source를 받아 `ceil(max(0, r)/1000)`와 기존 초 경계 기상을 유지한다. 카드·공용 큰 카운터·상세·stage writer·분기상의 `Date.now()` 비교까지 같은 source로 정리한다. 숫자만 고치고 teaserActive 분기를 남기면 안 된다.
6. ±250ms 이내 보정은 시각 채널만 1초 안에 완만히 따라간다. 큰 오차·clock confidence 실패·절전 복귀는 즉시 최신 phase로 재계산하고 축포 관람 토큰을 무효화한다. 숫자의 표시 보간을 공개 권한 판정에 사용하지 않는다. 목표 오차는 정상 네트워크에서 ±250ms, 실측 전에는 보장값이 아니다.
7. clock 샘플은 전경 진입, 180초/66초 진입, 오래된 샘플로 복귀할 때만. 숨김 탭은 시각 loop/네트워크를 중지. React 숫자 1Hz, 활성 시각 writer 하나 10Hz, reduce-motion에는 시각 writer 0개. OS reduced-motion 별도 시딩은 추가하지 않는다.

### 5.2 추천 데이터 경로: 작은 공용 상태 + 전역 origin shield

**필수 구조:** `브라우저 coordinator → 익명 동일 GET /api/public/[calendarSlug]/teaser-state → CDN → 공용 origin cache/분산 single-flight → public-loader → 마스킹된 공개 뷰`.

기존 일반 일정 300초 캐시를 줄이는 안, 카드별 Server Action polling, 브라우저 Supabase 직접 polling은 채택하지 않는다. `unstable_cache`나 프로세스 Map만으로 여러 서버 인스턴스의 전역 중복 방지를 보장한다고 쓰지도 않는다.

- route는 쿠키·인증 identity를 읽지 않는다. 허용 calendar slug의 **고정 키**만 쓴다. id 배열·현재 시각·임의 query·사용자 식별값으로 캐시를 쪼개지 않는다. 월별 프런트 선택은 클라이언트에서 한다. 알 수 없는 query/slug는 DB 조회 전에 거절한다.
- canonical snapshot은 active teaser와 최근 24시간 공개 전환/취소의 공개 안전 registry만 포함한다. registry는 id·공개 generation·revision·이미 공개된 날짜/예정 시각 등 최소 필드만 기록한다. 활성 예약은 예약 중 유지하고, 공개/취소 이후 24시간에 registry에서 삭제한다. 비공개로 바뀐 일정의 새 내용은 남기지 않고 기존 공개 id의 gone만 전달한다. 공개 이력이 없는 private 일정은 registry/revision에 참여하지 않는다.
- 즉시 공개(`teaser=false`)·삭제까지 추적하려면 기존 id가 목록에서 빠진 이유를 서버가 알려야 한다. public registry를 공개 관련 mutation과 같은 트랜잭션에서 갱신하는 migration을 준비한다. 별도 anon 테이블 쓰기 권한은 주지 않는다. 24시간을 지난 복귀는 일반 공개 스냅샷으로 조용히 재기준화한다.
- allowlist envelope 제안: `schemaVersion`, `revision`, `snapshotSeq`, `sampledAtDbMs`, `validUntilMs`, `coverage`, `entries`. entry는 `id`, `premiereGeneration`, 공개 `teaserRevealAt`/날짜, `state`, 필요할 때 기존 `PublicScheduleEvent`의 **명시 필드 DTO**. released 항목만 실제 제목·시간·태그를 포함한다. 운영 시각/작성자·계정/세션 필드는 추가하지 않는다.
- generation은 공개 예약의 개정 단위다. 공개 시각/마스킹 상태가 바뀌면 바뀌고, 단순 하트 갱신은 바꾸지 않는다. snapshotSeq는 같은 revision 안에서도 DB 시각 경과로 masked→released가 일어날 수 있어 필요하다.
- 공용 origin cache는 모든 배포 인스턴스가 공유하는 저장소와 원자적 잠금/세대 비교를 사용한다. 1초 near TTL, 15초 far TTL 기본안. 잠금의 소유 토큰·만료·fencing 및 조회 timeout을 적용해 늦은 응답이 새 snapshot을 덮지 못하게 한다. lock loser는 DB를 우회 조회하지 않고 기존 안전 snapshot/짧은 503+Retry-After를 받는다.
- 배포 환경의 기존 캐시로 이 계약을 충족하는지 먼저 증명한다. 부족하면 작은 managed KV/Redis 같은 외부 공용 캐시가 필요하다. 현재 `package.json`에 그런 저장소 의존성은 없다. 신규 리소스·운영 비용 선택은 §10의 명시 결정 사항이며, 설정 실패 시 direct DB fallback은 금지한다. 검증 전 전체 무대 기능은 기본 OFF.
- CDN은 near 1초, far 최대 15초. browser max-age는 0. origin과 CDN은 **동일한 hard `validUntilMs`**를 공유한다. CDN TTL은 origin snapshot의 남은 유효기간으로 줄이고, 다음 180초 진입 경계/T도 만료 상한에 포함한다. 공개 시각을 넘는 masked 캐시 잔존은 최대 1초. 0초 전 내용 prefetch·캐시 예열은 금지; 안전 metadata/시계만 미리 가져온다. 만료된 안전 snapshot은 복구용 표시만 가능하고 새 무대/축포 시작의 근거로 삼지 않는다.
- 생성 기준 snapshot을 받은 뒤 일반 일정에 merge할 때도 `reconcileTeaserReveal`의 실패≠삭제 계약을 유지. coverage가 완전하지 않은 응답/오류는 gone 근거가 아니다. `(revision, snapshotSeq)`가 낮거나 다른 generation의 응답은 버린다. 300초 props가 새 공개 결과를 다시 덮지 못하게 resolver의 우선순위를 유지한다.

### 5.3 변경 전파·재시도·정산

| 상태 | 브라우저 GET 간격 기본안 | origin DB 갱신 상한 설계 |
|---|---|---|
| 전경, 활성 무대 없음/180초 밖 | 15초, 탭별 작은 jitter | calendar당 최대 15초에 1회 |
| 어느 공개든 180초 안, 무대/대기 활성 | 1초; 한 in-flight. 변경 시점·cohort당 별도 요청하지 않음 | calendar당 최대 1초에 1회 |
| 0초 데이터 지연/일시 장애 | 1→2→4→8→15초 backoff. 5초에 무대 반환, 수동 재시도도 같은 고정 endpoint | origin 공통 breaker/Retry-After가 상한 우선; 시청자별 DB 재시도 없음 |
| hidden/offline | 정지 | 해당 탭이 새 DB 작업을 유발하지 않음 |
| visible/pageshow/online 복귀 | 한 번 상태+clock 동기화 후 재개 | 공용 캐시/lock 경유 |

- 독립 TTL을 쌓으면 전파 지연은 `browser poll + CDN 잔존 + origin 잔존 + RTT`다. 추천안은 hard expiry를 공유해 origin+CDN snapshot 나이를 near 최대 1초/far 최대 15초로 묶는다. 따라서 near는 보수적으로 **3초+RTT**, far는 `poll 15초 + snapshot 나이 15초`인 **30초+RTT**를 설계 상한으로 보고 실측한다. 이 hard-expiry 계약을 검증하지 못하면 far 상한은 45초로 늘어나므로 출시 전 수정해야 한다. 정상 공개 시각은 이미 받은 T로 움직여 GET 주기에 종속되지 않는다.
- 무대 중 당김/미룸은 위 bounded staleness 안에서 반영한다. 마지막 1초에 바뀐 시간까지 모든 탭의 시각 효과를 동시에 취소한다는 보장은 하지 않는다. 실제 제목 공개는 항상 DB 상태로 막는다. 지연 중 잘못 시작한 무대는 최신 revision 수신 즉시 부드럽게 철회한다.
- 빠른 전파가 필요하면 **선택적 보완**으로 공개 calendar revision만 보내는 Supabase Broadcast를 붙일 수 있다. raw `postgres_changes`/`broadcast_changes(NEW,OLD)`는 금지. 메시지는 새 상태의 근거가 아니라 재조회 힌트이며 client 위조/중복이 있어도 endpoint throttle을 우회하지 못한다. 접속 수·메시지 요금·권한/보존 검증이 추가되므로 기본안에는 넣지 않는다. DB 시간이 지나는 T 자체는 UPDATE가 아니므로 Broadcast만으로 공개를 완성하지도 못한다.
- 공개 GET 안에서 `settle_teaser_hopes`를 호출하지 않는다. 기존 cron 정산을 유지하고, 필요하면 이미 있는 서버 작업에 cohort당 1회 정산을 결합한다. 이 서버 작업만 기존 권한/서버 helper를 사용한다. 공개 화면은 내용 공개를 정산 완료에 묶지 않는다. 현행 즉시 기대→하트 반영과 달리 정산이 늦어질 수 있으므로 §10에서 허용 지연을 결정한다. 동일 내용을 여러 번 공개하거나 하트를 이중 이전하면 안 된다.

### 5.4 비용 추정과 실행 전 검증

계산 예: 시청자 `V=1,000`, 떡밥 `E=5`, 10분 관람, 그중 near 3분+far 7분. 성공 응답 약 2KB 가정이며 실제 크기/쿼리 시간은 미측정.

| 방식 | HTTP/브라우저 작업 | Supabase 작업 추정 |
|---|---|---|
| 현행 카드별 2초 재시도가 10분 지속되는 실패 상황 | `V × E × 600/2 = 1,500,000` 액션 | 현재 loader 기준 최대 약 3,000,000 SELECT 요청. 공개 결과가 있으면 정산 RPC가 더해짐. 정상 동작이 항상 이만큼 한다는 뜻은 아님. |
| 추천 공용 GET | `V × (180/1 + 420/15) = 208,000` CDN 요청, 약 416MB body 상한 예시 | 전역 shield가 동작하면 `180 + 28 = 208` snapshot refresh. 기존 loader 두 SELECT 유지 시 약 416 요청, 한 read RPC로 묶으면 약 208 RPC. 재시도/쓰기 invalidation은 별도 계상. |
| clock 샘플 | 전경 진입 등 3회 × 각 3샘플 가정 시 9,000 runtime 응답 | **DB 0회**. DB 시각은 위 snapshot refresh에만 포함. |
| 기대 정산 | 브라우저 조회 0회 | cohort별 서버 정산 1회 또는 기존 cron; 관람자 수와 무관. |

- 위 모델은 **DB read polling이 V와 분리됨**을 뜻한다. CDN/함수/KV/네트워크/선택적 WebSocket 비용은 V에 비례할 수 있다. 가격표·nano 처리 가능량을 추정 PASS로 적지 않는다. KV GET·lock 횟수는 CDN MISS 수와 동시 region 수를 함께 측정한다.
- near가 10분 내내 이어지면 최대 약 600 refresh/캘린더. 1Hz가 nano에서 부담이면 중앙 cache TTL을 2초로 늘려 약 300회로 줄이되 전파 지연 계약도 함께 바꾼다. 실측 p95 DB 시간·CPU·잠금 대기·실제 row 수를 보고 확정한다.
- 최소 1/100/1,000 가상 시청자, 다중 서버/region, cold cache·lock 만료·cache 장애·5개 동시 공개를 **stub DB counter**로 검증한다. 동일 시간/변경 수에서 DB counter가 시청자 배수로 늘면 출시하지 않는다. 과정 중 production DB 부하 시험은 수행하지 않는다.
- mutation invalidation 폭주도 합친다. 1초 안 여러 저장은 dirty revision으로 합쳐 다음 refresh 한 번이 최종 상태를 읽고, 새 revision 도착 때문에 직접 DB fallback이 생기지 않게 한다.

외부 기술 확인 자료: [Vercel CDN cache](https://vercel.com/docs/caching/cdn-cache), [Cache-Control 우선순위](https://vercel.com/docs/caching/cache-control-headers)는 캐시 계층 설계 근거다. 이것만으로 이 저장소의 전역 lock을 입증하지 않는다. 원자적 NX·만료 옵션은 [Redis SET](https://redis.io/docs/latest/commands/set/)에 있으며 fencing/안전한 해제는 별도 설계가 필요하다. 선택적 공개 revision 알림의 custom payload는 [Supabase Broadcast](https://supabase.com/docs/guides/realtime/broadcast)를 참고한다. 실제 프로젝트 설정·요금·허용량은 아직 확인하지 않았다.

## 6. 상황별 대응 표

### 6.1 다중 일정 선택 규칙

- **cohort** = 공개 시각 epoch가 정확히 같은 generation 집합. 가장 이른 유효 T가 foreground, 순서는 `T → 공개 sortOrder → id`. 서로 다른 시각을 반올림해 같은 공개로 만들지 않는다.
- **연속 무대** = 다음 T가 직전 T 뒤 15초 안인 cohort들. 이전 결과와 다음 카운트다운을 같은 스크린의 앞/옆 pane으로 연결한다. 각 데이터의 공개는 각자의 실제 T/DB 상태를 따른다.
- 동시 대상 1개는 단독 스크린, 2~3개는 동등 카드 묶음, 4개 이상은 `최초공개 N개`와 읽을 수 있는 목록. 다중 화면을 N개 띄우거나 초대형 글자를 N배 복제하지 않는다. 모바일은 한 컬럼 목록.
- 효과를 나누는 기준과 데이터를 공개하는 기준을 분리한다. 스크린 대기열 때문에 먼저 공개된 내용을 숨겨 놓거나 뒤 일정의 내용을 당겨 공개하지 않는다. 공개된 일정은 즉시 저장소/카드/열린 상세에 반영한다.

| 상황 | 대상·데이터 처리 | 화면·복구 |
|---|---|---|
| 같은 시각 여러 개 | 한 cohort, 한 batch snapshot, 각각 released 상태 확인. 일부만 도착하면 준비된 항목부터 공개하고 미도착 항목만 대기. | 단발 빅뱅 하나. 결과 묶음에 함께 등장, 한 효과·한 접근성 안내. |
| 몇 초 간격 | 각 T는 별도 cohort, 15초 안이면 같은 연속 무대. 이전 응답이 늦어도 다음 cohort의 0초 처리를 막지 않음. | 이전 결과를 작은 결과 pane에 남기고 다음 숫자를 중앙으로. 다음 공개가 1.5초 안이면 큰 빅뱅은 합치고 작은 확장만. |
| 몇 분 간격 | 15초보다 멀면 별도 무대. 두 번째 전주 시점이 이미 지났으면 지난 퇴장 동작 재생 없이 현재 phase로 진입. | 한 차례 완전히 귀환. 집중 화면 90초 상한·30초 휴식 우선. |
| 당김 | 최신 generation/revision으로 전체 계획 재계산. 예전 요청 응답·timer 폐기. T가 이미 지났으면 DB released 확인 경로. | 45초로 당겨졌다면 180초 안무를 압축 재생하지 않고 바로 적정 stage로 300~520ms 연결. 축포 중복 없음. |
| 미룸 | 기존 generation 관람/요청 token 취소. 새 T가 180초 밖이면 idle, 60초 밖이면 현재 phase에 맞춤. | `공개 시각이 바뀌었어요` 한 번. 고조를 순간 폭발시키지 않고 중립으로 풀고 필요하면 귀환. 0초 이후 도착해도 실제 내용은 새 masked 상태를 따른다. |
| 즉시 공개 | `teaser=false`/T≤DB now의 released DTO를 받아 즉시 merge. 현재 본 generation이면 짧은 공개 효과 한 번, 신규/복귀 방문이면 조용히 교체. | 카운트다운을 억지로 10초 더 세지 않음. 내용 확인 후 결과 화면으로. |
| 삭제·공개 범위 철회 | 완전한 서버 응답의 gone만 믿음. 해당 id/generation 제거, 실패는 삭제로 취급하지 않음. | 다른 대상이 있으면 핸드오프, 없으면 `공개 예정이 변경됐어요` 후 귀환. 제목·삭제 이유·비공개 새 상태를 말하지 않음. |
| 0초 데이터 지연 | T에서 효과권만 소비. 공개 확인 전은 masked 유지. backoff·revision 검사. 5초 이후 무대 반환, 카드는 의미 있는 대기+재시도. | 늦게 도착한 제목에 두 번째 빅뱅 없음. 빈 일반 카드/무한 spinner/계속 잠긴 화면 없음. |
| 숨김 탭 복귀 | hidden 때 watched 자격·effect 예약 취소. visible/pageshow에서 동기화 후 phase 도출. | 지나간 초/축포 몰아 재생 없음. 이미 공개됐으면 조용히 교체. 아직 미래 T면 현 phase로 재참여. |
| 늦게 들어온 사람 | T 이전이면 현재 남은 시간으로 참여. T 이후 초기 snapshot이면 missed 처리, celebrate하지 않음. | 20초 전 입장은 짧게 스크린 진입. 공개 후 입장은 기존 일정+작은 `방금 공개` 표시만. |
| 다른 달 보는 중 | entry의 공개용 날짜 범위와 viewed month가 겹치는 것만 전체 무대 후보. T의 달만으로 판단하지 않음. | 강제 월 이동 없음. 다른 달 공개는 작은 배너 `다른 달에서 최초공개`+선택적 이동만. 이동을 눌러도 실제 제목은 released일 때만. |
| 대상 팝오버 열린 중 | 같은 presenter/clock/데이터를 stage 표시권으로 승격. 기존 overlay history를 유지하며 중복 dialog를 만들지 않음. | 기존 상세가 스크린으로 이어짐. 종료 시 최신 상세로 복귀, 뒤로 가기는 한 단계씩 정상 작동. |
| 다른 팝오버·설정·모달 열린 중 | 월 피커·검색 입력·VOD/인사이트·설정·gift/gacha 등 기존 overlay를 강제로 닫지 않음. 강한 overlay가 있으면 stage 효과권 보류. | 상단 overlay 위에 무대를 얹지 않고 작은 안내만. 닫았을 때 T 이전이면 현재 phase, T 이후면 조용한 결과 안내. 영상/오디오를 중단하지 않음. |
| 연속 변경/응답 역전 | dirty revision 합치기, 최신 `(revision,snapshotSeq,generation)`만 적용. props 변화도 같은 reconcile로 수렴. | 당김→미룸→삭제를 빠르게 해도 오래된 화면이 재등장하지 않음. |
| 다시 떡밥으로 숨김 | 새 generation의 masked DTO로 기존 메모리/표시권을 교체하고 공개 화면에서 옛 내용을 제거. | 이미 전달된 공개 내용의 회수는 불가능하다. 재가림은 향후 노출을 막는 것으로 정의하고 이를 보안상 완전한 회수라고 주장하지 않음. |
| 무대 종료/월 변경/뒤로 가기 | 해당 연속 무대 skip token, 현재 요청 결과는 공개 저장소 갱신에만 사용. route 이탈은 전부 cleanup. | `Esc`/`일정표 보기` 즉시 귀환. 동일 generation 때문에 다시 납치되지 않음. |

`visible`만으로 관람 자격을 주지 않는다. coordinator가 해당 generation의 카운터/스크린을 실제 표시한 상태에서 T를 가로질렀는지 기록한다. `(eventId,generation)`별 **효과 시작 여부**와 **내용 적용 여부**를 별도로 저장해 네트워크 응답 경로가 달라도 한 번만 축하한다.

## 7. 추가 아이디어

- **무대 인사:** 데뷔 안내가 가장 먼저 보라 별을 하나 던지고, 마지막 귀환 때 그 별을 받아 제자리로 돌아온다. 원인→결과가 보이는 작은 연결 동작. 새 마스코트/생성 아트 없이 SVG/기존 도형으로 구현.
- **계절 커튼:** 봄 꽃잎·여름 물방울 모양·가을 잎·겨울 눈결정 중 몇 개만 스크린 테두리로 모인다. 실제 계절 canvas를 움직이거나 새 날씨를 만들지 않는다. 모바일/배경 OFF에서는 생략 가능.
- **필름 선반:** 연속 공개 결과를 스크린 가장자리의 작은 공개 완료 카드로 남긴다. 모두 실제로 공개된 DTO만 사용. 다음 숫자를 가리지 않으며 종료 후 일정표의 원래 자리로 연결된다.
- **내 기대의 귀환:** 이미 존재하는 기대 표시가 공개 후 하트로 이어지는 순간을 작은 한 번의 효과로 표현. 익명 기대 수/집계만 사용하고 누른 사람 목록·동접·시청자 개인 식별은 표시하지 않는다. 정산 지연이면 완료를 선행 연출하지 않는다.
- **무대 다시 보기 대신 결과 확인:** 공개를 놓친 사람에게 전체 카운트다운을 재연하지 않고, 공개된 결과 묶음을 여는 작은 버튼만 제공. 로컬 관람 기록은 id/generation/시각만 최소 보관하며 title/body 저장은 피한다.

위 아이디어는 핵심 동기화·안전·성능이 통과한 뒤 선택 구현한다. 새 asset 생성이나 일러스트 발주는 이 계획의 필수 조건이 아니다.

## 8. 접근성·안전

### 8.1 움직임·그래픽·모바일

| 조건 | 처리 |
|---|---|
| 앱 `html[data-reduce-motion]` | 퇴장/FLIP/화면 흔들림/입자/스크램블/시각 writer를 즉시 중지. **전체 자동 무대 대신** 기존 카드+정적 공개 임박 안내/큰 숫자. 사용자가 결과 스크린을 열어도 전환은 즉시. 설정 토글 중간 변경도 cleanup 검증. |
| gfx full | 한 stage writer, 제한된 SVG/DOM 효과. 배경 상태는 기존 설정 준수. |
| gfx lite | 입자 기본안 8개 이하, 궤도 1개, 행/상자 단위 퇴장. 레이어 수 감축. |
| gfx soft/off | 장식 입자·후광·큰 퇴장 이동 없음. 읽기 가능한 단순 스크린+opacity 전환. gfx OFF는 배경 효과 OFF라는 기존 의미를 보존하며 내용/카운트다운까지 숨기지 않음. |
| 모바일/짧은 landscape agenda | topology는 `POSTER_AGENDA_QUERY`, engine mount 금지는 기존 `MOBILE_QUERY` 사용. ambient canvas 새 mount/요청 0. 작은 세로 스크린, safe-area/visualViewport/큰 글자 대응. |
| hidden/offline/unmount | 효과·sound/haptic 예약·timer/observer 정리. 복귀는 동기화부터. |

### 8.2 조작·읽기

- `일정표 보기`/닫기/Esc를 항상 제공한다. 2~3분 동안 조작을 강제로 막지 않는다. 집중 상태에서 나머지 페이지를 inert로 만들 때만 한 modal focus scope를 사용하고, 전주에는 dialog/focus trap을 열지 않는다.
- 갑작스러운 focus 이동은 피한다. 입력/다른 modal이 활성일 때 무대는 보류한다. 자동 집중 시작은 사용 중인 element가 안전하게 전환 가능한 경우에만 진행하고, 종료 시 여전히 존재하는 원래 대상/월 헤더로 복귀한다. 뒤로 가기는 기존 `pushInnerOverlay`/`popInnerOverlay`의 순서를 계승한다.
- 스크린리더 카운터는 매초 live 발화하지 않는다. 진입/60/10/공개/변경 정도만 polite 안내. visual 난수는 aria-hidden, released 제목 완성본은 한 번만 전달한다. 소리·색만으로 상태를 구별하지 않는다.
- normal text 대비 최소 4.5:1, 큰 글자 3:1, 조작/포커스 경계 3:1을 실제 합성 배경에서 측정한다. 장식 glow는 대비 근거가 아니다. 터치 타깃은 기존 규칙을 계승하고 안전 버튼은 최소 44px.
- 200% 확대·긴 제목·태그 다수·폰트 변경·눈 편한 테마·화면 회전에도 닫기와 본문이 겹치지 않게 검증한다. horizontal overflow 0. 스크린 내부에만 필요한 읽기 스크롤 허용.

### 8.3 섬광·소리·햅틱

- 소유자 요구는 **초당 3회 미만**, 즉 임의의 1초 창에서 합성 고대비 섬광 **최대 2회**다. 기존 `lib/ui/hype-curve.ts:133` 주석의 “박동 최대 2+공개 1=3 허용”보다 이번 요구가 엄격하다. 그 합산을 새 전체 화면에 그대로 적용하지 않는다. 기존 곡선/박자 수식은 유지하되 밝기 변조 채널을 제한한다.
- 반복 화면 flash/whiteout/빨강 flash 금지. 주 고조는 이동/scale. 빅뱅은 최소 600~800ms 단발, 큰 광량 효과 사이 최소 1.5초, 전후 1초는 카드·팝오버 기존 고대비 pulse/축포를 억제해 합산 예산을 보장한다. 동시·근접 공개는 효과 한 번으로 합친다.
- ScrambleText의 잦은 글자 교체는 자동으로 안전 판정하지 않는다. 고정 ink·배경·제한 면적으로 사용하고 화면 전체 녹화에서 검수한다. 기준을 못 맞추면 같은 공용 부품에 단순 해독/즉시 완성 옵션을 사용한다.
- 새 소리는 `playSfx`의 기존 celebrate 범주, haptic은 기존 모듈을 통한다. 기본안은 **확인된 실제 공개 순간 한 번만**. 전주/카운트다운 자동 효과음·지속 진동은 추가하지 않는다. master/category/volume/hidden-tab 설정, 브라우저의 오디오 활성화 조건을 보존하고 임의 autoplay unlock을 하지 않는다.
- full/lite/soft·동시/1초 간격 공개·카드+팝오버+stage 합성 영상을 슬라이딩 1초 분석/사용 가능한 광과민성 검사 도구로 확인한다. 도구 부재 시 정량 검증 NOT VERIFIED로 남기며 release gate를 통과했다고 쓰지 않는다.

### 8.4 정보 경계 검증

공개 전 synthetic canary 제목·본문·태그/태그색·실제 시간·support URL·owner_private·이메일을 준비한다. HTML/RSC/JSON/network/cache/DOM/aria/style/CSS 변수/로그에서 0건을 확인한다. 동일 검사를 익명/unauthorized/로그인 viewer/서버 공개 미리보기에 적용한다. 검사용 민감값은 synthetic만 사용하고 실제 개인정보를 보고서/fixture에 복사하지 않는다. registry는 활성 예약 동안 최소 metadata만 유지하고 공개/취소 24시간 뒤 정리한다. 브라우저 효과 기록은 메모리 기본·필요하면 sessionStorage 24시간 TTL; 둘 다 사용자/계정 식별 연결 금지. 외부 CDN/KV/provider 로그의 보존·삭제 설정은 별도 확인 항목이다.

## 9. 파일 구조와 기존 코드 연결 지점

신규 이름은 제안이다. 실제 구현 전 폴더 지침·가까운 공용 API를 다시 확인한다. 표의 추가/변경은 **미래 구현 범위**이지 이번 변경 목록이 아니다.

| 파일 | 역할·기존 연결 |
|---|---|
| `lib/ui/teaser-premiere.ts` (신규) | 순수 phase/cohort/연속 공개/90초 예산/revision reducer. DOM·네트워크 없음. 기존 hype 함수 호출. |
| `lib/ui/use-teaser-premiere.ts` (신규) | 한 coordinator. 공개 store/reconcile, 요청 합치기, 관람/효과권, visible/overlay/월 eligibility, cleanup. |
| `lib/ui/synced-clock.ts` (신규) | 외부 store 형태의 epoch/monotonic clock, 오차/샘플 나이. clock transport 교체 가능. |
| `lib/ui/use-remain-seconds.ts` | 공용 clock 연결. ceil·null/하이드레이션 의미 보존. 공용 큰 카운터와 편집실 gate까지 같은 방식. |
| `components/shared/teaser-countdown.tsx`, `components/shared/teaser-stage-content.tsx` (추출) | 기존 큰 카운터·`.dt-count` 링/숫자/라벨·ScrambleText/secondary reveal를 공용 presenter로 정리. 카드/상세/stage에 세 번째 독립 수식 금지. |
| `components/poster/teaser-premiere-stage.tsx`, `.css` (신규) | portal, scrim, motion shell registry, 스크린, 안전 컨트롤. 공유 spring/text/radius/elevation/teaser/glass token 사용. |
| `components/poster/public-poster.tsx`, `.css` | `:1053` 공개 cache, `:1093` mount-sync, `:1657` reveal, `:1805` writer를 coordinator로 통합. PC `:3456`, agenda `:4017`, 상세 `:4544`는 동일 resolver/presenter. `:4884` 링 추출. `:1695` 카드/상세 축포와 stage 효과권 중복 제거. |
| `lib/ui/hype-curve.ts`, `flip-motion.ts` | 기존 함수·위상·spring 재사용. 장면 이동은 기존 카드 클릭 타깃 고정 정책의 **표면 밖 전용 표현**으로 구현. 원본 클릭 박스 정책은 바꾸지 않음. |
| `lib/ui/ambient-pause.ts`, `components/shared/ambient/ambient-layer.tsx`, `app/ambient.css` | scoped wrapper 퇴장·고유 pause holder 연결만. world/scene simulation·계절 판정·mobile gate 변경 없음. |
| `lib/ui/gfx.ts`, `motion.ts`, `haptics.ts`, `sfx.ts`, `overlay-pop.ts` | 기존 설정 읽기/구독·효과 잠금·overlay stack 통합. `gfx.ts`의 옛 root filter 주석을 새 설계 근거로 쓰지 않음. |
| `lib/schedules/public-loader.ts` | 공개 상태 builder 추가. 기존 anon client/마스킹 경계/명시 DTO/mapEvent 재사용, DB 판정 envelope 우선. 전체 300초 캐시는 유지. |
| `lib/schedules/teaser-reconcile.ts`, `teaser-actions.ts` | 실패/없음 구별 보존, generation/coverage adapter. 시청자 카드별 액션 재시도는 통합 경로로 옮김. admin 정산 helper가 공개 route dependency로 유입되지 않게 분리. |
| `lib/schedules/event-actions.ts`, `cache.ts` | 기존 owner/developer 권한·serialized write·keepalive 그대로. 공개 예약 mutation의 revision/registry/cache invalidation 연결. unrelated save로 무대 버튼을 막지 않음. |
| `app/api/public/[calendarSlug]/teaser-state/route.ts` (신규) | explicit DTO GET; public-loader만 import. 고정 cache key·CDN header·오류/Retry-After. API 확장은 ADR에서 공개 목적·필드·기존 계약과의 호환성 기록 후 구현. |
| `app/api/public/clock/route.ts` (신규 제안) | 인증/DB/개인정보 없는 no-store clock 샘플. 일반 일정 DTO에 서버 시각을 섞어 캐시를 오염시키지 않음. |
| `lib/schedules/teaser-state-cache.ts` (신규 server-only) | 공용 저장소·single-flight·fencing·breaker. public read client만 연결; service-role API와 분리. 외부 연결 토큰은 서버 환경에만. |
| `db/migrations/<다음번호>_public_teaser_state.sql` (후속 제안) | 실제 다음 번호 확인 후 registry/revision·public read envelope·명시 grants 준비. 0138은 역사 migration으로 수정하지 않음. 마이그레이션 적용은 이 문서 작성에 포함되지 않음. |
| `app/page.tsx`, `components/studio/studio-shell.tsx:7002`, `:7065` | 공개/비로그인/preview entry의 공용 구현 연결 확인. 미리보기는 기존 서버 sanitized snapshot만, 낙관적 studio event 재가공 금지. |
| `app/visual-fixture/poster/page.tsx`, `tests/visual/teaser-*.spec.ts` | 시나리오 fixture·mock 상태/clock transport 추가. production fixture gate 유지. |
| `tests/unit/teaser-premiere.test.ts`, `synced-clock.test.ts`, 기존 `hype-curve`, `teaser-reconcile`, `teaser-celebrate`, `public-dto`, `public-cache-revalidate` | phase/응답 순서·clock 도약·단일 효과·정보 경계·변경 무효화 검증. |
| `tests/visual/teaser-premiere.spec.ts`, `tests/e2e/teaser-public-boundary.spec.ts` (신규 제안) | 실제 shared component의 렌더·조작·성공 공개·leakage·네트워크 요청 상한. DB는 stub. |

현재 규칙의 대체/확장 범위도 구현 ADR에 적는다. 옛 motion 계획의 “원본 카드 박스 고정”은 유지하고 표면 밖 stage로만 확장한다. 옛 “보정된 now·공유 scheduler”는 설계 의도이며 현재 구현 완료 증거가 아니므로 이번에 실제 연결한다. 기존 flash 최대 3 허용 설명은 이번 요구의 `<3` 합산 예산으로 강화한다. retired sticker/개인 레이어/보조 역할은 복구하지 않는다.

## 10. 소유자가 결정할 질문 목록

문서 검토용 질문이다. 이번 계획 작성은 답을 기다리지 않고 완료한다. 무응답을 구현/인프라 변경 승인으로 해석하지 않는다.

| 질문 | 추천안 | 선택 영향 |
|---|---|---|
| 자동 전주 시작은 2분인가 3분인가? | **180초 시작**, 일반 일정은 76초 전까지 읽기 가능. 집중 화면은 68초부터. | 분위기는 일찍 시작하되 장시간 화면 점유 감소. |
| 화면 전체 연출 기본 참여 범위는? | `/`의 로그인/비로그인·viewer preview 공통 ON. 일반 studio 편집 OFF. `/onair`는 같은 구현, 기본 OFF 후 방송 실물 검토. | 방송용 고정 화면의 예상치 못한 전환 방지. |
| 동시 여러 떡밥을 어떻게 보여줄까? | 같은 T는 한 묶음, 2~3개 동등 배치, 4개 이상 목록. | 한 명만 주인공으로 보이는 임의 우선순위 방지. |
| 근접 공개를 한 무대로 잇는 간격은? | 15초 이하. 집중 상태 최대 90초, 종료 후 30초 휴식. | 긴 연쇄가 시청자 화면을 계속 가리는 문제 제한. |
| 다른 달 공개도 강제로 무대 전환할까? | 강제 이동 없음. 작은 안내+선택 이동. | 지금 읽는 달과 계절 맥락 유지. |
| 공개 시각 수정 전파 지연을 어디까지 허용할까? | near 약 3초+RTT 계약부터. 마지막 1초 수정은 효과까지 완전 동시 취소 불가를 수용. 더 빠른 목표면 safe revision Broadcast 추가 검토. | 연결 수/메시지 비용·보안 설정 범위가 달라짐. |
| 공용 분산 cache 리소스를 추가할까? | 기존 인프라의 전역 상한을 M0에서 검증, 부족하면 소규모 shared KV 사용. 증명 전 per-viewer DB fallback 없이 기능 OFF. | nano 보호의 필수 조건. 신규 운영 리소스/비용 결정 필요. |
| 기대→하트 정산 지연은 허용할까? | 내용 공개는 즉시, 정산은 기존 서버 작업으로 eventual. 수분 지연이 싫으면 별도 공용 1회 정산 작업을 같은 release 범위에 포함. | 기존 시청자별 정산 RPC 제거와 즉시 하트 반영 사이 절충. |
| 0초 응답 지연 시 얼마나 기다릴까? | 5초 후 일정표 반환, 같은 공개 카드에서 안전하게 재시도. | 짧은 장애가 전체 화면 점유로 이어지는 것 방지. |
| 빅뱅의 강도·색·소리는? | 보라/은백 단발 확장, 전면 whiteout 없음. sound/haptic은 실제 공개 확인 때 기존 celebrate 한 번. | 귀여운 분위기·섬광 안전·방송 오디오 설정 보존. |
| 사용자가 연출을 끌 범위는? | 항상 `일정표 보기`, 동일 연속 무대 재진입 금지. 지속 설정이 필요하면 기존 공유 Settings 목록에 하나만 추가. | 새 설정 화면/계정별 권한 분기 만들지 않음. |
| 긴 제목 해독 시간과 결과 체류는? | 해독 최대 1.8초, 기본 읽기 4~6초, `더 보기`/닫기 가능. | 해독이 본문 읽기를 오래 막지 않음. |
| reduce-motion에도 자동 화면 점유를 할까? | 하지 않음. 정적 카운터와 공개 결과 안내만 기본. | 모션을 줄인 사용자의 예측 가능성 우선. |

## 11. 마일스톤과 각 단계의 검증 방법

각 단계는 선행 계약을 검증한 뒤 다음으로 간다. 구현 착수 때만 ACTIVE_PLAN/해당 ADR·topic 상태를 갱신한다. 이번에는 별도 계획 문서만 요청받았으므로 CURRENT_STATE/ACTIVE_PLAN/기존 계획은 변경하지 않는다.

| 단계 | 산출물 | 검증·통과 기준 |
|---|---|---|
| M0 · 경계/비용 설계 확정 | 공개 DTO/registry/grants ADR, cache 계층·단일 coordinator 설계, §10 수치 결정 | anon public-view 조회 + DB/app clock skew 사례 검토. mock 1/100/1,000 viewer·다중 인스턴스에서 DB refresh 상한 고정. raw realtime·private helper 유입 0. 공용 캐시 실패 시 direct DB fallback 0. 미입증 인프라는 NOT VERIFIED. |
| M1 · clock/공개 상태 기반 | synced clock, 공개 상태 GET, DB 판정·revision·snapshotSeq·coverage, 기존 reconcile adapter | pure unit tests에 ±5분 PC skew, OS 시각 점프, RTT 편차, 큰 offset, 같은 revision의 T 경과, 역순 응답, 즉시 공개/삭제/재가림. mock transport로 backoff·단일 in-flight·오류≠gone. synthetic canary leakage 0. |
| M2 · 다중 coordinator | phase/cohort/chain/skip/watch/effect reducer | §6 모든 행을 의미 있는 상태 전이 테스트로 검증. 동시 5개, 1/3/10/15/16/120초 간격, 당김→미룸→삭제, 새 generation, 90초 제한. 각 generation 데이터 공개 횟수/효과권 한 번, 0초 지연에서 이전 결과가 다음 T를 막지 않음. |
| M3 · 공용 presenter/overlay | 기존 dt-count/ScrambleText 추출, 표면 밖 stage, FLIP/return | fixture의 실제 component로 같은 DTO의 1840 offsetWidth/행 높이/원본 slot 전후 불변. 실제 공개 내용으로 정상 reflow가 생기면 동일 공개 DTO의 무대 OFF 기준과 비교한다. 미공개 내용을 미리 넣어 높이를 예약하지 않는다. 폰트 준비 뒤 측정. caption↔ring 겹침 0, 숫자 자릿수 변경 중심 오차 ≤1px. 중간 resize/월 이동/필터·패널 변경/애니메이션 cancel 후 잔여 inline transform·inert·holder 0. |
| M4 · PC 안무 | 영역 ref, 퇴장/귀환, dark/build/eye/ignition | 1920×1080, 1440×900, 1280×720 및 실제 topology 경계. 181/180/150/120/90/76/68/66/60/30/11.8/10/3/1/0초·지연·귀환 프레임 캡처/육안. 스크린 외 전역 filter 0, steady layout read 없음, 10Hz writer 1개 이하. |
| M5 · agenda/접근성/충돌 | 세로 screen, 안전 버튼, motion/gfx degrade, overlay 통합 | 390/360px, 844×390 coarse landscape, 200% zoom, 긴 제목/태그 다수. canvas mount/ambient art 요청 0, 가로 넘침 0. 키보드/Esc/뒤로/포커스 복귀/스크린리더 안내·영상 modal 우선권. reduce-motion 중간 ON 시 running animation·시각 loop 0. |
| M6 · 공개/비로그인/preview 회귀 | 한 구현의 성공 공개·갱신 시나리오 | `/`, anonymous, server-sanitized preview fixture 모두 동일 시나리오. 실제 로그인/RLS 검사는 synthetic canary로 별도 수행하며 fixture 성공을 그 증거로 대체하지 않음. public-dto·teaser-reconcile·celebrate·cache-revalidate 기존 검사 유지. |
| M7 · 성능·안전·출시 준비 | 공용 요청 부하 기록, 합성 영상 섬광 검수, 종료 스위치·rollout 문서 | production build fixture 기반 full/lite/soft/모바일 측정. 기본 목표 full PC p95 frame ≤20ms, lite ≤33ms, stage 유발 long task >50ms 없음; 기기별 실제 수치 기록. 임의 1초 flash ≤2, 중복 sound/haptic 0. typecheck/lint/relevant unit/e2e/visual/build 실제 exit 확인. |

### 11.1 fixture 운영 방식

- `VISUAL_TEST_FIXTURE=1` 게이트 안에서만 multi/clock-offset/latency/failure/revision-change 시나리오를 노출한다. 일반 실행은 서버·클라이언트 동일 기준 시각과 짧은 실제 countdown을 사용한다. **브라우저 `page.clock`으로 서버 시계와 따로 시간을 바꾸지 않는다** (`tests/AGENTS.md:16`).
- 180초 전체를 반복 대기할 필요는 없다. 순수 reducer는 injected now로 전 구간 검사, 시각 샘플은 서버와 클라이언트가 같은 fixture timeline을 받아 렌더한다. 동작 통합은 실제 3~15초 countdown으로 성공 응답·타이밍 변경·hide/show를 검증하고, 한 번의 전체 전주 녹화를 추가한다. 초기 HTML/RSC와 hydration 시각이 어긋나지 않게 한다.
- 현행 테스트의 옛 수식 복제/DOM 주입은 component 배선 검증의 대체물이 아니다. 정본 함수를 호출하는 테스트 transport와 공용 presenter를 사용하되, 기존 정보 경계 테스트를 삭제/약화하지 않는다.
- local analytics는 `lib/analytics/guard.ts`를 경유하며 외부 live state/API도 stub. 실제 달력의 현재/미래 달에 시험 데이터를 만들지 않는다. 이번 계획 단계의 DB 쓰기는 0회.
- 향후 실제 DB 테스트가 따로 필요하면 기존 과거 달 fixture + `[통합테스트]` + afterAll 물리 삭제 + 잔여 0 확인만 사용한다. service-role actor fixture는 genuine login/RLS 증거가 아니다. migration grant/RLS는 anon·unauthorized 세션으로 별도 확인한다.

### 11.2 이번 문서의 검증 상태

- 완료: 지정 규칙·현재 brief·관련 코드/fixture/테스트·과거 motion 계획의 필요한 부분 조사. 구현 완료나 운영 재현으로 간주하지 않는다.
- `npm run test -- tests/unit/agent-memory.test.ts tests/unit/rule-migration.test.ts`: **PASS**, 2개 파일·43개 테스트, exit 0.
- `npm run harness:verify`: **FAIL**, exit 1. 기존 `RULE_MIGRATION`의 active rule ID hash/inventory가 현행 규칙 목록과 다르다는 2개 오류. validator의 입력은 `AGENTS.md`, `docs/ux/UI_RULES.md`, `docs/ambient/ENGINE_RULES.md`, `docs/ambient/ART_RULES.md`이며 이 문서는 그 목록에 없다. 해당 기존 파일/규칙 이관 기록은 이번 작업에서 변경하지 않았다. 범위 밖 기록을 자동 수정하지 않는다.
- 문서 자체 검사: **PASS**. 0~12 순서, 구체적 file:line 31개 존재/범위, UTF-8, 표 열 수 일관성 확인. 로컬 Markdown 링크는 0개이며 코드 위치는 저장소 상대 경로로 적었다. 제품 typecheck/lint/build/visual은 코드 미변경이라 이번 범위에서 실행하지 않았다.
- 인프라 보유/과금·실제 로그인/RLS·배포·실기기 성능·섬광 정량 검사는 모두 **NOT VERIFIED**. 구현 release gate에서 확인한다.

## 12. 위험

| 위험 | 영향 | 대응·남는 한계 |
|---|---|---|
| 공개 전 내용/개인정보가 cache·preview·clone에 섞임 | 최상위 경계 위반 | DB masking+명시 DTO+read-only route+synthetic canary. 공개 UI에 raw studio/NEW/OLD 이벤트 전달 금지. 외부 provider 보존 설정 별도 확인. |
| 앱·DB·브라우저 시계 혼동 | 빠른 0초·빈 공개본·잘못된 축하 | DB 상태를 권한 정본으로, 단조 clock은 연출용. 불확실하면 masked 대기. 네트워크 지연 때문에 모든 시청자가 T에 실제 내용을 동시에 보는 절대 보장은 불가. |
| mutation 전파 지연·최후 순간 변경 | 철회된 공개에 효과가 잠깐 시작됨 | bounded staleness·revision·짧은 TTL·선택적 safe hint. 최신 정보 수신 즉시 철회. 공개 후 회수는 이미 받은 정보를 되돌릴 수 없음. |
| CDN만 믿어 DB 요청 폭주 | nano 연결/CPU·정산 비용 고갈 | 전역 cache/원자 lock+fencing 필수, 요청 key 고정. 실패 때 DB 우회 없음. 실제 배포 계약 미확인 상태에서는 기능 OFF. |
| registry/분산 cache가 과한 복잡성 | 운영 리소스·회복 경로 증가 | UI와 transport 분리, 작은 metadata/24시간 retention, 기존 인프라 재사용 우선. nano 보호를 증명할 수 없는 단순화는 채택하지 않음. |
| 기대→하트 즉시성 회귀 | 공개 직후 하트가 늦게 보임 | 내용 공개와 분리, 서버 단발 정산 선택. 기존 cron 보장 범위와 지연을 사용자 결정에 명시. |
| 다중 공개/긴 chain의 독점 | 일반 일정 사용 불가 | cohort/15초 chain/90초 집중 상한/항상 종료/30초 휴식. 데이터 공개는 어떤 화면 예산에도 지연시키지 않음. |
| 새 stage가 기존 transform/overlay와 경쟁 | 튐·포커스 잠김·뒤로 가기 오작동 | 전용 motion shell·viewport portal·기존 overlay primitive·현 rect 복귀. 영상/설정 등 활성 modal을 우선. |
| 1840 표면/agenda 기하 회귀 | 포스터·미리보기 불일치 | 원본 slot 유지, 표면 geometry assertion, 실제 topology 분기. 오래된 sticker 주석은 기능 복구 근거로 사용하지 않음. |
| 섬광/멱등 effect/오디오 중복 | 광과민성·방송 방해 | 전역 effect budget·단발·합성 녹화·앱 설정 준수. 스크린뿐 아니라 카드/팝오버 동시 출력까지 검사. |
| 모바일 GPU·배터리·큰 DOM layer | 프레임 저하·메모리 증가 | canvas 없음, 가시 그룹만, layer/particle cap, full/lite/soft degrade, hidden 정지. 실제 Safari/저사양 Android 측정 전 성능 보장 없음. |
| 과거 문서·현재 state의 불일치 | 미구현 시계/배포를 완료로 오인 | 조사 근거와 제안을 구별. CURRENT_STATE의 TEASER-RING 운영 확인은 이번 문서가 닫지 않음. 기존 owner 선택/미추적 파일 보존. |

복구는 전체 무대 feature switch OFF → 기존 카드/상세 presenter로 돌아가는 방식이다. 새로운 단일 상태/시계·공개 경계가 유효하면 유지하고 장식 stage만 끌 수 있게 분리한다. 새 인프라 장애 때 기존의 시청자별 무제한 공개 polling으로 되돌아가는 자동 fallback은 두지 않는다.
