// Pitch control lite — 어떤 지점을 어느 팀이 장악하는가(누가 먼저 도달하나, 거리 근사).
// 정밀 pitch control(속도/가속/도착시간 적분)의 단순화. passProbability/support 평가에 쓴다.

import type { TeamSide, Vec2 } from "@/lib/football/core/types";

export type ControlPlayer = { team: TeamSide; pos: Vec2 };

/** point를 장악하는 팀 — 가장 가까운 선수의 팀. 동률/무인접이면 null. margin=2등과의 거리차. */
export function controlAt(
  point: Vec2,
  players: ControlPlayer[]
): { team: TeamSide | null; margin: number } {
  let best = Infinity;
  let second = Infinity;
  let bestTeam: TeamSide | null = null;
  players.forEach((p) => {
    const d = Math.hypot(p.pos.x - point.x, p.pos.y - point.y);
    if (d < best) {
      second = best;
      best = d;
      bestTeam = p.team;
    } else if (d < second) {
      second = d;
    }
  });
  if (bestTeam === null) return { team: null, margin: 0 };
  return { team: bestTeam, margin: second - best };
}

/**
 * 패스 성공 가능성 lite 0..1 — from→to 직선 경로에 상대가 가까이 있을수록 낮다.
 * 경로 위 가장 가까운 상대까지의 수직거리로 근사.
 */
export function passProbability(
  from: Vec2,
  to: Vec2,
  opponents: Vec2[],
  laneWidth = 2.5
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let minPerp = Infinity;
  opponents.forEach((o) => {
    const rx = o.x - from.x;
    const ry = o.y - from.y;
    const t = Math.max(0, Math.min(len, rx * ux + ry * uy)); // 경로 위 투영
    const px = from.x + ux * t;
    const py = from.y + uy * t;
    const perp = Math.hypot(o.x - px, o.y - py);
    if (perp < minPerp) minPerp = perp;
  });
  if (!isFinite(minPerp)) return 1;
  // 레인 폭 안에 상대가 있으면 급감. 멀수록 1.
  const safety = Math.min(1, minPerp / laneWidth);
  // 거리 길수록 약간 감점.
  const lenPenalty = Math.max(0.4, 1 - len / 60);
  return Math.max(0, Math.min(1, safety * lenPenalty));
}
