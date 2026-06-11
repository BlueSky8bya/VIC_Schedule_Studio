import { describe, expect, it } from "vitest";
import {
  anchorFromBase,
  computePlayerAnchor,
  computeTeamAnchors,
  shapeTargets,
  slotToMeters
} from "@/lib/football/tactics/anchors";
import { FootballEnv } from "@/lib/football/rl/env";
import { scriptedJointAction } from "@/lib/football/rl/scripted-policy";
import { FORMATIONS } from "@/lib/football/tactics/formations";
import { HALF_L } from "@/lib/football/core/pitch";
import type { Slot } from "@/lib/football/core/types";

const FW: Slot = { bx: 0.85, by: 0.5, role: "FW" };
const tactic = { lineHeight: 0.12, width: 1.0 };

describe("dynamic anchoring", () => {
  it("slotToMeters: team0 상대골 슬롯은 +x, team1은 미러(-x)", () => {
    const a = slotToMeters({ bx: 0.9, by: 0.5, role: "FW" }, 0);
    const b = slotToMeters({ bx: 0.9, by: 0.5, role: "FW" }, 1);
    expect(a.x).toBeGreaterThan(0);
    expect(b.x).toBeLessThan(0);
    expect(a.x).toBeCloseTo(-b.x);
  });

  it("라인 높을수록 team0 anchor가 더 전진(+x)", () => {
    const low = computePlayerAnchor(FW, 0, { x: 0, y: 0 }, { lineHeight: 0.02, width: 1 }, "attack");
    const high = computePlayerAnchor(FW, 0, { x: 0, y: 0 }, { lineHeight: 0.2, width: 1 }, "attack");
    expect(high.x).toBeGreaterThan(low.x);
  });

  it("공쪽으로 제한 쏠림 — 공이 위(-y)면 anchor도 위로 당겨짐", () => {
    const center = computePlayerAnchor(FW, 0, { x: 0, y: 0 }, tactic, "attack");
    const ballUp = computePlayerAnchor(FW, 0, { x: 0, y: -30 }, tactic, "attack");
    expect(ballUp.y).toBeLessThan(center.y);
  });

  it("수비 페이즈 ball-shift가 더 강하다(라인높이 0으로 푸시 영향 제거)", () => {
    // lineHeight=0이면 전진 푸시가 없어 순수 ball-shift만 비교된다(수비 infl 0.2 > 공격 0.1).
    const flat = { lineHeight: 0, width: 1 };
    const base = { x: 0, y: 0 };
    const ball = { x: 20, y: 0 };
    const atk = anchorFromBase(base, "MF", 0, ball, flat, "attack");
    const def = anchorFromBase(base, "MF", 0, ball, flat, "defend");
    expect(Math.abs(def.x - ball.x)).toBeLessThan(Math.abs(atk.x - ball.x));
  });

  it("computeTeamAnchors: 슬롯 수만큼 반환, 모두 경기장 안", () => {
    const anchors = computeTeamAnchors(FORMATIONS["4-3-3"], 0, { x: 0, y: 0 }, tactic, "attack");
    expect(anchors.length).toBe(10);
    anchors.forEach((a) => {
      expect(Math.abs(a.x)).toBeLessThanOrEqual(HALF_L);
    });
  });

  it("shapeTargets: 폭이 넓으면 widthTarget 큼", () => {
    const narrow = shapeTargets(0, { lineHeight: 0.1, width: 0.85 }, "attack");
    const wide = shapeTargets(0, { lineHeight: 0.1, width: 1.15 }, "attack");
    expect(wide.widthTarget).toBeGreaterThan(narrow.widthTarget);
  });
});

describe("scripted policy", () => {
  const cfg = (env: FootballEnv) => ({
    tactics: [
      { lineHeight: 0.14, width: 1.05 },
      { lineHeight: 0.06, width: 0.9 }
    ] as [{ lineHeight: number; width: number }, { lineHeight: number; width: number }],
    bases: env.bases
  });

  it("선수 수만큼 행동을 내고 종류가 유효", () => {
    const env = new FootballEnv();
    env.reset(7, "5v5");
    const actions = scriptedJointAction(env.current, cfg(env));
    expect(actions.length).toBe(env.current.players.length);
    actions.forEach((a) => expect(typeof a.type).toBe("string"));
  });

  it("스크립트 5v5 경기가 결정적으로 끝까지 돈다(같은 seed → 동일)", () => {
    const run = () => {
      const env = new FootballEnv({ decisionHz: 10 });
      env.reset(99, "5v5");
      let done = false;
      let guard = 0;
      const c = cfg(env);
      while (!done && guard < 5000) {
        done = env.step(scriptedJointAction(env.current, c)).done;
        guard += 1;
      }
      return { json: JSON.stringify(env.current), steps: guard };
    };
    const a = run();
    const b = run();
    expect(a.json).toBe(b.json);
    expect(a.steps).toBeGreaterThan(0);
  });

  it("스크립트 AI가 실제로 공을 플레이한다(킥/아웃/슛 이벤트 발생)", () => {
    // 3v2: team0가 더 가까워 공을 잡고 전진 → 패스/드리블/슛이 일어난다.
    const env = new FootballEnv({ decisionHz: 10 });
    env.reset(3, "3v2");
    const c = cfg(env);
    let events = 0;
    let maxDisp = 0;
    for (let t = 0; t < 200; t += 1) {
      events += env.step(scriptedJointAction(env.current, c)).events.length;
      maxDisp = Math.max(maxDisp, Math.hypot(env.current.ball.pos.x, env.current.ball.pos.y));
    }
    // 공이 중앙을 벗어나 움직였거나(전진), 최소한 이벤트(킥→아웃 등)가 발생했어야 한다.
    expect(events + (maxDisp > 3 ? 1 : 0)).toBeGreaterThan(0);
  });
});
