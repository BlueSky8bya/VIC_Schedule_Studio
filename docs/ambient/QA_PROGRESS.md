# 앰비언트 QA 진행 상태 · 백로그 · TODO

> 현재 시제. 라운드가 끝날 때마다 갱신한다. 절차는 [VISUAL_QA_PROTOCOL](VISUAL_QA_PROTOCOL.md), 판정 기준은 [IMMERSION_BREAK_RULES](IMMERSION_BREAK_RULES.md).

Last Updated: 2026-09-05 · 라운드: **1 완료**([rounds/ROUND-01.md](rounds/ROUND-01.md) — 다람쥐 스폰 P0 · 산 다섯 층 · 잠긴 돌) · 다음: **라운드 2**(§6)

## 1. 상태

| 항목 | 상태 |
|---|---|
| 문서 세트(방향·문법 3·판정·프로토콜·시스템 지도) | ✅ 2026-09-05 작성 |
| 검사 에이전트 3종(`.claude/agents/ambient-*.md`) | ✅ 정의 |
| 결정적 진입점(seed·band·season·weather·t·load·pointer·camera) | ✅ **구축**(P0, 2026-09-05) — `/visual-fixture/biome`, `__vicAmbient.freeze/advance/time/forcePointer/pending/ready/weatherOptions`, 셀프테스트 23/23 |
| 캡처·시트·diff 스크립트(`scripts/ambient-qa/`) | ✅ **구축**(P1) — `capture` · `sheet` · `diff` · `selftest`, 브라우저 캔버스 합성(추가 의존성 0) |
| 전수 자동 지표(`metrics.mjs`) | ⏳ 미구축 — P2 |
| 라운드 러너(`round.mjs`) | ⏳ 미구축 — P3(기록 형식은 프로토콜 §6·`rounds/ROUND-TEMPLATE.md`에 확정, 캡처 → 시트 → diff 세 명령으로 수동 실행 가능) |
| baseline | ✅ `.scratch-pw/qa/r00/baseline/`(16 시나리오 · 433 PNG · 64 시트 · 80 diff · 512MB · 192s, 빌드 `f5a3767`+하네스 변경) |
| 기존 자산 | `.scratch-pw/snap-biomes.mjs`(44장, 비결정적 — 대체됨) · `probe-biomes.mjs`(내비 실측) · `probe-squirrel.mjs` · `perf-frames.mjs` |

## 1.5 QA Harness 구축 완료 / Round 0 (2026-09-05)

**구현(PLAN-005 P0·P1)**

| 층 | 무엇 | 어디 |
|---|---|---|
| 엔진 | `WorldCtx.force.{seed, freeze, load, pointer, pin}` · `__vicAmbient.{seed, frozen, freeze, advance(ms, stepMs), time, forcePointer, pending, ready, weatherOptions, settledT}` · 얼린 상태에선 `sync()`가 루프를 절대 돌리지 않음 · 첫 `advance` 앞 dt=0 굽기 ↔ 에셋 안정 **3회 고정** 반복 | `scene-engine.ts` |
| 로드 신호 | 진행 중 에셋 로드 수(아트 PNG·Noto·SVG) | `loading.ts`, `art/load.ts`, `assets.ts` |
| 세계 | `createWorld(season, biome, { pin })` — 감상 속성 없이도 시작 바이옴 유지(fixture만) | `world/world-scene.ts`, `season-canvas.tsx` |
| fixture | `/visual-fixture/biome?biome&season&band&weather&seed&t&load&pointer&camera&y`(VISUAL_TEST_FIXTURE=1) — 페이지가 `ready()` → `advance(t)` → `settledT` | `app/visual-fixture/biome/page.tsx`, `biome-fixture.tsx` |
| 도구 | `scenarios.mjs`(16 + 스모크 3) · `lib.mjs` · `capture.mjs` · `sheet.mjs` · `diff.mjs` · `selftest.mjs` · npm `ambient:qa:*` | `scripts/ambient-qa/` |
| 테스트 | 시나리오 표 ↔ 엔진 키·허용 날씨·fixture 달 표 대조 | `tests/unit/ambient-qa-scenarios.test.ts` |

**검증**

- 게이트: `tsc` 0 · `lint` 0(max-warnings 0) · `vitest` 564/564(55 파일) · `build` exit 0.
- 셀프테스트(스모크 3: s03 초원·가을·아침 / s10 산·가을·노을·안개 / s14 깊은 바다·여름·밤·흐림) **23/23 PASS**: ① 같은 URL → 같은 해시 ② `advance(1000)` = `advance(250)`×4 = URL `t=1000` ③ 얼림(실시간 700ms 뒤 t·픽셀 불변, running false) ④ 시간대 바꾸면 `world().band`·픽셀 변화 ⑤ 시드 42→7 픽셀 변화 ⑥ 허용 날씨(가을·여름에 snow 없음) ⑦ 도착 상태(pending 0·frozen·settledT 1.5·frames 90) ⑧ 페이지 에러 0(아트 404 폴백은 제외).
- 교차 검사(16/16): `static.png` = `band-<자기 띠>.png` = `weather-<자기 날씨>.png`(URL 경로가 달라도 같은 픽셀). 시트 3종 + 흑백 육안 확인(라벨·격자·캡션 OK), diff 히트맵 육안 확인(깊은 바다 해파리·빛줄기·바다눈만 노랑/빨강).
- 산출물 형식: 시나리오 폴더마다 `index.md`(캡션 = 바이옴/계절/띠/날씨/t/해시 + 장면 `debug()` + 시간 diff 표) — 검사 에이전트가 Read로 바로 읽는다.

**하네스가 이미 드러낸 것**(라운드 0 관찰 — 수정은 라운드 1부터, 백로그 근거로 승격)

| 관찰 | 해당 백로그 | 근거 |
|---|---|---|
| `weather-clear` = `weather-cloud` 해시 동일 **16/16** | AMB-W1-01(흐림 반응 0) | baseline meta.json |
| `band-morning` = `band-noon` 해시 동일 **9/16**(초원 4·산 3·민물·깊은 바다) — 다른 7은 나무 그림자 ±8px·조석만 다름 | AMB-T1-01 | 〃 |
| 시간 시트 인접 프레임 변화 **0.00%** — 숲 2·산 3·언덕 1(7/16 완전 정적) | AMB-M3-01 | diff.json |
| 초원 여름(s16) 4초 변화 10.5% vs 갯벌 3.4% vs 민물 0.16% — 장면별 움직임 편차 | (참고) | 〃 |

## 2. 백로그(진단에서 나온 것 — 라운드 0, 코드 미수정)

## 2. 백로그(진단에서 나온 것 — 라운드 0, 코드 미수정)

ID = `AMB-<범주>-<번호>`. 등급은 IMMERSION_BREAK_RULES 기준, 신뢰도는 코드 경로 확인 = 높음.

| ID | 코드 | 등급 | 어디 | 무엇 | 근거(SYSTEM_MAP) | 상태 |
|---|---|---|---|---|---|---|
| AMB-A1-01 | A-1 | **P0** | 초원·가을 | 다람쥐 출발 y = `groundY(rand())` → v≈0(지평선 띠)에서 걷는다. 회오리 `gy()−80`(하늘) 출발. **+ 묻을 자리 `pickCacheSpot` y = 40+rand·(h−80)이 하늘까지**(라운드 1 프로브가 잡은 진짜 경로 원인) | §5 | **닫힘**(라운드 1: 출발·목표 도토리·묻을 자리·회오리 전부 v ≥ .18. 프로브 24시드×2띠 최소 경로 v .201) |
| AMB-A1-02 | A-1 | P3 | 초원·봄 | ~~나비 `gy()−30`·벌 `groundY(rand())`~~ — 나는 종은 위 출입 허용(규칙). **무당벌레(걷는 종) 위 출입은 라운드 1에서 닫힘**. 벌의 v≈0 비행만 취향 항목으로 남김 | §5 | 무당벌레 닫힘 · 벌 P3 보류 |
| AMB-E1-01 | E-1 | **P0**(평가 인프라) | 엔진 | 장면 시드 `Date.now()` — 전/후 비교 불가 | §3 | **닫힘**(2026-09-05, P0: `force.seed` — fixture만; 실제 화면은 로드마다 다른 자리 유지) |
| AMB-D2-01 | D-2 | P1 | 산 | 뒤 봉우리 α .5 반투명 + land 지평선 프로파일 → 봉우리 속 언덕 줄, 능선선 없음, 발이 투명으로 녹음, **w/7 등간격 구곡 기둥 14개**(라운드 1 A·B 신규) | §4 | **대부분 닫힘**(라운드 1: 지평선 profile "mountain"·능선선·구곡 제거·발치 땅색 맞물림·팔레트·능선면 나무 제외·설선 그늘. 실측 하늘↔①·①↔② 3/3 ≥ 4/8 충족) — **남은 것 → AMB-D2-03** |
| AMB-D2-03 | D-2 | P2 | 산 | ②(앞 봉우리)↔③(자락) 단차: 가을 4.3L · 겨울 5.3L(기준 8; 라운드 1 전 1.8/0.6). 발치가 땅색으로 맞물려 경계가 없다 — 애추 띠·발치 그늘 등 **구조적 경계**가 필요(팔레트만으론 하늘↔①↔② 간격과 충돌) | ROUND-01 §검증 | 열림 |
| AMB-D2-02 | D-2·S-2 | P1 | 언덕 | 띠 3겹 경계 ΔL 3~5(기준 8), 세 띠가 같은 파장·진폭(합동 곡선), 나무·노두가 ridge(x)와 무관한 v 범위에 배치(사면 위 80px 어긋남), 노두 크기 위계 없음 | ROUND-01 B#2 | 열림 |
| AMB-S5-01 | S-5·F-1 | P1 | 갯벌 | 물골 = 직선 현 + 단일 사인 + 등폭 리본 4겹, 합류 접선 없음. **+ 1.04 stroke가 물 위를 가로지름(와이어프레임), 3차 지류 끝 갈고리, 본류 (600,470) 꺾임, 남색 리본 ΔL**(라운드 1 A#3·B#4) | §7 | 열림 — **라운드 2 첫 후보** |
| AMB-S4-01 | S-4 | P1 | 민물 | 잠긴 바위 = clip + 흰 링(물색·젖은 띠 없음) | §6 | **닫힘**(라운드 1: `drawSubmerged` — 물색 사본·깊이 페이드·젖은 띠) |
| AMB-S4-02 | S-4 | P1 | 계곡 | 물 안 바위가 통째로 물 위에 얹힘(clip도 없음) | §6 | **닫힘**(라운드 1: `drawSubmerged` 10k) |
| AMB-S4-03 | S-4·S-2 | P1 | 암석해안 | 시스택 5개가 젖은 띠 그라데이션 아래 α≈.25 유령 + 발치 흰 호만 또렷, 파도선에 닿는 바위 0(바위와 바다가 접촉하지 않음). 민물 물풀 섬은 기슭·수면선 없는 어두운 얼룩 | ROUND-01 B#5 | 열림 |
| AMB-F1-01 | F-1·S-3 | P1 | 암석해안 | 전폭 평행 물결 명암 띠 4~5줄(단차 ①), 조류대 하드 에지 + 윗변 1px 흰 선, 프레임 최암부 검은 얼룩(웅덩이/해조) | ROUND-01 A#3 | 열림 |
| AMB-M2-02 | M-2·S-4 | P2 | 해안 3 | 뭍 판(바위·웅덩이·검불 전부)이 물가 숨쉬기와 함께 ±3px 오르내림(`coast.ts` L938 `sy`를 L985 뭍 drawImage 목적지에 그대로 씀) + 띠 전환 시 조석 17px 점프(보간 없음) | ROUND-01 C#5 | 열림 — 두 줄 수정(작음) |
| AMB-F2-01 | F-2·F-1 | P2 | 초원·갯벌·숲 | 픽셀 땅 위 radial softBlob 얼룩(60~130px, 에지 없음)이 렌즈 먼지·검은 연기로 읽힘 — 저해상 계단 얼룩 패스로 | ROUND-01 A#5 | 열림 |
| AMB-S1-01 | S-1 | P1 | 숲 | 나무 64~88그루, `claimSpot` 미경유 → 수관 겹침 | §1 배치 행 | 열림 |
| AMB-S1-02 | S-1 | P2 | 전 육지 | 관계별 최소 거리 표가 코드에 없음(`world/spacing.ts` 신설) | 공통 간격 | 열림 |
| AMB-W1-01 | W-1 | P1 | 전부 | 흐림(cloud) 반응 0 — 맑음과 같은 그림(해시 동일 16/16) | §2.2 · ROUND-01 C#2 | 열림 |
| AMB-W1-02 | W-1 | P1 | 육지 4·해안 3·바다 2 | 비·바람·안개·눈 반응 0(초원·민물 일부만 반응). 가장 심한 순: 산·겨울·눈(눈송이 0) → 숲·암석·바람(정지, 물보라 0) → 계곡·민물·안개(맑음과 동일) → 갯벌·흐림 | §2.2 · ROUND-01 C#2 | 열림 |
| AMB-D3-01 | D-3 | P1 | 전부 | 안개(fog)가 깊이 감쇠가 아니다(가을 초원 서리 안개만); 엔진 `drawDepthHaze` 단일 선형 그라데이션, 층별 누적·지면 안개 띠·시간대 배율 없음 | §2.2 | 열림 |
| AMB-T1-01 | T-1 | P1 | 전부 | 시간대 = 단색 틴트 한 겹(아침=점심), 그림자 길이·하늘·반사·원경 채널 없음. 실측(초원 여름 지면 L*) 점심 대비 새벽 −0.6 · 노을 −0.6 · 저녁 −2.1 · 밤 −7.2(목표 −6/−3/−9/−16); 산 새벽·노을 지면이 점심보다 **밝음**(역전); 민물 새벽 글린트 14; 깊은 바다 밤 빛줄기 그대로 | §2.1 · ROUND-01 C#3 | 열림 |
| AMB-M3-01 | M-3 | P1 | 숲·언덕·계곡·산·해안 | 나무·억새·갈대·사구 풀이 바람에도 정적 — 시간 시트 0.00% 6장면(s01 s02 s09 s10 s11 s15), 바람 시나리오 s02·s15 포함 | §8 · ROUND-01 C#4 | 열림 |
| AMB-M3-02 | M-3 | P2 | 초원 | 풀 띠 진행파가 봄에만(사철로) | §8 | 열림 |
| AMB-M2-01 | M-2 | P2 | 먼바다 | 표류물 `u%1` 랩 시 화면 안 x 점프 가능 | §8 | 열림(재현 필요) |
| AMB-R1-01 | R-1 | P2 | 언덕 | 언덕 띠 3겹이 같은 두 사인(파장·위상만 다름) — 평행 곡선 인상 | BIOME_GRAMMAR §4 | 열림(캡처 확인) |
| AMB-S3-01 | S-3·F-1 | P2 | 전 육지(산 제외) | 지평선 "먼 숲" = 같은 크기 정원+막대(롤리팝) 20여 개가 한 기준선에 — 육지 6 프레임·밴드 12칸 전부(`view.ts bakeHorizon` L160~183). 산은 라운드 1에서 제외됨 | ROUND-01 A#4 | 열림(P3 → P2 승격) |

**라운드 1 결과(2026-09-05)**: ① AMB-A1-01 닫힘 ② AMB-D2-01 대부분 닫힘(잔여 → D2-03) ③ AMB-S4-01/02 닫힘. 상세 [rounds/ROUND-01.md](rounds/ROUND-01.md).
**우선순위(라운드 2~)**: ① AMB-S5-01 갯골(+F1-01 암석 기하, 소유자 §15 1순위) → ② AMB-D2-02 언덕 띠·배치 → ③ AMB-M2-02 해안 판(두 줄) → ④ AMB-S4-03 암석해안 접촉 → ⑤ AMB-D3-01 안개 · AMB-T1-01 시간대(같은 입구: `time.ts` 프로파일 + `bakeHorizon`) → ⑥ AMB-W1-01/02 날씨 → ⑦ AMB-M3-01 바람 → ⑧ AMB-S3-01·F2-01 형태 → AMB-S1-01은 열린 결정(나무 수) 뒤에.

## 3. 파이프라인 TODO(PLAN-005 요약 — 상세는 계획서)

- [x] P0 결정성(2026-09-05): `force.seed`·`band`·`season`·`weather`·`t`·`load`·`pointer` URL, `__vicAmbient.freeze/advance/forcePointer/ready`, `/visual-fixture/biome`, 셀프테스트 23/23
- [x] P1 캡처(2026-09-05): `capture.mjs`(16 × 정적·시간 6·시간대 6·날씨 n) · `sheet.mjs`(시간·시간대·날씨·흑백) · `diff.mjs`(인접 프레임 히트맵 + 전/후 비교) — sharp 대신 브라우저 캔버스 합성
- [ ] P2 전수 지표: `metrics.mjs`(조합 매트릭스 · 페이지 에러 · airWalk · overlapRatio · layerDeltaL · bandDelta · weatherDelta · loopSeam · forbiddenCombo) + 장면 `debug()`에 생물 위치·propField 노출
- [ ] P3 라운드 러너: `round.mjs --round NN --phase before|after`(캡처 → 시트 → diff → ROUND-NN.md 초안 한 번에). 지금은 세 명령 수동
- [ ] 낡은 프로브 정리: `probe-world.mjs`(연대기 참조) 폐기 표시(`.scratch-pw`, 미추적)

## 4. 라운드 기록

| 라운드 | 날짜 | 주제 | 선택 | 결과 |
|---|---|---|---|---|
| 0 | 2026-09-05 | 구조 진단 · 규칙 문서화 · 에이전트 설계 · 파이프라인 계획 | (수정 없음) | 백로그 18건 등재 |
| 0-H | 2026-09-05 | **QA Harness 구축**(PLAN-005 P0·P1) · 스모크 검증 · baseline 캡처 | (비주얼 수정 없음) | 셀프테스트 23/23 · baseline `r00/baseline` 16 시나리오 433 PNG · 하네스 관찰 4건(§1.5) |
| **1** | 2026-09-05 | 첫 검사 라운드 — A·B·C 동시(발견 15건 → 병합 12) · 통합 ≤3 | ① AMB-A1-01 다람쥐·회오리·무당벌레·묻을 자리 v ≥ .18 ② AMB-D2-01 산 다섯 층 ③ AMB-S4-01/02 잠긴 돌 `drawSubmerged` | ① 충족(프로브 48회 위반 0) ② 하늘↔①·①↔② 충족, ②↔③ 부분(→ D2-03) ③ 충족(크롭). 회귀: 손대지 않은 9 시나리오 해시 동일. [ROUND-01.md](rounds/ROUND-01.md) |

## 5. 열린 결정(소유자)

- **겨울 산의 앞 봉우리(②)를 눈밭(③)보다 어둡게** — 라운드 1에서 ②를 `#b2c0cf`로 내렸다(눈밭 83.9L vs ② 78.6L). "먼 것은 밝다"의 예외(눈 알베도)로 규칙에 적었다(MOUNTAIN_DEPTH_RULES §4 눈 행). 시트 `r01/after/s09-…/static.png`를 보고 확정.
- 라운드 1에서 **뒤 봉우리 α .5는 그대로** 두었다(비칠 것이 없어졌으니 문제 소멸) — 불투명화 여부는 여전히 열림.
- 노을의 "따뜻함"을 어디까지 — 오행 규칙(주황 금지)과 "따뜻한 색감·방향성 있는 빛" 사이의 경계는 [SEASON_TIME_WEATHER_GRAMMAR §2.2](SEASON_TIME_WEATHER_GRAMMAR.md#22-시간대별-주의사용자-지시-원문-반영)대로 **채도 ≤ .3의 회장미·살구 + 긴 그림자/림 하이라이트**로 잡았다. 실제 시트를 보고 확정.
- 숲 나무 수를 64~88 → 34~48로 줄이는 것(간격 규칙의 결과) — 빽빽함이 줄어드는 대신 겹침이 사라진다. 시트로 확인 후 결정.
- 산의 원경 능선을 불투명으로 바꾸면 "먼 봉우리가 옅다"는 라운드2 규칙과 **색**으로만 양립(밝고 회색) — 확인 필요.

## 6. 다음 세션 진입

`docs/ambient/README.md` → 이 문서 §2 우선순위 → [rounds/ROUND-01.md](rounds/ROUND-01.md) "다음 라운드 후보" → **라운드 2**(프로토콜 §7):
라운드 1 커밋 뒤 서버 기동 → `npm run ambient:qa:capture -- --round 02 --phase before` **+ `--only 3,4 --kinds long`**(다람쥐는 16~24s에 나온다 — 시간 시트 0~4s엔 없다)
→ 시트·diff → 세 에이전트 동시 → 통합 ≤3(첫 후보 AMB-S5-01 갯골) → 수정 → 게이트 → `--phase after` → `--compare before,after` → `rounds/ROUND-02.md`.
프로브: `node scripts/ambient-qa/spawn-probe.mjs --only 3 --seeds 24`(A-1 회귀 감시 — 최소 경로 v ≥ .18 유지).
