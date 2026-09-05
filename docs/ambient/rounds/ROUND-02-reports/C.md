# ROUND-02 · Agent C — Season · Weather · Time-of-Day · Motion Director 보고(원문, 2026-09-05)

읽은 것: VISUAL_DIRECTION §5 · IMMERSION_BREAK_RULES · SEASON_TIME_WEATHER_GRAMMAR · MOUNTAIN §4 · BIOME_GRAMMAR 시간대·날씨·애니 행 · SYSTEM_MAP §2·§8 · ROUND-01 C.md · QA_PROGRESS §2 · r02/before 16 시나리오. 코드는 **`git show 0d3fdfb:…`로 고정**해 읽었다(작업 트리에는 이미 `world/light.ts`·`particles.ts`가 생겼다 — 수치·행 번호는 before 빌드 기준).

측정 방법(라운드 1과 동일): 지면 = x0–1400 · y560–820(민물은 수면 y300–600, 깊은 바다는 y100–800) 평균 L* · 하늘띠 = y0–60 · 채도 = 평균 HSL S와 Lab C · 산 층 = x600–900의 다섯 rect(하늘 y20–60 · ① 150–190 · ② 250–300 · ③ 420–470 · ④ 700–780) 평균/p5/p95.

---

```
[Issue] 여섯 시간대가 여전히 엔진 단색 틴트 한 채널이다 — 아침=점심 해시 동일 9/16, 인접 띠 5쌍 중 bandDelta ≥ 2를 만족하는 쌍은 저녁↔밤 하나(1/5), 새벽·노을 지면이 점심보다 밝은 역전이 3바이옴(가을 초원·가을 산·깊은 바다)
[Biome / Season / TimeOfDay / Weather / Seed / Camera] meadow·mountain·pond·deep·tidal·rocky / 사철 / 6띠 / clear·fog·cloud·snow / 42 / showcase
[Category] T-1 (부차 T-2 후보 — 틴트 α 상한 초과)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] before 실측(점심 대비 지면 ΔL · 목표 −6/−2/0/−3/−9/−16):
  · s16 초원·여름 −0.6 / 0 / 0 / −0.6 / −2.0 / −7.1 · 하늘 L* 81.6/84.2/84.2/81.5/78.7/71.4 · 밤 하늘 rgb(157,181,158)=초록회색 · 크로마 비 밤/점심 .70(목표 .62), 새벽 .90(목표 .78)
  · s03 초원·가을 +0.4/0/0/+0.6/−0.4/−4.6 (새벽·노을 **역전**) · s10 산·가을 +0.3/0/0/+0.6/−0.4/−4.5 (역전) · s14 깊은 바다 +0.3/0/0/+0.5/−0.5/−4.7 (역전)
  · s11 −0.4/0/0/−0.4/−1.8/−6.7 · s07 −1.2/−0.5/0/−1.0/−2.6/−7.7 · s13 −1.3/−0.3/0/−1.0/−2.9/−8.1 · s09 눈밭 −1.4/0/0/−1.5/−3.5/−9.5 · s12 수면 −2.3/0/0/−2.5/−5.0/−12.0
  하늘띠 인접 ΔE: 새벽↔아침 3.0~3.8 · 아침↔점심 0 · 점심↔노을 3.1~4.3 · 노을↔저녁 3.6~4.0 · 저녁↔밤 7.9~8.7. 그림자 채널: `land.ts` L76 `dx = hour<12 ? −8 : 8`(방향 1채널). 수면: s12 새벽+안개 glints 14, s14 밤 빛줄기 대비 2.5L. 틴트 α 저녁 .14·밤 .24로 상한(.08/.12) 초과인데 ΔL은 목표의 절반 — 밝은 색 틴트로는 어두워질 수 없다는 구조적 증거. 전이: `refreshWorld()` 5초마다 → 띠가 바뀌면 틴트가 한 프레임에 툭. 밤 정보 하한은 지켜짐(s10 ③ p95−p5 밤 17.2L).
[Suggested Fix] `world/light.ts` `LightProfile{sky·groundDL·sat·shadow{len,dir,alpha}·hazeK·glintK·tintA}`; `drawOnce`가 장면 뒤에 (a) 지면 multiply (b) 하늘 오버레이 (c) 채도 (d) 틴트 ≤ 상한; `drawDepthHaze` α × hazeK; `drawTree`·소품 그림자가 shadow를 읽음; `water.ts drawGlints` α × glintK(새벽·저녁 0, 밤 달빛 띠 1), `sea.ts` 빛줄기 α × (밤 0·새벽/저녁 .4); 띠 전환 목표/현재 lerp(≥3s). 산은 MOUNTAIN §4 — 틴트는 ⓪·①에 강하게.
[Acceptance Criteria] ① `band-morning ≠ band-noon` 해시 16/16 ② s16·s03·s10·s12 인접 5쌍 모두 bandDelta ≥ 2(지면 ΔL ≥ 3 · 하늘 ΔE ≥ 6 · 그림자 길이비 ≥ 1.3 · 글린트 수 변화) ③ 지면 ΔL 새벽 ∈[−9,−4] · 아침 ∈[−4,−1] · 노을 ∈[−5,−1.5] · 저녁 ∈[−12,−6] · 밤 ∈[−19,−12](눈밭 ∈[−13,−7]) — 역전 0/16 ④ 밤 하늘 b* ≤ −4·a* ≤ 0, 노을 하늘 S ≤ .30·(R−B) ≤ 30 ⑤ 틴트 α 새벽/노을 ≤ .06 · 저녁 ≤ .08 · 밤 ≤ .12 ⑥ 밤 정보 하한: s10 ③ p95−p5 ≥ 12L, 산 층 순서 6띠 유지 + 밤 단차 하늘↔① ≥ 3 · ①↔② ≥ 5 · ②↔③ ≥ 6(before 밤 s10 4.7/5.1/10.7 · s11 4.9/7.0/5.2 · s09 2.6/5.3/5.6) ⑦ s12 새벽·저녁 glints 0, 밤 달빛 띠 1 · s14 밤 빛줄기 대비 ≤ 0.5L ⑧ `forceWorld({band})` 직후 250ms×12 연속 캡처 지면 L* 프레임당 |ΔL| ≤ 2.5, 3s 이상 단조.
[Confidence] 높음
```

```
[Issue] 허용 날씨 프레임 65장 중 62장이 맑음과 해시 동일 — 겨울 산 "눈"에 눈송이 0, 노을 숲·언덕 "바람"에 움직임 0, 암석해안 바람에 물보라 0·파도 진폭 상수, 깊은 바다 비에 고리 0
[Biome / Season / TimeOfDay / Weather / Seed / Camera] 16 시나리오 전부 / 사철 / 전 띠 / cloud·rain·snow·fog·wind / 42 / showcase
[Category] W-1 (부차 D-3·M-3)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] GRAMMAR §3.2 "3열 미만이면 오버레이" — 부재. 해시: s01·s02·s05·s06·s07·s08·s10·s11·s13·s14·s15·s16 weather 5/5 동일, s09 6/6 동일(snow 포함), s12 rain만 다름, s03·s04 fog만 다름. weatherDelta 0/7이 13/16. 순서: ① s09 눈(입자 0, temporal 0.00%) ② s02·s15·s13 바람(정지, spray 0, `WV.amp` 상수) ③ s06·s10·s12 안개 = 맑음 ④ s08 흐림 = 맑음 ⑤ s16·s14 비 = 맑음. W-2 위반 0.
[Suggested Fix] `world/particles.ts` 엔진 층(저해상: 빗줄기 사선 원근·눈송이 원근+바람 사선·바람 부스러기·안개 뭉치, 강도 = weather × 시간대 배율; 초원 겨울 자체 눈송이 제외) + `light.ts` 날씨 합성(흐림 sky L−8·shadow α ×.4·glint 0 / 비 sky L−14·ground L−8·glint 0·haze ×1.3 / 눈 sky L−6·haze ×1.2 / 안개 층별 / 바람 haze ×.7·wind 1). 장면 최소 채널: `coast.ts`·`sea.ts` 파도 amp × (1+.5·wind), 물보라 × wind, 비면 수면 고리.
[Acceptance Criteria] ① 16 시나리오 × 비-맑음 날씨 전부 해시 ≠ 맑음(before 3/65) ② weatherDelta ≥ 3(하늘 ΔE ≥ 4 · 지면 ΔL ≥ 3 또는 S ≥ .03 · 수면 glints 0 in cloud/rain/fog/dawn, 비: rings > 0 · 원경 ① ΔL ≥ 4 · 식생 수관 행 diff > 0 · 생물 카운터 · 입자 0→250ms ≥ 0.3%이고 변화 블록 ≥ 40% 분산) ③ s09 눈 입자 ≥ 40·sky ΔL ≤ −4·temporal ≥ 0.3% / s13 바람 spray > 0, 파도 amp ≥ 1.5× / s08 흐림 sky ΔL −8±3, glints 0 / s14·s16 비 수면 고리 또는 젖은 지면 ΔL ≤ −5 ④ W-2 유지 ⑤ 맑음 프레임 회귀: 조명이 같은 라운드면 "맑음 지면 ΔL ≤ 1 vs before".
[Confidence] 높음
```

```
[Issue] "안개"가 깊이 감쇠가 아니다 — 비-초원 안개 3장면(계곡·산·민물)은 맑음과 픽셀 동일, 가을 초원 서리안개는 화면 위에서 내려오는 세로 베일이라 지평선 실루엣 대비를 5.6L로 눌러 뭉갠다; 엔진 대기 안개는 시간대 배율 없이 새벽=점심
[Biome / Season / TimeOfDay / Weather / Seed / Camera] valley·mountain·pond·meadow / autumn·spring / evening·dusk·dawn·morning / fog / 42 / showcase
[Category] D-3
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] s10 산·안개 = 맑음 — 층 L 84.5/78.4/71.9/58.3/47.9 그대로; s06 원경 나무 띠 p5 39.6/p95 78.0 → 실루엣 대비 38L(안개가 아무것도 부드럽게 하지 않음); s12 = 맑음 + 글린트 14. s03/s04 초원 `autumn.ts` L991 `mist` = 화면 공간 세로 그라데이션 → 지평선 실루엣 띠 p95−p5 9.0 → 5.6L(규칙 10L 미달). `drawDepthHaze` 단일 선형 + 계절 캐시 키만. 절단선은 없다 — 유지할 것.
[Suggested Fix] `drawDepthHaze(g, season, w, h, light)`: 세 층(후경 .55·중경 .3·전경 .1) + 지면 안개 띠 + 시간대 배율(`light.hazeK`); 캐시 키에 band·weather. `autumn.ts` 서리안개는 엔진 층으로 흡수하거나 `mistH`를 지평선 아래로. 산은 ①·② 사이 안개.
[Acceptance Criteria] ① s06·s10·s12 fog ≠ clear 해시 ② 깊이 단조: s10 안개 rect ΔL(맑음 대비) ① ≥ +6 · ② ≥ +3 · ③ ≤ +1.5 · ④ ≤ +0.5 — ① > ② > ③ ≥ ④ ③ 실루엣 유지: s10 ② p95−p5 ≥ 10L, s03 fog 지평선 띠 p95−p5 ≥ 10L(before 5.6), s06 원경 나무 띠 ∈ [10, 25] ④ 절단선 0 ⑤ 새벽 fog ① ΔL ≥ 1.4 × 점심 fog ⑥ 지면 안개 띠: s16·s03 fog y700–820 ΔL ∈ [+2, +5], 맑음 0.
[Confidence] 높음
```

```
[Issue] 육지 4바이옴(숲·언덕·산)은 바람 시나리오에서도 4초간 픽셀 0개가 바뀐다 — 나무·억새·구름 그림자에 시간 함수가 없다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] forest·hill·mountain / 사철 / 아침·노을·점심·새벽 / wind·snow·fog·cloud·clear / 42 / showcase
[Category] M-3
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] temporal 0.00% 6/16 — s01 s02(바람) s09 s10 s11 s15(바람); `land.ts` L1334 `drawTree(g, x, y, R, f.time.hour, pine)` — `t` 미전달. 대비: s16 0→250ms 1.40%, 2→4s 10.48%(정상).
[Suggested Fix] `drawTree(g, x, y, R, t, pine)`: 수관 x ± amp·sin(t·ω+φ), amp = wind × (큰 나무 2px · 작은/관목 4px), ω·φ 개체 해시, 지연 .5s/.2s; 맑음(wind < .15) 정지 유지. 언덕 억새는 바탕에서 떼어 스트립 층. 산은 구름 그림자 1~2개(60~90s 횡단). 눈송이·비는 입자층.
[Acceptance Criteria] ① s02·s15 temporal 0→250ms ≥ 0.3%, 2→4s ≥ 1.0%, 변화의 ≥ 70%가 수관/억새 행, 최대 블록 비 ≤ 6× ② phaseSync < .9 — debug `sway: {phases, periods}`, 위상 ≥ 5·주기 ≥ 3; 큰 나무 amp < 작은 나무, 지연 차 ≥ .3s ③ s01·s09·s10·s11 static 해시 = before 유지(정지는 정지) ④ static = stillFrame 유지 ⑤ s13 바람 파도·물보라는 #2에서.
[Confidence] 높음
```

```
[Issue] (라운드 1 #5 회귀 — 그대로 열림) 해안 3장면의 뭍 판(바위·웅덩이·절리)이 물가 숨쉬기와 함께 ±3px 오르내리고, 젖은 띠 폭도 같은 위상, 띠 전환 시 조석 17px이 보간 없이 튄다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] rocky·tidal·sandy / autumn·summer / dusk·noon·evening / wind·clear·cloud / 42 / showcase
[Category] M-2 (부차 S-4)
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] `coast.ts` L938 `sy = shoreY() − tide(f)·h·.02 − sin(t·.5)·3` → L985 `drawImage(land, 0, sy − 60, …)`(뭍 전체 이동) · L987 `wet2` 같은 위상. s13 temporal-diff-0250: 물가에서 300~450px 떨어진 바위 무리 7곳 윤곽 전부 변화, 0→250ms 1.12%·블록 비 8.8×. 두 줄 수정.
[Suggested Fix] `land`는 고정 `shoreY() − 60`에 그리고 `sy`는 물가 클립·젖은 띠·거품에만; `tide`는 목표/현재 lerp(≥3s).
[Acceptance Criteria] s13·s07 temporal-diff에서 젖은 띠 아래 바위·뻘 윤곽 변화 0; `forceWorld({band})` 직후 물가 선 y 프레임당 ≤ 1px.
[Confidence] 높음
```

```
[Issue] 여름 초원 밤 프레임에 나비 2·무당벌레 2·메뚜기 3·벌이 점심과 같은 자리 — 생물 풀이 띠를 모른다
[Biome / Season / TimeOfDay / Weather / Seed / Camera] meadow / summer·spring / night·evening·dawn / clear / 42 / showcase
[Category] T-1(생물 풀 채널)
[Severity: P0 / P1 / P2 / P3] P2
[Suggested Fix] `spring.ts` 스폰 상한을 `f.time.band`로: 새벽 나비 0~1·벌 0 / 저녁 나비→0(가장자리로 퇴장) / 밤 0 + 8월 반딧불. `rarity.ts SpawnDirector` 밴드 게이트. 이번 라운드 필수 아님 — 조명 뒤에.
[Acceptance Criteria] s16 band-night `flies`·`bugs`·`bee` = 0(또는 화면 밖), evening 나비 ≤ 1, dawn 벌 0; 퇴장이 페이드가 아님.
[Confidence] 높음. 등급 P2.
```

---

### 회귀 확인(라운드 1 수정 항목 — 위반 없음)

| 항목 | before 관찰 | 판정 |
|---|---|---|
| 가을 다람쥐 A-1/A-2 (s03·s04 long-sheet) | 23s 아래 가장자리 진입 → sniff → grab → 26s 화면 밖(아래) · 지평선 근처 경로 0 · 프로브 6시드: 출발 v 최소 .395, 경로 최소 .355, 회오리 최소 .512 | **통과** |
| 산 다섯 층 시간대 유지 | s10 점심 84.5/78.4/71.9/58.3/47.9 · 밤 71.6/66.9/61.8/51.1/43.0 — 순서 유지, 밤 단차 4.7/5.1/10.7/8.1; s11 밤 4.9/7.0/5.2/9.1; s09 밤 2.6/5.3/5.6/6.4 | **통과(경계)** — ①↔② 밤 5.1~5.3L은 규칙 6L 바로 아래. multiply가 단차를 더 좁히면 D-2 재발 |
| 루프 이음매 후보 블록 비 | s12 오리, s05/s06 하류 거품, s14 해파리, s07/s08 물가 선 | 전부 정상 집중 |
| W-2 forbiddenCombo | 0건 | — |

### 요약
- `P0 0 · P1 4 · P2 2 · P3 0`
- 가장 넓게 걸린 문제: **장면과 엔진이 `f.time`·`f.weather`를 표현 채널로 쓰지 않는다** — #1~#4는 같은 입구라 한 묶음이 맞다.
- 이번 라운드에 안 고쳐도 되는 것: #6 밤 생물 풀(조명 뒤), #5 해안 뭍 판은 넘치면 다음으로(두 줄이라 남는 예산이 있으면 넣는 편이 싸다).
