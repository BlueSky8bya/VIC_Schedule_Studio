# 애플 HCI 벤치마크 리서치 — 조화·몰입·재미 3×3 프레임

> 작성: 2026-07-29 · 대상: VIC Schedule Studio (공개 포스터 / 스튜디오 편집기 / 꾸미기·내보내기)
> 성격: **리서치 보고서 — 코드 변경 없음.** 적용 후보는 별도 작업으로 진행한다.

---

## 요약

애플의 인터페이스가 "잘 만들었다"는 인상을 주는 이유는 크게 세 덩어리로 정리된다.

1. **조화** — 시스템 전체가 하나의 재질·간격·타이포·색 문법을 공유한다. 개별 화면이 아니라
   "재질 시스템"을 설계하고, 모든 화면이 그 시스템의 인스턴스가 된다.
2. **몰입** — 애니메이션이 "재생되는 영상"이 아니라 "만질 수 있는 물체"다. 스프링 물리 기반,
   언제든 중단·방향전환 가능, 제스처와 애니메이션이 하나의 연속체다.
3. **재미** — 물리적으로 과장된 바운스, 햅틱, 보상 순간을 **드물고 의미 있는 곳에만** 배치해
   차가운 도구가 아니라 살아있는 대상처럼 느끼게 한다.

VIC의 기존 철학(몰입 우선, 디자인 통일, 모바일 2-레이아웃, `hapticTick()`,
`html[data-reduce-motion]`)과 정합성이 높으며, 웹에서 대부분 CSS `linear()` 스프링 이징 +
transform 전용 애니메이션 + FLIP으로 재현 가능하다. 본문 끝에 우선순위가 매겨진 적용 후보
12건을 제시한다.

---

## 방법(출처)

- Apple Human Interface Guidelines (developer.apple.com/design) — Motion, Materials,
  Color, Typography, Layout 항목의 공지 원칙.
- WWDC18 "Designing Fluid Interfaces" (session 803) 및 해설 글(Nathan Gitter
  "Building Fluid Interfaces", uxdesign.cc "Fluid Interfaces").
- WWDC23 "Animate with springs" — perceptual duration / bounce 파라미터 체계.
- 스프링 파라미터·웹 재현 자료: Josh W. Comeau "Springs and Bounces in Native CSS",
  pqina.nl / kvin.me CSS 스프링 생성기, Chrome for Developers `linear()` 문서.
- 러버밴딩 수식: UIScrollView 분석 글(Ilya Lobanov, Arkadiusz Holko).
- 코너 동심(concentric radius): arun.is "Apple rounded corners", iOS 26
  `ConcentricRectangle` 관련 자료.
- 전체 URL은 마지막 절 "출처 목록" 참조. HIG 원문 페이지는 SPA라 일부는 요약 자료로 대체 확인.

---

## 1부 — 조화(Harmony)의 3요소

### 1-1. 재질(Materials): 반투명·비브런시로 만드는 "한 장의 공간"

**(a) 애플이 하는 것.** iOS/macOS의 사이드바·탭바·시트·알림은 불투명 패널이 아니라
블러+틴트 조합의 **시스템 재질**(ultraThin/thin/regular/thick)이다. 뒤 콘텐츠가 비쳐
보이므로 레이어가 쌓여도 "다른 화면으로 이동"이 아니라 "같은 공간 위에 유리를 얹은" 느낌이
된다. 재질 위 텍스트는 비브런시(뒤 배경색을 표본화해 대비를 끌어올림)로 가독성을 지킨다.

**(b) 규칙.** 재질은 장식이 아니라 **위계 표현 수단**이다. 두꺼운 재질 = 전경성이 강함.
재질 위 콘텐츠는 반드시 비브런시 계열 색(순수 흑/백이 아닌 반투명 라벨 색)을 쓰고,
라이트/다크 각각에서 가독성을 검증한다. 재질 뒤 콘텐츠가 산만하면 블러 강도를 올린다.

**(c) 웹 구현.**
- `backdrop-filter: blur(20px) saturate(180%)` + 반투명 배경색(예:
  `rgb(255 255 255 / 72%)` 라이트, `rgb(28 28 30 / 72%)` 다크).
- 비브런시 근사: 재질 위 보조 텍스트를 `color: rgb(60 60 67 / 60%)`처럼 반투명 라벨로.
- 성능: blur 반경을 20px 내외로 제한하고, 재질 요소에 `will-change` 남발 금지.
  Safari는 `-webkit-backdrop-filter` 병기.
- 폴백: `@supports not (backdrop-filter: blur(1px))`에서 불투명 배경으로.

**(d) VIC 적용 후보.** 스튜디오 상단 셸/툴바, 이벤트 상세 시트, 모바일 바텀시트를
토큰화된 재질(`--material-regular` 같은 신규 토큰)로 통일. 공개 포스터의 월 내비 바도 후보.
단, **export surface 안에는 재질 요소를 넣지 않는다**(캡처 시 blur 배경이 고정되어 어색).

### 1-2. 간격·타이포 리듬: 8pt 그리드와 다이내믹 타입의 "박자"

**(a) 애플이 하는 것.** 모든 간격이 8pt(보조 4pt) 배수로 정렬되고, 타이포는 SF Pro의
역할 기반 스케일(LargeTitle 34 / Title1 28 / Title2 22 / Title3 20 / Body 17 /
Subhead 15 / Footnote 13 / Caption 12·11)을 쓴다. 크기가 아니라 **역할**로 스타일을
지정하므로 화면이 달라도 위계 문법이 같다. Dynamic Type은 사용자가 본문 크기를 키우면
전체 스케일이 비례해 따라온다 — 개별 요소가 아니라 스케일 전체가 움직인다.

**(b) 규칙.** 텍스트 스타일 개수를 소수(6~9개)로 고정하고, 임의 px를 새로 만들지 않는다.
행간·자간도 스타일에 귀속. 옵티컬 사이즈: 큰 제목은 자간을 살짝 좁히고(-1~2%), 캡션은
살짝 벌린다.

**(c) 웹 구현.** `:root`에 `--text-title/--text-body/--text-caption` 등 역할형 폰트
토큰 + `clamp()` 또는 미디어쿼리로 웹/모바일 두 값. `letter-spacing`도 토큰에 포함.
줄바꿈 리듬은 `text-wrap: balance`(제목), `pretty`(본문)로 보강.

**(d) VIC 적용 후보.** VIC은 이미 `--space-1..6`(4/8/12/16/24/32)을 갖고 있어 간격은
합격점. 부족한 축은 **타이포 토큰** — 현재 컴포넌트별 px 지정이 흩어져 있을 가능성이 높다.
`app/globals.css :root`에 역할형 폰트 스케일(웹/모바일 2단) 토큰을 추가하고 스튜디오
패널·포스터 캡션부터 치환. "웹은 크고 시원하게, 모바일은 작고 컴팩트하게" 규칙을 토큰
수준에서 강제할 수 있다.

### 1-3. 코너 동심성 + 색 의미론 + 라이트/다크 적응

**(a) 애플이 하는 것.**
- **코너 동심(concentricity):** 중첩된 라운드 사각형은 `안쪽 반지름 = 바깥 반지름 − 간격`
  규칙으로 두 곡선이 같은 중심을 공유하게 한다(iOS 26은 `ConcentricRectangle`로 자동화).
  이 규칙이 깨지면(안팎이 같은 반지름) 모서리 틈이 불균일해져 "어딘가 어긋난" 인상을 준다.
  하드웨어 베젤—화면—앱 카드—버튼까지 전부 이 체인을 탄다.
- **색 의미론:** 색은 장식이 아니라 의미다. 틴트 컬러 1개 = "상호작용 가능", 시맨틱 컬러
  (label/secondaryLabel/separator/systemBackground…)는 라이트/다크에서 자동으로 값이
  바뀐다. 빨강=파괴, 초록=성공 같은 관습을 앱이 임의로 재정의하지 않는다.
- **라이트/다크:** 다크 모드는 "반전"이 아니라 별도 팔레트다. elevated 배경(시트가 뜨면
  배경이 한 단계 밝아짐)으로 다크에서도 깊이 위계를 유지한다.

**(b) 규칙.** 반지름 토큰은 소수로 고정하되, **중첩 상황에서는 토큰끼리 빼기 관계가
성립해야 한다**: 카드 14px 안에 패딩 6px로 들어간 칩은 8px(= 14−6)이 맞다.

**(c) 웹 구현.** 반지름 계산을 `calc(var(--r-card) - var(--space-inset))`로 표현하거나,
중첩 전용 파생 토큰(`--r-nested-sm`)을 둔다. 다크 팔레트는
`@media (prefers-color-scheme)` + 앱 토글 속성으로 이중 정의. 스쿼클(연속 곡률)은 웹에서
`corner-shape: squircle`(신규 CSS, 지원 제한)이 오기 전까지는 무리하지 않는다 — 동심
규칙만 지켜도 체감의 90%를 얻는다.

**(d) VIC 적용 후보.** `--r-sm/md/card/lg/xl`(8/12/14/16/20)이 이미 있으므로,
**중첩 감사(audit)**가 실질 과제다: 칼렌더 카드(14) 안의 태그 칩·색 점·버튼이
`바깥 − 패딩` 관계를 지키는지 전수 점검. 어긋난 곳은 토큰 치환만으로 고칠 수 있어
위험도가 낮고 체감 통일감이 크다.

---

## 2부 — 몰입(Immersion)의 3요소

### 2-1. 스프링 물리 + 중단 가능 애니메이션 (고정 duration의 종말)

**(a) 애플이 하는 것.** iOS의 거의 모든 시스템 모션은 베지어+고정 시간이 아니라
**스프링**이다. 이유는 두 가지: (1) 스프링은 시작 속도가 매우 빨라 "즉각 반응"으로
느껴지고, (2) **현재 속도를 초기 조건으로 이어받아** 애니메이션 도중 새 목표가 와도
매끄럽게 방향을 튼다. 앱 실행 애니메이션 중에도 홈 제스처로 닫을 수 있는 이유다
(WWDC18 "responsive, interruptible, redirectable").

**(b) 파라미터.**
- 물리 파라미터: mass / stiffness / damping. 임계감쇠(critically damped,
  dampingFraction = 1.0)면 오버슛 없이 도착 — 애플 UI 전이의 기본값 성격.
- 디자이너 파라미터(SwiftUI): `response`(도달 속도감, 지각 시간)와
  `dampingFraction`(1.0 = 무바운스, 낮출수록 통통). **iOS 기본 스프링 ≈ response 0.55 /
  dampingFraction ~0.825–1.0.** iOS 17부터는 `duration + bounce`(perceptual duration)
  체계 — "언제 도착한 것처럼 보이는가"를 지정하고 잔진동은 물리에 맡긴다.
- 실무 프리셋 감각: 전이·시트 = response 0.4–0.55 / damping 0.9–1.0(무바운스),
  버튼·토글 피드백 = response 0.25–0.35 / damping 0.6–0.8(살짝 바운스),
  드래그 릴리스 = 릴리스 속도를 initial velocity로 주입.

**(c) 웹 구현.**
- **CSS `linear()` 스프링**: 스프링 방정식을 수십 개 점으로 샘플링해 easing으로 굳힌다
  (아래 카탈로그에 코드). JS 없이 스프링 곡선을 얻는 현재 최선. 단 `linear()`는
  곡선이 "구워져" 있어 **도중 목표 변경 시 속도 승계는 안 된다.**
- **중단 가능성**: (1) transition 기반 상태 전이는 브라우저가 현재 계산값에서 자연히
  이어가므로 transition + `linear()`만으로도 준수한 중단 내성을 얻는다. (2) 진짜 속도
  승계가 필요한 곳(드래그 릴리스)은 rAF 스프링 시뮬레이션(또는 WAAPI로 매 프레임 목표
  갱신) — VIC에는 이미 스티커 드래그 코드가 있으므로 그 릴리스 경로에만 국소 적용.
- **transform/opacity 전용**: 레이아웃 속성(width/top) 애니메이션 금지. 위치·크기 변화는
  FLIP(First-Last-Invert-Play)으로 transform 재생.

**(d) VIC 적용 후보.** 현재 `--ease-spring: cubic-bezier(0.34,1.56,0.64,1)`은 오버슛
베지어 근사다 — 진짜 스프링 대비 "도착 직전 감속"이 부자연스럽다. `--spring-smooth`
(무바운스)·`--spring-bouncy`(바운스) `linear()` 토큰 2종을 추가하고 기존
`--ease-spring` 사용처를 점진 치환하는 것이 최상위 후보(아래 후보 A1).

### 2-2. 제스처 연속성 + 직접 조작 + 러버밴딩

**(a) 애플이 하는 것.**
- **직접 조작:** 콘텐츠가 손가락 아래에 "붙어" 있다. 시트를 끌면 시트가 1:1로 따라오고,
  놓는 순간의 속도가 스프링 초기 속도가 된다. 터치 다운 즉시 시각 반응(하이라이트/스케일)
  — 지연은 어디에서든 결함으로 취급("look for delays everywhere").
- **러버밴딩:** 경계를 넘는 드래그는 저항이 걸린다. UIScrollView 수식:
  `f(x) = (x·d·c)/(d + c·x)`, c = 0.55(저항 상수), d = 뷰포트 치수. 멀리 끌수록 무거워지고
  점근적으로 한계에 수렴한다. "여기가 끝"임을 막다른 벽이 아니라 탄성으로 알려준다.
- **점진적 공개(progressive disclosure) + 포커스:** 시트의 detent(중간/전체), 컨텍스트
  메뉴의 확대-후-공개, 배경 딤+블러로 현재 과업만 남기기.

**(b) 규칙.** 제스처 진행률과 UI 상태가 항상 연속 함수로 묶인다(끊긴 3단계 스냅 금지).
취소 가능해야 하고(놓기 전 원위치로 되돌리면 취소), 임계값 통과는 햅틱으로 알린다.

**(c) 웹 구현.**
- Pointer Events + `setPointerCapture`로 1:1 추적, `touch-action: none`은 드래그
  대상에만 국소 지정.
- 러버밴딩: 위 수식을 JS 한 줄로 — `const rubber=(x,d,c=0.55)=>(x*d*c)/(d+c*x);`
  드래그 오프셋에 적용 후 transform. 릴리스 시 스프링 복귀.
- 브라우저 기본 오버스크롤 간섭 차단: `overscroll-behavior: contain`(시트·패널 내부 스크롤).
- 시트 detent: drag 진행률 → transform, 릴리스 속도+위치로 목표 detent 결정.

**(d) VIC 적용 후보.** (1) 모바일 바텀시트/이벤트 상세 시트에 끌어서 닫기 + 러버밴딩 +
속도 기반 릴리스. (2) 스티커 드래그가 꾸미기 표면 경계를 넘을 때 러버밴딩 저항(현재는
아마 하드 클램프). (3) 월 내비게이션 스와이프는 **금지 조건 주의** — 월 라우트는
cold-entry 전용이므로 라우트 전환이 아닌, 클라이언트 상태 월 전환에만 검토.

### 2-3. 전이 연속성(매치드 지오메트리) + 감속 모션 배려

**(a) 애플이 하는 것.** 사진 썸네일을 탭하면 그 썸네일 자체가 커지며 상세가 된다(줌 전이,
matched geometry). 요소가 사라지고 새 화면이 나타나는 게 아니라 **같은 물체가 이동**한다.
공간 모델이 유지되므로 사용자는 "어디서 왔고 어디로 돌아가는지"를 몸으로 안다. 뒤로 갈 때는
정확히 역방향. 또한 Reduce Motion 설정 시 줌/슬라이드를 크로스페이드로 강등하되 기능은
동일하게 유지한다.

**(b) 규칙.** 전이의 출발 지오메트리 = 트리거 요소의 실제 위치·크기·반지름. 전이 중에도
중단 가능. 큰 화면일수록(iPadOS/macOS) 이동 거리가 크므로 duration이 아닌 response를
살짝 늘린다.

**(c) 웹 구현.**
- **View Transitions API**(`document.startViewTransition` + `view-transition-name`)가
  matched geometry의 웹 표준 대응물 — Chromium/Safari 지원, 미지원 시 자동으로 즉시 전환
  폴백이라 점진 도입에 안전.
- 수동 대안: FLIP — 트리거 요소 rect 측정 → 목표 레이아웃 렌더 → invert transform → 재생.
- 감속 모션: VIC 규칙대로 **`html[data-reduce-motion]`에서만** 전이를 크로스페이드/즉시로
  강등(OS `prefers-reduced-motion`은 의도적으로 무시 — 프로젝트 규칙 유지).

**(d) VIC 적용 후보.** (1) 칼렌더 카드 → 이벤트 상세 시트: 카드 rect에서 시트로 자라나는
줌 전이(FLIP 또는 View Transitions). (2) 꾸미기에서 스티커 팔레트의 스티커가 표면 위
드롭 위치로 "날아가 안착". (3) 태그 필터 토글 시 카드 목록 재배치를 FLIP으로(사라짐/나타남
크로스페이드 + 이동은 transform).

---

## 3부 — 재미(Playfulness)의 3요소

### 3-1. 마이크로 인터랙션 + 모멘텀 보상

**(a) 애플이 하는 것.** 아이콘 길게 눌러 진입하는 **위글(wiggle)** — 회전 ±1~2°의 미세
진동으로 "편집 모드"라는 상태를 놀이처럼 표현. 버튼은 눌리는 즉시 살짝 가라앉고(scale
0.96~0.97) 떼면 스프링으로 복귀. 빠르게 스와이프하면 더 크게 튕겨준다 — **속도에 비례한
보상(rewarding momentum)**. 전부 100~300ms 스케일의, 기능을 방해하지 않는 미세 모션이다.

**(b) 규칙.** 마이크로 인터랙션은 (1) 항상 입력에 대한 반응이고(자발적 재생 금지),
(2) transform/opacity만 쓰며, (3) 실패해도 기능이 성립한다(장식적 강화일 뿐).

**(c) 웹 구현.** `:active { scale: 0.97 }` + 복귀는 `--spring-bouncy`. 위글:
`@keyframes wiggle { rotate ±1.5deg }` 0.25s infinite alternate + 카드마다
`animation-delay` 난수화(동기화되면 기계적으로 보임). 속도 보상: 드래그 릴리스 속도를
스프링 initialVelocity로.

**(d) VIC 적용 후보.** VIC은 이미 `:active` 스케일 규칙이 있다. 추가 후보: (1) 꾸미기
"스티커 정리/삭제 모드"에 위글(장난감 같은 상태 표현 — 꾸미기의 놀이성과 정합),
(2) 하트 탭 시 하트가 스프링으로 부풀었다 안착 + 미니 파티클 1회.

### 3-2. 햅틱 문법: 촉각이 만드는 "물성"

**(a) 애플이 하는 것.** UIFeedbackGenerator 어휘 — impact(light/medium/heavy/soft/rigid),
selection(피커 틱), notification(success/warning/error). 규칙: 햅틱은 **시각 이벤트와
정확히 동기화**되고, 의미가 일관되며(같은 진동 = 같은 의미), 남발하면 무뎌지므로 임계값
통과·확정·도착 같은 "의미 있는 순간"에만 쓴다. 피커를 돌릴 때 항목마다 selection 틱 —
디지털 다이얼에 기계식 노치의 물성을 부여한다.

**(b) 규칙.** 프레스와 서버 확정은 별개 이벤트이므로 별개 햅틱(→ VIC의 2틱 관례와 동일
사상). 연속 제스처 중에는 임계값(스냅 지점, detent 경계)에서만.

**(c) 웹 구현.** `navigator.vibrate()`는 Android 한정(VIC 메모리에 기록된 제약과 일치;
iOS Safari는 26.5에서 개선). 따라서 햅틱은 **강화 수단**으로만 설계하고, 같은 순간에
시각 틱(1프레임 하이라이트, 살짝 튐)을 반드시 병행해 iOS에서도 "노치감"이 남게 한다.

**(d) VIC 적용 후보.** `hapticTick()` 관례가 이미 있으므로 확장 지점은 "연속 제스처의
노치": (1) 스티커 드래그가 스냅 가이드(중앙 정렬·다른 스티커 모서리)에 걸릴 때 틱+시각 스냅,
(2) 시트 detent 통과 시 틱, (3) 월 이동 성공 확정 시 두 번째 틱(기존 2틱 관례 그대로).

### 3-3. 보상 순간과 과장된 물리 (iMessage 효과·Dynamic Island 문법)

**(a) 애플이 하는 것.** iMessage 전송 시 말풍선이 입력창에서 대화 스레드로 스프링 점프하고,
전면 효과(색종이·풍선)는 사용자가 명시적으로 고른 순간에만 화면을 가득 채운다. Dynamic
Island는 상태 변화를 **모양 변형(morph) + 젤리 같은 스프링**으로 표현 — 검은 알약이
분열·합체하며 살아있는 유기체처럼 군다. 공통 문법: **보상은 드물게, 물리는 과장되게,
지속은 짧게.** 평상시 UI는 절제하고, 성취·완료의 순간에만 감정을 크게 쓴다.

**(b) 규칙.** 전면 보상 효과는 사용자 의도가 명확한 이벤트(전송, 완료, 잠금 해제)에 1회.
morph는 두 상태의 지오메트리를 공유하는 한 요소가 변형(별개 요소 교차 페이드 금지).
바운스 damping 0.5~0.7 수준의 "젤리"는 이런 보상 순간 전용 — 평시 전이에는 금지.

**(c) 웹 구현.** morph: border-radius·width·height를 그대로 트랜지션하지 말고 FLIP +
`clip-path`/scale 조합(또는 View Transitions). 색종이: canvas 1회성 파티클(2초 내 종료,
`data-reduce-motion` 시 생략). 젤리 바운스: `--spring-bouncy` `linear()` 토큰.

**(d) VIC 적용 후보.** (1) 포스터 내보내기 성공 순간 — "저장 완료" 토스트가 아니라 완성된
포스터 썸네일이 스프링으로 팝인 + 짧은 반짝임(내보내기 = 이 앱의 성취 정점). (2) 비공개
레이어 잠금 해제 성공 — 자물쇠가 열리는 1회성 morph(단, 경고 배너 문구는 불변 규칙 준수).
(3) 방송 ON 전환 확정 순간의 라이브 배지 팝. 전부 export surface 밖에서만.

---

## 웹 구현 기법 카탈로그

### A. `linear()` 스프링 이징 토큰 (핵심)

스프링 미분방정식을 오프라인에서 샘플링해 CSS 이징으로 굳힌다. 생성기는
kvin.me/css-springs, pqina 블로그, Josh Comeau 글의 도구 중 아무거나 — 아래는
바로 쓸 수 있는 근사값 예시.

```css
:root {
  /* 무바운스 스프링 (임계감쇠 근사, response≈0.5) — 전이·시트·레이아웃 이동용 */
  --spring-smooth: linear(
    0, 0.0018, 0.0069, 0.0151, 0.0261, 0.0396, 0.0555, 0.0916, 0.1349,
    0.1839, 0.2375, 0.2944, 0.3535, 0.414, 0.475, 0.5359, 0.5961, 0.655,
    0.7122, 0.7675, 0.8204, 0.8709, 0.9187, 0.9425, 0.9866, 1.0245, 1.0565,
    1.083, 1.1045, 1.1212, 1.1337, 1.1425, 1.1479, 1.1504, 1.1483, 1.1414,
    1.1319, 1.1207, 1.1085, 1.096, 1.0835, 1.0714, 1.06, 1.0495, 1.04,
    1.0315, 1.0241, 1.0177, 1.0124, 1.008, 1.0044, 1.0017, 0.9996, 0.9982,
    0.9972, 0.9967, 0.9966, 0.9967, 0.997, 0.9975, 0.998, 0.9985, 0.999,
    0.9995, 1
  );
  /* 바운스 스프링 (damping≈0.6) — 버튼 복귀·하트·보상 순간 전용 */
  --spring-bouncy: linear(
    0, 0.009, 0.035, 0.078, 0.136, 0.207, 0.288, 0.376, 0.468, 0.561,
    0.654, 0.743, 0.827, 0.905, 0.975, 1.036, 1.088, 1.131, 1.164, 1.187,
    1.201, 1.207, 1.205, 1.196, 1.181, 1.162, 1.139, 1.114, 1.088, 1.061,
    1.036, 1.012, 0.99, 0.972, 0.956, 0.944, 0.935, 0.93, 0.928, 0.929,
    0.932, 0.938, 0.945, 0.953, 0.962, 0.971, 0.98, 0.988, 0.996, 1.002,
    1.007, 1.011, 1.013, 1.014, 1.013, 1.012, 1.01, 1.008, 1.006, 1.003,
    1.001, 1, 0.999, 0.999, 1
  );
  /* linear()는 곡선에 잔진동이 포함되므로 duration은 "정착 시간" 전체를 줘야 한다 */
  --dur-spring-smooth: 0.6s;
  --dur-spring-bouncy: 0.7s;
}

.sheet { transition: transform var(--dur-spring-smooth) var(--spring-smooth); }
.heart-btn:active { scale: 0.9; }
.heart-btn { transition: scale var(--dur-spring-bouncy) var(--spring-bouncy); }
```

주의: (1) 점 개수는 40~80개면 충분(파일 크기 미미). (2) `linear()`는 곡선이 고정이라
드래그 릴리스처럼 초기 속도가 매번 다른 곳에는 rAF 스프링을 쓴다. (3) 미지원 브라우저
폴백: `transition-timing-function: var(--ease); transition-timing-function: var(--spring-smooth);`
이중 선언(구형은 첫 줄 사용).

### B. rAF 스프링 (속도 승계·중단 대응)

```js
// 드래그 릴리스 등 initialVelocity가 필요한 곳만. 상태 전이는 A로 충분.
function spring({ from, to, velocity = 0, stiffness = 320, damping = 26, onUpdate, onRest }) {
  let x = from, v = velocity, last = performance.now(), raf;
  const tick = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 30); last = now;
    v += (-stiffness * (x - to) - damping * v) * dt;
    x += v * dt;
    if (Math.abs(v) < 0.01 && Math.abs(x - to) < 0.01) { onUpdate(to); onRest?.(); return; }
    onUpdate(x); raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return { stop: () => cancelAnimationFrame(raf), retarget: (t) => { to = t; } }; // 중단·방향전환
}
```

### C. 러버밴딩

```js
const rubber = (x, dim, c = 0.55) => (x * dim * c) / (dim + c * x); // UIScrollView 수식
// 시트 위로 끌기: offset < 0 이면 translateY(-rubber(-offset, sheetH))
```

### D. FLIP (중단 가능한 레이아웃 전이)

목록 재배치·카드→시트 확대 등. rect 측정 → DOM 갱신 → `transform`으로 이전 위치 위장 →
`--spring-smooth`로 0 복귀. React에서는 `useLayoutEffect`에서 invert. 재실행 시 현재
computed transform에서 다시 측정하면 자연스럽게 중단·재개된다.

### E. 재질(backdrop-filter)

```css
.material-regular {
  background: rgb(255 255 255 / 72%);
  backdrop-filter: blur(20px) saturate(1.8);
  -webkit-backdrop-filter: blur(20px) saturate(1.8);
}
html[data-theme="dark"] .material-regular { background: rgb(24 24 27 / 72%); }
@supports not (backdrop-filter: blur(1px)) { .material-regular { background: var(--surface); } }
```

### F. 기타

- `overscroll-behavior: contain` — 시트/패널 내부 스크롤이 바깥으로 새지 않게.
- `view-transition-name` — 카드→상세 매치드 지오메트리(폴백 자동).
- 감속 모션: 모든 신규 모션은 `html[data-reduce-motion] & { transition: none; animation: none; }`
  분기 필수(프로젝트 규칙 — OS 미디어쿼리 아님).
- transform/opacity 이외 속성 애니메이션 금지, `will-change`는 제스처 시작 시 부여·종료 시 회수.

---

## VIC 적용 후보 목록

우선순위: P1 = 즉시 가치·낮은 위험 → P3 = 매력적이나 신중히.
공통 제약: 토큰은 `app/globals.css :root`에만 추가 · `html[data-reduce-motion]` 분기 필수 ·
`hapticTick()` 관례(프레스+확정 2틱) · 모바일 ≤640px 별도 레이아웃 · export surface
(`[data-export-surface]`) 내부는 신규 모션/재질 금지.

| # | P | 대상 UI | 현재 상태(추정) | 애플 기법 | 구현 스케치 | 위험도 |
|---|---|---------|----------------|-----------|-------------|--------|
| A1 | P1 | 전역 모션 토큰 | `--ease-spring`이 오버슛 베지어 근사 | 진짜 스프링 곡선(response/damping 체계) | `--spring-smooth/--spring-bouncy` `linear()` 토큰 + `--dur-spring-*` 추가, 기존 `--ease-spring` 사용처 점진 치환 (`app/globals.css`) | 낮음 |
| A2 | P1 | 버튼·토글·하트 `:active` 복귀 | `:active` 스케일은 있으나 복귀가 베지어 | 프레스=가라앉음, 릴리스=바운스 스프링 | 전역 버튼 규칙의 transform transition만 `--spring-bouncy`로 (`app/globals.css` 기존 전역 규칙) | 낮음 |
| A3 | P1 | 코너 동심 감사 | 중첩 반지름이 개별 토큰 직접 지정으로 어긋날 가능성 | r_inner = r_outer − gap | 칼렌더 카드/칩/시트/팝오버 중첩쌍 전수 점검, 파생 토큰 또는 `calc()` 치환 (`components/studio`, `components/poster`) | 낮음 |
| B1 | P1 | 이벤트 상세 시트(모바일 바텀시트) | 열림/닫힘이 고정 easing, 드래그 닫기 없거나 제한적 추정 | 직접 조작 + detent + 러버밴딩 + 속도 릴리스 | Pointer 드래그 1:1 → 릴리스 속도로 rAF 스프링(카탈로그 B·C), 위로 과인장 시 rubber(), detent 통과 `hapticTick()` | 중간 |
| B2 | P2 | 칼렌더 카드 → 상세 줌 전이 | 시트가 카드와 무관한 위치에서 등장 추정 | matched geometry(줌 전이) | FLIP 또는 View Transitions로 카드 rect→시트 확대, 닫기는 역방향, reduce-motion 시 페이드 (`components/studio` 상세 진입 경로) | 중간 |
| B3 | P2 | 스티커 드래그 경계 | 표면 밖 하드 클램프 추정 | 러버밴딩 저항 + 스냅 노치 | 경계 초과분에 rubber() 적용, 정렬 가이드 스냅 시 시각 틱+`hapticTick()` (`components/poster/sticker-layer.tsx`) — 기존 직렬 쓰기 큐 불변 | 중간 |
| B4 | P2 | 태그 필터/월 내 카드 재배치 | 필터 변경 시 목록이 즉시 점프 추정 | 같은 물체의 이동(FLIP) | 카드 이동은 FLIP+`--spring-smooth`, 등장/퇴장은 opacity+scale. 낙관적 쓰기 재정렬과 동일 패턴 재사용 | 중간 |
| C1 | P1 | 재질 통일(스튜디오 셸·팝오버·시트) | 불투명 패널 혼재 추정 | 시스템 재질 + 비브런시 | `--material-*` 토큰 + `.material-regular` 유틸(카탈로그 E), 라이트/다크 2팔레트, export surface 밖에만 | 낮음 |
| C2 | P2 | 타이포 역할 토큰 | 컴포넌트별 px 산재 추정 | SF 스타일 역할 스케일 + 웹/모바일 2단 | `:root`에 `--text-*` 6~8종(모바일 기본, ≥641px 상향), 스튜디오 패널부터 치환 | 중간 |
| D1 | P2 | 내보내기 성공 보상 | 토스트/조용한 완료 추정 | 보상 순간(드물게·과장되게·짧게) | 완성 썸네일 스프링 팝인(`--spring-bouncy`) + 1회성 반짝, reduce-motion 시 정적 표시, export surface 밖 UI에서만 | 낮음 |
| D2 | P3 | 꾸미기 정리 모드 위글 | 삭제/정리가 정적 버튼 추정 | 아이콘 위글 = 편집 상태의 놀이적 표현 | 스티커 선택-정리 모드에서 ±1.5° 위글 + delay 난수화, reduce-motion 시 테두리 강조로 대체 | 낮음 |
| D3 | P3 | 잠금 해제·방송 ON 확정 모프 | 상태 배지 즉시 교체 추정 | Dynamic Island식 단일 요소 morph + 젤리 | 자물쇠/배지 한 요소가 FLIP morph + `--spring-bouncy`, 확정 시 두 번째 `hapticTick()`. 경고 배너 문구·보안 경계 불변 | 중간 |

**비후보(명시적 제외):** 라우트 기반 월 스와이프 전환(월 라우트는 cold-entry 전용 규칙),
export surface 내부의 재질·모션, `prefers-reduced-motion` 미디어쿼리 도입(앱 토글만 사용),
스쿼클 연속 곡률 폴리필(비용 대비 체감 미미).

---

## 출처 목록

- Apple HIG — Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple HIG — Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- WWDC18 "Designing Fluid Interfaces": https://developer.apple.com/videos/play/wwdc2018/803/
- Nathan Gitter, "Building Fluid Interfaces": https://medium.com/@nathangitter/building-fluid-interfaces-ios-swift-9732bb934bf5
- uxdesign.cc, "Fluid Interfaces": https://uxdesign.cc/fluid-interfaces-8302c95939fb
- WWDC23 "Animate with springs" 노트: https://wwdcnotes.com/documentation/wwdc23-10158-animate-with-springs/
- GetStream SwiftUI Spring Animations(기본값 response 0.55): https://github.com/GetStream/swiftui-spring-animations
- Josh W. Comeau, "Springs and Bounces in Native CSS": https://www.joshwcomeau.com/animation/linear-timing-function/
- pqina, "Creating CSS Spring Animations With linear()": https://pqina.nl/blog/css-spring-animation-with-linear-easing-function/
- kvin.me CSS Spring Easing Generator: https://www.kvin.me/css-springs/how-to-use
- Chrome for Developers, `linear()` easing: https://developer.chrome.com/docs/css-ui/css-linear-easing-function
- Ilya Lobanov, "How UIScrollView works"(러버밴딩 수식): https://medium.com/@esskeetit/how-uiscrollview-works-e418adc47060
- Arkadiusz Holko, UIScrollView 물리 분석: https://holko.pl/2014/07/06/inertia-bouncing-rubber-banding-uikit-dynamics/
- arun.is, "The secret formula for Apple's rounded corners": https://arun.is/blog/apple-rounded-corners/
- PV21Design, "Concentric Radius": https://pv21design.pt/concentric-radius-nested-corners-done-right/
- Arthur Van Siclen, "Rounded Corners in the Apple Ecosystem": https://medium.com/minimal-notes/rounded-corners-in-the-apple-ecosystem-1b3f45e18fcc
