# ROUND-03 · Agent A — Art Mood Director 보고(원문, 2026-09-05)

빌드 `ae062c8` · 캡처 `.scratch-pw/qa/r03/before/` · 시드 42 · 코드는 `git show ae062c8:` 기준. 발견 8건(P0 1 · P1 4 · P2 3).

```
[Issue] 민물의 물가 판정선이 평선(shoreY = h·.21+6)인데 그림은 굽이치는 기슭이라, 오리·포인터 물결·클릭 고리가 위쪽 뭍 위에 나타나고 y≈185에 전폭 직선 단차가 남는다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] pond / 사철 / 전 띠 / 전 날씨 / 42 / default
[Category] A-1·S-2(주) + F-1(부 — 전폭 직선 단차)
[Severity: P0 / P1 / P2 / P3] P0
[Why it breaks immersion] `summer.ts` shoreY(=186.6px 평선) 하나가 오리 상한·포인터 항적 게이트/클립·클릭 고리 게이트·물 바탕 상단을 전부 정한다. 보이는 물가는 `traces-draw.ts landEdge(x)` — y≈170~340. 즉 y 187~340 기슭 띠에서 오리가 헤엄치고 물결이 인다. s12 전 띠·날씨에서 y≈185 전폭 수평 단차(static-gray에서 또렷 — AMB-F1-02의 실체).
[Suggested Fix] `shoreY()`를 `shoreEdgeY(x)`(bakeShore의 landEdge export)로; 오리 클램프·stepTrail 게이트·항적 클립·pointerDown·물고기 상한·bakeWater 상단에 같은 함수. AMB-S4-04도 같은 입구.
[Acceptance Criteria] (a) duck.y − edgeY(duck.x) ≥ 27k 100%(시드 42·7·13, 60s) (b) pointer (300,250)·(1000,262)·(60,300) 강제 2s: 물가 곡선 위쪽 픽셀 변화 0 (c) s12 static-gray y∈[hz,340] 폭 ≥ 90%w 수평 에지 0 (d) after 해시 변화는 이 띠 안에서만
[Confidence] 높음
```

```
[Issue] 근경 갈대 무리가 y=602에서 ㅡ자로 잘린다 — 근경 기슭 캔버스(h·.3)에 굽는데 스프라이트가 캔버스 위 모서리를 넘어 클립된다(대체물 문제가 아니라 굽기 캔버스 크기 문제)
[Biome / Season / TimeOfDay / Weather / Seed / Camera] pond / 사철 / 전 띠 / 전 날씨 / 42 / default
[Category] F-1
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] `summer.ts` NH = h·.3 캔버스를 y 602에 붙이고 갈대를 `top(x)+4+r·NH·.4`, kk 1.1~2.4로 굽는다 → 키 큰 무리는 캔버스 y<0이 사라진다. s12 static (15~190,600)·(450~570,600)·(1160~1360,600) 세 무리 같은 y 직선 절단.
[Suggested Fix] 캔버스 높이를 NH + 가장 큰 갈대 높이로(위 투명 헤드룸), 또는 갈대를 매 프레임 y-sort로 그려 바람 흔들림까지.
[Acceptance Criteria] (a) 갈대 상단 y 히스토그램에 y=602±1 스파이크 0 (b) y=600~604 행 갈대색 수평 연속 ≤ 12px (c) 무리 4~6·키 편차 ≥ 1.25× 유지
[Confidence] 높음
```

```
[Issue] 산 ①·②가 안개·노을·새벽·눈·밤에서 "면"이 아니라 능선 윤곽선만 남은 와이어프레임으로 읽힌다(하늘=①=② 채움), 언덕 세 띠는 평행 계단 — AMB-D1-01·D1-02·D2-02 묶음의 미적 수용 기준
[Biome / Season / TimeOfDay / Weather / Seed / Camera] mountain / autumn·summer·winter / dusk·dawn·morning(+밤) / fog·cloud·snow / 42 / default — hill 포함
[Category] D-2(주) · D-1 · S-3
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] s10 전 칸에서 ①·②는 채움이 하늘과 같고 1px 림선만 남는다. s09 ①은 이중 윤곽선. ③ 10px 세로 빗살(AMB-S3-02). s15 언덕 띠 경계 셋이 같은 곡률·ΔL 3~5. s10 (520~680,120~200) ① 능선 위 어두운 소프트 얼룩(전 띠·날씨 같은 자리) — 출처 미상, 크롭 요청.
[Suggested Fix] 능선선 판(α ∝ 안개·밤)을 얹되 **채움 단차를 먼저 되살린다** — ①·②를 L.sky 계열로 재틴트(원경은 하늘색에 가까워지되 ≥ 4L 어둡게 클램프), ② 발치는 ③ 애추 띠·α 1 침엽수 줄로 가림(D1-02). hill 띠 3겹 파장·진폭·위상 분리, 인접 ΔL ≥ 6.
[Acceptance Criteria] (a) 채움 ΔL 하늘↔① ≥ 4, ①↔② ≥ 6, ②↔③ ≥ 8 (b) **와이어프레임 금지**: 림선 대비 ≤ 2× 인접 채움 단차, 림 폭 ≤ 2px, x 방향 밝기 변주 CV ≥ .25 (c) 안개 ② 대비 ≥ 10L = 채움 6 + 림 4 (d) 노을 R−B ≤ 40·S ≤ .3, 밤 남청회 (e) ③ 빗살 lag10 < .5 (f) s15 인접 띠 ΔL ≥ 6, 경계 교차상관 ≤ .8 (g) 3초 판정
[Confidence] 높음 / 낮음(하늘 얼룩)
```

```
[Issue] 계곡 벽의 능선이 지평선 w·.30 → 바닥 w·.03으로 곧게 수렴하는 직선 두 개 + 흰 1px 하이라이트 선이라, 화면 아래 모서리에서 "비스듬한 직선"이 자갈 둔치 리본을 향해 어색하게 이어진다(무대 세트 판 두 장)
[Biome / Season / TimeOfDay / Weather / Seed / Camera] valley / summer·autumn / 전 띠 / clear·fog / 42 / default
[Category] F-1
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] `land.ts` `ridge(t)`: inset .3 − .27t(선형) + 흔들림 ≤ 70px → 현에서 거의 벗어나지 않는 직선; 그 위 흰 stroke. s05 (400,150)→(230,570)→(0,860) 밝은 선, 오른쪽 (1050,200)→(1250,860) 어두운 쐐기 경계. **리본 끝 단면은 groundY(1.14t)로 화면 밖** — 소유자가 본 "단면"은 이 벽 능선선이다. 대체물 아님.
[Suggested Fix] `ridge(t)` 저주파 굽이 2~3(진폭 w·.05~.08), 발치는 w·.10~.14에서 넓게; 흰 1px 선 삭제 → 3~5px 계단 밝은 띠(±30% 변주, 끊김 허용).
[Acceptance Criteria] (a) 벽 경계선 200px 구간 현 대비 최대 이탈 ≥ 8px (b) 폭 1px 연속 ≥ 120px 흰 선 0 (c) 바닥 도달 x ≥ w·.08, 마지막 120px 접선 각 변화 ≥ 15° (d) 벽 명도 단차 ≥ 8L 유지
[Confidence] 높음
```

```
[Issue] 암석해안: 조류대가 프레임 최암부 검은 띠(rgb 20 22 18/.42) + 흰 1px 상연으로 바다와 "그냥 붙고", 물가 바위는 띠 아래 굽혀 유령(α≈.25)이 되며, 노두 위성 바위가 큰 바위 면 위에 제 윤곽을 통째로 얹어 "겹쳐 잘린 스티커"가 된다 — 대체물이 아니라 배치·그리기 순서 문제
[Biome / Season / TimeOfDay / Weather / Seed / Camera] rocky / autumn / 전 띠(밤 최악) / wind·cloud / 42 / default
[Category] F-1·F-3(주) · S-1(부)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] `coast.ts` 노두(big + 위성 d 20~70, 공용 발치 없음), 물가 바위 4×2를 y 62~104에 두고 **그 뒤** 조류대 띠를 위에 칠함 → 유령 + 흰 호만(AMB-S4-03의 원인). s13 (0~1400,372~418) 검은 띠; band-night에서 이 띠와 해조 얼룩이 화면에서 유일하게 검다; 겹침 (640~800,580~700)·(1150~1260,455~615)·(180~330,610~760).
[Suggested Fix] ① 조류대 띠를 물가 바위 앞에 칠하고 바위는 띠 위에 α 1, 발치만 젖은 색 ② 띠 최암부 rgb(36 40 38/.34), 상연 흰 선은 끊긴 거품만 ③ 노두 위성은 큰 바위 밖/뒤, 군집 공용 발치 그늘, 가로지르면 재추첨 ④ 해조 얼룩 ≤ 24px·L ≥ 20.
[Acceptance Criteria] (a) 최암 1% L* ≥ 22(점심)/≥ 14(밤), 상연 흰 연속선 ≥ 120px 0 (b) 물가 바위 8개 α 1, 발치 젖은 띠 (c) 앞 작은 바위 윤곽이 뒤 큰 바위 면을 가로지르는 경우 0 (d) 흑백에서 s13이 이웃과 3초 구분
[Confidence] 높음
```

```
[Issue] "엔티티 둘레의 이상한 검은 선"은 1:1 fixture 캡처(16 시나리오 × 밤·흐림)에서 재현되지 않는다 — 대체물 윤곽은 밤 multiply 뒤에도 L 17~34(검정 아님). 실화면 전용 원인 둘을 측정으로 갈라야 한다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] 전 바이옴 / — / night·evening / cloud / 42 / **calendar(실화면)** vs default(fixture)
[Category] F-2 / F-3
[Severity: P0 / P1 / P2 / P3] P2(재현 전)
[Why it breaks immersion] 후보 (A) **표시 배율**: 편집실 `.studio-shell zoom .9/.8` 아래 캔버스 비트맵 = offsetWidth × dpr(대개 1) → 브라우저가 0.9·0.8 × 기기 DPR로 재표본 → 1px 하드 윤곽(imageSmoothingEnabled=false)이 1~2 기기픽셀 회흑 테두리로 번진다 — 픽셀아트 비정수 배율의 전형. (B) `saturation` 블렌드가 어두운 윤곽의 색상을 먼저 지워 중성 검정으로 — 단독 원인은 아님.
[Suggested Fix] 실화면(zoom .8, 뷰포트 ≥1700) vs fixture 같은 좌표 크롭 비교. (A)면 `scene-engine.ts resize()`에서 `canvas.width = round(w·dpr·zoomF)`. (B) multiply 뒤 L.sky `screen` α .05 바닥.
[Acceptance Criteria] (a) 실화면 크롭 윤곽 명도 전이 폭 ≤ 1 기기픽셀 + 0.5 (b) 밤·흐림 최암 1% L* ≥ 14, 윤곽 크로마 ≥ 3 (c) s16 점심·맑음 해시 불변
[Confidence] 낮음~중간
```

```
[Issue] 라운드 2 조명 회귀: 여섯 띠는 구분되고 T-2 과장은 없다 — 다만 노을이 "방향 있는 빛"이 아니라 화면 전체 균일 세피아로 읽히고(s10 노을·안개 = 먼지 폭풍), 새벽≈저녁이 밝기만 다른 같은 청회 필터로 읽힌다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] mountain·meadow·pond·valley·rocky / — / dusk·dawn·evening / fog·clear / 42 / default
[Category] T-2(경계) → 정서 부재(T-1)
[Severity: P0 / P1 / P2 / P3] P2
[Suggested Fix] 이번 보류. 방향 채널: 민물·바다·해안 노을 긴 반사 띠, 산 ② 서쪽 림(능선선 판에 얹으면 공짜), 굽는 소품 그림자에 light.shadow. 새벽 지면 안개 띠 ×1.6 더 낮게·넓게.
[Acceptance Criteria] 인접 띠 쌍 둘 이상 채널 유지; 새벽↔저녁 안개 띠 높이 차 ≥ 8%h; 노을 방향 단서 바이옴당 ≥ 1
[Confidence] 중간
```

```
[Issue] 언덕 억새 이삭 대체물이 흰색(α .9)에 같은 "∨∨∨" 3~5획 스탬프라 70여 개가 화면에서 가장 밝고 같은 모양으로 반복된다 — 낮엔 불꽃, 밤엔 반딧불
[Biome / Season / TimeOfDay / Weather / Seed / Camera] hill / autumn / 전 띠(밤 최악) / wind / 42 / default
[Category] F-3(주) · S-3
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] `land.ts` 이삭 획 색 rgb(255 255 255/.9). s15 흰 V 튜프트 ~70개, 지면 대비 ΔL 25~30; band-night에서 지면은 어두워졌는데 이삭은 흰 점.
[Suggested Fix] 지면색 + 14~20L(은빛·베이지, 흰색 금지), α ≤ .55, 획 수·각도·길이 흩기.
[Acceptance Criteria] (a) 이삭 L ≤ 지면 + 20, 밤 ≤ +18 (b) 스탬프 자기상관 > .9 비율 ≤ 30% (c) 포기 200~260 유지
[Confidence] 높음
```

**요약**
- `P0 1 · P1 4 · P2 3 · P3 0`
- 가장 넓게 걸린 문제: **"자연 가장자리가 있어야 할 자리에 그은 직선 기준선"** — 민물 shoreY 평선(#1·#2), 계곡 벽 능선 직선+1px 흰 선(#4), 암석 조류대 띠+1px 상연(#5), 산 능선이 채움 없이 선만(#3). 8건 중 5건이 한 원인 계열.
- 안 고쳐도 되는 것: #7 노을 세피아·새벽≈저녁 뉘앙스. 라운드 2 회귀 — 날씨 입자·안개 층·바람 흔들림 이상 없음, T-2 없음, 갯골 굽이 자연스러움(잔여: 물골 안 1px 젖은선이 흑백에서 "전선"), 숲은 여전히 공원(AMB-R2-01), 가을 초원 지평선 소프트 얼룩(AMB-F2-01) 여전.
