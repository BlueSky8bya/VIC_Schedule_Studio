// Law 11 오프사이드 — 핵심은 '위치'와 '반칙(관여)'의 분리.
//  1) 공을 같은 팀이 '플레이/터치한 순간' 스냅샷을 찍는다.
//  2) 공격수가 (상대 진영 && 공보다 앞 && 두 번째 최후방 상대보다 앞)이면 '오프사이드 위치'.
//     - 같은 선(level)은 온사이드. 위치 자체는 반칙이 아니다.
//  3) 그 위치였던 선수가 '관여'(공 플레이/터치, 상대 방해, 리바운드 이득)하면 그때 반칙.
//  4) 골킥·스로인·코너킥에서 직접 받으면 오프사이드 없음.
//
// 참고: IFAB Law 11 Offside. https://www.theifab.com/laws/latest/offside/

import type { RestartKind, TeamSide, Vec2 } from "@/lib/football/core/types";
import { HALF_L } from "@/lib/football/core/pitch";

/** 공격 방향(+1 = +x로, -1 = -x로). 팀0은 오른쪽(+), 팀1은 왼쪽(-) 골을 공격. */
export function attackDir(team: TeamSide): 1 | -1 {
  return team === 0 ? 1 : -1;
}

/**
 * 오프사이드 라인 x — 두 번째 최후방 상대(보통 키퍼가 최후방이므로 사실상 최후방 필드 수비수)의 x.
 * defenders는 수비팀(상대) 전원 좌표(키퍼 포함). 수비수가 2명 미만이면 골라인.
 */
export function offsideLineX(defenders: Vec2[], attackingTeam: TeamSide): number {
  const dir = attackDir(attackingTeam);
  if (defenders.length < 2) return dir === 1 ? HALF_L : -HALF_L;
  // 골라인 쪽(가장 앞)부터 정렬 → [최후방, 두번째 최후방, ...]
  const xs = defenders.map((d) => d.x).sort((a, b) => dir * b - dir * a);
  return xs[1];
}

/**
 * 오프사이드 위치인가. (상대 진영 && 공보다 골라인에 가까움 && 두번째 최후방보다 가까움)
 * level(같은 선)은 온사이드 → 엄격 부등호.
 */
export function inOffsidePosition(
  pos: Vec2,
  ballPos: Vec2,
  defenders: Vec2[],
  attackingTeam: TeamSide
): boolean {
  const dir = attackDir(attackingTeam);
  if (dir * pos.x <= 0) return false; // 자기 진영(또는 하프라인)
  const line = offsideLineX(defenders, attackingTeam);
  return dir * pos.x > dir * ballPos.x && dir * pos.x > dir * line;
}

export type OffsideAttacker = { id: number; pos: Vec2 };

export type OffsideSnapshot = {
  attackingTeam: TeamSide;
  ballPos: Vec2;
  lineX: number;
  /** 스냅샷 시점 오프사이드 '위치'였던 공격수 id들. */
  offsidePlayerIds: number[];
};

/** 공을 플레이/터치한 순간의 스냅샷(위치 판정만; 반칙은 아직 아님). */
export function takeOffsideSnapshot(
  attackingTeam: TeamSide,
  ballPos: Vec2,
  attackers: OffsideAttacker[],
  defenders: Vec2[]
): OffsideSnapshot {
  const lineX = offsideLineX(defenders, attackingTeam);
  const offsidePlayerIds = attackers
    .filter((a) => inOffsidePosition(a.pos, ballPos, defenders, attackingTeam))
    .map((a) => a.id);
  return { attackingTeam, ballPos, lineX, offsidePlayerIds };
}

/**
 * 관여 반칙 판정 — 스냅샷서 오프사이드 위치였던 선수가 공을 받으면(관여) 반칙.
 * 단 골킥·스로인·코너킥에서 직접 받으면 오프사이드 아님.
 */
export function offsideOffence(
  snap: OffsideSnapshot,
  receiverId: number,
  fromRestart?: RestartKind
): boolean {
  if (fromRestart === "goalKick" || fromRestart === "throwIn" || fromRestart === "cornerKick") {
    return false;
  }
  return snap.offsidePlayerIds.includes(receiverId);
}
