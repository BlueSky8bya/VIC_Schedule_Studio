# 최초공개 긴장 곡선 연속화 계획

- 상태: Research / Design / Implementation plan
- 작성일: 2026-08-03 KST
- 대상: `components/poster/public-poster.tsx`, `components/poster/public-poster.css`
- 범위: 공개 포스터·편집실 공용 최초공개 카드, 상세 팝오버, 리더선, 공개 순간 전환
- 비범위: 서버 비공개 DTO·RLS·최초공개 권한 모델 변경

## 1. 목표와 제약

현재 `h1~h4`, `hs1~hs4` 단계 경계를 제거하고 60초부터 공개 순간까지 하나의 연속 강도 곡선으로 바꾼다.

필수 조건:

- 60초 진입 시 모션이 갑자기 켜지지 않는다.
- 카드 박스와 클릭 타깃은 움직이지 않는다. 카드 내용·장식 레이어만 움직인다.
- 카드·팝오버·리더선은 같은 절대 시간과 강도 값을 사용한다.
- `html[data-reduce-motion]`이 최종 권한이다. 이 속성이 있으면 모든 모션과 모션용 JS 루프를 끈다.
- 모션이 꺼져도 큰 숫자, 색, 라벨, 정적 진행 링으로 임박 상태를 전달한다.
- 초당 3회를 초과하는 번쩍임을 만들지 않는다.
- 레이아웃 속성 애니메이션을 금지한다. `transform`, `opacity`, 제한적 `filter` 중심으로 구현한다.
- Playwright PNG export에서는 결정적인 정지 프레임을 만든다.
- KST 서버 기준과 기존 클라이언트 시계 오차 보정 경로를 유지한다.

> 확인 필요: 현재 `TeaserCountdown`과 상세 팝오버 타이머는 코드상 `Date.now()`를 직접 호출한다. 제품에서 말하는 보정 시각이 상위 계층에서 주입되거나 런타임에서 대체되는지 구현 전에 확인한다. 새 곡선은 보정된 시계 한 곳만 사용해야 한다.

## 2. 벤치마크 근거

| 사례 | 확인 내용 | 적용 포인트 |
|---|---|---|
| YouTube Premiere | 예약 페이지에서 대기·채팅·알림을 먼저 형성하고 시작 직전 선택한 테마의 라이브 카운트다운 영상을 재생한다. [YouTube 공식 도움말](https://support.google.com/youtube/answer/10356739?hl=en) | 긴 대기와 짧은 클라이맥스를 분리한다. T=0에서 같은 자리 콘텐츠를 교체한다. |
| Twitch / 치지직 | Twitch는 `Schedule and Countdowns` Extension 범주를 제공하며 Raid는 90초 카운트다운을 사용한다. [Extension 문서](https://dev.twitch.tv/docs/extensions/life-cycle), [Raid API](https://dev.twitch.tv/docs/api/raids/) | 스트리머 화면을 침범하지 않는 주변 모션을 유지하고 마지막 구간만 숫자를 주인공으로 만든다. 치지직 공식 모션 규격은 확인 필요. |
| NASA T-minus | 실제 발사까지 시간과 작전 시계를 구분하며 마지막 10분을 terminal count로 취급한다. [NASA Countdown 101](https://ntrs.nasa.gov/api/citations/20220004992/downloads/Artemis%20countdown%20101_aj_CLEAN.docx.pdf), [NASA terminal count](https://www.nasa.gov/blogs/missions/2026/02/19/live-artemis-ii-wet-dress-rehearsal-coverage/) | 숫자 외에 현재 국면을 전달한다. 마지막 구간에는 새 효과를 켜기보다 기존 리듬을 압축한다. |
| Apple Timer / Watch | 남은 시간을 중심에 두고 진행 맥락을 시각적으로 보조한다. Always-On 상태에서도 1초 단위 갱신을 사용한다. [Apple Watch 공식 가이드](https://support.apple.com/en-lamr/guide/watch/apdf448955b2/watchos) | 팝오버에 링 진행률과 중앙 대형 숫자를 사용한다. 텍스트는 1Hz로 충분하다. |
| Overwatch·VALORANT류 | 사전 준비 구간과 시작을 분리하고 시작 직전 중앙 타이머의 계층을 높인다. VALORANT는 라운드 전 준비 구간과 UI 가독성을 공식적으로 강조한다. [초보자 가이드](https://playvalorant.com/en-us/news/announcements/beginners-guide/), [UI 개편 설명](https://playvalorant.com/en-us/news/game-updates/preview-the-future-of-valorant-s-interface/) | 초별 반동은 숫자 glyph에만 적용한다. 외곽 컨테이너와 클릭 타깃은 고정한다. 세부 모션 파라미터는 공식 문서가 없어 확인 필요. |
| 라이브 커머스·드롭 | 실제 마감 시계를 상품·CTA 가까이에 둔다. 빨강 대신 브랜드색으로도 긴박감을 만든다. [Shopify 사례](https://www.shopify.com/blog/using-scarcity-urgency-increase-sales), [Shopify Launchpad](https://help.shopify.com/en/manual/promoting-marketing/create-marketing/launchpad) | 보라→금빛 변화만으로 긴박감을 전달한다. 과도한 빨강과 점멸을 피한다. |

## 3. 연속 강도 곡선

### 3.1 정규화 시간

남은 시간 `s`를 초 단위로 두고 60초 구간을 정규화한다.

\[
t=\operatorname{clamp}\left(0,1,\frac{60-s}{60}\right)
\]

- `t=0`: 60초 남음
- `t=1`: 공개 순간

### 3.2 후보 곡선

| 곡선 | 수식 | 평가 |
|---|---|---|
| Power ease-in | \(E=t^\gamma,\ \gamma=1.6\sim2.2\) | 단순하고 마지막으로 갈수록 자연스럽게 가속한다. |
| 정규화 지수 | \(E=(e^{kt}-1)/(e^k-1)\) | 강한 클라이맥스를 만들지만 중반이 너무 조용해질 수 있다. |
| Smootherstep | \(E=6t^5-15t^4+10t^3\) | 시작·끝의 1차·2차 변화가 부드럽다. 진입 램프에 적합하다. |
| 정규화 Logistic | sigmoid를 시작·끝 값으로 정규화 | 변곡점 조절은 좋지만 구현과 튜닝이 복잡하다. |

### 3.3 추천 곡선: 진입 램프 + power

60~55초 진입:

\[
x=\operatorname{clamp}\left(0,1,\frac{60-s}{5}\right)
\]

\[
I=0.08(6x^5-15x^4+10x^3)
\]

55~0초 본 곡선:

\[
u=\operatorname{clamp}\left(0,1,\frac{55-s}{55}\right)
\]

\[
I=0.08+0.92u^{1.7}
\]

Smootherstep를 진입에 쓰는 이유: 60초 경계에서 값과 기울기가 모두 0이라 “켜짐”이 보이지 않는다. 55초 이후 power 곡선은 마지막 15초부터 상승량을 명확히 만든다.

| 남은 시간 | 강도 `I`, 근사 |
|---:|---:|
| 60초 | 0.000 |
| 55초 | 0.080 |
| 45초 | 0.131 |
| 30초 | 0.321 |
| 15초 | 0.615 |
| 8초 | 0.784 |
| 3초 | 0.916 |
| 1초 | 0.972 |
| 0초 | 1.000 |

### 3.4 지각 근거

Stevens 멱법칙 연구에서 물리 휘도와 지각 밝기는 선형 관계가 아니며 평균 지수가 약 `0.32`로 보고됐다. [PubMed 연구](https://pubmed.ncbi.nlm.nih.gov/22984992/)

이 값을 복합 UI 자극에 직접 대입하지 않는다. 다음 설계 원칙만 적용한다.

- 글로우·백색 후광: 높은 지수로 후반에 집중한다.
- 크기·색 변화: 낮은 지수로 중반에도 변화를 감지하게 한다.
- 흔들림: 가장 높은 지수로 제한한다.
- 최종 계수는 사용자 테스트와 성능 측정으로 조정한다.

### 3.5 파라미터 매핑

공통 표기:

\[
L(a,b,\alpha)=a+(b-a)I^\alpha
\]

주기는 직접 보간하지 않고 빈도 `f=1/P`를 보간한다.

| 파라미터 | 시작 → 끝 | 곡선 지수 | 구현 |
|---|---:|---:|---|
| 링 주기 | 2.4s → 0.55s | 빈도 `I^0.85` | `transform`, `opacity` |
| 링 확장 | 1.02 → 1.16 | 1.0 | 고정 pseudo-element의 scale |
| 1번 링 opacity | 0 → 0.72 | 0.9 | 진입부터 표시 |
| 2번 링 opacity | 0 → 0.48 | `max(0,(I-.35)/.65)^1.4` | 중반부터 표시 |
| 3번 링 opacity | 0 → 0.28 | `max(0,(I-.70)/.30)^1.6` | 후반부터 표시 |
| 내용 흔들림 진폭 | 0 → 1.2px | 2.4 | 카드 내용에만 적용 |
| 흔들림 주기 | 1.4s → 0.45s | 빈도 `I^1.6` | 카드 박스 적용 금지 |
| 채도 | 1.0 → 1.42 | 1.1 | 제한적 `filter` |
| hue excursion | 0 → -26deg | 1.8 | 보라색 훼손 방지 |
| hue 주기 | 3.2s → 1.2s | 빈도 `I^1.2` | 느린 색 왕복 |
| 금빛 혼합률 | 0% → 78% | 2.2 | `color-mix()` 또는 fallback RGB |
| 글로우 유효 반경 | 0 → 30px | 0.9 | 고정 blur 레이어의 opacity/scale |
| 숫자 시각 크기 | 1.05em → 1.85em | 1.15 | 고정 슬롯 안 scale |
| 숫자 반동 깊이 | 1.00 → 1.10 | 1.8 | 새 숫자 span만 적용 |
| 리더선 dash 주기 | 1.8s → 0.6s | 빈도 `I^1.3` | `stroke-dashoffset` |
| 따뜻한 백색 후광 | opacity 0 → 0.22 | 4.0 | 반복 점멸 없음 |

링은 항상 3개 렌더한다. DOM을 단계별로 추가하지 않고 opacity로 스며들게 한다.

## 4. 접근성·광과민성

WCAG 2.3.1은 임의의 1초 구간에서 3회를 초과하는 flash를 금지한다. [W3C WCAG 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)

현재 `hype-whiteout 1s`는 단독으로 약 1회/초라 직접 위반으로 보이지 않는다. 그러나 공개 플래시, shine, 팝오버 flash, 스크램블 명도 변화가 합성된 전체 화면은 별도 판정 대상이다.

변경안:

- 마지막 3초 반복 whiteout을 삭제한다.
- `I^4`로 지속 증가하는 따뜻한 후광으로 대체한다.
- T=0 플래시는 500ms 이상 단발 `opacity 0→1→0`로 제한한다.
- 밝기 왕복 효과 합계는 최대 2회/초로 설계한다.
- 글리치는 위치·왜곡만 사용하고 밝기 점멸을 금지한다.
- 최종 화면을 PEAT로 검사한다.

`html[data-reduce-motion]` 상태:

- animation, transition, dash 이동, 숫자 반동, 파티클, 스크램블을 모두 끈다.
- 10Hz visual scheduler를 시작하지 않는다.
- 숫자 텍스트만 1Hz로 갱신한다.
- `공개 임박`, 대형 남은 초, 정적 금빛 테두리, 정적 링으로 상태를 전달한다.
- 스크린리더가 매초 읽지 않게 한다. 필요 시 60/30/10/3초 milestone만 `aria-live="polite"`로 알린다.

## 5. 구현 방식 비교

| 방식 | Safari 지원 | 성능 | 복잡도 | 판단 |
|---|---|---|---|---|
| JS가 CSS 변수를 갱신 | 기본 CSS 변수와 rAF는 폭넓게 지원한다. `color-mix()`는 Safari 16.2+. [Safari 16.2](https://developer.apple.com/documentation/safari-release-notes/safari-16_2-release-notes?changes=la%2Cla) | style recalculation 발생. 60초 이내 visible teaser만 갱신하면 수용 가능하다. | 절대 시각 동기화와 수식 구현이 명확하다. | 기반으로 추천한다. |
| `@property` CSS 보간 | Safari 16.4+, 현재 3대 엔진 Baseline. [WebKit](https://webkit.org/blog/13966/webkit-features-in-safari-16-4/), [web.dev](https://web.dev/blog/at-property-baseline) | typed property 보간에 유리하다. 종속 속성이 shadow/filter면 paint 비용은 남는다. | 여러 지수와 절대 시각 재동기화가 어렵다. | JS 갱신 사이 보간 보조로 사용한다. |
| WAAPI + `playbackRate` | Safari 13.1+. [WebKit](https://webkit.org/blog/10266/web-animations-in-safari-13-1/) | transform/opacity 일회성 모션에 좋다. | 카드·팝오버·SVG 객체의 phase 관리가 복잡하다. | 공개 burst에만 적합하다. |
| 순수 CSS 60초 animation + 음수 delay | 오래된 Safari도 가능하다. | 브라우저 animation engine을 활용한다. | 탭 복귀, 시계 보정, 팝오버 중간 mount, export freeze에서 phase 오차 위험이 있다. | 시간 source of truth로 사용하지 않는다. |

### 추천 구조

JS 절대 시각 계산 + `@property` 보간을 조합한다.

- 보정된 `nowMs`를 유일한 시간 source로 사용한다.
- 공유 scheduler 하나를 사용한다.
- 100ms timer 후 rAF에서 변수값을 commit한다. 실질 10Hz다.
- React state는 숫자 텍스트용 1Hz만 갱신한다.
- `@property`가 100ms 샘플 사이를 보간한다.
- Safari 16.4 미만에서는 10Hz 직접 갱신으로 fallback한다.
- `color-mix()` 미지원 브라우저에는 계산된 RGB 값을 제공한다.
- `document.hidden` 또는 비가시 대상에서는 scheduler를 중지한다.

60fps rAF는 분당 약 3,600 callback이다. 추천 10Hz는 분당 약 600 visual commit으로 6배 적다. 실제 CPU·배터리 비용은 기기별 차이가 있으므로 Safari iPhone과 저사양 Android에서 확인한다.

레이아웃·paint 속성 애니메이션은 비싸다. transform/opacity 중심으로 유지한다. [web.dev animation performance](https://web.dev/articles/animations-and-performance)

## 6. 팝오버 숫자 연출안

### 안 A: 따뜻한 플립 카운터

```html
<div class="dt-count dt-count--flip">
  <span class="dt-count-label">최초공개까지</span>
  <span class="dt-flip-slot">
    <span class="dt-flip-old">09</span>
    <span class="dt-flip-new">08</span>
  </span>
  <span class="dt-count-unit">초</span>
</div>
```

- 장점: 초 교체가 명확하다.
- 단점: 복고·기계 톤이 강하다.
- 구현: 두 숫자 레이어에 `rotateX`와 opacity만 적용한다.

### 안 B: 링 프로그레스 + 중앙 숫자 — 추천

```html
<div class="dt-count dt-count--ring">
  <svg class="dt-ring" aria-hidden="true">
    <circle class="dt-ring-track" />
    <circle class="dt-ring-progress" pathLength="1" />
    <circle class="dt-ring-spark" />
  </svg>
  <div class="dt-count-core">
    <strong>08</strong><span>초</span>
  </div>
</div>
```

- 링 진행률: 60→0의 물리 시간.
- 글로우·숫자 크기: 강도 `I`.
- 정보와 감정 곡선을 분리할 수 있다.
- 둥근 알약 UI, 크림 배경, 보라·금빛 팔레트와 가장 잘 맞는다.

### 안 C: 별가루 숫자

```html
<div class="dt-count dt-count--stardust">
  <canvas class="dt-particle-number" aria-hidden="true"></canvas>
  <strong class="dt-count-fallback">08초</strong>
</div>
```

- 장점: 마지막 3초의 클라이맥스가 강하다.
- 단점: Canvas, DPR, 입자 lifecycle, export fallback이 필요하다.
- 톤 위험: 과한 SF 느낌.

| 안 | 난이도 | 성능 | 톤 적합도 | 접근성·export |
|---|---|---|---|---|
| 플립 | 중 | 좋음 | 따뜻한 복고, 약간 기계적 | 정지 프레임 관리 쉬움 |
| 링 + 숫자 | 낮음~중 | 가장 좋음 | 가장 적합 | 정적 링으로 정보 유지 가능 |
| 별가루 | 높음 | 가장 무거움 | 클라이맥스만 적합 | 별도 fallback 필수 |

결정: 안 B를 기본으로 사용한다. 작은 별 장식 2~3개만 SVG 링에 추가한다. Canvas는 사용하지 않는다.

## 7. 파일별 구현 계획

### `components/poster/public-poster.tsx`

1. 순수 함수 추가:
   - `normalizeHypeTime(remainMs)`
   - `hypeIntensity(remainMs)`
   - `hypeChannels(intensity)`
2. `TeaserCountdown`을 1Hz 텍스트 시계와 10Hz visual scheduler로 분리한다.
3. visual scheduler는 마지막 60초, visible, motion-enabled일 때만 실행한다.
4. DOM ref에 `--hype-*` 값을 직접 기록한다. 10Hz React render를 만들지 않는다.
5. 초별 반동은 숫자 span에만 적용한다.
6. `hypeStageOf()`를 삭제한다.
7. 팝오버의 `detailStage`를 같은 `remainMs → I` 계산으로 바꾼다.
8. 60초 미만 팝오버에 링 프로그레스와 대형 숫자를 렌더한다.
9. 리더선 SVG에 같은 강도 채널을 전달한다.
10. `h1~h4`, `hs1~hs4` 클래스 생성을 제거한다.
11. T=0에서 scheduler를 먼저 종료하고 다음 paint에 `reveal-burst`를 시작한다.
12. reduce-motion이면 공개 제목을 즉시 완성 상태로 표시한다.

### `components/poster/public-poster.css`

1. typed custom property를 등록한다:
   - `--hype-i`
   - `--hy-ring-duration`
   - `--hy-shake-x`
   - `--hy-shake-duration`
   - `--hy-gold-mix`
   - `--hy-number-scale`
   - `--hy-glow-opacity`
2. `.h1~.h4`, `.hs1~.hs4`와 단계별 변수 블록을 삭제한다.
3. 카드 박스 transform을 금지하고 `.teaser-main`·숫자 glyph·장식만 움직인다.
4. animated `box-shadow`를 고정 blur pseudo-layer의 opacity/scale로 교체한다.
5. `.dt-count--ring`, `.dt-ring-*`, `.dt-count-core`를 추가한다.
6. sheet 자체를 움직이지 않고 팝오버 후광 레이어만 움직인다.
7. 반복 `hype-whiteout`을 삭제하고 정적 상승형 후광으로 교체한다.
8. reduce-motion과 export freeze selector에서 모든 관련 animation/transition을 제거한다.
9. `will-change`는 60초 이내 활성 요소에만 적용하고 공개 후 제거한다.

### 테스트 파일

신규 `tests/unit/hype-curve.test.ts`:

- 경계 연속성
- 단조 증가
- `I(60)=0`, `I(55)=0.08`, `I(0)=1`
- 모든 채널 범위
- 잘못된·음수·초과 입력 clamp

Playwright fixture 또는 기존 visual fixture 확장:

- 보정 시계 주입
- 60/45/30/15/8/3/1/0초 고정
- 팝오버 열린 상태
- reduce-motion
- export freeze
- 공개 직전·직후

기존 `tests/visual/poster.spec.ts`:

- `vic.reduceMotion=on` 안정화 유지
- export freeze selector assertion 추가
- capture 중 파티클·중간 transform이 없음을 확인

## 8. 레거시 클래스 철거

1. 첫 구현 커밋에서는 의미 클래스 `hype`, `soon`, `final`을 유지한다.
2. `h1~h4`, `hs1~hs4`는 새 변수와 동시에 한 커밋만 임시 출력한다.
3. 시각 parity 확인 후 숫자 단계 클래스를 완전히 삭제한다.
4. 외부 CSS 소비자가 없다면 compatibility alias를 최종 코드에 남기지 않는다. alias가 이산 경계를 다시 만든다.
5. 저장소 밖 사용자 스타일 의존 여부는 확인 필요다.

## 9. 커밋 계획

1. `refactor: add continuous hype curve model`
2. `feat: drive teaser motion from corrected clock`
3. `feat: add ring countdown to teaser detail`
4. `style: replace hype stages with continuous channels`
5. `a11y: freeze hype motion for reduced and export modes`
6. `test: cover teaser curve reveal and visual states`
7. `cleanup: remove legacy hype stage classes`

## 10. 검증 체크리스트

### 시점별 스크린샷

| 시점 | 확인 항목 |
|---:|---|
| 61초 | hype 효과 없음 |
| 60초 | 이전 프레임과 시각적 점프 없음 |
| 58초 | 아주 약한 링·후광만 감지 |
| 55초 | `I≈0.08`, 흔들림 없음 |
| 45초 | 보라 유지, 느린 링, 작은 숫자 |
| 30초 | 중간 경계 없이 글로우·크기 상승 |
| 15초 | 금빛 진입, 내용에만 미세 흔들림 |
| 8초 | 팝오버 중앙 숫자가 주인공 |
| 3초 | 반복 백색 flash 없음 |
| 1초 | 최대 강도에서도 숫자 판독 가능 |
| 0초 | 카운터 제거 후 공개 burst와 실제 제목 표시 |
| +1초 | 고아 링·반복 animation 없음 |

각 시점에서 카드 단독, 팝오버+리더선, 데스크톱, 모바일, reduce-motion, export freeze를 캡처한다.

### 수치·레이아웃

- 모든 샘플에서 `I(n+1) ≥ I(n)`.
- 60초 경계 값 변화 `<0.005`.
- 카드 bounding box 전체 구간 불변.
- 클릭 버튼 bounding box 불변.
- `10→9`와 `09→08`에서 숫자 슬롯 폭 불변.
- CLS `0`.
- 탭 숨김 후 복귀 시 누적 animation 시간이 아닌 절대 시각으로 즉시 재계산.
- 팝오버를 중간에 열어도 카드와 강도·phase 일치.

### 프레임률·CPU

- Chrome DevTools Performance에서 60초 전체 기록.
- teaser 카드 1/5/20개 fixture 비교.
- 저사양 CPU 4× throttle 사용.
- scheduler callback 평균 1ms 미만 목표.
- 일반 구간 55~60fps 목표.
- reveal 순간 long task 없음.
- paint 영역이 카드·팝오버 주변으로 제한되는지 확인.
- macOS Safari Web Inspector와 실제 iPhone에서 측정.
- 5분 반복 후 발열·배터리 정성 비교.

### 접근성

- PEAT로 3/2/1/0초 전체 화면 검사.
- 임의의 1초 창에서 밝기 flash 3회 초과 없음.
- `data-reduce-motion` 추가 즉시 모든 모션과 모션용 JS loop 정지.
- OS 설정과 무관하게 앱 토글 결과 우선.
- 정지 상태에서도 `공개 임박 · N초` 식별 가능.
- 스크린리더가 매초 발화하지 않음.
- 색만으로 임박 상태를 전달하지 않음.

### 회귀 위험

- 기존 whiteout과 새 후광의 동시 적용
- 카운터 제거와 `reveal-burst` 사이 빈 프레임
- 10Hz visual clock과 1Hz 숫자의 반올림 불일치
- 팝오버 중간 mount 시 카드와 phase 불일치
- blur/filter 레이어의 큰 repaint
- export가 중간 transform 프레임 캡처
- CSS만 숨고 파티클 JS loop는 계속 실행되는 문제
- 공개 재조회 polling 중 teaser 재등장
- KST 보정 경로와 직접 `Date.now()` 호출 혼재

## 11. 완료 기준

- 60초부터 0초까지 단계 경계가 시각적으로 식별되지 않는다.
- 카드·팝오버·리더선이 같은 강도와 phase를 사용한다.
- 카드 박스와 클릭 타깃 위치가 고정된다.
- 마지막 3초에 반복 whiteout이 없다.
- reduce-motion과 export 상태에서 완전히 정지한다.
- 정지 상태에서도 임박 정보가 명확하다.
- 단위·Playwright·visual·성능·PEAT 검증을 통과한다.
- 최종 코드에서 `h1~h4`, `hs1~hs4`, `hypeStageOf()`가 제거된다.
