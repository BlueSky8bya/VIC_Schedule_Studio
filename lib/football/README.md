# lib/football — 헤드리스 축구 엔진 + RL scaffold

별도 강화학습(RL) 프로젝트의 **시작 베이스**로 쓰라고 분리해 둔 폴더. 이 README가 진입점이다.

## 한 줄

DOM·프레임워크 0, **결정적**(seed→동일 trajectory), 순수 TypeScript 축구 시뮬레이션 코어 +
멀티에이전트 RL 환경(PettingZoo Parallel 형태) scaffold.

## 핵심 불변식 (RL 재현성의 생명)

- **결정성**: 같은 `(seed, scenario)` + 같은 action 시퀀스 → 완전히 동일한 trajectory. (`core/rng.ts`의
  시드 RNG만 사용. 생성·물리에 `Math.random()` 안 씀.) → `tests/unit/football/engine-determinism.test.ts`.
- **DOM 0**: react·next·window·document·navigator 참조 없음. node/python 브릿지에 그대로 얹힘.
- **self-contained**: import는 전부 `@/lib/football/*` 내부. 외부 의존 없음.
- 좌표계: 미터, 중앙 원점, x∈[-52.5,52.5]·y∈[-34,34] (`core/pitch.ts`).

> 참고: `@/` 는 이 repo의 tsconfig path 별칭(`@/* → ./*`). **읽기 참조**면 무시해도 되고, 다른 repo로
> 복사해 빌드하려면 새 tsconfig `paths`에 `@/*`를 잡거나 상대경로로 치환하면 끝(그 외 수정 불필요).

## 디렉터리 맵

| 폴더 | 내용 |
|---|---|
| `core/` | `types.ts`(도메인 타입)·`pitch.ts`(치수·경계·박스·골라인)·`rng.ts`(결정적 RNG)·`actions.ts`(액션 택소노미)·`game-state.ts`·`event-log.ts` |
| `rules/` | `goals.ts`·`offside.ts`·`fouls.ts`·`restarts.ts`·`goalkeeper.ts`·`in-out.ts` (룰 판정, 순수 함수) |
| `tactics/` | `formations.ts`·`profiles.ts`(전술 스타일·선수 페르소나 생성)·`anchors.ts`(동적 포지셔닝 기준) |
| `analytics/` | `xg-lite.ts`(슈팅 xG)·`xt-grid.ts`(xT 전진가치)·`pitch-control-lite.ts`(패스 성공률)·`pressing.ts`·`shape.ts` — **보상 재료** |
| `rl/` | RL 환경 본체(아래) |

## RL 환경 API (`rl/`)

```ts
import { FootballEnv } from "@/lib/football/rl/env";

const env = new FootballEnv({ decisionHz: 10 });   // 결정 빈도(Hz)
env.reset(seed, "5v5");                              // EnvState
const obs = env.observe(agentIndex);                // PlayerObservation (egocentric, attack-centric)
const mask = env.actionMask(agentIndex);            // ActionMask
const { state, done, events } = env.step(jointAction); // JointAction = AgentAction[]
```

- **`env.ts`** — `FootballEnv`: `reset(seed,scenarioId)` / `step(JointAction)` / `observe(i)` / `actionMask(i)`,
  getter `current`·`bases`. `EnvState`·`EnvPlayer`·`StepResult`.
- **`types.ts`** — `ActionType`(13개: idle·move·support·press·cover·mark·carry·pass·shoot·clear·tackle·gkClaim·gkRelease),
  `AgentAction{type,target?,power?,height?,sprint?}`, `JointAction`, `ActionMask`, `PlayerObservation`(self/ball/teammates/opponents+mask),
  `EntityState`, `StepEvent`(goal·out·kickoff·turnover·shot·tackle).
- **`observation.ts`** — 좌표 정규화: `toAttackCentric`(공격 항상 +x), `toEgo`(자기 기준), `relativeEntity`,
  `sortByDistance`, `normalizeObservationOrder`.
- **`action-mask.ts`** — `computeActionMask(...)`: 룰상 불가능한 행동을 끈다(공 없으면 pass/shoot off, GK 박스 밖 손 off 등).
- **`reward.ts`** — `RewardBreakdown`(9항목: tacticFidelity·score·progression·chanceQuality·possessionValue·
  defensiveValue·ruleCompliance·roleFidelity·viewerQuality), `REWARD_WEIGHTS`, `weightedReward`, `addBreakdown`.
- **`scenarios.ts`** — `SCENARIOS`·`ScenarioId`(5v5 등, teamSizes·withKeepers·ballStart·durationSec).
- **`scripted-policy.ts`** — `scriptedJointAction(...)`: 규칙기반 베이스라인/상대(셀프플레이·평가 기준선).

## 이미 된 것 ✅ vs RL 프로젝트에서 채울 것 ❌

**된 것**: 결정적 env(reset/step/observe/actionMask)·관측 정규화·행동공간+마스크·시나리오·스크립티드 정책·
analytics(보상 재료)·룰/택소노미·테스트 136케이스(`tests/unit/football/`).

**RL 쪽에서 채울 것**:
1. **보상 계산** — `reward.ts`는 가중합 **셸**만. `EnvState`→`RewardBreakdown` 산출 글루를 analytics(xT·xG·
   pitch-control·pressing)로 채우고 `step()`이 per-agent reward를 내보내게.
2. **관측 인코더** — 가변 길이 teammates/opponents → 고정 크기 `Float32Array`(시나리오 max로 패딩 + 마스크 채널).
3. **액션 코덱** — 정책망 출력(ACTION_TYPES logits + 연속 파라미터) ↔ `AgentAction`, 마스크 샘플링.
4. **트레이너 + 런타임** — PPO 등. TS엔 ML 런타임 없음 → **Python 브릿지**(env가 PettingZoo Parallel 형태라
   자연스러움; SB3/RLlib/CleanRL) 또는 tfjs.
5. (선택) 벡터화 env·정확한 세트피스 배치(현재 골/아웃은 공만 중앙 리셋, 스로인/코너/골킥 배치는 skeleton)·
   정밀 물리(현재 점질량, 공중볼/충돌 없음 — RL 부트스트랩엔 표준).

## 테스트

`tests/unit/football/` (vitest) — determinism·rules(offside·fouls·restarts·goalkeeper·in-out·goals)·
analytics·rl-env·formations-tactics·persona-attributes·actions-taxonomy·anchors-scripted. 베이스가 맞다는 보증.

## 관련 문서

- 설계/벤치마크 계획: `docs/football-rl-training-benchmark-report.ko.md`.
- 화면용 렌더러(`components/seasonal/worldcup-ball-goal.tsx`)는 **이 엔진과 별개**의 시각 토이다(자체 물리 루프,
  analytics만 빌려 씀). RL은 이 `lib/football/` 헤드리스 엔진에서 한다.
