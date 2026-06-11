// 팀 형태 지표 — compactness(밀집도)·field-tilt(영역 우세)·라인높이/폭. shape reward와
// tacticFidelity(shapeScore)에 쓴다(보고서 5.5.1). 모두 순수 함수, 미터 좌표.

import { HALF_L, HALF_W } from "@/lib/football/core/pitch";
import type { TeamSide, Vec2 } from "@/lib/football/core/types";

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

export type TeamShape = {
  centroid: Vec2;
  lengthSpread: number; // x 분산(길이축) — 작을수록 컴팩트
  widthSpread: number; // y 분산(폭축)
  bboxArea: number; // 외곽 박스 넓이 — 작을수록 밀집
};

/** 한 팀(필드 선수 위치)의 형태. 키퍼는 빼고 넣는 것을 권장. */
export function teamShape(positions: Vec2[]): TeamShape {
  const xs = positions.map((p) => p.x);
  const ys = positions.map((p) => p.y);
  const w = (Math.max(...xs) - Math.min(...xs)) || 0;
  const h = (Math.max(...ys) - Math.min(...ys)) || 0;
  return {
    centroid: { x: mean(xs), y: mean(ys) },
    lengthSpread: stddev(xs),
    widthSpread: stddev(ys),
    bboxArea: w * h
  };
}

/** 라인 높이 0..1 — team 공격 방향 기준 팀 무게중심의 전진도. */
export function lineHeight(positions: Vec2[], team: TeamSide): number {
  const cx = mean(positions.map((p) => p.x));
  const adj = team === 0 ? cx : -cx; // 공격 방향 +x로
  return Math.max(0, Math.min(1, (adj + HALF_L) / (2 * HALF_L)));
}

/** 폭 사용 0..1 — 선수 y 분포 폭 / 경기장 폭. */
export function widthUse(positions: Vec2[]): number {
  const ys = positions.map((p) => p.y);
  const spread = (Math.max(...ys) - Math.min(...ys)) || 0;
  return Math.max(0, Math.min(1, spread / (2 * HALF_W)));
}

/**
 * Field tilt — 공격 서드 점유 우세. team0/team1 선수 위치로 각 팀의 '상대 진영 서드' 인원 비율.
 * 반환: team0의 우세 점유율 0..1 (0.5 = 균형).
 */
export function fieldTilt(team0: Vec2[], team1: Vec2[]): number {
  const third = HALF_L / 3;
  const t0Att = team0.filter((p) => p.x > HALF_L - 2 * third).length; // team0은 +x 공격 → 오른쪽 서드
  const t1Att = team1.filter((p) => p.x < -(HALF_L - 2 * third)).length; // team1은 -x 공격 → 왼쪽 서드
  const sum = t0Att + t1Att;
  return sum === 0 ? 0.5 : t0Att / sum;
}
