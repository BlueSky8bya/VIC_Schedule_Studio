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
| 엔진 | `scene-engine.ts` | rAF 루프, `Frame`(w·h·dpr·t·dt·p·q·load·reduced·hot·dim·date·time·weather·traces), 자체 여력 조절기(90프레임마다 ±), 포인터(window 리스너, `isBackgroundTarget`), 정지 화면(`stillFrame`), `window.__vicAmbient` 디버그 | **① 장면 시드가 비결정적**: `factory((Date.now() % 100000) + 7)`(L217) — 같은 URL이라도 로드마다 소품 자리가 다르다. 전/후 비교 불가의 근본 원인. **② 시간 t를 외부에서 못 세운다**(`tick`이 `performance.now` 기준) — 시간별 캡처가 재현 불가. **③ 빛 톤 = 화면 전체 단색 한 겹**(`LIGHT`, 아침·점심은 0) — 시간대가 "필터"로만 읽히는 구조적 이유 |
| 세계 | `world/time.ts` | 여섯 띠(새벽·아침·점심·노을·저녁·밤), 계절별 일출·일몰, `LIGHT` 틴트(dawn 회청 .08 · dusk 회자 .09 · evening .14 · night .24) | 띠는 정확하나 **표현 채널이 틴트 하나뿐** — 그림자 길이·하늘·수면 반사·원경 가시성이 띠를 안 탄다 |
| 세계 | `world/weather.ts` | 월별 평년값 확률표(기상청 1991~2020 서울) → 날짜 시드 날씨(오전/오후 마디, 직전 마디) | 표 자체가 계절 규칙(여름 눈 0). **장면 반응이 거의 없다**(§3 표) |
| 세계 | `world/traces.ts` | (연대기 철거 후) 달만 보는 흔적: 두더지 흙더미(3~8월)·눈사람(12~2월)·연잎(6~8월), 정규화 좌표 | 안정. CLAUDE.md의 "연대기·데뷔 나무" 서술은 **낡음**(2026-09-05 철거) |
| 세계 | `world/rarity.ts`, `world/species.ts` | 5등급 스폰 감독(동시 상한·쿨다운·자비·전설 1회), 종 레지스트리(살아 있는 8종) | 감독은 있으나 **장면 대부분이 자체 타이머로 스폰**(다람쥐 `nextSquirrel`, 토끼, 벌 등) — 감독 미경유 |
| 카메라 | `world/view.ts` | `HORIZON_V .12`, `GROUND_SQUASH .7`, `depthScale .6→1`(0.05 양자화), `depthFade .78→1`, `moveScale = depthScale³`, `drawDepthHaze`(HAZE_ALPHA .11 → HAZE_END_V .36), `bakeHorizon`(안개 + 먼 언덕 2겹 + 나무 실루엣 줄, profile land\|sea) | 안개는 **단일 선형 그라데이션** — 층별(전/중/후) 감쇠가 아니다. 지평선 띠의 언덕(hz×.5, hz×.72)은 **모든 육지 바이옴 공통** → 산에서 봉우리와 겹친다(§4) |
| 축척 | `world/scale.ts` | TILE 64, `SIZE` 표(참나무 128·소나무 112·바위 48·낙엽 16·다람쥐 36…) | 안정. 새 크기는 여기서만 |
| 배치 | `art/props.ts` | `drawProp`(아트 → 대체물), `scatterProps`(띠 any/edge, minV), `claimSpot`(원형 점유, 세로 /0.7, 겹침 허용 0.62) | `claimSpot`은 **호출 쪽 책임** — 숲 나무 배치(`land.ts` L1154~1205)는 한 번도 안 부른다 → 수관 겹침. 관계별(나무-나무·나무-바위) 반경 표 없음 |
| 아트 | `art/manifest.ts`, `art/load.ts` | 자리 65개, `public/ambient/art/<id>.png` 드롭인, 404 세션 기억, 전부 도착 시 재굽기 | 안정(ADR-0017 ⑮) |
| 육지 4 | `scenes/land.ts` | forest·hill·valley·mountain: 바탕 1회 굽기(`bake`), 나무는 매 프레임 `drawTree`(y-sort된 배열), 계곡 거품만 움직임 | **정적 판**: 바람·비·안개·시간대 반응 0(나무 그림자 방향만 `hour<12`). 산 봉우리 = 별도 캔버스 2겹(뒤 α.5 반투명·앞 α.88) — §4 |
| 초원 4계절 | `scenes/spring.ts`(봄·여름), `autumn.ts`, `winter.ts` | 가장 두꺼운 장면들. 생물·물리·상호작용 전부 여기 | 다람쥐 스폰 §5. 풀 흔들림은 봄만(띠 12개 진행파, 꽃잎 바람 때만) |
| 민물 | `scenes/summer.ts` | 옛 여름 물 장면 + season 파라미터(겨울 얼음). 저해상 항적 층, 물고기 그림자, 오리, 반쯤 잠긴 바위 | 잠긴 바위 = **clip 사각형 + 흰 타원 링**뿐(§6) |
| 해안 3 | `scenes/coast.ts` | 뭍 캔버스(모드별) + 공용 물(`water.ts`), 조석은 띠 함수, 파도 띠 수 모드별 | 갯골 = 직선 현 + 단일 사인 요동(§7) |
| 바다 2 | `scenes/sea.ts`, `scenes/water.ts` | 너울·거품 선·글린트·물고기 그림자·밤 별·깊은 바다 빛줄기/해파리 | 표류물 `u=(…)%1` 랩 시 x 점프 가능(루프 이음매 후보) |
| 감상·내비 | `showcase.tsx`, `app/ambient.css` | `html[data-showcase]`, 방향키/WASD/스와이프/쉐브론/미니맵, 도착 알약 | 안정 |
| fixture | `app/visual-fixture/studio/page.tsx` | `?role=developer&viewer=1&ambient=&hour=&weather=&y=&m=&biome=` | **seed·band·t(애니 시각)·pointer 강제 없음** → 결정적 평가 불가 |
| 디버그 | `window.__vicAmbient` | `season q load frames consumed running scene() forceLoad hot world() forceWorld goTo biome exits redraw` | 시간 전진(`step(dt)`)·시드·포인터 고정 없음. `scene()`가 노출하는 카운터는 장면마다 다름(다람쥐 위치 미노출) |
| 검증 자산 | `.scratch-pw/snap-biomes.mjs`(44장), `probe-biomes.mjs`, `probe-world.mjs`(연대기 철거로 일부 낡음), `probe-squirrel.mjs`, `perf-frames.mjs` | 라운드2 5회전(ADR-0017 ⑰⑱)의 하네스 | 시드가 비결정적이라 **같은 장면 재촬영이 안 된다**. 시간별·시간대별 시트 없음 |

## 2. 상태 축이 실제로 닿는 곳(반응 인벤토리)

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
- **비결정적인 것**: 장면 시드 자체 → 나무·바위·관목 자리, 생물 첫 스폰 시각, 갯골 형태. 검사 파이프라인 P0에서 `force.seed`로 잠근다([PLAN-20260905-005](../agent/plans/PLAN-20260905-005-ambient-visual-qa.md)).

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

## 6. 계곡·민물 잠긴 돌 — 현재 표현

- 민물(`summer.ts` L489~515): 바위를 `y+8k`에 그리되 `rect(x-60k, y-90k, 120k, 90k)`로 **수면 위 부분만 clip**, 수면선 = 흰 타원 링(뒤 반원 먼저, 앞 반원 나중, 17k×5k). 물속 부분은 **그리지 않음**(잘림). 물색 tint·젖은 띠·굴절 없음 → "잘린 돌".
- 계곡(`land.ts` L735~761): 물길 안 바위 5개를 **clip 없이** 통째로 그리고 상류 쪽 흰 호(뱃머리 물살) + 하류 꼬리 2줄. 잠김 표현 없음 → "물 위에 얹힌 돌".

## 7. 갯벌 물골 — 현재 표현(`coast.ts` L114~232)

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
