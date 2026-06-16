# Victory Brand UX Overhaul Plan

작성일: 2026-06-16 KST  
문서 성격: 승인 전 디자인·구조 대개편 계획안  
대상: VIC Schedule Studio viewer/studio/poster/export UI  
주의: 현재 저장소는 `package.json` 기준 Next 15 + React 19 + TypeScript 구조다. 요청의 "Vite + TypeScript" 방향은 별도 이관 결정을 뜻한다. 이 문서는 디자인·상호작용·성능 원칙을 먼저 고정하고, 구현 단계에서 Next 유지 또는 Vite 이관 중 하나를 택한다.

## 1. Executive Summary

### 1.1 UX 비전

VIC Schedule Studio를 "방송 일정표"에서 "빅타민이 매일 확인하고 싶은 Victory board"로 바꾼다.

핵심 경험:

- 시청자는 다음 방송, 오늘 일정, LIVE 상태를 1초 안에 파악한다.
- 팬덤은 필터링, 하트, 오늘 확인, 일정 카드 클릭을 작은 놀이처럼 느낀다.
- 스튜디오 사용자는 실무 편집 속도를 잃지 않는다.
- 포스터/export 화면은 브랜드 포스터처럼 보인다.
- 비공개 레이어는 귀여움보다 경고성과 안전성을 우선한다.

제품 우선순위:

1. 공개/비공개 경계
2. KST 시간 정확성
3. owner-only editing
4. viewer experience
5. poster/export visual quality
6. maintainability

### 1.2 브랜드 리서치 요약

확인된 외부 신호:

- SOOP 채널 검색 결과에서 `toryvac`, `빅토리~!`, `오늘도 신나는 하루 보내자구요!`, `빅타민` 표현이 반복 확인된다.
- 빅토리 미니 갤러리는 빅토리님을 왁타버스 고정멤버 아카데미 3기생으로 소개한다. 말머리도 `빅공지`, `빅방송`, `빅짤`, `빅클립`, `빅스코드`, `빅카페`로 팬 활동 축이 분리되어 있다.
- Zeta UGC 페이지는 `긍정`, `밝음`, `힐링`, 높은 텐션, 귀여운 외모를 핵심 이미지로 묘사한다.
- 팬덤 명칭 `빅타민`은 "비타민" 연상 효과가 강하다. UI 은유는 노랑, 초록, 캡슐, 발포감, 에너지, 응원 반응 쪽이 맞다.

해석:

- 브랜드 무드는 "밝고 귀엽고 긍정적인 버추얼 에너지".
- 팬덤 UX는 정보 밀도보다 "기다리는 재미"와 "오늘 같이 본다" 감각이 중요하다.
- 색은 단순 파스텔보다 선명한 비타민 계열을 쓰되, 캘린더 텍스트는 고대비 잉크로 고정해야 한다.

근거 신뢰도:

- 높음: 실제 저장소 구조, 접근 가능한 DC 갤러리 페이지, WCAG/NNG/Chrome/Motion 공식 문서.
- 중간: SOOP 검색 스니펫, Zeta UGC 문구.
- 낮음: 이미지 검색 기반 아바타 색 추정. 구현 전 공식/운영자 제공 이미지가 있으면 팔레트 보정 필요.

### 1.3 현재 UI 문제 진단

현재 코드 신호:

- `app/globals.css`는 `--accent: #f5b81b`, `--green: #4e9d3f`, `--violet: #7c5cff` 등 파스텔/골드 기반 토큰을 이미 가진다.
- `components/studio/studio-shell.css`는 보라·핑크·글래스·파스텔 배경이 많고, 색상 하드코딩이 넓게 퍼져 있다.
- `data-color` 기반 빗금/점/격자 패턴이 태그 구분에 쓰인다.
- 공개 포스터와 스튜디오는 agenda/legend/month grid 구조를 이미 갖고 있다.
- `EventStatus`에는 `live`가 이미 있다. LIVE 시각 유인책 설계가 가능하다.

문제:

- 브랜드 토큰이 "VIC 일반"에는 맞지만 빅토리/빅타민 고유성이 약하다.
- 파스텔 계열이 많아 태그, 경고, LIVE, CTA의 신호 강도 차이가 흐려질 수 있다.
- 일부 무늬가 텍스트 배경에 직접 깔려 가독성 리스크가 있다.
- 모션은 많지만 물리 파라미터 체계가 없다. 즉각 반응, 타격감, reduced motion 정책을 하나의 시스템으로 묶어야 한다.

### 1.4 최종 방향

대개편 콘셉트:

`Vitamin Victory`

의미:

- Yellow: 승리, 일정의 주목점, 확인 보상.
- Green: 빅타민, 팬 참여, 건강한 에너지.
- Violet: 버추얼 무대, 선택 상태, 스튜디오 정체성.
- Pink: 팬심, 하트, 응원, 귀여움.
- Deep ink: 정보 가독성, 일정 관리 도구의 신뢰감.

결론:

- 전체 UI는 밝은 라이트 테마 우선.
- 다크 모드는 "야간 방송 대기 화면" 느낌으로 지원.
- 패턴은 전체 장식보다 태그 식별 보조로 제한.
- LIVE/오늘/중요 일정만 강한 색과 움직임을 가진다.

## 2. 브랜드 테마 & 구조 대개편 안

### 2.1 브랜드 키워드

| 키워드 | UI 해석 | 시각 장치 |
|---|---|---|
| 승리감 | 오늘의 핵심 일정, 성공 피드백 | 노랑 링, 체크, 상승 모션 |
| 빅토리(Victory) | 방송자 존재감 | 큰 월 헤더, 브랜드 마크, stage band |
| 빅타민 | 팬덤 참여, 활력 | 초록 캡슐 chip, fizz dot |
| 밝음/긍정 | 라이트 톤, 선명한 CTA | 고명도 배경 + 고채도 포인트 |
| 힐링 | 과도한 네온 억제 | 넓은 여백, 부드러운 shadow |
| 버추얼 무대 | 세계관 감각 | 보라 focus, stage panel |
| 팬놀이 | 반복 방문 유도 | 하트, 오늘 확인, 필터 pop |

### 2.2 새 팔레트

#### Core Tokens

| Token | Hex | 용도 | 비고 |
|---|---:|---|---|
| `--vic-ink` | `#171321` | 본문, 캘린더 텍스트 | AAA 고대비 기준 |
| `--vic-ink-soft` | `#3B334D` | 보조 제목 | 보라기 있는 잉크 |
| `--vic-muted` | `#5F5A72` | 보조 설명 | 작은 글자에도 AA 이상 |
| `--vic-paper` | `#F8FAFF` | 앱 기본 배경 | 차가운 흰 배경 |
| `--vic-stage` | `#F3EEFF` | 달력 주변 무대면 | 보라 힌트 |
| `--vic-surface` | `#FFFFFF` | 카드/패널 | 정보면 |
| `--vic-surface-2` | `#FFF7D6` | 오늘/보상 배경 | 노랑 wash |
| `--vic-line` | `#D8D2EA` | 경계선 | 1px, 텍스트 의미 없음 |

#### Brand Tokens

| Token | Hex | 용도 | 텍스트 규칙 |
|---|---:|---|---|
| `--victory-yellow` | `#FFC83D` | primary CTA, today ring, success | `#2B1A00` 글자 |
| `--victory-yellow-soft` | `#FFF7D6` | today cell bg | `#171321` 글자 |
| `--victory-green` | `#38B76A` | fan action, 빅타민 chip | `#171321` 글자 |
| `--victory-green-soft` | `#E9FFF2` | fan action bg | `#171321` 글자 |
| `--victory-violet` | `#4228C8` | selected, focus, studio accent | white 글자 |
| `--victory-violet-soft` | `#F3EEFF` | selection bg | `#171321` 글자 |
| `--tori-pink` | `#FF5F8F` | heart, fan reaction | dark bg 위 포인트 |
| `--tori-pink-soft` | `#FFE8F1` | reaction bg | `#37121F` 글자 |
| `--live-red` | `#D90F45` | LIVE state | white 글자 AA |
| `--live-red-deep` | `#A90F36` | 작은 LIVE badge | white 글자 AAA |
| `--private-bg` | `#FFF1DD` | 비공개 경고 | warning-heavy |
| `--private-ink` | `#8A2E00` | 비공개 경고 텍스트 | AAA |

#### Dark Theme Tokens

| Token | Hex | 용도 |
|---|---:|---|
| `--dark-bg` | `#171321` | 전체 배경 |
| `--dark-stage` | `#211A33` | 캘린더 무대 |
| `--dark-surface` | `#2A2140` | 카드 |
| `--dark-surface-2` | `#33284D` | hover/selected bg |
| `--dark-ink` | `#FEF7FF` | 본문 |
| `--dark-muted` | `#CFC6E6` | 보조 |
| `--dark-line` | `#4D4268` | 경계 |

다크 모드 규칙:

- 노랑/초록/핑크는 면적 12% 이하.
- 배경 gradient 금지 또는 매우 약하게.
- LIVE red는 동일 유지. pulse opacity만 낮춘다.
- eye comfort 사용 시 saturation 0.82, brightness 0.96.

### 2.3 색상 적용 규칙

#### Viewer

- 배경: `--vic-paper`.
- 달력 영역: `--vic-stage` band 안에 둔다.
- 일정 카드: 태그 색상은 왼쪽 rail 또는 top strip에 집중. 본문 면은 가능한 흰색.
- 오늘: 노랑 ring + date badge.
- 다음 방송: 노랑/초록 혼합 chip. 과한 그림자 금지.
- LIVE: red badge + left rail + subtle pulse.

#### Studio

- 배경: viewer보다 낮은 장식. 실무성 우선.
- owner/developer action: violet.
- manager/worker allowed area: green/blue 계열. 편집 가능 범위를 명확히.
- private layer: `--private-bg`, `--private-ink`, dashed/lock icon. 귀여운 장식 금지.
- 저장 상태: idle gray, saving amber, saved green, failed red.

#### Poster/Export

- export 표면은 viewer보다 더 강한 브랜드 표시 가능.
- 월 헤더에 Victory signature 사용.
- 스티커/팬 장식은 안전 영역 내.
- 텍스트 위에는 패턴/스티커가 겹치면 안 된다.

### 2.4 패턴 시스템

기존 `data-color` 기반 pattern은 유지하되 역할을 줄인다.

패턴 원칙:

- 색만으로 태그를 구분하지 않는다.
- 패턴은 태그 swatch, 작은 strip, multi-tag split에만 사용한다.
- 본문 텍스트 배경에는 패턴 금지.
- 무늬 opacity는 light 6-10%, dark 8-12%.
- pointer target 내부 패턴은 hover/active 때만 미세하게 이동할 수 있다.

새 브랜드 패턴:

| Pattern | CSS 개념 | 용도 |
|---|---|---|
| `vitamin-fizz` | 작은 radial dots | 배경/empty state |
| `capsule-diag` | 둥근 대각 캡슐 반복 | 빅타민/fan tag |
| `victory-spark` | 4-point star mask | 오늘/완료 보상 |
| `stage-grid` | 낮은 contrast grid | studio utility surface |

금지:

- 체크/격자를 전체 앱 배경에 크게 깔기.
- 노랑 배경 위 흰 글자.
- 초록 배경 위 흰 글자.
- 보라 gradient만으로 화면 전체를 지배.

### 2.5 레이아웃 아키텍처

#### Desktop Viewer

```txt
---------------------------------------------------------------+
| Topbar: brand / month nav / live-status                      |
+-------------+-----------------------------------+-------------+
| Filter Rail | Calendar Month Grid               | Day Detail  |
| 280-320px   | minmax(760px, 1fr)                | 300-360px   |
| sticky      | 7 columns, stable cell height     | selected    |
+-------------+-----------------------------------+-------------+
```

규칙:

- Filter rail은 결과 조작 도구. Calendar는 결과.
- Detail panel은 선택 후에만 강한 정보.
- Month grid는 화면 핵심. 가로 폭 60% 이상 유지.
- Rail과 detail은 card가 아니라 full-height surface로 처리. card-in-card 금지.

#### Desktop Studio

```txt
Topbar
Private warning strip, if unlocked or private visible
Studio shell
  Left: calendar + quick actions
  Right: editor/detail/inspector
```

규칙:

- Studio는 cute보다 practical.
- 편집 가능/불가능을 서버 권한 기준으로 표시.
- manager는 editable처럼 보이면 안 된다. assign 가능 영역만 분리.
- private mode는 항상 warning-heavy.

#### Mobile Viewer

```txt
Header: month, live/next state
Agenda list by KST day
Floating month nav
Bottom sheet: day detail/filter
```

규칙:

- 월간 grid 축소판보다 agenda 우선.
- filter rail은 bottom sheet 또는 horizontal chips.
- pointer target 최소 40px, 권장 44-48px.
- sticky controls는 콘텐츠를 덮지 않는다.

### 2.6 게슈탈트 기반 조화 규칙

균형:

- 좌측 필터 rail은 시각 무게 1, 달력은 3, detail은 1.
- 강한 색은 화면당 3종 이하.
- 움직이는 요소는 화면당 2개 이하.
- 주 CTA는 화면당 1개.

비례:

- 8pt spacing 유지: 4, 8, 12, 16, 24, 32, 48.
- Calendar cell 내부 vertical rhythm: date 20%, events 70%, status 10%.
- Event pill height: desktop 28-34px, mobile 44-56px card.
- Tag swatch: 12px dot 또는 3px rail. 큰 면적 칠하기 지양.

통일성:

- 같은 tag는 filter, calendar, agenda, detail에서 같은 색/패턴.
- 같은 상태는 같은 motion. saved는 pop, failed는 shake가 아니라 색+message 우선.
- selected indicator는 violet으로 통일.
- LIVE는 red로만. 다른 red 사용 금지.

근접성:

- 날짜와 일정은 한 셀 안에서 붙인다.
- 필터 chip과 count는 같은 행.
- private warning과 private toggle은 거리 가깝게.

유사성:

- content tag와 modifier tag 모양을 분리한다.
- content = filled chip/strip.
- modifier = outline chip/dot.

연속성:

- span event는 끊기지 않는 bar.
- month transition은 좌우 이동 방향과 실제 월 이동 방향 일치.
- card-to-detail은 shared element로 연결.

## 3. 가독성 & 조화 스펙 시트

### 3.1 WCAG 기준

적용 기준:

- 일반 텍스트: 최소 4.5:1.
- 큰 텍스트: 최소 3:1.
- 큰 텍스트 정의: 18pt 이상 또는 14pt bold 이상.
- 캘린더 일정은 대부분 작은 텍스트이므로 목표 7:1.
- UI component border/icon은 최소 3:1 권장.

출처:

- WCAG 2.2 Contrast Minimum: https://www.w3.org/TR/WCAG22/#contrast-minimum
- WCAG 2.2 Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html

### 3.2 대비 계산 결과

계산식:

```txt
relative luminance:
  sRGB <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ^ 2.4

contrast ratio:
  (L1 + 0.05) / (L2 + 0.05)
```

| Foreground | Background | Ratio | 사용 판정 |
|---:|---:|---:|---|
| `#171321` | `#F8FAFF` | 17.46:1 | 본문 AAA |
| `#171321` | `#F3EEFF` | 16.05:1 | stage 위 AAA |
| `#171321` | `#FFF7D6` | 16.96:1 | 노랑 wash 위 AAA |
| `#171321` | `#E9FFF2` | 17.41:1 | 초록 wash 위 AAA |
| `#2B1A00` | `#FFC83D` | 10.86:1 | primary CTA AAA |
| `#171321` | `#38B76A` | 7.08:1 | 초록 chip AAA 근접 |
| `#FFFFFF` | `#38B76A` | 2.58:1 | 금지 |
| `#FFFFFF` | `#4228C8` | 8.86:1 | violet button AAA |
| `#FFFFFF` | `#D90F45` | 5.12:1 | LIVE AA |
| `#FFFFFF` | `#A90F36` | 7.48:1 | 작은 LIVE AAA |
| `#37121F` | `#FFE8F1` | 14.24:1 | pink wash AAA |
| `#5F5A72` | `#F8FAFF` | 6.30:1 | muted AA+ |
| `#5F5A72` | `#F3EEFF` | 5.79:1 | muted AA+ |
| `#8A2E00` | `#FFF1DD` | 7.64:1 | private warning AAA |

결론:

- `victory-green`은 흰 글자 금지. dark ink 사용.
- `victory-yellow`도 흰 글자 금지. dark brown/ink 사용.
- 작은 LIVE 글자는 `--live-red-deep` 사용.
- 일반 red on paper는 4.5 미만 근접값이 될 수 있어 텍스트 색으로 쓰지 않는다. 배지 배경으로만 쓴다.

### 3.3 폰트 렌더링 규칙

기본 폰트:

```css
font-family:
  "Pretendard",
  "Apple SD Gothic Neo",
  "Malgun Gothic",
  "Segoe UI",
  Arial,
  sans-serif;
```

권장 weight:

| UI | Size | Weight | Line-height | 비고 |
|---|---:|---:|---:|---|
| 월 헤더 | 36-48px | 900 | 1.0 | tabular nums |
| 날짜 숫자 | 14-16px | 900 | 1.1 | 오늘은 badge |
| 일정 제목 desktop | 13.5-15px | 700 | 1.28 | 2줄 clamp |
| 일정 제목 mobile | 15-16px | 800 | 1.35 | touch card |
| 태그 chip | 12.5-13px | 800 | 1.2 | nowrap |
| 보조 설명 | 12.5-14px | 600-700 | 1.45 | muted |
| 경고 | 13-15px | 900 | 1.35 | private |

텍스트 shadow:

- 기본 본문: 없음.
- LIVE/다크 배지: `0 1px 1px rgb(0 0 0 / 18%)`.
- 포스터 큰 타이틀: 그림자보다 stroke/outline 우선.
- 스티커 텍스트는 export 가독성을 위해 outline option 유지.

글자-spacing:

- 일반 UI: `letter-spacing: 0`.
- 숫자/월: `font-variant-numeric: tabular-nums`.
- uppercase eyebrow는 0.02em 이하.
- 음수 letter-spacing 금지.

### 3.4 패턴 위 텍스트 규칙

텍스트 위 패턴 허용 조건:

- 텍스트 배경 평균 contrast가 목표 대비를 만족.
- 패턴 alpha가 10% 이하.
- 패턴 주기가 7px 이상.
- 글자 획과 유사 방향인 촘촘한 대각선 금지.

권장:

```css
.event-card {
  background: var(--vic-surface);
}

.event-card::before {
  /* tag color strip only */
  width: 3px;
  background: var(--tag-color);
}

.event-card .pattern {
  pointer-events: none;
  opacity: 0.08;
}
```

금지:

```css
.event-title {
  background-image: repeating-linear-gradient(...);
}
```

### 3.5 Spacing System

기존 토큰 유지:

| Token | px | 용도 |
|---|---:|---|
| `--space-1` | 4 | icon/text gap |
| `--space-2` | 8 | chip gap |
| `--space-3` | 12 | cell padding |
| `--space-4` | 16 | panel internal |
| `--space-5` | 24 | page section |
| `--space-6` | 32 | large group |
| `--space-7` | 48 | major layout gap |

Radii:

| Token | px | 용도 |
|---|---:|---|
| `--r-sm` | 8 | small controls |
| `--r-md` | 12 | inputs, buttons |
| `--r-card` | 14 | event/detail cards |
| `--r-lg` | 16 | panels |
| `--r-xl` | 20 | major shell |
| `--r-pill` | 999 | chips/badges |

Cards:

- Repeated item card radius max 8-14px.
- Page section을 card처럼 띄우지 않는다.
- Card inside card 금지.
- Tool panel은 surface band 또는 inspector panel로 처리.

### 3.6 Calendar Layout Rules

Month grid:

- 7 equal columns.
- Cell min height desktop 124-152px.
- Cell min height compact 96-116px.
- Day number fixed top-left.
- Event stack는 stable height. hover로 layout shift 금지.

Event pill:

- `min-height: 28px` desktop.
- `min-height: 44px` mobile agenda.
- title max 2 lines.
- long word fallback: `overflow-wrap: anywhere`.
- LIVE/important badge는 title 앞이 아니라 title row 오른쪽 fixed slot.

Filter rail:

- sticky top below topbar.
- 1 search/clear row, content tags, modifier tags, bookmarked toggle 순서.
- selected count는 rail top에 고정.
- tag chip은 swatch + label + count 구조.

### 3.7 Public/Private Boundary in Visual Design

공개 viewer에서 절대 보이면 안 되는 것:

- `privateTitle`
- `privateMemo`
- `editorNote`
- `visibilityScope !== "public"`인 내부 정보
- work/embargo/owner_private의 실제 제목 또는 태그
- trusted member list
- owner/developer controls

Viewer에 보여도 되는 것:

- 공개 일정 제목/설명/태그.
- 공개 teaser placeholder.
- 공개 reveal countdown.
- public heart/bookmark state.

Studio private mode:

- warning strip 항상 표시.
- private event는 border + lock + amber/orange.
- export/poster capture에는 private/admin UI 제거.

## 4. 인터랙션 설계서

### 4.1 성능 인지 기준

인간-컴퓨터 상호작용 기준:

- 0.1초 안에 반응하면 즉시 조작처럼 느껴진다.
- 1초 안이면 flow가 대체로 유지된다.
- 10초 이상이면 attention이 깨져 progress/interrupt가 필요하다.

제품 목표:

- click/tap feedback: 0-50ms.
- state visual update: 100ms 이하.
- filter/calendar re-render: 100ms 이하.
- route/month data wait: 1s 넘으면 skeleton/status 표시.
- export: 1s 넘으면 progress 상태, cancel 불가 작업이면 명확한 busy 표시.

출처:

- NN/g Response Time Limits: https://www.nngroup.com/articles/response-times-3-important-limits/
- Chrome Lighthouse Estimated Input Latency: https://developer.chrome.com/docs/lighthouse/performance/estimated-input-latency

### 4.2 재미의 3대 요소

#### 발견

사용자가 "이거 누르면 반응한다"를 빠르게 안다.

설계:

- 태그 hover 시 swatch가 2px 커지고 count가 살짝 pop.
- 오늘 날짜는 노랑 ring으로 즉시 발견.
- LIVE는 red badge + 1.8s pulse.
- 다음 방송 card는 첫 viewport 위쪽에 고정 위치.

#### 수집

반복 방문과 클릭에 작은 누적 감각을 준다.

설계:

- 하트 누르면 `LiquidHeart`류 효과 유지.
- 오늘 확인 시 작은 check pop. 저장은 local state only.
- bookmark filter는 selected indicator가 rail 상단에 남는다.

#### 변주

달력 탐색이 같은 작업 반복으로 느껴지지 않게 한다.

설계:

- 월 이동 direction-aware slide.
- 태그 filter는 calendar cell dimming이 즉시 반영.
- 중요한 날만 mild spark. 전역 confetti 남발 금지.

### 4.3 몰입의 3대 요소

#### 연속성

- Month change: 이전 달/다음 달 이동 방향과 animation 방향 일치.
- Card click: card 위치에서 detail sheet로 shared element transition.
- Filter toggle: 선택 chip과 calendar highlight가 같은 색으로 이어진다.

#### 예측 가능성

- 같은 상태는 같은 색.
- 같은 조작은 같은 motion.
- 버튼 active scale은 전체 시스템에서 동일.
- destructive action은 playful motion 금지.

#### 흐름 유지

- optimistic UI 우선.
- 서버 실패 시 affected item만 rollback.
- route-level reload 대신 local shell 유지.
- focus state 보존.

### 4.4 끌어당김 모델

Hook:

- LIVE badge.
- 오늘 ring.
- 다음 방송 card.
- 일정 변경 badge.
- 팬 하트 count ratio.

Action:

- card open.
- tag filter.
- heart/bookmark.
- month nav.
- poster decorate.

Reward:

- pop/settle animation.
- selected detail reveal.
- count pop.
- "오늘 확인" check.
- saved status.

Priority:

1. LIVE
2. Today
3. Next broadcast
4. Important/changed schedule
5. Fan reaction
6. Ordinary event

Visual salience budget:

- LIVE uses red + pulse + left rail.
- Today uses yellow ring only.
- Important uses yellow top glow only.
- Ordinary tags use small strip, not full-card fill.

### 4.5 타격감의 3대 요소

#### 1. 선행 동작

의도 입력이 들어왔음을 50ms 안에 보여준다.

예:

```css
transform: scale(0.96);
transition-duration: 48ms;
```

#### 2. 타격

상태 변화 순간에 팽창, ring, count pop을 준다.

예:

- tag selected: chip scale 1.04.
- event clicked: card shadow 1단계 증가.
- heart clicked: icon fill + particle burst.

#### 3. 복귀

spring으로 원위치 settle.

예:

```txt
scale 0.96 -> 1.04 -> 1.00
```

### 4.6 Spring Physics Spec

모델:

```txt
F = -kx - cv
k = stiffness
c = damping
m = mass
wn = sqrt(k / m)
zeta = c / (2 * sqrt(km))
settling time approx = 4 / (zeta * wn)
```

| Interaction | Mass | Stiffness | Damping | zeta | Settling | Overshoot | 용도 |
|---|---:|---:|---:|---:|---:|---:|---|
| tag toggle | 0.75 | 1050 | 42 | 0.75 | 143ms | 2.9% | 빠른 필터 |
| event card press | 0.90 | 900 | 40 | 0.70 | 180ms | 4.5% | 찰진 카드 |
| detail shared open | 1.00 | 520 | 34 | 0.75 | 235ms | 3.0% | card to sheet |
| month slide | 1.00 | 360 | 31 | 0.82 | 258ms | 1.2% | 월 이동 |
| sticker settle | 0.80 | 460 | 24 | 0.63 | 267ms | 8.1% | poster 놀이 |

Easing fallback:

```css
--ease-standard: cubic-bezier(0.22, 0.61, 0.36, 1);
--ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
--ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-press: cubic-bezier(0.2, 0, 0.38, 0.9);
```

CSS-only keyframes:

```css
@keyframes vic-pop {
  0% { transform: scale(0.96); }
  45% { transform: scale(1.045); }
  100% { transform: scale(1); }
}

@keyframes vic-live-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgb(217 15 69 / 0.38); }
  55% { box-shadow: 0 0 0 7px rgb(217 15 69 / 0); }
}
```

### 4.7 Shared Element Transition

적용 후보:

- event card -> desktop detail panel.
- event card -> mobile bottom sheet.
- selected tag chip -> rail selected indicator.
- month label old -> month label new.

Motion/React 사용 시:

- `LayoutGroup`으로 calendar/detail 그룹화.
- event `layoutId="event-${event.id}"`.
- detail open은 `AnimatePresence`.
- scroll container에는 `layoutScroll`.
- fixed bottom sheet에는 `layoutRoot`.

공식 근거:

- Motion spring은 `stiffness`, `damping`, `mass` 기반 physics spring 지원.
- Motion layout animation은 transform 기반으로 고성능 처리.
- `layoutId`는 shared layout transition에 사용 가능.

출처:

- Motion React Transitions: https://motion.dev/docs/react-transitions
- Motion LayoutGroup: https://motion.dev/docs/react-layout-group
- Motion Layout Animations: https://motion.dev/docs/react-layout-animations

### 4.8 Particle Effect Policy

허용:

- heart burst.
- save success ring.
- LIVE start spark once.
- sticker placement settle.

금지:

- 화면 전환마다 confetti.
- 필터 toggle마다 많은 particle.
- private warning에 귀여운 particle.
- reduced motion에서 자동 particle.

구현 규칙:

- particle은 React state frame loop 금지.
- 생성/제거만 React state, 움직임은 CSS animation.
- max particles per action: 12.
- max concurrent particles: 64.
- prefers-reduced-motion 또는 `html[data-reduce-motion]`이면 fade/static.

### 4.9 Haptics Policy

모바일 진동은 선택 사항.

규칙:

- user activation 안에서만 `navigator.vibrate`.
- 설정 토글 필요.
- iOS Safari는 제한적이므로 실패 무시.
- security/destructive action에 장난스러운 haptic 금지.

패턴:

| Action | Pattern |
|---|---|
| tag toggle | 8ms |
| heart | 10ms |
| save success | 8ms, 20ms gap, 12ms |
| failed | no vibration 또는 20ms single |

### 4.10 Reduced Motion

현 repo에는 `lib/ui/motion.ts`의 `vic.reduceMotion`과 `html[data-reduce-motion]` 정책이 있다. 새 모션은 모두 합류한다.

규칙:

- idle infinite animation은 끈다.
- LIVE pulse는 static red dot로 대체.
- shared element는 crossfade 또는 instant.
- particle은 생성하지 않는다.
- button active scale은 0.98 이하로 줄이거나 제거.

## 5. 기술 아키텍처 제안

### 5.1 현재 저장소 기준

현재:

```json
{
  "next": "^15.0.3",
  "react": "^19.0.0",
  "typescript": "^5.6.3",
  "vitest": "^2.1.5",
  "@playwright/test": "^1.49.0"
}
```

따라서 구현 선택지:

| 선택 | 장점 | 리스크 |
|---|---|---|
| Next 유지 | 현재 route/server action/RLS 흐름 유지 | 요청의 Vite 기준과 다름 |
| Vite 이관 | client app 단순화 가능 | Next app router, server action, auth, Supabase SSR 재설계 필요 |

권장:

- 1차는 Next 유지.
- 디자인 토큰, CSS 구조, motion 시스템 먼저 적용.
- Vite 이관은 별도 architecture RFC로 분리.

### 5.2 CSS Token Layer

새 토큰 위치:

- `app/globals.css`: global design tokens.
- `components/poster/public-poster.css`: viewer/poster specific semantic tokens.
- `components/studio/studio-shell.css`: studio specific semantic tokens.

권장 구조:

```css
:root {
  --vic-ink: #171321;
  --vic-paper: #f8faff;
  --victory-yellow: #ffc83d;
  --victory-green: #38b76a;
  --victory-violet: #4228c8;
  --live-red: #d90f45;
  --live-red-deep: #a90f36;
}

[data-theme="dark"] {
  --vic-ink: #fef7ff;
  --vic-paper: #171321;
  --vic-surface: #2a2140;
}
```

Semantic mapping:

```css
:root {
  --color-bg: var(--vic-paper);
  --color-surface: var(--vic-surface);
  --color-text: var(--vic-ink);
  --color-accent: var(--victory-violet);
  --color-primary: var(--victory-yellow);
  --color-live: var(--live-red);
}
```

Migration:

1. Add new tokens without removing old tokens.
2. Alias old `--accent`, `--green`, `--violet` to new values.
3. Replace high-risk hardcoded colors.
4. Replace component-specific colors gradually.
5. Remove unused tokens after visual QA.

### 5.3 Component Architecture

Recommended components:

```txt
components/brand/
  victory-theme.ts
  victory-tokens.css
  victory-patterns.css

components/motion/
  motion-presets.ts
  spring.ts
  use-press-feedback.ts

components/calendar/
  tag-filter-rail.tsx
  live-event-badge.tsx
  event-card.tsx
  event-detail-panel.tsx
```

Do not over-abstract:

- 현재 구조가 크므로 1차는 CSS token + small component extraction.
- Calendar data logic은 `lib/calendar/month.ts` 유지.
- Public/private DTO는 schedules loader 쪽 boundary 유지.

### 5.4 Rendering Optimization

Goal:

- filter toggle visual response <= 100ms.
- month navigation state feedback <= 50ms.
- event card click detail open <= 100ms.
- heavy recomputation deferred.

Strategies:

#### Memoize event grouping

```ts
const eventsByDate = useMemo(
  () => groupEventsByDate(liveEvents),
  [liveEvents]
);
```

Avoid:

- `cells.map` 내부에서 매번 `liveEvents.filter`.
- tag lookup마다 `tags.find`.

Use:

```ts
const tagById = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags]);
const colorByKey = useMemo(() => new Map(palette.map(c => [c.key, c])), [palette]);
```

#### Split urgent vs non-urgent updates

Urgent:

- selected tag visual state.
- pressed state.
- selected event id.

Non-urgent:

- analytics.
- expensive filter counts.
- remote sync.
- poster asset preload.

React:

- `useTransition` for non-urgent filter result if needed.
- `useDeferredValue` for search/filter text.
- `React.memo` for day cells.

#### Use transform/opacity only

Good:

- `transform: translate/scale`.
- `opacity`.
- `box-shadow` short and limited.

Avoid:

- animating `height`, `width`, `top`, `left`.
- backdrop-filter on large moving surfaces.
- full-grid repaint per hover.

### 5.5 Motion Library Strategy

Current repo has no framer/motion dependency. Options:

| Option | Use | Bundle risk | 추천 |
|---|---|---:|---|
| CSS only | press/pop/LIVE/month | none | 1차 |
| Motion mini | imperative particles/shared limited | low | 2차 optional |
| `motion/react` | shared element/detail transitions | medium | only where needed |
| GSAP | complex timeline | high | no |

Recommendation:

- 1차: CSS/WAAPI.
- 2차: add `motion` only if shared element transition cannot be clean with CSS View Transitions.
- Avoid library for simple button press.

### 5.6 View Transition Strategy

Browser View Transition API:

- Good for route/month screen transition.
- Risk: screenshot-based, many elements can cost more.
- Use only for large page transitions, not every card.

React ViewTransition:

- React 19 has ViewTransition API docs, but adoption in Next version must be checked before implementation.
- Prefer stable manual `document.startViewTransition` only if browser support and Next hydration path safe.

Fallback:

- CSS fade/slide.
- No flicker requirement can be satisfied by persistent shell + opacity transition.

### 5.7 Data Boundary Architecture

Public loader must sanitize:

```txt
events:
  include only visibilityScope public
  include publicTitle/publicDescription/public tags
  include teaser placeholder only before reveal
  exclude privateMeta
```

Studio loader:

- owner/developer can receive full private data if unlocked/session valid.
- manager/worker receive only allowed fields.
- trusted member does not gain edit permission unless server policy allows.

API routes:

- `/api/public/[calendarSlug]/events` must never expose private fields.
- UI-only permission checks are not enough.
- RLS/server action checks remain source of truth.

Private layer:

- passcode hash only.
- unlock session expiry.
- invalidate all sessions action.
- warning banner in UI.

### 5.8 KST Correctness

Rules:

- Product timezone: `Asia/Seoul`.
- Today, LIVE, countdown, reveal time use KST display.
- Server timestamps can be UTC, but UI grouping date must use KST.
- Month route params must not assume browser local timezone.

Existing:

- `PRODUCT_TIMEZONE = "Asia/Seoul"`.
- `getTodayKst()` exists in `lib/calendar/month.ts`.

Need:

- Any new live badge logic must consume KST-normalized date/time.
- Playwright tests set timezone or assert KST labels with fixed mock.

### 5.9 Poster Export Quality

Export constraints:

- html2canvas text rendering can differ from browser.
- Stickers may overlap text.
- Gradients/patterns may blur at export scale.

Rules:

- Export surface has fixed aspect and safe area.
- No active controls in capture.
- Font loaded before capture.
- Pattern alpha lower in export mode.
- Text outline available for sticker text.
- Private/admin UI excluded.

QA:

- Desktop screenshot.
- Mobile screenshot.
- Poster export screenshot.
- Dark mode screenshot.
- Private unlocked screenshot must show warning in studio, never in public export.

### 5.10 Phased Implementation Plan

#### Phase 0: Approval and Source Lock

Tasks:

- Confirm official brand assets if available.
- Confirm Next 유지 vs Vite 이관.
- Confirm palette acceptance.
- Confirm dark mode scope.

Exit:

- Approved palette and motion budget.

#### Phase 1: Token Foundation

Files:

- `app/globals.css`
- `components/studio/studio-shell.css`
- `components/poster/public-poster.css`

Tasks:

- Add new brand tokens.
- Alias old tokens.
- Replace primary/green/violet/red hardcoded high-risk colors.
- Add contrast comment table.

Exit:

- Existing UI visually stable.
- No private boundary changes.

#### Phase 2: Viewer Layout and LIVE Affordance

Files:

- `components/poster/public-poster.tsx`
- `components/poster/public-poster.css`
- `lib/calendar/month.ts` if helper needed.

Tasks:

- Add LIVE badge styling.
- Add next broadcast visual hierarchy.
- Refine filter rail spacing.
- Stabilize event pill layout.

Exit:

- Viewer sees today/LIVE/next broadcast within first viewport.
- Mobile agenda still clean.

#### Phase 3: Motion System

Files:

- `app/globals.css`
- `lib/ui/motion.ts`
- optional `components/ui/*`

Tasks:

- Add CSS motion tokens.
- Add `vic-pop`, `vic-live-pulse`, `vic-press`.
- Wire tag/card/button states.
- Add reduced motion overrides.

Exit:

- 0-50ms feedback for tap/click.
- No layout shift.

#### Phase 4: Studio Practicality and Private Warning

Files:

- `components/studio/studio-shell.css`
- relevant studio components.

Tasks:

- Tighten studio colors.
- Make private mode warning-heavy.
- Separate owner/developer editable cues from manager/worker cues.

Exit:

- Manager cannot appear owner-editable.
- Private visible state visually unmistakable.

#### Phase 5: Poster/Export Polish

Files:

- `components/poster/*`
- export actions.

Tasks:

- Export-safe theme.
- Sticker safe area.
- Pattern export alpha.
- Text contrast QA.

Exit:

- Poster screenshot matches design.
- No admin/private leakage.

#### Phase 6: Performance and QA

Tasks:

- Memoize event grouping.
- Profile filter toggle.
- Playwright screenshots.
- Public API leakage test.
- Visual regression update.

Exit:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- targeted visual tests.

### 5.11 Acceptance Criteria

Brand:

- First viewport clearly reads as Victory, not generic pastel calendar.
- `빅타민` fan interaction has green/yellow identity.
- LIVE uses red consistently.

Readability:

- Normal text >= 4.5:1.
- Calendar small text target >= 7:1 where practical.
- No text on busy pattern.

UX:

- Tag toggle feedback starts <= 50ms.
- Calendar update target <= 100ms.
- Month nav preserves orientation.
- Mobile agenda no overlap.

Security:

- Public API no private fields.
- Viewer no edit controls.
- Trusted member no implicit edit.
- Private unlock warning visible in studio.

Poster/export:

- Export surface excludes controls.
- Text readable after capture.
- Stickers do not occlude required content.

Maintainability:

- New color uses tokens, not raw hex unless token declaration.
- Motion uses preset classes/tokens.
- No unrelated refactor.

## 6. Phase 2: 창의적 실행 및 아키텍처 고도화 계획안

### 6.1 Phase 2 목표

Phase 1은 "읽히고 빠르고 안전한 빅토리 일정 앱"을 만드는 계획이었다. Phase 2는 거기서 한 단계 더 간다.

목표:

- 흔한 dashboard/template 냄새 제거.
- 브랜드 디테일을 픽셀 단위로 설계.
- 모션과 색을 감으로 흩뿌리지 않고 토큰화.
- 코드 리팩토링을 한 번에 갈아엎지 않고 단계별로 완성.
- viewer는 기억나는 화면, studio는 오래 써도 피곤하지 않은 화면으로 분화.

핵심 원칙:

```txt
Generic UI 제거
  -> Victory-only visual grammar

Decorative trend 복붙 금지
  -> contrast, KST, public/private boundary 안에서 craft 적용

Full rewrite 금지
  -> token -> context -> filter -> event card -> calendar shell 순서
```

### 6.2 Anti-Boilerplate: "AI가 짠 듯한" 전형성 탈피

#### 6.2.1 금지 패턴

흔한 AI/Tailwind 템플릿 느낌:

- `rounded-2xl shadow-xl bg-white/80 backdrop-blur` 반복.
- 보라-파랑 gradient full background.
- 카드가 카드 안에 들어간 nested card layout.
- 모든 섹션이 같은 radius, 같은 shadow, 같은 padding.
- hero 같은 과한 상단 영역.
- CTA마다 같은 pill button.
- 의미 없는 floating orb/bokeh/blob.
- "cute"를 pastel만으로 처리.
- `transition-all` 남발.
- hover 때 모든 요소가 `translateY(-2px)`.

VIC 금지 규칙:

- Full-page purple/blue gradient 금지.
- Visible in-app 설명문으로 기능 홍보 금지.
- 달력 앱 첫 화면을 landing page처럼 만들지 않는다.
- 스튜디오 화면에 editorial hero 금지.
- private layer에 playful ornament 금지.
- 색/패턴은 정보 구조를 이겨선 안 된다.

#### 6.2.2 Victory-only Visual Grammar

빅토리 테마는 "비타민 캡슐 + Victory stage + 팬 응원 반응"을 조합한다.

Visual primitives:

| Primitive | 설명 | 적용 위치 |
|---|---|---|
| `Victory notch` | 직사각 카드 모서리 한 곳만 6-10px 사선으로 깎음 | LIVE/important card |
| `Vitamin capsule rail` | 둥근 캡슐형 3px-5px side rail | tag/event category |
| `Fizz noise` | 작은 발포 점 텍스처, 4-8% alpha | empty bg, today bg |
| `Stage glint` | 1px diagonal highlight line | selected card edge |
| `Soft ink edge` | black 대신 보라 잉크 border | panel/card |
| `Fan pulse` | 하트/빅타민 반응에만 짧은 pulse | heart/bookmark |
| `Tori spark` | 4-point tiny spark, 1회성 | success/today |

사선 notch 예시 컨셉:

```css
.vic-card-important {
  clip-path: polygon(
    0 0,
    calc(100% - 10px) 0,
    100% 10px,
    100% 100%,
    0 100%
  );
}
```

주의:

- `clip-path`는 export/html2canvas 확인 필요.
- fallback은 pseudo-element corner cut으로 둔다.
- 일반 일정 카드에는 쓰지 않는다. LIVE/중요 일정만.

#### 6.2.3 High-end Mash-up Direction

Awwwards/Dribbble류 high-end detail을 그대로 복사하지 않는다. 기능형 calendar에 맞게 작게 분해해서 빅토리 테마로 재조립한다.

Mash-up inventory:

| Trend detail | 원형 | Victory 변환 | 제한 |
|---|---|---|---|
| Frosted glass | glassmorphism | topbar/rail에만 `glass-quiet` | 달력 셀에는 금지 |
| Liquid glass | iOS-like blur/refraction | selected chip highlight에 1px glint | blur 8px 이하 |
| Noise texture | editorial/portfolio | `vitamin-fizz`로 변환 | alpha 4-8% |
| Glowing edge | cyber/neon | LIVE red edge, today yellow ring | box-shadow budget 제한 |
| Irregular border | brutal/editorial | Victory notch | important only |
| Soft 3D depth | product landing | sticker/editor controls only | viewer calendar 과잉 금지 |
| Micro type contrast | high-end typography | month number vs small chip contrast | negative letter-spacing 금지 |
| Canvas/SVG motion | interaction showcase | particle burst isolated layer | reduced motion 준수 |

구체 연출:

- Topbar: blur glass가 아니라 "broadcast control glass". 흰 반투명 + 보라 잉크 border + 1px stage glint.
- Calendar shell: 단순 카드가 아니라 "stage tray". 배경 `--vic-stage`, 내부 grid는 흰 cell.
- Today: 노랑 fill보다 얇은 ring + fizz texture. 정보면은 흰색 유지.
- LIVE: red badge + clipped corner + 1회 입장 glow. 계속 타오르는 네온 금지.
- Filter rail: chip들이 다 같은 pill이면 흔함. content tag는 capsule, modifier tag는 outline tab, heart filter는 liquid heart micro-control.
- Empty day: 회색 빈칸 대신 낮은 alpha vitamin dot. "비어 있음"을 장식으로 덮지 않는다.

#### 6.2.4 Originality Checklist

구현 PR마다 확인:

- 이 컴포넌트가 Tailwind UI 예제처럼 보이는가?
- 같은 radius/shadow 조합이 3회 이상 반복되는가?
- 브랜드 고유 primitive 하나 이상이 의미 있게 들어갔는가?
- 장식이 일정 가독성을 방해하는가?
- LIVE/today/selected 중 무엇이 1순위인지 즉시 보이는가?
- screenshot을 흑백으로 바꿔도 구조가 보이는가?
- 색만 빼도 click target과 hierarchy가 남는가?

### 6.3 Digital Craftsmanship: 픽셀 퍼펙트와 모션 디테일

#### 6.3.1 Craft Definition

이 프로젝트의 장인정신은 "장식 많이"가 아니다.

정의:

- 1px line alignment가 흔들리지 않는다.
- hover/active로 layout shift가 없다.
- 같은 상태는 같은 motion으로 반응한다.
- animation duration이 데이터 latency를 숨기지 않는다.
- export 이미지에서 텍스트와 sticker가 깨지지 않는다.
- mobile에서 버튼 글자가 넘치지 않는다.
- private warning은 어떤 테마에서도 경고처럼 보인다.

#### 6.3.2 Pixel Grid Rules

픽셀 기준:

- Layout spacing: 4px grid.
- Major spacing: 8px grid.
- Border width: 1px default, focus ring 2px, selected outline max 2px.
- Hairline glint: 1px, opacity 18% 이하.
- Cell gap: desktop 8px 또는 10px 중 하나로 고정. 혼용 금지.
- Card radius: repeated items 8-14px. Page section 0 또는 16px.
- Icon size: 16/18/20/24px scale.
- Touch target: mobile 44px 권장, 최소 40px.

테스트 관점:

- 375px, 390px, 430px mobile widths.
- 768px compact.
- 1180px studio narrow.
- 1440px desktop.
- 1700px/2400px zoom 정책 영향.

#### 6.3.3 Pixel-perfect QA 환경

권장 도구:

- Playwright visual screenshots: 현재 repo에 이미 `test:visual`.
- Storybook/Chromatic: 컴포넌트 단위 VRT가 필요해질 때 Phase 4 이후 도입 검토.
- CSS token snapshot: `:root` token dump 비교.
- Contrast script: token foreground/background 자동 계산.
- Reduced-motion screenshot: `html[data-reduce-motion]`.
- Export capture QA: html2canvas 결과 비교.

Visual QA matrix:

| Surface | Viewports | Themes | States |
|---|---|---|---|
| Viewer calendar | 390, 768, 1440 | light/dark | normal/today/live/filter |
| Mobile agenda | 375, 430 | light/dark | sheet open/closed |
| Studio calendar | 1180, 1440 | light | owner/manager/private |
| Tag rail | 390, 1440 | light/dark | selected/mixed/empty |
| Event card | component crop | light/dark | normal/live/important/private |
| Poster export | fixed export size | selected theme | with stickers/without stickers |

Threshold policy:

- UI component VRT: 0.1-0.2% diff target.
- Full page VRT: 0.5-1.0% diff allowed due dynamic content.
- Text overflow: zero tolerance.
- Private leakage: zero tolerance.

#### 6.3.4 Motion Craft Rules

모션은 감정이 아니라 상태 설명.

Rules:

- Tap feedback begins <= 50ms.
- Meaningful state update <= 100ms.
- Microinteraction total <= 260ms unless route/sheet.
- Infinite motion only LIVE, mini-game, decorative sticker. 모두 off 가능.
- Keyframe names use `vic-*`.
- Motion params live in token layer, not random component constants.
- `transition-all` 금지. property 명시.
- Layout-affecting animation 금지. transform/opacity 우선.

Motion families:

| Family | Use | Duration | Spring |
|---|---|---:|---|
| `press` | button/card press | 48-80ms | no or snap |
| `pop` | selected/saved/count | 140-180ms | tag/card spring |
| `settle` | sheet/card detail | 220-260ms | detail spring |
| `slide` | month/page | 240-300ms | low overshoot |
| `pulse` | LIVE only | 1.8s loop | CSS |
| `burst` | heart/success | 700-1100ms | CSS particle |

#### 6.3.5 Token Architecture for Vite + TypeScript

현재 repo는 Next지만, Vite + TypeScript 기준으로도 같은 token spine을 쓴다.

권장 파일 구조:

```txt
src/
  design/
    tokens/
      primitives.ts
      semantic.ts
      motion.ts
      shadows.ts
      index.ts
    css/
      tokens.css
      theme-light.css
      theme-dark.css
      patterns.css
      motion.css
    utils/
      contrast.ts
      spring.ts
      token-to-css.ts
```

현재 Next repo에 대응:

```txt
lib/design/tokens/
  primitives.ts
  semantic.ts
  motion.ts
  index.ts

app/globals.css
components/brand/victory-patterns.css
components/brand/victory-motion.css
```

Primitive token 예:

```ts
export const primitiveColors = {
  ink900: "#171321",
  paper50: "#F8FAFF",
  vitamin400: "#FFC83D",
  vitaminGreen500: "#38B76A",
  victoryViolet700: "#4228C8",
  liveRed600: "#D90F45",
  liveRed800: "#A90F36",
} as const;
```

Semantic token 예:

```ts
export const semanticColors = {
  textPrimary: "var(--vic-ink)",
  bgApp: "var(--vic-paper)",
  actionPrimaryBg: "var(--victory-yellow)",
  actionPrimaryText: "#2B1A00",
  stateLiveBg: "var(--live-red-deep)",
  stateLiveText: "#FFFFFF",
} as const;
```

Motion token 예:

```ts
export const springTokens = {
  tagToggle: { mass: 0.75, stiffness: 1050, damping: 42 },
  eventPress: { mass: 0.9, stiffness: 900, damping: 40 },
  detailOpen: { mass: 1, stiffness: 520, damping: 34 },
  monthSlide: { mass: 1, stiffness: 360, damping: 31 },
  stickerSettle: { mass: 0.8, stiffness: 460, damping: 24 },
} as const;

export const easeTokens = {
  standard: "cubic-bezier(0.22, 0.61, 0.36, 1)",
  emphasized: "cubic-bezier(0.2, 0, 0, 1)",
  pop: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  press: "cubic-bezier(0.2, 0, 0.38, 0.9)",
} as const;
```

CSS export concept:

```css
:root {
  --motion-tag-mass: 0.75;
  --motion-tag-stiffness: 1050;
  --motion-tag-damping: 42;

  --ease-standard: cubic-bezier(0.22, 0.61, 0.36, 1);
  --ease-pop: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

Tailwind 선택 시:

- Tailwind를 도입한다면 utility-first가 아니라 token delivery layer로만 쓴다.
- `tailwind.config.ts`는 generated semantic tokens를 참조한다.
- 컴포넌트에는 긴 utility chain 금지. `className="event-card event-card-live"` 우선.
- arbitrary value 남발 금지.

```ts
// tailwind.config.ts concept
theme: {
  extend: {
    colors: {
      vic: {
        ink: "var(--vic-ink)",
        paper: "var(--vic-paper)",
      },
      victory: {
        yellow: "var(--victory-yellow)",
        green: "var(--victory-green)",
      },
    },
    transitionTimingFunction: {
      "vic-pop": "var(--ease-pop)",
    },
  },
}
```

### 6.4 Creative UI Modules

#### 6.4.1 Victory Stage Shell

역할:

- 앱 전체를 generic dashboard가 아니라 "방송 스테이지의 일정판"으로 만든다.

구성:

- Quiet glass topbar.
- Stage tray background.
- Calendar grid as paper tiles.
- Header glint line.
- No hero.

Acceptance:

- 첫 화면에서 브랜드 톤이 보이지만 일정이 제일 먼저 읽힌다.
- 데스크톱/모바일 모두 다음 섹션 힌트가 보인다.

#### 6.4.2 Vitamin Tag Rail

역할:

- 팬들이 필터를 "놀이"처럼 다루게 한다.

구성:

- Content tags = capsule chip.
- Modifier tags = outline tab.
- Count = tiny pop number.
- Selected = violet underline/shared highlight.
- Heart filter = pink liquid heart control.

Anti-boilerplate:

- 모든 tag를 같은 pill로 만들지 않는다.
- chip 안 icon은 과용하지 않는다.
- swatch는 실제 event strip과 동일 패턴.

#### 6.4.3 Victory Event Card

역할:

- 일정 정보 단위. 가장 정교해야 함.

구성:

- 3px category rail.
- White text-safe body.
- Status slot fixed right.
- Optional Victory notch only for live/important.
- Hover glint, not generic shadow lift.
- Press -> impact -> settle.

States:

| State | Visual |
|---|---|
| normal | white body, tag rail |
| today | yellow ring around cell, not card |
| live | red deep badge, notch, pulse dot |
| important | yellow edge glow, no pulse |
| dimmed | opacity 0.34, text still readable if focused |
| selected | violet outline + shared detail |
| private | amber warning skin, lock, no playful motion |

#### 6.4.4 Broadcast Live Beacon

역할:

- 끌어당김 최상위.

구성:

- `LIVE` text badge.
- red dot pulse.
- KST now label.
- next action "보러가기" if URL public.

Rules:

- White on `--live-red-deep`.
- Pulse disabled in reduced motion.
- No multiple live beacons. One canonical source.

#### 6.4.5 Poster Craft Layer

역할:

- export quality와 브랜드 감성.

구성:

- safe area overlay in decorate mode.
- sticker collision hints.
- text outline/shadow presets.
- lower-alpha pattern in export mode.
- poster title lock-up.

Rules:

- Export text readability first.
- sticker never cover month title/date numbers by default.
- custom assets do not leak private UI.

### 6.5 Step-by-Step Modularization Roadmap

#### Milestone 0: Freeze Contract

목표:

- 공용 타입, 공개 DTO, KST 기준, 권한 boundary 고정.

Tasks:

- `PublicScheduleEvent` public fields 재확인.
- `StudioScheduleEvent` private fields 경계 재확인.
- `getTodayKst()` 사용 지점 목록화.
- current visual baselines 저장.

DoD:

- Public API leakage test 존재.
- 디자인 작업이 데이터 boundary를 건드리지 않음.

#### Milestone 1: Design Token Spine

순서:

1. `app/globals.css`에 primitive/semantic tokens 추가.
2. 기존 `--accent`, `--green`, `--violet` alias.
3. motion/easing CSS variables 추가.
4. contrast comments와 token table 삽입.

Files:

- `app/globals.css`
- optional `lib/design/tokens/*.ts`

DoD:

- 신규 색은 token으로만 사용.
- 기존 화면 큰 회귀 없음.
- contrast script로 core pairs 확인.

#### Milestone 2: Motion Context and Reduced Motion Bridge

순서:

1. 기존 `lib/ui/motion.ts` 유지/확장.
2. CSS motion classes 추가.
3. `html[data-reduce-motion]` override 확장.
4. optional haptic preference는 별도.

Files:

- `lib/ui/motion.ts`
- `app/globals.css`
- `components/ui/pop-number.tsx`

DoD:

- reduced motion에서 pulse/particle 사라짐.
- press feedback은 layout shift 없음.

#### Milestone 3: Brand Pattern Layer

순서:

1. `vitamin-fizz`, `capsule-diag`, `stage-glint`, `victory-notch` CSS utilities.
2. 기존 `data-color` pattern과 충돌 점검.
3. text-safe pattern rules 적용.

Files:

- `app/globals.css`
- `components/brand/victory-patterns.css` 또는 기존 CSS 섹션.

DoD:

- 패턴은 태그/배경 보조로만 보임.
- 텍스트 배경 위 busy pattern 없음.

#### Milestone 4: Tag Filter Rail Refactor

순서:

1. tag data lookup memoization.
2. `TagFilterRail` 추출 또는 현 위치 내부 모듈화.
3. content/modifier/heart 스타일 분리.
4. selected indicator motion.

Files:

- `components/poster/public-poster.tsx`
- `components/poster/public-poster.css`
- `lib/calendar/month.ts` if needed.

DoD:

- 필터 toggle visual feedback <= 50ms.
- calendar update <= 100ms target.
- keyboard/focus 동작 유지.

#### Milestone 5: Event Card Refactor

순서:

1. `EventCard` visual component 분리.
2. `LiveEventBadge` 분리.
3. status slot 고정.
4. important/live/private states 토큰화.
5. shared element hook 준비.

Files:

- `components/poster/public-poster.tsx`
- `components/studio/*` if shared.
- CSS.

DoD:

- normal/live/important/selected/private states screenshot 통과.
- long title overflow 없음.
- LIVE badge contrast AAA when small.

#### Milestone 6: Calendar Shell and Month Transition

순서:

1. `CalendarStageShell` 스타일 적용.
2. month label transition token화.
3. grid cell stable dimension 보장.
4. today ring/fizz 적용.

Files:

- `components/poster/public-poster.css`
- `components/studio/studio-shell.css`

DoD:

- hover/active로 grid reflow 없음.
- today/LIVE/next visual hierarchy 명확.

#### Milestone 7: Detail Panel and Shared Element

순서:

1. selected event detail panel 상태 정리.
2. CSS-only transition 먼저.
3. 필요 시 `motion/react` 도입 검토.
4. mobile bottom sheet `layoutRoot`/fallback 설계.

DoD:

- card -> detail transition flicker 없음.
- reduced motion fallback.
- no private detail in viewer.

#### Milestone 8: Studio Practical Skin

순서:

1. Studio utility tone 조정.
2. role-specific affordance 정리.
3. private warning-heavy mode 강화.
4. manager editable illusion 제거.

DoD:

- owner/developer/manager/worker screenshot 비교 통과.
- private unlock state unmistakable.
- server permission untouched.

#### Milestone 9: Poster Export Craft

순서:

1. export mode CSS token.
2. safe area/collision guide.
3. pattern alpha lowering.
4. font loading check.
5. html2canvas visual QA.

DoD:

- export screenshot text readable.
- controls/private/admin UI absent.
- sticker overlap guard.

#### Milestone 10: Visual Regression and Craft Gate

순서:

1. Playwright screenshots 확장.
2. component crops if Storybook unavailable.
3. contrast script in CI optional.
4. `craft checklist` PR template 추가.

DoD:

- token diff clear.
- visual diff reviewed.
- no layout overlap at target viewports.

### 6.6 Build Order: Root to Leaf

실제 코드 지시 순서:

```txt
1. Token foundation
2. Motion/reduced-motion foundation
3. Pattern utilities
4. Tag filter rail
5. Event card
6. Calendar shell
7. Detail/shared transition
8. Studio role/private skin
9. Poster/export polish
10. Visual QA gate
```

왜 이 순서인가:

- Token 없이 component를 먼저 바꾸면 색/모션 hardcode가 늘어난다.
- Motion context 없이 microinteraction부터 넣으면 중복 keyframe이 생긴다.
- Tag rail은 calendar보다 작고 영향 범위가 제한되어 첫 component refactor로 적합하다.
- Event card는 핵심이지만 risk가 높아 token/filter 이후 진행한다.
- Studio/private는 security perception이 중요해 viewer skin 안정 후 별도 집중한다.

### 6.7 Implementation Guardrails

코딩 단계 guardrail:

- 한 PR/단계당 핵심 파일 1-3개.
- CSS 변수 먼저, component markup 나중.
- hardcoded hex 추가 금지. token declaration 예외.
- 새 animation은 reduced-motion block 포함.
- 새 UI state는 Playwright target state로 캡처.
- public loader/server action 변경 시 security review 필수.
- manager/worker 권한 문구 변경 시 server permission 확인.

Review checklist:

- Contrast pass?
- KST label correct?
- Private fields absent from public?
- Touch target stable?
- Text overflow absent?
- Motion token used?
- Reduced motion fallback?
- Export mode safe?
- Generic template smell removed?

### 6.8 Phase 2 Acceptance Criteria

디자인:

- 화면을 3초 본 사람이 "generic calendar"가 아니라 "빅토리 팬 일정판"이라고 느낀다.
- 하지만 일정 읽기 속도는 줄지 않는다.
- LIVE/today/next priority가 명확하다.

장인정신:

- target viewport에서 pixel overlap 없음.
- hover/active layout shift 없음.
- key state screenshots 존재.
- token table과 구현 token 불일치 없음.

모듈화:

- tag rail, event card, live badge가 독립적으로 테스트 가능.
- motion token이 CSS/TS 양쪽에서 단일 출처를 가진다.
- Vite 이관 여부와 무관하게 design token spine 재사용 가능.

보안/운영:

- public/private boundary 영향 없음.
- owner-only editing 유지.
- KST 기준 유지.
- private mode는 warning-heavy 유지.

## 7. Source Notes

Brand/community:

- SOOP channel search results for `toryvac`, `빅토리~!`, `빅타민`: https://www.sooplive.com/station/toryvac
- DCInside 빅토리 미니 갤러리: https://gall.dcinside.com/mini/board/lists/?id=victory0219
- Zeta 빅토리 UGC page, 긍정/밝음/힐링 signal: https://zeta-ai.io/ko/plots/45b51379-addb-494f-a60f-6d7a09d0a3b0/profile
- Zeta 빅토리 UGC page, VICTORY intro signal: https://zeta-ai.io/ko/plots/3e56af2f-5080-44bc-9fee-2ab9ae50126e/profile

Accessibility/performance:

- WCAG 2.2 Contrast Minimum: https://www.w3.org/TR/WCAG22/#contrast-minimum
- WCAG 2.2 Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- NN/g Response Time Limits: https://www.nngroup.com/articles/response-times-3-important-limits/
- Chrome Lighthouse Estimated Input Latency: https://developer.chrome.com/docs/lighthouse/performance/estimated-input-latency

Motion:

- Motion React transitions: https://motion.dev/docs/react-transitions
- Motion React LayoutGroup: https://motion.dev/docs/react-layout-group
- Motion React layout animations: https://motion.dev/docs/react-layout-animations

Creative craft/design-system references:

- Awwwards animation and microinteractions collection: https://www.awwwards.com/awwwards/collections/animation/
- Awwwards site mission, high-end web design reference pool: https://www.awwwards.com/
- Dribbble glass motion search, glass/liquid motion inspiration pool: https://dribbble.com/search/glass-motion
- Dribbble glassmorphism animation search, frosted/motion UI examples: https://dribbble.com/search/glassmorphism-animation
- Figma web design trends, retrofuturism/neon/chrome/pixel-art signal: https://www.figma.com/resource-library/web-design-trends/
- Penpot guide to design tokens and CSS variables: https://penpot.app/blog/the-developers-guide-to-design-tokens-and-css-variables/
- Material Design tokens foundation: https://m3.material.io/foundations/design-tokens
- Material Web theming system tokens: https://material-web.dev/theming/material-theming/
- Storybook visual tests tutorial: https://storybook.js.org/tutorials/intro-to-storybook/react/en/test/
- Chromatic visual testing for Storybook: https://www.chromatic.com/storybook

Local references:

- `app/globals.css`
- `components/studio/studio-shell.css`
- `components/poster/public-poster.tsx`
- `components/poster/public-poster.css`
- `lib/calendar/month.ts`
- `lib/domain/schedule-types.ts`
- `lib/ui/motion.ts`
- `docs/design-overhaul-report.md`
- `docs/motion-haptics-immersion-report.md`
- `docs/security-boundary.md`
