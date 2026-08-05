import { describe, expect, it } from "vitest";
import {
  FOLLOW_DAMP,
  FOLLOW_STIFF,
  springStep,
  SWAY_MAX,
  swayOffset
} from "@/lib/studio/drag-physics";

// 2026-08-06 사용자 결정: 드래그에서 **회전은 없앤다**. 대신 손을 스프링으로 부드럽게 뒤따르고,
// 아주 작은 흔들림으로만 살아있게 하고, 놓으면 목적지로 '뿅' 들어간다(iOS 드래그앤드롭 문법).

/** 스프링을 n프레임 굴린다. */
function run(target: number, frames: number, dt = 1 / 60) {
  let pos = 0;
  let vel = 0;
  let overshoot = 0;
  for (let i = 0; i < frames; i += 1) {
    const s = springStep(pos, vel, target, FOLLOW_STIFF, FOLLOW_DAMP, dt);
    pos = s.pos;
    vel = s.vel;
    if (target > 0) overshoot = Math.max(overshoot, pos - target);
  }
  return { pos, vel, overshoot };
}

describe("springStep — 손을 뒤따르는 감각", () => {
  it("목표에 수렴한다", () => {
    const { pos } = run(100, 60);
    expect(pos).toBeCloseTo(100, 0);
  });

  it("찰랑이지 않는다(오버슈트가 거의 없다 — 임계감쇠에 가깝게)", () => {
    expect(run(100, 60).overshoot).toBeLessThan(1.5);
  });

  it("즉시 붙지 않는다 — 살짝 늦게 따라오는 무게감", () => {
    const { pos } = run(100, 3); // 세 프레임 뒤에도 아직 도착 전
    expect(pos).toBeGreaterThan(0);
    expect(pos).toBeLessThan(90);
  });

  it("이미 목표면 움직이지 않는다", () => {
    const s = springStep(50, 0, 50, FOLLOW_STIFF, FOLLOW_DAMP, 1 / 60);
    expect(s.pos).toBe(50);
    expect(s.vel).toBe(0);
  });

  it("프레임이 크게 끊겨도 발산하지 않는다(dt 상한)", () => {
    let pos = 0;
    let vel = 0;
    for (let i = 0; i < 30; i += 1) {
      const s = springStep(pos, vel, 100, FOLLOW_STIFF, FOLLOW_DAMP, 0.5); // 500ms 끊김
      pos = s.pos;
      vel = s.vel;
    }
    expect(Number.isFinite(pos)).toBe(true);
    expect(Math.abs(pos)).toBeLessThan(400);
  });
});

describe("swayOffset — 회전 대신 아주 작은 흔들림", () => {
  it("멈춰 있으면 흔들리지 않는다", () => {
    expect(swayOffset(1234, 0)).toEqual({ x: 0, y: 0 });
  });

  it("빠르게 움직여도 진폭이 작다(멋 부리다 읽기 힘들어지지 않게)", () => {
    for (let t = 0; t < 4000; t += 37) {
      const s = swayOffset(t, 5);
      expect(Math.abs(s.x)).toBeLessThanOrEqual(SWAY_MAX);
      expect(Math.abs(s.y)).toBeLessThanOrEqual(SWAY_MAX);
    }
  });

  it("느리게 움직이면 더 작게 흔들린다", () => {
    const slow = Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(swayOffset(i * 17, 0.2).x)));
    const fast = Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(swayOffset(i * 17, 2).x)));
    expect(slow).toBeLessThan(fast);
  });

  it("난수가 아니다 — 같은 시각이면 같은 값(프레임마다 튀지 않는다)", () => {
    expect(swayOffset(777, 1)).toEqual(swayOffset(777, 1));
  });
});
