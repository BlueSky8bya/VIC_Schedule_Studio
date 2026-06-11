// 헤드리스 축구 env(보고서 3.2) — DOM 0, 결정적, fixed tick. reset/step/observe/actionMask.
// 물리는 의도적으로 단순(2D 점질량 + 마찰 + 킥). 정밀 물리/공중볼/충돌은 후속 Step에서 교체한다.
// 핵심 불변식: 같은 seed + 같은 action 시퀀스 → 동일 trajectory(리플레이/테스트 재현).

import {
  HALF_L,
  HALF_W,
  defendingGoalSide,
  inBounds,
  inPenaltyArea
} from "@/lib/football/core/pitch";
import { makeRng, type Rng } from "@/lib/football/core/rng";
import type { BallState, Role, TeamSide, Vec2 } from "@/lib/football/core/types";
import { goalScoredSide, scoringTeamForGoal } from "@/lib/football/rules/goals";
import { computeActionMask } from "@/lib/football/rl/action-mask";
import { relativeEntity, toAttackCentric } from "@/lib/football/rl/observation";
import { SCENARIOS, type ScenarioId } from "@/lib/football/rl/scenarios";
import type {
  AgentIndex,
  ActionMask,
  EntityState,
  JointAction,
  PlayerObservation,
  StepEvent
} from "@/lib/football/rl/types";

export type EnvPlayer = {
  team: TeamSide;
  role: Role | "GK";
  pos: Vec2;
  vel: Vec2;
  stamina: number;
  sentOff: boolean;
};

export type EnvState = {
  tick: number;
  time: number; // sim 초
  ball: BallState;
  players: EnvPlayer[];
  score: [number, number];
  lastTouch: TeamSide | null;
};

export type StepResult = {
  state: EnvState;
  done: boolean;
  events: StepEvent[];
};

const CONTROL_RADIUS = 1.2; // m — 이 안이면 공 통제 가능
const WALK_SPEED = 5.0; // m/s
const SPRINT_SPEED = 7.5;
const BALL_FRICTION = 0.92; // per step 감속
const MAX_KICK_SPEED = 28; // m/s

function vlen(v: Vec2): number {
  return Math.hypot(v.x, v.y);
}
function clampMag(v: Vec2, max: number): Vec2 {
  const m = vlen(v);
  return m > max ? { x: (v.x / m) * max, y: (v.y / m) * max } : v;
}

export class FootballEnv {
  readonly hz: number;
  private dt: number;
  private rng: Rng;
  private state: EnvState;
  private scenarioId: ScenarioId;

  constructor(opts: { decisionHz?: number } = {}) {
    this.hz = opts.decisionHz ?? 10;
    this.dt = 1 / this.hz;
    this.rng = makeRng(1);
    this.scenarioId = "5v5";
    this.state = this.blankState();
  }

  private blankState(): EnvState {
    return {
      tick: 0,
      time: 0,
      ball: { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, height: 0, vz: 0 },
      players: [],
      score: [0, 0],
      lastTouch: null
    };
  }

  /** 시나리오·seed로 초기화. 같은 (seed, scenario)면 동일 배치. */
  reset(seed: number, scenarioId: ScenarioId): EnvState {
    this.rng = makeRng(seed >>> 0);
    this.scenarioId = scenarioId;
    const spec = SCENARIOS[scenarioId];
    const players: EnvPlayer[] = [];
    ([0, 1] as const).forEach((team) => {
      const n = spec.teamSizes[team];
      const dir = team === 0 ? -1 : 1; // 자기 진영(team0 왼쪽)
      for (let k = 0; k < n; k += 1) {
        const frac = n === 1 ? 0.5 : k / (n - 1);
        players.push({
          team,
          role: this.outfieldRole(k, n),
          pos: { x: dir * HALF_L * 0.3, y: (frac - 0.5) * HALF_W * 1.2 },
          vel: { x: 0, y: 0 },
          stamina: 1,
          sentOff: false
        });
      }
      if (spec.withKeepers) {
        players.push({
          team,
          role: "GK",
          pos: { x: dir * (HALF_L - 1.5), y: 0 },
          vel: { x: 0, y: 0 },
          stamina: 1,
          sentOff: false
        });
      }
    });
    this.state = {
      ...this.blankState(),
      ball: { pos: { ...spec.ballStart }, vel: { x: 0, y: 0 }, height: 0, vz: 0 }
    };
    this.state.players = players;
    return this.state;
  }

  private outfieldRole(k: number, n: number): Role {
    if (n <= 2) return "FW";
    const f = k / (n - 1);
    if (f < 0.34) return "DF";
    if (f < 0.67) return "MF";
    return "FW";
  }

  get current(): EnvState {
    return this.state;
  }

  private nearestToBall(team?: TeamSide): AgentIndex {
    let best = -1;
    let bd = Infinity;
    this.state.players.forEach((p, i) => {
      if (p.sentOff) return;
      if (team != null && p.team !== team) return;
      const d = Math.hypot(p.pos.x - this.state.ball.pos.x, p.pos.y - this.state.ball.pos.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /** 한 스텝 — 모든 에이전트 동시 행동. */
  step(actions: JointAction): StepResult {
    const st = this.state;
    const events: StepEvent[] = [];
    const ballOwner = this.nearestToBall();
    const ownerHasBall =
      ballOwner >= 0 &&
      Math.hypot(
        st.players[ballOwner].pos.x - st.ball.pos.x,
        st.players[ballOwner].pos.y - st.ball.pos.y
      ) <= CONTROL_RADIUS;

    // 1) 선수 이동 — action.target 쪽으로(없으면 정지). sprint면 빠르게.
    st.players.forEach((p, i) => {
      if (p.sentOff) {
        p.vel = { x: 0, y: 0 };
        return;
      }
      const a = actions[i] ?? { type: "idle" as const };
      const speed = a.sprint ? SPRINT_SPEED : WALK_SPEED;
      const tgt = a.target;
      if (tgt && a.type !== "idle") {
        const dx = tgt.x - p.pos.x;
        const dy = tgt.y - p.pos.y;
        const d = Math.hypot(dx, dy) || 1;
        const v = clampMag({ x: (dx / d) * speed, y: (dy / d) * speed }, speed);
        p.vel = v;
      } else {
        p.vel = { x: 0, y: 0 };
      }
      p.pos.x = Math.max(-HALF_L, Math.min(HALF_L, p.pos.x + p.vel.x * this.dt));
      p.pos.y = Math.max(-HALF_W, Math.min(HALF_W, p.pos.y + p.vel.y * this.dt));
      // 체력
      const used = vlen(p.vel) / SPRINT_SPEED;
      p.stamina = Math.max(0, Math.min(1, p.stamina - used * 0.003 + 0.002));
    });

    // 2) 공 — 보유자가 pass/shoot/clear/carry면 차고, 아니면 마찰로 굴러간다.
    const ownerAction = ballOwner >= 0 ? actions[ballOwner] : undefined;
    if (
      ownerHasBall &&
      ownerAction &&
      (ownerAction.type === "pass" ||
        ownerAction.type === "shoot" ||
        ownerAction.type === "clear" ||
        ownerAction.type === "gkRelease") &&
      ownerAction.target
    ) {
      const o = st.players[ballOwner];
      const dx = ownerAction.target.x - st.ball.pos.x;
      const dy = ownerAction.target.y - st.ball.pos.y;
      const d = Math.hypot(dx, dy) || 1;
      const power = Math.max(0.1, Math.min(1, ownerAction.power ?? 0.7));
      const spd = MAX_KICK_SPEED * power;
      st.ball.vel = { x: (dx / d) * spd, y: (dy / d) * spd };
      st.lastTouch = o.team;
      if (ownerAction.type === "shoot") events.push({ kind: "shot", team: o.team, pos: { ...st.ball.pos } });
    } else if (ownerHasBall && ownerAction && ownerAction.type === "carry") {
      // 드리블 — 공이 보유자 발 앞에 붙어 함께 이동.
      const o = st.players[ballOwner];
      st.ball.pos = { x: o.pos.x, y: o.pos.y };
      st.ball.vel = { x: 0, y: 0 };
      st.lastTouch = o.team;
    } else {
      st.ball.pos.x += st.ball.vel.x * this.dt;
      st.ball.pos.y += st.ball.vel.y * this.dt;
      st.ball.vel.x *= BALL_FRICTION;
      st.ball.vel.y *= BALL_FRICTION;
      if (ownerHasBall) st.lastTouch = st.players[ballOwner].team;
    }

    // 3) 룰 — 골/아웃 판정(기존 rules 재사용).
    const scoredSide = goalScoredSide(st.ball);
    if (scoredSide) {
      const team = scoringTeamForGoal(scoredSide);
      st.score[team] += 1;
      events.push({ kind: "goal", team, pos: { ...st.ball.pos } });
      this.resetBallCenter();
    } else if (!inBounds(st.ball.pos)) {
      events.push({ kind: "out", team: st.lastTouch ?? undefined, pos: { ...st.ball.pos } });
      // skeleton: 간단 복귀(중앙). 정확한 throw-in/corner/goal-kick 배치는 후속.
      this.resetBallCenter();
    }

    st.tick += 1;
    st.time += this.dt;
    const done = st.time >= SCENARIOS[this.scenarioId].durationSec;
    return { state: st, done, events };
  }

  private resetBallCenter() {
    this.state.ball = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, height: 0, vz: 0 };
  }

  /** actor 관측 — local 정보만(공격 방향 +x 정규화). */
  observe(i: AgentIndex): PlayerObservation {
    const st = this.state;
    const self = st.players[i];
    const selfAc = toAttackCentric(self.pos, self.team);
    const owner = this.nearestToBall();
    const hasBall =
      owner === i &&
      Math.hypot(self.pos.x - st.ball.pos.x, self.pos.y - st.ball.pos.y) <= CONTROL_RADIUS;

    const teammates: EntityState[] = [];
    const opponents: EntityState[] = [];
    st.players.forEach((p, j) => {
      if (j === i || p.sentOff) return;
      const e = relativeEntity(
        p.team === self.team ? "teammate" : "opponent",
        p.pos,
        p.vel,
        self.team,
        selfAc,
        p.role
      );
      (p.team === self.team ? teammates : opponents).push(e);
    });

    return {
      self: {
        index: i,
        team: self.team,
        role: self.role,
        pos: selfAc,
        vel: { x: self.vel.x * (self.team === 0 ? 1 : -1), y: self.vel.y * (self.team === 0 ? 1 : -1) },
        stamina: self.stamina,
        hasBall
      },
      ball: relativeEntity("ball", st.ball.pos, st.ball.vel, self.team, selfAc),
      teammates,
      opponents,
      mask: this.actionMask(i)
    };
  }

  actionMask(i: AgentIndex): ActionMask {
    const st = this.state;
    const p = st.players[i];
    const owner = this.nearestToBall();
    const hasBall =
      owner === i && Math.hypot(p.pos.x - st.ball.pos.x, p.pos.y - st.ball.pos.y) <= CONTROL_RADIUS;
    const ownSide = defendingGoalSide(p.team);
    return computeActionMask({
      hasBall,
      isGoalkeeper: p.role === "GK",
      inOwnPenaltyArea: inPenaltyArea(p.pos, ownSide),
      isRestartTaker: false,
      inRestartSetup: false,
      sentOff: p.sentOff
    });
  }
}
