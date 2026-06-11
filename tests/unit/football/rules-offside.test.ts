import { describe, expect, it } from "vitest";
import type { Vec2 } from "@/lib/football/core/types";
import {
  inOffsidePosition,
  offsideLineX,
  offsideOffence,
  takeOffsideSnapshot
} from "@/lib/football/rules/offside";

const p = (x: number, y: number): Vec2 => ({ x, y });

// 팀0 공격 = +x 방향(오른쪽 골). 수비팀 좌표는 +x쪽이 골라인.
describe("offsideLineX — 두 번째 최후방", () => {
  it("팀0(+x): 키퍼 최후방, 두번째 최후방이 라인", () => {
    const defs = [p(50, 0), p(40, 5), p(38, -5), p(20, 0)]; // 키퍼 50, 최후방 수비 40
    expect(offsideLineX(defs, 0)).toBe(40);
  });
  it("팀1(-x): 대칭", () => {
    const defs = [p(-50, 0), p(-40, 5), p(-38, -5)];
    expect(offsideLineX(defs, 1)).toBe(-40);
  });
  it("수비 1명 이하면 골라인", () => {
    expect(offsideLineX([p(50, 0)], 0)).toBe(52.5);
    expect(offsideLineX([], 1)).toBe(-52.5);
  });
});

describe("inOffsidePosition — 위치 판정(level=온사이드)", () => {
  const defs = [p(50, 0), p(40, 0)]; // 라인 40
  it("공보다 앞 + 라인보다 앞 + 상대 진영 = 오프사이드 위치", () => {
    expect(inOffsidePosition(p(45, 0), p(30, 0), defs, 0)).toBe(true);
  });
  it("라인과 같은 선 = 온사이드", () => {
    expect(inOffsidePosition(p(40, 0), p(30, 0), defs, 0)).toBe(false);
  });
  it("공보다 뒤면 아님", () => {
    expect(inOffsidePosition(p(45, 0), p(48, 0), defs, 0)).toBe(false);
  });
  it("자기 진영이면 아님", () => {
    expect(inOffsidePosition(p(-5, 0), p(-10, 0), defs, 0)).toBe(false);
  });
  it("라인보다 뒤(수비수보다 뒤)면 아님", () => {
    expect(inOffsidePosition(p(38, 0), p(30, 0), defs, 0)).toBe(false);
  });
});

describe("스냅샷 + 관여 반칙", () => {
  const defs = [p(50, 0), p(40, 0)];
  const attackers = [
    { id: 1, pos: p(45, 0) }, // 오프사이드 위치
    { id: 2, pos: p(35, 0) }, // 온사이드
    { id: 3, pos: p(48, 5) } // 오프사이드 위치
  ];
  const snap = takeOffsideSnapshot(0, p(30, 0), attackers, defs);

  it("스냅샷은 오프사이드 '위치' 선수만 담는다", () => {
    expect(snap.offsidePlayerIds.sort()).toEqual([1, 3]);
    expect(snap.lineX).toBe(40);
  });
  it("오프사이드 위치 선수가 받으면 반칙", () => {
    expect(offsideOffence(snap, 1)).toBe(true);
  });
  it("온사이드 선수가 받으면 반칙 아님(위치만으론 반칙 아님)", () => {
    expect(offsideOffence(snap, 2)).toBe(false);
  });
  it("골킥/스로인/코너 직접 수령은 오프사이드 없음", () => {
    expect(offsideOffence(snap, 1, "goalKick")).toBe(false);
    expect(offsideOffence(snap, 1, "throwIn")).toBe(false);
    expect(offsideOffence(snap, 1, "cornerKick")).toBe(false);
    expect(offsideOffence(snap, 1, "directFreeKick")).toBe(true); // 프리킥은 예외 아님
  });
});
