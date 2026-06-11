import { describe, expect, it } from "vitest";
import { FootballEnv } from "@/lib/football/rl/env";
import { computeActionMask } from "@/lib/football/rl/action-mask";
import { toAttackCentric, relativeEntity } from "@/lib/football/rl/observation";
import { REWARD_WEIGHTS, emptyBreakdown, weightedReward } from "@/lib/football/rl/reward";
import { MVP_SCENARIOS, SCENARIOS } from "@/lib/football/rl/scenarios";
import type { JointAction } from "@/lib/football/rl/types";

// 모든 선수가 공으로 이동하는 결정적 행동 — 난수 없음.
function chaseBall(env: FootballEnv): JointAction {
  const st = env.current;
  return st.players.map(() => ({ type: "move" as const, target: { ...st.ball.pos }, sprint: true }));
}

describe("FootballEnv 결정성", () => {
  it("같은 seed + scenario + action 시퀀스 → 동일 trajectory", () => {
    const run = () => {
      const env = new FootballEnv({ decisionHz: 10 });
      env.reset(42, "5v5");
      for (let t = 0; t < 60; t += 1) env.step(chaseBall(env));
      return JSON.stringify(env.current);
    };
    expect(run()).toBe(run());
  });

  it("reset이 시나리오 인원수대로 선수를 만든다(키퍼 포함)", () => {
    const env = new FootballEnv();
    const st = env.reset(1, "5v5");
    // 5v5 + 양팀 키퍼 = 12명
    expect(st.players.length).toBe(12);
    expect(st.players.filter((p) => p.role === "GK").length).toBe(2);
  });

  it("done은 durationSec에 도달해야 true", () => {
    const env = new FootballEnv({ decisionHz: 10 });
    env.reset(1, "2v1");
    let done = false;
    let steps = 0;
    while (!done && steps < 1000) {
      done = env.step(chaseBall(env)).done;
      steps += 1;
    }
    expect(done).toBe(true);
    expect(steps).toBe(SCENARIOS["2v1"].durationSec * 10);
  });
});

describe("관측 정규화", () => {
  it("attack-centric: team1은 좌표가 뒤집힌다(공격 항상 +x)", () => {
    expect(toAttackCentric({ x: 10, y: 4 }, 0)).toEqual({ x: 10, y: 4 });
    expect(toAttackCentric({ x: 10, y: 4 }, 1)).toEqual({ x: -10, y: -4 });
  });

  it("상대 엔티티 거리는 ego 상대 위치 크기", () => {
    const e = relativeEntity("opponent", { x: 3, y: 0 }, { x: 0, y: 0 }, 0, { x: 0, y: 0 });
    expect(e.distance).toBeCloseTo(3);
  });
});

describe("action mask", () => {
  it("공 없으면 shoot/pass off, 이동/수비는 on", () => {
    const m = computeActionMask({
      hasBall: false,
      isGoalkeeper: false,
      inOwnPenaltyArea: false,
      isRestartTaker: false,
      inRestartSetup: false,
      sentOff: false
    });
    expect(m.shoot).toBe(false);
    expect(m.pass).toBe(false);
    expect(m.move).toBe(true);
    expect(m.press).toBe(true);
  });

  it("퇴장이면 idle만", () => {
    const m = computeActionMask({
      hasBall: true,
      isGoalkeeper: false,
      inOwnPenaltyArea: false,
      isRestartTaker: false,
      inRestartSetup: false,
      sentOff: true
    });
    expect(m.idle).toBe(true);
    expect(m.move).toBe(false);
    expect(m.shoot).toBe(false);
  });

  it("GK 손은 자기 박스 안에서만", () => {
    const out = computeActionMask({
      hasBall: false,
      isGoalkeeper: true,
      inOwnPenaltyArea: false,
      isRestartTaker: false,
      inRestartSetup: false,
      sentOff: false
    });
    expect(out.gkClaim).toBe(false);
    const inBox = computeActionMask({
      hasBall: false,
      isGoalkeeper: true,
      inOwnPenaltyArea: true,
      isRestartTaker: false,
      inRestartSetup: false,
      sentOff: false
    });
    expect(inBox.gkClaim).toBe(true);
  });
});

describe("reward", () => {
  it("weight 합은 약 1.0, tacticFidelity가 최대", () => {
    const sum = Object.values(REWARD_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
    const max = Math.max(...Object.values(REWARD_WEIGHTS));
    expect(REWARD_WEIGHTS.tacticFidelity).toBe(max);
  });
  it("weightedReward: score만 1이면 score weight", () => {
    const b = emptyBreakdown();
    b.score = 1;
    expect(weightedReward(b)).toBeCloseTo(REWARD_WEIGHTS.score);
  });
});

describe("scenarios", () => {
  it("MVP 시나리오가 모두 SCENARIOS에 존재", () => {
    MVP_SCENARIOS.forEach((id) => expect(SCENARIOS[id]).toBeDefined());
  });
});
