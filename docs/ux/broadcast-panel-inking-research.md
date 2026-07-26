# 방송 판서(일정 그림판) 잉크·도구 UX 연구 아카이브

> 2026-07-26 작성. 판서 패널 개선의 **근거 문서** — 코드를 고치기 전에 여기부터 읽는다.
> 각 절 끝의 **→ 적용** 이 이 저장소에서의 구체 결정이다.

## 1. 잉크 지연(latency) 지각

- Ng·Lepinski·Wigdor 등(Microsoft/Toronto)의 고성능 스타일러스 실험: 드래그 작업에서는
  **1–2ms 차이도 구분**, 낙서(scribbling)에서는 7 vs 40ms를 구분한다.
  ([In the blink of an eye, ISS 2014](https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-SIGCHI-Latency.pdf))
- 단, **잉킹 중 지각 한계는 ~50ms로 느슨**하다 — 시선의 기준점(펜촉·손)이 있을 때만 민감.
  ([How Low Should We Go?, GI 2014](https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-GI-Latency.pdf))
- 웹에서의 대응: ① `getCoalescedEvents()`로 프레임 사이 120Hz+ 샘플 전부 소화(정확도),
  ② `getPredictedEvents()`로 예측 선행 렌더(체감 지연 ↓, 95% 케이스에서 양호),
  ③ `desynchronized` 캔버스, ④ [Ink API](https://developer.mozilla.org/en-US/docs/Web/API/Ink_API)
  (OS 컴포지터 위임 — Chromium 계열).
  ([MDN getPredictedEvents](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/getPredictedEvents),
  [Web Ink Enhancement explainer](https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/WebInkEnhancement/explainer.md))

**→ 적용**: coalesced 소화는 완료(`4c7b01c`). rAF 병합 + 증분 렌더 유지(우리 잉크 랙은 1프레임
≈16ms — 잉킹 지각 한계 50ms 안). `getPredictedEvents` 선행 렌더는 '예측 꼬리를 지웠다 다시
그리는' 무효화 렌더가 필요해 증분 렌더 계약과 충돌 — **보류**(future work로 명시).

## 2. 필압 곡선(pressure curve)

- 힘→굵기 변환은 도구마다 다른 "force response curve"를 가진다. 연필은 선형에 가깝고,
  볼펜은 가파르다. 하드웨어 필압 원값은 저압 구간에 몰려 있어 **선형 매핑이면 획이 내내
  가늘다** — 그래서 Fresco·Krita 등 모든 필기/드로잉 앱이 곡선(감마) 조정을 둔다.
  ([Adobe Fresco pressure curve](https://helpx.adobe.com/be_en/fresco/using/pressure-curve.html),
  [Krita/Wacom 캘리브레이션 — David Revoy](https://www.davidrevoy.com/article182/calibrating-wacom-stylus-pressure-on-krita))
- 지터: 필압 샘플은 떨린다 — 저역 필터 없이는 획 가장자리가 우둘투둘.

**→ 적용**: `pressure^0.65` 감마 + 이웃 샘플 50% 블렌드(`4c7b01c`). 마우스/터치는 속도 역산
폴백(빠르면 가늘게) 유지. **iPad(Apple Pencil)·Wacom 모두 W3C Pointer Events에서
`pointerType:"pen"` + `pressure` 0..1로 동일하게 들어온다** — 기기 분기 불필요, 같은 코드로
동작(파리티 확보). tilt/twist는 SOOP 판서 용도엔 과함 — 미사용.

## 3. 파밍(palm rejection)

- 펜과 터치를 함께 지원하는 태블릿의 최대 불만이 의도치 않은 손바닥 입력. Schwarz 등
  (CHI 2014)의 시공간 특징 분류가 대표 연구 — 펜 스트로크당 오입력 0.016까지 감소.
  ([Probabilistic Palm Rejection, CHI 2014](https://dl.acm.org/doi/10.1145/2556288.2557056),
  [저자 페이지](https://www.robertxiao.ca/research/palm-rejection/))
- Hinckley 등 [Sensing Techniques for Tablet+Stylus](https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/paper2557_Sensing20Techniques20for20Stylus20Tablet20Interaction.pdf):
  하드웨어 신호가 없을 때의 실용 휴리스틱 = **펜이 근접/활동 중이면 터치를 무시**.
  iPadOS·Windows Ink도 같은 원칙.

**→ 적용**: 브라우저가 1차 파밍을 해 주지만(OS), 웹 앱 층에서 한 겹 더 —
**펜 입력이 최근(1초 내) 있었으면 터치로 시작하는 획을 무시**한다(lastPenTs 가드).
분류기 수준은 과함; 이 휴리스틱이 연구 결론의 실용 축약.

## 4. 도구줄·팔레트 (Fitts + 게슈탈트)

- Fitts: 자주 쓰는 도구는 **크게, 가깝게**. 관련 기능은 근접 묶음(게슈탈트 proximity),
  실수 유발 쌍(전체 지우기)은 거리·2단계로 분리.
  ([Figma Fitts 가이드](https://www.figma.com/resource-library/fitts-law/),
  [LogRocket Fitts best practices](https://blog.logrocket.com/ux-design/fitts-law-ui-examples-best-practices/))
- Procreate/GoodNotes 벤치마킹: **도구 상태가 항상 보인다**(현재 색·굵기·도구가 크롬에 반영),
  제스처로 보조(두 손가락 undo), UI는 콘텐츠보다 조용하게. GoodNotes의 절제된 도구 수가
  오히려 강점 — 도구를 늘리기보다 상태 가시성을 높인다.
  ([GoodNotes UX 분석](https://medium.com/@grenhamlyn/goodnotes-the-most-overlooked-ux-app-on-ipad-dea2430d7a20))

**→ 적용**:
- **색이 도구에 스민다**: 펜/형광펜 활성 칩과 굵기 점이 현재 펜 색으로 칠해진다 —
  "지금 무슨 색으로 그릴지"를 도구줄 어디서든 확인(상태 가시성, Procreate 문법).
  밝은 색 위 아이콘은 명도 대비로 자동 흑/백 전환(WCAG 대비 원칙).
- 지우개 실크기 원 커서·도구별 커서 유지(`4c7b01c`).
- 전체 지우기: 2단계 확인 + 그룹 끝 분리 배치 유지(실수 비용 분리).
- **배경은 앱 톤 유지**(따뜻한 라이트) — 페이지 간 통일(조화 3요소의 '통일')이 다크 크롬
  실험보다 우선. 아일랜드(떠 있는 카드) 어휘만 남긴다. (2026-07-26 다크 크롬 롤백 결정.)

## 5. 날짜 피커·레이어 패널

- 미니 달력: '오늘' 시각 앵커(현재 위치 인지), 선택 상태는 채움+체크로 이중 부호화
  (색약 대비 — 색 하나에만 의존 금지). 일정 있는 날은 제목 미리보기(이미 있음)가
  왕복 제거에 유효.
- 레이어 패널(그림판/피그마 관례): 활성 레이어는 **좌측 액센트 바 + 이름 강조**로 한눈에,
  썸네일은 체커보드(투명 관례), 조작 버튼은 라벨 툴팁. 이름 대비를 본문 수준으로 올려
  가독성 확보.

**→ 적용**: 오늘 링 표시, 선택 셀 체크 마크, 레이어 활성 액센트 바·이름 대비 강화,
조작 버튼 확대(Fitts).

## 6. 미적용(future work) 목록

- `getPredictedEvents` 예측 선행 렌더(무효화 렌더 설계 필요).
- Ink API(OS 컴포지터) — Chromium 전용, 점진적 향상 후보.
- 두 손가락 탭 undo 제스처(멀티터치 인식 추가 필요).
- 압력 곡선 사용자 설정 UI(Fresco처럼) — 스트리머 1인 앱엔 과함, 요청 시.
