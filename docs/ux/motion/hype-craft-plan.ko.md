# 최초공개 하이프 4차 — 장인 정밀도 계획서

- 상태: 구현 전 확정 명세
- 작성일: 2026-08-03 KST
- 대상 제품: VIC Schedule Studio 공개 포스터·공개 모바일 아젠다
- 기준 구현: `lib/ui/hype-curve.ts`
- 직접 수정 대상: `components/poster/public-poster.tsx`, `components/poster/public-poster.css`
- 테스트 대상: `tests/unit/hype-curve.test.ts`, `tests/visual/teaser-hype.spec.ts`
- 제외: 편집실 하이프 연출, 서버 공개/비공개 모델, 공개 시각 계산식 재설계

이 문서는 코드가 아니다. 아래 값은 구현자가 임의로 다시 고르지 않는 기준값이다. 실제 폰트 raster, Safari SVG 합성처럼 문서만으로 확정할 수 없는 항목은 `확인 필요`와 측정 통과 기준을 함께 적는다.

---

## 1. 문제 정의

### 1.1 팝오버 카운트다운 라벨이 링에 먹힌다

현재 동작:

- `.dt-count`는 `132 × 132px` 정사각형이다: `public-poster.css:2832-2839`.
- 진행 링은 `viewBox="0 0 100 100"`, `r=44`, CSS `stroke-width:7`이다: `public-poster.tsx:5097-5108`, `public-poster.css:2840-2858`.
- 숫자는 중앙에 있고 `26px × --hy-num(1.05→1.85)`로 `27.30→48.10px`까지 커진다: `public-poster.css:2865-2878`.
- 라벨은 같은 정사각형 안 `position:absolute; bottom:14px; font-size:11px`로 놓인다: `public-poster.css:2899-2909`.

기하 진단:

1. SVG 사용자 단위 `7`의 실제 stroke는 `7 × 1.32 = 9.24px`다.
2. 링 안쪽 반지름은 `44 × 1.32 - 9.24/2 = 53.46px`다.
3. 현재 라벨 line box를 `11px × normal 1.2 = 13.2px`로 보면 중심 y는 `132 - 14 - 6.6 = 111.4px`다.
4. 원 중심 y는 `66px`; 라벨 중심의 수직 편차는 `45.4px`다.
5. 그 높이에서 링 안쪽 chord 폭은 `2√(53.46² - 45.4²) = 56.4px`다.
6. `최초공개까지` 6글자의 최소 예상 advance는 `6 × 11 + 5 × 0.22 = 67.1px`다. Pretendard 800 실제 폭은 브라우저 측정 필요지만, `56.4px`보다 작아질 가능성은 낮다.

결론: 정적 최대 숫자와 라벨의 수직 line box가 반드시 겹치는 것은 아니다. 실제 확정 결함은 라벨이 원 하단의 좁은 chord에 놓여 링 stroke와 약 `10.7px` 폭만큼 충돌하는 구조다. 숫자가 작을 때도 라벨이 “먹힌” 것처럼 보이는 이유다. 숫자 축소만으로 해결되지 않는다.

### 1.2 카드와 팝오버의 색 온도가 분리돼 있다

현재 동작:

- `--hy-gold`는 `.dt-when`, 링 stroke, spark, 숫자색에만 적용된다: `public-poster.css:2818-2825`, `2852-2877`.
- `.agenda-detail-sheet.is-hype`는 box-shadow만 바뀐다: `public-poster.css:2811-2817`.
- 웹 팝오버 본체 배경은 `#fffdf6`, 지원 브라우저에서는 `--material-bg-strong` 반투명 재질이다: `public-poster.css:6682-6702`.
- 모바일 시트 배경도 `var(--surface, #fffdf6)`로 정지한다: `public-poster.css:6651-6663`.

부족한 점:

- 카드·링·숫자는 보라에서 금빛으로 데워지는데 가장 큰 면적인 시트 표면은 같은 색 온도를 갖지 않는다.
- 반투명 material은 뒤 포스터가 어두운 테마일 때 배경색과 금빛의 실제 결과가 달라진다. 같은 `I`에서도 팝오버마다 색이 탁해질 수 있다.
- `backdrop-filter`나 `hue-rotate`를 10Hz로 바꾸면 큰 offscreen repaint가 생긴다.

### 1.3 리더 점선의 속도·박동·위상이 약하다

현재 동작:

- 기본 점선은 `stroke-dasharray:5 6`, `stroke-dashoffset`을 `0→-11`로 움직인다: `public-poster.css:6870-6889`.
- 하이프 상태에서 주기는 `--hy-dash-dur(1.8→0.6s)`, 굵기는 `2.5→3.5px`다: `public-poster.css:2933-2941`.
- 도트는 `r:5→5+4I`를 애니메이션한다: `public-poster.css:2942-2956`.
- 팝오버 scheduler가 외부 SVG `.detail-anchor-link`에도 같은 CSS 변수를 쓴다: `public-poster.tsx:1590-1595`.

부족한 점:

- 속도 변화는 있으나 선 자체의 굵기·밝기·간격이 한 번에 수축·이완하지 않는다.
- `stroke-width`, `r`, `stroke-dashoffset`은 SVG paint를 유발한다. 특히 리더 SVG는 팝오버 밖 넓은 표면이다.
- 카드 링, `.dt-hope`, 도트가 같은 duration 값을 가져도 각 animation이 mount된 시점이 다르면 위상은 같지 않다.

### 1.4 제목만 공개 연출에 참여한다

현재 동작:

- 제목은 `ScrambleText`를 사용한다: 웹 카드 `public-poster.tsx:3742-3749`, 모바일 `4227-4237`, 팝오버 `5038-5049`.
- 스크램블은 `750ms` 전체 난수 뒤 글자당 `90ms`로 왼쪽부터 확정한다: `public-poster.tsx:453-512`.
- 웹 부제목은 `.event-subs`로 즉시 나타난다: `public-poster.tsx:3791-3804`.
- 모바일 부제목은 `.agenda-subs`, 팝오버 부제목·태그는 `.agenda-detail-subs`, `.agenda-detail-tags`로 즉시 나타난다: `public-poster.tsx:4280-4293`, `5052-5073`.
- 모바일의 `reveal-glitch`는 `.agenda-content` 전체에 걸리지만 정보 위계를 만들지 못한다: `public-poster.css:2540-2561`.

부족한 점:

- 제목이 해독되는 동안 하위 정보는 이미 완성돼 보여 시선 순서가 뒤집힌다.
- 부제목까지 같은 스크램블을 쓰면 주·부 정보가 같은 무게가 되고 난수 DOM 업데이트도 늘어난다.
- 늦게 mount하거나 `display:none`을 풀면 카드 높이가 연출 중 변한다.

---

## 2. 설계 원칙

### 2.1 정보 위계

1. 공개 순간 제목이 먼저 정체를 얻는다.
2. 제목의 첫 3글자가 확정된 `1,020ms = 750 + 3×90`부터 부제목이 따라온다.
3. 시간·메타·태그는 부제목 뒤에 나타난다.
4. 모든 최종 DOM은 서버 공개 응답이 도착한 첫 render에 즉시 layout에 참여한다. 시각만 늦춘다.

왜 `1,020ms`인가: 제목 전체 길이에 종속하면 긴 제목의 부제목이 지나치게 늦는다. 첫 3글자는 한국어 제목을 식별하기 시작할 최소 단서이며 기존 상수에서 직접 계산할 수 있어 새 매직 넘버가 아니다.

### 2.2 색 온도

- 보라→금빛 채널은 장식색만 바꾸지 않고 시트 표면도 같은 `I`로 데운다.
- 시트 warmth는 `W_s=I^1.35`를 사용한다. `1.35`는 기존 금빛 `I^2.2`보다 이르다. 넓은 저채도 면은 작은 고채도 stroke보다 변화 감지가 약하므로 중반부터 먼저 온도를 만들어야 한다.
- 본문색은 움직이지 않는다. 배경과 텍스트를 동시에 보간하면 대비 원인을 추적하기 어렵다.
- teaser 팝오버는 불투명 표면을 사용한다. 어두운 포스터·스티커가 뒤에 있어도 같은 `I`가 같은 픽셀을 만든다.

### 2.3 위상 동기

- `target revealAt`, 보정된 `now`, 정본 `hypeIntensity()`에서 master phase를 계산한다.
- 카드 primary ring, `.dt-hope`, 리더 pulse overlay, 도트가 같은 `--hy-beat-*` 최종값을 사용한다.
- 단순히 같은 duration을 주는 방식은 동기화로 인정하지 않는다. 같은 rAF timestamp에서 계산된 즉시값이어야 한다.

### 2.4 레이아웃 불변

- 크기 변화는 고정 슬롯 안의 `transform` 또는 font line box 안에서 끝낸다.
- 카드·시트·버튼·클릭 타깃의 `width`, `height`, `top`, `left`를 시간에 따라 바꾸지 않는다.
- 공개된 실제 데이터는 서버 응답 후에만 mount한다. 가려진 제목·부제목·태그색을 미리 DOM에 넣어 자리만 잡는 방식도 금지한다.
- 서버 응답에 따른 teaser→실제 카드 1회 layout 변화는 비공개 경계 때문에 피할 수 없다. 이후 stagger 중 추가 layout 변화는 0이어야 한다.

### 2.5 시청자 전용

- 팝오버는 이미 `interactive`에서만 열리지만 카드 scheduler는 별도 제한이 필요하다.
- `TeaserCountdown`에 `motionEnabled={interactive}`를 전달한다.
- `decorate=true`에서는 1Hz 숫자만 유지하고 하이프 visual scheduler·공개 보상 stagger를 실행하지 않는다.

---

## 3. 항목별 명세

## 3.1 팝오버 숫자·라벨 기하

### 후보안

| 안 | 내용 | 장점 | 탈락 이유 |
|---|---|---|---|
| A. 링 확대 | 132→156px | 내부 chord 확보, 숫자 유지 | 344px 팝오버에서 과점유. 모바일 bottom sheet 높이 증가. 원인보다 표면을 키운다. |
| B. 숫자 상한 축소 | `--hy-num` 1.85→1.55 | 가장 작은 수정 | 57초에도 생기는 링·라벨 충돌을 해결하지 못한다. 클라이맥스 손실. |
| C. 라벨 fade | `I>0.7`에서 opacity 감소 | 후반 숫자 강조 | “무엇의 숫자인가” 정보를 임박할수록 지운다. reduce-motion 정보 보존 실패. |
| D. 라벨을 링 밖으로 이동 | 링과 라벨을 두 grid row로 분리 | 충돌 원인 제거, 숫자 상한·링 유지, fallback font 안전 | 세로 22px 증가. 시트 scroll 예산 안에서 수용 가능. |

**채택: D. 라벨을 링 밖 독립 행으로 이동한다.**

### DOM 목표

```tsx
<div className="dt-count">
  <div className="dt-count-ringbox">
    <svg className="dt-ring">…</svg>
    <div className="dt-count-core">
      <strong>{remainS}</strong><span>초</span>
    </div>
  </div>
  <p className="dt-count-label">최초공개까지</p>
</div>
```

라벨은 `.dt-count-ringbox` 밖 형제다. absolute를 사용하지 않는다.

### 웹 기하 `≥641px`

| 요소 | 값 | 이유 |
|---|---:|---|
| `.dt-count` | `132 × 154px` | `132 ring + 8 gap + 14 label`의 합. |
| `.dt-count-ringbox` | `132 × 132px` | 기존 링 자산·비율 유지. |
| `.dt-ring` | `132 × 132px` | 기존 viewBox 유지. |
| ring stroke | `7 user unit = 9.24px` | 기존 시각 무게 유지. |
| ring 안쪽 지름 | `106.92px` | `2×(44×1.32−9.24/2)`. |
| `.dt-count-core` | `82px` 고정 폭, 높이는 숫자 line box | 최대 2자리+단위가 움직여도 중심 고정. |
| `strong` | `min-width:2ch; text-align:right` | `10→9`에서 단위 x좌표 고정. |
| 단위 | `12px`, gap `2px` | 기존 값 유지. |
| 라벨 | `132 × 14px`, `11/14px`, nowrap | Pretendard fallback에서도 링과 독립. |

### 모바일 기하 `≤640px`

| 요소 | 값 | 이유 |
|---|---:|---|
| `.dt-count` | `120 × 140px` | `120 ring + 6 gap + 14 label`. 세로 시트 예산 14px 절약. |
| `.dt-count-ringbox` | `120 × 120px` | 320px viewport의 content 288px에서 41.7% 점유. |
| `.dt-ring` | `120 × 120px` | 모바일 전용 실제 크기. |
| ring stroke | `6 user unit = 7.20px` | 링 축소율보다 stroke를 조금 더 줄여 내부 지름 확보. |
| ring 안쪽 지름 | `98.40px` | `2×(44×1.2−7.2/2)`. |
| `.dt-count-core` | `76px` 고정 폭 | 최대 숫자+11px 단위 수용. |
| 숫자 base | `24px × --hy-num` | 링 크기 9.1% 감소에 맞춰 base를 7.7% 감소. |
| 단위 | `11px`, gap `2px` | 작은 링의 비례 유지. |
| 라벨 | `120 × 14px`, `11/14px`, nowrap | 문구는 줄이거나 fade하지 않는다. |

### 초별 목표 box 표

아래는 CSS line box 기준이다. glyph ink box는 Pretendard 로드 후 Playwright `getBoundingClientRect()`로 재측정한다.

| 남은 초 | `I` | `--hy-num` | 웹 숫자 line box | 모바일 숫자 line box | 웹/모바일 ring | 웹/모바일 전체 box |
|---:|---:|---:|---:|---:|---:|---:|
| 60 | 0.000000 | 1.0500 | `82 × 27.30px` | `76 × 25.20px` | `132 / 120px` | `132×154 / 120×140px` |
| 30 | 0.320807 | 1.2664 | `82 × 32.93px` | `76 × 30.39px` | 동일 | 동일 |
| 10 | 0.734082 | 1.6107 | `82 × 41.88px` | `76 × 38.66px` | 동일 | 동일 |
| 3 | 0.916329 | 1.7735 | `82 × 46.11px` | `76 × 42.56px` | 동일 | 동일 |
| 1 | 0.971745 | 1.8241 | `82 × 47.43px` | `76 × 43.78px` | 동일 | 동일 |

`I=1`의 절대 최대는 웹 `48.10px`, 모바일 `44.40px`다. 웹 최대 line box는 링 안쪽 지름의 45.0%, 모바일은 45.1%다. 중심부 공백이 양쪽에서 같은 비율로 남는다.

### 좁은 화면 양보 순서

1. `320~640px`: 위 모바일 값 고정. 링·라벨·44px 닫기 타깃은 양보하지 않는다.
2. `280~319px`: 시트 좌우 padding을 `16→12px`로 먼저 줄인다.
3. 그래도 부족하면 링을 `120→112px`, 숫자 base를 `24→22px`, core를 `76→70px`로 함께 줄인다.
4. 라벨 `11px`, 닫기 타깃 `44px`, 본문 대비는 끝까지 유지한다.
5. 날짜·특별한 날 텍스트가 먼저 wrap한다. 링은 가로 overflow를 만들지 않는다.

왜 padding이 먼저인가: 280px viewport에서 16px padding을 유지해도 content는 248px라 120px 링이 들어간다. 실제 압박은 날짜 헤더와 닫기 버튼이다. padding 8px 회수로 이 충돌을 먼저 완화한다.

### CSS 변수·selector

- 새 변수 없음. 기존 `--hy-num` 유지.
- 새 selector: `.dt-count-ringbox`.
- 변경 selector: `.dt-count`, `.dt-ring`, `.dt-count-core`, `.dt-count-label`.
- 삭제: `.dt-count-label { position:absolute; bottom:14px; }`.
- `hype-curve.ts` 시그니처 변경 없음.

---

## 3.2 팝오버 연속 배경색

### 후보안

| 안 | 내용 | 장점 | 탈락 이유 |
|---|---|---|---|
| A. `hue-rotate`/`backdrop-filter` 변화 | 시트 전체 filter를 I로 변경 | 코드가 짧음 | 넓은 offscreen repaint, 텍스트색까지 변형, 대비 계산 불안정. 금지. |
| B. 금빛 pseudo overlay opacity | base 위에 warm layer를 합성 | opacity compositor 가능 | 반투명 material·어두운 poster와 합성된 최종 HEX가 배경마다 달라진다. 대비를 고정할 수 없다. |
| C. 불투명 `color-mix()` background | 두 고정 HEX를 `W_s`로 직접 보간 | 최종 색·대비가 계산 가능. 카드/선과 같은 I 사용. | 10Hz마다 시트 paint. 면적이 작고 한 장뿐이라 예산 내. |

**채택: C. teaser 시트만 불투명 `color-mix(in srgb, …)`를 사용한다.**

### 상태 class

- `teaserActive`인 팝오버에 `.is-teaser`를 공개 전 전체 시간 동안 붙인다.
- `.is-hype`는 기존처럼 60초 이내에만 붙인다.
- `.is-teaser`는 `backdrop-filter:none`과 불투명 base를 담당한다. 따라서 60초 경계에서 material→opaque 점프가 없다.
- 일반 일정 팝오버 material은 변경하지 않는다.

### 채널

```ts
sheetWarm = Math.pow(I, 1.35); // 0→1
```

`HypeChannels`에 `sheetWarm: number`를 추가한다. `hypeCssVars()`는 `--hy-sheet-warm`을 소수점 3자리로 쓴다.

CSS:

```css
.agenda-detail-sheet.is-teaser {
  --hy-sheet-cool: #fffdf6;
  --hy-sheet-hot: #fff0d2;
  --hy-sheet-main: #2b2415;
  --hy-sheet-sub: #665b48;
  background: color-mix(
    in srgb,
    var(--hy-sheet-cool) calc((1 - var(--hy-sheet-warm)) * 100%),
    var(--hy-sheet-hot)
  );
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
```

구현 시 `calc((1 - var()) * 100%)`의 Safari 지원 대상 버전을 실제 target matrix로 확인한다. 실패 시 JS가 `--hy-sheet-bg` 완성 HEX를 써서 `background:var(--hy-sheet-bg)`로 fallback한다. **확인 필요.**

### 라이트 팔레트와 대비

- cool: `#FFFDF6`
- hot: `#FFF0D2`
- main: `#2B2415`
- secondary: `#665B48`
- 금빛 텍스트 endpoint: 기존 `#A35F05`는 hot 배경에서 `4.44:1`이라 AA 미달이다. `#9A5800`으로 교체하면 `4.95:1`이다.

WCAG 상대휘도 계산 결과:

| `I` | `W_s=I^1.35` | 배경 HEX | main 대비 | secondary 대비 |
|---:|---:|---:|---:|---:|
| 0 | 0.000 | `#FFFDF6` | 15.11:1 | 6.54:1 |
| 0.25 | 0.154 | `#FFFBF0` | 14.87:1 | 6.44:1 |
| 0.50 | 0.392 | `#FFF8E8` | 14.52:1 | 6.29:1 |
| 0.75 | 0.678 | `#FFF4DE` | 14.10:1 | 6.11:1 |
| 1 | 1.000 | `#FFF0D2` | 13.65:1 | 5.91:1 |

최저 secondary 대비 `5.91:1`; 전 구간 AA `4.5:1` 이상이다.

### 눈 편한 테마 팔레트와 대비

`html[data-eye-comfort]`는 현재 전체 화면에 `saturate(.8) brightness(.96) sepia(.1)`를 적용한다: `app/globals.css:1218-1231`. 입력값과 필터 후 예상 픽셀을 모두 고정한다.

- 입력 cool: `#FFFBEF`
- 입력 hot: `#FFEFCB`
- 입력 main: `#292219`
- 입력 secondary: `#62563F`
- ring gold endpoint: `#FFB52E`; 필터 후 약 `#E8B351`. 기존 `#F0A83A`의 필터 후 `#DBA756`보다 노랑 성분을 남겨 갈색 탁함을 줄인다.
- 숫자 gold text endpoint: `#9A5800`; 필터 후 약 `#875819`, hot 배경 대비 `5.11:1`.

CSS filter 행렬을 순서대로 적용한 예상값:

| `I` | 입력 배경 | 예상 렌더 배경 | 예상 main / 대비 | 예상 secondary / 대비 |
|---:|---:|---:|---:|---:|
| 0 | `#FFFBEF` | `#FCF6E7` | `#27221A` / 14.69:1 | `#5E5442` / 6.86:1 |
| 0.25 | `#FFF9E9` | `#FCF4E3` | 동일 / 14.47:1 | 동일 / 6.76:1 |
| 0.50 | `#FFF6E1` | `#FBF1DC` | 동일 / 14.15:1 | 동일 / 6.61:1 |
| 0.75 | `#FFF3D7` | `#FAEED4` | 동일 / 13.76:1 | 동일 / 6.43:1 |
| 1 | `#FFEFCB` | `#F9EACB` | 동일 / 13.34:1 | 동일 / 6.23:1 |

필터 계산은 CSS Color/Filter 행렬과 8-bit rounding을 따른 예상치다. 브라우저 색관리·디스플레이 프로파일 차이가 있으므로 Playwright screenshot을 sRGB PNG로 저장하고 중앙 5×5px 평균을 다시 측정해야 한다. 통과 기준은 표 값 대비 오차 `±2 RGB`, 대비 최저 `≥4.70:1`이다. 4.5가 아니라 4.70을 gate로 두는 이유는 raster·필터 rounding 여유 0.20이다.

### 같은 I 계약

- 카드: `--hy-gold`, `--hy-glow`.
- 팝오버: 기존 변수 + `--hy-sheet-warm`.
- 리더선: `--hy-gold`, pulse final vars.
- 세 곳 모두 별도 state로 I를 만들지 않는다. 같은 scheduler tick의 `HypeMotionFrame`을 각 host에 쓴다.

### 적용 selector

- `.agenda-detail-sheet.is-teaser`
- `html[data-eye-comfort] .agenda-detail-sheet.is-teaser`
- `.agenda-detail-sheet.is-hype .dt-ring-progress`
- `.agenda-detail-sheet.is-hype .dt-count-core strong`
- `.detail-anchor-link.is-hype`

---

## 3.3 리더 점선 속도·pulse·합성 비용

### 후보안

| 안 | 내용 | 장점 | 탈락 이유 |
|---|---|---|---|
| A. 기존 line에서 `stroke-width`, `stroke-dasharray`, `r` 직접 animation | DOM 변경 최소 | 요구 모양을 바로 만듦 | 매 frame SVG paint. full-surface SVG에서 비용 위험. |
| B. `stroke-dashoffset` 유지 + pulse 복제선 opacity | pulse는 compositor 가능 | 구현 중간 난이도 | 흐름 자체는 계속 paint. 저사양에서 가장 긴 line이 병목. |
| C. line-local `<g>`를 transform하고 pulse 복제선을 opacity 합성 | 흐름·pulse·dot 모두 transform/opacity. 고정 dash·stroke | SVG local 좌표 변환 markup 추가 | Safari의 SVG `<g>` 합성 승격은 실측 필요. |

**채택: C. 외부 SVG 경로는 유지하되 내부를 line-local 좌표계로 바꾼다.**

### SVG 구조 목표

```tsx
<svg className="detail-anchor-link">
  <defs>
    <clipPath id={clipId}>
      <rect x="0" y="-5" width={length} height="10" />
    </clipPath>
  </defs>
  <g transform={`translate(${x1} ${y1}) rotate(${angleDeg})`}>
    <g className="detail-anchor-flow" clipPath={`url(#${clipId})`}>
      <line className="detail-anchor-base" x1="-11" x2={length + 11} y1="0" y2="0" />
      <line className="detail-anchor-pulse" x1="-11" x2={length + 11} y1="0" y2="0" />
    </g>
  </g>
  <circle className="detail-anchor-dot" cx={x1} cy={y1} r="5.5" />
</svg>
```

- base dash: `5 6`; 합 `11px`.
- pulse dash: `7 4`; 합도 `11px`. 같은 반복 길이라 flow seam이 일치한다.
- base stroke-width: 웹 `2.5px`, 모바일 `2.25px`; 시간에 따라 변경하지 않는다.
- pulse stroke-width: 웹 `5px`, 모바일 `4.5px`; 시간에 따라 변경하지 않는다.
- pulse 때 굵기·밝기·간격이 바뀌어 보이는 것은 두 고정 raster의 opacity crossfade다.
- dot의 `r`는 `5.5` 고정하고 `transform:scale()`만 바꾼다.

### dash 속도 곡선

기존 `1.8→0.6s`, 지수 `1.3`을 다음으로 변경한다.

```ts
dashDurationS = lerpPeriod(2.2, 0.52, I, 1.15);
```

왜 이 값인가:

- 시작 `2.2s`: 60초 경계의 `I≈0`에서 현재 1.8s보다 22% 느려 “갑자기 켜짐”을 줄인다.
- 끝 `0.52s`: 현재 0.6s보다 13.3% 빨라 마지막 3초의 차이를 눈으로 읽을 수 있다.
- 지수 `1.15`: 기존 1.3보다 중반 가속을 앞당긴다. pulse opacity는 여전히 높은 지수라 선이 일찍 요란해지지는 않는다.
- `0.52s`는 밝기 pulse 주기가 아니다. dash texture 이동만 하므로 flash 빈도에 포함하지 않는다.

| 남은 초 | `I` | 기존 주기 | 새 dash 주기 | texture 속도 `11/P` |
|---:|---:|---:|---:|---:|
| 60 | 0.000000 | 1.800s | 2.200s | 5.00px/s |
| 30 | 0.320807 | 1.236s | 1.174s | 9.37px/s |
| 10 | 0.734082 | 0.770s | 0.674s | 16.32px/s |
| 3 | 0.916329 | 0.646s | 0.561s | 19.61px/s |
| 1 | 0.971745 | 0.615s | 0.533s | 20.64px/s |

### master pulse 주기와 파형

pulse 주기는 기존 card ring 주기와 동일하다.

```ts
pulseDurationS = ringDurationS; // 2.4→0.55s, frequency interpolation
```

위상 `q∈[0,1)`의 파형:

\[
B(q)=
\begin{cases}
S(q/0.20) & 0 \le q < 0.20 \\
1-S((q-0.20)/0.35) & 0.20 \le q < 0.55 \\
0 & 0.55 \le q < 1
\end{cases}
\]

`S(x)=6x^5-15x^4+10x^3`.

- 수축/상승: 주기의 20%.
- 이완: 35%.
- 정지: 45%.
- 최소 주기 `0.55s`에서 상승 `110ms`, 이완 `192.5ms`, 휴지 `247.5ms`다.
- 10Hz commit에서도 상승 구간에 최소 한 sample이 들어간다. 12% 상승은 `66ms`라 sample을 놓칠 수 있어 탈락시켰다.

### 진폭 함수

```ts
leaderPulsePeak = 0.70 * I ** 1.6;
hopePeakScale = 1 + 0.08 * I ** 1.4;
dotPeakScale = 1 + 0.45 * I ** 1.6;
```

JS는 multiplication이 끝난 최종값을 쓴다. CSS에서 custom property끼리 곱하지 않는다.

```ts
leaderPulseOpacity = leaderPulsePeak * B(q);
hopeScale = 1 + (hopePeakScale - 1) * B(q);
dotScale = 1 + (dotPeakScale - 1) * B(q);
```

| `I` | pulse 주기 | pulse line peak opacity | `.dt-hope` peak scale | dot peak scale |
|---:|---:|---:|---:|---:|
| 0 | 2.400s | 0.000 | 1.000 | 1.000 |
| 0.25 | 1.179s | 0.076 | 1.011 | 1.049 |
| 0.50 | 0.837s | 0.231 | 1.030 | 1.148 |
| 0.75 | 0.660s | 0.442 | 1.053 | 1.284 |
| 1 | 0.550s | 0.700 | 1.080 | 1.450 |

왜 최대 scale이 이 값인가:

- `.dt-hope` 1.08은 44px 타깃의 시각 외곽을 3.52px 늘리지만 실제 hit box는 고정이다. 1.10 이상은 옆 요소와 충돌 가능성이 커진다.
- dot 1.45는 지름 `11→15.95px`. 기존 `r:5→9`의 지름 18px보다 작아지지만 밝은 5px pulse line과 합쳐져 더 선명하다.
- pulse opacity 0.70은 base 선을 완전히 덮지 않는다. peak에서도 dash 흐름 방향이 남는다.

### 카드 링 위상

- 기존 세 ring의 `animation-delay:-.33P/-.66P`를 제거한다.
- 세 ring은 서로 다른 base scale `1.000 / 1.035 / 1.070`을 갖지만 같은 `B(q)`에서 pulse한다.
- primary ring의 peak가 `.dt-hope`, leader pulse, dot peak와 같은 q=`0.20`에 온다.
- ring2·ring3은 `--hy-ring2`, `--hy-ring3` 강도에 따라 늦게 보이지만 별도 시간 peak를 만들지 않는다. 세 겹이 동시에 pulse하므로 flash는 한 번으로 센다.

### 위상 계산

duration이 계속 바뀌므로 `elapsed/currentPeriod`로 phase를 만들면 period 변경 때 점프한다. 빈도를 시간에 대해 적분한다.

```ts
phase = fract(integral(from 60s to now, 1 / ringDurationS(I(t)) dt));
dashPhase = fract(integral(from 60s to now, 1 / dashDurationS(I(t)) dt));
```

구현은 `lib/ui/hype-curve.ts` module-level 10ms trapezoid LUT를 사용한다.

- 구간: 0~60,000ms.
- step: 10ms.
- sample: 6,001개.
- Float64Array 두 개: 약 `96KB`.
- 10ms는 요구 정밀도와 같고 100ms visual commit보다 10배 촘촘하다.
- 1ms reference 적분과 전 구간 phase 오차 `<0.005 cycle`이어야 한다.
- module init 목표: desktop `<1ms`, 4× CPU throttle `<3ms`. 초과하면 20ms LUT로 바꾸되 같은 phase error gate를 통과해야 한다. **측정 전 확정 불가.**

### compositor 흐름

- outer `<g>`가 line의 translate/rotate 좌표계를 만든다.
- inner `.detail-anchor-flow`만 local x축 `0→-11px` transform한다.
- WAAPI 또는 CSS transform animation을 사용하고 duration만 `--hy-dash-dur`로 갱신한다.
- 구현 우선안은 WAAPI다. 10Hz tick에서 `effect.updateTiming({duration})` 후 `currentTime=dashPhase×duration`으로 절대 phase를 재동기화한다.
- Safari에서 SVG `<g>` transform이 compositor layer로 승격되지 않으면 fallback은 흐름을 정지시키고 pulse opacity+dot transform만 유지한다. paint-heavy `stroke-dashoffset`으로 되돌아가지 않는다.

### 광과민성 계산

- `I=1` master pulse 주기: `0.55s`.
- 정상상태 pulse peak 빈도: `1/0.55 = 1.818 flashes/s`.
- 임의 1초 창에 들어오는 주기 peak 최댓값: 2회.
- T=0 공개 단발 flash가 같은 1초 창에 추가되는 최악값: `2 + 1 = 3회`.
- WCAG 2.3.1은 1초에 **3회를 초과**하는 flash를 금지한다. 최악값 3은 초과하지 않는다. [W3C SC 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)
- dash translate는 opacity·색을 바꾸지 않아 flash로 세지 않는다.
- `dt-count-tick`은 transform만 사용한다.
- ring 세 겹은 같은 위상에서 동시에 peak하므로 하나의 flash event다.
- 구현 후 PEAT 측정이 이 계산보다 우선한다. 실패하면 주기는 유지하고 `leaderPulsePeak 0.70→0.45`, ring peak opacity를 30% 줄인다.

### 채널 변경

`HypeChannels` 추가·변경:

```ts
sheetWarm: number;
leaderPulsePeak: number;
hopePeakScale: number;
dotPeakScale: number;
dashDurationS: number; // endpoint와 exponent 변경
```

새 frame 타입:

```ts
type HypeMotionFrame = {
  pulsePhase: number;
  dashPhase: number;
  leaderPulseOpacity: number;
  hopeScale: number;
  dotScale: number;
  ringScale1: number;
  ringScale2: number;
  ringScale3: number;
};
```

새 CSS 변수:

- `--hy-sheet-warm`
- `--hy-leader-pulse`
- `--hy-hope-scale`
- `--hy-dot-scale`
- `--hy-ring-scale-1/2/3`
- `--hy-dash-phase` — 진단·WAAPI 동기화용

적용 selector:

- `.detail-anchor-flow`
- `.detail-anchor-base`
- `.detail-anchor-pulse`
- `.detail-anchor-dot`
- `.agenda-detail-sheet.is-hype .dt-hope`
- `.public-event.teaser.hype-live::before/::after`
- `.public-event.teaser.hype-live .teaser-ring`

---

## 3.4 부제목 공개 stagger

### 후보안

| 안 | 표현 | 위계 적합성 | 비용·탈락 이유 |
|---|---|---|---|
| A. 제목과 같은 scramble | 부제목도 난수→확정 | 제목과 같은 사건처럼 보임 | 중복·싸구려 인상, 글자 수만큼 60ms state update 증가. 탈락. |
| B. 글자 단위 상승 | 각 글자를 아래 4px에서 올림 | 세밀하고 귀여움 | 긴 두 줄에서 span 수 폭증, 줄바꿈 단위와 DOM 단위 불일치. 탈락. |
| C. blur 해제 | `blur(6px)→0` + opacity | “초점이 맞는” 어휘 | text filter가 paint를 유발하고 눈 편한 테마의 전역 filter와 합성된다. 탈락. |
| D. 고정 box 안 mask-rise | 최종 레이아웃에 둔 채 inner만 `translateY(4px)+opacity` | 제목보다 조용하고 아래 정보가 따라오는 방향성이 명확 | inner wrapper 1개 필요. transform/opacity라 비용 낮음. |

**채택: D. overflow-mask 상승.**

### 마크업 계약

- 서버 공개 응답 전에는 실제 제목·부제목·태그색을 절대 render하지 않는다.
- `revealTeaserAction()`이 공개 DTO를 반환한 뒤 첫 render에서 제목·부제목·태그를 모두 mount한다.
- 각 secondary element의 외부 box는 정상 flow에 즉시 참여한다.
- 시각 애니메이션은 내부 `.reveal-secondary-inner`에만 적용한다.

```tsx
<li className="reveal-secondary" style={{ "--reveal-order": order }}>
  <span className="reveal-secondary-inner">{sub}</span>
</li>
```

태그 chip은 chip 자체가 final layout에 참여하고 내부 content만 움직인다. chip border/background를 늦게 만들지 않는다. 태그색은 공개 DTO를 받은 뒤에만 존재한다.

### 타임라인

기준 `T=0`: 공개 DTO가 state에 commit되고 `.just-revealed`/`.reveal-burst`가 붙은 첫 frame.

| 요소 | 시작 | 지속 | 이징 | 종료 |
|---|---:|---:|---|---:|
| 제목 전체 난수 | 0ms | 750ms | 기존 60ms step | 750ms |
| 제목 글자 확정 | 750ms | `90ms × 글자수` | 기존 lock-in `cubic-bezier(.2,1.6,.4,1)` | 제목 길이 의존 |
| 첫 부제목 | 1,020ms | 360ms | `cubic-bezier(.22,1,.36,1)` | 1,380ms |
| 부제목 n | `1,020 + min(n,3)×70ms` | 360ms | 동일 | 최대 1,590ms |
| 시간·메타 | `1,020 + min(subCount,4)×70 + 80ms` | 320ms | `cubic-bezier(.22,1,.36,1)` | 최대 1,700ms |
| 첫 태그 | 메타 시작+70ms | 300ms | `cubic-bezier(.16,1,.3,1)` | 최대 1,750ms |
| 둘째 태그 | 첫 태그+50ms | 300ms | 동일 | 최대 1,800ms |

왜 `70ms`인가: 60Hz 기준 약 4.2 frame 간격이라 개별 행 순서는 보이지만 100ms 이상처럼 끊긴 목록으로 느껴지지 않는다.

왜 duration `360ms`인가: 60Hz 기준 약 22 frame. 4px 이동이 300ms 이하면 “툭”, 450ms 이상이면 제목 scramble 뒤에 처진다. 기존 sheet reveal 900ms가 끝난 뒤 120ms 후 시작해 팝오버의 큰 변신과도 겹치지 않는다.

### keyframe

```css
@keyframes reveal-secondary-rise {
  from {
    opacity: 0;
    transform: translate3d(0, 4px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}
```

외부 `.reveal-secondary`는 `overflow:clip`; fallback은 `overflow:hidden`. 높이·margin·padding은 animation하지 않는다.

### 데이터 경우별 동작

#### 부제목 없음

- 빈 placeholder를 만들지 않는다.
- 메타 시작은 `1,100ms = 1,020 + 80`.
- 태그가 있으면 첫 태그는 `1,170ms`.
- 빈 단계 때문에 전체 연출이 늦어지지 않는다.

#### 부제목 2줄 이상 wrap

- DOM `li` 하나를 한 단위로 움직인다. 시각 line별 span을 만들지 않는다.
- final width에서 먼저 wrap한 뒤 전체 block이 4px 상승한다.
- `getBoundingClientRect().height`는 T=0부터 종료까지 `±0.25px` 이내여야 한다.

#### 태그 chip 있음

- 태그 container와 chip 외곽 box는 T=0부터 최종 크기다.
- chip 내부 dot+label만 opacity/translateY `3px`를 사용한다.
- 최대 태그 2개를 `50ms` stagger한다.
- 태그색은 서버 공개 응답 전 DOM·inline style·CSS 변수에 없어야 한다.

#### 웹 카드

- `.event-subs li`, `.event-meta`, `.pill-dots`에 적용한다.
- 이어지는 span 카드 `.span-cont`에는 적용하지 않는다. 시작 칸에서만 연출한다.

#### 모바일 아젠다

- `.agenda-subs li`, `.agenda-sub`, `.agenda-meta`, `.pill-dots`에 적용한다.
- 기존 `.agenda-content` 전체 `reveal-glitch`는 제목 wrapper로 축소한다. secondary의 조용한 위계를 글리치가 깨지 않게 한다.

#### 열린 팝오버

- `.agenda-detail-subs li`, `.agenda-detail-tags .agenda-detail-tag`에 적용한다.
- sheet `reveal-burst`는 900ms에 끝난다. secondary는 1,020ms부터 시작한다.

### reduce-motion

- `html[data-reduce-motion]`에서 secondary animation은 `none`.
- base style은 `opacity:1; transform:none`; hidden 값을 base rule에 두지 않고 keyframe `from`에만 둔다.
- 공개 DTO가 도착한 첫 frame에 모든 정보가 완성 상태로 보인다.

### `justRevealed` lifetime

현재 최소 유지 시간은 2,400ms다: `public-poster.tsx:1496-1511`. 새 secondary 최대 종료 1,800ms이므로 기존 lifetime 안에 600ms 안정 프레임이 남는다. lifetime 상수 변경 없음.

---

## 4. 동기화 계약

### 4.1 단일 시간 입력

```text
correctedNowMs + revealAt
        ↓
remainMs
        ↓
hypeIntensity(remainMs)
        ↓
hypeChannels(I) + hypeMotionFrame(remainMs)
        ↓
같은 rAF timestamp에서 카드 / 팝오버 / 외부 리더 SVG write
```

- KST는 공개 시각 생성·표시의 기준이다. 클라이언트 곡선은 ISO epoch 차만 계산한다.
- `Date.now()` 직접 호출 두 곳은 기존 보정 시계 adapter로 치환한다. 보정 adapter 실제 위치는 구현 전 확인 필요다.
- 별도 React state로 popup I, line I를 만들지 않는다.

### 4.2 10Hz 예산 유지

- 숫자: 기존 `setInterval(1000)` React state.
- 시각: 하나의 `setInterval(100)`이 rAF 하나를 예약한다.
- 여러 teaser host는 같은 tick timestamp를 subscriber로 받는다.
- 각 host write는 CSS variable 직접 write. React render 없음.
- `document.hidden`이면 tick을 skip한다.
- background 복귀 첫 tick은 중간 frame을 재생하지 않고 현재 절대 phase로 snap한다.

기존 카드·팝오버 두 interval을 그대로 두면 시작 시각 차로 최대 100ms phase offset이 생길 수 있다. 4차에서는 scheduler source만 공유하되 다음 경로는 유지한다.

- 카드 host writer가 카드 변수를 쓴다.
- detail writer가 sheet와 팝오버 밖 `.detail-anchor-link`를 함께 쓴다.
- 즉 “리더선은 detail scheduler 경로에서 변수 write” 계약은 유지한다.

### 4.3 phase drift 허용치

- 카드 primary ring peak와 leader pulse peak 차이: desktop `≤16.7ms`, 60Hz 한 frame.
- 30Hz 저사양 환경: `≤33.4ms`.
- CSS animation `animationstart` 시간 비교로 검증하지 않는다. computed final var와 screenshot luminance peak timestamp를 비교한다.

### 4.4 정적 모드

- `quantizeStaticIntensity()`의 `0 / .25 / .6 / 1`을 유지한다.
- reduce-motion/export에서는 `B(q)=0`; pulse·dash transform은 정지한다.
- background·숫자 크기·고정 링 opacity는 양자화 I에서 계산해 임박 정보를 남긴다.
- 같은 fixture input은 capture 실행 시각과 무관하게 같은 픽셀이어야 한다.

---

## 5. 접근성·성능 검증

### 5.1 대비 gate

- 라이트 secondary 최저: `5.91:1`.
- 눈 편한 테마 secondary 예상 최저: `6.23:1`.
- 금빛 숫자 endpoint `#9A5800`의 라이트 hot 배경 대비: `4.95:1`.
- 눈 편한 필터 후 예상 대비: `5.11:1`.
- 자동 gate: 계산값 `≥4.70:1`; 수동 요구 기준 `≥4.5:1`.
- 한 sample이라도 4.5 미만이면 해당 palette 전체를 폐기하고 endpoint를 다시 고른다.

### 5.2 flash gate

- 정상 pulse `1.818Hz`.
- 임의 1초 최악: 주기 peak 2 + 공개 단발 1 = 3.
- 허용: 3 이하. 금지: 3 초과.
- PEAT에서 화면 전체·카드 crop·팝오버 crop을 각각 검사한다.

### 5.3 repaint·합성 비용

| 변경 속성 | 예상 pipeline | 최악 면적/빈도 | 결정 |
|---|---|---|---|
| sheet `background` color-mix | style + paint | 웹 `344×520×10 ≈ 1.79M px/s`; 모바일 390×591 가정 `≈2.30M px/s` | 요구상 허용. 한 시트만. |
| animated `backdrop-filter` | offscreen raster + paint | 시트와 뒤 포스터 | 금지. teaser에서 filter 자체 제거. |
| line `stroke-dashoffset` | SVG paint | 긴 line, CSS 60fps | 제거. |
| line `stroke-width/dasharray` | SVG paint | pulse마다 | 제거. 고정 복제선 opacity로 대체. |
| local `<g>` transform | compositor 후보 | line raster 1 layer | 채택. Safari Layers 확인 필요. |
| pulse line opacity | compositor 후보 | line raster 1 layer | 채택. |
| dot `transform:scale` | compositor | 약 16×16px | 채택. |
| subtitle opacity/translate | compositor | 공개 후 300~360ms | 채택. |
| subtitle blur | paint | 텍스트 전체 | 금지. |

`will-change`는 `.is-hype` lifetime에만 둔다. 공개 후 class가 빠지면 즉시 제거한다. 상시 layer 승격 금지.

### 5.4 성능 gate

저사양 Android Chrome, Safari 실제 기기 또는 동급 throttle:

- 10Hz scheduler callback p95 `<2ms`.
- rAF write p95 `<1ms`.
- reveal burst 포함 5초 구간 dropped frame `<5%`.
- 50ms 이상 long task `0`.
- line length 1,200px에서도 SVG paint event가 매 frame 발생하지 않는다.
- 동시에 5 teaser가 60초 이내여도 ticker는 1개다.

### 5.5 동작 줄이기 snapshot

각 raw I를 정적 단계로 변환해 캡처한다.

| raw I | static I | 움직임 | 남는 정보 |
|---:|---:|---|---|
| 0 | 0 | 없음 | 기본 보라, 작은 숫자 |
| 0.10 | 0.25 | 없음 | 약한 warmth·ring |
| 0.50 | 0.60 | 없음 | 중간 금빛·큰 숫자 |
| 0.90 | 1 | 없음 | 최대 warmth·굵은 정적 링·최대 숫자 |

`html[data-reduce-motion]`은 OS media query보다 우선한다. CSS에서 `prefers-reduced-motion`을 새로 사용하지 않는다.

---

## 6. 실패 모드와 방어

| 실패 조건 | 증상 | 방어 |
|---|---|---|
| Pretendard 로드 지연 | 숫자·라벨 advance 변경 | 라벨을 링 밖에 둔다. core 고정 폭+2ch. visual test는 `document.fonts.ready` 후 측정. fallback 상태에서도 overflow 0 확인. |
| 탭 background 복귀 | animation catch-up, phase 불일치 | hidden 동안 skip. 복귀 첫 shared tick에서 절대 remainMs와 적분 phase를 다시 계산. catch-up frame 재생 금지. |
| 보정 시계가 앞으로 점프 | 숫자 여러 초 skip | 중간 숫자 재생 금지. 현재 초와 phase로 즉시 이동. 서버 공개 응답이 최종 gate. |
| 보정 시계가 뒤로 250ms 이상 이동 | dash·ring 역행 | 한 tick 동안 transition을 끄고 새 phase로 snap. 숫자는 floor 정책 유지. telemetry에 clock correction 기록 여부 확인 필요. |
| 느린 기기 | 100ms tick 누적 | interval callback을 queue하지 않는다. 이전 rAF가 pending이면 새 예약 생략, 최신 timestamp만 보관. |
| 280px 좁은 화면 | 날짜+닫기 충돌, 시트 세로 과점유 | padding→ring/base font 순으로 축소. 닫기 44px·라벨·대비는 유지. |
| 부제목 없음 | 빈 280ms delay | order 계산에서 subCount=0. 메타 1,100ms, tag 1,170ms로 당김. |
| 긴 2줄 이상 부제목 | 줄마다 다른 애니메이션, 높이 jump | `li` block 하나를 이동. 외부 box는 처음부터 final height. |
| 태그 2개 wrap | 두 번째 chip mount 때 높이 증가 | 두 chip 모두 T=0 mount. inner만 stagger. |
| 공개 API 지연 | 카운터 0인데 실제 내용 없음 | 기존 2초 retry 유지. 실제 DTO 전에는 제목·부제목·색 DOM 없음. 보상 연출도 실행하지 않음. |
| 공개 후 새로고침 | 폭죽 반복 | 기존 `celebrate=false` 경로 유지. secondary stagger도 live-watched `justRevealed`에서만. |
| 어두운 poster theme | material 아래색 때문에 gold 갈색화 | `.is-teaser` 불투명 palette, backdrop-filter none. |
| Safari SVG `<g>`가 합성되지 않음 | line transform도 paint | flow animation 정지 fallback. pulse opacity+dot transform은 유지. stroke-dashoffset fallback 금지. |
| export가 pulse 중간 frame 캡처 | PNG 비결정적 | data-reduce-motion 초기화+static quantization. WAAPI cancel/pause assertion. |
| 편집실에서 연출 실행 | 편집 집중 방해·CPU 낭비 | `motionEnabled={interactive}`. `decorate=true`에서 visual subscriber 0개 assertion. |

---

## 7. 검증 체크리스트

실제 DB teaser를 만들지 않는다. `tests/visual/teaser-hype.spec.ts`의 DOM·CSS 변수 주입 패턴을 확장한다. 서버 경계 검증은 fixture DTO로 한다. 불가피한 route 검증도 과거 달 fixture만 사용한다.

### 7.1 단위 테스트 이름

`tests/unit/hype-curve.test.ts`에 추가:

1. `sheetWarm은 I^1.35로 0→1 단조 증가한다`
2. `새 dash 주기는 빈도 공간에서 2.2초→0.52초로 감소한다`
3. `60/30/10/3/1초 dash 기준값이 명세와 일치한다`
4. `master pulse 파형은 한 주기에 국소 최대가 정확히 하나다`
5. `I=1 pulse 빈도는 1.819Hz 미만이다`
6. `hypeMotionFrame은 같은 remainMs에서 mount 시점과 무관하게 같은 phase를 낸다`
7. `10ms LUT phase는 1ms reference와 0.005 cycle 이내다`
8. `phase는 period가 변해도 인접 10ms sample에서 역행하지 않는다`
9. `leader pulse hope dot ring peak는 같은 phase 0.20이다`
10. `static intensity에서는 beat와 dash motion 값이 0이다`
11. `hypeCssVars는 새 채널을 유효한 단위와 소수점으로 직렬화한다`
12. `light palette 다섯 지점의 본문과 보조문 대비가 4.70 이상이다`
13. `eye-comfort 예상 palette 다섯 지점의 대비가 4.70 이상이다`
14. `gold number endpoint 대비가 두 palette에서 4.70 이상이다`

### 7.2 시각 테스트 이름

`tests/visual/teaser-hype.spec.ts`에 추가:

1. `desktop popover label stays outside ring at 60 30 10 3 1 seconds`
2. `mobile popover label stays outside ring at 60 30 10 3 1 seconds`
3. `count core and unit x positions stay fixed across 10 to 9`
4. `280px viewport yields padding before ring and preserves 44px close target`
5. `light teaser sheet warms through five deterministic intensities`
6. `eye-comfort teaser sheet warms through five deterministic intensities`
7. `teaser sheet ignores dark poster pixels behind opaque background`
8. `leader flow period matches 60 30 10 3 1 second specification`
9. `leader pulse hope dot and primary ring peak in same frame`
10. `leader pulse uses transform and opacity without animated stroke width radius or dasharray`
11. `reduced motion freezes leader ring hope and subtitle reveal`
12. `export static intensity produces identical PNG on repeated capture`
13. `revealed secondary boxes keep identical geometry from first to last stagger frame`
14. `two-line subtitle keeps final height during reveal`
15. `missing subtitle advances metadata without empty delay`
16. `two tag chips reserve layout before inner stagger`
17. `mobile agenda glitches title only and leaves secondary hierarchy calm`
18. `open popover completes sheet burst before secondary rise`
19. `decorate mode registers no hype visual subscriber`
20. `unrevealed fixture contains no hidden title subtitle or tag color in DOM`

### 7.3 스크린샷 matrix

- viewport: `1440×1000`, `390×844`, `320×720`, `280×653`.
- 시간: `60/30/10/3/1초`, 공개 `0/+1.02/+1.38/+1.80초`.
- 테마: light, `data-eye-comfort`, dark poster underlay.
- motion: normal, `data-reduce-motion`, export static.
- 내용: subtitle 0개, 1개, 4개, 2줄 wrap, tag 0개, tag 2개.

### 7.4 수동 성능·접근성

- Chrome Performance: Paint flashing, Layers, Main thread.
- Safari Web Inspector: SVG `<g>` layer 승격 확인.
- 실제 iPhone Safari와 저사양 Android Chrome에서 60초→공개까지 녹화.
- PEAT: 전체 화면, 카드 crop, 팝오버 crop.
- PNG pixel sampler: 배경 중앙 5×5 평균과 대비 재계산.

---

## 8. 구현 순서

각 단계는 독립 commit 가능해야 한다. 이전 단계가 통과하지 않으면 다음 단계로 가지 않는다.

### 1단계 — 라벨 기하 버그

- `dt-count-ringbox` 추가.
- web/mobile 고정 box 적용.
- 숫자 2ch, core 고정 폭 적용.
- 60/30/10/3/1초 desktop/mobile geometry test 추가.
- commit: `fix: separate teaser countdown label from ring`

위험이 가장 낮고 현재 가림 버그를 즉시 제거한다.

### 2단계 — 시트 palette·대비

- `.is-teaser` class 추가.
- `sheetWarm` channel과 `--hy-sheet-warm` 추가.
- 라이트·눈 편한 opaque color-mix palette 적용.
- teaser에서 backdrop-filter 제거.
- 대비 단위 테스트와 5지점 screenshot 추가.
- commit: `style: warm teaser sheet with continuous palette`

### 3단계 — deterministic master phase

- 10ms frequency integral LUT 추가.
- `HypeMotionFrame` 추가.
- shared 10Hz timestamp source로 두 writer를 동기화.
- static mode에서 phase motion 0 처리.
- phase·flash 단위 테스트 추가.
- commit: `refactor: synchronize teaser motion phase`

### 4단계 — 리더 compositor 구조

- line-local SVG group·clip·base/pulse line 도입.
- dash curve `2.2→0.52s, α=1.15` 적용.
- dot r animation을 transform으로 교체.
- `.dt-hope`와 card ring을 master beat final vars로 변경.
- Paint flashing·Safari layer 측정.
- commit: `feat: pulse teaser leader on shared beat`

### 5단계 — secondary reveal hierarchy

- secondary inner wrapper와 order 계산 추가.
- web card, mobile agenda, open popover selector 적용.
- mobile glitch 범위를 title로 축소.
- no-subtitle, long-wrap, tags tests 추가.
- commit: `feat: stagger teaser secondary reveal`

### 6단계 — 접근성·export·편집실 gate

- `motionEnabled={interactive}` 적용.
- reduce-motion animation/WAAPI cancel assertion.
- quantized static screenshots.
- DOM private leakage fixture assertion.
- PEAT와 contrast pixel 측정 결과 기록.
- commit: `test: verify teaser craft accessibility and export`

### 7단계 — 비용 정리

- 사용하지 않는 `hype-dot-beat`, `hype-hope-beat`, `detail-link-flow` keyframe 삭제.
- 상시 `will-change`, animated box-shadow, stroke animation 잔존 여부 grep.
- typecheck, lint, unit, visual, production build 실행.
- commit: `cleanup: remove legacy teaser motion paths`

---

## 완료 기준

- 라벨과 링의 pixel 교차 0.
- 60/30/10/3/1초에서 web/mobile count 외곽 box 변화 0px.
- 라이트·눈 편한 palette의 모든 지정 지점 대비 `≥4.70:1`.
- 카드 primary ring, `.dt-hope`, leader pulse, dot peak 차이 1 frame 이하.
- `I=1` 정상 pulse `1.818 flashes/s`; 공개 순간 포함 임의 1초 최대 3회.
- animated `stroke-width`, `stroke-dasharray`, SVG `r`, `stroke-dashoffset` 0건.
- secondary stagger 중 카드·시트 geometry 변화 `≤0.25px`.
- reduce-motion/export에서 animation·WAAPI running instance 0개.
- 편집실 visual hype subscriber 0개.
- 공개 전 DOM·style·CSS variable에 실제 제목·부제목·태그색 0건.
- 실제 DB 테스트 데이터 생성 0건.

