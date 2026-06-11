# 축구 멀티 에이전트 강화학습 벤치마킹·학습 전략 보고서

작성: 2026-06-11 KST  
대상: `lib/football/**` 축구 엔진, `docs/football-knowledge-inventory.ko.md` 지식 인벤토리, `components/seasonal/worldcup-ball-goal.tsx` 시청용 렌더러  
목표: 전술별로 실제 축구처럼 움직이고, 이기려 하며, 프레임마다 좋은 해답을 찾고, 선수 개인성이 보이는 시청용 11v11 축구 AI를 단계적으로 학습.

## 1. 결론

바로 11v11 self-play를 돌리면 실패 확률이 높다. 축구는 sparse reward, 부분관측, 22명 동시 행동, 긴 credit assignment, 룰 예외, 전술 다양성 때문에 무작정 MAPPO/PPO를 붙이면 "이기긴 하는데 축구처럼 안 보이는" 정책이 나온다.

추천 파이프라인:

1. **룰 엔진 고정**: IFAB 룰, 세트피스, 오프사이드, 파울, 골키퍼를 deterministic하게 만든다.
2. **전술/포메이션 메타데이터 확장**: 현재 `STYLES` 20종과 `FORMATIONS` 13종을 reward/eval 조건으로 쓴다.
3. **scripted baseline**: 규칙 기반 축구 AI를 먼저 만든다. RL은 이 baseline을 이기고, 닮고, 변주한다.
4. **Football Academy식 커리큘럼**: 1v0, 2v1, build-up, pressing, throw-in, corner, offside timing부터 학습.
5. **PettingZoo Parallel API 호환**: 동시 행동 멀티 에이전트 표준 API로 감싼다.
6. **IPPO/MAPPO baseline**: GRF 연구처럼 먼저 PPO 계열로 기준선을 만든다.
7. **population self-play**: 전술별 population을 만들고 리그식 self-play로 counter-strategy를 학습한다.
8. **tacticFidelity 우선 reward**: 전술 충실도를 `score`보다 크게 둔다.
9. **시청용 distillation**: 학습 policy를 브라우저에서 가볍게 실행 가능한 policy/script hybrid로 압축한다.

## 2. 벤치마크에서 배울 점

### 2.1 Google Research Football

배울 점:

- GRF는 full-game scenario만 던지지 않고 Football Academy라는 작은 scenario들을 제공한다.
- 기본 reward도 `SCORING`과 `CHECKPOINT`를 나눈다. 즉, 골만 보상하면 학습이 너무 느리니 중간 진척 보상이 필요하다.
- football rules, physics-like engine, multi-agent experiments를 모두 지원한다.

우리 적용:

- `score`만 주지 말고 `checkpoint/progression/xT/EPV/tacticFidelity`를 둔다.
- full match 전에 scenario curriculum을 만든다.
- replay와 event log를 표준화한다.

### 2.2 GRF MARL / Light-MALib / population self-play

배울 점:

- 11v11 full game은 일반 single policy보다 population-based self-play가 유리하다.
- 연구는 IPPO로도 강한 baseline을 만들고, 다양한 pre-trained policy를 population에 넣는다.
- 축구는 stochasticity, player role credit assignment, 협력/경쟁 search space 폭발이 핵심 난점이다.

우리 적용:

- 전술별 population: 티키타카 population, 하이프레스 population, 로우블록 population 등.
- exploit agent: 특정 전술 약점을 찌르는 상대를 따로 둔다.
- frozen opponent archive: 과거 버전에게 계속 이기게 한다.
- 평가: 단일 상대 승률이 아니라 style pool 전체 Elo.

### 2.3 PettingZoo Parallel API

배울 점:

- 축구는 22명 동시 행동이라 Parallel API가 자연스럽다.
- 각 agent가 다른 observation/action space를 가질 수 있다.
- Python MARL 라이브러리와 연결 쉬움.

우리 적용:

```ts
// TS engine side
reset(seed, scenario): GameState
step(jointActions): StepResult
observe(playerId): PlayerObservation
actionMask(playerId): ActionMask
```

Python wrapper:

```py
obs, infos = env.reset(seed=seed)
obs, rewards, terminations, truncations, infos = env.step(actions)
```

### 2.4 MAPPO / IPPO

배울 점:

- MAPPO 논문은 PPO 계열이 MPE, SMAC, Hanabi, GRF에서 강한 baseline이 될 수 있음을 보인다.
- IPPO는 구현이 단순하고 분산하기 좋다.
- MAPPO는 centralized critic으로 global state를 보며, execution은 local observation으로 한다.

우리 적용:

- Phase 1 baseline: IPPO.
- Phase 2 baseline: MAPPO with centralized critic.
- shared policy + role embedding으로 시작한다.
- 이후 role-specific head 또는 tactic-conditioned policy로 확장.

### 2.5 QMIX / VDN

배울 점:

- value decomposition은 cooperative team reward를 agent별 value로 분해한다.
- 축구처럼 팀 보상이 큰 환경에서 credit assignment에 도움.

우리 적용:

- continuous/parameterized action이 많으면 PPO 계열이 먼저.
- discrete high-level action curriculum에서는 QMIX/VDN 비교 가능.
- 예: 5v5 pressing trap, set-piece marking, 3v2 counter.

### 2.6 AlphaStar식 league training

배울 점:

- imitation + RL + league self-play.
- main agent, exploiter, historical agent pool을 둬 strategy collapse를 막는다.

우리 적용:

- scripted tactic AI를 imitation source로 사용.
- main population은 "잘하고 전술 지키는 팀".
- exploiter population은 "특정 전술 카운터".
- historical archive는 "과거 policy를 계속 이기게 하는 기억".

### 2.7 TacticAI / TacticGen

배울 점:

- 세트피스는 출발 상태가 고정되어 AI가 개입하기 좋은 영역이다.
- TacticAI는 코너킥에서 receiver, shot attempt, player position adjustment를 예측/생성한다.
- 최신 tactic generation 연구는 multi-agent trajectory를 조건부 생성한다.

우리 적용:

- 코너킥/프리킥/스로인/골킥은 full match보다 먼저 학습한다.
- set-piece는 graph observation이 좋다. players as nodes, relation as edges.
- reward는 first contact, shot, xG, counter risk로 나눈다.

## 3. 전체 아키텍처

### 3.1 계층형 정책

축구는 모든 선수가 매 프레임 "완전 자유 행동"을 고르면 학습이 너무 어렵다. 계층형으로 나눈다.

```txt
Team Coach Policy
  -> phase intent: buildUp / progress / finalThird / press / block / transition / setPiece
  -> tactical constraint: current STYLES profile

Unit Policy
  -> defensive line / midfield line / front line / rest defence / set-piece group

Player Policy
  -> move / support / mark / press / receive / pass / carry / shoot / tackle

Motor Layer
  -> acceleration / body angle / kick power / ball height / collision
```

초기 구현은 Coach/Unit을 script로 두고 Player만 RL. 이후 Coach도 RL 또는 evolutionary search.

### 3.2 Headless Engine

브라우저에서 학습하지 않는다.

필수:

- `lib/football/rl/env.ts`
- DOM 없음.
- deterministic seed.
- fixed tick, 예: 10Hz decision tick + 60Hz physics tick.
- event log.
- replay export.
- batch simulation.

렌더러:

- `components/seasonal`은 snapshot만 그린다.
- 학습 policy와 렌더 policy는 분리.

### 3.3 Observation

개별 선수 observation:

```ts
type PlayerObservation = {
  self: {
    role: Role;
    pos: Vec2;
    vel: Vec2;
    stamina: number;
    attributes: PlayerPersona;
  };
  ball: {
    relPos: Vec2;
    relVel: Vec2;
    height: number;
    owner?: PlayerId;
  };
  teammates: RelativePlayerState[];
  opponents: RelativePlayerState[];
  phase: GamePhase;
  tactic: TacticEmbedding;
  formation: FormationEmbedding;
  restart?: RestartObservation;
  nearbyPressure: number;
  actionMask: ActionMask;
};
```

중앙 critic state:

- 22명 전체 위치/속도.
- 공 전체 state.
- score/time/phase.
- hidden tactic id.
- event history window.
- offside line, defensive line, pitch control lite.

### 3.4 Action Space

High-level discrete:

- holdShape.
- moveToSpace.
- supportBall.
- pressCarrier.
- coverLane.
- markPlayer.
- receive.
- pass.
- carry.
- shoot.
- tackle.
- clear.
- keeperClaim.
- keeperRelease.

Parameterized:

- target point.
- target player.
- pass kind.
- power.
- height.
- sprint.
- body orientation.

초기 curriculum은 high-level만. full match에서 parameterized action을 연다.

### 3.5 Action Mask

룰 위반을 reward로만 막지 말고 mask도 둔다.

예:

- 공 없으면 `shoot` mask off.
- restartSetup에서 taker 외 킥 금지.
- throw-in direct offside 없음.
- GK hands는 penalty area 안에서만.
- red card player action 없음.
- offside position player에게 위험 패스는 금지하지 않고 penalty/decision risk로 둔다. 실제 축구처럼 위험 선택 가능해야 함.

### 3.6 선수별 에이전트 구조

각 선수는 별도 agent로 본다. 다만 처음부터 20개 outfield policy + 2개 GK policy를 전부 따로 학습하면 표본 효율이 박살난다. 시작은 **parameter sharing + role/tactic embedding**이 맞다.

```txt
Shared Outfield Actor
  input: local observation
       + role embedding(DF/DM/MF/WG/FW)
       + formation slot embedding
       + tactic embedding(STYLES)
       + player persona embedding
       + phase embedding
  trunk: MLP or small Transformer/attention over visible players
  heads:
    - movement head: target zone / direction / sprint
    - off-ball head: support / run / mark / press / cover
    - on-ball head: pass / carry / shoot / clear
    - parameter head: target point, power, height, body angle

Goalkeeper Actor
  shared lower trunk optional
  GK-specific heads:
    - claim / catch / parry / punch / smother / sweep
    - release: roll / throw / punt / short pass / drop kick

Central Critic(MAPPO)
  input: full 22 players + ball + tactic ids + score/time + event history
  output: team value / agent value / reward breakdown auxiliary estimates
```

운영 원칙:

- **actor는 자기 관측만** 본다. 실행 시 cheat 방지.
- **critic은 전체 상태**를 본다. 학습 시 credit assignment 보완.
- 같은 role이라도 `PlayerPersona`가 달라 행동이 다르게 나온다.
- role별 head는 나중에 추가한다. 처음은 shared actor가 표본 효율 좋음.
- GK는 손 사용, claim, release가 완전히 달라 별도 action head 필요.
- set-piece에서는 `SetPieceRole` embedding을 추가한다. 예: corner taker, near-post runner, blocker, rest-defender.

권장 타입:

```ts
type AgentId = `team${0 | 1}:p${number}`;

type AgentRuntimeState = {
  id: AgentId;
  team: TeamSide;
  role: Role | "GK";
  slotIndex: number;
  persona: PlayerPersona;
  currentDuty: TacticalDuty;
  stamina: number;
  lastAction: PlayerActionType;
  memory: AgentMemory;
};

type AgentMemory = {
  lastSeenBallAt: number;
  lastTouchAt?: number;
  markTarget?: AgentId;
  anchorTarget: Vec2;
  recentPressure: number;
};
```

## 4. 전술/포메이션을 RL에 넣는 방식

### 4.1 TacticStyle을 condition으로

현재 `STYLES` 20개는 학습 task id다.

```ts
type TacticEmbedding = {
  id: TacticId;
  press: number;
  possession: number;
  tempo: number;
  lineHeight: number;
  width: number;
  preferredForms: FormationId[];
};
```

정책 입력:

- tactic embedding.
- current formation id.
- role id.
- phase id.

보상:

- tacticFidelity.
- score.
- value/progression.
- roleFidelity.
- viewerQuality.

### 4.2 전술 20종 학습 목표

| 전술 | 학습 목표 | 주요 reward anchor |
| --- | --- | --- |
| 티키타카 | 짧은 패스로 공간 만들고 잃으면 즉시 압박 | short pass, triangle, third-man, 5s regain |
| 점유 축구 | 안정적 소유와 리스크 관리 | possession value, low turnover, safe progression |
| 게겐프레싱 | 상실 직후 고강도 재압박 | counterpress regain, high turnover xG |
| 하이프레스 | 상대 후방 빌드업 방해 | PPDA, forced long ball, trap success |
| 토탈 풋볼 | 포지션 교환과 높은 라인 | role rotation, lane occupation |
| 윙 플레이 | 폭 확보와 크로스/컷백 | wide overload, overlap, cutback |
| 미드블록 | 중앙 차단과 중간 압박 | compactness, zone14 denial |
| 역습 축구 | 탈취 후 빠른 전진 | regain-to-shot time, verticality |
| 롱볼 직접 | 타깃맨과 세컨드볼 | long-ball contest, second-ball win |
| 빗장 수비 | 깊은 수비와 박스 보호 | xG conceded low, box density |
| 텐백 수비 | 극단적 low block | shot suppression, clearance safety |
| 밸런스 | 균형 잡힌 선택 | no metric collapse, score/value balance |
| 포지셔널 플레이 | 3-2 rest shape와 5레인 점유 | lane occupation, rest defence, overload-to-isolate |
| 수직적 티키타카 | 짧지만 전진적인 중앙 조합 | line-breaking short pass, third-man |
| 플루이드 역습 | 유동적 전환과 빠른 공격 | transition variety, runner timing |
| 두 줄 수비 | 4-4-2 compact block | horizontal/vertical compactness |
| 루트 원 | 극단적 직접성 | target contact, territory gain |
| 비대칭 아이솔레이션 | 과부하 후 반대 1v1 | overload pull, switch, isolation |
| 가짜 9번 시스템 | false nine 유인과 2선 침투 | drop-to-link, runner behind |
| 실리 축구 | 실점 억제와 효율 | risk control, set-piece/transition value |

### 4.3 포메이션을 shape prior로

포메이션은 policy가 항상 따라야 하는 감옥이 아니다. 축구에서는 in-possession, out-of-possession, transition shape가 다르다.

예:

- 4-3-3 out of possession -> 4-1-4-1 또는 4-5-1.
- 4-3-3 in possession -> 2-3-5 또는 3-2-5.
- 3-2-4-1 in possession -> 3-2 rest + front five.
- 5-4-1 out of possession -> low block, transition 때 3-4-3처럼 튀어나감.

필요 metadata:

```ts
type FormationProfile = {
  id: FormationId;
  baseSlots: Slot[];
  inPossessionShape: ShapeTemplate;
  outOfPossessionShape: ShapeTemplate;
  transitionShape: ShapeTemplate;
  roleDuties: RoleDuty[];
};
```

### 4.4 Dynamic Anchoring

맞다. 동네 축구 방지 핵심은 dynamic anchoring이다. 포메이션은 고정 좌표가 아니라 공 위치, phase, 전술, 좌우 전환에 따라 팀 전체가 그물망처럼 이동하는 target field다.

각 선수 target:

```txt
target_i =
  baseSlot_i
  + ballShift(ballPos, phase, tactic)
  + teamCompactnessShift(outOfPossession)
  + widthShift(tactic.width)
  + lineHeightShift(tactic.lineHeight)
  + roleDutyOffset(i, phase)
```

position reward:

```txt
R_position_i = -gamma_role * || pos_i - target_i ||^2
```

role별 gamma:

- CB/GK/DM: 높음. 무단 이탈 강하게 금지.
- WG/FW: 중간. 침투/압박을 위해 자유도 허용.
- set-piece taker/runner: 일시적으로 anchor 교체.

팀 shape target:

```txt
X_team = mean(attackingDirectionAdjustedX(all outfield players))
W_team = stddev(Y of outfield players)

R_shape =
  - alpha * abs(X_team - X_target(tactic.lineHeight, phase))
  - beta  * abs(W_team - W_target(tactic.width, phase))
```

주의:

- anchor를 너무 세게 주면 로봇처럼 줄 맞춤만 한다.
- 공 근처 2~4명은 local task(anchor 완화), 나머지는 shape task(anchor 강화).
- possession phase와 defensive phase는 target shape가 다르다.
- transition 3~5초 동안은 anchor보다 공/상대/공간 반응을 우선한다.

구현 파일 후보:

```txt
lib/football/tactics/anchors.ts
lib/football/tactics/shape-targets.ts
lib/football/rl/reward-shape.ts
```

## 5. Reward 설계

### 5.1 기본 weight

요청 반영: `tacticFidelity`가 가장 크다.

```txt
tacticFidelity    0.30
score             0.20
progression       0.12
chanceQuality     0.10
possessionValue   0.08
defensiveValue    0.08
ruleCompliance    0.07
roleFidelity      0.03
viewerQuality     0.02
```

주의:

- `ruleCompliance`는 weight와 별개로 hard penalty 가능.
- `score`는 terminal/high value reward지만 전술을 망치면 총점 낮음.
- final fine-tuning에서는 `score`를 0.25까지 올릴 수 있으나 `tacticFidelity`는 0.25 이하로 내리지 않는다.

### 5.2 tacticFidelity 계산

```txt
tacticFidelity =
  phaseMatchScore
  + shapeScore
  + actionDistributionScore
  + transitionScore
  + setPieceStyleScore
  - antiStylePenalty
```

예:

- 티키타카가 롱볼 비율 과도하면 penalty.
- 루트 원이 후방에서 짧은 패스만 돌리면 penalty.
- 텐백이 높은 라인으로 압박하다 뒷공간 계속 노출하면 penalty.
- 포지셔널 플레이가 5레인 점유 없이 한쪽만 몰리면 penalty.

### 5.3 frame-level "최고 해답"

사용자가 말한 "해당 프레임별 최고의 해답"은 축구에서 절대 정답이 아니라 value surface다.

근사:

- xT delta: 공 위치 가치 변화.
- VAEP delta: 득점 확률 증가 + 실점 확률 감소.
- EPV lite: 현재 22명+공 상태에서 expected next goal.
- pitch control: 패스/운반 target 성공 가능성.
- pass probability: 성공률.
- risk: turnover 후 상대 transition value.

프레임 reward:

```txt
frameValue =
  0.35 * EPVDelta
  + 0.20 * xTDelta
  + 0.15 * passProbabilityQuality
  + 0.15 * pitchControlGain
  - 0.15 * turnoverRisk
```

전술별로 frameValue를 다시 필터링:

- 실리 축구는 risk penalty를 더 크게.
- 게겐프레싱은 turnover 후 counterpress 가능성이 있으면 risk 완화.
- 루트 원은 낮은 pass probability라도 territory/second-ball 구조가 있으면 보정.

### 5.4 개인성 reward

개인성은 무작위성이 아니라 반복 관찰 가능한 선택 편향.

예:

- playmaker: line-breaking pass/xA 보상.
- earlyCrosser: 좋은 early cross 보상.
- targetMan: aerial contest, hold-up, layoff 보상.
- poacher: offside line 근처 timing, box touch 보상.
- sweeperKeeper: 위험하지 않은 sweeping/short build-up 보상.
- invertedFullback: possession 때 중앙 support 보상.

단, 개인성은 팀 전술과 충돌하면 낮춘다. 예: 텐백 수비에서 풀백이 무리하게 중앙 침투 반복하면 penalty.

### 5.5 전술 파라미터의 보상 함수화

네가 쓴 방향 그대로 적용해야 한다. `lineHeight`, `width`, `press`, `possession`, `tempo`는 전술 이름 설명이 아니라 매 tick reward로 바뀌어야 한다.

#### 5.5.1 lineHeight / width

팀 형태:

```txt
X_team = mean(x_i adjusted by attack direction)
W_team = stddev(y_i)
X_target = phaseLineBase(phase) + k_line * tactic.lineHeight
W_target = pitchWidth * widthScale(tactic.width, phase)

R_shape =
  - alpha * |X_team - X_target|
  - beta  * |W_team - W_target|
```

권장:

- defensive phase: lineHeight target 더 중요.
- possession phase: width target 더 중요.
- low block/텐백: X_target 낮게, W_target 좁게.
- 포지셔널/윙플레이: W_target 넓게.

#### 5.5.2 press

수비 시 상대 ball carrier 주변 N미터 안 압박:

```txt
pressCount = count(defenders within N meters of opponentBallCarrier)
approachSpeed = sum(max(0, dot(v_i, dir_to_ballCarrier)))
coverScore = passingLaneBlockedScore

R_press =
  tactic.press *
  (a * pressCountTargetMatch + b * approachSpeed + c * coverScore)
  - overPressPenalty
```

전술별:

- 게겐프레싱/하이프레스: N 안 2~4명 압박 보상 큼.
- 미드블록/두 줄 수비: 무조건 달려드는 압박보다 lane cover 보상 큼.
- 텐백/빗장: 박스 앞 compactness가 press보다 중요.

#### 5.5.3 possession

점유 전술은 패스 성공/유지 보상, 직접 전술은 전진/위협 보상.

```txt
R_possession =
  tactic.possession * (smallPassSuccess + retentionValue - turnoverPenalty)
  + (1 - tactic.possession) * (progressiveDistance + territoryGain + secondBallStructure)
```

세부:

- 패스 성공 보상은 너무 크면 무의미한 백패스 루프를 만든다.
- back/lateral pass는 EPV/xT가 증가하거나 압박 유인 성공일 때만 보너스.
- turnover penalty는 위치 기반. 자기 박스 앞 turnover는 더 크게.

#### 5.5.4 tempo

time on ball을 전술별 target으로 둔다.

```txt
targetHoldSec = lerp(3.0, 1.0, normalizeTempo(tactic.tempo))
R_tempo =
  - lambda * |timeOnBall - targetHoldSec|
  + quickDecisionBonus(if action improves value)
```

예:

- 게겐프레싱 tempo 1.18: 1~2초 내 패스/슛/전진 운반 보너스.
- 점유 축구 tempo 1.00: 무리한 원터치보다 안정 선택 허용.
- 실리 축구 tempo .90: 위험한 빠른 패스보다 안전한 clear/reset 허용.

#### 5.5.5 전체 tactic reward

```txt
R_tactic =
  w_shape      * R_shape
  + w_position * mean(R_position_i)
  + w_press    * R_press
  + w_poss     * R_possession
  + w_tempo    * R_tempo
  + w_phase    * R_phasePrinciple
```

전술별 내부 weight:

- 티키타카: possession/shape/tempo.
- 게겐프레싱: press/tempo/transition.
- 윙플레이: width/phase/cross-cutdown.
- 루트 원: possession 낮고 progression/secondBall 높음.
- 텐백: lineHeight/compactness/defensiveValue.

## 6. 커리큘럼

### 6.0 네 단계 기본 훈련 흐름

요청한 구조가 맞다. GRF Football Academy식으로 더 잘게 쪼개되, 큰 줄기는 아래 순서다.

1. **Shadow Play**
   - 상대 없음.
   - 11명이 dynamic anchor를 유지하며 이동/패스/전진.
   - reward: `R_shape`, `R_position`, safe pass, lane occupation.
   - 목표: 공만 보고 몰려다니는 현상 제거.

2. **Dummy Defenders**
   - 정지/느린 수비수.
   - 압박 회피, 패스 각도, tempo, third-man.
   - reward: pass probability, pressure escape, targetHoldSec match.

3. **Small-Sided Tactical Games**
   - 4v4, 5v5, 7v7.
   - half-space, counterpress, low block, winger isolation 등 부분 전술만 집중.
   - reward: 특정 phase/tactic anchor를 크게.

4. **Full Scale 11v11**
   - pretrained policies를 모아 population self-play.
   - score reward 증가.
   - tacticFidelity 유지.

### Phase A: 룰·물리 sanity

학습 전 검증:

- 공이 라인 전체 넘을 때만 out/goal.
- offside snapshot 정확.
- restart state deterministic.
- foul/card/GK handling deterministic.
- seed replay 동일.

### Phase B: micro skill

1. 1v0 empty goal.
2. 1v1 keeper.
3. 1v1 dribble.
4. 2v1 pass or shoot.
5. 3v2 counter.
6. rondo 4v2.
7. shot blocking.
8. keeper claim/catch/parry.

알고리즘:

- PPO/IPPO.
- dense shaping.
- action mask 강하게.

### Phase C: phase scenarios

1. build-up vs 1 presser.
2. build-up vs 3 high pressers.
3. mid-block defend 20 seconds.
4. counterpress 5 seconds.
5. low-block clear and counter.
6. winger isolation 2v1.
7. central third-man combination.
8. offside line break.

알고리즘:

- IPPO baseline.
- MAPPO with centralized critic.
- scripted opponent mix.

### Phase D: set-piece academy

1. throw-in retention.
2. goal kick short build-up.
3. goal kick long target.
4. corner first contact.
5. corner shot attempt.
6. corner defending zonal/man/hybrid.
7. free-kick shot/wall.
8. penalty mixed strategy.

알고리즘:

- graph observation for corner/free-kick.
- TacticAI style receiver/shot predictor as auxiliary head.
- optional graph RL for corner positioning.

### Phase E: small-sided games

1. 3v3.
2. 5v5.
3. 7v7.
4. 8v8 with goalkeeper.

목표:

- sparse score reward 점진적 증가.
- 전술 constraint 유지.
- self-play 시작.

### Phase F: 11v11 compressed match

단계:

- 5분 compressed half.
- 15분 compressed match.
- 45분 half.
- full 90.

상대:

- scripted.
- current self.
- frozen archive.
- exploiter.
- style-specific rival.

## 7. 알고리즘 선택

### 7.1 1차 baseline: Scripted AI

이유:

- 룰 검증.
- reward target 생성.
- imitation source.
- 브라우저 fallback.

### 7.2 2차 baseline: IPPO

이유:

- 구현 단순.
- GRF full-game empirical study에서 IPPO reference가 있음.
- distributed rollout 쉬움.

사용:

- shared policy.
- role/tactic embedding.
- per-agent local observation.

### 7.3 3차 baseline: MAPPO

이유:

- PPO 계열이 GRF 포함 여러 MARL benchmark에서 강한 baseline.
- centralized critic으로 credit assignment 개선.

사용:

- actor: local obs.
- critic: global state.
- recurrent policy optional.

### 7.4 비교군: QMIX/VDN

이유:

- cooperative team reward 분해.
- discrete high-level action에서 비교 가능.

제약:

- continuous/parameterized action이 많으면 어렵다.
- full 11v11보다는 5v5/phase scenario에 적합.

### 7.5 League / Population Self-play

구성:

- main agents: 전술별 주 정책.
- style specialists: 특정 전술만 깊게.
- exploiters: main 약점 공격.
- historical archive: 과거 정책.
- scripted anchors: 사람 같은 기준선.

매칭:

- 40% vs current similar strength.
- 25% vs historical.
- 20% vs exploiter.
- 15% vs scripted/randomized tactics.

평가:

- style Elo.
- cross-style matrix.
- exploit resistance.
- tacticFidelity average.
- viewerQuality.

## 8. 학습 데이터 흐름

```txt
lib/football headless env
  -> rollout workers
  -> event logs + trajectories
  -> reward decomposition
  -> learner
  -> policy checkpoint
  -> evaluator
  -> replay renderer
  -> browser distillation/export
```

저장:

- seed.
- scenario id.
- tactic ids.
- formation ids.
- policy version.
- event log.
- reward breakdown.
- compressed replay.

## 9. 평가 체계

### 9.1 축구 성능

- win rate.
- goal difference.
- xG for/against.
- shots for/against.
- possession value.
- set-piece xG.
- transition xG.

### 9.2 전술 충실도

- tacticFidelity by style.
- pass distribution.
- line height.
- width.
- PPDA.
- compactness.
- progression channel.
- transition speed.
- set-piece routine match.

### 9.3 선수 개인성

- roleFidelity.
- trait activation rate.
- individual action distribution.
- weak foot usage.
- work rate match.
- playmaker/xA, poacher box touch, target aerial duel 등.

### 9.4 시청 품질

- meaningful event per minute.
- dead loop count.
- no-HUD-overlap.
- set-piece preparation clarity.
- tactical contrast visible within 30~60s.
- replay diversity.
- mobile readability.

### 9.5 Anti-exploit

- infinite backpass loop.
- corner loop.
- time-wasting.
- impossible dribble through bodies.
- offside abuse.
- goalkeeper hand exploit.
- wall/collision exploit.
- reward farming without threat.

## 10. 구현 로드맵

### Step 1: Tactic/Formation metadata

작업:

- `TacticStyle`에 `id`, `displayName`, `description`, `rewardAnchors` 추가.
- `FormationProfile` 추가.
- 현재 Korean `name`은 displayName으로 유지, id는 ASCII.

예:

```ts
type TacticId = "tiki_taka" | "gegenpressing" | "route_one";
type RewardAnchor = "short_pass" | "counterpress_5s" | "long_ball_second_ball";
```

### Step 2: Env skeleton

작업:

- `lib/football/rl/env.ts`
- `lib/football/rl/observation.ts`
- `lib/football/rl/action-mask.ts`
- `lib/football/rl/reward.ts`
- `lib/football/rl/scenarios.ts`

### Step 3: Analytics lite

작업:

- `xg-lite.ts`.
- `xt-grid.ts`.
- `ppda.ts`.
- `compactness.ts`.
- `field-tilt.ts`.
- `packing.ts`.
- `pitch-control-lite.ts`.

### Step 4: Scripted AI

작업:

- `scripted-team-policy.ts`.
- `scripted-player-policy.ts`.
- 전술별 scripted baseline.
- set-piece playbook.

### Step 5: Python wrapper

작업:

- Node engine worker 또는 JSON-RPC bridge.
- PettingZoo Parallel wrapper.
- vectorized rollout.

### Step 6: Train

순서:

1. scripted 검증.
2. IPPO micro scenarios.
3. MAPPO phase scenarios.
4. set-piece graph scenario.
5. small-sided self-play.
6. 11v11 population self-play.
7. distillation to browser policy.

## 11. 실패 패턴과 대응

| 실패 | 원인 | 대응 |
| --- | --- | --- |
| 골만 노리고 축구답지 않음 | score reward 과다 | tacticFidelity 상향, style penalty |
| 공 돌리기만 함 | possession reward 과다 | EPV/xT delta, dead loop penalty |
| 모든 전술이 비슷함 | tactic embedding 약함 | style-specific reward, evaluation matrix |
| 압박이 무한 지속 | fatigue/spacing 부재 | stamina, bypass penalty, recovery phase |
| 롱볼만 함 | progression reward 허술 | pass probability/risk, style conditional |
| 세트피스 순간이동 | restart setup 부재 | setup phase, player walk, ready check |
| credit assignment 실패 | 22명 joint action | MAPPO critic, role reward, VDN/QMIX comparison |
| 브라우저 느림 | policy 과대 | distillation, scripted hybrid, decision tick 낮춤 |

## 12. 실제 학습 시작 전 병목 대비

### 12.1 연산 부하 분리

문제:

- 물리/충돌은 60Hz가 필요하지만, EPV, xT, pitch control, pass probability 같은 고급 지표를 60Hz마다 22명 전체에 계산하면 병목이 된다.
- 특히 pitch control/EPV류는 위치 grid 또는 후보 action surface를 만들기 때문에 rollout worker 수가 늘면 비용이 폭증한다.

대응:

```txt
Physics Tick       60Hz  -> ball/player integration, collision, line crossing
Rule Tick          60Hz  -> out/goal/foul/offside event checks where needed
Decision Tick    5-10Hz  -> agent observation, action selection
Analytics Tick   2-10Hz  -> xT/EPV/pitch control/pass surface cache
Render Tick       rAF    -> browser only, learning과 분리
```

구현 원칙:

- agent는 매 physics tick이 아니라 decision tick에서만 새 action을 고른다.
- action은 다음 decision tick까지 sticky/continuous command로 유지한다.
- xT는 grid lookup으로 시작한다.
- pitch control은 ball 주변/후보 target만 계산한다.
- EPV는 매 tick full model 대신 `EPV-lite` cache를 사용한다.
- analytics result에는 `validUntilTick`을 둔다.

권장 타입:

```ts
type TickRates = {
  physicsHz: 60;
  decisionHz: 10;
  analyticsHz: 5;
};

type AnalyticsCache = {
  tick: number;
  validUntilTick: number;
  xTGrid?: Float32Array;
  pitchControl?: Float32Array;
  passSurfaceByPlayer?: Map<PlayerId, Float32Array>;
  epvLite?: number;
};
```

### 12.2 TypeScript 엔진과 Python 학습 브리지

문제:

- 엔진은 TypeScript, 학습은 Python/PettingZoo/RLlib/SB3 계열일 가능성이 높다.
- vectorized rollout worker가 많아지면 JSON state/action 직렬화 비용이 병목이 된다.

대응 단계:

1. 초기 개발: JSON bridge 허용. 디버깅, 스키마 안정화 목적.
2. 중간 단계: MessagePack 또는 binary typed array payload로 전환.
3. 대규모 학습: FlatBuffers, Cap'n Proto, gRPC streaming 중 하나를 선택.
4. 최종 최적화: Node worker pool 또는 engine core를 WASM/Rust로 이전 가능성 검토.

브리지 원칙:

- 매 tick 전체 객체를 보내지 말고 packed numeric buffer를 보낸다.
- observation/action schema는 version을 가진다.
- player order는 고정한다. `team0 p0..p10`, `team1 p0..p10`.
- string enum은 전송하지 않고 integer id로 매핑한다.
- event log는 매 decision step마다 전체 전송하지 않고 delta/batch 전송한다.

권장 packed layout:

```txt
ObservationBuffer Float32Array
  header: tick, phaseId, scoreA, scoreB, ballOwnerId
  ball: x,y,vx,vy,z,vz
  players[22]:
    x,y,vx,vy,stamina,roleId,teamId,hasBall,pressure,anchorDx,anchorDy
  tactic:
    press,possession,tempo,lineHeight,width

ActionBuffer Float32Array / Int32Array
  players[22]:
    actionTypeId,targetX,targetY,power,height,sprintFlag,passKindId
```

브리지 후보:

- **FlatBuffers**: schema 기반, zero-copy 지향, 게임 state에 적합.
- **gRPC streaming**: 운영/분산 환경 친화, latency는 FlatBuffers direct보다 클 수 있음.
- **MessagePack**: JSON보다 빠르고 도입 쉬움, schema 안정 전 중간 단계.
- **Shared memory / mmap**: 가장 빠르지만 구현 복잡. 초기에는 과함.

### 12.3 Scripted AI에서 RL로 넘어가는 Behavior Cloning

문제:

- scripted AI와 순수 RL 사이 간극이 크다.
- random exploration으로 11명이 패스, spacing, offside timing, pressing trap을 스스로 발견하기 어렵다.

대응:

1. scripted AI끼리 대량 경기 생성.
2. event log + state/action trajectory 저장.
3. 전술별 dataset 분리. 예: `tiki_taka`, `gegenpressing`, `low_block`.
4. Behavior Cloning으로 actor 초기화.
5. BC policy를 scripted opponent와 검증.
6. 이후 IPPO/MAPPO fine-tuning.

BC dataset:

```ts
type BCSample = {
  observation: PackedObservation;
  action: PackedAction;
  tacticId: TacticId;
  formationId: FormationId;
  role: Role | "GK";
  phase: GamePhase;
  rewardAnchors: RewardAnchor[];
};
```

BC loss:

```txt
L_BC =
  CE(actionType)
  + MSE(targetPoint)
  + CE(passKind)
  + MSE(power,height)
  + auxiliary losses:
      phase prediction
      tactic id prediction
      anchor target prediction
```

주의:

- BC만 하면 scripted AI 한계를 그대로 복사한다.
- RL fine-tuning에서 exploration noise와 self-play가 필요하다.
- 전술별 dataset balance를 맞춘다. 롱볼/텐백이 소수면 정책이 점유형으로 쏠린다.
- bad scripted action은 filtering한다. 예: 룰 위반, dead loop, 무의미한 백패스.

## 13. 바로 다음 문서/코드 작업

추천 순서:

1. `docs/football-knowledge-inventory.ko.md`의 전술 20종을 코드 metadata와 1:1 연결.
2. `TacticStyle`에 ASCII `id` 추가.
3. `FormationProfile` 작성.
4. `rewardAnchors`와 `evaluationMetrics` 타입 작성.
5. `rl/scenarios.ts`에 Football Academy식 scenario 목록 추가.
6. `rl/reward.ts`에 reward breakdown skeleton 작성.

## 14. 참고 자료

- Google Research Football paper  
  https://cdn.aaai.org/ojs/5878/5878-13-9103-1-10-20200513.pdf
- Google Research Football publication page  
  https://research.google/pubs/google-research-football-a-novel-reinforcement-learning-environment/
- An Empirical Study on Google Research Football Multi-agent Scenarios  
  https://arxiv.org/abs/2305.09458
- GRF MARL / AAMAS 2024  
  https://www.ifaamas.org/Proceedings/aamas2024/pdfs/p1772.pdf
- GRF MARLLib docs  
  https://grf-marl.readthedocs.io/
- PettingZoo Parallel API  
  https://pettingzoo.farama.org/api/parallel/
- PettingZoo paper  
  https://arxiv.org/abs/2009.14471
- MAPPO paper  
  https://arxiv.org/abs/2103.01955
- QMIX paper  
  https://arxiv.org/abs/1803.11485
- VDN paper  
  https://arxiv.org/abs/1706.05296
- AlphaStar Nature paper  
  https://www.nature.com/articles/s41586-019-1724-z
- TacticAI Nature Communications  
  https://www.nature.com/articles/s41467-024-45965-x
- TacticAI DeepMind blog  
  https://deepmind.google/blog/tacticai-ai-assistant-for-football-tactics/
- TacticGen preprint  
  https://arxiv.org/abs/2604.18210
- Graph RL for corner tactics preprint  
  https://arxiv.org/abs/2606.06353
- VAEP paper  
  https://arxiv.org/pdf/1802.07127
- EPV framework  
  https://www.sloansportsconference.com/research-papers/decomposing-the-immeasurable-sport-a-deep-learning-expected-possession-value-framework-for-soccer
- Soccermatics pitch control/pass probability  
  https://soccermatics.readthedocs.io/en/latest/lesson6/PassProbability.html
