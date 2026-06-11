import { describe, expect, it } from "vitest";
import type { BallState } from "@/lib/football/core/types";
import {
  HALF_GOAL,
  HALF_L,
  HALF_W,
  PITCH,
  goalLineX,
  inBounds,
  inGoalArea,
  inPenaltyArea,
  penaltyMarkPos,
  withinGoalMouth
} from "@/lib/football/core/pitch";
import { goalScoredSide, scoringTeamForGoal } from "@/lib/football/rules/goals";
import { ballOut } from "@/lib/football/rules/in-out";

const ball = (x: number, y: number, height = 0): BallState => ({
  pos: { x, y },
  vel: { x: 0, y: 0 },
  height,
  vz: 0
});

describe("pitch 지오메트리(Law 1)", () => {
  it("표준 치수", () => {
    expect(PITCH.length).toBe(105);
    expect(PITCH.width).toBe(68);
    expect(PITCH.goalWidth).toBe(7.32);
    expect(PITCH.centerCircleR).toBe(9.15);
    expect(HALF_L).toBe(52.5);
    expect(HALF_W).toBe(34);
    expect(HALF_GOAL).toBeCloseTo(3.66);
  });
  it("골라인 x", () => {
    expect(goalLineX("left")).toBe(-52.5);
    expect(goalLineX("right")).toBe(52.5);
  });
  it("골문 폭 판정", () => {
    expect(withinGoalMouth(0)).toBe(true);
    expect(withinGoalMouth(3.6)).toBe(true);
    expect(withinGoalMouth(4)).toBe(false);
    expect(withinGoalMouth(-3.6)).toBe(true);
  });
  it("페널티 마크는 골라인서 11m", () => {
    expect(penaltyMarkPos("left")).toEqual({ x: -52.5 + 11, y: 0 });
    expect(penaltyMarkPos("right")).toEqual({ x: 52.5 - 11, y: 0 });
  });
  it("페널티/골 에어리어", () => {
    expect(inPenaltyArea({ x: -50, y: 0 }, "left")).toBe(true);
    expect(inPenaltyArea({ x: -30, y: 0 }, "left")).toBe(false); // 너무 안쪽(16.5m 밖)
    expect(inGoalArea({ x: -50, y: 0 }, "left")).toBe(true);
    expect(inGoalArea({ x: -44, y: 0 }, "left")).toBe(false); // 5.5m 밖
  });
  it("inBounds", () => {
    expect(inBounds({ x: 0, y: 0 })).toBe(true);
    expect(inBounds({ x: 52.5, y: 34 })).toBe(true); // 라인 위
    expect(inBounds({ x: 60, y: 0 })).toBe(false);
  });
});

describe("goals(Law 10) — 공 전체가 골라인 넘고 포스트 사이, 크로스바 아래", () => {
  it("골: 오른쪽/왼쪽", () => {
    expect(goalScoredSide(ball(52.7, 0))).toBe("right");
    expect(goalScoredSide(ball(-52.7, 1.5))).toBe("left");
  });
  it("공이 라인에 걸치면(전체 안 넘음) 골 아님", () => {
    expect(goalScoredSide(ball(52.55, 0))).toBeNull(); // 52.55 - 0.11 = 52.44 < 52.5
  });
  it("포스트 밖이면 골 아님", () => {
    expect(goalScoredSide(ball(52.7, 5))).toBeNull();
  });
  it("크로스바 위(height≥2.44)면 골 아님", () => {
    expect(goalScoredSide(ball(52.7, 0, 2.5))).toBeNull();
    expect(goalScoredSide(ball(52.7, 0, 2.0))).toBe("right");
  });
  it("득점 팀: 오른쪽=0, 왼쪽=1", () => {
    expect(scoringTeamForGoal("right")).toBe(0);
    expect(scoringTeamForGoal("left")).toBe(1);
  });
});

describe("in-out(Law 9) — 공 전체가 라인 넘어야 아웃", () => {
  it("경기장 안은 인플레이", () => {
    expect(ballOut(ball(0, 0), 0).out).toBe(false);
    expect(ballOut(ball(52.5, 34), 0).out).toBe(false); // 라인 위 = 인
  });
  it("터치라인 전체 통과 → 스로인(마지막 터치 반대팀)", () => {
    const r = ballOut(ball(10, 34.2), 0);
    expect(r).toMatchObject({ out: true, restart: "throwIn", awardTeam: 1, where: "bottom" });
    const r2 = ballOut(ball(10, -34.2), 1);
    expect(r2).toMatchObject({ out: true, restart: "throwIn", awardTeam: 0, where: "top" });
  });
  it("터치라인 살짝 걸침은 인플레이", () => {
    expect(ballOut(ball(10, 34.05), 0).out).toBe(false); // 34.05 - 0.11 < 34
  });
  it("골라인 아웃 — 수비팀 마지막 터치 → 코너킥(공격팀)", () => {
    // 오른쪽 골(수비=팀1)로 나감, 팀1이 마지막 터치 → 코너, 공격팀0
    const r = ballOut(ball(52.7, 10), 1);
    expect(r).toMatchObject({ out: true, restart: "cornerKick", awardTeam: 0, side: "right" });
  });
  it("골라인 아웃 — 공격팀 마지막 터치 → 골킥(수비팀)", () => {
    // 오른쪽 골로 나감, 팀0(공격)이 마지막 터치 → 골킥, 수비팀1
    const r = ballOut(ball(52.7, 10), 0);
    expect(r).toMatchObject({ out: true, restart: "goalKick", awardTeam: 1, side: "right" });
  });
  it("골이면 아웃 아님(별도 처리)", () => {
    expect(ballOut(ball(52.7, 0), 0).out).toBe(false); // 골문 안 = 골
  });
  it("왼쪽 골라인 아웃 대칭", () => {
    expect(ballOut(ball(-52.7, 10), 0)).toMatchObject({ restart: "cornerKick", awardTeam: 1, side: "left" });
    expect(ballOut(ball(-52.7, 10), 1)).toMatchObject({ restart: "goalKick", awardTeam: 0, side: "left" });
  });
});
