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

## 6. 커리큘럼

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

## 12. 바로 다음 문서/코드 작업

추천 순서:

1. `docs/football-knowledge-inventory.ko.md`의 전술 20종을 코드 metadata와 1:1 연결.
2. `TacticStyle`에 ASCII `id` 추가.
3. `FormationProfile` 작성.
4. `rewardAnchors`와 `evaluationMetrics` 타입 작성.
5. `rl/scenarios.ts`에 Football Academy식 scenario 목록 추가.
6. `rl/reward.ts`에 reward breakdown skeleton 작성.

## 13. 참고 자료

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
