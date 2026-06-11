import { describe, expect, it } from "vitest";
import type { BallState } from "@/lib/football/core/types";
import { FIFA_WORLD_CUP_2026, IFAB_2025_26 } from "@/lib/football/core/laws";
import { createInitialState } from "@/lib/football/core/game-state";
import {
  beginRestart,
  checkDelayedCountdown,
  kickoffRestart,
  markRestartReady,
  resolveOpenPlay,
  restartFromOffside,
  restartFromOut,
  restartTaken
} from "@/lib/football/rules/restarts";
import { ballOut } from "@/lib/football/rules/in-out";

const setBall = (x: number, y: number, height = 0): BallState => ({
  pos: { x, y },
  vel: { x: 0, y: 0 },
  height,
  vz: 0
});

describe("resolveOpenPlay", () => {
  it("인플레이/골/아웃 분기", () => {
    const s = createInitialState();
    expect(resolveOpenPlay({ ...s, ball: setBall(0, 0) }).type).toBe("inPlay");
    expect(resolveOpenPlay({ ...s, ball: setBall(52.7, 0), lastTouch: 0 }).type).toBe("goal");
    expect(resolveOpenPlay({ ...s, ball: setBall(10, 34.3), lastTouch: 0 }).type).toBe("out");
  });
});

describe("재개 상태 생성", () => {
  it("아웃 → 재개", () => {
    const out = ballOut(setBall(52.7, 10), 1); // 코너(공격팀0)
    if (!out.out) throw new Error("expected out");
    const r = restartFromOut(out);
    expect(r).toMatchObject({ kind: "cornerKick", team: 0, side: "right", ready: false });
  });
  it("오프사이드 → 수비팀 간접 FK", () => {
    const r = restartFromOffside(0, { x: 30, y: 5 });
    expect(r).toMatchObject({ kind: "offsideIndirectFreeKick", team: 1, causedByOffside: true });
    expect(r.location).toEqual({ x: 30, y: 5 });
  });
  it("킥오프 → 실점팀 센터", () => {
    expect(kickoffRestart(1)).toMatchObject({ kind: "kickoff", team: 1, location: { x: 0, y: 0 } });
  });
});

describe("재개 페이즈 전이", () => {
  it("beginRestart → restartSetup + 공이 재개 위치로", () => {
    const s = createInitialState(FIFA_WORLD_CUP_2026);
    const r = restartFromOffside(0, { x: 30, y: 5 });
    const s2 = beginRestart(s, r, 100);
    expect(s2.phase).toBe("restartSetup");
    expect(s2.ball.pos).toEqual({ x: 30, y: 5 });
    expect(s2.ball.vel).toEqual({ x: 0, y: 0 });
  });
  it("스로인은 월드컵2026서 5초 카운트다운, 일반 프로필은 없음", () => {
    const r = { kind: "throwIn" as const, team: 0 as const, location: { x: 0, y: 34 }, ready: false };
    const wc = beginRestart(createInitialState(FIFA_WORLD_CUP_2026), r, 10);
    expect(wc.restart?.countdownDeadline).toBe(15);
    const std = beginRestart(createInitialState(IFAB_2025_26), r, 10);
    expect(std.restart?.countdownDeadline).toBeNull();
  });
  it("ready → taken: openPlay + lastTouch=재개팀", () => {
    const s = beginRestart(createInitialState(), kickoffRestart(1), 0);
    const ready = markRestartReady(s);
    expect(ready.phase).toBe("restartReady");
    const taken = restartTaken(ready);
    expect(taken.phase).toBe("openPlay");
    expect(taken.lastTouch).toBe(1);
    expect(taken.restart).toBeNull();
  });
});

describe("지연 카운트다운 만료(월드컵2026)", () => {
  it("스로인 미실행 → 상대 스로인", () => {
    const r = { kind: "throwIn" as const, team: 0 as const, location: { x: 0, y: 34 }, ready: false };
    let s = beginRestart(createInitialState(FIFA_WORLD_CUP_2026), r, 10); // deadline 15
    s = checkDelayedCountdown(s, 16); // 만료
    expect(s.restart?.kind).toBe("throwIn");
    expect(s.restart?.team).toBe(1); // 상대로 넘어감
  });
  it("골킥 미실행 → 상대 코너킥", () => {
    const r = {
      kind: "goalKick" as const,
      team: 0 as const,
      location: { x: -50, y: 0 },
      side: "left" as const,
      ready: false
    };
    let s = beginRestart(createInitialState(FIFA_WORLD_CUP_2026), r, 10); // deadline 15
    s = checkDelayedCountdown(s, 16);
    expect(s.restart?.kind).toBe("cornerKick");
    expect(s.restart?.team).toBe(1);
  });
  it("마감 전이면 그대로", () => {
    const r = { kind: "throwIn" as const, team: 0 as const, location: { x: 0, y: 34 }, ready: false };
    let s = beginRestart(createInitialState(FIFA_WORLD_CUP_2026), r, 10);
    s = checkDelayedCountdown(s, 14);
    expect(s.restart?.team).toBe(0);
  });
});
