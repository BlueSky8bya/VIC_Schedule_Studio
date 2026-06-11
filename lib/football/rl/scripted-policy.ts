// Scripted baseline(보고서 Step 4) — 규칙 기반 축구 AI. RL이 이걸 이기고/닮고/변주하는 기준선이자
// behavior cloning 소스. dynamic anchoring(공만 안 쫓고 형태 유지) + analytics로 패스/슛/압박 결정.
// 순수 함수: (상태 + 전술) → JointAction. 같은 입력이면 같은 출력(결정적).

import { attackingGoalSide, goalLineX } from "@/lib/football/core/pitch";
import type { Role, TeamSide, Vec2 } from "@/lib/football/core/types";
import { xgFromShot } from "@/lib/football/analytics/xg-lite";
import { xtValue } from "@/lib/football/analytics/xt-grid";
import { passProbability } from "@/lib/football/analytics/pitch-control-lite";
import { anchorFromBase, type AnchorTactic, type Phase } from "@/lib/football/tactics/anchors";
import type { EnvState } from "@/lib/football/rl/env";
import type { AgentAction, JointAction } from "@/lib/football/rl/types";

export type ScriptedConfig = {
  tactics: [AnchorTactic, AnchorTactic]; // 팀별 전술 성향
  bases: Vec2[]; // 선수별 anchor base(env.bases)
  pressN?: number; // 공격팀 보유 시 압박 가담 수비수 수
  shootXg?: number; // 이 xG 이상이면 슛
};

function d(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** 모든 선수의 행동 — 보유팀 캐리어는 슛/패스/드리블, 나머지는 anchor/압박. */
export function scriptedJointAction(state: EnvState, cfg: ScriptedConfig): JointAction {
  const { players, ball } = state;
  const pressN = cfg.pressN ?? 2;
  const shootXg = cfg.shootXg ?? 0.22;

  // 보유팀 = 공에 가장 가까운 선수의 팀.
  let owner = -1;
  let od = Infinity;
  players.forEach((p, i) => {
    if (p.sentOff) return;
    const dd = d(p.pos, ball.pos);
    if (dd < od) {
      od = dd;
      owner = i;
    }
  });
  const possTeam: TeamSide = owner >= 0 ? players[owner].team : 0;

  // 팀별 공까지 거리 순위(압박 배정).
  const rank = new Array<number>(players.length).fill(99);
  ([0, 1] as const).forEach((team) => {
    const ids = players
      .map((p, i) => ({ p, i }))
      .filter((x) => x.p.team === team && !x.p.sentOff)
      .sort((a, b) => d(a.p.pos, ball.pos) - d(b.p.pos, ball.pos));
    ids.forEach((x, r) => {
      rank[x.i] = r;
    });
  });

  return players.map((p, i): AgentAction => {
    if (p.sentOff) return { type: "idle" };
    const team = p.team;
    const attacking = team === possTeam;
    const phase: Phase = attacking ? "attack" : "defend";
    const goalX = goalLineX(attackingGoalSide(team));
    const goalCenter: Vec2 = { x: goalX, y: 0 };

    // 캐리어 — 슛/패스/드리블.
    if (i === owner && attacking) {
      const xg = xgFromShot(p.pos, team);
      if (xg >= shootXg) {
        return { type: "shoot", target: goalCenter, power: 1 };
      }
      // 최적 패스 후보 — 성공률 × 전진 가치.
      const opp = players.filter((q) => q.team !== team && !q.sentOff).map((q) => q.pos);
      let best = -1;
      let bestScore = 0.35; // 임계(이보다 좋아야 패스)
      players.forEach((q, j) => {
        if (j === i || q.team !== team || q.sentOff) return;
        const prob = passProbability(p.pos, q.pos, opp);
        const value = 0.5 + xtValue(q.pos, team);
        const s = prob * value;
        if (s > bestScore) {
          bestScore = s;
          best = j;
        }
      });
      if (best >= 0) {
        return { type: "pass", target: { ...players[best].pos }, power: 0.6 };
      }
      // 드리블 — 골 쪽으로 전진.
      const dir = team === 0 ? 1 : -1;
      return { type: "carry", target: { x: p.pos.x + dir * 8, y: p.pos.y * 0.85 } };
    }

    // 수비 — 가까운 pressN명은 공으로 압박, 나머지는 anchor(드롭/컴팩트).
    if (!attacking && rank[i] < pressN) {
      return { type: "press", target: { ...ball.pos }, sprint: true };
    }

    // 그 외 — dynamic anchor로 이동(형태 유지). 공격 비캐리어는 전진 지원, 수비는 컴팩트.
    const role: Role = p.role === "GK" ? "DF" : p.role;
    if (p.role === "GK") {
      // 키퍼 — 골과 공 사이 라인서 각도 줄이기(간단).
      const t = 0.12;
      return {
        type: "move",
        target: { x: goalX + (ball.pos.x - goalX) * t, y: ball.pos.y * 0.4 }
      };
    }
    const anchor = anchorFromBase(cfg.bases[i], role, team, ball.pos, cfg.tactics[team], phase);
    const moving = d(p.pos, anchor) > 1.5;
    return { type: attacking ? "support" : "cover", target: anchor, sprint: moving && rank[i] < 3 };
  });
}
