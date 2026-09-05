# 앰비언트 시스템 지도 — 구조 진단(2026-09-05)

> 목적: 검사 에이전트와 구현자가 **코드 구조를 다시 읽지 않고도** "무엇이 어디서 어떻게 그려지는가"를 재구성하게 한다.
> 감상문이 아니라 파일·함수·상수 기준의 진단이다. 코드가 바뀌면 이 문서를 같이 고친다(드리프트 = 결함).
> 관련: [README](README.md) · [VISUAL_DIRECTION](VISUAL_DIRECTION.md) · [QA_PROGRESS](QA_PROGRESS.md)

## 0. 한 장 요약

```
AmbientLayer(month, year, slug, force?, worldForce?)          components/shared/ambient/ambient-layer.tsx
  └ pickAmbient(month) → season (registry.ts: 12~2 겨울 · 3~5 봄 · 6~8 여름 · 9~11 가을)
  └ <SeasonCanvas season slug year month force>                season-canvas.tsx
      └ mountScene(canvas, createWorld(season, biome0), WorldCtx)   scene-engine.ts (루프·Frame·포인터·품질·디버그)
          └ WorldScene (world/world-scene.ts) = 카메라 + 바이옴 장면 11개 lazy 캐시
              └ BIOME_LOADERS[biome](season) → Scene            scenes/biome-loaders.ts
                  meadow  → spring.ts(봄·여름 변주) / autumn.ts / winter.ts
                  pond    → summer.ts(season 파라미터)
                  forest · hill · valley · mountain → land.ts(kind)
                  tidal · sandy · rocky → coast.ts(mode)
                  sea · deep → sea.ts(deep)
```

매 프레임: `scene.step(f)` → `scene.draw(g,f)` → `drawDepthHaze()`(엔진, 대기 안개 한 겹) → `LIGHT[band]` 빛 톤 한 겹(엔진).

## 1. 모듈별 역할과 진단

| 영역 | 파일 | 하는 일 | 진단(몰입 관점) |
|---|---|---|---|
| 진입·계절 | `registry.ts`, `ambient-layer.tsx`, `season-canvas.tsx` | 달 → 계절, 캔버스 1장 마운트, `force`(계절)·`worldForce`(시각·날씨·바이옴) | 계절은 달력 달이 정한다(ADR-0017). fixture 외엔 강제 없음 |
| 엔진 | `scene-engine.ts` | rAF 루프, `Frame`(w·h·dpr·t·dt·p·q·load·reduced·hot·dim·date·time·weather·traces), 자체 여력 조절기(90프레임마다 ±), 포인터(window 리스너, `isBackgroundTarget`), 정지 화면(`stillFrame`), `window.__vicAmbient` 디버그, **결정적 재현(P0)**: `force.seed/freeze/load/pointer/pin`, `advance(ms)` 고정 dt step, `ready()` | ~~① 장면 시드 비결정적~~ → **2026-09-05 해결(fixture만)**: `force.seed`가 있으면 그 값, 없으면 옛 `Date.now()`. ~~② 시간 t 외부 제어 불가~~ → `freeze` + `advance()`. **③ 빛 톤 = 화면 전체 단색 한 겹**(`LIGHT`, 아침·점심은 0) — 시간대가 "필터"로만 읽히는 구조적 이유(하네스 관찰: `band-morning` = `band-noon` 9/16) |
| 세계 | `world/time.ts` | 여섯 띠(새벽·아침·점심·노을·저녁·밤), 계절별 일출·일몰, `LIGHT` 틴트(dawn 회청 .08 · dusk 회자 .09 · evening .14 · night .24) | 띠는 정확하나 **표현 채널이 틴트 하나뿐** — 그림자 길이·하늘·수면 반사·원경 가시성이 띠를 안 탄다 |
| 세계 | `world/weather.ts` | 월별 평년값 확률표(기상청 1991~2020 서울) → 날짜 시드 날씨(오전/오후 마디, 직전 마디) | 표 자체가 계절 규칙(여름 눈 0). **장면 반응이 거의 없다**(§3 표) |
| 세계 | `world/traces.ts` | (연대기 철거 후) 달만 보는 흔적: 두더지 흙더미(3~8월)·눈사람(12~2월)·연잎(6~8월), 정규화 좌표 | 안정. CLAUDE.md의 "연대기·데뷔 나무" 서술은 **낡음**(2026-09-05 철거) |
| 세계 | `world/rarity.ts`, `world/species.ts` | 5등급 스폰 감독(동시 상한·쿨다운·자비·전설 1회), 종 레지스트리(살아 있는 8종) | 감독은 있으나 **장면 대부분이 자체 타이머로 스폰**(다람쥐 `nextSquirrel`, 토끼, 벌 등) — 감독 미경유 |
| 카메라 | `world/view.ts` | `HORIZON_V .30`(2026-09-06 확대 — 지평선에 붙는 것은 `aboveHz(h, dh)`, 땅 비율은 `groundYAt(v, h)`), `GROUND_SQUASH .7`, `depthScale .6→1`(0.05 양자화), `depthFade .78→1`, `moveScale = depthScale³`, `drawDepthHaze`(HAZE_ALPHA .11 → HAZE_END_GV .2727(땅 비율)), `bakeHorizon`(안개 + 먼 언덕 2겹 + 나무 실루엣 줄, profile land\|sea) | 안개는 **단일 선형 그라데이션** — 층별(전/중/후) 감쇠가 아니다. 지평선 띠의 언덕(2026-09-06부터 `aboveHz(h, .06)`/`aboveHz(h, .034)` — hz 비례가 아니라 지평선에서의 거리)은 **모든 육지 바이옴 공통** → 산에서 봉우리와 겹친다(§4) |
| 축척 | `world/scale.ts` | TILE 64, `SIZE` 표(참나무 128·소나무 112·바위 48·낙엽 16·다람쥐 36…) | 안정. 새 크기는 여기서만 |
| 배치 | `art/props.ts` | `drawProp`(아트 → 대체물), `scatterProps`(띠 any/edge, minV), `claimSpot`(원형 점유, 세로 /0.7, 겹침 허용 0.62) | `claimSpot`은 **호출 쪽 책임** — 숲 나무 배치(`land.ts` L1154~1205)는 한 번도 안 부른다 → 수관 겹침. 관계별(나무-나무·나무-바위) 반경 표 없음 |
| 아트 | `art/manifest.ts`, `art/load.ts` | 자리 65개, `public/ambient/art/<id>.png` 드롭인, 404 세션 기억, 전부 도착 시 재굽기 | 안정(ADR-0017 ⑮) |
| 육지 4 | `scenes/land.ts` | forest·hill·valley·mountain: 바탕 1회 굽기(`bake`), 나무는 매 프레임 `drawTree`(y-sort된 배열), 계곡 거품만 움직임 | **정적 판**: 바람·비·안개·시간대 반응 0(나무 그림자 방향만 `hour<12`). 산 봉우리 = 별도 캔버스 2겹(뒤 α.5 반투명·앞 α.88) — §4 |
| 초원 4계절 | `scenes/spring.ts`(봄·여름), `autumn.ts`, `winter.ts` | 가장 두꺼운 장면들. 생물·물리·상호작용 전부 여기 | 다람쥐 스폰 §5. 풀 흔들림은 봄만(띠 12개 진행파, 꽃잎 바람 때만) |
| 민물 | `scenes/summer.ts` | 옛 여름 물 장면 + season 파라미터(겨울 얼음). 저해상 항적 층, 물고기 그림자, 오리, 반쯤 잠긴 바위 | 잠긴 바위 = **clip 사각형 + 흰 타원 링**뿐(§6) |
| 해안 3 | `scenes/coast.ts` | 뭍 캔버스(모드별) + 공용 물(`water.ts`), 조석은 띠 함수, 파도 띠 수 모드별 | 갯골 = 직선 현 + 단일 사인 요동(§7) |
| 바다 2 | `scenes/sea.ts`, `scenes/water.ts` | 너울·거품 선·글린트·물고기 그림자·밤 별·깊은 바다 빛줄기/해파리 | 표류물 `u=(…)%1` 랩 시 x 점프 가능(루프 이음매 후보) |
| 감상·내비 | `showcase.tsx`, `app/ambient.css` | `html[data-showcase]`, 방향키/WASD/스와이프/쉐브론/미니맵, 도착 알약 | 안정 |
| fixture(편집실) | `app/visual-fixture/studio/page.tsx` | `?role=developer&viewer=1&ambient=&hour=&weather=&y=&m=&biome=` | 달력 뒤 실물(핫 존·내비 실측용). 비결정적 |
| **fixture(결정적)** | `app/visual-fixture/biome/page.tsx` + `biome-fixture.tsx`(2026-09-05, PLAN-005 P0) | `?biome&season&band&weather&seed&t&load&pointer&camera` — 페이지가 `ready()` → `advance(t)` → `settledT` | **같은 URL = 같은 픽셀**(셀프테스트 23/23). 캔버스만 캡처 |
| 디버그 | `window.__vicAmbient` | `season q load frames consumed running scene() forceLoad hot world() forceWorld goTo biome exits redraw` + **`seed frozen freeze advance time forcePointer pending ready weatherOptions settledT`**(P0) | `scene()`가 노출하는 카운터는 장면마다 다름(다람쥐 위치 미노출 — P2에서 `creatures`·`propField` 추가) |
| 검증 자산 | **`scripts/ambient-qa/`**(capture · sheet · diff · selftest, 2026-09-05) · `.scratch-pw/snap-biomes.mjs`(44장, 비결정적 — 대체됨), `probe-biomes.mjs`, `probe-squirrel.mjs`, `perf-frames.mjs` | 결정적 캡처·시트·diff · 라운드2 5회전(ADR-0017 ⑰⑱)의 옛 하네스 | baseline `.scratch-pw/qa/r00/baseline`(16 시나리오). 전수 지표(P2)·라운드 러너(P3)는 미구축 |

## 2. 상태 축이 실제로 닿는 곳(반응 인벤토리)

> **라운드 2 뒤 상태(2026-09-05)**: 아래 §2.1·§2.2 표는 **라운드 0 진단**이다. 라운드 2가 입구를 열었다 — `world/light.ts`
> `lightOf(band, weather, season)`가 여섯 채널(하늘 오버레이 · 지면 multiply(ΔL+색온도) · 채도 · 대기 안개 색/배율 + 안개 날씨의
> 층별 지면 안개 · 그림자 dx/len/α · 글린트 · 바람)을 내고, 엔진 `drawOnce`가 `scene.draw → particles.draw → drawDepthHaze(light)
> → drawLightPass(light)` 순으로 칠한다(점심·맑음 = 항등). `world/particles.ts`가 비(0.5× 저해상 사선)·눈·바람 부스러기·안개 뭉치를
> 엔진 층으로 그린다(`Scene.ownsWeather`로 초원 겨울 눈송이 제외). 장면 소비자: `land.ts drawTree`(그림자 방향·길이·농도 + 바람
> 흔들림 ≥ .15), `summer.ts` 글린트 × `light.glint`, `sea.ts` 빛줄기 × 띠/날씨. 띠·마디 전환은 3초 lerp. 실측 도구
> `scripts/ambient-qa/light-probe.mjs`. 아직 안 닿는 곳: 파도 진폭·물보라(coast/sea 상수),
> 눈 쌓임·젖은 땅 상태 변수, 언덕 억새(바탕에 굽힘 — 부스러기만 움직임).
>
> **라운드 5 뒤 상태(2026-09-06, 하늘 + 산 층 순서)**: 하늘은 `world/sky.ts`가 그린다 — `skyPalette(season, weather, band)`(조명 패스 전 값) →
> `bakeSky`(그라데이션 + 1/3 해상 픽셀 구름, hz 아래 5%h 페이드) → 장면이 ground 뒤·horizon 앞에 그리고(산은 ① 능선 위 clip) `drawSkyLive`(별·음력 달·
> 새벽/노을 해)를 horizon 뒤에 얹는다(별·달 상한: 육지 hz·.3 · 산 ① 능선 · 바다 top·.9). coast/sea의 자체 하늘·별은 제거. `bakeHorizon` 위 안개 .55 → .18,
> 먼 숲 실루엣 세 종. 산(`land.ts` mountain)은 봉우리 캔버스가 없어졌다 — ①②·애추 띠·원경 침엽수를 **바탕에 소품보다 먼저** 굽는다(§4 진단의 "봉우리 캔버스가
> 바탕 위" 구조 해소), `ridgeC`(능선선 보강)만 별도.
>
> **라운드 4 뒤 상태(2026-09-05, AMB-T1-03 "조명은 섰지만 소비자가 없다" 해소)**: 소비자가 셋 늘었다. ① **소품 발밑 그림자**
> `art/props.ts propShadow()` — scatterProps·초원 관목/버섯/나무/바위·해안 바위/통나무/소나무의 굽힌 그림자가 `currentLight().shadow`
> (dx·len·alpha)를 읽는다(점심 = 옛 softBlob과 픽셀 동일). 바탕은 조명 전이가 끝나면(`Frame.lightStable`) `shadowKey(light)`가 달라졌을
> 때 **한 번** 다시 굽는다(spring·autumn·winter·land·coast의 `step`). ② **수면 위 빛의 길** `scenes/water.ts drawWaterLight()` —
> `Light.reflect {k, rgb, x}`(노을 회장미 .62 · 밤 달빛 청백 .58 · 새벽 .26 · 저녁 .22 · 점심/아침/흐림/비/안개 0, x = 그림자 반대쪽) —
> pond(물가 선 아래 clip)·coast(수평선~물가)·sea/deep. screen 합성 뒤 엔진 multiply를 같이 받는다. ③ **생물 풀이 띠를 안다**
> `spring.ts BAND_K`(새벽 .34 · 아침 .75 · 점심 1 · 노을 .6 · 저녁·밤 0)로 나비·메뚜기·무당벌레 수, 꿀벌은 아침·점심·노을만, 여름
> 저녁·밤엔 **반딧불** 5~12(저채도 연두); `autumn.ts` 다람쥐는 저녁·밤에 새로 오지 않는다. 새벽·맑음은 `groundFog .2`(원거리 습기).

### 2.1 시간대(band) — 장면이 `f.time`을 읽는 곳 전부

| 장면 | 읽는 값 | 반응 |
|---|---|---|
| 엔진 | `tint` | 화면 전체 단색 한 겹(아침·점심 0) |
| coast | `band` | 조석: 새벽·저녁·밤 = 썰물(+1), 점심 = 밀물(−1), 물가 선 ±2%h |
| sea | `night` | 별 40개(먼바다·깊은 바다 위 띠) |
| land | `hour` | 나무 그림자 x 오프셋 ±8 (오전/오후) |
| meadow 4 · pond · valley 등 | — | **없음** |

→ 하늘 색·그림자 길이/농도·수면 반사·원경 가시성·생물 풀(주행성/야행성)·글린트 강도는 **어느 장면도 띠를 안 본다.**

### 2.2 날씨 — 장면이 `f.weather`를 읽는 곳 전부

| 날씨 | 반응하는 곳 | 반응 없는 곳 |
|---|---|---|
| rain | pond: 빗방울 고리(≤160), 물고기 depth +.3 | 초원 4·육지 4·해안 3·바다 2 — 하늘·지면 톤·원경 대비·수면 전부 무반응 |
| wind | autumn: 돌풍 간격 ×.45 · spring: 꽃잎 바람 간격 ×.4 | 나무·풀·억새·갈대·파도 높이·물보라 |
| fog | autumn: 서리 안개 1.7배·높이 1.6배 | 나머지 전부 — **깊이 기반 안개 없음** |
| snow | winter: 눈송이 ×1.8(WEATHER_FLAKES) | 쌓임·지면 밝기·산 적설·바다 위 눈 |
| cloud | **없음** | 전부 — 흐림은 지금 맑음과 같은 그림 |

### 2.3 계절 — 잘 되어 있는 것

바탕 팔레트(`GROUND`·`LAND_COLORS`·`waterPalette`), 계절별 소품 자리 시드(`SEASON_SEED`), 아트 계절 변형, 초원의 계절 장면 분리. 계절은 네 축 중 유일하게 "환경 상태"로 읽힌다.

## 3. 시드·난수 구조

- 결정적 rng: `scenes/util.ts rng(seed)`(mulberry32), `world/seed.ts hashSeed(...parts)`(FNV-1a).
- 장면 시드 흐름: 엔진 `Date.now()%100000+7` → `createWorld` → 바이옴별 `seed + key.length*131 + charCode*17` → 장면 `bake`의 `rng(seed*7 + 13 + SEASON_SEED[season])`.
- 결정적인 것: 날씨(slug·날짜), 흔적(slug·연·달), 지평선 띠(`rng(311 + w*3 + season.length)` — 폭·계절만), 바탕 얼룩(장면 시드).
- **실제 화면에서 비결정적인 것**: 장면 시드 자체 → 나무·바위·관목 자리, 생물 첫 스폰 시각, 갯골 형태(로드마다 다르다 — 결정 사항 아님).
  **검증은 `force.seed`로 잠근다**(2026-09-05 P0, `/visual-fixture/biome?seed=`): 얼린 엔진(`freeze`) + 고정 dt `advance()` + 에셋 안정 3회 고정 워밍업 → 같은 URL = 같은 픽셀([PLAN-20260905-005 §7](../agent/plans/PLAN-20260905-005-ambient-visual-qa.md#7-구현-기록--p0p12026-09-05)).

## 4. 산 바이옴 — 능선 모호성의 구조적 원인(`land.ts` mountain 분기, L921~1148)

```
그리기 순서(draw): ground(바탕+소품) → horizon(bakeHorizon: 안개 + 먼 언덕 2겹 + 나무 실루엣 줄) → peaks(별도 캔버스) → trees
peaks: peak(baseV .2,  amp h*.34, PEAK[0], α .50, snowLine .3,  cap=false)   ← 뒤 봉우리: 반투명
       peak(baseV .32, amp h*.26, PEAK[1], α .88, snowLine .42/.16, cap)      ← 앞 봉우리
       각 봉우리: 채움 그라데이션이 발치에서 `${fill}00`(투명)으로 사라짐 + 북서광 대각 그라데이션 + 구곡 7 + 발치 destination-out 들쭉 컷
```

원인 세 가지:
1. **뒤 봉우리가 반투명(α .5)** → 그 뒤의 `bakeHorizon` 먼 언덕 두 겹·나무 실루엣 줄이 비쳐 "봉우리 속에 언덕"이 겹친다. 산의 몸체인지 능선 너머 언덕인지 판독 불가.
2. **능선선(ridgeline)이 없다** — 실루엣 채움의 가장자리가 곧 능선이고, 앞·뒤 봉우리의 명도 차(PEAK[0]/[1])가 작아(봄 `#d5dcdd`/`#bfc8ca`) 두 실루엣이 한 덩어리로 읽힌다. 하늘과의 분리도 채움 색 하나에 의존.
3. **발치가 투명으로 녹는다**(`${fill}00` + 들쭉 컷) → 봉우리 몸체와 지면(GROUND.mountain 그라데이션)이 같은 평면으로 이어진다. "산의 발"이 없다.

규칙은 [MOUNTAIN_DEPTH_RULES](MOUNTAIN_DEPTH_RULES.md).

**라운드 1(2026-09-05) 뒤 상태**: 산은 `bakeHorizon(…, "mountain")`(언덕·나무 줄 없음) · 두 봉우리에 능선선(연속 1px 림 + 3px 그늘) · 구곡 기둥 루프 삭제 ·
발치는 `mixHex`로 그 높이의 땅색에 맞물림(투명 페이드 아님) · `PEAK` 팔레트 재조정 · 설선 아래 청회 그늘 띠 · 침엽수 실루엣 줄 `≥ groundY(.34)`.
뒤 봉우리 α .5는 그대로(열린 결정). 남은 것: ②↔③ 단차(가을 4.3·겨울 5.3 L) — AMB-D2-03.

## 5. 가을 다람쥐 — 공중 보행의 구조적 원인(`scenes/autumn.ts`)

```
startSquirrel (L486~528):
  e ∈ {0 좌, 1 우, 2 아래}
  x = e===0 ? -40 : e===1 ? w+40 : rand()*w
  y = e===2 ? h+40 : groundY(rand())          ← rand()≈0 이면 y = 지평선 선(gy()) 바로 위/아래
  ty = groundY(0.32 + rand()*0.6)             ← 목표는 v≥.32로 막았으나 **출발점은 v∈[0,1)**
draw (L1051~1081): 크기 = depthScale(y)*(36/52) → 지평선에서 .6배, depthFade .78, 그 위에 엔진 안개
whirl 스폰 (L785): e===2 이면 y = gy() - 80   ← 지평선 **위**(하늘)에서 출발
```

- 좌·우 가장자리에서 들어오는 다람쥐가 v≈0(지평선 선)에서 출발하면, 그 자리는 `bakeHorizon`의 먼 언덕·실루엣 나무가 그려진 띠라 **"언덕 위 하늘을 걷는" 그림**이 된다. 지평선에서 목표(v≥.32)까지 내려오는 동안 계속 그렇다.
- `moveScale`(지평선에서 .22배)이라 그 구간에서 **느리게** 움직여 오래 보인다 — 더 눈에 띈다.
- 회오리(`whirl`)는 아예 하늘에서 출발한다(잎이 없는 곳이라 눈에 덜 띄지만 규칙 위반).
- 같은 패턴 후보: `spring.ts` 나비(L456 `gy()-30`), 벌(L628 `groundY(rand())`), `winter.ts` 걷는 손님(L501은 `gy()+60` 이상으로 안전), 눈송이 위치 리셋(L628 `groundY(rand())`).

규칙: [BIOME_GRAMMAR §생물](BIOME_GRAMMAR.md#공통-생물-규칙) · [IMMERSION_BREAK_RULES A-1](IMMERSION_BREAK_RULES.md).

**라운드 1(2026-09-05) 뒤 상태 — 닫힘**: 출발 `groundY(.18 + rand·.82)`, 목표 도토리는 v ≥ .18인 것만·쫓는 y 하한, **묻을 자리 `pickCacheSpot`도
`groundY(.18 + rand·.78)`**(프로브가 잡은 진짜 경로 원인 — 옛 `40 + rand·(h−80)`은 하늘까지 뽑혔다), 회오리·봄 무당벌레 위 출입 → 아래.
프로브(`scripts/ambient-qa/spawn-probe.mjs`) 24시드 × 2띠: 출발·경로 최소 v .201, 회오리 .272. 나비·벌(나는 종)은 규칙상 위 출입 허용 — 손대지 않음.

## 6. 계곡·민물 잠긴 돌 — 현재 표현

- 민물(`summer.ts` L489~515): 바위를 `y+8k`에 그리되 `rect(x-60k, y-90k, 120k, 90k)`로 **수면 위 부분만 clip**, 수면선 = 흰 타원 링(뒤 반원 먼저, 앞 반원 나중, 17k×5k). 물속 부분은 **그리지 않음**(잘림). 물색 tint·젖은 띠·굴절 없음 → "잘린 돌".
- 계곡(`land.ts` L735~761): 물길 안 바위 5개를 **clip 없이** 통째로 그리고 상류 쪽 흰 호(뱃머리 물살) + 하류 꼬리 2줄. 잠김 표현 없음 → "물 위에 얹힌 돌".

**라운드 1(2026-09-05) 뒤 상태 — 닫힘(민물·계곡)**: `art/props.ts drawSubmerged(g, art, id, x, yWater, {depth, water, wet…})` — 오프스크린에 소품을
그리고 수면 아래를 물색(source-atop) + 깊이 페이드(destination-out), 수면선 위 3px 젖은 띠, 한 번에 찍는다(바탕 무접촉). 민물 바위 8k(겨울 4k 얼음빛),
계곡 물 안 바위 10k. 앞 반원 수면선·상류 물살·하류 후류는 호출 쪽 그대로. **암석해안 시스택·물가 노두는 미착수**(AMB-S4-03).

## 7. 갯벌 물골 — 현재 표현(`coast.ts` L114~232)

> **라운드 2 뒤 상태(2026-09-05)**: 아래는 라운드 0 진단. 라운드 2에서 `chan()`이 두 옥타브 굽이 + 결정적 흔들림(진폭·파수 ∝ 길이)
> → Chaikin 한 번으로 바뀌었고, 폭은 멱함수 테이퍼(1.5~1.7) × ±14% 숨, `drawChan`은 둔치 그늘을 한쪽(+3,+2px)으로 비껴 한 겹,
> 잔류수는 2차 이상만, 젖은 가장자리는 **두 둔치의 열린 선**(끝 캡 없음 — 하구·합류점을 가로지르던 선 제거). 물 마스크 `inWater`
> (중심선 거리 ≤ hw+6)가 바위·조약돌·조개·게 구멍·해조를 물 밖으로 밀어낸다(라운드 2 P0 AMB-S2-01). 뭍 판은 고정 y에 그리고
> 물가 클립만 숨쉰다(AMB-M2-02). 남은 것: 지류 접선 블렌드(합류각 ≤ 60° 보장 없음), 곡률 부호별 비대칭 둔치 — B#2 (a)(e).

- `chan(sx,sy,ex,ey,order,ph)`: **직선 현**(sx→ex) 위에 `sin(t·π·waves + ph)·amp·sin(πt)` 단일 사인 요동(amp 26/18/11, waves 1.5/2.4/3.2). 폭 = `world(t)·landK·cap`(하구로 갈수록 t² 증가).
- 지류: 본류 노드에서 `run` 만큼 떨어진 점 → 노드로 직선 chan. **접선 연속 없음**(합류각 임의, 위상 고정 상수), 합류부 필렛 없음.
- 렌더: `drawChan` 4회 — 둔치 1.35(짙은 채움) · 물 1.0 · 잔류수 0.5 · 젖은 가장자리 1.04 stroke. 전부 **등폭 오프셋 리본**.
- 결과: 곡률이 사인 하나라 "리본을 파도처럼 구부린" 인상, 합류가 각지고, 폭 변화가 매끈한 2차식이라 퇴적·침식 흔적(안쪽 둔치·바깥 절벽)이 없다. 규칙: [BIOME_GRAMMAR 갯벌](BIOME_GRAMMAR.md#7-갯벌-tidal).

## 8. 애니메이션 위상 인벤토리

| 요소 | 시간 함수 | 위상 다양성 | 루프 이음매 위험 |
|---|---|---|---|
| 봄 풀 띠 12개 | `sin(t*3.4 - i*0.7*windDir)` + idle `sin(t*0.9 + j*0.8 + i*0.4)` | 띠별 위상 ○ | 없음(연속) |
| 나무(전 바이옴) | **없음** | — | — |
| 파도(`drawWaves`) | `p=(t*speed + i/bands)%1`, y=top+H·p^2.4, α는 p>.92에서 페이드 | 띠별 ○ | 낮음(페이드) |
| 너울 명암(sea) | `sin(x*.0022 + i*2.1 + t*k)` | 띠별 ○ | 없음 |
| 표류물(sea) | `u=(ph*.137 + t*k)%1` | 개체별 ○ | **있음** — u 랩 시 x 점프(화면 안에서 보일 수 있음) |
| 글린트 | `max(0, sin(t*1.4+ph))` | 개체별 ○ | 없음 |
| 계곡 거품 | `u=(u+sp*dt)%1` | 개체별 ○ | 상류 끝 재등장(안개 속이라 낮음) |
| 깊은 바다 큰 그림자 | `(t*7)%(w+1800)-900` | 단일 | 낮음(화면 밖 랩) |
| 낙엽·눈·꽃잎·생물 | 물리/상태기계 | ○ | 없음 |

→ "모든 것이 같은 위상"은 아니다. 문제는 **정적인 것이 너무 많다**(나무·풀·억새·갈대 무반응)와 **바람이 계절 장면 둘에만** 닿는다는 것.

## 9. 고치려면 어디를 만지나(경로 요약)

| 문제 | 파일 | 함수/블록 |
|---|---|---|
| 결정적 시드·시간·포인터 | `scene-engine.ts`, `season-canvas.tsx`, `ambient-layer.tsx`, fixture page | `mountScene` seed, `WorldCtx.force`, `__vicAmbient` |
| 시간대 표현 채널 | `world/time.ts`(LIGHT → 다채널 프로파일), `world/view.ts`(`bakeHorizon` 하늘·안개색), 각 장면 `draw`의 그림자 | 새 `LightProfile` |
| 날씨 반응 | `world/weather.ts`(표는 유지), 각 장면 `step/draw`, `world/view.ts drawDepthHaze`(fog 깊이) | 장면별 `applyWeather` |
| 산 능선 | `land.ts` mountain 분기, `view.ts bakeHorizon`(profile 추가) | `peak()` |
| 갯골 | `coast.ts` tidal 분기 | `chan()`, `drawChan()` |
| 잠긴 돌 | `summer.ts` 반쯤 잠긴 바위, `land.ts` valley ⑥-b | 그리기 2단(수면 위/아래) |
| 간격 규칙 | `art/props.ts`(`claimSpot` 반경 표), `land.ts` forest/hill 나무·바위 | 새 `world/spacing.ts` |
| 다람쥐 스폰 | `autumn.ts` `startSquirrel`, `whirl` 스폰, `spring.ts` 나비·벌 | 출발 v 하한 |
