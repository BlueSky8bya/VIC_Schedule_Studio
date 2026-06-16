# 월드컵 미니게임 강화학습 기반 보고서

작성일: 2026-06-11 KST  
범위: `components/seasonal` 월드컵 축구 미니게임 현황 판단, 축구 룰 기반, 전술 모델, 멀티 에이전트 강화학습(MARL) 준비 설계  
결론: 현재 구현은 "보는 재미가 있는 브라우저 애니메이션 경기"까지는 상당히 진행됐지만, 강화학습 기반 축구 시뮬레이터로 쓰기에는 아직 핵심 구조가 부족하다. 다음 단계는 UI를 더 꾸미는 것이 아니라 순수 축구 엔진, 룰 엔진, 전술 엔진, RL 환경 API를 분리하는 것이다.

## 1. 판단 요약

현재 상태:

- `WorldCupBallGoal`은 이미 양 팀 10명 필드 플레이어와 좌우 골키퍼, 공, 골대, 포메이션, 전술 스타일, 선수 성향, 자동 경기, 사용자의 공 드래그 조작을 포함한다.
- `4-3-3`, `4-4-2`, `3-5-2`, `4-2-3-1`, `4-1-4-1`, `3-4-3`, `5-3-2`, `5-4-1`, `4-5-1` 포메이션이 있다.
- 티키타카, 점유 축구, 게겐프레스, 하이프레스, 윙어 공격, 롱볼 직접, 역습, 텐백 수비 등 전술 스타일의 숫자 성향이 있다.
- 선수별 `pace`, `press`, `pass`, `shoot`, `discipline`, `stamina`가 있고, 역할별 기본값과 지터가 있다.
- 현재 룰은 킥오프, 스로인, 코너킥, 골킥, 오프사이드, 골, 세이브, 공중볼을 흉내 낸다.
- `public-poster.tsx`에서 월드컵 기간 시청자 화면에 붙고, `studio-shell.tsx`에서 편집실에는 별도 중력 공 레이어가 붙는다.
- `lib/calendar/worldcup.ts`는 월드컵 기간을 `2026-06-11`부터 `2026-07-19`까지로 잡는다. 이 기준은 KST 일정 표시와 연결되어 있다.

핵심 부족:

- 경기 로직이 React 컴포넌트, DOM, `performance.now()`, `Math.random()`, `window`, CSS 렌더링과 강하게 섞여 있다.
- 강화학습이 요구하는 재현 가능한 `reset(seed)`, `step(actions)`, `observation`, `reward`, `done`, `eventLog` 구조가 없다.
- 룰 판정이 실제 IFAB 법규 수준이 아니라 화면 연출용 근사다.
- 오프사이드, 골 판정, 골키퍼 핸들링, 백패스, 프리킥, 페널티킥, 파울, 카드, 어드밴티지, 드롭볼, 경기 시간, 세트피스 포지셔닝이 부족하다.
- 전술은 숫자 성향으로만 존재하고, "후방 빌드업", "상대 끌어내고 재진입", "측면 과부하", "중앙 3자 조합", "스위치", "세컨드볼" 같은 명시적 플레이 원칙이 아직 엔진 단위로 없다.

권장 방향:

1. `WorldCupBallGoal`을 유지하되, 현재 코드를 "프로토타입 렌더러"로 보고 핵심 로직을 `lib/football` 순수 엔진으로 옮긴다.
2. 룰 엔진을 먼저 만든다. 강화학습보다 룰 정합성이 먼저다.
3. 룰 엔진 위에 전술 스크립트 AI를 먼저 만든다. RL은 이 스크립트 AI를 상대, 커리큘럼, 행동 마스크, 보상 설계의 기준으로 쓴다.
4. RL 목표는 `이기기` 하나만 두면 이상한 축구가 된다. 전술 충실도, 경기 재미, 개인성, 룰 준수, 진행 가치까지 보상과 평가를 나눠야 한다.

## 2. 현재 코드 현황

### 2.1 연결 지점

| 영역 | 파일 | 현재 역할 |
| --- | --- | --- |
| 시청자 월드컵 경기 레이어 | `components/seasonal/worldcup-ball-goal.tsx` | 자동 경기, 선수, 공, 골대, 세트피스, 점수, 사용자 드래그 |
| 시청자 경기 CSS | `components/seasonal/worldcup-ball-goal.css` | 딤, 경기장 라인, 골대, 공, 선수, HUD, 모바일 회전 |
| 편집실 장식 공 | `components/seasonal/worldcup-studio-ball.tsx` | 중력 받는 공 1개, 일정 드래그 ghost와 충돌 |
| 편집실 공 CSS | `components/seasonal/worldcup-studio-ball.css` | 편집실 공 레이어 |
| 월드컵 기간 | `lib/calendar/worldcup.ts` | 월드컵 시작/종료, 단계 마크, 한국 경기 KST 표기 |
| 시청자 장착 | `components/poster/public-poster.tsx` | 월드컵 월이면 `WorldCupBallGoal` 렌더 |
| 편집실 장착 | `components/studio/studio-shell.tsx` | 월드컵 월이면 `WorldCupStudioBall` 렌더 |

### 2.2 `WorldCupBallGoal` 구현 강점

현재 구현이 이미 가진 좋은 기반:

- 10명 필드 플레이어 + 골키퍼 1명 형태의 양 팀 경기 느낌이 있다.
- 포메이션 배열이 별도로 있고, 역할별 위치가 명확하다.
- 전술별 `press`, `possession`, `tempo`, `lineHeight`, `width` 수치가 있다.
- 선수 성향이 역할별로 다르다.
- 공중볼 높이(`ballZ`, `ballVZ`)가 있어 롱패스, 골킥, 코너 크로스를 시각적으로 구분할 수 있다.
- 세트피스 딜레이와 선수가 공으로 걸어가는 연출이 있다.
- `reduced motion`에서 자동 시작을 끄는 접근성 배려가 있다.
- localStorage 토글이 있어 시청자가 숨길 수 있다.
- 타입체크는 통과한다. 2026-06-11 KST 기준 `npm run typecheck` 성공.

### 2.3 `WorldCupBallGoal` 구현 한계

현재 구조상 강화학습에 바로 쓰기 어려운 이유:

- 단일 컴포넌트가 물리, 룰, AI, 렌더, 입력, localStorage, haptic, CSS class 토글을 모두 가진다.
- 상태가 React state와 ref에 분산되어 있고, 외부에서 snapshot을 안정적으로 가져오기 어렵다.
- 랜덤 seed 제어가 없다. 같은 초기조건에서 같은 경기 재현이 어렵다.
- 시간 기준이 `performance.now()`와 rAF에 묶여 있다. 학습용 고속 step 실행이 어렵다.
- 좌표계가 화면 px 중심이다. 실제 축구 룰과 전술은 미터 기반 pitch 좌표가 더 안정적이다.
- 이벤트 로그가 없다. 패스, 슛, 태클, 터치, 오프사이드, 세트피스, xG, possession value를 평가할 수 없다.
- 룰 판정은 흉내다. 예: 골은 "공 전체가 골라인을 넘었는가" 대신 골대 rect 내부 중심 판정에 가깝다.
- 오프사이드는 단순 최후방 수비 라인 근사다. 실제는 두 번째 최후방 상대 또는 공 중 더 앞쪽 기준, 직접 스로인/골킥/코너 예외, 적극 관여, 상대 방해, 리바운드/세이브/고의 플레이 구분이 필요하다.
- 골키퍼는 세이브만 있고 "손으로 잡고 보유", "8초 카운트", "백패스 처리", "스위퍼 키퍼", "드롭/스로/펀트/골킥 선택" 상태가 없다.
- 파울과 프리킥이 없어서 실제 축구 전술과 리스크가 빠진다.

## 3. 법규 기준

기준일은 2026-06-11 KST다. IFAB는 2026/27 법규를 공개했고, 일반 효력일은 2026-07-01이다. 다만 IFAB 발표에 따르면 2026 월드컵과 일부 대회는 변경을 더 일찍 적용할 수 있다. 따라서 엔진에는 `lawProfile`을 둬야 한다.

추천:

- 기본 `lawProfile`: `IFAB_2025_26`
- 월드컵 모드 `competitionProfile`: `FIFA_WORLD_CUP_2026`
- 2026/27 변경 중 월드컵 적용 항목은 feature flag로 켠다.

### 3.1 반드시 반영할 법규 원칙

| 법 | 구현 원칙 | 현재 상태 | 필요 작업 |
| --- | --- | --- | --- |
| Law 8 시작/재개 | 킥오프, 드롭볼, 재개 신호, 재터치 금지 | 킥오프 근사 | 드롭볼, 재개 준비 상태 추가 |
| Law 9 인/아웃 | 공 전체가 터치라인/골라인을 넘으면 아웃 | px 인셋 기반 근사 | 공 반지름 기준 전체 통과 판정 |
| Law 10 득점 | 공 전체가 골대 사이, 크로스바 아래, 골라인 전체 통과 | goal rect 중심 근사 | goal plane crossing 계산 |
| Law 11 오프사이드 | 위치 자체는 반칙 아님. 관여할 때 반칙 | 후보 패스 전 근사 | 터치 순간 snapshot과 관여 이벤트 분리 |
| Law 12 파울 | 직접/간접 프리킥, 핸드볼, GK 특수 규칙, 8초 보유 | 없음 | 파울/핸드볼/GK handling 추가 |
| Law 13 프리킥 | 직접/간접, 정지된 공, 9.15m 거리, 벽 1m | 없음 | freeKick restart state 추가 |
| Law 14 페널티킥 | 페널티 마크, GK 발 위치, 키커 전진 킥 | 없음 | penalty state 추가 |
| Law 15 스로인 | 마지막 터치 반대편, 양발 위치, 뒤에서 머리 위로, 직접 득점 불가, 상대 2m | 스로인 근사 | thrower 이동, throw animation, 2m 거리 |
| Law 16 골킥 | 골 에어리어 안 정지된 공, 수비팀 킥, 공이 명확히 움직이면 인플레이, 상대는 페널티 에어리어 밖 | 골킥 근사 | 골키퍼/수비수 선택, 상대 위치 제한 |
| Law 17 코너킥 | 코너 아크, 공격팀 킥, 직접 득점 가능, 상대 9.15m | 코너킥 근사 | 코너 루틴, 박스 포지셔닝 |

### 3.2 2026 월드컵 반영이 필요한 변경

IFAB 2026-02-28 발표 기준:

- 지연되는 스로인과 골킥은 심판이 5초 visual countdown을 시작할 수 있다.
- 카운트다운 끝까지 공이 인플레이가 아니면 스로인은 상대팀 스로인, 골킥은 상대 코너킥이 된다.
- 골키퍼가 손/팔로 공을 8초 넘게 컨트롤하면 상대 코너킥이다.
- 2026/27 법규는 2026-07-01 효력이지만, 2026 월드컵과 일부 대회는 조기 적용 가능하다.

엔진 설계:

```ts
type LawProfile = {
  season: "IFAB_2025_26" | "IFAB_2026_27";
  worldCup2026EarlyAdoption: boolean;
  goalkeeperHandControlLimitSec: 8;
  delayedThrowInCountdownSec: 5 | null;
  delayedGoalKickCountdownSec: 5 | null;
};
```

## 4. 룰 엔진 설계

강화학습 전 가장 먼저 필요한 것은 `RuleStateMachine`이다. 공이 나갔다고 바로 순간이동시키면 시청자는 싼 애니메이션으로 느끼고, RL은 세트피스 준비를 배울 수 없다.

### 4.1 기본 경기 상태

```ts
type MatchPhase =
  | "preKickoff"
  | "openPlay"
  | "stoppage"
  | "restartSetup"
  | "restartReady"
  | "ballInPlay"
  | "goalScored"
  | "halfTime"
  | "fullTime";

type RestartKind =
  | "kickoff"
  | "throwIn"
  | "goalKick"
  | "cornerKick"
  | "directFreeKick"
  | "indirectFreeKick"
  | "penaltyKick"
  | "droppedBall"
  | "offsideIndirectFreeKick";
```

### 4.2 세트피스 공통 상태

```ts
type RestartState = {
  kind: RestartKind;
  teamId: TeamId;
  location: Vec2;
  causedBy?: EventId;
  takerId?: PlayerId;
  targetReadyShape: TeamShapePlan;
  setupStartedAt: SimTime;
  countdownStartedAt?: SimTime;
  ready: boolean;
};
```

화면 연출:

1. 심판 판정 라벨 표시
2. 공이 멈춤
3. 가장 적합한 선수 또는 골키퍼가 실제 위치까지 이동
4. 나머지 선수들이 전술별 세트피스 위치로 이동
5. 상대는 법정 거리 밖으로 물러남
6. 준비가 끝나면 킥/스로인
7. 공이 명확히 움직이면 `openPlay`

### 4.3 골킥 세부

사용자가 요구한 "골킥이면 골키퍼가 공 잡고 차야 함"을 구현하려면 골킥을 단순 킥이 아니라 장면으로 만들어야 한다.

절차:

- 골라인 밖, 골 아님, 마지막 터치 공격팀이면 골킥.
- 공 위치는 수비팀 골 에어리어 안으로 이동한다.
- `goalkeeperDistributionProfile`에 따라 키커를 정한다.
  - 보통: 골키퍼
  - 빌드업 팀: 센터백이 짧게 처리 가능
  - 롱볼 팀: 골키퍼가 길게 처리
- 골키퍼가 공 위치까지 이동하고, 손으로 집거나 발밑에 정리하는 애니메이션.
- 상대는 페널티 에어리어 밖으로 이동.
- 동료 센터백, 풀백, 6번, 윙어, 타깃맨이 전술별 위치를 잡는다.
- 선택지:
  - 짧은 빌드업: CB/FB/DM에게 짧은 패스
  - 유인 후 전환: 한쪽 CB로 짧게, 압박이 몰리면 반대 풀백 또는 6번
  - 롱볼: 타깃맨 또는 측면 공간
  - 위험 회피: 터치라인 근처 클리어
- 공이 킥되고 명확히 움직이면 인플레이.
- 2026 월드컵 프로필에서 지연 카운트다운 발동 가능.

### 4.4 스로인 세부

사용자가 말한 "경기 안 끊기고 선수가 직접 그 자리까지 가서 던지는 것"은 `restartSetup`에서 표현한다. 실제 룰상 공이 나가면 경기는 끊긴다. 다만 시각적으로 부드럽게 이어지게 만들 수 있다.

절차:

- 공 전체가 터치라인을 넘으면 마지막 터치 반대팀 스로인.
- 위치는 공이 나간 지점.
- 가장 가까운 합법적 thrower 후보를 정한다.
  - 풀백, 윙어 우선
  - 체력 낮으면 근처 선수
  - 전술별로 롱스로 특성이 있는 선수 우선 가능
- thrower가 터치라인 바깥 또는 라인 위로 이동.
- 양발 조건을 시각적으로 단순화: 발 위치 marker만 내부 모델에 둔다.
- 상대는 throw point에서 2m 이상 떨어진다.
- 동료 움직임:
  - 짧은 옵션: 라인 근처 발밑
  - 뒤 옵션: CB/DM 백패스
  - 전진 옵션: 윙어/하프스페이스
  - 롱스로: 박스 안 타깃
- 직접 득점은 불가. 상대 골로 직접 들어가면 골킥, 자기 골로 직접 들어가면 코너킥.
- 직접 받은 선수는 오프사이드 반칙이 없다.
- 2026 월드컵 프로필에서 지연 카운트다운 발동 가능.

### 4.5 오프사이드 세부

현재 오프사이드는 패스 대상 선택 단계에서 단순히 큰 페널티를 주고, 걸리면 간접 프리킥으로 재개한다. RL 기반으로 가려면 위치 판정과 반칙 판정을 분리해야 한다.

필요 모델:

```ts
type OffsideSnapshot = {
  attackingTeamId: TeamId;
  ballPlayedAt: SimTime;
  ballPlayedBy: PlayerId;
  ballPos: Vec2;
  secondLastOpponentLineX: number;
  attackersInOffsidePosition: PlayerId[];
};
```

판정:

- 같은 팀이 공을 플레이하거나 터치한 순간 snapshot 생성.
- 공격수가 상대 골라인에 공과 두 번째 최후방 상대보다 가까우면 오프사이드 위치.
- 자기 진영이면 오프사이드 위치가 아니다.
- 손/팔은 위치 판정에서 제외한다.
- 위치 자체는 반칙이 아니다.
- 다음 중 하나가 있으면 반칙:
  - 공을 플레이하거나 터치
  - 가까운 공을 플레이하려고 명확히 시도하여 상대에게 영향
  - 상대 시야 또는 움직임 방해
  - 골대/크로스바/상대 세이브/굴절 뒤 이득
- 다음은 직접 수령 시 오프사이드 없음:
  - 골킥
  - 스로인
  - 코너킥
- 상대의 고의적 플레이로 받은 경우는 오프사이드 이득이 아니다. 단, 고의적 세이브는 예외로 오프사이드 유지.
- 반칙 위치에서 수비팀 간접 프리킥으로 재개한다.
- 시청 연출: 깃발, 정지, 선수들이 반칙 위치 주변으로 재정렬, 수비팀 짧은 재개.

### 4.6 골키퍼 특수 규칙

골키퍼 상태가 있어야 현실적인 빌드업과 압박이 나온다.

```ts
type GoalkeeperPossession =
  | { kind: "none" }
  | { kind: "feet"; since: SimTime }
  | { kind: "hands"; since: SimTime; releaseDeadline: SimTime };
```

필요 처리:

- 손으로 잡음: 슛 캐치, 크로스 캐치, 루즈볼 스머더.
- 배급: 손 던지기, 롤아웃, 드롭킥, 펀트, 발밑 짧은 패스.
- 손 보유 8초 초과: 상대 코너킥.
- 동료가 고의로 발로 패스한 공을 손으로 잡으면 간접 프리킥.
- 동료 스로인을 직접 받아 손으로 잡으면 간접 프리킥.
- 공을 손에서 놓고 다른 선수가 터치하기 전 다시 손으로 잡으면 간접 프리킥.
- 스위퍼 키퍼: 라인 밖 전진은 손 사용 불가, 발 처리만 가능.

## 5. 전술 엔진 설계

현재 전술은 숫자 성향이다. 앞으로는 전술을 "행동 규칙, 위치 규칙, 보상 규칙, 평가 지표"로 나눠야 한다.

### 5.1 전술 프로필

```ts
type TacticalProfile = {
  name: string;
  baseFormation: FormationId;
  inPossessionShape: ShapeId;
  outOfPossessionShape: ShapeId;
  buildUp: BuildUpStyle;
  progression: ProgressionStyle;
  finalThird: FinalThirdStyle;
  defensiveBlock: DefensiveBlockStyle;
  pressing: PressingStyle;
  transitionAttack: TransitionStyle;
  transitionDefense: TransitionStyle;
  restDefense: RestDefenseStyle;
  setPieces: SetPieceProfile;
  risk: number;
  tempo: number;
  width: number;
  lineHeight: number;
};
```

### 5.2 전술별 실제 행동 기준

| 전술 | 볼 소유 시 | 볼 미소유 시 | RL 평가 지표 |
| --- | --- | --- | --- |
| 티키타카 | 짧은 패스, 삼각형, 3자 조합, 방향 전환, 무리한 롱볼 적음 | 즉시 압박, 높은 라인, 패스길 차단 | 짧은 패스 비율, 삼각 패스, 5초 내 재탈취, 중앙 점유 |
| 점유 빌드업 | GK/CB/DM 사용, 후방 순환, 상대 유인 후 전진 | 미드블록, 압박 회피 우선 | GK 관여, 후방 패스 후 전진 패스, 압박 유인 성공 |
| 중앙 전개 | 6번/8번/10번 연결, 하프스페이스 침투, 벽패스 | 중앙 차단, 세컨드볼 준비 | 중앙 진행 거리, line-breaking pass, third-man run |
| 측면 과부하 | 풀백 오버랩/언더랩, 윙어 1대1, 크로스/컷백 | 공쪽 압박, 반대 전환 대비 | wide touch 비율, cutback, cross target quality |
| 게겐프레스 | 잃자마자 가까운 3-4명 압박 | 높은 라인, 커버섀도우, 위험 감수 | loss 후 5초 압박, 재탈취 위치, 뒷공간 허용 |
| 하이프레스 | 상대 골킥/빌드업 압박 트리거 | 전방부터 유도, GK 패스 차단 | PPDA 근사, 전방 탈취, 압박 회피 당한 횟수 |
| 미드블록 | 중앙 닫고 측면 유도 | 라인 간격 짧게, 무리한 압박 적음 | compactness, central denial, forced-wide rate |
| 로우블록 역습 | 깊게 수비, 공 탈취 후 빠른 전진 | 박스 근처 보호, 뒷공간 최소화 | 탈취 후 8초 내 슛, vertical pass, compact block |
| 롱볼 직접 | 타깃맨, 세컨드볼, 빠른 슛 | 경합 후 압박 | long pass to contest, second-ball win, field tilt |
| 백서큘레이션 유인 | 막히면 뒤로 돌림, 상대 전진 유도 후 재침투 | 소유 유지, 리스크 관리 | back pass 후 상대 라인 상승, 다음 전진 성공 |

### 5.3 패스 분류

패스를 코드에 명시해야 RL이 배우고 평가도 가능하다.

```ts
type PassKind =
  | "groundShort"
  | "groundMedium"
  | "backPass"
  | "lateralPass"
  | "progressivePass"
  | "lineBreakingPass"
  | "throughPass"
  | "loftedThroughPass"
  | "longBall"
  | "switchOfPlay"
  | "crossHigh"
  | "crossLow"
  | "cutback"
  | "wallPass"
  | "thirdManPass"
  | "oneTouchPass"
  | "clearance"
  | "keeperThrow"
  | "keeperRoll"
  | "keeperPunt";
```

각 패스는 다음 값을 가진다.

- 출발 위치
- 도착 목표
- 수평 속도
- 공중 높이
- 회전/커브
- 받는 선수 예상 위치
- 위험도
- 기대 전진 가치
- 오프사이드 위험
- 성공 시 possession value 변화
- 실패 시 transition danger

### 5.4 오프볼 행동

좋은 축구처럼 보이려면 공 가진 선수보다 공 없는 선수 행동이 더 중요하다.

필요 행동:

- support angle: 패스 각도 열기
- check shoulder: 압박 방향 인지
- pin defender: 수비수 고정
- decoy run: 미끼 움직임
- run in behind: 뒷공간 침투
- underlap, overlap: 측면 조합
- occupy half-space: 하프스페이스 점유
- rest defense: 역습 대비 잔류
- counterpress surround: 잃은 지점 주변 압박망
- defensive cover shadow: 패스길 가리기
- hold line: 수비 라인 유지
- step out: 센터백 전진 압박
- drop: 뒷공간 보호

## 6. 선수 개인성 설계

현재 속성은 5개다. RL과 시청 재미를 위해 최소 4계층으로 확장한다.

### 6.1 속성 구조

```ts
type PlayerAttributes = {
  physical: {
    pace: number;
    acceleration: number;
    stamina: number;
    strength: number;
    agility: number;
    jump: number;
  };
  technical: {
    firstTouch: number;
    shortPass: number;
    longPass: number;
    throughPass: number;
    crossing: number;
    dribbling: number;
    finishing: number;
    longShot: number;
    tackling: number;
    interception: number;
    heading: number;
  };
  mental: {
    vision: number;
    decision: number;
    composure: number;
    discipline: number;
    aggression: number;
    riskTaking: number;
    teamwork: number;
    anticipation: number;
    creativity: number;
  };
  goalkeeper?: {
    reflex: number;
    handling: number;
    oneOnOne: number;
    aerialReach: number;
    distributionShort: number;
    distributionLong: number;
    sweeping: number;
  };
};
```

### 6.2 개인성 지표

개인성이 "랜덤으로 조금 다름"에 그치면 부족하다. 관찰 가능한 행동 차이가 있어야 한다.

평가:

- 같은 포지션이라도 패스 선택 분포가 다름
- 위험 감수 성향이 다름
- 압박 참여 빈도가 다름
- 체력 저하 후 행동이 다름
- 선호 발과 몸 방향 때문에 패스 각도가 다름
- 특정 선수는 컷백, 롱패스, 드리블, 침투, 태클 타이밍이 눈에 띔

보상:

- 팀 보상과 개인 역할 보상을 섞는다.
- `playerIdentityConsistencyReward`를 둔다. 단, 승리보다 우선하면 안 된다.
- parameter sharing을 쓰더라도 player id, role, attributes를 observation에 넣어 행동이 구분되게 한다.

## 7. RL 환경 설계

### 7.1 목표 재정의

사용자 목표를 학습 목표로 번역하면 다음이다.

1. 전술별 실제성: 정책이 전술 프로필의 행동 지표를 만족해야 한다.
2. 승리: 골 득실, 승률, Elo가 좋아야 한다.
3. 프레임별 최적성: 매 tick에서 expected possession value와 위험 관리가 좋아야 한다.
4. 선수 개인성: 선수 속성과 행동 분포가 일관되어야 한다.
5. 시청 재미: 경기 흐름, 다양성, 위협 장면, 전술 차이가 눈에 보여야 한다.

주의:

- 축구에는 단일 "정답 행동"이 없다. 부분 관측, 확률, 상대 대응, 전술 철학 때문에 `최고의 해답`은 "상태 가치와 스타일 제약을 함께 만족하는 좋은 선택"으로 정의해야 한다.
- 순수 승리 보상만 주면 공 돌리기, 버그성 드리블, 시간 끌기, 비현실적 압박 같은 편법이 생긴다.

### 7.2 환경 API

```ts
type FootballEnv = {
  reset(seed: number, scenario: ScenarioConfig): ObservationBundle;
  step(actions: Record<PlayerId, PlayerAction>): StepResult;
  getState(): GameState;
  getEventLog(): MatchEvent[];
  renderFrame?(): RenderFrame;
};
```

`step`은 DOM 없이 Node에서 초당 수천 step 이상 돌아야 한다.

### 7.3 Observation

각 선수는 부분 관측을 받는다.

```ts
type PlayerObservation = {
  self: PlayerSelfState;
  ball: RelativeBallState;
  visibleTeammates: RelativePlayerState[];
  visibleOpponents: RelativePlayerState[];
  teamTactic: TacticalProfileEmbedding;
  matchContext: MatchContext;
  restart?: RestartObservation;
  actionMask: ActionMask;
};
```

중앙 critic은 학습 중에만 전역 상태를 볼 수 있다. 실행은 각 선수 observation만 사용한다. 이것이 CTDE(centralized training, decentralized execution)에 맞다.

### 7.4 Action

초기에는 너무 복잡하게 시작하지 않는다. 계층형으로 간다.

1단계 저수준 action:

```ts
type PlayerAction =
  | { type: "move"; dir: Vec2; sprint?: boolean }
  | { type: "holdShape" }
  | { type: "press"; targetId?: PlayerId }
  | { type: "mark"; targetId: PlayerId }
  | { type: "tackle" }
  | { type: "intercept"; lane: Vec2 }
  | { type: "receive"; bodyAngle?: number }
  | { type: "pass"; kind: PassKind; target: Vec2; power: number; height: number }
  | { type: "shoot"; target: Vec2; power: number; height: number }
  | { type: "dribble"; dir: Vec2; intensity: number }
  | { type: "clear"; targetZone: ZoneId }
  | { type: "keeperClaim" }
  | { type: "keeperRelease"; kind: "roll" | "throw" | "punt" | "dropKick" | "shortPass" };
```

2단계 전술 action:

- 팀 coach policy가 "후방 빌드업", "측면 전개", "중앙 전개", "롱볼", "압박 트리거", "라인 내림" 같은 team intent를 낸다.
- 선수 policy는 team intent 안에서 개별 행동을 고른다.

### 7.5 Reward

보상은 반드시 분리 기록한다. 최종 scalar로 합치더라도 로그에는 따로 남겨야 튜닝이 가능하다.

```ts
type RewardBreakdown = {
  score: number;
  progression: number;
  chanceQuality: number;
  possessionValue: number;
  defensiveValue: number;
  ruleCompliance: number;
  tacticFidelity: number;
  roleFidelity: number;
  individualExpression: number;
  viewerQuality: number;
  antiExploit: number;
};
```

가중치 원칙:

- `tacticFidelity`를 일반 shaping이 아니라 주 보상 축으로 둔다.
- 기본 학습에서는 `tacticFidelity`를 `score`보다 크게 둔다. 예: `tacticFidelity 0.30`, `score 0.20`, `progression 0.12`, `chanceQuality 0.10`, `possessionValue 0.08`, `defensiveValue 0.08`, `ruleCompliance 0.07`, `roleFidelity 0.03`, `viewerQuality 0.02`.
- 토너먼트 평가나 최종 fine-tuning에서는 `score` 비중을 조금 올리되, `tacticFidelity`가 1순위 또는 공동 1순위에 남아야 한다.
- 전술이 무너진 승리는 낮게 평가한다. 예: 롱볼 전술이 짧은 패스만 반복해 이기거나, 티키타카 전술이 무지성 롱볼로 이기면 큰 보상보다 낮은 총점.
- 전술별로 `tacticFidelity` 내부 항목을 다르게 둔다. 티키타카는 짧은 패스·삼각형·5초 재압박, 로우블록 역습은 compactness·탈취 후 빠른 전진, 측면 과부하는 wide overload·overlap·cutback을 더 크게 본다.

추천 shaping:

- `score`: 득점 +1, 실점 -1, 승리 보너스.
- `progression`: 공이 상대 골문 쪽 가치 구역으로 전진.
- `chanceQuality`: xG 높은 슛 생성.
- `possessionValue`: 압박 아래 안전한 전진, 좋은 패스 각도.
- `defensiveValue`: 위험 지역 차단, 상대 xG 감소.
- `ruleCompliance`: 오프사이드/파울/불법 재개/백패스 핸들링 페널티.
- `tacticFidelity`: 현재 전술 지표와 실제 행동이 일치. 이 항목은 다른 shaping보다 높은 weight를 준다.
- `roleFidelity`: 풀백, 6번, 윙어, 9번, GK의 역할 행동 일치.
- `individualExpression`: 속성 기반 선택이 눈에 보임.
- `viewerQuality`: 반복 루프/지루한 백패스/무의미한 압박 감소, 위협 장면 증가.
- `antiExploit`: 코너 무한 반복, 버그성 벽튕김, 시간 끌기, 무의미한 짧은 패스 패널티.

### 7.6 커리큘럼

Google Research Football의 Football Academy처럼 작은 과제부터 간다.

1. 1v0 빈 골 슛
2. 1v1 골키퍼
3. 2v1 패스 후 슛
4. 3v2 역습
5. 4v4 미니게임
6. 코너킥 공격/수비
7. 골킥 후방 빌드업 vs 하이프레스
8. 스로인 유지
9. 오프사이드 라인 깨기
10. 7v7 축소 풀게임
11. 11v11 짧은 하프
12. 11v11 풀 매치

각 단계는 scripted policy를 상대 또는 동료로 쓴다. 바로 11v11 self-play로 가면 학습 비용과 디버깅 난도가 너무 높다.

## 8. 엔진 분리 파일 제안

추천 구조:

```txt
lib/football/
  core/
    types.ts
    constants.ts
    rng.ts
    pitch.ts
    geometry.ts
    game-state.ts
    event-log.ts
  physics/
    ball.ts
    player-motion.ts
    collisions.ts
  rules/
    laws.ts
    in-out.ts
    goals.ts
    offside.ts
    fouls.ts
    restarts.ts
    goalkeeper.ts
  tactics/
    formations.ts
    profiles.ts
    zones.ts
    set-pieces.ts
    metrics.ts
  ai/
    scripted-player-policy.ts
    scripted-team-policy.ts
    action-mask.ts
  rl/
    env.ts
    observation.ts
    reward.ts
    scenarios.ts
    replay.ts
components/seasonal/
  worldcup-match-layer.tsx
  worldcup-match-renderer.tsx
  worldcup-ball-goal.tsx
tests/unit/football/
  rules-offside.test.ts
  rules-restarts.test.ts
  rules-goalkeeper.test.ts
  tactics-metrics.test.ts
```

원칙:

- `lib/football`은 DOM, React, CSS, localStorage, haptic을 import하지 않는다.
- `components/seasonal`은 engine snapshot을 받아 그리기만 한다.
- 학습은 `lib/football/rl/env.ts`를 Node 또는 Python bridge에서 돌린다.
- 브라우저는 학습된 policy 또는 scripted policy를 경량 실행한다.

## 9. 테스트 계획

### 9.1 룰 unit test

필수:

- 공 전체가 터치라인을 넘기 전에는 인플레이.
- 공 전체가 골라인 밖, 골문 밖, 마지막 터치 공격팀이면 골킥.
- 공 전체가 골라인 밖, 골문 밖, 마지막 터치 수비팀이면 코너킥.
- 공 전체가 골라인 안쪽 골대 사이로 들어가면 골.
- 스로인 직접 득점은 골이 아님.
- 코너킥 직접 득점은 골 가능.
- 골킥 직접 상대 골 득점은 골 가능.
- 오프사이드 위치만으로 반칙 아님.
- 스로인/골킥/코너 직접 수령은 오프사이드 아님.
- 세이브 리바운드 후 오프사이드 위치 선수가 득점하면 오프사이드.
- 상대 고의 플레이 후 수령은 오프사이드 아님.
- GK 백패스 손 처리 간접 프리킥.
- GK 손 보유 8초 초과 상대 코너킥.
- 프리킥 키커 재터치 간접 프리킥.
- 페널티 키커 뒤로 차면 간접 프리킥.

### 9.2 전술 metric test

필수:

- 티키타카 profile은 짧은 패스 비율이 높아야 한다.
- 롱볼 profile은 평균 패스 길이와 공중볼 비율이 높아야 한다.
- 하이프레스 profile은 상대 후방 소유 때 전방 압박 인원이 많아야 한다.
- 로우블록 profile은 수비 라인이 낮고 compactness가 높아야 한다.
- 측면 과부하 profile은 wide zone 터치와 overlap/underlap이 많아야 한다.
- 백서큘레이션 유인 profile은 후방 패스 뒤 전진 패스 성공률을 평가해야 한다.

### 9.3 시청 품질 test

필수:

- 60초 자동 경기에서 최소 N회 의미 있는 이벤트 발생.
- 같은 seed는 같은 이벤트 로그.
- 다른 전술 조합은 pass map과 압박 위치가 다름.
- 모바일에서 HUD/버튼/공/선수가 겹치지 않음.
- 스코어 박스, `자동 경기`, `미니게임 숨기기` 버튼이 경기장 라인, 공, 선수, 골대, 세트피스 위치를 가리지 않음.
- HUD는 pitch 밖 safe zone 또는 투명도 높은 floating layer에만 배치하고, 화면이 좁으면 자동으로 접히거나 바깥으로 이동.
- 축구장 라인은 실제 비율과 일치. viewport에 맞춰 임의로 늘이지 않고, 105:68 pitch aspect ratio를 유지한 뒤 남는 영역을 여백/safe zone으로 사용.
- reduced motion이면 자동 시작 안 함.

### 9.4 경기장 비율/라인 렌더 요구사항

필수:

- 경기장 내부 좌표는 px가 아니라 meter 기준. 기본 pitch는 국제 경기 표준 범위 안의 105m x 68m로 둔다.
- 렌더러는 `meterToPixel()` 변환만 담당한다. 룰, 선수 위치, 세트피스 위치는 모두 meter 좌표를 원본으로 가진다.
- pitch 전체는 105:68 aspect ratio를 유지한다. 화면 비율이 다르면 pitch를 찌그러뜨리지 말고 contain 방식으로 배치한다.
- 라인 두께도 meter 기준에서 변환한다. IFAB 기준상 모든 라인은 같은 두께이며 최대 12cm다.
- 센터 서클 반지름은 9.15m.
- 페널티 에어리어는 골라인에서 16.5m 깊이, 각 골포스트 안쪽에서 좌우 16.5m 확장.
- 골 에어리어는 골라인에서 5.5m 깊이, 각 골포스트 안쪽에서 좌우 5.5m 확장.
- 페널티 마크는 골라인 중앙에서 11m.
- 페널티 아크는 페널티 마크 중심 반지름 9.15m 중 페널티 에어리어 밖 부분만 렌더.
- 코너 아크는 각 코너 반지름 1m.
- 골대 폭은 7.32m, 높이는 2.44m. 2D top-view에서는 골문 폭 7.32m를 goal line 중앙에 맞춘다.
- 스코어 박스와 컨트롤 버튼은 line box 위에 절대 배치 금지. 겹칠 위험이 있으면 pitch 바깥 여백, 하단 safe strip, 접힘 버튼 순서로 fallback.
- 모바일 landscape 회전 상태에서도 pitch line과 HUD 충돌 검사를 별도로 한다.
- private layer, passcode modal, owner-only data와 독립.

## 10. 단계별 실행 로드맵

### Phase 0: 안정화

목표: 현재 재미 유지, 학습 기반 분리 준비.

작업:

- `worldcup-ball-goal.tsx`의 상수, 포메이션, 전술 profile을 `lib/football/tactics`로 복사 이동.
- deterministic RNG 추가.
- 현재 경기에서 발생하는 이벤트를 `MatchEvent[]`로 남기기 시작.
- 현재 시각 효과는 유지.
- 새 코드가 public/private schedule DTO를 절대 받지 않게 한다.

완료 기준:

- 기존 화면 동일하게 작동.
- `npm run typecheck` 통과.
- 같은 seed로 같은 팀 이름, 포메이션, 선수 성향 생성.

### Phase 1: 룰 엔진

목표: 실제 축구 기초 룰이 엔진에 들어간다.

작업:

- 미터 좌표 pitch 도입. 기본 105m x 68m.
- px 렌더 변환 함수 추가.
- 실제 축구장 라인 비율 구현. 센터 서클, 페널티 에어리어, 골 에어리어, 페널티 마크, 페널티 아크, 코너 아크, 골문 폭을 모두 IFAB Law 1 기준 meter 값으로 계산.
- 스코어 박스와 `자동 경기`/`미니게임 숨기기` 버튼이 pitch line 또는 경기 흐름을 가리지 않도록 HUD safe zone 계산 추가.
- `RuleStateMachine` 작성.
- 골, 아웃, 스로인, 골킥, 코너, 킥오프, 드롭볼 구현.
- 오프사이드 snapshot 구현.
- 골키퍼 손 보유와 백패스 구현.
- 직접/간접 프리킥, 페널티킥 최소 구현.

완료 기준:

- 룰 unit test 30개 이상.
- 세트피스마다 선수들이 실제 위치로 이동 후 재개.
- 오프사이드 위치와 반칙 관여가 분리됨.

### Phase 2: 전술 scripted AI

목표: RL 전에도 전술별 경기가 다르게 보인다.

작업:

- 전술 profile 8개 확정.
- 빌드업, 전개, 파이널서드, 전환, 수비 블록, 세트피스 playbook 작성.
- 패스 taxonomy와 event tagging 추가.
- 팀 shape controller와 선수 role controller 작성.
- 전술 metric dashboard 또는 로그 요약 작성.

완료 기준:

- 티키타카 vs 롱볼, 하이프레스 vs 로우블록이 로그로 구분됨.
- 시청자가 30초 안에 팀 성향 차이를 볼 수 있음.
- scripted AI끼리 3분 축소 경기를 안정적으로 완료.

### Phase 3: RL 환경

목표: MARL 학습 가능.

작업:

- `reset(seed, scenario)`, `step(actions)`, observation, action mask, reward 구현.
- PettingZoo Parallel API와 매핑 가능한 wrapper 설계.
- Football Academy식 scenario 추가.
- replay 저장과 재생.
- self-play evaluation, Elo, win-rate, tactic-fidelity score 추가.

완료 기준:

- headless Node에서 렌더 없이 시뮬레이션 실행.
- 같은 seed replay deterministic.
- 2v1, 3v2, corner scenario에서 baseline 학습 가능.

### Phase 4: 시청자 경기 품질

목표: 학습된 정책 또는 scripted policy가 보기 즐거운 경기 생성.

작업:

- 긴 정체 방지 director 추가.
- 중요 장면 카메라/줌/라벨은 과하지 않게 추가.
- 경기 속도, 하이라이트 빈도, 골 빈도 튜닝.
- 시청자 화면에서는 private data와 무관한 local-only 레이어 유지.

완료 기준:

- 1분 관전 시 전술 차이, 위협 장면, 세트피스가 자연스럽다.
- 모바일과 데스크톱 모두 겹침 없음.
- 숨기기/자동 경기 토글 유지.

## 11. 보안과 프로젝트 경계

이 프로젝트의 최상위 원칙상 public/private boundary가 우선이다.

지켜야 할 것:

- 축구 미니게임 엔진은 schedule private data를 입력으로 받지 않는다.
- owner-only event, private memo, passcode, unlock session, trusted member 정보를 게임 상태에 넣지 않는다.
- 학습 telemetry를 서버에 저장한다면 opt-in, public-only, 익명 game event만 저장한다.
- localStorage 키는 게임 설정과 로컬 점수 정도만 허용한다.
- manager/worker 권한을 바꾸지 않는다.
- 포스터 export에 포함할 경우 deterministic frame만 쓰고 private layer와 섞지 않는다.

KST:

- 월드컵 기간과 한국 경기 표시는 KST 날짜 기준을 유지한다.
- RL match clock은 축구 경기 시간이고, 달력 KST와 분리한다.
- `lib/calendar/worldcup.ts`의 경기일은 KST 명시를 유지한다.

## 12. 바로 다음 작업 추천

가장 먼저 할 작업:

1. `lib/football/core/rng.ts` 추가
2. `lib/football/core/types.ts` 추가
3. `lib/football/tactics/formations.ts`와 `profiles.ts`로 현재 상수 이동
4. `lib/football/rules/in-out.ts`, `goals.ts`, `offside.ts` unit test부터 작성
5. `WorldCupBallGoal`은 새 engine snapshot을 그리는 wrapper로 천천히 축소

절대 먼저 하지 말 것:

- 바로 PPO/MAPPO를 붙이기
- 전술 보상 없이 승리 보상만 주기
- React 컴포넌트를 그대로 RL environment로 쓰기
- 룰 미완성 상태에서 11v11 full match 학습 시작
- schedule DB나 public DTO에 게임 상태 섞기

## 13. 참고 자료

법규:

- IFAB Laws of the Game 2025/26, Law 1: The Field of Play  
  https://www.theifab.com/laws/latest/the-field-of-play/
- IFAB Laws of the Game 2025/26, Law 8: The Start and Restart of Play  
  https://www.theifab.com/laws/latest/the-start-and-restart-of-play/
- IFAB Laws of the Game 2025/26, Law 9: The Ball in and out of Play  
  https://www.theifab.com/laws/latest/the-ball-in-and-out-of-play/
- IFAB Laws of the Game 2025/26, Law 10: Determining the Outcome of a Match  
  https://www.theifab.com/laws/latest/determining-the-outcome-of-a-match/
- IFAB Laws of the Game 2025/26, Law 11: Offside  
  https://www.theifab.com/laws/latest/offside/
- IFAB Laws of the Game 2025/26, Law 12: Fouls and Misconduct  
  https://www.theifab.com/laws/latest/fouls-and-misconduct/
- IFAB Laws of the Game 2025/26, Law 13: Free Kicks  
  https://www.theifab.com/laws/latest/free-kicks/
- IFAB Laws of the Game 2025/26, Law 14: The Penalty Kick  
  https://www.theifab.com/laws/latest/the-penalty-kick/
- IFAB Laws of the Game 2025/26, Law 15: The Throw-in  
  https://www.theifab.com/laws/latest/the-throw-in/
- IFAB Laws of the Game 2025/26, Law 16: The Goal Kick  
  https://www.theifab.com/laws/latest/the-goal-kick/
- IFAB Laws of the Game 2025/26, Law 17: The Corner Kick  
  https://www.theifab.com/laws/latest/the-corner-kick/
- IFAB 2026/27 law changes  
  https://www.theifab.com/law-changes/latest/
- IFAB news, 2026 match flow and player behaviour measures  
  https://www.theifab.com/news/the-ifab-introduces-further-measures-to-improve-match-flow-and-player-behaviour/

전술:

- FIFA Training Centre: Counter-pressing  
  https://www.fifatrainingcentre.com/en/practice/elite-sessions/transition-to-defending/counter-pressing.php
- FIFA Training Centre: Building from the back  
  https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/building_from_the_back_skinner.php
- FIFA Training Centre: Attacking in wide areas  
  https://www.fifatrainingcentre.com/en/practice/elite-sessions/in-possession/gygax-attacking-in-wide-areas.php
- FIFA Training Centre: Al Ahly low-block counter-attack  
  https://www.fifatrainingcentre.com/en/game/game-insights/al-ahlys-counter-attack.php
- FIFA Training Centre: Preventing progression through central areas  
  https://www.fifatrainingcentre.com/en/practice/talent-coach-programme/sessions/preventing-progression-through-central-areas.php
- UEFA Euro 2024 technical report article  
  https://www.uefa.com/uefaeuro/history/news/0291-1bde164db7c4-e4b2f7db6f83-1000--euro-2024-technical-report/

RL/MARL:

- Google Research Football paper: Google Research Football: A Novel Reinforcement Learning Environment  
  https://arxiv.org/abs/1907.11180
- Google Research blog: Introducing Google Research Football  
  https://research.google/blog/introducing-google-research-football-a-novel-reinforcement-learning-environment/
- AAMAS 2024: Boosting Studies of Multi-Agent Reinforcement Learning on Google Research Football Environment  
  https://www.ifaamas.org/Proceedings/aamas2024/pdfs/p1772.pdf
- PettingZoo documentation  
  https://pettingzoo.farama.org/index.html
- PettingZoo paper  
  https://arxiv.org/abs/2009.14471
