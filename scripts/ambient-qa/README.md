# scripts/ambient-qa/ — 계절 배경 비주얼 QA 하네스

> 📖 PLAN-20260905-005 P0·P1(2026-09-05). 규칙·절차는 [`docs/ambient/`](../../docs/ambient/README.md)(프로토콜 §4~§7), 이 폴더는 **도구**만.
> 산출물은 `.scratch-pw/qa/`(추적 안 함). 라운드 기록(`docs/ambient/rounds/`)에는 경로와 해시만 적는다.

## 서버

프로덕션 빌드 + fixture 플래그(없으면 404). dev 서버(3100)가 떠 있으면 먼저 내린다(`.next` 충돌).

```bash
npm run build && VISUAL_TEST_FIXTURE=1 npx next start -p 3100 -H 127.0.0.1
```

## 결정적 fixture

`/visual-fixture/biome?biome=mountain&season=autumn&band=dusk&weather=fog&seed=42&t=1500&load=1&camera=showcase`

- 같은 URL = 같은 픽셀. 엔진은 얼려져(`force.freeze`) rAF 루프를 돌리지 않고, 페이지가 `ready()` → `advance(t)`로 t까지만 시간을 흘린 뒤 `__vicAmbient.settledT`를 적는다.
- `advance(ms, stepMs=1000/60)` = 고정 dt로 step·draw n회. 첫 advance 앞에 dt=0 굽기 ↔ 에셋 안정을 **3회 고정** 반복(타이밍 무관).
- 브라우저 콘솔: `__vicAmbient.advance(250)` · `.time()` · `.forcePointer({x:700,y:600})` · `.forceWorld({band:"night",weather:"rain",biome:"pond",seed:42,freeze:true,pin:true})` · `.pending()` · `.weatherOptions()`.
- `pointer=x,y`로 포인터를 고정하면 생물의 위협 반응을 결정적으로 볼 수 있다(기본 = 화면 밖).

## 명령

| 명령 | 하는 일 |
|---|---|
| `npm run ambient:qa:selftest` | 결정성 셀프테스트(스모크 3: 초원·가을 / 산·가을·안개 / 깊은 바다·밤). ①같은 URL ②advance 동치 ③얼림 ④시간대 ⑤시드 ⑥허용 날씨 ⑦도착 상태 ⑧에러 0 |
| `npm run ambient:qa:capture -- --round 01 --phase before [--smoke\|--only 3,10] [--kinds static,temporal,band,weather] [--seed 42]` | 프레임 캡처 → `.scratch-pw/qa/r01/before/<sid>/` + `index.md` |
| `npm run ambient:qa:sheet -- --round 01 --phase before [--smoke]` | `temporal-sheet.png` · `band-sheet.png` · `weather-sheet.png` · `static-gray.png` |
| `npm run ambient:qa:diff -- --round 01 --phase before [--smoke]` | 시간 시트 인접 프레임 히트맵 `temporal-diff-*.png` + `diff.json`(블록 에너지 = 이음매 힌트) |
| `npm run ambient:qa:diff -- --round 01 --compare before,after` | 전/후 같은 파일끼리 히트맵 + `compare.md` |

시나리오 표: `scenarios.mjs`(프로토콜 §4.2의 16개, 스모크 = 3·10·14). 단위 테스트 `tests/unit/ambient-qa-scenarios.test.ts`가 바이옴 키·허용 날씨를 대조한다.

## 산출물 구조(검사 에이전트가 읽는 형태)

```
.scratch-pw/qa/r01/before/
  index.md                 ← 시나리오 표(조합·시드·프레임 수·정적 링크)
  phase.json
  s03-meadow-autumn-morning-clear/
    index.md               ← 프레임 표(캡션 = 바이옴/계절/띠/날씨/t/해시) + 장면 debug() + 시간 diff 표
    meta.json              ← 프레임마다 url·t·hash·world()·scene() 요약
    static.png             ← t=1500
    temporal-0000.png … temporal-4000.png · temporal-sheet.png · temporal-diff-0250.png … diff.json
    band-dawn.png … band-night.png · band-sheet.png
    weather-clear.png … · weather-sheet.png
    static-gray.png
r01/compare-before-after/<sid>/<file>.png + compare.md
```

프레임은 **캔버스만**(1400×860, DPR 1, 페이지 배경색 위 합성) — 크롬·폰트가 없어 OS와 무관하다.

## 하지 않는 것

- 실제 화면(`/`, `/studio`)의 시드는 그대로 로드마다 다르다(결정성은 fixture 전용).
- 전 조합 캡처(≈1,000)는 하지 않는다 — 전수는 P2 지표(`metrics.mjs`, 미구현), 심화는 16 시나리오.
