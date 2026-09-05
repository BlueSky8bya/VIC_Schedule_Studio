# docs/ambient/ — 계절 배경(바이옴 세계) 규칙 · 검사 체계

> **코딩 에이전트에게**: 계절 배경(`components/shared/ambient/**`)을 만지거나 검사할 때 여기서 시작한다. 전부 읽지 말고
> 아래 표에서 작업 종류를 고른 뒤 그 줄의 문서만 읽는다. 이 폴더는 **현행 규칙**(📖)과 **현재 상태**(🧭)이고, 역사는 ADR-0017·git.

## 작업 종류 → 읽을 문서

| 하려는 일 | 먼저 | 그다음 | 코드 정본 |
|---|---|---|---|
| 배경이 어떻게 그려지는지 파악 | [SYSTEM_MAP](SYSTEM_MAP.md) 📖 | — | `scene-engine.ts` · `world/*` · `scenes/*` |
| 장면 코드 수정(어느 바이옴이든) | [VISUAL_DIRECTION](VISUAL_DIRECTION.md) 📖 | [BIOME_GRAMMAR](BIOME_GRAMMAR.md) 해당 바이옴 절 + [IMMERSION_BREAK_RULES](IMMERSION_BREAK_RULES.md) | `scenes/<biome>.ts`, `art/props.ts`, `world/view.ts` |
| 시간대·날씨·계절 표현 | [SEASON_TIME_WEATHER_GRAMMAR](SEASON_TIME_WEATHER_GRAMMAR.md) 📖 | SYSTEM_MAP §2(지금 어디까지 닿나) | `world/time.ts` · `world/weather.ts` |
| 산·능선·깊이 | [MOUNTAIN_DEPTH_RULES](MOUNTAIN_DEPTH_RULES.md) 📖 | BIOME_GRAMMAR §3 | `scenes/land.ts` mountain |
| 동물·소형 생물 배치·이동 | BIOME_GRAMMAR "공통 생물 규칙" + 해당 바이옴 | IMMERSION_BREAK_RULES §4 | `scenes/autumn.ts` 등, `world/rarity.ts` |
| 몰입 파괴 판정·등급 | [IMMERSION_BREAK_RULES](IMMERSION_BREAK_RULES.md) 📖 | — | — |
| QA 라운드 돌리기 | [VISUAL_QA_PROTOCOL](VISUAL_QA_PROTOCOL.md) 📖 | [QA_PROGRESS](QA_PROGRESS.md) 🧭 · `rounds/` | `.claude/agents/ambient-*.md`, `scripts/ambient-qa/`(계획) |
| 캡처·평가 파이프라인 만들기 | [PLAN-20260905-005](../agent/plans/PLAN-20260905-005-ambient-visual-qa.md) 📋 | VISUAL_QA_PROTOCOL §5 | `app/visual-fixture/*`, `.scratch-pw/snap-biomes.mjs` |
| 아트(PNG) 납품·자리 | [../ux/ambient-art-brief.md](../ux/ambient-art-brief.md) 📖 | `/studio/ambient-art` | `art/manifest.ts` |

## 문서 위계(충돌 시)

`CLAUDE.md`(팔레트·카메라·아트 확정) > VISUAL_DIRECTION > IMMERSION_BREAK_RULES > BIOME_GRAMMAR · SEASON_TIME_WEATHER_GRAMMAR · MOUNTAIN_DEPTH_RULES > VISUAL_QA_PROTOCOL > QA_PROGRESS.
ADR-0017(⑰⑱ 화질 규칙 22개)은 여기 규칙들의 **상위 근거**이며 겹치는 조항은 ADR이 이긴다.

## 세 검사 에이전트(요약)

| 에이전트 | 파일 | 본다 |
|---|---|---|
| A Art Mood Director | `.claude/agents/ambient-art-mood.md` | 감성·반복·형태·튐·리듬·정체성·시간대의 정서 |
| B Spatial Ecology Inspector | `.claude/agents/ambient-spatial-ecology.md` | 간격·배치 논리·접촉·물길·동물 표면/레이어·산 다섯 층 |
| C Season·Weather·Time·Motion Director | `.claude/agents/ambient-motion-director.md` | 시간대 인식·날씨 반응·안개 형태·루프·위상·동물 이동·산 유지 |

라운드 = **동시 검토 → 통합 판단 → 입구 묶음 ≤ 4 수정(P0는 전부) → 전/후 비교**. 직렬 핑퐁 금지 · 귀속 불가능한 수정 금지(프로토콜 §3.3, 2026-09-05 개정).

## 빠른 명령(2026-09-05, PLAN-005 P0·P1 구축 — 상세 [`scripts/ambient-qa/README.md`](../../scripts/ambient-qa/README.md))

```bash
# fixture 서버(프로덕션 빌드, 3100 — dev 서버가 떠 있으면 먼저 내린다)
npm run build && VISUAL_TEST_FIXTURE=1 npx next start -p 3100 -H 127.0.0.1
# 하네스 자체 점검(결정성 23 검사, 스모크 3)
npm run ambient:qa:selftest
# 라운드 캡처 → 시트 → diff
npm run ambient:qa:capture -- --round 01 --phase before        # [--smoke | --only 3,10] [--kinds static,temporal]
npm run ambient:qa:sheet   -- --round 01 --phase before
npm run ambient:qa:diff    -- --round 01 --phase before        # 시간 시트 인접 프레임
npm run ambient:qa:diff    -- --round 01 --compare before,after
npm run ambient:qa:capture -- --round 01 --phase before --only 3,4 --kinds long   # 다람쥐 창(15~30s) — 시간 시트 0~4s엔 없다
node scripts/ambient-qa/spawn-probe.mjs --only 3 --seeds 24                        # A-1 스폰·경로 v 프로브
node scripts/ambient-qa/light-probe.mjs .scratch-pw/qa/rNN/probe                   # T-1·W-1·D-3: 띠별 지면/하늘 L*·해시, 날씨별 해시·입자(라운드 2)
# 결정적 fixture(같은 URL = 같은 픽셀)
/visual-fixture/biome?biome=mountain&season=autumn&band=dusk&weather=fog&seed=42&t=1500
# 편집실 fixture(달력 뒤 실물 — 비결정적, 내비·핫 존 실측용)
/visual-fixture/studio?role=developer&y=2026&m=10&hour=13&weather=fog&biome=mountain · node .scratch-pw/probe-biomes.mjs
```
브라우저 콘솔: `__vicAmbient.world()` · `.scene()` · `.advance(250)` · `.time()` · `.forcePointer({x:700,y:600})` · `.goTo("up")` · `.forceWorld({…})` · `.forceLoad(1)` · `.pending()` · `.weatherOptions()`.
산출물: `.scratch-pw/qa/r<NN>/<phase>/<sid>/index.md`(추적 안 함). baseline = `r00/baseline`(16 시나리오, 2026-09-05).
