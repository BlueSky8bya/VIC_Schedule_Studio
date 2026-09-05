# PLAN-20260905-005 — 앰비언트 비주얼 QA 파이프라인: 결정적 재현 · 캡처 시트 · 전수 지표 · 라운드 러너

Status: **P0·P1 Implemented(2026-09-05) · P2·P3 Proposed** — 구현 기록은 §7 · Task Risk: **L1**(제품 화면 무변경 — fixture·디버그 훅·스크립트만; 장면 시드 주입은 fixture 외 경로에서 기존 동작 유지) · Created: 2026-09-05
선행: [docs/ambient/README.md](../../ambient/README.md) 문서 세트 · ADR-0017 ⑯⑰⑱ · PLAN-20260904-004(바이옴 세계)

> 소유자(2026-09-05): "몰입을 깨는 요소를 체계적으로 찾아내고, 개선하는 평가 시스템과 수정 루프를 프로젝트 안에 구축하라. 같은 장면을 정확히 재현할 수 있어야 하고, 수정 전/후 비교가 되어야 하며, 최소 5라운드를 이어 돌릴 수 있는 구조여야 한다."

## 0. 한 줄

**같은 URL = 같은 픽셀**을 만들고(P0), 그 위에 시트·diff·지표(P1·P2)를 얹어, 세 검사자가 같은 빌드를 보고 메인이 2~3건만 고치는 라운드(P3)를 돌린다.

## 1. 왜 지금 안 되나(진단 요약 — [SYSTEM_MAP](../../ambient/SYSTEM_MAP.md) §3·§1)

- 장면 시드가 `Date.now()`(`scene-engine.ts` L217) → 소품 자리·생물 첫 스폰이 로드마다 다르다. 전/후 비교 불가.
- 애니 시각 `t`가 `performance.now` 기준 → 같은 "1000ms 뒤" 프레임을 두 번 얻을 수 없다.
- fixture에 `seed`·`band`·`season`·`t`·`pointer` 파라미터 없음. 감상 모드 진입은 버튼 클릭 우회.
- 시트·diff·지표 스크립트 없음. `.scratch-pw/snap-biomes.mjs`는 44장 단발.

## 2. 범위(하는 것 / 안 하는 것)

- 한다: 디버그 훅(`__vicAmbient` 확장), `WorldCtx.force` 확장, 감상 전용 fixture 라우트, `scripts/ambient-qa/*`(추적됨), 장면 `debug()`에 생물 위치·`propField` 노출, 라운드 폴더·템플릿.
- 안 한다: 장면 화질 수정(라운드에서), 제품 UI 변화, 실제 사용자 경로의 시드 변경(실제 화면은 지금처럼 매 로드 다른 자리를 유지 — "누가 보든 같은 세계"는 날씨·흔적에만 해당하고 소품 자리는 결정 사항이 아니다. 필요하면 별도 결정).

## 3. 단계

### P0 — 결정성(반나절)

| 항목 | 변경 | 파일 |
|---|---|---|
| 시드 | `WorldCtx.force.seed?: number` → `mountScene`이 있으면 그 값, 없으면 지금처럼 `Date.now()` | `scene-engine.ts` |
| 계절·띠 | fixture `season=` → `ambientForce`, `band=` → `force.band`(엔진에 이미 있음) | `app/visual-fixture/studio/page.tsx` |
| 시각 | `__vicAmbient.freeze()`(루프 정지·`reduced`와 무관) · `advance(ms, stepMs=16.67)`(고정 dt로 step·draw 반복) · `time()`(현재 t) | `scene-engine.ts` |
| 포인터 | `__vicAmbient.forcePointer({x,y,inside}\|null)` — 이동 속도 0 | `scene-engine.ts` |
| 카메라 | fixture `camera=showcase`면 마운트 직후 `enterShowcase()`(버튼 클릭 우회 제거) | fixture page + `showcase.tsx` export |
| 감상 전용 fixture | `/visual-fixture/biome` — 달력 없이 `<AmbientLayer>` + `<ShowcaseExit>`만(핫 존 없음, 크롬 없음). 파라미터: `biome season band weather seed t load pointer camera` | 신설 `app/visual-fixture/biome/page.tsx` + 작은 클라이언트 래퍼 |
| 검증 | 같은 URL 두 번 → 캔버스 `toDataURL` 해시 동일(시나리오 5개). `t=1000`을 두 번 → 동일. `seed` 바꾸면 다름 | `.scratch-pw/probe-determinism.mjs` → 통과 후 `scripts/ambient-qa/selftest.mjs` |

주의: `stillFrame()`(정지 화면)과 `advance()`는 같은 `frame.dt` 조작 경로를 쓴다 — 에셋 지연 로드는 `advance` 전에 `art.version` 안정까지 대기(폴링 ≤ 3s).

### P1 — 캡처·시트·diff(반나절)

```
scripts/ambient-qa/
  scenarios.mjs   대표 16 시나리오(프로토콜 §4.2) + 시트 종류 정의(정적·시간·시간대·날씨·흑백)
  capture.mjs     --round NN --phase before|after [--only 3,10] → .scratch-pw/qa/rNN/<phase>/<#>-<종류>-<k>.png (캔버스만 캡처: canvas.gs-season toDataURL)
  sheet.mjs       같은 시나리오의 프레임을 가로로 합성(라벨 포함) → -sheet.png ; 흑백 변환
  diff.mjs        시간 시트 인접 프레임 절대차 히트맵 + before/after 같은 프레임 diff (sharp)
  README.md       사용법·파일명 규약
```
- 캔버스만 캡처하면 폰트·OS 차이가 없다(비주얼 스위트와 다른 점). 뷰포트 1400×860, DPR 1, `load=1`.
- 의존성: `playwright`·`sharp`(둘 다 이미 devDependency — `ambient-art-normalize.mjs`가 sharp를 쓴다). 새 패키지 없음.

### P2 — 전수 자동 지표(하루)

- `metrics.mjs --matrix full|smoke`: 11×4×6×허용 날씨 조합을 헤드리스 한 페이지에서 `forceWorld`·`goTo`로 순회(재마운트 없이), 각 조합에서 `advance(1500)` 후:
  - 페이지 에러 · 빈 캔버스(알파 합) · `forbiddenCombo`
  - `airWalk`: 장면 `debug()`가 노출할 `creatures: {id, x, y, gait}[]`에서 `gait==="walk" && y < groundY(.12)`
  - `overlapRatio`: `debug().propField`(x,y,r) 쌍 검사
  - `layerDeltaL`: 산·언덕 — 층 경계 y(장면이 `debug().layers`로 노출)의 상하 12px 평균 L
  - `bandDelta`: 같은 조합의 여섯 띠 캡처에서 (지면 영역 평균 L, 하늘 띠 ΔE, 그림자 길이 — 그림자는 장면 `debug().shadowLen`) 채널 수
  - `weatherDelta`: 맑음 대비 7열(장면이 `debug().weatherState`로 반응 열을 자기 신고 + 픽셀 3열)
  - `loopSeam`: 시간 시트 프레임 간 diff의 국소 최대 블록 에너지
  - `phaseSync`: 풀·나무·해파리 등 `debug().oscillators`(위상 배열) 상관
- 출력: `.scratch-pw/qa/rNN/metrics.json` + 실패 조합 표(markdown) — 라운드 입력에 첨부.
- 장면 쪽 변경: 각 `Scene.debug()`에 위 필드 추가(렌더 무영향). 이것만이 장면 코드에 닿는 변경이다.

### P3 — 라운드 러너·기록(반나절)

- `round.mjs --round NN --phase before|after`: 폴더 생성 → capture → sheet → diff → metrics → `docs/ambient/rounds/ROUND-NN.md` 초안(입력 절 채움) 생성.
- `docs/ambient/rounds/ROUND-TEMPLATE.md`(있음) · `rounds/ROUND-NN-reports/{A,B,C}.md`는 메인 세션이 저장.
- 낡은 프로브 정리: `probe-world.mjs`(연대기 참조) 상단에 "폐기 — chronicle 철거" 주석.

## 4. 검증(DoD)

- P0: 결정성 셀프테스트 통과(해시 동일 5/5, seed 변경 시 상이, t 재현). `tsc`·`lint`·`vitest`·`build exit 0`. 실제 화면(`/`·`/studio`) 동작 무변화(시드 경로 기본값 = 옛 동작).
- P1: 시나리오 16 × 시트 5종 생성, diff 히트맵 육안 확인, 한 라운드 캡처 ≤ 6분.
- P2: 스모크 매트릭스(11×4×2띠×2날씨) ≤ 10분, 풀 매트릭스 ≤ 40분(백그라운드). 지표 JSON 스키마 고정.
- P3: 라운드 1을 실제로 한 번 돌려 ROUND-01.md가 프로토콜 §6 형식으로 채워진다.
- 분석 오염 금지: fixture는 `lib/analytics/guard.ts`(HeadlessChrome·localhost) 뒤에 있다 — 새 스크립트도 헤드리스로만.

## 5. 롤백

- 훅·파라미터는 기본값이 옛 동작이라 제거 = 삭제. `scripts/ambient-qa/`·`docs/ambient/rounds/`는 독립 폴더.

## 6. 규모·순서

P0 → P1 → (라운드 1 착수 가능) → P2 → P3. P2·P3는 라운드와 병행 가능. 총 2일. 라운드 1의 첫 수정 후보는 [QA_PROGRESS §2](../../ambient/QA_PROGRESS.md#2-백로그진단에서-나온-것--라운드-0-코드-미수정) 우선순위 ①(AMB-A1-01 다람쥐 스폰 — 작고 P0)이다.

## 7. 구현 기록 — P0·P1(2026-09-05)

계획과 다른 점(전부 의도된 단순화):

| 계획 | 실제 | 왜 |
|---|---|---|
| `freeze()`·`advance()`를 스크립트가 부른다 | **fixture 페이지가** `ready()` → `advance(t)` → `settledT`까지 스스로 한다. 스크립트는 `settledT`만 기다린다 | 사람이 URL을 열어도 같은 정지 프레임을 본다("같은 URL = 같은 픽셀"이 브라우저에서도 성립) |
| 에셋 지연을 `ready()`로만 흡수 | 첫 `advance` 앞에 **dt=0 굽기 ↔ 로드 안정을 3회 고정** 반복(`WARMUP_STEPS`) | 에셋은 첫 step에서 요청되므로 ready만으론 이르다. 횟수를 타이밍에 맡기면 rand() 소비가 달라져 결정성이 깨진다 |
| `sharp`로 시트·diff 합성 | **브라우저 캔버스**(Playwright about:blank)에서 합성·픽셀 비교 | sharp는 package.json 의존성이 아니라 next의 부수 설치물 — 사라질 수 있다. 추가 의존성 0 |
| 시간대·날씨 시트는 한 페이지에서 `forceWorld` | **URL마다 새 페이지**(`band=`·`weather=`, t=1500) | 순수 URL 결정성. 교차 검사에서 static = band(자기 띠) = weather(자기 날씨) 해시가 16/16 같음 |
| `camera` 파라미터로 감상 진입 | `camera=showcase`(기본, 내비 오버레이 포함) / `plain`. 세계 장면엔 `pin` 옵션 — 감상 속성 없이도 시작 바이옴 유지 | 감상 속성이 React 효과 뒤에 붙어 첫 step이 초원으로 스냅하던 순서 문제 회피 |
| `probe-world.mjs` 폐기 표시 | 안 함 — `.scratch-pw`는 미추적 | 저장소에 없는 파일 |

검증·baseline·하네스 관찰은 [QA_PROGRESS §1.5](../../ambient/QA_PROGRESS.md#15-qa-harness-구축-완료--round-0-2026-09-05). 도구 사용법은 [`scripts/ambient-qa/README.md`](../../../scripts/ambient-qa/README.md).
