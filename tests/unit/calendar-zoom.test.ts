import { describe, expect, it } from "vitest";

import {
  CAL_ZOOM_STEPS,
  createWheelStepper,
  normalizeWheelDelta,
  stepCalZoom
} from "@/lib/ui/calendar-zoom";

describe("stepCalZoom", () => {
  it("단계를 순서대로 오르내린다", () => {
    expect(stepCalZoom(1, 1)).toBe(1.25);
    expect(stepCalZoom(1.25, 1)).toBe(1.5);
    expect(stepCalZoom(1.25, -1)).toBe(1);
  });

  it("경계에서 멈춘다(넘어가지 않음)", () => {
    expect(stepCalZoom(1.5, 1)).toBe(1.5);
    expect(stepCalZoom(1, -1)).toBe(1);
  });

  it("목록에 없는 값은 가장 가까운 단계 기준으로 움직인다", () => {
    expect(stepCalZoom(1.3, 1)).toBe(1.5);
    expect(stepCalZoom(0.7, 1)).toBe(1.25);
  });

  it("단계 목록은 100/125/150", () => {
    expect(CAL_ZOOM_STEPS).toEqual([1, 1.25, 1.5]);
  });
});

describe("normalizeWheelDelta", () => {
  it("pixel 모드는 그대로", () => {
    expect(normalizeWheelDelta(-53, 0)).toBe(-53);
  });
  it("line 모드는 16px/줄", () => {
    expect(normalizeWheelDelta(-3, 1)).toBe(-48);
  });
  it("page 모드는 보수적 400px", () => {
    expect(normalizeWheelDelta(1, 2)).toBe(400);
  });
});

describe("createWheelStepper", () => {
  it("기본 임계값: '휠 한 칸'이 어떤 입력이든 1단계 — Chrome(≈100px)·Firefox(3줄=48px)·일부 마우스(≈53px)", () => {
    for (const oneNotch of [-100, -48, -53]) {
      const s = createWheelStepper(); // 기본 옵션
      expect(s.feed(oneNotch, 0)).toBe(1);
    }
  });

  it("임계값 미만 누적은 단계 이동 없음", () => {
    const s = createWheelStepper({ threshold: 90, cooldownMs: 220 });
    expect(s.feed(-40, 0)).toBe(0);
    expect(s.feed(-40, 10)).toBe(0);
  });

  it("같은 방향 누적이 임계값을 넘으면 1단계(휠 위=확대)", () => {
    const s = createWheelStepper({ threshold: 90, cooldownMs: 220 });
    expect(s.feed(-40, 0)).toBe(0);
    expect(s.feed(-60, 10)).toBe(1);
  });

  it("cooldown 동안 트랙패드 관성 꼬리를 버린다 — 한 제스처 = 한 단계", () => {
    const s = createWheelStepper({ threshold: 90, cooldownMs: 220 });
    // 트랙패드 제스처: 큰 델타 여러 개 연속
    expect(s.feed(-120, 0)).toBe(1);
    expect(s.feed(-120, 16)).toBe(0);
    expect(s.feed(-120, 100)).toBe(0);
    expect(s.feed(-120, 219)).toBe(0);
    // cooldown 지난 뒤에는 다시 누적 가능
    expect(s.feed(-120, 230)).toBe(1);
  });

  it("방향이 뒤집히면 누적을 버린다(왕복 손떨림 상쇄 방지)", () => {
    const s = createWheelStepper({ threshold: 90, cooldownMs: 220 });
    expect(s.feed(-80, 0)).toBe(0);
    expect(s.feed(50, 10)).toBe(0); // 방향 반전 → 이전 -80 폐기, +50부터
    expect(s.feed(45, 20)).toBe(-1); // +95 → 축소
  });

  it("입력이 idleGapMs 이상 끊기면 이전 누적을 버린다(오래된 휠 찌꺼기 합산 방지)", () => {
    const s = createWheelStepper({ threshold: 90, cooldownMs: 220, idleGapMs: 300 });
    expect(s.feed(-80, 0)).toBe(0);
    // 500ms 공백 — 이전 -80 폐기, 새 -50만으론 임계값 미달
    expect(s.feed(-50, 500)).toBe(0);
    // 바로 이어서 -50 → 합계 -100 ≥ 90 → 확대
    expect(s.feed(-50, 520)).toBe(1);
  });

  it("reset은 누적과 cooldown을 모두 비운다", () => {
    const s = createWheelStepper({ threshold: 90, cooldownMs: 1000 });
    expect(s.feed(-120, 0)).toBe(1);
    s.reset();
    expect(s.feed(-120, 10)).toBe(1); // cooldown 무시하고 즉시 새 누적
  });
});
