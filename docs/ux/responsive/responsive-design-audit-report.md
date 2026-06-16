# VIC Schedule Studio 화면 비율 대응 및 모바일/웹 디자인 평가 보고서

작성일: 2026-05-27 KST  
대상 파일:

- `components/studio/studio-shell.tsx`
- `components/studio/studio-shell.css`
- `components/poster/public-poster.tsx`
- `components/poster/public-poster.css`

## 1. 결론 요약

현재 구현은 방향 자체는 꽤 좋다. 특히 모바일에서 월간 7열 달력을 억지로 축소하지 않고 agenda/list 중심으로 전환하는 판단은 이 앱에 잘 맞는다. 스튜디오 화면도 데스크톱에서는 좌측 필터, 중앙 달력, 우측 편집 패널을 분리하고, 모바일에서는 하단 시트와 목록형 편집으로 바꾸려는 구조가 이미 들어가 있다.

다만 지금 가장 큰 피로의 원인은 "흐름형 앱 UI"와 "고정 비율 포스터 캔버스"가 같은 반응형 문제처럼 취급되고 있다는 점이다. 스튜디오/관리 UI는 화면과 컨테이너에 따라 흐르게 만들어야 하지만, 포스터/export 표면은 정해진 비율을 가진 캔버스로 다뤄야 한다. 이 둘을 분리하면 화면 비율 대응 난이도가 크게 내려간다.

권장 방향은 다음과 같다.

1. 포스터는 표준 캔버스 비율을 정한다. 예: 4:5, A4 세로, 3:4, 9:16 중 하나.
2. 포스터 내부 요소는 `vw`/`vh`가 아니라 포스터 컨테이너 기준 단위로 반응하게 한다.
3. 스튜디오 화면은 viewport media query 중심에서 container query 중심으로 점진 이전한다.
4. `zoom` 기반 대형 화면 대응은 장기적으로 제거한다.
5. 모바일은 "축소된 달력"이 아니라 "날짜별 agenda + 하단 편집 시트"를 정식 UX로 유지한다.
6. Playwright visual test를 화면 너비뿐 아니라 화면 비율별로 구성한다.

## 2. 참고 자료 요약

### 2.1 Container Queries

- web.dev: https://web.dev/learn/css/container-queries/
- MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_container_queries

핵심은 viewport가 아니라 "컴포넌트가 놓인 컨테이너"를 기준으로 레이아웃을 바꾸는 것이다. 이 앱처럼 같은 달력/카드/툴바가 스튜디오, 공개 뷰어, 꾸미기 모드에서 서로 다른 폭으로 배치되는 경우 미디어쿼리보다 컨테이너쿼리가 더 잘 맞는다.

특히 `cqi`, `cqb`, `cqw`, `cqh`, `cqmin`, `cqmax` 같은 컨테이너 단위는 포스터 내부 텍스트, 달력 셀 안 일정 pill, 스티커 핸들 크기처럼 "부모 영역 기준으로 커져야 하는 요소"에 유용하다.

### 2.2 Aspect Ratio

- MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Box_sizing/Aspect_ratios
- MDN `<ratio>`: https://developer.mozilla.org/en-US/docs/Web/CSS/ratio

포스터, 캡처/export 영역, 이미지 카드, 정사각형 스티커 썸네일은 `aspect-ratio`로 비율을 명시하는 편이 좋다. 반대로 스튜디오 편집 패널, 필터 목록, agenda 목록은 비율을 고정하면 안 되고 콘텐츠 흐름에 맡기는 편이 좋다.

### 2.3 Fluid Sizing과 `clamp()`

- MDN: https://developer.mozilla.org/en-US/docs/Web/CSS/clamp
- web.dev sizing: https://web.dev/learn/css/sizing

`clamp(min, preferred, max)`는 현재 코드에도 이미 쓰이고 있다. 다만 `vw` 중심 clamp는 화면 전체 폭에 반응하기 때문에, 사이드 패널 안의 요소가 불필요하게 커지는 문제가 생길 수 있다. 장기적으로는 `clamp(최소값, 컨테이너단위, 최대값)` 패턴이 더 안전하다.

예:

```css
.poster-frame {
  container: poster / size;
}

.poster-heading h1 {
  font-size: clamp(24px, 5cqi, 48px);
}
```

### 2.4 Responsive Images와 `object-fit`

- MDN `object-fit`: https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit
- web.dev responsive images: https://web.dev/learn/design/responsive-images/

스티커 업로드 이미지, 포스터 장식 이미지, 향후 배경 이미지는 `contain`과 `cover`를 용도별로 명확히 나눠야 한다.

- 원본 전체가 보여야 하는 스티커/아이콘: `object-fit: contain`
- 배경처럼 잘려도 되는 이미지: `object-fit: cover`
- 모바일/데스크톱에서 아예 다른 crop이 필요한 이미지: `picture`
- 같은 이미지의 용량 최적화: `srcset`/`sizes`

### 2.5 Accessibility Reflow

- W3C WCAG Reflow: https://w3c.github.io/wcag/understanding/reflow.html
- WCAG 설명 자료: https://www.wcag.com/designers/1-4-1-reflow/

최소 320 CSS px 폭에서 정보 손실 없이 세로 스크롤만으로 사용할 수 있어야 한다. 이 기준은 "모든 것을 320px에 예쁘게 넣어야 한다"가 아니라 "기능과 정보가 사라지지 않고, 불필요한 양방향 스크롤이 없어야 한다"는 뜻이다.

VIC Schedule Studio에서는 모바일에서 7열 달력을 포기하고 agenda/list를 보여주는 현재 방향이 이 기준에 더 가깝다.

## 3. 현재 구현 평가

## 3.1 데스크톱 스튜디오 화면

### 잘한 점

데스크톱 스튜디오 구조는 작업 도구로서 적절하다.

- 상단바: 월 이동, 역할 배지, 비공개 토글, 뷰어 전환이 명확하다.
- 본문: 좌측 필터, 중앙 달력, 편집 패널을 분리한다.
- `minmax(0, 1fr)`와 `min-width: 0` 사용이 많아 overflow 방어를 이미 신경 쓰고 있다.
- 일정 pill, 태그 필터, actor badge 등 긴 텍스트를 ellipsis 처리하려는 흔적이 많다.
- 비공개 레이어 경고가 별도 warning band로 표시되어 보안/공유 위험을 시각적으로 분리한다.

### 아쉬운 점

대형 화면 대응에 `zoom`을 사용하고 있다.

```css
@media (min-width: 1700px) {
  .studio-shell {
    zoom: 0.9;
    min-height: calc(100vh / 0.9);
  }
}
```

이 방식은 빠르게 화면 밀도를 맞출 수 있지만, 장기적으로 다음 문제가 생길 수 있다.

- 브라우저별 `zoom` 처리 차이가 있다.
- pointer 좌표, drag/drop, sticky 위치, html2canvas/export 결과와 충돌할 수 있다.
- 사용자가 브라우저 zoom을 조정했을 때 중첩 효과가 생긴다.
- 특정 컴포넌트만 조밀하게 만들 수 없고 전체 앱이 같이 축소된다.

대안은 전체 확대/축소가 아니라 작업대 폭과 밀도를 제어하는 것이다.

```css
.studio-workspace-shell {
  width: min(100%, 1680px);
  margin-inline: auto;
  container: studio / inline-size;
}

@container studio (min-width: 1400px) {
  .studio-day {
    min-height: 148px;
  }
}
```

현재 `studio-poster-title`은 `font-size: clamp(90px, 10.8vw, 200px)`로 매우 크다. 데스크톱 첫 화면에서 브랜드성은 강하지만, 작업 도구의 상단바 안에서는 공간을 많이 먹는다. 특히 작은 노트북/분할 화면에서는 월 이동과 역할 도구가 밀릴 수 있다.

권장:

- 스튜디오 모드 제목은 작업 UI답게 더 조밀하게 둔다.
- 공개 포스터/뷰어에서만 큰 타이틀을 사용한다.
- 상단바는 `container`를 지정하고, 폭이 좁아질 때 title scale보다 action wrapping을 먼저 제어한다.

## 3.2 모바일 스튜디오 화면

### 잘한 점

모바일 구현은 현재 방향이 맞다.

- `isNarrow`를 기준으로 데스크톱 스튜디오와 모바일 스튜디오를 분리한다.
- 월간 그리드를 1열로 바꾸는 CSS가 있다.
- 모바일에서는 편집을 하단 시트(`m-edit-sheet`)로 열어 전체 편집 패널을 억지로 끼워 넣지 않는다.
- `100dvh`, `env(safe-area-inset-bottom)`을 사용해 모바일 브라우저 주소창/하단 안전영역을 고려한다.
- 모바일 태그 편집에서 색상 swatch가 한 줄 안에서 과도하게 커지지 않도록 별도 규칙을 둔다.

### 아쉬운 점

모바일 breakpoint가 주로 `640px`, `860px`로 나뉘는데, "왜 이 폭에서 UX가 바뀌는지"가 코드상 정책으로 명확하게 정리되어 있지는 않다.

권장 breakpoint 정책:

- `<= 640px`: 모바일 정식 UX. agenda/list + bottom sheet.
- `641px - 860px`: 좁은 태블릿/분할 화면. 단일 컬럼이지만 툴바는 조금 더 여유 있게.
- `861px - 1180px`: 태블릿 가로/작은 노트북. 달력 + 일부 패널 접힘.
- `> 1180px`: 데스크톱 스튜디오.

지금은 CSS 곳곳에 breakpoint가 분산되어 있어, 나중에 화면 하나를 고치면 다른 모드에 영향이 갈 가능성이 있다. `@layer` 또는 섹션별 주석으로 breakpoint 정책을 묶어두면 좋다.

예:

```css
/* Responsive policy
   mobile: <= 640
   compact: <= 860
   studio narrow: <= 1180
*/
```

또한 `isNarrow`가 JS `matchMedia("(max-width: 640px)")`에 묶여 있으므로 CSS breakpoint와 JS breakpoint가 어긋나면 문제가 생길 수 있다. 지금은 640px로 일치하는 부분이 있지만, 관련 상수화를 고려할 만하다.

```ts
const MOBILE_QUERY = "(max-width: 640px)";
```

## 3.3 공개 포스터/뷰어 화면

### 잘한 점

공개 포스터는 viewer experience를 상당히 신경 쓴 구조다.

- 공개 모드와 꾸미기 모드가 같은 `PublicPoster`를 공유한다.
- agenda mode와 calendar mode가 분리되어 있다.
- 월 이동, account switch, export, decorate toolbar가 역할에 따라 조건부 노출된다.
- `poster-surface` 안에 memo, calendar, support, legend가 배치되어 포스터다운 구성이 있다.
- 스티커 레이어가 `data-export-surface` 안에 포함되어 export 대상과 시각 결과가 일치할 수 있는 구조다.

### 핵심 문제

`poster-surface`가 아직 "포스터 캔버스"라기보다 "반응형 레이아웃 박스"에 가깝다.

현재 구조:

```css
.poster-surface {
  display: grid;
  grid-template-columns: 238px minmax(0, 1fr) 220px;
  gap: 16px;
  min-height: 780px;
  padding: 18px;
}
```

이 방식은 데스크톱 화면에서는 보기 좋지만, export 품질과 화면 비율 대응에서는 다음 고민을 만든다.

- 포스터의 최종 비율이 명확하지 않다.
- 사용자가 보는 미리보기 비율과 export 결과 비율이 변할 수 있다.
- 스티커 `xRatio`, `yRatio`, `widthRatio`가 표면 크기에 묶여 있으므로 표면 비율이 바뀌면 의도한 위치감이 달라진다.
- 모바일/좁은 화면에서 grid가 1열로 바뀌면 "포스터"라기보다 "페이지"가 된다.

권장 방향:

포스터는 먼저 하나의 기준 캔버스를 가져야 한다.

후보:

1. `4 / 5`: SNS 이미지와 잘 맞고 세로형 포스터에 안정적.
2. `3 / 4`: 달력과 사이드 정보가 같이 들어가기 좋다.
3. `210 / 297`: A4 세로 비율. 인쇄/문서형에 좋다.
4. `9 / 16`: 모바일 스토리형에 좋지만 달력 7열에는 좁을 수 있다.

현재 구성은 좌측 memo, 중앙 calendar, 우측 support/legend가 있으므로 `4 / 5` 또는 `3 / 4`가 가장 현실적이다. `9 / 16`은 달력 칸이 너무 좁아질 가능성이 크다.

추천은 `4 / 5`다. 이유:

- 공개 포스터로 공유하기 좋다.
- 모바일에서도 미리보기 영역이 자연스럽다.
- 달력 7열을 유지할 수 있는 최소 가로폭이 확보된다.
- 좌우 패널을 넣되 너무 길어지지 않는다.

## 3.4 꾸미기 모드

### 잘한 점

꾸미기 모드는 기능이 풍부하다.

- undo/redo
- 테마 선택
- 기본 emoji palette
- 업로드 이미지 asset palette
- 텍스트 스티커 추가
- 선택된 스티커 floating toolbar
- 단축키 도움말
- export 전 selection/filter 정리

이 정도면 단순 장식 기능이 아니라 작은 포스터 편집기다.

### 아쉬운 점

편집 도구가 많기 때문에 화면 비율이 좁아질 때 "캔버스가 줄어드는 문제"보다 "툴바가 캔버스를 밀어내는 문제"가 더 중요하다.

현재 decorate toolbar는 포스터 위쪽에 flow로 놓인다. 좁은 노트북이나 세로 화면에서는 toolbar 높이가 커지고, 실제 포스터 preview가 아래로 밀릴 수 있다.

권장:

- 데스크톱 꾸미기 모드: 좌측 또는 우측 docked toolbar + 중앙 fixed-ratio canvas.
- 태블릿/좁은 화면: 상단 compact toolbar + 접힘 palette.
- 모바일: 꾸미기 모드 진입 제한 또는 별도 간단 모드.

이미 `viewerMode`에서 모바일 꾸미기 버튼을 숨기는 판단이 들어가 있다. 이 판단은 유지해도 좋다. 스티커 드래그/정밀 조정은 모바일에서 UX 난도가 높으므로, 모바일은 보기/하트/필터 중심이 더 안정적이다.

## 4. 설계 원칙 제안

## 4.1 "화면 비율 대응"을 4개 레이어로 분리한다

### 레이어 A: App Shell

대상:

- `.studio-shell`
- `.poster-page`
- 상단바
- 전체 배경

원칙:

- 전체 `zoom` 금지.
- `min-height: 100dvh`와 safe area 고려.
- 너무 넓은 화면에서는 콘텐츠 max width를 둔다.
- app shell은 화면 비율을 직접 맞추지 않는다.

### 레이어 B: Workbench Layout

대상:

- `.studio-workspace`
- `.public-calendar-shell`
- decorate toolbar + preview 영역

원칙:

- viewport media query보다 container query를 우선한다.
- 좌우 패널은 "공간이 부족하면 아래로 이동" 또는 "drawer/sheet로 이동"한다.
- 패널이 달력/포스터의 최소 가독성을 침범하지 않게 한다.

### 레이어 C: Canvas

대상:

- `.poster-surface`
- export target
- 스티커 레이어

원칙:

- 명확한 `aspect-ratio`를 가진다.
- 화면 안에서는 `width`와 `max-height`로 scale된다.
- 내부 크기는 `cqi`, `cqb`, `cqmin`으로 조정한다.
- export는 이 캔버스 기준으로 고정한다.

### 레이어 D: Components

대상:

- 일정 pill
- day cell
- tag legend
- support card
- memo
- floating toolbar

원칙:

- 컴포넌트마다 `container`를 지정할 수 있다.
- 텍스트는 `min-width: 0`, `overflow-wrap`, `text-overflow` 정책을 명확히 둔다.
- 아이콘 버튼은 고정 터치 영역을 가진다.
- 긴 텍스트는 줄바꿈, ellipsis, 펼침 중 하나를 컴포넌트별로 정한다.

## 4.2 달력은 "반응형 축소"보다 "모드 전환"이 맞다

월간 7열 달력은 본질적으로 최소 가로폭이 필요하다. 일정 제목, 연속 일정 bar, 날짜, 휴일 표시, 태그 색상까지 들어가면 320px 모바일에서 7열을 유지하는 것은 사용성이 낮다.

따라서 정책은 다음이 좋다.

- 공개 viewer 모바일: agenda/list 기본.
- 스튜디오 모바일: agenda/list + 날짜별 편집.
- 포스터 export: 고정 비율 안에서 7열 유지.
- 데스크톱/태블릿: 7열 달력 유지.

현재 구현은 이미 이 방향으로 가고 있으므로, 더 밀어붙이면 된다.

## 4.3 포스터는 "페이지"가 아니라 "출력물"이다

포스터는 화면에 맞춰 구조가 바뀌면 안 된다. 화면에서는 축소되어 보이더라도, 내부 구성은 같은 비율과 같은 상대 위치를 유지해야 한다.

권장 구조:

```tsx
<div className="poster-preview-viewport">
  <section className="poster-surface" data-export-surface>
    ...
  </section>
</div>
```

```css
.poster-preview-viewport {
  display: grid;
  place-items: start center;
  overflow: auto;
  padding: 16px;
}

.poster-surface {
  width: min(100%, calc((100dvh - 180px) * 0.8));
  aspect-ratio: 4 / 5;
  min-height: 0;
  container: poster / size;
}
```

주의:

- `aspect-ratio: 4 / 5`에서 `width = height * 0.8`이다.
- toolbar 높이를 뺀 `100dvh - 180px`는 실제 구현에서 변수화하는 편이 좋다.
- export 시에는 CSS pixel 크기를 그대로 쓰지 말고, 목표 해상도 scale을 적용한다.

## 5. 현재 CSS별 구체 평가

## 5.1 `studio-shell.css`

### 유지하면 좋은 부분

- `min-width: 0` 방어가 많다.
- 모바일 태그 편집 UI가 세심하다.
- `100dvh`를 이미 사용한다.
- private/developer warning이 화면에서 분리되어 있다.
- 모바일 bottom sheet 패턴은 적절하다.
- 일정 pill과 support bar가 월간 달력의 정보 밀도를 잘 살린다.

### 개선 필요

1. 대형 화면 `zoom` 제거

현재 큰 화면에서 전체 UI를 축소한다. 대신 작업영역 max width와 요소별 밀도를 조정해야 한다.

2. 상단 타이틀의 과도한 `vw` 의존 줄이기

`studio-poster-title`은 스튜디오 도구에서는 너무 강하다. viewer/poster에서는 좋지만, studio에서는 작업성을 방해할 수 있다.

3. breakpoint 정책 문서화

`640`, `860`, `1180`, `1700`, `2400`이 각각 어떤 UX 경계인지 주석으로 정리하면 이후 유지보수가 쉬워진다.

4. container query 도입

`.studio-workspace`, `.studio-calendar-panel`, `.event-editor-panel`, `.studio-left-panel`에 container를 지정하고 내부 컴포넌트를 점진 이전한다.

예:

```css
.studio-calendar-panel {
  container: studio-calendar / inline-size;
}

@container studio-calendar (max-width: 760px) {
  .studio-event-pill {
    padding-inline: 8px;
  }
}
```

## 5.2 `public-poster.css`

### 유지하면 좋은 부분

- `.poster-surface`가 export target과 시각 표면을 겸하는 구조.
- 스티커 레이어가 surface 전체에 absolute로 올라가는 구조.
- public memo, calendar, support, legend가 명확히 분리되어 있다.
- mobile에서 `public-month-grid`를 1열로 바꾸는 escape hatch가 있다.
- decorate toolbar가 기능별로 잘 묶여 있다.

### 개선 필요

1. `.poster-surface`에 표준 비율 부여

지금은 `min-height: 780px` 중심이라 화면/내용에 따라 비율이 달라질 수 있다.

2. 포스터 내부 grid를 컨테이너 기준으로 조정

현재:

```css
grid-template-columns: 238px minmax(0, 1fr) 220px;
```

권장:

```css
.poster-surface {
  container: poster / size;
}

.poster-content-grid {
  grid-template-columns:
    minmax(128px, 20cqi)
    minmax(0, 1fr)
    minmax(120px, 18cqi);
  gap: clamp(10px, 2cqi, 18px);
}
```

3. 모바일 공개 화면과 포스터 export 화면을 분리

모바일 viewer에서는 agenda/list가 좋다. 하지만 export 포스터는 고정 캔버스여야 한다. 즉, "모바일에서 보는 공개 페이지"와 "포스터 이미지로 저장되는 표면"은 같은 컴포넌트를 공유하더라도 CSS 정책은 분리되어야 한다.

4. decorate toolbar와 canvas의 레이아웃 분리

꾸미기 toolbar가 커져도 canvas 비율은 유지되어야 한다.

## 6. 추천 수정 로드맵

## Phase 1: 기준 정리와 위험 제거

목표: 현재 디자인을 크게 바꾸지 않고, 나중에 망가지지 않도록 기준을 세운다.

작업:

1. `docs/responsive-design-audit-report.md`를 기준 문서로 둔다.
2. CSS 상단에 breakpoint 정책 주석을 추가한다.
3. JS `matchMedia("(max-width: 640px)")`를 상수화한다.
4. Playwright visual viewport 목록을 확정한다.
5. `zoom` 제거를 위한 대체 layout 실험 브랜치를 만든다.

검증:

- `npm run lint`
- `npm run typecheck`
- `npm run test:visual`

## Phase 2: 포스터 캔버스 고정 비율 도입

목표: export 품질과 화면 비율 대응의 중심축을 만든다.

작업:

1. 포스터 비율 결정. 추천: `4 / 5`.
2. `.poster-surface`에 `aspect-ratio` 도입.
3. `.poster-surface`의 `min-height: 780px` 의존도를 줄인다.
4. 포스터 preview wrapper를 추가한다.
5. 스티커 위치와 크기가 새 표면 비율에서 자연스러운지 확인한다.
6. export 결과 크기와 미리보기 크기의 관계를 명확히 한다.

주의:

- 기존 스티커 `xRatio`, `yRatio`, `widthRatio` 데이터가 있다면 표면 비율 변경 후 시각 위치가 달라질 수 있다.
- 이미 저장된 스티커를 보존하려면 migration 또는 compatibility mode가 필요할 수 있다.

검증 viewport:

- 390x844
- 768x1024
- 1366x768
- 1920x1080
- 3440x1440

## Phase 3: Studio Shell에서 `zoom` 제거

목표: 대형 화면에서도 안정적인 interaction과 export 기반을 만든다.

작업:

1. `.studio-shell`의 `zoom` media query를 제거한다.
2. `.studio-workspace` 또는 상위 wrapper에 `max-width`를 둔다.
3. 큰 화면에서 calendar cell, sidebar, editor panel의 max/min을 조정한다.
4. 상단 타이틀 크기를 작업 UI 기준으로 낮춘다.

예:

```css
.studio-workspace {
  width: min(100%, 1720px);
  margin-inline: auto;
}
```

## Phase 4: Container Query 점진 도입

목표: viewport 기준 CSS를 줄이고 컴포넌트 기준 반응형으로 전환한다.

우선순위:

1. `.poster-surface`
2. `.public-calendar-area`
3. `.studio-calendar-panel`
4. `.event-editor-panel`
5. `.tag-editor`
6. `.decorate-toolbar`

예:

```css
.public-calendar-area {
  container: public-calendar / inline-size;
}

@container public-calendar (max-width: 720px) {
  .public-event .event-main p {
    font-size: 12px;
  }
}
```

## Phase 5: 모바일 UX 고도화

목표: 모바일을 "축소판"이 아니라 독립 UX로 완성한다.

작업:

1. 공개 모바일 기본값을 agenda mode로 유지한다.
2. 날짜별 grouping을 더 명확히 한다.
3. 필터는 horizontal chip rail로 유지하되, 선택 상태를 더 강하게 보여준다.
4. 하트/북마크/외부 링크는 최소 40px 터치 영역을 보장한다.
5. 비공개 레이어가 보이는 모바일 화면은 warning을 sticky 또는 sheet 상단에 유지한다.

## Phase 6: Visual Regression 체계화

목표: "한 화면 고치면 다른 비율이 깨지는 문제"를 자동으로 잡는다.

추천 테스트 세트:

```ts
const viewports = [
  { name: "mobile-small", width: 320, height: 568 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-large", width: 430, height: 932 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "tablet-landscape", width: 1024, height: 768 },
  { name: "laptop-short", width: 1366, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "fhd", width: 1920, height: 1080 },
  { name: "qhd", width: 2560, height: 1440 },
  { name: "ultrawide", width: 3440, height: 1440 }
];
```

테스트 항목:

- 공개 viewer agenda mode
- 공개 viewer calendar mode
- studio owner mode
- studio private layer enabled
- decorate mode
- poster export surface screenshot
- tag editor modal
- mobile edit sheet

자동 체크:

- horizontal overflow 없음
- 주요 버튼 viewport 밖으로 밀림 없음
- 포스터 surface가 비어 있지 않음
- 스티커가 surface 밖으로 나가지 않음
- 비공개 경고가 private mode에서 보임
- viewer mode에서 private data가 노출되지 않음

## 7. 도입 시 주의할 보안/권한 체크

이 보고서는 주로 UI/반응형에 관한 것이지만, VIC Schedule Studio의 우선순위상 보안 경계가 항상 먼저다.

수정할 때 지켜야 할 점:

- 모바일 agenda로 바꾸면서 private field가 public DTO에 섞이면 안 된다.
- viewer mode CSS에서 숨기는 방식으로 private data를 보호하면 안 된다.
- private layer unlock 상태는 서버 응답과 세션 만료 정책을 기준으로 한다.
- manager/worker에게 편집 가능한 UI를 열더라도 서버 action 권한 검사가 반드시 있어야 한다.
- poster export 전에 private layer 표시 여부가 의도한 권한과 일치하는지 확인한다.

## 8. 구체적인 CSS 패턴 제안

## 8.1 포스터 고정 비율 wrapper

```css
.poster-preview {
  display: grid;
  justify-items: center;
  overflow: auto;
  padding: clamp(12px, 2vw, 24px);
}

.poster-surface {
  width: min(100%, calc((100dvh - var(--poster-toolbar-space, 180px)) * 0.8));
  max-width: 1280px;
  aspect-ratio: 4 / 5;
  min-height: 0;
  container: poster / size;
}
```

## 8.2 포스터 내부 크기

```css
.poster-heading h1 {
  font-size: clamp(24px, 4.5cqi, 48px);
}

.poster-heading em {
  font-size: clamp(14px, 2cqi, 22px);
}

.public-day {
  min-height: clamp(88px, 13cqb, 144px);
}

.public-event .event-main p {
  font-size: clamp(11px, 1.35cqi, 15px);
}
```

## 8.3 Studio workbench max width

```css
.studio-shell {
  min-height: 100dvh;
}

.studio-workspace,
.studio-actionbar,
.studio-topbar {
  width: min(100%, 1720px);
  margin-inline: auto;
}
```

상단바에 width를 줄 경우 sticky background가 화면 끝까지 안 가는 문제가 생길 수 있다. 그럴 때는 sticky bar 자체는 full width로 두고 안쪽 inner wrapper만 제한한다.

```tsx
<header className="studio-topbar">
  <div className="studio-topbar-inner">...</div>
</header>
```

## 8.4 긴 텍스트 정책

일정 제목은 영역별로 정책을 다르게 둔다.

- 월간 달력 pill: 최대 2줄, 넘치면 숨김.
- agenda list: 줄바꿈 허용.
- 포스터 export: 최대 2줄 또는 3줄, 디자인 우선.
- 편집 패널: 전체 텍스트 표시.

예:

```css
.public-event .event-main p {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.agenda-event .agenda-title-text {
  overflow-wrap: anywhere;
}
```

## 9. 의사결정이 필요한 항목

### 9.1 포스터 기준 비율

추천: `4 / 5`

대안:

- A4: 인쇄 지향이면 좋다.
- 3 / 4: 달력 가독성은 조금 더 좋다.
- 9 / 16: 모바일 공유에는 좋지만 달력에는 좁다.

결정 기준:

- 가장 많이 공유되는 곳이 X/카페/디스코드 이미지라면 4:5.
- 인쇄/공지문 다운로드가 중요하면 A4.
- 모바일 스토리 공유가 중요하면 9:16 별도 템플릿.

### 9.2 모바일에서 달력 보기 제공 여부

추천:

- 기본은 agenda.
- "달력 보기"는 옵션으로 제공하되, 7열을 그대로 보여주는 것이 아니라 가로 스크롤 preview 또는 축약 calendar로 제공.

### 9.3 꾸미기 모바일 지원 범위

추천:

- 모바일에서는 꾸미기 진입 버튼 숨김 유지.
- 필요하면 "간단 꾸미기"만 별도 제공: 텍스트 추가, 테마 선택, 업로드 이미지 추가 정도.
- 정밀 drag/resize/toolbar는 데스크톱 권장.

## 10. 최종 권장안

가장 먼저 할 일은 포스터를 고정 비율 캔버스로 분리하는 것이다. 지금 느끼는 화면 비율 스트레스의 상당 부분은 포스터가 반응형 페이지처럼 움직이기 때문에 생긴다. 포스터의 비율을 정하고, 화면에서는 그 캔버스를 보기 좋은 크기로 축소/확대하면 export 품질과 스티커 위치 문제가 동시에 정리된다.

그 다음은 스튜디오 대형 화면 `zoom`을 제거하고, 작업영역 max width와 container query로 전환하는 것이다. 스튜디오 UI는 포스터처럼 비율을 고정할 필요가 없다. 작업 도구답게 정보 밀도와 패널 배치를 컨테이너 기준으로 바꾸면 된다.

모바일은 현재처럼 agenda/list 중심으로 가는 것이 맞다. 7열 달력을 모바일에 억지로 넣으려는 순간 가독성, 터치, private warning, 편집 시트가 모두 어려워진다. 모바일은 별도 UX로 인정하고, 데스크톱과 같은 기능을 제공하되 표현 방식을 다르게 가져가는 편이 좋다.

권장 순서:

1. 포스터 비율 결정 및 `.poster-surface` 고정 비율화.
2. export 결과와 preview 결과 일치 확인.
3. `zoom` 제거 실험.
4. 스튜디오/포스터 주요 컨테이너에 container query 도입.
5. Playwright visual viewport 세트 확정.
6. 모바일 agenda/list polish.

이 방향으로 가면 "각 화면 비율마다 CSS를 덧대는 방식"에서 벗어나, "포스터는 캔버스, 앱은 흐름형 UI, 모바일은 별도 UX"라는 훨씬 안정적인 구조로 정리할 수 있다.
