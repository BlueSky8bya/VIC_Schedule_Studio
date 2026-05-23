# VIC Schedule Studio — 디자인 전면 개편 보고서

작성일: 2026-05-23 · 대상: 시청자 포스터 / 편집실(studio) / 꾸미기 / 로그인

이 문서는 (1) 외부 레퍼런스 리서치, (2) 거기서 뽑은 원칙, (3) 우리 앱에 적용할 디자인 시스템과 화면별 개편안을 정리한다. 구현은 이 보고서를 기준으로 진행했다.

---

## 1. 리서치 — 다른 곳은 어떻게 하나

### 1-1. 캘린더 UI (월간)
- **클린·미니멀 + 강한 위계.** 잘 만든 캘린더는 한눈에 스캔되도록 여백이 충분하고, 부가 요소로 압도하지 않는다. 색·아이콘으로 중요한 날을 빠르게 식별시킨다.
- **마이크로인터랙션으로 "살아있는" 느낌.** 날짜 hover 시 색 변화, 이벤트 이동 시 부드러운 전환 — "시스템이 내 행동에 반응한다"는 확신을 준다. 단, 과하지 않게.
- **색에만 의존하지 않기 + 키보드 내비 + 타임존 명확.** 접근성 기본.
- 출처: [Eleken — Calendar UI Examples](https://www.eleken.co/blog-posts/calendar-ui), [Pageflows — Calendar Design UX/UI](https://pageflows.com/resources/exploring-calendar-design/), [Setproduct — Calendar UI best practices](https://www.setproduct.com/blog/calendar-ui-design)

### 1-2. 스티커/장식 에디터 (Canva 등)
- **코너 핸들로 리사이즈, hover 시 회전 아이콘, 어디든 드래그 배치.** 우리도 동일 패턴(핸들 + 드래그) 사용 중.
- **스마트 정렬 가이드:** 요소를 움직이면 핑크 라인이 나타나 위치/정렬 관계를 보여줌.
- **상단 플로팅 툴바의 투명도 슬라이더** 등 선택 시 맥락 컨트롤.
- **물리감 있는 마이크로인터랙션:** 잡을 때 살짝 커지는 스프링, 동적 그림자, 부드러운 전환 → 조작이 "기분 좋게" 느껴짐.
- 출처: [Canva Stickers](https://www.canva.com/stickers/), [Canva Apps SDK — Drag & Drop](https://www.canva.dev/docs/apps/supporting-drag-drop/), [Building StickerExplode — gestures & physics](https://aditlal.dev/building-stickerexplode-part-1-gestures-physics-and-making-stickers-feel-real/)

### 1-3. 2026 UI 트렌드 — 글래스모피즘 · 부드러운 그림자 · 절제된 모션
- **글래스모피즘:** 반투명 프로스티드 글래스로 깊이·레이어감. `backdrop-filter`가 중급 기기에서도 부드럽게 돌아 "프리미엄 OS" 룩의 기본이 됨. 떠 있는 표면(툴바·모달·배너)에 적합.
- **부드러운 그림자 + 미니멀:** 은은한 그림자와 프로스티드 글래스가 기능을 방해하지 않으면서 세련됨을 줌.
- **모션은 "목적 있는" 방향으로:** 2019~2023의 과한 젤리 바운스·반짝임에서 벗어나, 모션은 *상태·구조·의도*를 전달해야 함. 과한 애니메이션은 오히려 공격적으로 느껴진다 → 짧고, 일관된 이징, 의미 있는 전환만.
- 출처: [Zignuts — Neumorphism vs Glassmorphism 2026](https://www.zignuts.com/blog/neumorphism-vs-glassmorphism), [Tubik — 7 UI Trends 2026](https://blog.tubikstudio.com/ui-design-trends-2026/), [Envato — calm interfaces, end of visual theatrics](https://elements.envato.com/learn/ux-ui-design-trends), [DigitalUpward — Glassmorphism & Micro-Animations 2026](https://www.digitalupward.com/blog/2026-web-design-trends-glassmorphism-micro-animations-ai-magic/)

### 1-4. 스트리머/Vtuber 스케줄 그래픽
- **귀엽고 포스터다운 감성:** 파스텔·별·구름·kawaii. 채널 정체성을 드러내고 시청자에게 방송 시간을 명확·매력적으로 전달.
- **공유 친화:** PNG로 SNS에 올리기 좋은 한 장. 우리의 "포스터 캡쳐"와 정확히 일치.
- 출처: [Etsy — Cute Twitch/Vtuber Schedule templates](https://www.etsy.com/market/vtuber_schedule), [DesignHub — Stream Schedule Makers](https://designhub.co/stream-schedule-makers/)

---

## 2. 원칙 (우리 제품에 맞춘 종합)

1. **"귀엽지만 절제된 프리미엄".** 파스텔·둥근 포스터 감성 + 2026식 차분함(과한 모션 금지).
2. **토큰 기반 일관성.** 색·간격(4/8px)·라운드·그림자·타이포·모션을 CSS 변수로 통일.
3. **떠 있는 표면은 글래스.** 툴바·패널·모달·플로팅 바 = 반투명 + blur + 부드러운 그림자.
4. **목적 있는 모션.** 120–220ms, 일관된 ease-out, hover 살짝 들림/색변화, 등장은 fade+up. 잡으면 살짝 커지는 정도의 촉감.
5. **접근성.** `:focus-visible` 링, 색만으로 정보 전달 금지, 키보드(Delete로 스티커 삭제 등).
6. **스캔성.** 캘린더는 여백·위계 확보, 칸 hover 피드백, 오늘 강조.

---

## 3. 디자인 시스템 (토큰)

globals.css `:root`에 도입:

- **색:** 잉크/뮤트/라인/페이퍼/서피스 + 브랜드(teal accent), 보조(coral·amber·violet). 표면 단계(`--surface-1/2`), 반투명 글래스(`--glass`, `--glass-border`).
- **간격:** `--space-1`(4) … `--space-6`(32).
- **라운드:** `--r-sm`(8) `--r-md`(12) `--r-lg`(16) `--r-xl`(20) `--r-pill`(999).
- **그림자(부드럽게 단계화):** `--shadow-1`(은은) `--shadow-2`(카드) `--shadow-3`(플로팅/모달).
- **모션:** `--ease`(cubic-bezier(0.22,0.61,0.36,1)) `--dur-1`(120ms) `--dur-2`(180ms) `--dur-3`(240ms).
- **타이포:** 본문 스택에 Pretendard/Apple SD Gothic 우선, 위계용 크기 변수.

`prefers-reduced-motion`에서 트랜지션/애니메이션 제거.

---

## 4. 화면별 개편안

### 4-1. 공통 (globals)
- 버튼: 토큰 기반 라운드·그림자, hover 살짝 들림, `:focus-visible` 링, active 눌림. primary/danger/ghost 변형.
- 전역 부드러운 전환(`a, button, input` 등 색·그림자).
- 등장 애니메이션 유틸(`fade-up`), reduced-motion 가드.

### 4-2. 시청자 포스터 (제품의 얼굴)
- 포스터 종이: 따뜻한 미색 + 미세한 그라데이션/노이즈 느낌, 큰 라운드, 부드러운 그림자.
- 헤더 타이틀: 위계 강화(✦ 장식 + 큰 제목 + 월 부제), 월 이동 버튼 글래스 pill.
- 달력 칸: 여백·구분선 정리, 오늘 강조 부드럽게, 이벤트 칩 hover 시 살짝 들림.
- 메모·업도움·색상안내 카드: 통일된 카드 토큰(라운드·그림자·헤더 스타일).

### 4-3. 편집실 (studio)
- 상단바: 글래스 + 역할 배지 컬러칩, 버튼 일관화.
- 좌측 패널: 섹션 카드화, 제목 위계.
- 달력 칸: 포스터와 결을 맞추되 운영 정보 밀도 유지. 선택/오늘/과거 상태 시각화 정리.
- 모달: 글래스 카드 + 등장 모션(fade+scale), 백드롭 blur.

### 4-4. 꾸미기 / 스티커 도구
- 툴바: 글래스 카드. 기본 이모지(스크롤 그리드) / 내 이모지(저장) / 업로드 드롭존 분리(이미 적용) 톤 통일.
- 스티커: 잡을 때 살짝 확대 + 동적 그림자(촉감), 핸들 디자인 정리, 선택 아웃라인 부드럽게.

### 4-5. 로그인/홈
- 가운데 글래스 카드, 브랜드 그라데이션 배경, 구글 버튼 정리.

---

## 5. 비파괴 원칙
- 데이터/권한/경계 로직은 건드리지 않음(디자인=CSS + 최소 마크업).
- 타입체크·린트·유닛테스트 통과 유지.
- 시각 회귀 스냅샷은 디자인 변경으로 갱신 필요(별도 `-u`).
