# Agent C — Season · Weather · Time · Motion Director · Round 1 보고(빌드 980f170 · seed 42 · 1400×860)

읽은 문서: VISUAL_DIRECTION §5 · IMMERSION_BREAK_RULES · SEASON_TIME_WEATHER_GRAMMAR 전부 · MOUNTAIN_DEPTH_RULES §4 · BIOME_GRAMMAR 해당 절 · SYSTEM_MAP §2·§8. 코드 확인: `components/shared/ambient/scenes/{land,coast,autumn,summer,sea,water,winter}.ts`, `world/time.ts`. 정량치는 band 프레임을 직접 샘플링(지면 y560–820 · 하늘띠 y0–60 평균 L*).

---

```
[Issue] 가을 다람쥐·회오리·(봄 나비·벌)의 출발 y 하한이 없어 지평선 띠(v<.18)·하늘에서 태어날 수 있다 — 이번 4시드 캡처에서는 미발생, 코드 경로는 그대로.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] meadow / autumn / morning / clear / 42·7·11·23 / showcase
[Category] A-1 (부차 A-2 — 이동 자체는 합격)
[Severity: P0 / P1 / P2 / P3] P0
[Why it breaks immersion] BIOME_GRAMMAR 공통 생물 규칙 "땅 위 종 v∈[.18,1], 위(지평선) 출입은 나는 종만", IMMERSION §4. `scenes/autumn.ts` L490 `y = e===2 ? h+40 : groundY(rand())` → 좌·우 진입(확률 2/3)의 18%가 v<.18, 즉 스폰당 ≈12%가 `bakeHorizon` 언덕·실루엣 나무 줄 위에서 출발하고, `moveScale`(.22배)로 그 구간을 가장 오래 머문다. L785 회오리 `e===2 → gy()-80`은 하늘 출발. 4 시드 long-sheet(15~30s)에서는 모두 안전 구간: seed23 = 18s 좌측 진입 v≈.30(long-19000.png (72,330)), 블록 경로 (0,4)→(2,5)→(3,5)→(7,6)→(7,8)→(7,11)로 도토리 (≈535,475)까지 6초·평균 ≈95px/s = 250×moveScale(.36) ✔, 26~27s 아래로 걸어 퇴장(페이드 없음) ✔; seed42 = 23s 아래 진입 (435,830)→25s grab (335,800)→26s 아래 퇴장 ✔; seed7 = 22s 아래 진입→cache·pat (865~880,743~807)→28s 아래 퇴장 ✔; seed11 = 21s 진입→25s sniff (1094,728)→26s leave→27s 퇴장 ✔. 그림자 발밑(`s.y+10·sds`) ✔, 달릴 때 통통(bounce) ✔. 4회 중 0회 발생은 기대치(≈60%)와 일치 — 안 본 것이 없다는 뜻이 아니다.
[Suggested Fix] `scenes/autumn.ts startSquirrel` L490 `groundY(0.18 + rand()*0.82)`(새벽·밤·안개면 .25), `whirl` 스폰 L785 e===2 분기 제거(좌·우·아래만) 또는 `groundY(0.18+…)`; 같은 패턴 `scenes/spring.ts` 나비 `gy()-30`, 벌 `groundY(rand())`(SYSTEM_MAP §5)도 같은 커밋에서.
[Acceptance Criteria] 12시드 × 60s long 캡처에서 airWalk 0(debug에 squirrel x,y 노출 후 스폰 프레임 전수 `y ≥ groundY(.18)`); 회오리·나비·벌 첫 프레임 y ≥ gy(); 기존 합격 항목 유지(퇴장은 화면 밖 보행, 평균 속도 = 250×moveScale ±15%).
[Confidence] 높음 — 코드 경로 확인. 캡처 재현은 없음(시드 스윕 필요), 그래서 "관찰"이 아니라 "구조" P0.
```

```
[Issue] 허용 날씨 6종 중 비(연못 고리)·눈(초원 눈송이)·바람(초원 돌풍 간격)·안개(가을 서리) 외엔 어느 장면도 날씨를 그리지 않는다 — 검사한 6조합 전부 weatherDelta 0/7, 눈 오는 겨울 산에 눈송이가 없다.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] mountain·forest·rocky·valley·pond·tidal / winter·autumn·spring / morning·dusk·evening·dawn / snow·wind·fog·cloud / 42 / showcase
[Category] W-1 (부차 D-3)
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] GRAMMAR §3.2 "7열 중 3열 미만이면 오버레이(P1)" — 여기는 오버레이조차 아니고 부재. 해시 근거: s09 산·겨울·아침·눈 weather 6/6 동일(`822dd1c2de34`) + temporal 0.00% → "눈"인데 입자 0·쌓임 0(`winter.ts WEATHER_FLAKES` 는 초원만, `land.ts` 는 `f.weather` 를 한 번도 읽지 않음); s02 숲·노을·바람 5/5 동일(`508f13546e5e`), 81그루 정지; s13 암석·노을·바람 5/5 동일(`692beee5eaa3`), `coast.ts` 는 `f.weather` 미참조 — 물보라(L919)는 날씨 무관 난수 2.2/s, 파도 진폭 `WV.amp` 상수, 1.5s 시점 spray 0; s06 계곡·저녁·안개 5/5 동일, s12 민물·새벽·안개 fog=clear(비만 `1a9db3c2f3ae` 1열: 수면 고리) — 새벽·안개인데 글린트 14개, 화면이 "점심·맑음"으로 읽힘; s08 갯벌·저녁·흐림 5/5 동일(흐림 표현 전무, 16/16). D-3 관점: s06·s10·s12 의 "안개"는 전부 엔진 `drawDepthHaze` 단일 선형 그라데이션(hz→.36h)이라 층별 누적·지면 안개 띠·시간대 배율(새벽 ×1.6)이 없다. 절단선은 없고 실루엣 대비는 남는다(s10 점심 하늘 84.0 / ① 74.0 / ② 65.0 / ④ 44.5 L*). 가장 크게 보이는 순서: ① s09 산·눈(눈송이 0) ② s02 숲·바람 / s13 암석·바람(정지·물보라 0) ③ s06·s12 안개(맑음과 동일) ④ s08 흐림.
[Suggested Fix] 세 갈래, 값싼 것부터: (a) 입자 한 층을 엔진에 — `scene-engine.ts` 가 `drawDepthHaze` 뒤에 `world/weather-fx.ts`(저해상 캔버스: 빗줄기 사선·눈송이 원근·안개 뭉치 드리프트)를 전 장면 공용으로 그림(`f.weather.now`, 강도는 시간대 배율 §3.1); (b) 하늘·안개색 — `world/view.ts bakeHorizon(…, weather)` 흐림 L−8 회색화 / 비 회청 L−14 / 안개 L+4 + haze α ×1.3~1.6(층별 .55/.3/.1로 두 겹 이상); (c) 장면별 `applyWeather(f)` 최소 채널 — `land.ts` 지면 판 위 젖음/흐림 오버레이 한 장(비 L−8 S+10%, 흐림 그림자 α×.4), `coast.ts`·`water.ts drawWaves` amp·alpha × wind(1.5) + spray 발생률 × wind, `drawGlints` 흐림·비·안개·새벽·밤 0, `summer.ts` 물 위 안개 띠.
[Acceptance Criteria] 16 시나리오 × 허용 날씨 전부 `weather-<x>.png` 해시 ≠ `weather-clear.png`; weatherDelta ≥ 3(7열 기준) — s09 눈: 입자+지면 L+ +하늘, s02·s15 바람: 식생·입자·하늘, s06·s12 안개: 하늘·원경·수면(글린트 0), s08 흐림: 하늘·지면 그림자·수면; s09 temporal 0→250ms 변화율 > 0.05%(눈송이); s13 바람 1.5s 시점 debug spray > 0, 파도 amp ≥ 1.5× 맑음; 안개에서 ② 능선 대비 ≥ 10L 유지.
[Confidence] 높음 — 6조합 해시 동일 + `land.ts`/`coast.ts`/`sea.ts` 에 `f.weather` 참조 0 확인.
```

```
[Issue] 여섯 시간대가 엔진 단색 틴트 한 채널로만 갈리고(아침·점심 0), 지면 ΔL이 목표의 1/10~1/2, 하늘색·그림자 길이·글린트는 띠를 안 탄다 — 아침=점심, 새벽·노을은 점심과 0.6L 차이.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] meadow·mountain·pond·deep / summer·autumn·spring / 6띠 전부 / clear·fog / 42 / showcase
[Category] T-1
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] GRAMMAR §2.1 "인접 띠 쌍에서 지면 ΔL·그림자 길이·하늘색 중 둘 이상", VISUAL_DIRECTION §7 "전체 단색 필터로 시간대를 말하기 금지". 측정(s16 초원·여름 지면 L*): 새벽 57.5 · 아침 58.1 · 점심 58.1 · 노을 57.5 · 저녁 56.0 · 밤 50.9 → ΔL(점심 대비) −0.6 / 0 / 0 / −0.6 / −2.1 / −7.2 vs 목표 −6/−2/0/−3/−9/−16. 하늘띠 L* 81.8/84.4/84.4/81.7/78.9/71.6, 밤 하늘 rgb(158,182,159) — 남청회가 아니라 초록회색(틴트가 안개색을 대체하지 않음). 채도 밤/점심 .79(목표 .62). s10 산: 새벽·노을 지면이 점심보다 **밝다**(+0.3/+0.5 L — 틴트색이 지면보다 밝아 방향 역전). 아침=점심 해시 동일 9/16(s03 s04 s09 s10 s12 s15 s16 …), 나머지 7은 `land.ts drawTree` 의 `hour<12` x오프셋 ±8px 한 채널. 그림자 길이·방향 채널 0(전 바이옴). 수면: s12 민물 새벽 글린트 14(목표 0), 밤 달빛 띠 없음(`summer.ts` L1175 `wantGl` 은 load만 봄); s14 깊은 바다 밤 빛줄기 4개 그대로(`sea.ts` L268~289 띠 미참조, BIOME_GRAMMAR "밤 빛줄기 0"). 가장 무너진 쌍: 아침↔점심(0채널) > 새벽↔아침 · 점심↔노을(0.6L, 색조만) > 노을↔저녁(1.5L) > 저녁↔밤(5L, 틴트 α .24 한 겹). 밤 정보 하한 자체는 지켜짐(실루엣·수면 보임) — 문제는 밤이 "밤"이 아니라 "약간 흐린 낮"으로 읽히는 것. 노을 과장(T-2) 없음 — 오히려 부족.
[Suggested Fix] `world/time.ts` `LIGHT` → `LightProfile{ sky rgb, groundDL, sat, shadowLen, shadowDir, shadowA, hazeK, glintK, tintA≤.06~.12 }`, `Frame.time.light` 로 전달; `world/view.ts bakeHorizon` 하늘·안개색을 프로파일에서(띠별 캐시 재굽기) + `drawDepthHaze` α × hazeK; `land.ts drawTree` 그림자 길이·방향·α를 hour 대신 프로파일에서(초원 4장면 소품 그림자도 동일 헬퍼); 지면 ΔL은 장면별 판 위 한 장 오버레이(multiply)로 — 틴트는 마지막 보정으로 낮춤; `water.ts drawGlints` α × glintK(새벽·저녁 0, 밤 달빛 띠 1), `sea.ts` 빛줄기 α × (밤 0 · 새벽/저녁 .4); 띠 경계 lerp ≥ 3s(§0.4).
[Acceptance Criteria] s16·s10 band-sheet 인접 5쌍 모두 bandDelta ≥ 2(채널 판정: 지면 ΔL ≥ 3 · 하늘 ΔE ≥ 6 · 그림자 길이비 ≥ 1.3 · 글린트 개수 변화); band-morning ≠ band-noon 해시 16/16; 밤 지면 ΔL ∈ [−16, −10] 이면서 실루엣 대비 ≥ 12L; 새벽·노을 지면이 점심보다 어두움(역전 0); s12 새벽 glints 0, 밤 달빛 띠 1; s14 밤 빛줄기 α 0; 노을 S ≤ .3.
[Confidence] 높음 — 픽셀 측정 + `time.ts LIGHT`(morning/noon α 0) + 장면 코드의 `f.time` 참조 인벤토리 확인.
```

```
[Issue] 육지 4바이옴(숲·언덕·계곡·산)은 나무·억새·구름 그림자에 시간 함수가 하나도 없어 바람 시나리오에서도 4초간 픽셀 0개가 바뀐다 — 정적 판.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] forest·hill·mountain / autumn·spring·winter·summer / dusk·noon·morning·dawn / wind·snow·fog·cloud·clear / 42 / showcase
[Category] M-3
[Severity: P0 / P1 / P2 / P3] P1
[Why it breaks immersion] VISUAL_DIRECTION §3 "살아 있음: 작은 것이 계속 조금씩 움직인다", GRAMMAR §3.2 바람 삼단 반응(풀 ×2.2 빠름 · 관목 ×1.4 지연 .2s · 큰 나무 수관 ±2px 지연 .5s), BIOME_GRAMMAR 숲 애니 "지금 정적(P1 M-3)"·언덕 "억새 진행파(정적 → P1)". 시간 diff 0.00% 6장면: s01 숲·봄, s02 숲·가을·**바람**(81그루), s09 산·겨울·눈, s10 산·가을·안개, s11 산·여름·새벽, s15 언덕·가을·**바람**(억새 200+) — static.png = temporal-0000 = temporal-4000 해시 동일. `land.ts` 는 `drawTree(g,x,y,R,hour,pine)` 에 `t` 를 넘기지 않고(SYSTEM_MAP §8 나무 "없음"), 억새·마른 풀은 바탕에 구워져 있음. 대비: 초원 여름(s16)은 풀 띠 idle 진행파로 2→4s 10.49%가 바뀌고 블록 비 3.9×(분산)라 살아 있음으로 읽힌다 — 화면을 넘길 때 "살아 있는 초원 → 굳은 숲"의 낙차가 곧 몰입 파괴. W-1 바람 열과 원인이 겹치지만, 바람이 없어도 있어야 할 미세 움직임(수관·억새·구름 그림자)이 0인 것이 본 건.
[Suggested Fix] `scenes/land.ts` `drawTree` 에 `sway` 인자: 수관만 x ±amp·sin(t·ω + φ(x,y)) — amp·ω 는 크기 등급별(큰 나무 ±2px·느림·지연 .5s, 작은 나무·관목 ±4px·중간), φ 는 개체 좌표 해시(위상 동일 금지); 언덕 억새·마른 풀을 바탕에서 떼어 `spring.ts` 풀 띠(12 strips 진행파) 방식의 스트립 층으로, 진폭 × wind; 산 `land.ts mountain` 에 구름 그림자 얼룩 1~2개(저해상, 60~90s 횡단) + 겨울 눈송이는 W-1 공용 입자층에서; 계곡 수변 풀 동일 헬퍼.
[Acceptance Criteria] 16/16 시나리오 temporal 0→250ms 변화율 > 0.05%; s02·s15 바람: 0→250ms ≥ 0.5% 이고 phaseSync < .9(개체·띠별 위상), 큰 나무 amp < 작은 나무 amp 이고 위상 지연 차 ≥ .3s(debug 카운터로 노출); s10·s11 산: 2→4s 에 구름 그림자 이동 감지(블록 비 ≤ 6×, 국소 점프 아님); static.png 는 여전히 stillFrame 과 동일(정지 화면 = 첫 프레임).
[Confidence] 높음 — 해시 동일 6장면 + `land.ts` 그리기 경로에 `f.t` 미사용 확인.
```

```
[Issue] 해안 3장면의 뭍 판(바위·웅덩이·절리·검불 전부)이 물가 선의 숨쉬기와 함께 ±3px 오르내리고, 띠가 바뀌면 조석 17px 이 보간 없이 튄다.
[Biome / Season / TimeOfDay / Weather / Seed / Camera] rocky·tidal·sandy / autumn·summer / dusk·noon / wind·clear / 42 / showcase
[Category] M-2 (부차 S-4)
[Severity: P0 / P1 / P2 / P3] P2
[Why it breaks immersion] VISUAL_DIRECTION §5 "동물·물의 움직임은 표면·레이어와 싸우지 않는다", GRAMMAR §0.4 "띠 경계 값은 ≥3s 보간". `coast.ts` L938 `sy = shoreY() − tide(f)·h·0.02 − sin(t·0.5)·3` 을 L985 `g.drawImage(land, 0, sy − 60, w, max(...))` 의 목적지 y·높이에 그대로 써서 뭍 이미지 전체가 물과 같이 움직인다(진폭 6px p-p, 주기 12.6s, 높이도 미세 신축). 관찰: s13 temporal-diff-0250.png 에서 물가에서 400px 떨어진 근경 바위 7무리 윤곽이 전부 노랑(예: (100~250, 300~420) · (540~620, 250~330) · (1100~1250, 470~620) 좌표대), 0→250ms 변화 1.12%·블록 비 8.8×(2,5); s07 은 뻘 대비가 낮아 물가 선(y≈300~330 전폭)만 두껍게 잡힘. 3px·12초라 의식적으로 보이진 않지만 바위가 조수와 함께 뜨는 것은 물리 위반이고, 달력(정지 UI) 옆에서 은근한 흔들림으로 누적된다. 조석 `tide(f)` 는 띠 함수(썰물 +1·밀물 −1)라 실제 사용 중 띠가 넘어가는 순간 물가가 17px 점프(캡처는 띠 고정이라 미관찰 — 코드 근거).
[Suggested Fix] `scenes/coast.ts draw`: `land` 는 고정 `shoreY() − 60` 에 그리고(60px 여유는 이미 있음), `sy` 는 `shorePath` 클립·젖은 띠 `wg`·거품 `foamRows` 에만 사용; `tide` 는 목표값을 두고 `step` 에서 lerp(≥3s) 한 현재값을 쓰기(엔진이 5초마다 세계를 다시 재므로 목표/현재 분리).
[Acceptance Criteria] s13·s07·(모래) temporal-diff 히트맵에서 젖은 띠 아래(행 ≥ 6) 바위·뻘 윤곽 변화 0(블록 비 0), 물가 선·거품·글린트만 남음; 띠 강제 전환(`forceWorld`) 직후 5프레임 연속 캡처에서 물가 선 y 프레임당 이동 ≤ 1px.
[Confidence] 높음 — 코드 두 줄로 원인 확정, 히트맵 패턴이 정확히 일치.
```

---

**요약**
- `P0 1 · P1 3 · P2 1 · P3 0`
- 가장 넓게 걸린 문제: **장면이 `f.time`·`f.weather` 를 거의 읽지 않는다** — 16/16 에서 시간대는 틴트 한 채널(bandDelta ≤ 1, 아침=점심), 날씨는 6조합 전부 0/7. 시간대(#3)와 날씨(#2)는 같은 입구(`world/time.ts`·`world/view.ts bakeHorizon`·`drawDepthHaze` + 장면별 한 장 오버레이)로 함께 열면 비용이 절반이다. 산 다섯 층은 시간대·안개에서 순서·단차가 유지된다(점심 84/74/65/44.5 → 밤 71/63/56/40 L*) — MOUNTAIN §4 는 이번엔 통과.
- 이번 라운드에 안 고쳐도 되는 것: **s16 여름 초원의 2→4s 10.49%** — 풀 띠 idle 진행파(전폭 저진폭, 평균 16) + 나비 2·무당벌레 2·메뚜기 3·벌 1의 정상 움직임(블록 비 3.9× 분산, 랩·점프 없음). 가을 낙엽이 바람 0에서도 초당 ≈0.9% 바뀌는 것도 설계된 미풍장(`autumn.ts` L853~854 `fx=4sin·fy=3cos`, 위치 위상)이라 M-1 아님. 다람쥐 이동(A-2: 원근 속도·보행 퇴장·발밑 그림자·통통)은 4시드 모두 합격 — 스폰 하한(#1)만 남았다.

관련 파일: `components/shared/ambient/scenes/autumn.ts`(L490·L785), `scenes/land.ts`(L1264 drawTree · `f.weather` 참조 0), `scenes/coast.ts`(L78·L919~921·L938·L985), `world/time.ts`(L43~49 LIGHT), `scenes/sea.ts`(L268~289), `scenes/summer.ts`(L1175).
