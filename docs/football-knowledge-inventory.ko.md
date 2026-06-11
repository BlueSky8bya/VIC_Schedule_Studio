# 축구 규칙·지식 인벤토리 보고서

> 작성 2026-06-11 KST. 프로젝트에 적립된 축구 규칙·전술·데이터·RL 토대를 전수 정리.
> 엔진은 모두 `lib/football/**`(DOM/React 무관 순수 TS). 테스트 `tests/unit/football/**` **87개 통과**.
> 라이브 토이(`components/seasonal/worldcup-ball-goal.tsx`)가 이 어휘/룰을 점차 흡수 중.

---

## 0. 한눈에

| 영역 | 파일 | 핵심 |
| --- | --- | --- |
| 경기장 지오메트리 | `core/pitch.ts` | IFAB Law 1, 105×68m, 미터 좌표 |
| 법규 프로필 | `core/laws.ts` | IFAB 2025/26 vs FIFA 월드컵 2026(조기적용) |
| 경기 상태 | `core/game-state.ts` | GameState·RestartState 상태머신 |
| 공통 타입 | `core/types.ts` | 13 포메이션·이질적 PlayerPersona·RestartKind |
| 액션·전술 어휘 | `core/actions.ts` | 패스23·슛·개인기·오프더볼·전술·공간·지표 |
| 결정적 RNG | `core/rng.ts` | mulberry32(리플레이/테스트 재현) |
| 이벤트 로그 | `core/event-log.ts` | 골/세트피스/파울 태깅 |
| 득점(Law 10) | `rules/goals.ts` | 공 전체 plane-crossing |
| 인/아웃(Law 9·16·17) | `rules/in-out.ts` | 코너/골킥 분기 |
| 오프사이드(Law 11) | `rules/offside.ts` | 위치/관여 분리 + 예외 |
| 재개(Law 8·13~17) | `rules/restarts.ts` | 상태머신 + 지연 카운트다운 |
| 골키퍼(Law 12) | `rules/goalkeeper.ts` | 손 보유 8초·백패스 |
| 파울·카드·어드밴티지(Law 12·5) | `rules/fouls.ts` | 히트박스 파울·카드·DOGSO |
| 포메이션 | `tactics/formations.ts` | 13종 |
| 전술 + 선수생성 | `tactics/profiles.ts` | 20전술 + 이질적 페르소나 |

---

## 1. 경기장 지오메트리 (IFAB Law 1) — `core/pitch.ts`

좌표계: 중앙 원점, x=길이축[−52.5,+52.5], y=폭축[−34,+34]. 팀0=왼골 수비/오른쪽 공격.

```
PITCH = { length 105, width 68, centerCircleR 9.15, penaltyAreaDepth 16.5,
  goalAreaDepth 5.5, penaltyMark 11, penaltyArcR 9.15, cornerArcR 1,
  goalWidth 7.32, goalHeight 2.44, ballRadius 0.11 }  // 모두 미터
HALF_L 52.5, HALF_W 34, HALF_GOAL 3.66
```

헬퍼: `goalLineX(side)`, `attackingGoalSide/defendingGoalSide(team)`, `withinGoalMouth(y)`,
`inPenaltyArea(p,side)`, `inGoalArea(p,side)`, `penaltyMarkPos(side)`, `inBounds(p)`.

## 2. 법규 프로필 — `core/laws.ts`

룰을 하드코딩 않고 프로필로 분기(시즌/대회별 변형).
- **IFAB_2025_26**: GK 손 보유 6초, 지연 카운트다운 없음.
- **FIFA_WORLD_CUP_2026**(기본): GK 손 **8초 초과 → 상대 코너킥**, 지연 스로인/골킥 **5초 카운트다운**(만료 시 상대에게).

## 3. 경기 상태머신 — `core/game-state.ts`

`MatchPhase`: preKickoff·openPlay·stoppage·restartSetup·restartReady·goalScored·halfTime·fullTime.
`GameState{ time, phase, ball, lastTouch, score, restart, law }`.
`RestartState{ kind, team, location, side?, causedByOffside?, countdownDeadline?, ready }`.

---

## 4. 룰 모듈 (Laws of the Game)

### 4.1 득점 — Law 10 (`rules/goals.ts`)
공 **전체**가 골라인을 넘고 두 포스트 사이·크로스바 아래라야 골. `goalScoredSide(ball)`,
`scoringTeamForGoal(side)`. (라이브의 'rect 중심' 근사보다 정확한 plane-crossing.)

### 4.2 인/아웃 — Law 9·16·17 (`rules/in-out.ts`)
공 **전체**가 라인 넘어야 아웃(라인에 걸치면 인플레이). 골라인 아웃은 마지막 터치로 분기:
**공격수 터치→골킥 / 수비수 터치→코너킥**. `ballOut(ball, lastTouch)`, `goalKickSpot(side)`.

### 4.3 오프사이드 — Law 11 (`rules/offside.ts`)
**위치(position)와 반칙(관여)을 분리**.
1. 같은 팀이 공을 플레이한 '순간' 스냅샷(`takeOffsideSnapshot`).
2. 오프사이드 위치 = 상대 진영 && 공보다 앞 && **두 번째 최후방 상대(보통 키퍼 제외 최후방 수비수)보다 앞**. 같은 선(level)=온사이드.
3. 그 위치였던 선수가 **관여**해야 비로소 반칙(`offsideOffence`).
4. **예외**: 자기 진영 출발 X, **골킥·스로인·코너킥 직접 수령은 오프사이드 없음**.
`attackDir(team)`, `offsideLineX(defenders, team)`, `inOffsidePosition(...)`.

### 4.4 재개 상태머신 — Law 8·13~17 (`rules/restarts.ts`)
흐름: `openPlay → (판정) → stoppage → restartSetup → restartReady → openPlay`.
`resolveOpenPlay`, `restartFromOut`, `restartFromOffside`(간접FK), `kickoffRestart`, `beginRestart`,
`markRestartReady`, `restartTaken`(공이 명확히 움직이면 인플레이), `checkDelayedCountdown`(월드컵2026
지연 만료 시 상대로 전환).

### 4.5 골키퍼 — Law 12 (`rules/goalkeeper.ts`)
- 손 보유 시간 초과(`handHoldExceeded`, 프로필 6/8초) → 위반.
- **백패스 룰**(`backPassViolation`): 아군이 **발로** 준 패스·스로인을 손으로 잡으면 위반(간접FK).
- `goalkeeperViolation(...)`, `violationAwardTeam`.

### 4.6 파울·카드·어드밴티지 — Law 12·5 (`rules/fouls.ts`)
- **히트박스 파울**(`isFoulContact`): 태클 **발**이 공보다 상대 **몸**에 먼저 닿으면 파울(거리 아님).
- **강도**(`foulSeverity`): careless<reckless<seriousFoulPlay — 공격성·접근속도·규율·백태클로.
- **카드**(`cardFor`): reckless=옐로, seriousFoulPlay=레드, **2번째 옐로=레드**, **DOGSO+reckless=레드**.
- **어드밴티지**(`playAdvantage`, Law 5): 반칙나도 공 유지+공격 유리하면 속행.
- `freeKickKind`: 박스 안 수비반칙=페널티킥/밖=직접FK/백패스류=간접FK. `numericalAdvantage`(수적우위).

---

## 5. 액션·전술 어휘 (RL Action/Reward 토대) — `core/actions.ts`

- **패스(PassKind 23)**: groundShort/Medium·backPass·lateralPass·progressivePass·lineBreakingPass·
  throughPass·loftedThroughPass·longBall·switchOfPlay·crossHigh/Low·earlyCross·cutback·wallPass·
  thirdManPass·oneTouchPass·clearance·키퍼배급(throw/roll/dropKick/punt/shortPass).
  집합: `LOFTED_PASSES`, `PROGRESSIVE_PASSES`.
- **슛(ShotKind)**: instep·finesse·chip·volley·header·tap.
- **볼운반(CarryKind)**: firstTouch·knockOn·closeControl·shielding.
- **개인기(SkillMove)** + `BEAT_MAN_SKILLS`: bodyFeint·stepover·flipFlap·marseilleTurn·cruyffTurn·
  laCroqueta·rainbowFlick·heelChop·elastico.
- **수비(DefensiveAction)**: standing/slidingTackle·interception·clearance·block.
- **오프더볼(OffBallRun)**: overlap·underlap·lineBreakingRun·droppingDeep·dummyRun·occupyHalfSpace·
  pinDefender·supportAngle / press·jockey·cover·offsideTrap·restDefense·counterpressSurround·
  holdLine·stepOut·drop.
- **팀전술(TeamTactic 10)**: positionalPlay·directPlay·counterAttack·tikiTaka·gegenpressing·
  high/mid/lowBlock·zonalMarking·manMarking.
- **공간개념(SpaceConcept)**: halfSpace·zone14·invertedFullback·isolation·mezzala
  + 판정 헬퍼 `widthChannel(y)`(5등분)·`isHalfSpace`·`inZone14(pos,team)`.
- **지표(Metric)**: xG·xA·ppda·fieldTilt·possessionValue·packing.
- **골키퍼 액션(GoalkeeperAction)** + `GK_HAND_ACTIONS`: catch·parry·punch·smother·sweep·
  throwOut·rollOut·dropKick·punt·shortPass(스위핑=발만).

---

## 6. 포메이션·전술·선수 — `tactics/`

### 6.1 포메이션 13종 (`formations.ts`)
4-3-3·4-4-2·3-5-2·4-2-3-1·4-1-4-1·3-4-3·5-3-2·5-4-1·4-5-1 + **3-2-4-1·4-3-1-2·4-4-1-1·4-6-0**.
각 10 필드슬롯(키퍼 제외), bx(자기골0→상대골1)·by(위0→아래1)·role(DF/DM/MF/WG/FW).

### 6.2 전술 스타일 20종 (`profiles.ts`)
티키타카·점유축구·게겐프레싱·하이프레스·토탈풋볼·윙플레이·미드블록·역습축구·롱볼직접·빗장수비·
텐백수비·밸런스 + **포지셔널플레이·수직적티키타카·플루이드역습·두줄수비·루트원·비대칭아이솔레이션·
가짜9번·실리축구**. 각 press·possession·tempo·lineHeight·width + 선호 포메이션. `makeTeam`이 seed
지터를 더해 매 경기 색이 다르게.

### 6.3 이질적 선수(heterogeneous) 페르소나 (`profiles.ts`/`types.ts`)
`makePlayer`가 역할 가중·결정적으로 생성:
- 기본: pace·press·pass·shoot·discipline.
- 신체: preferredFoot(L/R/both)·weakFoot·heightCm·weightKg·agility·balance.
- 인지: vision·composure·aggression.
- 행동: workRateAtk/Def·cutInside·poaching·altruism.
- 특성(traits): outsideFootShot·earlyCrosser·sweeperKeeper·poacher·targetMan·playmaker·
  invertedFullback·mezzala.

---

## 7. 결정성·이벤트·테스트

- **RNG**(`rng.ts`): mulberry32 — 같은 seed면 매치업·선수·경기 전개 재현(리플레이/테스트/RL 커리큘럼).
- **이벤트 로그**(`event-log.ts`): kickoff·goal·save·throwIn·corner·goalKick·offside·foul·shot·ballDrop.
- **테스트 87개**(`tests/unit/football/**`): 엔진 결정성·pitch/inout/goals·offside·restarts·goalkeeper·
  fouls·actions taxonomy·formations/tactics·persona attributes.

---

## 8. 라이브 토이에 구현된 룰(렌더러) — `components/seasonal/worldcup-ball-goal.tsx`

엔진 어휘와 별개로 라이브에 이미: 파울→프리킥·카드·레드 퇴장(필드서 제거)·경기기록(점유/슛/파울/
카드)·세트피스(스로인/코너/골킥/킥오프) 도착 후 킥·오프사이드·세트피스 준비중 스페이싱·**GK 손
(catch 보유→배급/parry/punch + 백패스=발 + 박스 한정)**·승부차기(한 골·도움닫기·키퍼 교체)·
시계(추가시간·연장·승부차기)·전술 mid-match 변경·105:68 피치.

## 9. 관련 문서

- `docs/worldcup-rl-foundation-report.ko.md` — RL sim 로드맵(Phase 0~3, GRF/MARL).
- `docs/worldcup-minigame-hci-proposal.md` — 미니게임 HCI 제안.
- 메모리 `football-sim-roadmap.md` — 추가전술/이질 파라미터/RL 보상·앵커링·커리큘럼 합의 스펙.

## 10. 다음(RL 직전 남은 적립)

물리·인지 제약(가속/관성·FOV·퍼스트터치 노이즈)·동적 앵커링(공 기준 가상 타겟좌표)·보상 셰이핑
(xG/xA/PPDA·shape 페널티)·헤드리스 sim step(state→action→next)·커리큘럼(쉐도우→더미→SSG→11v11).
