# 최초공개 — 기다림을 하나의 장면으로

2026-10-14 KST · [PLAN-031](../../agent/plans/PLAN-20261014-031-premiere-kairos.md)

## 디자인 판단

검이불루·화이불치: 단순한 화면도 허전하지 않고, 특별한 순간도 장식에 묻히지 않는다. 카이로스는 이번 설계의 비유다. 실제 시계/공개 권한을 바꾸거나 심리적 시간 왜곡이 입증됐다고 주장하지 않는다. 기존 달력 전체의 정보 밀도가 낮아지고, 익숙한 얼굴과 내가 한 작은 행동이 남으며, 마지막 숫자와 공개된 이야기로 시선이 모인다. 화면과 논문을 끝없이 수집하기보다 아래 1차 자료의 근거·적용·한계를 구분했다.

## 근거와 적용

| 1차 자료 | 확인한 내용·범위 | 이번 적용과 한계 |
|---|---|---|
| Harrison, Yeo, Hudson, CHI 2010, [Faster Progress Bars](https://www.chrisharrison.net/projects/progressbars2/ProgressBarsHarrison.pdf) | 4쪽 전문. 짧은 진행 표시의 시각적 운동이 체감 길이에 영향을 줌. 실험별 소규모 참가자, 주로 5/15초 작업 | 초읽기와 주변 리듬을 분리. 보고된 효과 크기를 68초 팬 이벤트에 외삽하지 않음. 점멸/역방향 가짜 진행률은 채택하지 않음 |
| Tan & Nov, CHI 2026 author manuscript, [Counting the Wait](https://arxiv.org/html/2602.04138v1) | 전문 HTML. 425명, 10/30/60초 작업 대기. 남은 시간 표시의 좌절감과 시간 미표시의 모호함을 함께 다룸 | 정확한 타이머 하나 유지. 잠깐 고요해도 숫자는 계속 갱신. 과제 대기 실험이 팬의 자발적 기대와 같지는 않음 |
| Lehne & Koelsch, 2015, [Tension and Suspense](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2015.00079/full) | 전문 심리학 이론/리뷰. 기대·예측·정서적 관련성과 해소의 관계 | 익숙한 토리님 + 기대의 작은 응답 + 확실한 공개. 해석적 설계 근거이며 UI 효과의 인과 실험은 아님. 시스템 오류나 불확실한 공개 여부로 긴장시키지 않음 |
| Ma, Cameron, Wiener, 2024, [Memorability shapes perceived time](https://www.nature.com/articles/s41562-024-01863-2) | 공개 초록/그림 설명만 열람, 구독 본문 미열람. 장면 크기·복잡도·기억성과 시간 지각의 관계 | 기억에 남는 인물 하나, 충분한 여백, 공개 후 읽기 계층. 작은 자극 실험에서 서비스 몰입도를 단정하지 않음 |
| Apple WWDC18, [Designing Fluid Interfaces](https://developer.apple.com/videos/play/wwdc2018/803/) | 공식 세션/전사. 유동성, 연속성, 반응 | 기존 FLIP/스프링과 작은 카드 운반 유지. 공개 글자를 비균일하게 늘리지 않음. 사용자 입력에 즉시 시각 반응 |
| Apple WWDC24, [Design interactive experiences for visionOS](https://developer.apple.com/videos/play/wwdc2024/10096/) | 공식 Encounter Dinosaurs 설계 사례/전사. 포털 경계와 관객 중심 서사 | 익숙한 달력→경계가 있는 한 장면→읽는 표면. VR 공간 설계를 웹에 그대로 복제하지 않고 시선의 순서만 적용 |
| Apple, [Motion HIG](https://developer.apple.com/design/human-interface-guidelines/motion) | 공식 지침. 문맥·주의·편안함과 개인 설정 | 큰 이동/장식 동시 경쟁 줄임. 줄인 동작과 gfx를 실제로 따름 |
| Nintendo, [Alarmo 개발자 인터뷰 4장](https://www.nintendo.com/en-gb/News/2024/October/Ask-the-Developer-Vol-14-Nintendo-Sound-Clock-Alarmo-Chapter-4-2667010.html) | 공식 인터뷰. 입력에 반응한다는 인지와 친숙한 캐릭터의 역할 | 클릭 한 번에 별의 이동과 인물의 짧은 반응. 센서·소리·Nintendo 이미지/코드는 가져오지 않음 |
| W3C, [Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), [Three Flashes](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) | 공식 접근성 이해 문서 | 기존 동작 줄이기에서 자동 무대 없음. 반복 점멸 없음, 공개 확인 후 기존 예산 안 단발 저휘도 효과. 정식 광도 분석 완료라는 뜻은 아님 |

## 채택한 장면

2026-10-14 PLAN-034가 아래의 인물 한 명/생성 없음/10→2초 주변 퇴장 결정을 대체한다. [현재 계획](../../agent/plans/PLAN-20261014-034-premiere-playful-company.md): 표정·응원단 1회 제작, 직접 합성한 선택형 BGM, T−18부터 착석·퇴장하여 T−10에는 숫자에만 집중. 기존 원본 초상은 기본·읽기 표면에 유지한다. [제작 기록](../../../art-src/최초공개/응원단/제작기록.md)에 native·최종 prompt·파생 SHA를 보존한다.

추가로 실제 열람한 [YouTube Premiere 공식 설명](https://support.google.com/youtube/answer/9080341?hl=en)과 [운영 팁](https://support.google.com/youtube/answer/12356784?hl=en)에서 공동 대기/별도 카운트다운 테마/대기 중 참여를 참고했다. 채팅을 만들거나 YouTube 녹음·멜로디를 복사하지 않는다. [Apple 오디오·햅틱 설계](https://developer.apple.com/videos/play/wwdc2019/810/)의 인과가 명확한 피드백과 고조 후 끊김을, [Web Audio 모범 사례](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)의 제스처 시작·제어·단일 context를 적용한다. 논문의 기대/긴장 모델은 장면 설계 가설이며, 이 제품의 재미/체감 대기시간이 개선됐다는 실험 결과는 아니다.

- 달력의 개별 퇴장 순서와 T−75 완료는 유지. 실제 시계·공개 시각 변경·다중 일정 대응도 공유한다.
- T−68 진입: 날짜/최초공개 표식과 얕은 카드 이동. 한 프레임 안에서 카운트다운, 원본 인물, 기대 버튼으로 시선이 좁혀진다.
- T−60→10: 두 개의 넓은 얇은 면이 조금씩 모인다. 숫자는 기존 고조 곡선에 따라 작게 움직인다. 기대 버튼을 누르면 별 하나가 중심으로 이동하고 토리님이 짧게 반응한다. 실제 다른 시청자가 눌렀다는 암시나 집계는 없다.
- T−10→2: 주변 면의 운동 0, 초읽기 외 요소 후퇴, 숫자 확대. 태풍의 눈에 별/파티클/호흡 루프를 두지 않는다. 종료 버튼은 남는다.
- 공개: DB가 확인한 새 공개 내용에만 효과. 0초 데이터 지연에는 ‘공개 확인 중’과 기존 복귀 상한. 밝은 읽기 표면은 현재 테마/눈 편한 팔레트 토큰을 사용한다.
- 여운: 큰 제목과 작은 부제/들여쓰기, 날짜·시간·태그. 작은 정보에 거대한 빈 상자를 유지하지 않도록 읽기 표면의 최소 높이를 줄인다. ‘계속 읽기’는 자동 무대를 끝내고 기존 공개 상세로 이어진다. 공개되지 않은 항목에는 버튼이 없다.

## 자산과 비용

사용자 지정 레퍼런스의 REF-004 `73931791224669042.png`를 실제 열람했다. 원본 투명 배경/윙크/포즈/의상 그대로, 비율 보존 640px WebP 변환만 수행. 원본 수정·캐릭터 생성·얼굴 합성 없음. 원본 SHA-256 `b799c830d2e4eec4ab464c7f07de296560d184b4a487016ff330b750440615ee`. 배포 자산 `public/premiere/tori-invitation.webp`, 54,528 bytes, RGBA. 전체 로컬 Drive 경로/프로젝트 개인 메모를 공개 자산에 넣지 않음.

빅타민 REF-008/016/017도 열람했다. 방 배경·일부 잘림·낮은 해상도가 있어 그대로 크게 배치하거나 임의 벡터로 대체하지 않았다. 이번 장면은 선명한 토리님 한 명을 선택했다. 새 빅타민 전문 자산 제작은 별도 이미지 작업이며 이 UI 검증을 지연시키는 자동 생성 루프로 확장하지 않는다.

이미지는 무대가 열릴 때 받는 정적 파일 하나. 타이머/폴링/DB/통계/외부 리소스 추가 0. 면 2개, 인물 1개, 입력 때만 별 1개+작은 잔향 4개. 새 canvas/상시 rAF/영상/의존성 없음. gfx soft/off는 면/별/섬광 숨김, 인물의 클릭 반응 애니메이션도 꺼짐. 모바일 앰비언트는 기존대로 미마운트. 상세 연결은 반환 뒤 단일 rAF로 기존 DOM 위치만 측정한다.

## 품질 판단과 남는 한계

눈으로 아름답다는 판단과 몰입이 입증됐다는 판단을 구분한다. 빌드/브라우저 검증은 시계 정확성·오류·레이아웃·입력·공개 경계를 확인한다. 장기 팬의 흥미, ‘시간이 특별하게 느껴짐’, 반복 관람의 피로는 사용자 관찰 전에는 미검증이다. 추가 추적/개인 식별 없이 짧은 관람 피드백으로 평가할 수 있다. 읽는 도중 상세를 유지할 수 있는지, 마지막 10초가 조용하지만 멈춘 것 같지 않은지가 핵심 관찰 항목이다.
