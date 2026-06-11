# 축구 규칙·지식 인벤토리 보고서

작성: 2026-06-11 KST  
목적: 강화학습 전에 축구를 "게임처럼 보이는 공놀이"가 아니라 "룰·전술·피지컬·공간·분석·학습 가능한 축구 시뮬레이션"으로 만들기 위한 지식 창고.  
현재 엔진: `lib/football/**` 순수 TypeScript. DOM/React/CSS 없음. 기존 unit test `tests/unit/football/**` 87개 통과 상태로 정리됨.

## 0. 결론

현재 보고서와 코드에는 축구 엔진 뼈대가 이미 있다.

- IFAB Law 1 기반 105m x 68m pitch와 meter 좌표.
- 득점, 인/아웃, 오프사이드, 재개, 골키퍼, 파울/카드/어드밴티지의 초기 룰 모듈.
- 13개 포메이션, 20개 전술 스타일, 선수별 이질적 페르소나.
- 패스, 슛, 운반, 개인기, 오프더볼, 수비, 팀전술, 공간개념, 지표 어휘.
- deterministic RNG, event log, rule tests.

더 적립해야 할 핵심:

1. **Law 2~7, Law 13~14 디테일**: 공 속성, 선수 수/교체, 장비/충돌, 심판/VAR, 경기 시간, 프리킥/페널티킥 세부.
2. **FIFA Football Language 기반 game phase**: 빌드업, 전개, 파이널서드, 전환, high/mid/low press/block, recovery, counterpress.
3. **전술 원칙 라이브러리**: 후방 빌드업, 압박 유인, third-man, switch, overload-to-isolate, rest defence, compactness, pressing trap.
4. **세트피스 playbook**: 코너, 프리킥, 스로인, 골킥, 페널티를 별도 전술 환경으로 취급.
5. **분석 모델**: xG, xA, xT, VAEP, EPV, pitch control, pass probability, packing, PPDA, field tilt.
6. **피지컬/피로 모델**: acceleration, deceleration, sprint, high-intensity run, fatigue, recovery, injury-risk proxy.
7. **RL 벤치마크 연결**: Google Research Football, PettingZoo Parallel API, GRF MARL 연구, TacticAI/TacticGen류 set-piece generation.
8. **시청 품질 지표**: tacticFidelity를 가장 크게 두되, viewerQuality, antiExploit, roleFidelity를 따로 기록.

## 1. 현재 구현 인벤토리

| 영역 | 파일 | 현재 핵심 |
| --- | --- | --- |
| 경기장 지오메트리 | `lib/football/core/pitch.ts` | IFAB Law 1, 105 x 68m, 미터 좌표 |
| 법규 프로필 | `lib/football/core/laws.ts` | IFAB 2025/26 vs FIFA 월드컵 2026 조기 적용 |
| 경기 상태 | `lib/football/core/game-state.ts` | `GameState`, `RestartState`, `MatchPhase` |
| 공통 타입 | `lib/football/core/types.ts` | `BallState`, `TeamSide`, `FormationId`, `PlayerPersona`, `RestartKind` |
| 액션·전술 어휘 | `lib/football/core/actions.ts` | 패스 23종, 슛, 개인기, 수비, 오프더볼, 공간, 지표 |
| 결정적 RNG | `lib/football/core/rng.ts` | seed 기반 재현 |
| 이벤트 로그 | `lib/football/core/event-log.ts` | 골, 세트피스, 파울, 슛, ballDrop |
| 득점 | `lib/football/rules/goals.ts` | 공 전체 골라인 통과 |
| 인/아웃 | `lib/football/rules/in-out.ts` | 터치라인/골라인, 코너/골킥 분기 |
| 오프사이드 | `lib/football/rules/offside.ts` | 위치/관여 분리, 직접 수령 예외 |
| 재개 | `lib/football/rules/restarts.ts` | restart 상태머신, 지연 카운트다운 |
| 골키퍼 | `lib/football/rules/goalkeeper.ts` | 손 보유 시간, 백패스 위반 |
| 파울·카드 | `lib/football/rules/fouls.ts` | 히트박스 파울, 카드, DOGSO, 어드밴티지 |
| 포메이션 | `lib/football/tactics/formations.ts` | 13종 |
| 전술·선수 생성 | `lib/football/tactics/profiles.ts` | 20전술, 이질적 player persona |

## 2. 룰: IFAB Laws 전체 체크리스트

기준: IFAB Laws of the Game 2025/26 + 2026/27 변경 중 2026 월드컵 적용 가능 항목. 2026-06-11 KST 기준, 2026/27 일반 효력일은 2026-07-01이지만 FIFA 월드컵은 일부 변경 조기 적용 가능성 있음.

### 2.1 Law 1: Field of Play

현재 있음:

- 105m x 68m pitch.
- center circle 9.15m.
- penalty area 16.5m, goal area 5.5m.
- penalty mark 11m.
- corner arc 1m.
- goal width 7.32m, goal height 2.44m.

추가 필요:

- line width 최대 12cm. 모든 라인은 같은 폭.
- line 자체가 해당 area에 포함된다는 rule.
- technical area, substitute zone은 지금 게임에는 필요 낮음.
- 렌더러는 105:68 aspect ratio를 절대 찌그러뜨리지 말 것.

### 2.2 Law 2: Ball

추가 필요:

- ball circumference/mass를 실제 수치 기반으로 둘지, 게임용 scale만 둘지 결정.
- ball state: position, velocity, angularVelocity, spin axis, height, vertical velocity.
- rolling friction, air drag, bounce restitution, Magnus-like curve는 arcade approximation으로.
- out 판정은 ball center가 아니라 ball radius 포함 전체 통과.
- 공 손상/교체는 RL에는 필요 낮음. 이벤트로만 가능.

### 2.3 Law 3: Players

추가 필요:

- 11명 기본, 최소 7명 미만이면 경기 불가.
- goalkeeper 1명 필수.
- substitution state. 월드컵 토너먼트용은 extra time substitution 규칙 profile 필요.
- red card로 numericalAdvantage 반영. 현재 `numericalAdvantage`는 있으나 실제 player removal과 shape shift 필요.
- captain-only interaction은 심판/행동 연출로 optional.

### 2.4 Law 4: Equipment

시뮬레이션 최소화:

- kit color, goalkeeper kit distinction.
- collision hitbox는 장비가 아니라 body-foot-ball contact로.
- unsafe equipment는 불필요.

### 2.5 Law 5: Referee

현재 일부 있음:

- advantage.

추가 필요:

- referee decision latency. 즉시 whistle보다 100~800ms 판단 지연이 시청에 자연스러움.
- play advantage 후 되돌아가 card 주기.
- VAR profile: goal, penalty, direct red, mistaken identity, 2026 월드컵 확장 가능성.
- dropped ball 조건: referee touch가 공격 기회/소유 변화/골에 영향.
- injury/treatment stoppage는 viewer sim에서는 낮은 우선순위.

### 2.6 Law 6: Other Match Officials

추가 필요:

- assistant referee offside flag delay. 실제처럼 즉시 깃발보다 유효 공격 끝난 뒤 판정 가능.
- VAR offside/semi-automated alert는 advanced profile.

### 2.7 Law 7: Duration

추가 필요:

- match clock: 45+45, added time, half time, extra time, penalties.
- mini sim에서는 compressed clock. 예: 1 real second = 30 match seconds.
- time-wasting reward penalty와 law countdown 분리.
- stoppage time 원인: goals, substitutions, injuries, VAR, disciplinary, delays.

### 2.8 Law 8: Start and Restart

현재 있음:

- kickoff, restart flow.

추가 필요:

- kickoff: 모든 선수 자기 진영, 상대 9.15m 밖, 공 정지, 공이 명확히 움직이면 인플레이.
- coin toss/side choice는 cosmetic.
- dropped ball: 마지막 터치/위치 기준. penalty area 안이면 goalkeeper에게.
- restart taker double-touch rule.

### 2.9 Law 9: Ball In and Out

현재 있음:

- whole ball crossing 근사.

추가 필요:

- referee touch special case.
- goal line/side line plane crossing은 continuous collision detection 필요. 빠른 공이 한 tick에 지나가도 판정.

### 2.10 Law 10: Match Outcome

현재 있음:

- whole ball over goal line.

추가 필요:

- penalty shoot-out state.
- own goal event tagging.
- no-goal conditions: direct throw-in into goal, indirect free-kick direct into goal, restart double-touch.

### 2.11 Law 11: Offside

현재 있음:

- snapshot, position/offence split, goal kick/throw-in/corner exceptions.

추가 필요:

- body parts: hands/arms 제외, head/body/feet 기준.
- "deliberate play" vs "deflection/rebound/save" 구분.
- opponent impact: line of vision, challenge, obvious action, blocking path.
- offside trap as team action.
- VAR/semi-auto review mode.

### 2.12 Law 12: Fouls and Misconduct

현재 있음:

- hitbox foul, severity, cards, DOGSO, advantage.
- GK hand control 8s, backpass.

추가 필요:

- direct free-kick fouls: charge, jump, kick, push, strike, tackle/challenge, trip, handball, hold, impede with contact, bite/spit.
- indirect free-kick fouls: dangerous play, impeding without contact, dissent/abusive language, GK handling infractions.
- handball model: arm position, body silhouette, deliberate movement, unnaturally bigger.
- SPA(stopping promising attack) vs DOGSO.
- second yellow state.
- misconduct without foul.
- simulation/diving optional.

### 2.13 Law 13: Free Kicks

추가 필요:

- direct vs indirect flag.
- ball stationary.
- opponents 9.15m away.
- defensive free kick in own penalty area: in play when kicked and clearly moves.
- attacking indirect FK in goal area special placement.
- wall mechanics: distance, jump, charge, encroachment.
- attacking players within 1m of defensive wall of 3+ players infringement.

### 2.14 Law 14: Penalty Kick

추가 필요:

- kicker identified.
- goalkeeper on goal line, facing kicker, one foot rule profile.
- other players outside penalty area, behind mark, 9.15m away.
- feinting during run-up allowed, after run-up illegal.
- rebound rules.
- penalty shoot-out different context.

### 2.15 Law 15: Throw-in

현재 있음:

- throw-in restart.

추가 필요:

- both feet on/behind touchline.
- both hands, from behind and over head.
- opponents 2m away.
- direct throw-in into opponent goal => goal kick; own goal => corner.
- no offside direct from throw-in.
- thrower cannot touch again before another player.
- quick throw vs delayed throw.
- 2026 profile: 5s countdown if referee starts visual count.

### 2.16 Law 16: Goal Kick

현재 있음:

- goal kick restart.

추가 필요:

- ball stationary anywhere in goal area.
- opponents outside penalty area until in play.
- in play when kicked and clearly moves.
- direct goal in opponent goal allowed.
- own goal direct from goal kick impossible in normal path; if enters own goal without leaving? corner/retake profile.
- 2026 profile: delayed goal kick countdown can flip to opponent corner.

### 2.17 Law 17: Corner Kick

현재 있음:

- corner restart.

추가 필요:

- ball in corner area.
- flagpost not moved.
- opponent 9.15m away.
- direct goal allowed.
- corner from GK hand control >8s or delayed goal kick in 2026/27 profile.
- set-piece screens, blocks, keeper pin, zonal/man/hybrid defence.

## 3. FIFA Football Language: 경기 국면

FIFA Training Centre/FIFA Football Language 쪽 기준으로 phase를 명시해야 전술·보상이 안정됨.

### 3.1 In Possession

필수 phase:

- build-up: GK/CB/DM이 첫 압박선을 넘기 전.
- progression: middle third에서 전진, line-breaking pass, carry.
- final-third attack: 박스 근처 조합, cross, cutback, shot.
- attacking transition: 탈취 직후 빠른 전진.
- attacking set play: corner, free kick, throw-in, goal kick, penalty.
- circulation/reset: 막혔을 때 후방 순환.

각 phase별 측정:

- field tilt.
- pass length mix.
- progressive distance.
- central vs wide progression.
- line-breaking count.
- pressure faced.
- possession value delta.

### 3.2 Out of Possession

필수 phase:

- high press.
- mid press.
- low press.
- high block.
- mid block.
- low block.
- recovery.
- defensive transition.
- counterpress.

각 phase별 측정:

- PPDA.
- compactness horizontal/vertical.
- defensive line height.
- distance between units.
- central lane closure.
- forced wide rate.
- counterpress regain within 5 seconds.
- dangerous space conceded.

## 4. 전술 원칙 라이브러리

전술은 이름 하나가 아니라 "원칙 + 트리거 + 위치 + 금지행동 + 성공지표"로 저장해야 한다.

### 4.1 후방 빌드업

행동:

- GK split CB.
- pivot drops or stays behind press line.
- fullback wide, inverted, or asymmetry.
- third-man from CB -> pivot -> fullback/8.
- invite press then switch.

트리거:

- 상대 pressers 2명 이하: short build.
- 상대 high press 4명 이상: bounce pass, third-man, direct to target, switch.
- GK under pressure: clip to fullback/winger or long to target.

지표:

- first line broken.
- build-up loss rate.
- GK distribution choice.
- bait success.
- long-ball necessity vs preference.

### 4.2 중앙 전개

행동:

- 6번이 center lane 안정.
- 8번/10번 half-space receive.
- wall pass, third-man pass.
- blind-side run.
- zone 14 receive.

지표:

- line-breaking pass.
- pass into zone 14.
- receive between lines.
- central turnover danger.

### 4.3 측면 전개

행동:

- winger isolation.
- overlap/underlap.
- fullback-winger-8 triangle.
- early cross, deep cross, low cross, cutback.
- far-post runner and edge-box rest player.

지표:

- wide overload touch.
- 2v1 created.
- cutback quality.
- cross target density.
- far-post occupation.

### 4.4 Overload-to-Isolate

행동:

- one side overload to draw block.
- switch to isolated winger/fullback.
- weak-side runner attack.

지표:

- opponent block shifted.
- switch speed.
- isolated 1v1 quality.
- weak-side xG/xA.

### 4.5 티키타카/positional play

행동:

- 짧은 패스.
- triangles/diamonds.
- occupation of five vertical lanes.
- third-man combinations.
- counterpress after loss.

금지:

- 무의미한 30패스 loop.
- 전술 의도 없는 long clear.

지표:

- short pass ratio.
- pass network density.
- player spacing.
- counterpress recovery.
- possession value growth.

### 4.6 Direct/long-ball

행동:

- target man.
- second-ball structure.
- winger run behind.
- early vertical pass.
- rest defence under ball.

지표:

- long pass contest win.
- second-ball recovery.
- shot within 8~12s.
- territory gain.

### 4.7 Gegenpress/high press

행동:

- nearest pressure, second cover, third cut lane.
- curved press to trap side.
- touchline as extra defender.
- backward pass trigger.
- poor first touch trigger.

지표:

- regain within 5 seconds.
- forced long ball.
- high turnover xG.
- bypassed press penalty.

### 4.8 Mid/low block

행동:

- compact shape.
- central denial.
- winger tracks fullback.
- striker screens pivot.
- backline hold/drop triggers.

지표:

- compactness.
- zone 14 denied.
- crosses allowed vs central passes denied.
- xG conceded.
- transition chance.

### 4.9 Rest Defence

행동:

- behind-ball structure while attacking.
- 2+3 or 3+2 shape.
- cover counter lanes.
- foul-risk control on negative transition.

지표:

- counterattack xG conceded after own attack.
- number behind ball.
- central rest defender distance.

## 5. 세트피스 지식

세트피스는 RL에서 별도 작은 환경으로 뽑아야 한다. TacticAI가 코너킥만 따로 다룬 이유도 출발 상태가 명확하고 intervention이 가능하기 때문.

### 5.1 코너킥 공격

루틴:

- inswinger.
- outswinger.
- short corner.
- near-post flick.
- far-post overload.
- penalty spot crowd.
- six-yard box crowd.
- screen/block.
- edge-of-box shot.
- recycle to opposite side.

역할:

- taker.
- near-post runner.
- far-post runner.
- central target.
- blocker/screener.
- goalkeeper pin.
- edge-box shooter.
- rest defence 2~3명.

지표:

- first contact probability.
- shot attempt probability.
- shot xG.
- second-ball recovery.
- counterattack risk after clearance.

방어:

- zonal.
- player marking.
- hybrid.
- one/two posts.
- keeper claim zone.
- blockers cleared.

### 5.2 프리킥

종류:

- direct shot.
- indirect cross.
- disguised pass.
- layoff.
- far-post delivery.
- quick free kick.

모델:

- wall count.
- wall distance.
- goalkeeper position.
- ball curve/height.
- taker skill: power, curve, dip, knuckle, weak foot.

### 5.3 스로인

연구 포인트:

- first contact success.
- possession retention.
- throw direction: forward/backward/lateral.
- length: short/medium/long.
- quick throw vs settled throw.
- opponent pressing trap near touchline.

루틴:

- short bounce to fullback/winger.
- back to CB/DM reset.
- down-the-line channel throw.
- long throw into box.
- third-man throw-in pattern.

### 5.4 골킥

루틴:

- GK short to CB.
- split CB + pivot.
- fullback receive.
- bait press then switch.
- direct to target man.
- clip to winger.
- overload one side, second pass long.

지표:

- second pass length. UEFA EURO 2024 technical report noted goal kicks often set up build-from-back but second pass distance can still be long.
- successful exit from defensive third.
- turnover danger.
- pressure bypass.

### 5.5 페널티킥

모델:

- goalkeeper-dependent vs goalkeeper-independent.
- taker run-up, body orientation, preferred side.
- goalkeeper dive timing, delay, history.
- pressure/composure.

RL:

- penalty is separate small game with mixed strategy.
- repeated deterministic best side는 exploitation 위험.

## 6. 선수 모델

### 6.1 속성 계층

현재 있음:

- 기본: pace, press, pass, shoot, discipline.
- 신체: preferredFoot, weakFoot, height, weight, agility, balance.
- 인지/심리: vision, composure, aggression.
- 행동: workRateAtk/Def, cutInside, poaching, altruism.
- traits.

추가 권장:

- acceleration, deceleration.
- top speed.
- stamina capacity.
- fatigue resistance.
- recovery speed.
- strength.
- jumping.
- heading accuracy.
- first touch.
- dribbling under pressure.
- tackling timing.
- interception anticipation.
- crossing high/low/cutback.
- long pass, through pass.
- finishing by foot/head/volley.
- goalkeeper reflex, handling, claiming, punching, sweeping, distribution.

### 6.2 피로 모델

피로는 단순 stamina 감소가 아니라 행동 선택과 실수에 영향 줘야 함.

필수 상태:

- energy 0..1.
- acute fatigue: 최근 5~30초 sprint/accel/decel 누적.
- chronic load optional: tournament mode.
- recovery while walking/standing.
- heat/altitude profile optional for 2026 World Cup.

영향:

- acceleration 감소.
- reaction delay 증가.
- pass/shot error 증가.
- tackle mistiming 증가.
- pressing willingness 감소.
- injury-risk event optional.

### 6.3 개인성

관찰 가능해야 함:

- playmaker는 위험한 전진패스 시도.
- early crosser는 박스 도착 전 크로스.
- target man은 공중경합/등지는 플레이.
- poacher는 최후방 라인에서 침투.
- sweeper keeper는 박스 밖 발 처리.
- inverted fullback은 possession 때 중앙 이동.
- mezzala는 half-space 침투.

## 7. 데이터·이벤트 스키마

이벤트 로그는 RL reward와 분석 모두의 원천.

필수 event:

- pass: kind, origin, target, receiver, success, pressure, body part, height.
- carry/dribble: start, end, defender beaten, pressure.
- shot: location, body part, pressure, xG, outcome.
- duel: aerial/ground, players, winner.
- defensive action: tackle, interception, block, clearance.
- foul: type, severity, card, advantage.
- restart: kind, taker, setup duration, routine id.
- goalkeeper: catch, parry, punch, claim, smother, release.
- offside: snapshot id, player, involvement type.
- possession chain: start event, end event, value delta.

권장 schema:

```ts
type MatchEvent = {
  id: string;
  t: number;
  phase: GamePhase;
  team: TeamSide;
  player?: PlayerId;
  type: EventType;
  pos?: Vec2;
  endPos?: Vec2;
  tags: string[];
  metrics?: {
    xG?: number;
    xA?: number;
    xTDelta?: number;
    vaepDelta?: number;
    epvDelta?: number;
    pressure?: number;
    pitchControlFor?: number;
  };
};
```

## 8. 축구 분석 모델

### 8.1 xG

용도:

- shot quality.
- chanceQuality reward.
- keeper evaluation.

입력:

- distance.
- angle.
- body part.
- assist type.
- pressure.
- goalkeeper position.
- defenders between ball and goal.
- shot height/velocity optional.
- open play vs set piece.

주의:

- xG는 슛 이후만 평가. 슛 전 좋은 패스/움직임은 xT/VAEP/EPV 필요.

### 8.2 xA

용도:

- pass/cross assist quality.
- altruism/playmaker reward.

계산:

- pass resulting shot의 xG를 passer에게 attribution.
- potential xA는 shot 없는 dangerous pass도 추정.

### 8.3 xT

용도:

- field zone value.
- simple possession value reward.

아이디어:

- 공이 더 위협적인 zone으로 이동하면 positive.
- shot 없이도 progression reward 가능.

주의:

- zone grid가 coarse하면 세밀한 시청 품질 부족.

### 8.4 VAEP

용도:

- every on-ball action value.
- scoring probability 증가와 conceding probability 감소를 함께 봄.

좋은 점:

- 패스, 드리블, 태클, clearance도 가치화 가능.
- RL reward에 잘 맞음.

주의:

- event stream 기반이라 off-ball 움직임은 약함.

### 8.5 EPV

용도:

- tracking 기반 상태 가치.
- "해당 프레임에서 좋은 해답" 평가에 가장 가깝다.

입력:

- 22명+공 위치/속도.
- possession.
- pressure.
- possible pass/carry/shot surfaces.

주의:

- 구현 비용 큼. 처음엔 simplified EPV로 시작.

### 8.6 Pitch Control

용도:

- 공간 지배.
- pass receiver availability.
- defensive coverage.
- through ball target.

요소:

- player position.
- velocity/direction.
- reaction time.
- acceleration/max speed.
- ball travel time.

### 8.7 Pass Probability / SoccerMap류

용도:

- pass success surface.
- best target location.
- pass selection realism.

요소:

- passer orientation.
- receiver movement.
- defenders in lane.
- ball speed/height.
- pressure.

### 8.8 PPDA

용도:

- pressing intensity.
- high/mid/low press metric.

계산:

- opponent passes allowed per defensive action in selected zones.

주의:

- toy sim에서는 pitch zones와 possession chain을 먼저 안정화해야 함.

### 8.9 Field Tilt

용도:

- territorial dominance.
- possession style vs sterile possession 구분.

계산:

- attacking third touches/passes share.

### 8.10 Packing / Line Breaking

용도:

- 전진패스가 몇 명을 제거했는지.
- 중앙 전개/verticality reward.

요소:

- pass/carry before and after ball line.
- opponents bypassed between ball and goal.

## 9. RL 환경 설계 보강

### 9.1 Environment API

필수:

- `reset(seed, scenario)`.
- `step(actions)`.
- `observe(agentId)`.
- `actionMask(agentId)`.
- `reward(agentId/team)`.
- `done/truncated`.
- `eventLog`.
- `replay`.

PettingZoo Parallel API와 맞추면 외부 MARL 알고리즘 연결 쉬움.

### 9.2 Observation

개별 선수:

- self: position, velocity, role, stamina, attributes.
- ball: relative position/velocity/height.
- visible teammates/opponents.
- nearest pressure.
- tactical instruction.
- match context.
- restart context.
- action mask.

중앙 critic:

- full state.
- hidden opponent intent optional.
- event history.

### 9.3 Action Space

처음부터 너무 고해상도면 학습 어려움. 계층형 권장.

High-level:

- hold shape.
- support.
- press.
- mark.
- run.
- receive.
- pass.
- carry.
- shoot.
- clear.
- tackle.
- keeper release.

Low-level:

- target point.
- power.
- height.
- curve.
- sprint.
- body orientation.

### 9.4 Reward

사용자 우선순위 반영:

- `tacticFidelity` weight 최상위.
- `score`는 중요하지만 전술 정체성을 이긴 reward로 두지 않음.
- `ruleCompliance`는 hard penalty.
- `viewerQuality`와 `antiExploit` 분리.

예시:

```txt
tacticFidelity 0.30
score          0.20
progression    0.12
chanceQuality  0.10
possessionValue 0.08
defensiveValue 0.08
ruleCompliance 0.07
roleFidelity   0.03
viewerQuality  0.02
```

전술별 tacticFidelity:

- 티키타카: short pass, triangle, third-man, counterpress.
- direct: long pass, target contest, second ball, fast shot.
- low block: compactness, central denial, transition.
- high press: PPDA, high regain, trap success.
- wide overload: wide touch, overlap, cutback.
- positional play: lane occupation, spacing, rest defence.

### 9.5 Curriculum

단계:

1. 1v0 shot.
2. 1v1 keeper.
3. 2v1 pass/shot.
4. 3v2 transition.
5. rondo keep-away.
6. build-up vs 1 presser.
7. build-up vs high press.
8. throw-in retention.
9. corner first contact.
10. free kick wall.
11. offside line timing.
12. 5v5 small game.
13. 7v7.
14. 11v11 compressed half.
15. full match.

### 9.6 Benchmark Targets

벤치:

- Google Research Football: football rules + physics-like football sim + academy scenarios.
- GRF MARL studies: credit assignment, stochasticity, policy search explosion.
- PettingZoo: multi-agent API.
- TacticAI: corner setup prediction/generation.
- TacticGen류: open-play movement/tactic generation.
- RoboCup Soccer Simulator: 오래된 multi-agent soccer benchmark.

## 10. 시청 품질

축구를 잘해도 보기 지루하면 목표 실패.

필수:

- 스코어 박스/자동 경기/미니게임 숨기기 버튼이 경기장 라인, 공, 선수, 골대, 세트피스를 가리지 않음.
- pitch는 105:68 aspect ratio 유지.
- HUD safe zone.
- 중요한 장면은 과하지 않은 label.
- set-piece 준비를 순간이동이 아니라 선수 이동으로 표현.
- 같은 패턴 반복 방지.
- 전술 차이가 30초 안에 보임.
- 골 빈도는 현실보다 조금 높여도 되지만 룰/전술 망가뜨리면 안 됨.

viewerQuality 측정:

- meaningful event per minute.
- shot/chance frequency.
- possession dead loop count.
- set-piece completion time.
- tactical diversity.
- overlap/occlusion count.
- mobile readability.

## 11. 빠진 작업 우선순위

### P0: 문서/타입 정리

- 현재 문서와 코드의 전술 이름 인코딩/표시 깨짐 여부 점검.
- `TacticStyle.name`을 ASCII id + Korean displayName으로 분리.
- `FormationId`, `TeamTactic`, `PassKind`, `Metric`에 설명 docstring 추가.

### P1: 룰 디테일

- Law 13 free kick.
- Law 14 penalty.
- Law 15 throw-in legality.
- Law 16 goal-kick setup.
- Law 17 corner setup.
- Law 2 ball physics constants.
- Law 7 match clock.
- offside deliberate play/deflection/save.

### P2: 분석 지표

- simplified xG.
- xT grid.
- line-breaking/packing.
- PPDA.
- field tilt.
- possession chain.
- pitch control lite.

### P3: 전술 엔진

- phase classifier.
- team shape controller.
- role-specific behaviour.
- set-piece playbook.
- tacticFidelity metric implementation.

### P4: RL Env

- headless `FootballEnv`.
- scenario curriculum.
- PettingZoo-compatible wrapper design.
- replay writer.
- evaluation dashboard.

## 12. 테스트 추가 목록

룰:

- Law 13 direct/indirect free kick goal/no-goal.
- free-kick wall distance and encroachment.
- penalty positioning and rebound.
- throw-in direct goal cases.
- thrower second touch.
- goal-kick opponent outside penalty area.
- corner direct goal.
- dropped ball to keeper in penalty area.
- referee touch restart.
- offside deliberate play vs deflection.

전술:

- high press PPDA lower than low block.
- low block compactness higher than high press.
- tiki-taka short pass ratio higher than direct play.
- direct play long-ball and second-ball rate higher.
- wide overload creates 2v1 wide more often.
- rest defence reduces counter xG.

분석:

- xG higher near central close shots.
- xT increases toward dangerous zones.
- pitch control changes with velocity.
- pass probability lower when defender blocks lane.
- VAEP/EPV delta positive for dangerous progression.

시청:

- HUD never overlaps pitch line boxes.
- mobile landscape pitch ratio stays 105:68.
- 60s sim has meaningful events.
- same seed gives same event log.

## 13. 참고 자료

공식 법규:

- IFAB Laws of the Game documents  
  https://www.theifab.com/laws-of-the-game-documents/
- IFAB Law 1: The Field of Play  
  https://www.theifab.com/laws/latest/the-field-of-play/
- IFAB Law 11: Offside  
  https://www.theifab.com/laws/latest/offside/
- IFAB Law 12: Fouls and Misconduct  
  https://www.theifab.com/laws/latest/fouls-and-misconduct/
- IFAB Law changes 2026/27  
  https://www.theifab.com/law-changes/latest/
- FIFA/IFAB match-flow changes release  
  https://inside.fifa.com/media-releases/ifab-introduces-further-measures-improve-match-flow-player-behaviour

전술·벤치마킹:

- FIFA Training Centre, Counter-pressing  
  https://www.fifatrainingcentre.com/en/practice/elite-sessions/transition-to-defending/counter-pressing.php
- FIFA Training Centre, Mid-block and compactness  
  https://www.fifatrainingcentre.com/en/fwc2022/technical-and-tactical-analysis/controlling-the-game-without-the-ball--the-mid-block-and-compactness.php
- FIFA Training Centre, Set plays library  
  https://www.fifatrainingcentre.com/en/resources/game-library/set-plays.php
- FIFA Training Centre, Defending corner strategies  
  https://www.fifatrainingcentre.com/en/game/tournaments/fcwc/2025/team-analyses/set-plays-defending-corner-strategies.php
- UEFA EURO 2024 technical report  
  https://www.uefa.com/uefaeuro/history/news/0291-1bde164db7c4-e4b2f7db6f83-1000--euro-2024-technical-report/
- UEFA EURO 2024 physical analysis report  
  https://editorial.uefa.com/resources/0297-1d4e3592fbf1-f11d4e1c826a-1000/uefa_euro_2024_physical_analysis_report_20250318094958.pdf

분석 모델:

- VAEP paper: Actions Speak Louder than Goals  
  https://arxiv.org/pdf/1802.07127
- VAEP IJCAI paper  
  https://www.ijcai.org/proceedings/2020/0648.pdf
- socceraction VAEP docs  
  https://socceraction.readthedocs.io/en/latest/documentation/valuing_actions/vaep.html
- Deep learning EPV framework  
  https://www.sloansportsconference.com/research-papers/decomposing-the-immeasurable-sport-a-deep-learning-expected-possession-value-framework-for-soccer
- Fine-grained EPV paper  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC8570314/
- Revisiting EPV benchmark  
  https://arxiv.org/pdf/2502.02565
- Improved xG models using preceding events  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC11524524/
- SoccerMap  
  https://www.researchgate.net/publication/349577476_SoccerMap_A_Deep_Learning_Architecture_for_Visually-Interpretable_Analysis_in_Soccer
- Soccermatics pitch control/pass probability overview  
  https://soccermatics.readthedocs.io/en/latest/lesson6/PassProbability.html

피지컬:

- Physical match demands during transitional play  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC10955741/
- UEFA EURO 2024 position-specific running reference values  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC12244375/
- Acceleration/deceleration systematic review  
  https://pmc.ncbi.nlm.nih.gov/articles/PMC6851047/

세트피스:

- Throw-in performance EPL study  
  https://journals.sagepub.com/doi/10.1177/1747954121991447
- Observational analysis of World Cup corner kicks  
  https://www.mdpi.com/2071-1050/13/14/7562
- Technical-tactical corner kick systematic review  
  https://www.mdpi.com/2076-3417/15/9/4984
- TacticAI Nature Communications  
  https://www.nature.com/articles/s41467-024-45965-x
- TacticAI DeepMind blog  
  https://deepmind.google/blog/tacticai-ai-assistant-for-football-tactics/
- TacticAI arXiv  
  https://arxiv.org/abs/2310.10553
- Graph RL for corner tactics, 2026 preprint  
  https://arxiv.org/abs/2606.06353
- TacticGen, 2026 preprint  
  https://arxiv.org/abs/2604.18210

RL/MARL:

- Google Research Football paper  
  https://cdn.aaai.org/ojs/5878/5878-13-9103-1-10-20200513.pdf
- Google Research Football publication page  
  https://research.google/pubs/google-research-football-a-novel-reinforcement-learning-environment/
- Google Research blog  
  https://research.google/blog/introducing-google-research-football-a-novel-reinforcement-learning-environment/
- AAMAS 2024 GRF MARL survey/benchmark  
  https://www.ifaamas.org/Proceedings/aamas2024/pdfs/p1772.pdf
- Empirical study on GRF multi-agent scenarios  
  https://discovery.ucl.ac.uk/10188587/1/2305.09458.pdf
- PettingZoo documentation  
  https://pettingzoo.farama.org/index.html
- PettingZoo paper  
  https://arxiv.org/abs/2009.14471
