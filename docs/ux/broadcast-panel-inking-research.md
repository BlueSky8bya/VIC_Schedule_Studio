# 방송 판서(일정 그림판) 잉크·도구 UX 연구 아카이브

> 2026-07-26 작성·감사. 판서 패널 개선의 근거 문서다. 코드를 고치기 전에 먼저 갱신한다.
> 각 절의 **→ 적용**은 저장소 결정, **→ 한계/검증**은 아직 증명하지 않은 범위를 뜻한다.

## 읽는 법

- 논문의 지각 실험값은 제품의 허용 지연 예산이 아니다. 제품 성능은 별도 측정한다.
- 제품 벤치마크는 설계 영감이다. 특정 앱이 똑같이 구현했다는 증거로 쓰지 않는다.
- 표준 API가 입력 형식을 통일해도 하드웨어·드라이버·브라우저의 체감 동작까지 같아지진 않는다.

## 1. 잉크 지연(latency) 지각

- Ng·Annett 등은 스타일러스 드래그에서 약 1ms와 2ms, 단순 낙서에서 7ms와 40ms도
  구분될 수 있음을 보였다.
  ([In the Blink of an Eye, CHI 2014](https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-SIGCHI-Latency.pdf))
- 후속 실험은 7ms 기준과 비교했을 때 실제 잉킹 과제의 JND 중앙값을 세로선 53ms,
  단어 쓰기 50ms, 별 그리기 61ms로 보고했다. 이는 **7ms 기준 대비 차이를 알아차린 값**이며,
  “50ms까지 괜찮다”는 절대 지각 한계나 만족도 기준이 아니다. 과제·시각 참조점·주의에 따라서도
  달라진다.
  ([How Low Should We Go?, GI 2014](https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-GI-Latency.pdf))
- Pointer Events Level 3의 `getCoalescedEvents()`는 브라우저가 한 `pointermove`에 합친
  원시 위치 변화를 복원한다. 샘플 수나 120Hz 이상 수신을 보장하는 API는 아니다.
  `getPredictedEvents()`는 미래 위치를 추정해 먼저 그릴 수 있게 하며, 예측은 다음 포인터
  이벤트까지만 유효하므로 즉시 폐기·교체해야 한다.
  ([Pointer Events 3 — coalesced/predicted events](https://www.w3.org/TR/pointerevents3/#coalesced-and-predicted-events),
  [MDN getCoalescedEvents](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getCoalescedEvents),
  [MDN getPredictedEvents](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getPredictedEvents))
- `desynchronized: true`는 브라우저에 저지연 캔버스 경로를 요청하는 힌트다. 실제 적용 여부는
  사용자 에이전트가 정하며 tearing 가능성이 있다. Ink API는 OS 컴포지터에 임시 잉크 꼬리를
  위임하지만 현재 experimental/non-Baseline이고 최종 stroke renderer를 대체하지 않는다.
  ([HTML Canvas 2D context](https://html.spec.whatwg.org/dev/canvas.html),
  [MDN Ink API](https://developer.mozilla.org/en-US/docs/Web/API/Ink_API))

**→ 적용**:

- feature detection + 단일 호출로 coalesced samples를 소비하고, 미지원 환경은 부모 이벤트로
  폴백한다.
- rAF 병합 + 확정 조각 증분 렌더로 앱이 만드는 대기열을 프레임당 한 번으로 제한한다.
- 실제 stroke와 분리된 일회성 prediction 캔버스에서만 예측 꼬리를 그리고 다음 이벤트에
  교체한다. 예측점은 store·undo·최종 레이어에 들어가지 않는다.
- `desynchronized`는 라이브·prediction 임시 캔버스에만 요청한다. 최종 레이어는 안정적 재생과
  픽셀 읽기를 위해 일반 컨텍스트를 유지한다.

**→ 한계/검증**: rAF 약 1프레임은 전체 지연이 아니라 앱 파이프라인 일부다. digitizer→OS→
이벤트 전달→브라우저→컴포지터→디스플레이의 end-to-end 지연은 iPad Safari와 Wacom
Chrome/Edge 고속 촬영 전까지 **미측정**이다. Ink API는 미적용.

## 2. 필압 곡선(pressure curve)

- Fresco와 Krita는 사용자가 전체 필압 응답 곡선을 조정하게 한다. 이 자료가 입증하는 것은
  “성숙한 드로잉 앱은 장치·사용자에 맞춘 비선형 응답을 제공한다”는 점이다. 모든 앱이 감마를
  쓰거나 특정 지수값이 표준이라는 뜻은 아니다.
  ([Adobe Fresco pressure curve](https://helpx.adobe.com/be_en/fresco/desktop/draw-paint-animate-and-share/pressure-curve.html),
  [Krita tablet settings](https://docs.krita.org/en/reference_manual/preferences/tablet_settings.html))
- Pointer Events는 지원되는 압력을 0..1로 정규화한다. 압력 미지원 장치는 active 상태에서
  0.5를 반환할 수 있다. 같은 API 경로는 확보되지만 최소 필압·원시 곡선·샘플링 빈도는
  장치/드라이버/브라우저마다 다를 수 있다.
  ([Pointer Events 3 — `pressure`](https://www.w3.org/TR/pointerevents3/#dom-pointerevent-pressure))
- 고정 “이웃 샘플 50%” EMA는 샘플링 빈도가 높을수록 같은 시간 안에 더 많이 갱신되어
  장치별 반응이 달라진다. 시간 간격 `dt`를 쓰는 EMA가 같은 시간 상수를 유지한다.

**→ 적용**: `pressure^0.65`는 연구 표준이 아닌 이 제품의 경험적 기본값이다. 첫 점부터 같은
곡선을 적용하고, `alpha = 1 - exp(-dt / 12ms)` 시간 기반 EMA로 평활한다. 마우스/터치는
속도 역산 폴백을 유지한다. tilt/twist는 방송 설명용 판서 범위를 넘겨 미사용.

**→ 한계/검증**: iPad·Wacom은 `pointerType:"pen"`과 정규화된 `pressure`를 소비하는 코드만
공유한다. 체감 패리티는 확보됐다고 단정하지 않는다. 최소/최대 압력, 탭 첫 점, 느린 필기,
빠른 획을 두 실기기에서 확인한다.

## 3. 파밍(palm rejection)

- Schwarz 등은 iPad 2/iOS 6와 수동 고무 스타일러스를 대상으로 touch 면적·이웃 거리·속도·
  시간 변화를 분류해 오입력을 stroke당 0.016까지 줄였다. 현대 active pen의
  `pointerType` 분리나 “펜 후 1초 차단”을 검증한 연구는 아니다.
  ([Probabilistic Palm Rejection, CHI 2014](https://robertxiao.ca/pubs/2014_CHI_Palm-Rejection.pdf))
- Hinckley 등은 Windows의 “펜이 범위 안에 오면 touch를 끄는” 방식을 소개하지만, 동시에
  의도적 양손 입력까지 막는 한계도 지적하고 센서 기반 문맥 판별을 제안한다.
  ([Sensing Techniques for Tablet+Stylus](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/paper2557_Sensing20Techniques20for20Stylus20Tablet20Interaction.pdf))
- Pointer Events 표준도 일부 OS/브라우저가 pen 사용 중 touch를 자체 억제할 수 있으며,
  웹 작성자가 그 동작을 강제할 수 없다고 명시한다.
  ([Pointer Events 3 — primary pointer note](https://www.w3.org/TR/pointerevents3/#the-primary-pointer))

**→ 적용**: OS/브라우저 억제를 1차 방어로 두고, 앱은 보수적 **pen-priority 휴리스틱**을 쓴다.
pen 접촉 중과 마지막 접촉 뒤 1초 미만의 새 touch stroke를 무시한다. 초기값은 `null`이라
펜 이력 없는 첫 touch를 막지 않는다. hover는 유예를 연장하지 않는다. palm touch가 먼저
live stroke를 잡아도 pen이 오면 touch stroke를 취소하고 해당 레이어를 재생한 뒤 pen이 선점한다.
`pointercancel`/예기치 않은 capture 상실은 획을 커밋하지 않으며, 정지한 펜의 `pointerup` 시각도
마지막 접촉으로 기록한다.

**→ 한계/검증**: 1초는 논문에서 도출된 값이 아닌 제품 선택이다. 현재 캔버스에는 의도적
touch pan/zoom이 없어 pen 우선 비용이 작다. 두 손가락 undo/pan을 넣을 때는 touch 의도 판정과
유예 시간을 다시 설계해야 한다.

## 4. 도구줄·팔레트 (Fitts + 상태 가시성)

- Fitts의 법칙은 자주 쓰는 표적을 크고 가깝게 두라는 방향을 준다. WCAG 2.2의 최소 표적
  기준은 예외를 제외하고 24×24 CSS px이며, 터치 중심 UI는 더 큰 표적이 유리하다.
  ([Fitts’ law overview](https://www.figma.com/resource-library/fitts-law/),
  [WCAG 2.2 Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html))
- 게슈탈트의 근접·공통영역 원칙은 관련 제어를 가까이 두고 경계로 묶으면 한 단위로
  지각된다는 방향을 준다. Apple HIG도 관련 항목을 논리 구역으로 묶고 도구줄의 핵심 행동을
  시각적으로 구분된 구역에 두도록 안내한다.
  ([Apple HIG — Layout](https://developer.apple.com/design/human-interface-guidelines/layout),
  [Apple HIG — Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars))
- Procreate는 active color, brush size, brush cursor를 지속 노출하고 콘텐츠 집중을 위해
  인터페이스를 최소화한다. Goodnotes도 펜 종류·색·굵기를 도구줄에서 조정한다. 아래 “색이
  도구에 스민다”는 이 상태 가시성 원칙에서 파생한 **저장소 고유 결정**이다.
  ([Procreate interface](https://help.procreate.com/procreate/handbook/5.1/interface-gestures/interface),
  [Goodnotes pen tool](https://support.goodnotes.com/hc/en-us/articles/7353756785679-Using-the-Pen-tool))
- 색 위 아이콘은 sRGB 채널을 선형화한 상대 휘도로 검정/흰색 대비를 각각 계산해야 한다.
  gamma-encoded 8-bit 채널의 단순 가중합은 WCAG 계산이 아니다.
  ([WCAG 2.2 relative luminance](https://www.w3.org/TR/WCAG22/#dfn-relative-luminance))

**→ 적용**:

- 펜/형광펜/도형 활성 칩과 굵기 점에 현재 잉크 색을 반영한다.
- 아이콘은 WCAG 대비가 더 높은 검정/흰색을 선택한다. 흰색·연한 사용자색도 활성 상태가
  사라지지 않도록 중립 outline을 함께 둔다.
- 지우개 실크기 원 커서·도구별 커서를 유지한다.
- 전체 지우기는 그룹 끝에 분리하고 2단계 확인을 유지한다.
- 관련 제어는 `.bp-tool-group` 안에서 근접 배치하고 구분선·그룹 라벨로 공통영역을 만든다.
- 작업대는 앱의 따뜻한 라이트 톤으로 통일하고, 플로팅 카드의 radius·shadow 어휘만 유지한다.
- 모바일에는 일정 그림판 진입점 자체가 없으므로 반응형 판서 UI는 이 작업 범위가 아니다.

## 5. 날짜 피커·레이어 패널

- 선택 상태의 색+체크는 색 하나에만 의미를 맡기지 않는 이중 부호화다.
  ([WCAG Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html))
- 오늘은 숫자 ring으로 시각 앵커를 주고, 접근성 트리에는 `aria-current="date"`와 “오늘”을
  제공한다. KST 날짜를 쓰며 패널을 자정 넘겨 열어 두는 경우도 다음 KST 자정에 갱신한다.
- 활성 레이어는 좌측 accent bar + 이름 강조로 표시한다. 조작 버튼은 28px로 확대한다.

**→ 적용**: 선택 체크, 고대비 오늘 ring, 접근성 현재 날짜, 활성 레이어 accent/name,
28px target size를 적용한다. 이름·힌트·그룹 라벨은 작은 글자 기준 4.5:1 이상을
목표로 한다.

## 6. 작업 문맥 자동 전환

- Goodnotes는 펜 도구가 선택됐을 때 색·굵기를 같은 문맥 제어로 노출한다. Procreate는 현재
  색을 계속 표시하고, 캔버스 변경은 현재 선택 레이어에 적용된다고 명시한다.
  ([Goodnotes pen tool](https://support.goodnotes.com/hc/en-us/articles/7353756785679-Using-the-Pen-tool),
  [Procreate color interface](https://help.procreate.com/procreate/handbook/colors/colors-interface),
  [Procreate layers interface](https://help.procreate.com/procreate/handbook/5.0/layers/layers-interface))
- 이 자료가 “색을 누르면 반드시 펜으로 바꿔야 한다”거나 “레이어를 자동 선택해야 한다”는
  규칙을 입증하지는 않는다. 아래 전환은 도구와 레이어가 서로 맞지 않아 입력이 막히는
  dead state를 줄이기 위한 **저장소 고유 결정**이다.

**→ 적용**:

- 일정을 직접 보내면 숨은 고정 `일정` 레이어를 표시해 결과가 즉시 보이게 한다. 패널 세션의
  첫 보내기에서만 이 레이어를 활성화하고 `선택` 도구로 바꾼다. 모든 카드를 뺐다가 다시 보내도
  이를 반복하지 않으며, 두 번째 이후 보내기와 undo/redo는 사용자가 작업 중인 도구·레이어 문맥을
  뺏지 않는다.
- 색을 확정하면 `선택`·`지우개`에서는 `펜`으로 전환한다. 형광펜·도형은 색을 직접 쓰는
  도구이므로 유지한다.
- 굵기를 고르면 `선택`에서는 `펜`으로 전환하고, 형광펜·지우개·도형은 굵기를 직접 쓰므로
  유지한다. 일정 레이어에서 색·굵기·그리기 도구를 고르는 모든 경로가 같은 레이어 복귀 규칙을 쓴다.
- 펜·형광펜·지우개·도형을 고를 때 현재 레이어가 `일정`이거나 쓸 수 없는 상태면 최근의
  표시·잠금 해제 그림 레이어, 그다음 목록의 첫 사용 가능 레이어로 복귀한다. 숨김 해제,
  잠금 해제, 레이어 자동 생성은 사용자의 명시적 레이어 결정을 바꾸므로 하지 않는다.
- 커스텀 색 피커는 여는 것만으로 도구를 바꾸지 않는다. 미리보기 중에는 색·도구·레이어를
  함께 전환하되 취소/Esc/바깥 클릭이면 세 상태를 모두 열기 전으로 되돌린다.
- `선택`·`지우개` 상태에서 빈 레이어를 추가하면 쓸모없는 빈 선택/지우개 상태 대신 `펜`으로
  시작한다. 이미 보낸 날짜는 미니 달력에서 표시하고, 중복 보내기는 undo 이력을 만들지 않는다.
- 활성 그림 레이어가 삭제되거나 레이어 undo/redo로 사라지면 최근 사용 가능한 그림 레이어를
  우선 선택한다. `일정` 레이어가 활성인 경우에는 레이어 이력 조작이 그 문맥을 뺏지 않는다.

**→ 한계/검증**: 그리기 가능한 레이어가 하나도 없으면 자동 생성하거나 잠금을 풀지 않고 기존
안내를 유지한다. 도구 상태 전이는 순수 함수 단위 테스트와 호출부 계약 테스트로 고정한다.

## 7. 미적용(future work)

- Ink API delegated trail — experimental/non-Baseline, 플랫폼 이득과 레이어 합성 검증 필요.
- 실제 input-to-photon 지연 계측 — iPad Safari·Wacom Chrome/Edge 고속 촬영.
- 두 손가락 탭 undo·pan/zoom — pen-priority와 충돌하지 않는 gesture arbitration 선행.
- 사용자 필압 곡선 UI — 실기 QA에서 기본 곡선 불만이 확인될 때.
- 긴 형광펜 획의 O(n²) 라이브 재렌더 제거 — dirty region 또는 불투명 mask 후 단일 합성 검토.
