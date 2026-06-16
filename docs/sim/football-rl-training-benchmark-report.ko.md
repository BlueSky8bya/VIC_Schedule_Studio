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

### 3.3.1 좌표계 정규화와 Attention/GNN 관측 trunk

절대 좌표를 그대로 넣으면 같은 장면도 "오른쪽 공격"과 "왼쪽 공격"이 다른 문제처럼 보인다. 또 `teammates[10]`, `opponents[11]` 배열 순서가 조금만 달라져도 정책이 불안정해질 수 있다. 관측은 **egocentric + attack-centric + permutation-aware**로 만든다.

근거:

- Deep Sets와 Set Transformer는 set 입력의 permutation invariance/equivariance를 다룬다.
- GAT는 graph node가 이웃 feature에 attention을 주는 구조라 선수 관계 모델링에 적합하다.
- TacticAI는 코너킥을 player graph로 표현하고 geometric deep learning을 사용했다.
- pitch-control 계열 연구는 선수 위치/속도/도착시간 기반 공간 지각이 축구 의사결정에 중요함을 보인다.

좌표 변환:

```txt
worldPos -> attackCentricPos -> egoCentricPos

attackCentric:
  attacking direction is always +X

egoCentric:
  agent position becomes (0,0)
  all teammates/opponents/ball are relative to agent
  optional rotation by agent body direction for FOV features
```

권장 타입:

```ts
type CoordinateFrame = "world" | "attackCentric" | "egoAttackCentric" | "egoBodyCentric";

type NormalizedEntityState = {
  id: AgentId | "ball";
  teamRelation: "self" | "teammate" | "opponent" | "ball";
  role?: Role | "GK";
  relPos: Vec2;
  relVel: Vec2;
  distance: number;
  angleToBody: number;
  angleToAttack: number;
  inFov: boolean;
  pressure?: number;
  intentSignal?: IntentSignal;
};
```

관측 trunk:

```txt
PlayerObservationEncoder
  self embedding
  ball embedding
  entity set encoder:
    option A: DeepSets / Set Transformer
    option B: GAT/GNN over player graph
    option C: hybrid attention with distance/FOV bias
  tactic + formation + phase embedding
  output -> shared actor trunk
```

attention bias:

```txt
attentionBias(i,j) =
  - a * distance(i,j)
  + b * inFov(i,j)
  + c * samePassingLane(i,j)
  + d * immediatePressure(i,j)
  + e * intentSignalBoost(j)
```

주의:

- Actor는 local/observable 정보만 본다. critic은 전체 world state를 볼 수 있다.
- ID 고정 배열은 logging에는 좋지만, policy 입력은 set/graph encoder를 거친다.
- world 좌표는 replay/debug에 보존하고, 학습 입력은 normalized 좌표를 기본으로 둔다.
- Step 1은 타입과 helper(`normalizeObservationFrame`, `buildEntityGraph`)만 만든다. 실제 Transformer/GNN 학습은 Step 5 이후.

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

### 3.4.1 암묵적 의사소통과 intent signaling

축구는 패스하는 선수와 받는 선수의 타이밍 동기화가 중요하다. MARL에서는 부분관측 때문에 침투 의도가 잘 전달되지 않는다. DIAL/RIAL, CommNet, TarMAC 계열 연구는 부분관측 cooperative MARL에서 communication channel이 협업을 돕는다는 근거를 제공한다. 축구에서는 이를 "손짓/눈맞춤"에 해당하는 짧은 intent signal로 모델링한다.

Action space에 추가:

```ts
type IntentSignal =
  | "none"
  | "requestPassFeet"
  | "requestPassSpace"
  | "callForSupport"
  | "holdRun"
  | "switchAvailable"
  | "manOn"
  | "leaveBall";

type IntentSignalState = {
  signal: IntentSignal;
  from: AgentId;
  target?: AgentId;
  targetPoint?: Vec2;
  createdAtTick: number;
  expiresAtTick: number; // e.g. 0.5 sec
  confidence: number;
};
```

관측 반영:

```ts
type RelativePlayerState = {
  // ...
  intentSignal?: IntentSignalState;
  isRequestingPass?: boolean;
  requestedTargetPoint?: Vec2;
};
```

보상:

```txt
R_signal =
  + successfulPassAfterValidRequest
  + teammateSupportAfterCall
  + runnerTimingMatched
  - spamSignalPenalty
  - ignoredBetterOptionPenalty
  - misleadingSignalPenalty
```

운영 원칙:

- 신호는 0.3~0.7초만 유지한다.
- 모든 신호가 무조건 정확하면 cheat가 된다. 시야/FOV, 거리, 압박, composure에 따라 관측 가능성을 제한한다.
- `requestPassSpace`는 target point와 함께 보내고, `requestPassFeet`는 receiver 위치 중심이다.
- TarMAC처럼 나중에는 "누구에게 보낼지"를 learned targeting으로 바꿀 수 있다.
- Step 1은 type/action metadata만 추가한다. 실제 communication learning은 curriculum에서 2v1, rondo, third-man scenario부터 연다.

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

### 3.7 공 회전·주발·컨디션·부상·성격 반영

현재 코드 기준으로 **선수 개성 일부는 이미 있다**. `PlayerPersona`에는 `preferredFoot`, `weakFoot`, `heightCm`, `weightKg`, `agility`, `balance`, `vision`, `composure`, `aggression`, `workRateAtk`, `workRateDef`, `cutInside`, `poaching`, `altruism`, `traits`가 있다. 즉 주발, 약발, 신체, 침착함, 공격성, 활동량, 성향, 특수 trait은 Step 1 metadata에 들어가 있다.

하지만 **학습 환경에서 실제로 효과를 내려면 아직 runtime state와 physics effect가 더 필요하다**. 현재 `BallState`는 `pos`, `vel`, `height`, `vz` 중심이라 공 회전, 스핀 축, 휘어짐, 바운드 후 회전 변화는 아직 타입/엔진에 없다. 컨디션, 급성 피로, 부상 정도, 통증, 자신감도 문서 방향은 있으나 경기 중 변하는 상태로는 분리되지 않았다.

Step 1에서 추가해야 하는 타입:

```ts
type BallSpinState = {
  angularVel: Vec3; // rad/s or normalized game unit
  spinAxis: Vec3;
  curve: number; // lateral drift coefficient
  dip: number; // vertical drop/topspin coefficient
  skid: number; // wet/fast surface bounce modifier
  lastContactFoot?: PreferredFoot;
};

type PlayerConditionState = {
  energy: number; // long-horizon stamina 0..1
  acuteFatigue: number; // recent sprint/accel/decel load 0..1
  matchSharpness: number; // touch/decision sharpness 0..1
  confidence: number; // risk taking and composure modifier 0..1
  knock: number; // temporary contact damage 0..1
  injuryRisk: number; // probability proxy, not deterministic injury
  injurySeverity: number; // 0 none, 1 cannot continue
  pain: number; // reduces acceleration, jump, kick power
};
```

학습에 반영되는 방식:

- 주발/약발: 패스, 슛, 크로스, 클리어의 정확도·파워·회전 가능 각도를 바꾼다. 약발 사용은 금지하지 않고 성공 확률/오차/보상으로 조절한다.
- 공 회전: curl pass, driven pass, chipped pass, knuckle/low shot, topspin shot, backspin lob의 궤적과 바운드를 바꾼다. action parameter에 `spin`, `height`, `contactFoot`, `contactSurface`가 필요하다.
- 침착함: 압박 반경 안에서 decision delay, first-touch error, pass/shot noise, 위험 패스 선택 확률을 바꾼다.
- 컨디션/피로: sprint, press, recovery run, jump, tackle timing, late-game positioning error를 바꾼다.
- 부상/통증: 순간 속도, 회전 반경, 킥 파워, 균형, 경합 회피 성향을 바꾼다. 심하면 교체/전술 재배치가 action space에 들어간다.
- 신체 특성: 키/몸무게/밸런스는 aerial duel, shielding, shoulder challenge, contact foul risk, landing recovery에 반영한다.
- 성격/trait: hard script가 아니라 action prior와 reward bias로 둔다. 예: `earlyCrosser`는 이른 크로스 선택 prior, `playmaker`는 xA 높은 패스 보상, `targetMan`은 등지는 플레이와 세컨볼 구조 보상.

관측 설계:

- actor는 자기 `PlayerPersona + PlayerConditionState`를 완전히 본다.
- actor는 상대 선수의 세부 컨디션을 직접 보지 않고, 관측 가능한 proxy만 본다. 예: 느린 복귀, 절뚝임, sprint 감소, 압박 회피.
- centralized critic은 학습 안정화를 위해 전체 persona/condition/spin/event history를 볼 수 있다.

개성 보상은 승리 보상을 대체하지 않는다. 전술 충실도 안에 보조 항으로 넣는다.

```txt
R_tacticFidelity =
  R_shape
  + R_role
  + R_style
  + R_personaExpression
  - R_personaExploit

R_personaExpression:
  preferred-foot optimal use, trait-consistent action, role-consistent risk

R_personaExploit:
  weak-foot spam, impossible sprint repeat, injured-player overuse, spin exploit
```

결론: **주발·신체·침착함·성격은 기반 타입이 이미 있고, 공 회전·컨디션·부상은 Step 1에서 타입을 추가한 뒤 Step 2~3 물리/보상에 연결해야 학습된다.** 이 구분을 Claude Code 구현 프롬프트에 반드시 넣어야 한다.

### 3.8 골키퍼 전진·후퇴·스위핑 정책

현재 문서에는 `Goalkeeper Actor`와 `claim / catch / parry / punch / smother / sweep / release` action head가 있다. 하지만 실제 학습을 위해서는 "골키퍼가 언제 나오는가", "언제 골문으로 돌아가는가", "어디에 서서 각도를 줄이는가"가 별도 상태와 보상으로 정의되어야 한다.

Step 1에서 추가해야 하는 골키퍼 상태:

```ts
type GoalkeeperIntent =
  | "holdLine"
  | "setPosition"
  | "advanceToClaim"
  | "sweepBehindLine"
  | "smother1v1"
  | "retreatToGoal"
  | "recoverCenter"
  | "releaseBall";

type GoalkeeperRuntimeState = {
  intent: GoalkeeperIntent;
  homePosition: Vec2; // goal center based default
  setPosition: Vec2; // current optimal angle-cutting point
  claimRadius: number;
  sweepDepth: number;
  retreatUrgency: number;
  hasHandControl: boolean;
  handControlSince?: number;
  lastClaimAt?: number;
};
```

골키퍼 decision trigger:

- 기본 위치: 공 위치와 골 중앙을 잇는 선 위에서 슈팅 각도를 줄인다. 공이 멀면 골라인 근처, 공이 가까우면 조금 전진한다.
- 전진 claim: 크로스/로빙패스 궤적이 claim zone에 들어오고, 골키퍼 도착 시간이 공격수보다 빠르거나 비슷하면 나온다.
- 펀칭/캐치 선택: 압박 밀도, 공 높이, 몸싸움, `composure`, `balance`, `heightCm`, `traits`에 따라 catch/punch/parry를 고른다.
- 스위핑: 수비 라인 뒤 공간으로 스루패스가 들어가고 골키퍼가 공격수보다 먼저 도착 가능하면 나온다. 박스 밖에서는 손을 쓰지 못하고 발 처리만 가능하다.
- 1대1 smother: 공격수가 박스 안 중앙으로 진입했고 터치가 길거나 슈팅 각도가 커질 때 몸을 던져 각도를 줄인다.
- 후퇴 retreat: 칩슛/로빙볼 위험, 공이 골키퍼 머리 위를 넘는 궤적, 수비수가 커버 가능, 골문이 비는 시간이 길어질 때 즉시 골문 쪽으로 복귀한다.
- recover center: 세컨볼/클리어 후에는 골 중앙 기준 위치로 돌아와 다음 슈팅 각도를 대비한다.
- release: 손으로 잡은 뒤 전술에 따라 roll/throw/short pass/punt/drop kick을 선택한다. 손 보유 시간 제한과 백패스 위반은 deterministic rule로 처리한다.

전술/개성 반영:

- `sweeperKeeper` trait: sweepDepth, advance prior, short build-up release 보상 증가.
- 점유/포지셔널 플레이: 짧은 패스, CB/DM 연결, 압박 유도 후 전개 보상.
- 롱볼/루트 원: punt/drop kick, targetMan 방향 세컨볼 구조 보상.
- 텐백/빗장 수비: 무리한 전진 페널티 증가, claim 안정성 보상 증가.
- 높은 defensive line: 스위핑 trigger 민감도 증가.

관측 feature:

```txt
gkObservation =
  ball position/velocity/height/spin
  + predicted ball landing point
  + timeToBall / timeToGoal / timeToBox
  + nearest attacker timeToBall
  + nearest defender cover time
  + defensive line depth
  + shot angle
  + cross claim window
  + penalty area boundary
```

보상:

```txt
R_gk =
  R_angleCutting
  + R_claimTiming
  + R_sweepTiming
  + R_retreatTiming
  + R_distributionFit
  - R_illegalHandling
  - R_overAdvanceLob
  - R_emptyGoalExposure
```

Step 1 구현 범위는 `GoalkeeperIntent`, `GoalkeeperRuntimeState`, 기본 helper만 만든다. 실제 궤적 예측, 다이빙, 캐치 성공률, 1대1 물리 충돌은 Step 2~3에서 붙인다.

### 3.9 감독 meta-controller와 경기 중 전술·교체 결정

초기 구현은 Coach/Unit을 script로 두는 것이 맞다. 다만 11v11 full match에서는 감독 역할을 명확히 정의해야 한다. HRL의 options/feudal 구조는 상위 policy가 낮은 시간 해상도에서 목표를 주고, 하위 policy가 매 tick 행동하는 구조를 정당화한다. COPA(Coach-Player MARL)는 coach가 global view를 보고 player에게 strategy를 가끔 전달하는 framework를 제안한다. 축구 교체 연구도 부상, 전술 변화, underperformance, 피로가 교체의 핵심 요인임을 보여준다.

Coach meta-controller 입력:

```ts
type CoachObservation = {
  timeMinute: number;
  scoreDiff: number;
  teamEPVTrend: number;
  xGFor: number;
  xGAgainst: number;
  tacticFidelity: number;
  opponentProfile: OpponentTacticProfile;
  playerConditions: Array<{ agentId: AgentId; condition: PlayerConditionState }>;
  cards: Array<{ agentId: AgentId; yellow: number; red: boolean }>;
  bench: BenchPlayerState[];
};
```

Coach action:

```ts
type CoachAction =
  | { kind: "keepPlan" }
  | { kind: "switchTactic"; tacticId: TacticId; reason: CoachDecisionReason }
  | { kind: "changeFormation"; formationId: FormationId; reason: CoachDecisionReason }
  | { kind: "adjustLine"; lineHeightDelta: number; widthDelta: number; pressDelta: number }
  | { kind: "substitute"; out: AgentId; in: BenchPlayerId; reason: CoachDecisionReason }
  | { kind: "setRiskMode"; mode: "protectLead" | "balanced" | "chaseGoal" };

type CoachDecisionReason =
  | "epvDrop"
  | "trailingLate"
  | "protectLead"
  | "fatigue"
  | "injuryRisk"
  | "yellowCardRisk"
  | "opponentTacticShift"
  | "styleCollapse";
```

전술 전환 trigger:

- `teamEPVTrend`가 일정 시간 하락하고 `scoreDiff <= 0`이면 risk mode 상승.
- 후반 70분 이후 지고 있으면 `route_one`, `asymmetric_isolation`, `fluid_counter` 후보를 열 수 있다.
- 리드 중이고 상대가 high press로 올라오면 `pragmatic`, `mid_block`, `direct outlet`로 위험을 낮춘다.
- 전술 전환은 너무 잦으면 시청 품질과 학습 안정성이 깨진다. 최소 유지 시간과 hysteresis를 둔다.

교체 trigger:

- `energy < 0.30`.
- `injuryRisk` 또는 `pain/knock` threshold 초과.
- yellow card + aggression 높음 + tackle frequency 높음.
- 해당 role의 `roleNormalizedScore`가 낮고 bench replacement condition이 좋음.
- 전술 전환에 필요한 profile이 벤치에 있음. 예: targetMan, fast winger, defensive midfielder.

보상:

```txt
R_coach =
  + postDecisionEPVImprovement
  + tacticFidelityRecovery
  + fatigueRiskReduction
  + substituteImpact
  - overSwitchingPenalty
  - lateBadSubstitution
  - tacticIdentityCollapse
```

Step 범위:

- Step 1: `CoachObservation`, `CoachAction`, `CoachDecisionReason`, `BenchPlayerState` 타입.
- Step 2~4: scripted coach rules.
- Step 6 이후: coach policy를 HRL/meta-controller로 학습.

### 3.10 상대 의도 추론과 opponent profiler

Population self-play에서는 상대 전술이 경기 중 바뀔 수 있다. 상대를 고정 환경으로 보면 non-stationary opponent에 취약하다. Opponent Modeling in Deep RL, ToM/other-minds 계열 연구, NFSP/self-play 연구는 상대 policy/전략을 latent로 추정하는 방향을 뒷받침한다.

Opponent profiler는 최근 10~30초 window를 압축해 상대 전술 latent를 만든다.

```ts
type OpponentTacticProfile = {
  windowSec: number;
  inferredTacticDist: Partial<Record<TacticId, number>>;
  lineHeight: number;
  width: number;
  pressIntensity: number;
  ppdaLite: number;
  directness: number;
  counterThreat: number;
  restDefenceStrength: number;
  setPieceThreat?: number;
  latent: number[]; // RNN/GRU/LSTM output, not sent to renderer
};
```

입력 feature:

```txt
last 10~30s:
  opponent lineHeight / width / compactness
  pressCount / approachSpeed / PPDA-lite
  pass length distribution
  possession directness
  regain height
  transition speed
  fullback advance frequency
  GK distribution pattern
```

사용 방식:

- Actor observation에 작은 `opponentLatent`를 넣는다. 단, actor가 직접 볼 수 없는 정보를 넣지 않는다.
- Critic은 full opponent profile을 볼 수 있다.
- Coach는 `opponentTacticShift` trigger로 사용한다.
- 평가에서는 "상대 텐백 -> 게겐프레싱 전환" 같은 zero-shot adaptation scenario를 만든다.

보상/학습:

```txt
R_adaptation =
  + valueGainAfterOpponentShift
  + correctCounterActionIncrease
  + tacticFidelityMaintainedDuringAdaptation
  - overReactiveSwitching
  - falsePositiveOpponentShift
```

Step 범위:

- Step 1: `OpponentTacticProfile` 타입과 window feature 목록.
- Step 3: analytics lite로 profile 계산.
- Step 6: RNN/GRU/LSTM opponent encoder 학습.

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

### 4.5 빌드업·오버래핑 전술 primitive

`football-knowledge-inventory.ko.md`에는 후방 빌드업, 중앙 전개, 측면 전개, overload-to-isolate가 이미 정리돼 있다. RL 구현에서는 이 개념들을 자연어 설명으로 두지 말고 action primitive, trigger, reward anchor로 내려야 한다.

Step 1에서 타입화할 전술 primitive:

```ts
type TacticalPrimitive =
  | "shortBuildUp"
  | "gkSplitCenterBacks"
  | "pivotDrop"
  | "thirdManCombination"
  | "wallPass"
  | "switchPlay"
  | "wideOverload"
  | "overlap"
  | "underlap"
  | "invertedFullbackSupport"
  | "halfSpaceReceive"
  | "cutback"
  | "earlyCross"
  | "counterPress"
  | "restDefence";

type TacticalPrimitiveTrigger = {
  primitive: TacticalPrimitive;
  phase: MatchPhase;
  minSupportCount?: number;
  maxPressureDistance?: number;
  preferredRoles?: Array<Role | "GK">;
  requiredTrait?: PlayerTrait;
};
```

빌드업 trigger:

- 상대 pressers 0~2명: GK/CB/DM 짧은 빌드업, pivot support, fullback wide.
- 상대 high press 3~5명: bounce pass, third-man, switch, GK clip pass.
- 중앙 차단: fullback/winger 방향으로 side exit.
- 측면 압박 유도 성공: 반대 전환 또는 3자 패스.
- 후방 빌드업 위험 증가: targetMan/winger 방향 직접 패스 허용. 단 점유 전술이면 "선호"가 아니라 "탈압박 선택"으로 보상한다.

오버래핑/언더래핑 trigger:

- winger가 터치라인 근처에서 공을 받고 상대 fullback을 고정하면 fullback overlap run.
- winger가 안으로 접고 half-space가 비면 fullback overlap 또는 underlap.
- 8번/mezzala가 half-space에 있고 fullback이 wide면 underlap보다 cutback support 우선.
- 상대 wide midfielder가 늦게 복귀하면 2v1 생성 보상.
- rest defence가 깨지면 무리한 overlap penalty. 특히 텐백/실리 축구는 fullback 이탈 보상 낮음.

보상 anchor:

```txt
R_buildUp =
  R_firstLineBroken
  + R_safeSupportTriangle
  + R_pressBaitSuccess
  + R_progressiveExit
  - R_centralTurnover

R_widePattern =
  R_overlapTiming
  + R_underlapTiming
  + R_2v1Created
  + R_cutbackQuality
  + R_restDefenceMaintained
  - R_emptyFlankTransitionRisk
```

전술별 차이:

- 티키타카/점유: 짧은 빌드업, 삼각형, third-man, press bait 보상 증가.
- 포지셔널 플레이: 5레인 점유, inverted fullback support, 3-2 rest shape 보상 증가.
- 윙 플레이: overlap/underlap, wide overload, cutback/cross quality 보상 증가.
- 비대칭 아이솔레이션: 한쪽 overload 후 빠른 switch와 반대 winger isolation 보상 증가.
- 루트 원/롱볼 직접: build-up pass count보다 전진 거리, target contact, second-ball structure 보상 증가.

Step 1 구현 범위는 `TacticalPrimitive`, trigger metadata, tactic별 primitive preference만 만든다. 실제 run path 생성, 패스 선택, 수비 반응은 Step 2 scripted baseline과 Step 3 reward shaping에서 붙인다.

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

### 5.2.1 전술별 tacticFidelity reward profile

전술 유사도는 "이 전술답게 보이는가"를 직접 보상해야 한다. 이름만 `게겐프레싱`, `역습 축구`로 붙이고 공통 reward를 주면 모든 policy가 비슷해진다. 각 전술은 positive signal, anti-style penalty, phase weight를 따로 가져야 한다.

주의: 아래 표는 특정 논문 하나가 "게겐프레싱 reward는 이것"이라고 제시한 것을 그대로 옮긴 게 아니다. 신뢰 가능한 축구 분석/스포츠 애널리틱스 연구가 제공하는 **측정 가능한 tactical feature**를 전술별 reward anchor로 변환한 설계다. 즉 출처는 metric/phase/pressing/action-value의 근거이고, 전술별 조합과 weight는 시뮬레이션에서 검증해야 하는 engineering hypothesis다.

근거 코드:

| 코드 | 근거 | reward로 쓰는 방식 |
| --- | --- | --- |
| `FIFA_PHASE` | FIFA Football Language. in-possession: build-up, progression, final third, counter-attack. out-of-possession: high/mid/low block, counter-press, recovery를 tracking data로 자동화한다고 설명한다. | `phaseMatchScore`, counter-attack/counter-press/high-block/low-block trigger |
| `VAEP` | Decroos et al., "Actions Speak Louder Than Goals", KDD 2019. 행동의 공격/수비 기여를 game outcome 변화로 평가한다. | xT/EPV/VAEP delta, action value, risk-adjusted progression |
| `PRESS` | Merckx et al., "Measuring the Effectiveness of Pressing in Soccer"; pressing을 tracking data와 expert rule로 식별하고, 공 회복 이득과 수비 구조 이탈 비용의 trade-off로 본다. Bekkers의 pressing intensity도 위치/속도/방향/time-to-intercept를 사용한다. | pressCount, approachSpeed, pass-lane blocking, isolatedPress penalty, bypassedPress penalty |
| `POS_DIRECT` | Kempe et al., "Possession vs. Direct Play: Evaluating Tactical Behavior in Elite Soccer". 점유형/직접형 전술 행동을 측정 대상으로 둔다. | possession retention vs directness, longPassTerritoryGain, build-up pass count penalty/bonus |
| `PITCH_CONTROL` | Spearman 계열 pitch control과 Wu & Swartz pitch-control metric. 위치, 속도, 가속, 도착 시간으로 공간 소유/패스 가능성을 평가한다. | passProbabilityQuality, pitchControlGain, support triangle, 2v1, isolation |
| `FORMATION` | Frontiers 2024 formation-identification survey. event/tracking data 기반 팀/포지션 레벨 formation identification 원칙을 정리한다. | shapeScore, lineHeight/width, two-bank spacing, lane occupation |
| `REST_DEF` | rest defence/counterpressing 연구. defensive transition 성공, 공 근처 group behavior, 공 뒤 인원, 위험지역 통제 중요성을 다룬다. | restDefenceMaintained, defensiveRestShapeBeforeRegain, fullbackOvercommit penalty |
| `TACTIC_AI` | TacticAI, Nature Communications 2024. set-piece에서 tracking/geometry 기반으로 수신자/슈팅/위치 조정을 예측·생성하고 전문가 검증을 받았다. | setPieceStyleScore, geometry-based role positioning, corner/free-kick pattern validation |
| `GRF` | Google Research Football과 GRF MARL 연구. football RL은 sparse reward, academy curriculum, multi-agent benchmark, population/self-play가 필요하다는 벤치마크 근거. | curriculum, reward decomposition, tactic-conditioned population |
| `SIM_HYP` | 위 근거들을 게임 AI 목적에 맞게 조합한 시뮬레이션 설계 가설. | 전술별 weight, anti-style penalty 크기, viewerQuality 보정 |

기본 구조:

```txt
styleScore(style) =
  sum_i w_pos_i(style) * metricMatch_i
  - sum_j w_neg_j(style) * antiMetric_j

tacticFidelity =
  0.35 * shapeScore
  + 0.25 * actionDistributionScore
  + 0.20 * phaseTriggerScore
  + 0.12 * transitionScore
  + 0.08 * setPieceStyleScore
```

Step 1 metadata 형태:

```ts
type TacticRewardProfile = {
  styleName: string;
  positiveAnchors: RewardAnchor[];
  antiStyleAnchors: RewardAnchor[];
  phaseWeights: Partial<Record<MatchPhase, number>>;
  metricTargets: Record<string, number | [number, number]>;
};
```

전술별 기준:

| 전술 | 보상해야 하는 행동 | 깎아야 하는 행동 | 측정 지표 |
| --- | --- | --- | --- |
| 티키타카 | 짧은 패스 삼각형, 3자 패스, 압박 유도 후 탈압박, 잃자마자 5초 압박 | 의미 없는 백패스 루프, 무리한 롱볼, 중앙 밀도 없는 횡패스 | shortPassRatio, triangleSupport, thirdManPass, regain5s, xTDelta |
| 점유 축구 | 안정적 점유, 패스 각도 유지, 좌우 전환, 위험 낮은 전진 | 슛 없이 돌리기만 함, 압박권에서 무의미한 보유, 낮은 xT 패스 반복 | possessionRetention, passProbability, switchSuccess, progressivePassRate |
| 게겐프레싱 | 상실 직후 3~5초 counterpress, 주변 2~4명 압박, 패스길 차단, 높은 위치 탈취 후 빠른 슛 | 잃고 바로 후퇴, 혼자 달려드는 압박, 압박 우회당해 뒷공간 노출, 파울 남발 | counterpress5s, highTurnover, PPDA, coverShadow, regainToShotTime |
| 하이프레스 | 상대 GK/CB 빌드업 압박, 터치라인/한쪽으로 몰기, forced long ball, 압박 trap | 라인만 높고 압박 거리 멂, 1차 압박 실패 후 rest defence 붕괴 | opponentBuildUpDisruption, forcedLongBall, pressTrapSuccess, backlineCover |
| 토탈 풋볼 | 포지션 교대 후 shape 유지, 빈 자리 커버, 다역할 움직임, 전방 압박과 점유 결합 | 모두가 공만 따라감, 교대 후 역할 공백, CB/DM 무단 이탈 | roleRotationCovered, shapeAfterRotation, multiRoleSupport, compactness |
| 윙 플레이 | 폭 확보, overlap/underlap, wide 2v1, early cross/cutback, far-post runner | 윙이 안으로만 몰림, fullback 이탈 후 역습 노출, 낮은 품질 크로스 spam | wideTouch, overlapTiming, underlapTiming, crossQuality, cutbackxA |
| 미드블록 | 중간 지역 compactness, 패스길 차단, 압박 trigger 때만 전진, 탈취 후 안정 전개 | 무작정 전방 압박, 너무 깊게 내려앉음, 라인 간격 벌어짐 | midBlockCompactness, laneCover, triggerPressSuccess, verticalGap |
| 역습 축구 | 탈취 후 1~3초 내 전진 패스/운반, runner timing, 적은 패스로 슛/크로스, 위험 통제 | 탈취 후 느린 백패스, 의미 없는 롱볼, 수비 shape 깨고 전원 전진 | verticalityAfterRegain, regainToBoxTime, runnerAheadCount, counterxG |
| 롱볼 직접 | targetMan 경합, 세컨볼 구조, territory gain, 빠른 박스 진입 | 아무에게나 걷어내기, 세컨볼 주변 지원 없음, 짧은 패스 루프 | longPassTerritoryGain, targetContact, secondBallDensity, fieldTilt |
| 빗장 수비 | 낮은 라인, 중앙 봉쇄, 박스 앞 compactness, 크로스 방어, 효율적 전환 | 라인이 불필요하게 높음, CB 이탈, 측면/하프스페이스 열림 | lowBlockCompactness, boxProtection, centralDeny, clearanceQuality |
| 텐백 수비 | 5-4/4-5 라인 유지, 슈팅 각도 차단, 박스 밀도, 시간 관리 | 풀백/윙 과도한 전진, 공만 보고 라인 붕괴, 무리한 점유 | deepCompactness, shotAngleDenied, boxDensity, lowRiskClearance |
| 밸런스 | 상황별 점유/전환/압박 균형, 전술 과몰입 없음, 안정적 shape | 한 스타일로 과도하게 쏠림, 라인/폭 목표 흔들림 | balancedPhaseMix, shapeStability, riskAdjustedEPV |
| 포지셔널 플레이 | 5레인 점유, 3-2 rest shape, 압박 유도 후 전진, half-space receive, overload-to-isolate | 같은 레인 중복, rest defence 없음, 측면 고립만 반복 | laneOccupation, restShape32, halfSpaceReceive, overloadSwitch |
| 수직적 티키타카 | 짧지만 전진적인 패스, one-touch/third-man, 중앙 line break, 빠른 tempo | 짧은 패스만 하고 전진 없음, 무리한 긴 패스, 템포 과속 실수 | verticalShortPass, lineBreak, oneTouchChain, tempoMatch |
| 플루이드 역습 | 탈취 후 유동적 위치 교환, winger/10/9 연계, 빠른 switch, runner 선택 다양성 | 고정 루트만 반복, 전진 타이밍 늦음, 수비 복귀 지연 | transitionVariety, fluidRunnerSwap, quickSwitch, counterDecisionQuality |
| 두 줄 수비 | 4-4-2/4-4-1-1 간격, 수평 이동, half-space 봉쇄, 전방 2명 압박 유도 | 두 줄 사이 공간 큼, 한 명만 튀어나감, 측면 전환 대응 늦음 | twoBankSpacing, horizontalShift, halfSpaceDeny, frontTwoScreen |
| 루트 원 | 즉시 전방 전달, targetMan hold-up, flick-on, 세컨볼 압박, territory 우선 | 후방 빌드업 오래 함, target 없는 롱볼, 세컨볼 반응 없음 | directness, holdUpSuccess, flickOn, secondBallPress |
| 비대칭 아이솔레이션 | 한쪽 overload로 상대 이동, 빠른 반대 전환, isolated winger 1v1, 약측 침투 | 양쪽 모두 어중간, 전환 느림, isolation 후 지원 없음 | overloadPull, switchSpeed, isolation1v1, weakSideRun |
| 가짜 9번 시스템 | 9번 하강, CB 유인, 2선 침투, 중앙 overload, wall pass | 9번이 계속 박스 안 고정, 하강 후 침투 없음, 중앙 과밀 turnover | falseNineDrop, cbPulled, runnerBehind, centralCombination |
| 실리 축구 | 낮은 risk, 세트피스/전환 효율, 필요할 때만 압박, 리드 상황 관리 | 불필요한 모험 패스, 풀백 과전진, 점유 욕심으로 역습 허용 | riskControl, setPieceValue, leadProtection, efficientTransition |

전술별 근거 매핑:

| 전술 | 근거 코드 |
| --- | --- |
| 티키타카 | `FIFA_PHASE`, `VAEP`, `PITCH_CONTROL`, `FORMATION`, `PRESS`, `SIM_HYP` |
| 점유 축구 | `FIFA_PHASE`, `POS_DIRECT`, `VAEP`, `PITCH_CONTROL`, `SIM_HYP` |
| 게겐프레싱 | `FIFA_PHASE`, `PRESS`, `REST_DEF`, `VAEP`, `GRF`, `SIM_HYP` |
| 하이프레스 | `FIFA_PHASE`, `PRESS`, `PITCH_CONTROL`, `REST_DEF`, `SIM_HYP` |
| 토탈 풋볼 | `FORMATION`, `PITCH_CONTROL`, `VAEP`, `SIM_HYP` |
| 윙 플레이 | `FIFA_PHASE`, `PITCH_CONTROL`, `VAEP`, `FORMATION`, `SIM_HYP` |
| 미드블록 | `FIFA_PHASE`, `PRESS`, `FORMATION`, `PITCH_CONTROL`, `SIM_HYP` |
| 역습 축구 | `FIFA_PHASE`, `VAEP`, `REST_DEF`, `POS_DIRECT`, `GRF`, `SIM_HYP` |
| 롱볼 직접 | `POS_DIRECT`, `VAEP`, `PITCH_CONTROL`, `SIM_HYP` |
| 빗장 수비 | `FIFA_PHASE`, `FORMATION`, `PITCH_CONTROL`, `REST_DEF`, `SIM_HYP` |
| 텐백 수비 | `FIFA_PHASE`, `FORMATION`, `PITCH_CONTROL`, `REST_DEF`, `SIM_HYP` |
| 밸런스 | `FIFA_PHASE`, `VAEP`, `FORMATION`, `SIM_HYP` |
| 포지셔널 플레이 | `FORMATION`, `PITCH_CONTROL`, `VAEP`, `REST_DEF`, `SIM_HYP` |
| 수직적 티키타카 | `POS_DIRECT`, `VAEP`, `PITCH_CONTROL`, `FIFA_PHASE`, `SIM_HYP` |
| 플루이드 역습 | `FIFA_PHASE`, `VAEP`, `PITCH_CONTROL`, `REST_DEF`, `SIM_HYP` |
| 두 줄 수비 | `FIFA_PHASE`, `FORMATION`, `PRESS`, `PITCH_CONTROL`, `SIM_HYP` |
| 루트 원 | `POS_DIRECT`, `VAEP`, `PITCH_CONTROL`, `SIM_HYP` |
| 비대칭 아이솔레이션 | `PITCH_CONTROL`, `VAEP`, `FORMATION`, `SIM_HYP` |
| 가짜 9번 시스템 | `PITCH_CONTROL`, `VAEP`, `FORMATION`, `SIM_HYP` |
| 실리 축구 | `VAEP`, `REST_DEF`, `TACTIC_AI`, `FIFA_PHASE`, `SIM_HYP` |

게겐프레싱 상세:

```txt
R_gegenpress =
  + counterpress5sSuccess
  + nearBallDensityAfterLoss(2..4 players)
  + passingLaneBlockedAfterLoss
  + highRegainEPV
  + quickShotOrBoxEntryAfterRegain
  - isolatedPress
  - bypassedPressBackspaceExposure
  - foulSpam
  - slowRetreatWithoutPressure
```

역습 축구 상세:

```txt
R_counter =
  + verticalFirstActionWithin2s
  + runnerAheadOfBall
  + regainToFinalThirdSpeed
  + lowPassCountChanceCreation
  + defensiveRestShapeBeforeRegain
  - slowRecycleAfterRegain
  - hopelessLongBallWithoutRunner
  - fullbackOvercommitBeforeTurnover
  - sterilePossession
```

핵심 주의:

- 전술 보상은 action을 강제하면 안 된다. 같은 상황에서도 좋은 선택이 여러 개 있어야 한다.
- positive anchor는 "그 행동을 했는가"가 아니라 "그 행동이 상황에 맞았는가"로 평가한다.
- anti-style penalty는 다양성을 죽이지 않을 정도로 낮게 시작하고, evaluation에서 전술이 흐려질 때 올린다.
- 최종 fine-tuning에서는 `score` 비중을 올려도, 전술별 reward profile은 유지해야 한다.

### 5.2.2 선수별 agent reward credit assignment

전술 reward를 팀 전체에만 주면 22명 중 어떤 선수가 잘했는지 흐려진다. 반대로 개인 reward를 너무 많이 주면 팀 전술이 깨진다. 따라서 학습 reward는 **team shared reward + role-local reward + event owner reward + off-ball support reward**로 분해한다.

근거:

| 코드 | 근거 | 설계 반영 |
| --- | --- | --- |
| `MAPPO_CTDE` | MAPPO는 cooperative multi-agent 환경에서 decentralized actor와 centralized critic을 쓰는 강한 baseline이다. | 실행 actor는 자기 관측만 보고, 학습 critic은 전체 22명 상태로 credit을 안정화한다. |
| `COMA_CF` | COMA는 한 agent 행동을 counterfactual baseline과 비교해 credit assignment를 다룬다. | `would_team_value_drop_if_agent_i_did_not_do_this?`를 근사하는 auxiliary evaluator를 둔다. |
| `VDN_QMIX` | VDN/QMIX 계열은 team value를 agent value로 분해한다. | team tactic reward를 선수별 `contribution_i`로 나누는 decomposition target을 둔다. |
| `ON_OFF_BALL_RL` | on/off-ball soccer player action valuation 연구는 공 없는 선수 움직임도 Q-value로 평가한다. | 패스한 선수뿐 아니라 패스길 만든 선수, 침투한 선수, 커버한 선수도 reward를 받는다. |
| `VAEP` | 행동이 득점/실점 확률에 미치는 값을 평가한다. | 패스/드리블/슛/수비 행동의 `EPV/xT/VAEP delta`를 event owner와 관련 off-ball player에게 분배한다. |
| `PITCH_CONTROL` | 위치, 속도, 도착 시간 기반으로 공간 소유와 패스 가능성을 측정한다. | support angle, passing lane, 2v1, isolation, shot angle denial을 선수별 reward로 쪼갠다. |
| `PRESS` | pressing 연구는 proximity만이 아니라 접근 속도, 방향, 패스길 차단, 구조 이탈 비용을 본다. | 압박 선수, 커버 선수, rest-defender를 따로 보상하고 isolated press는 깎는다. |
| `FIFA_PHASE` | FIFA Football Language는 build-up/progression/final third/counter-attack/high block/mid block/low block/counter-press/recovery를 구분한다. | phase별로 어떤 role이 어떤 reward를 받을지 다르게 둔다. |

기본 수식:

```txt
R_agent_i =
  0.20 * R_team_shared
  + 0.25 * R_tactic_role_i
  + 0.20 * R_event_credit_i
  + 0.15 * R_offball_credit_i
  + 0.10 * R_shape_anchor_i
  + 0.05 * R_rule_discipline_i
  + 0.05 * R_persona_condition_i
```

전술별 fine-tuning에서는 weight를 바꾼다. 예: 게겐프레싱은 `R_tactic_role_i`와 `R_offball_credit_i` 중 pressure/cover 비중을 올리고, 티키타카는 support angle/third-man/pass option 비중을 올린다.

credit 분배 규칙:

```txt
anchorReward_i =
  anchorValue
  * roleResponsibility(i, phase, tactic)
  * actionRelevance(i, anchor)
  * counterfactualContribution(i, anchor)
```

- `roleResponsibility`: 그 상황에서 해당 role이 원래 해야 하는 일인가.
- `actionRelevance`: 실제 행동이 reward anchor와 가까운가.
- `counterfactualContribution`: 그 선수가 안 했으면 팀 value가 얼마나 떨어졌을지의 근사.
- 처음에는 정확한 counterfactual model 대신 rule-based proxy로 시작하고, 이후 critic auxiliary head로 학습한다.

reward 지급 시점:

| 시점 | 주는 reward | 예 |
| --- | --- | --- |
| 매 decision tick(5~10Hz) | shape, support, pressure, cover, spacing | 삼각형 유지, passing lane 생성, 압박 거리 감소 |
| event 발생 시 | pass/carry/shot/tackle/interception/foul | line-breaking pass 성공, 무리한 태클 파울 |
| short horizon(1~5초) | transition, counterpress, counterattack | 상실 후 5초 내 탈취, 탈취 후 3초 내 박스 진입 |
| possession horizon(다음 3~10 actions) | VAEP/xT/EPV delta | 침투가 직접 터치 없이 슈팅 공간 생성 |
| terminal/episode | goal/concede/win/loss | 득점, 실점, 승패 |

#### 5.2.2.1 On-ball 선수 reward

공을 가진 선수는 action owner credit을 받는다. 단순 성공/실패가 아니라 상황 적합성 기준이다.

| 상황 | 보상 | 페널티 | 근거 |
| --- | --- | --- | --- |
| 빌드업에서 압박 약함 | 안전한 짧은 패스, pivot/CB 연결, first line break | 압박 없는데 무의미한 클리어 | `FIFA_PHASE`, `POS_DIRECT`, `VAEP` |
| 빌드업에서 압박 강함 | bounce pass, third-man, switch, target escape | 중앙 위험지역 턴오버 | `PRESS`, `PITCH_CONTROL`, `VAEP` |
| 전진 패스 가능 | line-breaking pass, half-space receive 유도 | 낮은 xT 횡패스 반복 | `VAEP`, `PITCH_CONTROL` |
| 파이널서드 | cutback, high-xG shot, extra pass, weak-side switch | 낮은 각도 슛 남발, 크로스 spam | `VAEP`, `PITCH_CONTROL` |
| 역습 시작 | 1~3초 내 전진 패스/운반 | 탈취 직후 느린 백패스, 고립 롱볼 | `FIFA_PHASE`, `POS_DIRECT`, `VAEP` |
| 게겐프레싱 탈취 직후 | 빠른 슛/박스 진입/위험 패스 | 탈취 후 tempo 죽임 | `PRESS`, `VAEP` |

#### 5.2.2.2 Off-ball 공격 선수 reward

축구에서 대부분 시간은 공 없이 움직인다. off-ball credit이 없으면 에이전트가 공만 따라다니거나 패스 받을 때만 움직인다.

| 역할 | reward 조건 | 측정 proxy | 적용 전술 |
| --- | --- | --- | --- |
| support player | 볼 소유자에게 30~60도 패스 각도, 적절 거리, 압박 밖 option 제공 | passAngleQuality, supportDistance, pressureFreeWindow | 티키타카, 점유, 포지셔널 |
| third-man | A->B 패스 뒤 C가 다음 전진 option이 되는 위치 선점 | thirdManAvailability, nextPassEPV | 티키타카, 수직적 티키타카 |
| runner behind | 수비 라인 뒤 침투로 CB를 끌거나 through lane 생성 | lineStretch, defenderPin, throughLaneOpen | 역습, 플루이드 역습, 가짜 9 |
| half-space receiver | 8/10/mezzala가 라인 사이에서 body orientation 좋게 받기 | betweenLineReceive, turnAngle, pressureAtReceive | 포지셔널, 수직적 티키타카 |
| wide outlet | 터치라인 폭 유지로 switch option 제공 | widthOccupation, weakSideAvailability | 점유, 윙 플레이, 아이솔레이션 |
| overlap runner | winger가 상대 fullback을 고정한 뒤 외곽 침투 | overlapTiming, 2v1Created, cutbackWindow | 윙 플레이, 비대칭 아이솔레이션 |
| underlap runner | winger가 넓게 잡고 half-space 안쪽 침투 | underlapTiming, boxEntryLane | 윙 플레이, 포지셔널 |
| decoy run | 직접 받지 않아도 수비수 끌어 공간 생성 | defenderDragged, teammateEPVGain | 가짜 9, 토탈 풋볼 |

off-ball reward는 event owner보다 늦게 지급될 수 있다. 예: 침투 선수가 공을 못 받았어도 그 움직임 때문에 반대 winger가 1v1을 얻으면, `pitchControlGain`과 `defenderPin`으로 credit을 받는다.

#### 5.2.2.3 수비·압박 선수 reward

수비 reward는 공 뺏은 선수만 주면 안 된다. 압박한 선수, 패스길 막은 선수, 뒤에서 커버한 선수 모두 역할이 다르다.

| 상황 | 선수 유형 | reward 조건 | penalty |
| --- | --- | --- | --- |
| high press | 1st presser | ball carrier를 touchline/weak foot 방향으로 유도, 접근 속도와 angle 적합 | 혼자 직선으로 달려 제쳐짐 |
| high press | 2nd/3rd presser | 가까운 패스 option 차단, cover shadow 형성 | 같은 선상으로 겹쳐 한 패스로 모두 제쳐짐 |
| gegenpress | nearest 2~4 players | 상실 직후 3~5초 안에 ball zone 압박 밀도 형성 | 잃자마자 산개, 파울 spam |
| gegenpress | rest defenders | 공 뒤 3~4명 유지, counter lane 차단 | 전원 압박 가담 후 뒷공간 노출 |
| mid block | midfield line | line gap 유지, zone 14 차단, trigger 때만 전진 | 무작정 튀어나와 간격 붕괴 |
| low block | back line | shot angle 차단, box density 유지, cross target marking | 공만 보고 far-post runner 방치 |
| transition defence | nearest defender | delay, foul 없이 진로 늦추기 | 무리한 태클 실패 |

수비 credit 근거는 `PRESS`, `PITCH_CONTROL`, `REST_DEF`, `FIFA_PHASE`다. 특히 pressing은 단순 거리 보상이 아니라 "회복 가능성 증가 - 구조 이탈 비용"으로 계산해야 한다.

```txt
R_press_i =
  + approachAngleQuality_i
  + timeToInterceptGain_i
  + passLaneDenied_i
  + teammateCoverCompatibility_i
  - structureBreakCost_i
  - foulRisk_i
```

#### 5.2.2.4 포지션별 기본 책임 reward

같은 action도 포지션마다 의미가 다르다.

| 포지션 | 기본 local reward | 강한 penalty |
| --- | --- | --- |
| GK | set position, angle cutting, claim timing, safe distribution, sweep timing | 박스 밖 hand use, empty goal exposure, 무리한 전진 |
| CB | line control, cover depth, aerial duel, safe first pass, rest defence | 중앙 위험 턴오버, 무단 공격 가담, offside line 붕괴 |
| FB/WB | width, overlap/underlap timing, far-post cover, transition recovery | rest defence 없이 과전진, weak-side runner 방치 |
| DM/6 | pivot support, second-ball, zone 14 cover, press resistance | 압박권 무리한 턴오버, CB 앞 공간 방치 |
| CM/8 | half-space receive, third-man, counterpress link, box edge support | 양방향 복귀 지연, 라인 사이 공백 |
| AM/10 | between-line receive, killer pass, press trigger, false-nine link | 낮은 가치 볼 소유 지연, 수비 가담 완전 포기 |
| WG | width/isolation, diagonal run, cutback/cross quality, backpress | 측면 수비 방치, 무리한 드리블 반복 |
| ST/9 | pin CB, run behind, hold-up, pressing angle, box occupation | offside spam, 압박 trigger 불참, 고립 슛 남발 |

#### 5.2.2.5 전술별 선수 reward 예시

| 전술 | 누가 보상 받는가 | 언제 받는가 |
| --- | --- | --- |
| 티키타카 | passer, receiver, third-man, nearby support 2명 | 짧은 패스 체인 중 각도/거리/압박 회피 구조가 유지될 때 |
| 게겐프레싱 | 공 잃은 주변 2~4명, 패스길 막는 2선, rest defence | 상실 후 3~5초 안에 압박망 형성, high regain, 빠른 슈팅으로 이어질 때 |
| 역습 축구 | ball winner, 첫 전진 passer/carrier, ahead runner, weak-side runner | 탈취 후 1~3초 안에 전진하고 수적/공간 우위를 만들 때 |
| 롱볼 직접/루트 원 | kicker, targetMan, flick-on runner, second-ball midfielders | 긴 패스가 territory gain/경합/세컨볼 압박 구조로 이어질 때 |
| 윙 플레이 | winger, overlapping fullback, underlapping 8, far-post runner | wide 2v1, cutback/cross lane, far-post occupation이 생길 때 |
| 포지셔널 플레이 | lane holders, inverted fullback, half-space 8/10, rest defenders | 5레인 점유와 3-2 rest shape가 동시에 유지될 때 |
| 두 줄/미드블록 | midfield line, back line, front screen | 라인 간격과 수평 이동으로 중앙 진입을 막을 때 |
| 텐백/빗장 | CB/FB/DM/wing back, box protectors | 박스 밀도, 슈팅 각도 차단, cross target denial이 성공할 때 |
| 가짜 9 | false nine, runner behind, 8/10, winger | 9번 하강으로 CB를 끌고 2선 침투/중앙 overload가 생길 때 |

#### 5.2.2.6 반례와 reward exploit 방지

- support reward exploit: 선수들이 공 주변에 몰리면 triangle 점수는 오를 수 있다. 해결: lane diversity, minimum spacing, rest defence penalty.
- press reward exploit: 전원이 압박하면 pressCount는 오른다. 해결: bypass risk, backspace exposure, rest-defender requirement.
- possession reward exploit: 백패스 루프. 해결: xT/EPV delta, progressive intent, repetition penalty.
- off-ball run exploit: 침투만 반복. 해결: offside risk, stamina cost, receiver availability, team shape cost.
- defender reward exploit: 텐백이 항상 최고. 해결: score/chanceQuality/progression과 style-specific target을 같이 둔다.

Step 1 구현 범위:

- `AgentRewardBreakdown` 타입.
- `RewardCreditSource` enum.
- `RoleRewardResponsibility` metadata.
- `TacticRewardProfile` 안에 `agentCreditRules` 필드.
- 실제 counterfactual critic이나 pitch-control 계산은 Step 3 이후.

### 5.2.3 MOM 보너스와 포지션별 경쟁학습

경기 종료 후 선수별 누적 reward는 모두 다르다. 이 점수를 활용해 상위 선수에게 추가 보상을 주는 것은 좋다. 다만 raw reward만으로 MOM을 뽑으면 공격수/공격형 미드필더가 과보상되고, 골키퍼/센터백/수비형 미드필더처럼 공 점유 기회가 적은 포지션은 불리하다. 따라서 MOM 보너스는 **역할별 기대 기회 보정 + 전술별 phase 노출 보정 + 팀 전술 threshold**를 통과한 뒤 지급한다.

근거:

- PBT/league/self-play: population 안에서 좋은 policy를 남기고 약한 policy가 강한 policy를 따라잡게 만드는 구조는 AlphaStar, PBT, GRF MARL 연구와 맞다.
- MAPPO/COMA/VDN-QMIX: team reward를 agent별 contribution으로 나누고 중앙 critic/가치분해/counterfactual로 credit을 안정화한다.
- on/off-ball soccer action valuation: 공 없는 선수의 움직임도 Q-value와 contribution으로 평가 가능하다.
- VAEP/pitch control/pressing: 공격 이벤트, 공간 장악, 압박, 수비 구조 유지 같은 role별 비교 가능한 feature를 제공한다.

핵심 원칙:

1. MOM 보너스는 `score`와 `tacticFidelity`를 대체하지 않는다.
2. 같은 포지션/비슷한 역할끼리 비교한다.
3. 기회가 적은 역할은 raw total이 아니라 role-normalized percentile로 비교한다.
4. 팀 전술을 망치고 개인 점수만 올린 선수는 MOM 후보에서 제외한다.
5. 보너스는 작게 시작한다. 너무 크면 이타적 팀 플레이가 무너진다.

MOM 점수:

```txt
roleNormalizedScore_i =
  zscore(
    playerReward_i / minutesPlayed_i,
    cohort = (roleCohort, tacticId, phaseExposureBucket)
  )

momEligibility_i =
  teamTacticFidelity >= tacticThreshold
  AND rulePenalty_i <= maxRulePenalty
  AND minutesPlayed_i >= minMinutes
  AND exploitFlags_i == 0

R_MOM_i =
  lambda_mom
  * softTopK(roleNormalizedScore_i, cohort)
  * teamResultMultiplier
  * momEligibility_i
```

권장:

- `lambda_mom`: 전체 episode reward의 2~5%로 시작.
- `teamResultMultiplier`: 승리 1.0, 무승부 0.7, 패배 0.4. 패배팀도 잘한 선수는 약간 보상해야 학습 신호가 사라지지 않는다.
- `softTopK`: 1등만 몰아주지 말고 상위 2~3명에 연속적으로 준다.
- `phaseExposureBucket`: 수비 시간이 긴 경기, 공격 시간이 긴 경기, 세트피스 많은 경기의 raw 점수 차이를 보정한다.

Step 1 metadata:

```ts
type PlayerMatchRewardSummary = {
  agentId: AgentId;
  team: TeamSide;
  role: Role | "GK";
  primaryCohort: RoleCompetitionCohort;
  memberships: RoleCompetitionMembership[];
  tacticId: TacticId;
  minutesPlayed: number;
  rawReward: number;
  roleNormalizedScore: number;
  cohortPercentile: number;
  momBonus: number;
  breakdown: AgentRewardBreakdown;
};

type MomBonusConfig = {
  lambda: number;
  topKPerTeam: number;
  topKGlobal: number;
  minMinutes: number;
  tacticFidelityThreshold: number;
  maxRulePenalty: number;
  compareWithinTactic: boolean;
  compareWithinRoleCohort: boolean;
};
```

#### 5.2.3.1 포지션별 cohort 경쟁

축구 포지션은 고정 label이 아니라 phase마다 역할이 바뀐다. 따라서 한 선수는 하나의 cohort에만 들어가면 안 된다. 예를 들어 DM은 defensive midfielder cohort가 primary지만, out-of-possession에서는 defender cohort에도 강하게 들어가고, build-up에서는 midfielder/pivot cohort에도 들어간다. CM은 경기 맥락에 따라 defensive support, central midfield, attacking support를 모두 가진다.

권장 구조는 **multi-cohort membership**이다.

```ts
type RoleCompetitionCohort =
  | "goalkeeperShotStopping"
  | "goalkeeperDistribution"
  | "defender"
  | "centerBack"
  | "fullbackWingback"
  | "midfieldDefensive"
  | "midfieldCentral"
  | "midfieldAttacking"
  | "wideMidfieldWing"
  | "forwardTarget"
  | "forwardRunner"
  | "pressingUnit"
  | "restDefenceUnit"
  | "setPieceAerial";

type RoleCompetitionMembership = {
  cohort: RoleCompetitionCohort;
  baseWeight: number;
  phaseWeights?: Partial<Record<MatchPhase, number>>;
  tacticWeights?: Partial<Record<TacticId, number>>;
};
```

최종 MOM 비교 점수:

```txt
multiCohortScore_i =
  sum_c membershipWeight(i,c,phase,tactic)
        * percentile(score_i within cohort c)

roleNormalizedScore_i =
  multiCohortScore_i / sum_c membershipWeight(i,c,phase,tactic)
```

| Cohort | 비교 대상 | 주요 normalized metric |
| --- | --- | --- |
| goalkeeperShotStopping | 모든 전술 GK 공통 | xGOT prevented proxy, angleCutting, save/parry/claim, smother timing, illegalHandling 없음 |
| goalkeeperDistribution | 전술별 GK | shortBuildUp release, long distribution, quick throw, press bait, turnover risk |
| defender | DF/DM 중 수비 phase 책임자 | line integrity, cover, delay, shot angle denial |
| centerBack | CB끼리 | line control, aerial duel, rest defence, progressive first pass, shot block |
| fullbackWingback | FB/WB끼리 | overlap/underlap timing, width, recovery run, far-post cover |
| midfieldDefensive | DM/6 + 수비형 CM | pivot support, zone14 cover, second ball, pressure escape |
| midfieldCentral | CM/8 + box-to-box | half-space support, third-man, counterpress link, box edge occupation |
| midfieldAttacking | AM/10 + 공격형 CM | between-line receive, chance creation, press trigger, risk control |
| wideMidfieldWing | WG/WM/WB 일부 | isolation, width, cutback/cross quality, backpress |
| forwardTarget | targetMan/hold-up ST | hold-up, flick-on, aerial contest, layoff, CB pin |
| forwardRunner | poacher/runner ST/WG | run behind, box touch, offside timing, pressing angle |
| pressingUnit | 전방/중원/측면 압박 참여자 | approach angle, cover shadow, trap close, regain |
| restDefenceUnit | CB/DM/FB/inverted FB | counter lane control, backspace cover, second-ball structure |
| setPieceAerial | CB/ST/GK/targetMan | aerial timing, block/screen legality, second ball |

이렇게 해야 센터백이 공격수와 raw reward로 경쟁하지 않고, 센터백답게 잘한 것끼리 비교된다.

포지션별 기본 membership 예:

| 포지션/역할 | 기본 cohort membership |
| --- | --- |
| GK | `goalkeeperShotStopping .70`, `goalkeeperDistribution .30` |
| CB | `centerBack .55`, `defender .25`, `restDefenceUnit .15`, `setPieceAerial .05` |
| FB/WB | `fullbackWingback .45`, `defender .20`, `wideMidfieldWing .20`, `restDefenceUnit .15` |
| DM/6 | `midfieldDefensive .45`, `defender .25`, `midfieldCentral .15`, `restDefenceUnit .15` |
| CM/8 | `midfieldCentral .45`, `midfieldDefensive .20`, `midfieldAttacking .20`, `pressingUnit .15` |
| AM/10 | `midfieldAttacking .50`, `midfieldCentral .20`, `forwardRunner .15`, `pressingUnit .15` |
| WG/WM | `wideMidfieldWing .45`, `forwardRunner .25`, `pressingUnit .15`, `midfieldAttacking .15` |
| ST target | `forwardTarget .55`, `forwardRunner .15`, `pressingUnit .15`, `setPieceAerial .15` |
| ST runner/poacher | `forwardRunner .55`, `forwardTarget .15`, `pressingUnit .20`, `midfieldAttacking .10` |

phase별 가중 예:

- build-up: GK distribution, CB first pass, DM pivot, CM support weight 증가.
- progression/final third: half-space, wide, attacking midfield, forward runner weight 증가.
- defensive transition: restDefenceUnit, pressingUnit, defender weight 증가.
- low block: defender, midfieldDefensive, box protection weight 증가.
- set piece: setPieceAerial, goalkeeperShotStopping, restDefenceUnit weight 증가.

전술별 조정:

- 포지셔널 플레이: inverted fullback은 `midfieldDefensive/midfieldCentral/restDefenceUnit` 비중 증가.
- 윙 플레이: fullback/wingback은 `wideMidfieldWing` 비중 증가.
- 게겐프레싱: 전방/중원 모두 `pressingUnit` 비중 증가.
- 텐백/빗장: wing/FB도 `defender` 비중 증가.
- 가짜 9번: ST는 `midfieldAttacking`과 `forwardRunner` 비중 증가.
- 루트 원: ST는 `forwardTarget`, CM/DM은 `second-ball/restDefenceUnit` 비중 증가.

#### 5.2.3.2 골키퍼는 universal head와 tactic head를 분리

네 말처럼 골키퍼의 막는 능력은 전술을 초월해 공통성이 크다. 반면 배급은 전술 의존성이 크다. 따라서 GK 학습은 두 갈래로 나눈다.

```txt
GK reward =
  0.65 * R_gk_universal
  + 0.25 * R_gk_tactic_distribution
  + 0.10 * R_gk_persona_condition
```

`R_gk_universal`:

- set position.
- shot angle narrowing.
- save/parry/punch/catch decision.
- claim timing.
- smother 1v1 timing.
- sweep timing when legal.
- rebound danger control.
- illegal handling/foul/empty goal exposure penalty.

이 부분은 모든 전술 GK를 한 population/cohort로 묶어 경쟁학습한다. 전술과 무관하게 "잘 막는 골키퍼"를 만든다.

`R_gk_tactic_distribution`:

- 티키타카/점유/포지셔널: roll/short pass, CB/DM 연결, 압박 유도 후 안전 탈출.
- 게겐프레싱/하이프레스: 빠른 재개, 높은 위치에서 탈취 후 즉시 연결.
- 역습/플루이드 역습: quick throw, winger/runner 방향 빠른 배급.
- 롱볼/루트 원: punt/drop kick, targetMan 방향, 세컨볼 구조.
- 텐백/빗장/실리: 위험 낮은 배급, 시간 관리, 무리한 중앙 패스 회피.

이 부분은 전술별 GK distribution head 또는 tactic-conditioned head로 학습한다.

권장 구조:

```txt
Goalkeeper Actor
  shared universal trunk:
    positioning / shot-stopping / claim / smother / sweep
  tactic-conditioned distribution head:
    roll / throw / short pass / punt / drop kick / time-management
```

#### 5.2.3.3 MOM 경쟁학습 운영

훈련 운영:

1. 경기마다 `PlayerMatchRewardSummary`를 저장한다.
2. 역할 cohort별 leaderboard를 만든다.
3. 상위 percentile trajectory를 behavior cloning dataset에 추가한다.
4. 같은 cohort의 policy population끼리 league를 만든다.
5. 낮은 percentile policy는 상위 policy snapshot과 경기해 약점을 학습한다.
6. PBT로 `lambda_mom`, entropy, learning rate, reward weight를 조정한다.

주의:

- 같은 팀 안에서 동료끼리 경쟁심만 커지면 패스 안 하는 정책이 생긴다. MOM 보너스는 team score/tacticFidelity threshold 아래에서는 거의 주지 않는다.
- 공격수 MOM만 많아지면 role normalization을 강화한다.
- 골키퍼가 세이브 기회를 일부러 늘리게 만들면 안 된다. `preventableShotAllowed`와 defensive organization penalty를 같이 둔다.
- 수비수가 슈팅 블록만 노리고 라인 깨면 안 된다. `lineIntegrity`와 `shotAngleDenied`를 같이 본다.

Step 1 구현 범위:

- `RoleCompetitionCohort` 타입.
- `RoleCompetitionMembership` 타입.
- `PlayerMatchRewardSummary` 타입.
- `MomBonusConfig` 기본값.
- `GoalkeeperRewardSplit` metadata.
- 실제 leaderboard, PBT, BC dataset mining은 Step 6 이후.

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

### 5.6 viewerQuality 수학화와 anti-jittering

`viewerQuality`가 정성 항목으로 남으면 policy가 "이기지만 보기 흉한" 방향으로 갈 수 있다. 시청 품질은 작은 weight(기본 0.02)지만 명확한 수식이 필요하다.

근거:

- CAPS/Grad-CAPS 등 action smoothness 연구는 RL policy의 고주파 oscillation/jerky action을 줄이기 위해 action 변화 regularization을 사용한다.
- football passing network 연구는 pass graph, centrality, motifs, temporal network가 팀 스타일과 조직성을 설명할 수 있음을 보인다.
- IFAB/FIFA의 match-flow 관련 law change는 지연 재개, goalkeeper hold, substitution delay 같은 tempo disruption을 줄이려는 방향이다.

전체:

```txt
R_viewerQuality =
  - w_jitter * J_action
  - w_dead  * D_deadBall
  - w_loop  * L_deadLoop
  + w_ent   * E_passNetwork
  + w_event * meaningfulEventRate
```

#### 5.6.1 Jittering Penalty

선수 target point/body orientation/action type이 decision tick마다 크게 뒤집히면 시청 품질이 떨어지고, 실제 축구 움직임처럼 보이지 않는다.

```txt
J_action_i =
  clamp01(
    ||targetPoint_t - targetPoint_{t-1}|| / pitchDiag
    + angleDiff(bodyAngle_t, bodyAngle_{t-1}) / pi
    + actionSwitchCost(actionType_t, actionType_{t-1})
  )

R_jitter = - mean_i J_action_i
```

예외:

- 공이 튀거나 소유권이 바뀐 직후.
- tackle/shot/block/save 같은 reactive action.
- transition 1~2초 window.

#### 5.6.2 Dead-ball Time Penalty

스로인, 프리킥, 코너, 골킥은 준비가 필요하지만 너무 길면 지루하다. 실제 law profile과 match-flow 원칙을 기준으로 setup budget을 둔다.

```txt
D_deadBall =
  max(0, setupElapsedSec - setupBudgetSec(restartKind, lawProfile))

R_deadBall = - k_dead * D_deadBall
```

권장 budget:

- throw-in: 3~5초.
- goal kick: 5~8초.
- corner/free-kick: 6~12초. 단 세트피스 run-up/자리잡기 animation은 허용.
- goalkeeper hand control: law profile의 6초/8초 limit와 연결.

#### 5.6.3 Pass Network Entropy

센터백 두 명만 90분 내내 공을 주고받는 루프는 축구 성능보다 viewerQuality를 크게 해친다. 패스 네트워크 entropy와 centralization을 본다.

```txt
p_e = passes(edge e) / totalPasses
passEntropy = - sum_e p_e * log(p_e)
normalizedEntropy = passEntropy / log(numActiveEdges)

centralizationPenalty =
  max(0, topEdgeShare - topEdgeThreshold)
  + max(0, topPlayerTouchShare - topPlayerThreshold)

E_passNetwork =
  normalizedEntropy
  - centralizationPenalty
```

전술별 예외:

- 루트 원/롱볼 직접은 entropy가 낮아도 targetMan/secondBall 구조가 있으면 penalty 완화.
- 텐백/실리 축구는 낮은 entropy 자체보다 위험지역 turnover와 무의미한 반복을 더 크게 본다.
- 티키타카/점유는 entropy가 너무 낮으면 dead loop penalty를 크게 준다.

#### 5.6.4 Meaningful Event Rate

시청용 경기에서는 일정 시간마다 의미 있는 장면이 있어야 한다.

```txt
meaningfulEvent =
  shot
  | boxEntry
  | lineBreakingPass
  | successfulPressRegain
  | 1v1Isolation
  | dangerousCrossCutback
  | setPieceFirstContact

meaningfulEventRate =
  eventsPerMinute(window=5min)
```

너무 높게 강제하면 농구처럼 난타전이 된다. 전술별 expected range로 맞춘다.

Step 범위:

- Step 1: `ViewerQualityMetrics`, `PassNetworkWindow`, `ActionSmoothnessState` 타입.
- Step 3: analytics lite에서 계산.
- Step 6: reward에 작은 weight로 연결.

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

## 14. MVP 실행 범위와 범위 통제

이 보고서는 최종 연구 로드맵이다. 그대로 한 번에 구현하면 범위가 터진다. 1차 목표는 "완전한 11v11 MARL"이 아니라 **재현 가능한 headless football engine + dynamic anchoring scripted baseline + 작은 시나리오 RL**이다.

### 14.1 1차 MVP 목표

1차 MVP 문장:

> 축구 룰이 안정적으로 동작하는 headless engine 위에서 dynamic anchoring 기반 scripted baseline을 만들고, 3v2·4v2·5v5 시나리오에서 점유/게겐프레싱/역습 3전술의 일부 행동을 IPPO/MAPPO로 학습한다.

MVP 포함:

| 범위 | 포함 |
| --- | --- |
| 엔진 | deterministic seed, fixed tick, event log, replay export, batch simulation |
| 룰 | goal/out/offside/restart/basic foul/GK handling sanity |
| 전술 | 점유 축구, 게겐프레싱, 역습 축구 3종만 우선 |
| 포메이션 | 4-3-3, 4-2-3-1, 4-4-2 우선 |
| AI | dynamic anchoring scripted baseline |
| RL | 3v2 counter, 4v2 rondo, 5v5 press/counter scenario |
| Reward | score/progression/tacticFidelity/shape/role 정도로 축소 |
| 평가 | replay, reward breakdown, tacticFidelity, dead-loop count |

MVP 제외:

| 제외 | 이유 |
| --- | --- |
| 전술 20종 동시 학습 | reward 해석 불가능, 실험 공간 과대 |
| full 11v11 pure MARL | credit assignment와 sparse reward 과대 |
| coach RL | 선수/엔진 안정화 전 복잡도 증가 |
| opponent profiler 학습 | 상대 전술 변화 실험 전까지 보류 |
| 공 회전 full physics | 타입만 두고 물리 효과는 후순위 |
| 부상/교체 full simulation | condition 타입만 두고 scripted trigger는 후순위 |
| GNN/Transformer 실제 학습 | observation 타입/graph helper만 먼저 |
| population self-play | scripted baseline과 small-sided RL 후 |

### 14.2 단계별 축소 로드맵

| 단계 | 목표 | 핵심 구현 | 통과 기준 |
| --- | --- | --- | --- |
| 1 | 축구 엔진 검증 | 룰, seed replay, event log, restart | 같은 seed replay 100% 동일 |
| 2 | scripted baseline | dynamic anchor, simple pass/press/shot policy | 공 몰림 없이 5분 시청 가능 |
| 3 | micro RL | 1v0, 2v1, 3v2, 4v2 rondo | scripted보다 성공률 상승 |
| 4 | 전술 3종 | 점유/게겐/역습 reward profile 축소판 | 세 전술 지표가 서로 구분됨 |
| 5 | small-sided | 5v5/7v7 hybrid | dead loop, 전원 압박, 롱볼 spam 억제 |
| 6 | 11v11 hybrid | Coach/Unit script + Player 일부 RL | full replay가 축구처럼 보임 |
| 7 | population | archive/Elo/self-play | 전술별 exploit 대응 가능 |

### 14.3 MVP reward 축소판

초기 reward는 적게 시작한다. 복잡한 reward는 나중에 하나씩 켠다.

```txt
R_mvp =
  0.35 * scoreOrScenarioSuccess
  + 0.25 * progressionValue
  + 0.20 * tacticFidelityLite
  + 0.10 * shapeRoleFidelity
  + 0.05 * ruleCompliance
  + 0.05 * viewerQualityLite
```

MVP `tacticFidelityLite`:

| 전술 | positive | penalty |
| --- | --- | --- |
| 점유 축구 | safe pass angle, retention, progressive pass | dead backpass loop, risky central turnover |
| 게겐프레싱 | loss 후 3~5초 압박, high regain, pass lane block | isolated press, bypassed press, foul spam |
| 역습 축구 | regain 후 1~3초 전진, runner ahead, box entry | slow recycle, hopeless long ball, shape collapse |

### 14.4 성공 기준

정성 "축구답다"를 최소 정량으로 바꾼다.

| 항목 | MVP 기준 |
| --- | --- |
| 룰 안정성 | out/goal/offside/restart regression 통과 |
| 재현성 | seed replay hash 일치 |
| 포메이션 | 평균 shape error가 scripted 기준 이하 |
| 공 몰림 | 공 반경 N 안 팀원 과밀 횟수 threshold 이하 |
| 백패스 루프 | 같은 2명 반복 pass loop threshold 이하 |
| 전술 구분 | 점유/게겐/역습 metric 분포가 서로 분리 |
| 시청 품질 | 5분 replay에서 jitter/dead-ball/loop warning 없음 |
| 학습 성능 | micro scenario에서 scripted/random baseline보다 승률 또는 성공률 우위 |

### 14.5 실험 로그 포맷

모든 실험은 나중에 reward를 해석할 수 있게 저장한다.

```ts
type ExperimentRunLog = {
  runId: string;
  seed: number;
  scenarioId: string;
  engineVersion: string;
  policyVersion: string;
  tacticIds: [TacticId, TacticId];
  formationIds: [FormationId, FormationId];
  tickRates: TickRates;
  finalScore?: [number, number];
  scenarioSuccess?: boolean;
  metrics: EvaluationMetricsSnapshot;
  rewardBreakdown: RewardBreakdownSummary;
  eventLogPath: string;
  replayPath: string;
};
```

저장 필수:

- event log.
- reward breakdown.
- action histogram.
- tacticFidelity components.
- shape error timeline.
- pass network summary.
- replay artifact.

### 14.6 Ablation 계획

기능을 넣었으면 효과를 분리해서 봐야 한다.

| Ablation | 비교 |
| --- | --- |
| dynamic anchor | anchor on/off |
| tactic reward | tacticFidelity on/off |
| role reward | role-local reward on/off |
| action mask | hard mask vs reward penalty only |
| intent signal | signaling on/off |
| viewerQuality | jitter/dead-loop penalty on/off |
| normalized observation | world coords vs attack/ego-centric coords |
| scripted BC | random init vs behavior cloning init |

초기 priority:

1. dynamic anchor on/off.
2. tactic reward on/off.
3. normalized observation on/off.
4. scripted BC on/off.

### 14.7 실패 체크리스트

| 실패 | 감지 지표 | 대응 |
| --- | --- | --- |
| 공 몰림 | ball-near teammate density 과다 | anchor 강화, local task cap |
| 백패스 루프 | repeated edge share 과다 | xT/EPV delta, repetition penalty |
| 전원 압박 | restDefenceUnit 붕괴 | bypass risk, backspace exposure |
| 롱볼 spam | low target support long pass 과다 | second-ball structure requirement |
| 드리블 exploit | collision bypass, body overlap | collision/foul/ball control 검증 |
| 전술 붕괴 | tactic metric convergence | style-specific reward 재조정 |
| jitter | action delta 과다 | action smoothness penalty |
| dead-ball 지연 | setupElapsedSec 초과 | restart budget, ready check |

### 14.8 계산 자원 가정

초기 가정:

- 로컬 개발: scripted baseline, replay, unit/regression test.
- 단일 GPU/Colab급: micro scenario IPPO/PPO.
- 서버/멀티 워커: 5v5 이상, MAPPO, population self-play.

권장 순서:

1. CPU headless batch sim이 빠르고 deterministic한지 먼저 본다.
2. Python bridge는 JSON으로 시작하되 schema 고정 후 binary로 전환한다.
3. 11v11 학습 전, 5v5에서 rollout throughput과 reward logging 비용을 측정한다.
4. EPV/pitch-control/GNN은 throughput 병목이 확인된 뒤 throttling/cache로 붙인다.

## 15. 참고 자료

- FIFA Football Language  
  https://www.fifatrainingcentre.com/en/game/performance-analysis/football-language-analysis/the-fifa-football-language.php
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
- Deep Sets  
  https://arxiv.org/abs/1703.06114
- Set Transformer  
  https://arxiv.org/abs/1810.00825
- Graph Attention Networks  
  https://arxiv.org/abs/1710.10903
- COMA / Counterfactual Multi-Agent Policy Gradients  
  https://arxiv.org/abs/1705.08926
- QMIX paper  
  https://arxiv.org/abs/1803.11485
- VDN paper  
  https://arxiv.org/abs/1706.05296
- AlphaStar Nature paper  
  https://www.nature.com/articles/s41586-019-1724-z
- Population Based Training of Neural Networks  
  https://arxiv.org/abs/1711.09846
- Learning to Communicate with Deep Multi-Agent Reinforcement Learning  
  https://arxiv.org/abs/1605.06676
- TarMAC: Targeted Multi-Agent Communication  
  https://arxiv.org/abs/1810.11187
- Coach-Player Multi-Agent Reinforcement Learning for Dynamic Team Composition  
  https://arxiv.org/abs/2105.08692
- Options framework for temporal abstraction in reinforcement learning  
  https://www-anw.cs.umass.edu/~barto/courses/cs687/Sutton-Precup-Singh-AIJ99.pdf
- FeUdal Networks for Hierarchical Reinforcement Learning  
  https://arxiv.org/abs/1703.01161
- Opponent Modeling in Deep Reinforcement Learning  
  https://proceedings.mlr.press/v48/he16.html
- Neural Fictitious Self-Play  
  https://arxiv.org/abs/1603.01121
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
- VAEP KDD page  
  https://www.kdd.org/kdd2019/accepted-papers/view/actions-speak-louder-than-goals-valuing-player-actions-in-soccer
- Action valuation of on- and off-ball soccer players based on multi-agent deep reinforcement learning  
  https://arxiv.org/html/2305.17886v2
- EPV framework  
  https://www.sloansportsconference.com/research-papers/decomposing-the-immeasurable-sport-a-deep-learning-expected-possession-value-framework-for-soccer
- Measuring the Effectiveness of Pressing in Soccer  
  https://dtai.cs.kuleuven.be/events/MLSA21/papers/MLSA21_paper_merckx.pdf
- Pressing Intensity: An Intuitive Measure for Pressing in Soccer  
  https://arxiv.org/html/2501.04712v1
- Possession vs. Direct Play: Evaluating Tactical Behavior in Elite Soccer  
  https://fis.dshs-koeln.de/en/publications/possession-vs-direct-play-evaluating-tactical-behavior-in-elite-s/
- A New Metric for Pitch Control based on an Intuitive Motion Model  
  https://www.sfu.ca/~tswartz/papers/pitch_control.pdf
- The principles of tactical formation identification in association football - a survey  
  https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2024.1512386/full
- The Success Factors of Rest Defense in Soccer  
  https://www.jssm.org/researchjssm-22-707.xml.xml
- Soccermatics pitch control/pass probability  
  https://soccermatics.readthedocs.io/en/latest/lesson6/PassProbability.html
- Early Prediction of Physical Performance in Elite Soccer Matches - Support Substitutions  
  https://doi.org/10.3390/e23080952
- Change in Soccer Substitutions Rule Due to COVID-19  
  https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2020.588369/full
- Regularizing Action Policies for Smooth Control with Reinforcement Learning  
  https://arxiv.org/abs/2012.06644
- Using Network Science to Analyse Football Passing Networks  
  https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2018.01900/full
- IFAB match-flow law changes  
  https://www.theifab.com/news/the-ifab-introduces-further-measures-to-improve-match-flow-and-player-behaviour/
