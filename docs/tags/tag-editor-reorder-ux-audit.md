# 태그 편집 순서 변경 UX·결함 감사 보고서

> 작성일: 2026-08-26  
> 범위: 편집실의 **태그 편집** 모달/관리 화면과 대분류 태그 순서 변경  
> 방법: 저장소 정적 분석 + Apple HIG, Atlassian Pragmatic Drag and Drop, dnd-kit, SortableJS, React Spectrum 공식 문서 비교  
> 제외: 태그 필터의 색상 설계, 실제 코드 수정, 로그인된 브라우저에서의 동적 재현

## 1. 결론

사용자가 말한 “마지막 태그와 그 전 태그의 순서를 바꾸려 하면 두 번 이상 안 되는 것 같다”는 현상은 단순한 느낌이 아니라 **현재 소스에서 설명되는 구조적 결함**이다.

현재 정렬 함수는 포인터가 다른 항목 위에 올라왔을 때 드래그 항목을 언제나 그 항목의 **앞에만** 넣는다. 항목의 위쪽/아래쪽 절반을 구분하지 않고, 목록 맨 끝의 뒤를 나타내는 드롭 위치도 없다. 따라서 `[A, B, C]`에서 `B`를 `C` 아래로 보내기 위해 `B`를 잡아 `C` 위에 놓아도 결과는 다시 `[A, B, C]`이다. 반대로 `C`를 `B` 위로 끌면 `[A, C, B]`가 되므로, 사용자는 “방향에 따라 되고 안 되고, 같은 동작을 반복하면 한 번만 되는” 것으로 느끼기 쉽다.

‘툭툭 끊김’은 한 가지 원인이 아니라 다음이 겹친 결과로 판단한다.

1. 화면에 보이는 드래그 유령은 포인터를 22%씩 늦게 추적하지만, 순서 판정은 지연 없는 실제 포인터 좌표로 한다.
2. 같은 대상 위에서 포인터가 움직일 때마다 결과가 같아도 새 배열을 만들고 React 렌더를 일으킨다.
3. 그 렌더마다 모든 태그 행의 위치를 다시 측정하고 FLIP 애니메이션을 설정한다.
4. 같은 열의 짧은 이동만 애니메이션하고, 열 이동 또는 큰 이동은 의도적으로 즉시 스냅한다.
5. 유령 카드에 매 프레임 랜덤 흔들림·회전·확대가 적용되어 정밀한 배치 감각과 시각적 판정 위치가 어긋난다.
6. “여기에 놓인다”를 보여주는 삽입선이나 실제 빈칸이 없고, 원래 행의 투명도만 낮아진다.

가장 적합한 방향은 **재미있는 물리 효과를 더하는 것**이 아니라, 포인터와 카드가 거의 1:1로 붙고, 위/아래 가장자리 기반의 단 하나의 삽입 위치를 명확히 보여주는 것이다. Apple식 부드러움도 큰 바운스나 랜덤 흔들림보다 **직접 조작의 즉각성, 짧고 정밀한 이동, 연속적인 결과 피드백**에서 나온다.

## 2. 조사한 현재 구현

### 코드 경로

| 역할 | 경로와 근거 |
|---|---|
| 태그 편집 상태·드래그·저장 | `components/tags/tag-legend-editor.tsx` |
| 편집 모달 호출·부모 상태 반영 | `components/studio/studio-shell.tsx` |
| 태그 저장 서버 액션 | `lib/schedules/tag-actions.ts` |
| 행·유령·모달·반응형 스타일 | `components/studio/studio-shell.css` |
| 관련 자동 테스트 | 전용 순서 변경 테스트 없음 (`tests/` 검색 기준) |

### 현재 동작 흐름

```text
손잡이 pointerdown
  → 실제 행 전체를 cloneNode로 복제해 body에 유령 생성
  → 즉시 dragging 상태 진입(거리/시간 activation 조건 없음)
  → pointermove마다 실제 포인터 좌표로 elementFromPoint 수행
  → 가리킨 행이 바뀌면 moveBefore(active, over)
  → React 렌더 + 모든 행 위치 측정 + 일부 행 FLIP
  → 별도 requestAnimationFrame에서 유령은 포인터를 늦게 추적
  → pointerup 시 현재 로컬 순서를 남기고 유령 제거
  → 사용자가 ‘변경된 순서 저장’을 눌러 서버 반영
```

좋은 기반도 있다.

- 별도 드래그 손잡이가 있어 이름 입력·색 버튼·삭제 버튼과 드래그 시작 영역이 충돌하지 않는다.
- 유령에 `pointer-events: none`을 적용해 아래 행을 hit-test할 수 있다.
- 모달 내부의 실제 스크롤 조상을 찾아 자동 스크롤한다.
- 저장 전에는 로컬 순서로 유지하고 명시적 저장 버튼에서 서버에 반영한다.
- `휴뱅(dayoff)` 잠금 규칙을 클라이언트와 서버 양쪽에서 방어한다.
- 앱의 모션 감소 설정을 확인하는 경로가 있다.

즉, 전면 재작성보다 **정렬 의미, 직접 조작, 피드백, 접근성** 네 부분을 바로잡는 것이 핵심이다.

## 3. 발견 사항

### P0 — 마지막 위치로 내릴 수 없는 단방향 삽입 버그

근거는 `tag-legend-editor.tsx:263-271`, `324-336`이다.

```ts
function moveBefore(list, from, before) {
  const next = list.filter((id) => id !== from);
  const idx = next.indexOf(before);
  next.splice(idx, 0, from);
  return next;
}
```

현재 구현에는 `before`밖에 없고 `after`가 없다. 최소 재현은 다음과 같다.

| 시작 순서 | 사용자의 의도 | 현재 입력 | 실제 결과 |
|---|---|---|---|
| `A B C` | `B`를 맨 끝으로 | `B`를 `C` 위로 드래그 | `A B C` — 변화 없음 |
| `A B C` | 마지막 둘 교환 | `C`를 `B` 위로 드래그 | `A C B` — 가능 |
| `A C B` | 다시 원래대로 | `C`를 `B` 위로 드래그 | `A C B` — 변화 없음 |
| `A B C D` | `A`를 `C` 뒤로 | `A`를 `C` 위로 드래그 | `B A C D` — 기대보다 한 칸 덜 이동 |

판정: **정적 코드상 확정**. 다만 실제 포인터 경로·브라우저별 체감은 로그인된 런타임에서 별도 확인해야 한다.

### P0 — 보이는 카드와 실제 판정점의 위치 불일치

근거는 `tag-legend-editor.tsx:285-320`, `324-336`이다.

- 유령 위치: 매 프레임 `pos += (target - pos) * 0.22`로 뒤늦게 따라간다.
- 정렬 판정: `elementFromPoint(e.clientX, e.clientY)`로 실제 포인터를 즉시 사용한다.

빠르게 아래로 끌면 사용자가 보는 카드는 아직 위에 있는데 목록은 먼저 바뀐다. 반대로 멈추면 유령이 뒤늦게 도착하는 동안 이미 순서가 정해져 있다. 직접 조작에서 시각 객체와 판정점이 갈라지므로 “내 손보다 목록이 먼저 튄다”는 느낌이 생긴다.

### P1 — 같은 자리에서도 pointermove마다 무의미한 렌더가 발생

`moveBefore`는 최종 배열 내용이 이전과 같아도 원본 배열을 반환하지 않는다. 예를 들어 이미 `C A B`인 상태에서 `C`를 잡은 채 `A` 위에 계속 있으면 매번 새 `['C','A','B']`가 반환된다. `pointermove` 빈도만큼 `setOrderIds`가 호출되고, 의존성 배열이 없는 `useLayoutEffect`가 매 렌더 뒤 모든 `[data-tagid]`의 `getBoundingClientRect()`를 읽는다 (`tag-legend-editor.tsx:353-385`).

이 조합은 다음 프레임 비용을 만든다.

```text
pointermove → 새 배열 → React render → 전체 행 layout read
            → inline transform/transition → 다음 rAF에서 transform 해제
```

태그 수가 늘고 모달이 스크롤될수록 끊김 가능성이 커진다. 논리적 목적지가 바뀌지 않았다면 **동일 배열 참조를 반환하고 아무 일도 하지 않아야** 한다.

### P1 — 재배치 직후 hit target이 바뀌는 왕복 떨림 가능성

현재는 행 위에 올라가는 즉시 실제 DOM 순서를 바꾼다. 순서 변경으로 대상 행이 포인터의 반대편으로 이동하면 같은 포인터 좌표 아래에 다른 행이 들어오고, 다음 `pointermove`에서 다시 다른 순서 변경이 발생할 수 있다. SortableJS도 이를 별도로 “swap glitching”이라 설명하며, 마지막 방향과 역전된 swap zone을 기억해 무한 왕복을 막는다.

현재 구현에는 다음 중 어느 것도 없다.

- 항목 중앙선을 넘었을 때만 바꾸는 임계점
- 최근 이동 방향/대상 기억
- 같은 목적지에 대한 멱등성 검사
- 중앙 근처의 dead zone 또는 hysteresis

### P1 — 일부 항목은 미끄러지고 일부는 순간이동

`tag-legend-editor.tsx:369-381`은 같은 열이고 이동량이 행 높이 2.5배 이하인 경우만 220ms FLIP을 수행한다. 나머지는 `transition`과 `transform`을 비워 즉시 스냅한다.

CSS는 다음처럼 화면에 따라 여러 배치를 허용한다.

- 641px 이상 태그 모달: 콘텐츠/형식 섹션이 2열 (`studio-shell.css:12517-12528`)
- 1000px 이상 섹션 내부: `auto-fill` 그리드 가능 (`studio-shell.css:5653-5678`)
- 640px 이하: 1열 (`studio-shell.css:12546-12585`)

같은 드래그 안에서 어떤 이웃은 220ms로 움직이고 다른 이웃은 순간이동할 수 있다. 사용자가 말한 “툭툭”은 이 불연속과 일치한다. 특히 콘텐츠/형식 사이를 가로질러 끌 수는 있지만 화면은 계속 종류별로 필터링해 그리므로, 전역 `orderIds`와 보이는 두 목록의 의미도 어긋난다.

### P1 — 드롭 결과를 예측할 시각 신호가 없음

현재 원본 행은 `opacity: 0.3`, 유령은 큰 그림자·확대·회전을 사용한다 (`studio-shell.css:8136-8156`). 그러나 놓일 위치를 나타내는 삽입선, 빈 슬롯, `before/after` 표시는 없다.

드래그 장식은 눈에 띄지만 가장 중요한 질문인 “지금 놓으면 어느 두 태그 사이에 들어가는가?”에는 답하지 못한다. 태그 자체의 색은 데이터 의미이므로 드롭 상태 색과도 분리해야 한다.

### P1 — 키보드로는 순서 변경 불가

손잡이는 `<button>`이라 포커스는 가능하지만 순서 변경 핸들러는 `onPointerDown`뿐이다 (`tag-legend-editor.tsx:792-805`). 키보드 lift/move/drop/cancel, 현재 위치 안내, 스크린리더 live announcement가 없다.

키보드 접근성은 부가 기능이 아니라 드래그 실패 시의 대체 조작이기도 하다. “위로 이동/아래로 이동” 메뉴 또는 키보드 드래그 중 하나는 반드시 있어야 한다.

### P1 — 저장 전 변경을 닫을 때 아무 경고 없이 잃음

태그 편집기는 순서·이름·색·새 태그를 로컬 draft로 유지하지만, 모달의 닫기·배경 클릭·Escape는 `setModal(null)`을 바로 수행한다 (`studio-shell.tsx:1144-1154`, `5940-5969`). 편집기의 `dirty` 상태는 부모에게 전달되지 않으므로 닫기 경고가 없다.

특히 드래그 직후에는 이미 화면 순서가 바뀌어 “적용되었다”는 느낌을 주는데, 저장하지 않고 닫으면 사라진다. 다음 중 하나로 계약을 명확히 해야 한다.

- 권장: 드롭은 draft만 변경, 닫기 시 dirty면 “변경사항 버리기 / 계속 편집” 확인
- 대안: 드롭 즉시 자동 저장 + 실패 시 원위치/오류 피드백

현재의 명시적 `전체 저장` 구조를 유지한다면 첫 번째가 일관적이다.

### P2 — 드래그 시작과 종료의 안전장치 부족

- `pointerdown` 즉시 유령이 생긴다. 마우스 이동 거리나 터치 long-press 조건이 없다.
- `setPointerCapture`가 없고 창 blur/visibility change 취소 처리도 없다.
- `pointercancel` 뒤 남는 `pointerup` one-shot listener 등 정리 경로가 완전히 대칭적이지 않다.
- `cloneNode(true)`로 입력·버튼이 든 행 전체를 복제하지만 유령에 `aria-hidden`/`inert`를 명시하지 않는다.
- 드롭 취소 시 원래 순서 스냅샷으로 복구하는 상태가 없다. 현재 `pointercancel`도 그 시점의 미리보기 순서를 그대로 남긴다.

### P2 — 태그 관리의 정보 구조가 기능 범위를 숨김

버튼은 “태그 편집”, 모달 제목은 “태그 이름 · 색상 편집”이지만 실제로는 이름·색·종류·순서·추가·삭제·저장을 모두 처리한다. 콘텐츠↔형식 전환도 색상 팝오버 안에 숨어 있어 종류 이동과 색 변경이 한 동작처럼 결합되어 있다.

권장 정보 구조는 다음과 같다.

- 제목: `태그 관리`
- 섹션: `콘텐츠 태그`, `형식 태그`
- 행의 1차 조작: 이름, 색, 더보기
- 더보기: 종류 변경, 위로 이동, 아래로 이동, 삭제
- 드래그는 같은 섹션 안의 순서 변경만 담당

### P2 — 저장 후 부모 상태에 `kind`/`parentId`가 반영되지 않음

편집기의 저장 payload는 `kind`와 `parentId`를 포함하지만 (`tag-legend-editor.tsx:699-706`), 부모의 `applyTagUpdates` 타입과 매핑은 이름·색·`bgHex`·`sortOrder`만 적용한다 (`studio-shell.tsx:3851-3869`). 서버에는 저장돼도 현재 클라이언트 세션의 부모 `tags`에는 종류/부모 변경이 즉시 반영되지 않는다.

종류 변경 직후 편집기를 닫았다 다시 열 때 서버 재동기화 타이밍에 따라 이전 섹션으로 되돌아온 것처럼 보일 수 있다. 드래그 버그와 별개지만 “태그 편집 프로세스가 어색하다”는 인상을 강화하는 상태 일관성 문제다.

## 4. 공식 제품·라이브러리 벤치마크

| 기준 | 공식 지침/구현 | 이 프로젝트에 적용할 점 |
|---|---|---|
| 직접 조작 | Apple HIG는 제스처에 가능한 한 즉시 반응하고, 사용자가 결과를 예측할 수 있는 지속적 피드백을 요구한다. 드래그 이미지는 약 3pt 이동 후 표시하고 과도하게 계속 변형하지 않도록 한다. | 22% 지연과 랜덤 흔들림 제거, 3~6px 이동 후 활성화, 포인터와 1:1 추적 |
| 결과 표시 | Atlassian은 상대적 순서에 2px 삽입선을 사용하고, 쌓인 목록에서는 항목 사이 중앙에 표시하라고 한다. `before`와 `after`를 closest edge로 구분한다. | 유령보다 삽입 위치를 주인공으로 만들고 위/아래 edge를 명시 |
| 드롭 후 | Atlassian은 즉시 낙관적 반영하고, 이동된 항목을 한 번 짧게 flash하여 결과를 확인시키는 방식을 권한다. | 저장 방식과 별개로 드롭 후 150~220ms 착지 + 1회 은은한 강조 |
| 임계점·떨림 | SortableJS는 대상의 앞/뒤 swap zone, threshold, 마지막 방향 기억으로 왕복 glitch를 막는다. | 중앙선 + 작은 dead zone + 마지막 destination 기억 |
| 스크롤 목록 | dnd-kit은 스크롤되거나 뷰포트보다 긴 sortable list에 viewport 기준 `DragOverlay`를 권장하고 drop animation을 제공한다. | body 유령 아이디어는 유지 가능하나 표시 컴포넌트와 hit-test 좌표를 일치 |
| 입력 장치 | dnd-kit 예시는 마우스 10px 이동, 터치 250ms/5px 허용, 키보드 sensor를 조합한다. | 정확한 수치는 실기기 조정하되 입력별 activation constraint 도입 |
| 접근성 | React Spectrum은 Enter로 드래그 시작, 화살표로 목록 내 드롭 위치 이동, Enter로 드롭, Escape로 취소하고 스크린리더 안내를 제공한다. | 포커스 가능한 손잡이를 실제 키보드 정렬 컨트롤로 완성 |

이 벤치마크에서 공통되는 핵심은 “카드를 화려하게 떠다니게 한다”가 아니라 다음 네 가지다.

1. 어디에 들어갈지 한 위치만 명확하게 보인다.
2. 앞/뒤를 모두 표현하고 맨 앞·맨 뒤가 실제 목적지다.
3. 포인터·터치·키보드가 같은 순서 결과를 만든다.
4. 레이아웃은 움직이되 판정 위치는 안정적이다.

## 5. 권장 목표 UX

### 5.1 레이아웃

- 데스크톱에서 콘텐츠/형식 두 섹션을 좌우에 두는 것은 유지할 수 있다.
- 단, **각 섹션 내부는 한 방향 세로 목록**으로 고정한다. 정렬이 목적일 때 2차원 wrap/grid는 순서를 읽기 어렵다.
- 드래그는 같은 섹션 안에서만 허용한다. 종류 변경은 명시적 메뉴/세그먼트로 분리한다.
- `휴뱅`은 최상단 고정 행으로 두고 잠금 아이콘과 “고정 태그” 설명을 제공한다.
- 모바일도 같은 세로 순서 모델을 사용하되, 44px 이상 손잡이와 행 전체 높이를 유지한다.

### 5.2 드래그 시작

| 입력 | 제안 |
|---|---|
| 마우스/트랙패드 | 손잡이에서 4~6px 이동 후 드래그 활성화 |
| 터치 | 손잡이 180~250ms 누름 + 5~8px 이동 허용 후 활성화 |
| 키보드 | 손잡이에 포커스 → Space/Enter로 들기 |

활성화 순간에만 아주 짧은 haptic/시각 상승을 준다. `pointerdown`만으로 목록이 움직이면 안 된다.

### 5.3 드래그 중

- 유령은 포인터/손가락과 거의 1:1로 따라간다. 회전은 없거나 최대 0.5~1도, 랜덤 흔들림은 사용하지 않는다.
- 원래 자리는 높이를 보존한 placeholder로 남긴다.
- 대상 행의 상단/하단 edge 중 가까운 쪽을 계산한다.
- 항목 사이에 2px accent 삽입선과 작은 원형 terminal을 표시한다.
- 삽입선이 첫 행 위와 마지막 행 아래에도 나타나야 한다.
- 목적지 index가 실제로 달라질 때만 preview order를 갱신한다.
- 중앙선 주변 6~10px는 dead zone으로 두거나 마지막 edge를 유지해 왕복 떨림을 막는다.
- 자동 스크롤 속도는 가장자리와의 거리에 비례시킨다. 고정 11px/frame보다 끝에 가까울수록 빨라지는 방식이 예측 가능하다.

### 5.4 드롭·취소

- 드롭: 160~220ms 안에 유령이 새 자리로 착지하고, 이동된 행 배경을 한 번만 은은하게 flash한다.
- Escape, `pointercancel`, 창 focus 상실: 드래그 시작 시 스냅샷으로 순서를 복구한다.
- 드롭 후 상태는 `저장되지 않음`으로 명확히 표시한다. 저장 버튼 라벨은 `변경사항 저장`으로 통일해 이름·색·순서를 포괄한다.
- dirty 상태에서 닫기/배경 클릭/Escape 시 버리기 확인을 제공한다.

### 5.5 시각 디자인

부드러운 Apple식 감각은 정밀성과 절제에서 만든다.

```text
기본 행       흰색/중립 surface + 얇은 hairline + 약한 shadow
hover         아주 옅은 accent tint, 손잡이 대비 상승
들린 원본     35~45% opacity 또는 빈 placeholder, 높이 유지
유령          96~98% opacity, 1.01~1.02 scale, 짧고 부드러운 shadow
삽입 위치     사이트 selection accent의 2px line + 6~8px terminal
잘못된 위치   삽입선 없음 + 필요할 때만 금지 cursor/짧은 안내
착지          160~220ms ease-out + 1회 tint flash
```

태그 고유색은 행의 색상 스와치에만 쓴다. 파란색/민트/보라 등 인터랙션 accent는 “현재 드롭 위치”에만 써서 태그 데이터 색과 조작 상태를 혼동하지 않게 한다.

## 6. 권장 정렬 모델

핵심은 `moveBefore`를 “항목 + edge” 기반 목적지로 바꾸는 것이다.

```ts
type Edge = "before" | "after";

function reorderAtEdge(ids, activeId, overId, edge) {
  const from = ids.indexOf(activeId);
  const over = ids.indexOf(overId);
  if (from < 0 || over < 0 || activeId === overId) return ids;

  const without = ids.filter((id) => id !== activeId);
  const overAfterRemoval = without.indexOf(overId);
  const destination = edge === "after" ? overAfterRemoval + 1 : overAfterRemoval;

  const next = without.slice();
  next.splice(destination, 0, activeId);
  return sameOrder(ids, next) ? ids : next;
}
```

판정은 행 중앙을 기본으로 하되 떨림 방지를 추가한다.

```text
pointerY < row.midY - deadZone  → before
pointerY > row.midY + deadZone  → after
그 사이                         → 직전 edge 유지
```

이 모델은 마지막 행의 `after`가 실제 배열 길이 위치가 되므로 마지막 두 태그 교환 문제가 자연스럽게 사라진다. 별도 “마지막 더미 행” 없이도 끝 위치를 표현할 수 있다.

## 7. 구현 선택지

### A. 현재 커스텀 구현을 정리 — 단기 권장

범위가 한 화면의 두 세로 목록이고 외부 드롭이 없다면 먼저 다음만 교체하는 편이 가장 작다.

- 순수 함수 `reorderAtEdge` 추출
- midpoint/closest-edge 판정
- 동일 목적지 no-op
- 포인터와 유령 1:1 추적
- 랜덤 물리 제거
- 삽입선/placeholder 추가
- 섹션 간 드롭 차단
- 취소 스냅샷과 dirty close guard

장점은 의존성 추가 없이 현재 저장 계약을 유지하는 것이다. 단점은 키보드·스크린리더·자동 스크롤·브라우저 예외를 계속 직접 관리해야 한다.

### B. Atlassian Pragmatic Drag and Drop 채택 — 중기 최우선 검토

이 프로젝트에는 가장 잘 맞는 라이브러리 후보로 보인다.

- React 19에서도 DOM adapter 중심으로 연결할 수 있다.
- `reorder`, closest-edge hitbox, drop indicator, auto-scroll, live region을 목적별 패키지로 선택할 수 있다.
- Trello/Jira류의 조밀한 관리 목록 경험과 직접 연결된 설계 지침이 있다.
- 현재처럼 입력·색상·삭제 버튼이 섞인 행에서 명시적 handle을 유지할 수 있다.

단, 실제 도입 전에는 번들 크기, React Strict Mode cleanup, 모바일 Safari pointer 동작을 작은 spike로 검증해야 한다.

### C. dnd-kit sortable 채택 — React 중심 대안

`useSortable`, `verticalListSortingStrategy`, `DragOverlay`, pointer/touch/keyboard sensor 구성이 명확하다. React 상태 모델과 결합하기 쉽고 현재 커스텀 FLIP 대부분을 대체할 수 있다. 다만 공식 문서가 현재 신규/legacy 계열로 나뉘므로 도입 시점의 권장 패키지와 마이그레이션 상태를 다시 확인해야 한다.

### 권장 의사결정

1. P0 결함은 A 방식의 작은 수정으로 즉시 해결한다.
2. 접근성과 브라우저 예외까지 완성할 작업 여력이 있으면 B를 별도 spike한다.
3. SortableJS는 swap threshold 설계 참고용으로는 좋지만, React가 DOM 순서를 소유하는 이 화면에 직접 DOM 재배치 라이브러리를 섞는 것은 우선순위가 낮다.

## 8. 검증 사양

### 순수 함수 단위 테스트

| 케이스 | 기대 |
|---|---|
| 첫 항목을 마지막 행 `after`로 | 맨 끝으로 이동 |
| 마지막 항목을 첫 행 `before`로 | 맨 앞으로 이동 |
| 마지막 둘을 앞→뒤 방향으로 교환 | 성공 |
| 위 교환을 같은 방식으로 반복해 원복 | 성공 |
| 현재와 동일한 목적지 | 같은 배열 참조 반환 |
| `휴뱅` 이동 또는 그 앞 드롭 | 거부 |
| 콘텐츠를 형식 섹션으로 드롭 | 거부, 순서 불변 |
| 새 임시 태그와 기존 태그 혼합 | ID 유실·중복 없음 |

### 상호작용 테스트

- 마우스로 천천히/빠르게 위아래 이동해 유령과 삽입선이 같은 목적지를 가리키는지
- 같은 중앙선 주변을 왕복해도 목록이 핑퐁하지 않는지
- 모달 자동 스크롤 중 마지막 행 아래에 놓을 수 있는지
- 드래그 중 Escape, pointer cancel, 브라우저 blur에서 원래 순서로 돌아오는지
- 저장 후 닫고 다시 열어 같은 순서와 종류가 유지되는지
- 저장 실패 시 이전 순서와 오류 안내가 함께 복구되는지
- dirty 상태로 닫기/배경 클릭/Escape를 시도할 때 확인되는지
- 200%, 400% 확대와 320px 폭에서 손잡이·삽입선·저장 버튼이 가려지지 않는지

### 키보드·스크린리더 테스트

```text
Tab으로 손잡이 포커스
→ Space/Enter: “OO 태그를 들었습니다. 현재 3/12.”
→ ArrowUp/ArrowDown: 순서 이동 및 위치 안내
→ Space/Enter: “OO 태그를 5/12 위치에 놓았습니다.”
→ Escape: 취소하고 원래 위치 안내
```

보조 대안으로 행의 더보기 메뉴에 `맨 위로`, `위로`, `아래로`, `맨 아래로`를 제공하면 드래그가 어려운 사용자뿐 아니라 긴 목록의 파워 유저에게도 유용하다.

### 성능 수용 기준

- 같은 destination 위의 pointermove는 React state update 0회
- 드래그 프레임에서 전체 목록 DOM 측정은 목적지가 바뀔 때만 수행
- 유령 이동은 transform 기반 한 프레임 쓰기만 수행
- 120개 허용 상한에서도 빠른 드래그 중 눈에 띄는 프레임 정지 없음
- reduced motion에서는 흔들림·확대·FLIP 없이 위치/삽입선만 즉시 갱신

## 9. 권장 작업 순서

1. `moveBefore` 재현 단위 테스트를 먼저 추가해 마지막 두 항목 결함을 고정한다.
2. `reorderAtEdge`와 destination no-op을 적용한다.
3. 유령 지연·랜덤 흔들림을 제거하고 포인터와 판정점을 일치시킨다.
4. 각 섹션을 세로 정렬 컨테이너로 명시하고 섹션 간 드롭을 막는다.
5. 삽입선, placeholder, 착지 flash를 추가한다.
6. 취소 스냅샷과 저장 전 닫기 경고를 추가한다.
7. 키보드 정렬과 live announcement를 완성한다.
8. 필요하면 Pragmatic Drag and Drop spike 후 커스텀 드래그 코드를 대체한다.

P0 1~3만으로도 사용자가 지적한 “마지막 둘”과 “툭툭 끊김”의 큰 부분이 해결된다. P1 4~7까지 가야 태그 관리 전체가 신뢰할 수 있고 부드러운 경험이 된다.

## 10. 근거 자료

아래는 모두 2026-08-26에 확인한 공식 자료다.

- [Apple Human Interface Guidelines — Drag and drop](https://developer.apple.com/design/human-interface-guidelines/drag-and-drop): 약 3pt 이동 후 drag image 표시, 연속 피드백, 삽입점/허용 대상 표시, 과도하게 변하는 drag image 회피
- [Apple Human Interface Guidelines — Motion](https://developer.apple.com/design/human-interface-guidelines/motion): 제스처와 기대를 따르는 현실적 피드백, 짧고 정밀한 애니메이션, 불필요한 반복 모션·지속 진동 회피
- [Apple Human Interface Guidelines — Gestures](https://developer.apple.com/design/human-interface-guidelines/gestures): 직접 조작에 즉각 반응하고 결과를 예측할 피드백 제공
- [Atlassian Pragmatic Drag and Drop — Design guidelines](https://atlassian.design/components/pragmatic-drag-and-drop/design-guidelines/): 명시적 handle, before/after drop indicator, 드롭 후 optimistic update와 flash
- [Atlassian Pragmatic Drag and Drop — Packages](https://atlassian.design/components/pragmatic-drag-and-drop/optional-packages): hitbox, drop indicator, auto-scroll, accessibility, live-region 패키지
- [dnd-kit Sortable overview](https://dndkit.com/legacy/presets/sortable/overview/): vertical list strategy, closest center/corners, DragOverlay, pointer/touch/keyboard sensor와 activation constraint
- [SortableJS — Swap thresholds and direction](https://github.com/SortableJS/Sortable/wiki/Swap-Thresholds-and-Direction): 앞/뒤 swap zone과 threshold, swap glitching 방지 원리
- [React Spectrum — Drag and Drop](https://react-spectrum.adobe.com/dnd): 마우스·터치와 동등한 키보드/스크린리더 drag-and-drop 흐름

## 11. 조사 한계

이번 작업은 요청대로 제품 코드를 수정하지 않고 정적 분석과 공개 공식 자료 조사만 수행했다. 로그인 권한·실데이터·기기별 포인터 이벤트가 필요한 실제 모달 조작, 프레임 프로파일링, 모바일 Safari 재현은 수행하지 않았다. 따라서 P0 단방향 삽입은 코드로 확정할 수 있지만, 체감 끊김에서 각 원인이 차지하는 비율은 구현 전 성능 측정으로 확인해야 한다.
