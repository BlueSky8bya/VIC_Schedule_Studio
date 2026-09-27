# ADR-0029 — 색 의미 3족: 떡밥 보라 · 선택 물빛 · 크롬 보라

Status: Accepted

Date: 2026-09-27 KST. Authority: owner reported three times that the teaser (최초공개) color and the
"selected schedule" color read as one, then asked for a systematic clean-up rather than a spot fix.

## 문제

`--violet`(#5b34f0)이 "무대/선택/포커스"를 한 토큰에 묶고 있었고, 그 위에 리터럴이 세 갈래로 쌓였다.

- 떡밥: `#7c6cf0` · `#5b4aa6` · `#4d3f8f` · `rgb(124 108 240 / α)` (포스터 52곳, 편집실 19곳). 일관됐지만 토큰이 없었다.
- 편집 대상: 편집 패널 강조·리더선·그립·저장 플래시·잇기 모드·드래그 고스트가 `#8b5cf6`/`rgb(139 92 246 / α)`,
  선택 링·hover 채움은 `--violet`, 편집 중 일정 점선은 `#8b5cf6` 점선. 떡밥 점선과 같은 보라.
- 크롬: 설정 스위치·칩·줌·dev 배지가 `#6b5bd6`와 떡밥 리터럴 `rgb(124 108 240 / α)`를 섞어 씀.
- 파랑도 넷: 편집실 물빛 `--studio-action`, 포스터 링크 `#3564e0`, 토요일 `#2563eb`/`#2f6bd8` 혼용,
  그리고 2026-09-27 오전에 선택용으로 새로 넣은 `#2f7fe0`.

## 결정

세 의미에 세 토큰족. 새 색은 만들지 않는다.

| 의미 | 토큰 | 값 | 쓰는 곳 |
|---|---|---|---|
| 떡밥(최초공개) | `--teaser` `--teaser-deep` `--teaser-ink` `--teaser-soft` `--teaser-rgb` | #7c6cf0 · #5b4aa6 · #4d3f8f · #c4b5fd · 124 108 240 | 카드·점선·게이트·카운트다운 링·기대돼요·리더선(하이프)·옵션 칩·방송 판서 떡밥 카드 |
| 선택 / 편집 대상 / 포커스 | `--selection-hue` `--selection-rgb` `--selection-fill` `--selection-border` `--selection-overlay` `--focus-ring` | 전부 `--studio-action*`(물빛)에서 파생 | 칸 링·범위 음영·편집 중 점선·편집 패널 배지/윗선/그립/리더선/저장 플래시·잇기 모드·드래그 고스트·휴방 대상 칸·키보드 포커스·검색 셀 플래시·방송 판서 선택(마퀴·레이어·열) |
| 브랜드 크롬 | `--violet` `--violet-rgb` `--violet-soft` | 기존 값 | 설정 스위치·칩·줌 컨트롤·dev 배지·이용 기록·날짜 선택기 |

- 선택 물빛은 눈 편한 테마·다크 값을 `--studio-action`이 이미 갖고 있으므로 테마별 재정의를 두지 않는다.
  다크 모드의 on 상태가 원래 `--studio-action-tint/text`였으니 라이트가 다크를 따라간 셈이다.
- 토요일은 `#2563eb` 하나. `#2f6bd8`는 폐기.
- 크롬 보라 리터럴(`#6b5bd6`, 편집실 `rgb(124 108 240 / α)` 잔여 ~60곳, 날짜 선택기)은 이번에 손대지 않았다.
  의미상 떡밥과 겹치지 않고(상태가 아니라 도구 장식), 값을 `--violet`로 바꾸면 채도가 올라 크롬 인상이 바뀐다.
  후속: `--violet`를 `#6b5bd6`로 내리고 크롬 리터럴을 토큰화할지는 소유자 판단.

## 규칙

- 새 "선택됨/편집 중/대상" 표시는 `--selection-*`만 쓴다. 보라 리터럴 금지.
- 새 떡밥 표시는 `--teaser-*`만 쓴다. `rgb(124 108 240 …)` 리터럴 금지.
- JS에서 SVG 선 색을 줄 때는 `el.style.stroke = "var(--selection-border)"`처럼 style로 준다(속성은 var() 불가).
- UI-02의 "일정 편집 violet"은 "일정 편집·선택 물빛(--selection)"으로 읽는다. 떡밥 링만 보라.

## 검증

fixture(편집실·포스터, 라이트/다크)에서 계산값: 선택 링·편집 중 점선·배지 = `#2e568a`(눈 편한) / `#6aa6f0`(다크),
떡밥 카드 = `#5b4aa6→#7c6cf0`, 리더선 점 = 보라, 칸 범위 음영 = 물빛 14%. `tsc`·`next lint`·`next build` 통과.
