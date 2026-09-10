import { describe, expect, it } from "vitest";
import { createDepthBudget, createDepthPointer, depthOffsets } from "@/components/shared/ambient/world/depth";

const edge = { x: 1400, y: 860, inside: true };

describe("ambient pointer depth", () => {
  it("reaches the same pose whether one second is advanced whole or in quarters", () => {
    const whole = createDepthPointer();
    const divided = createDepthPointer();
    whole.aim(0, edge, 1400, 860);
    divided.aim(0, edge, 1400, 860);
    for (const t of [0.25, 0.5, 0.75, 1]) {
      divided.value(t);
      divided.aim(t, edge, 1400, 860);
    }
    expect(divided.value(1)).toEqual(whole.value(1));
    expect(depthOffsets(divided.value(1), 1400, 1.5, "full"))
      .toEqual(depthOffsets(whole.value(1), 1400, 1.5, "full"));
    expect(whole.value(1).x).toBeGreaterThan(0.99);
  });

  it("stays centered without a pointer and returns continuously when the pointer leaves", () => {
    const pointer = createDepthPointer();
    pointer.aim(0, { ...edge, inside: false }, 1400, 860);
    expect(pointer.value(30)).toEqual({ x: 0, y: 0 });
    pointer.aim(30, edge, 1400, 860);
    const beforeLeave = pointer.value(30.2);
    pointer.aim(30.2, { ...edge, inside: false }, 1400, 860);
    expect(pointer.value(30.2)).toEqual(beforeLeave);
    expect(pointer.value(30.3).x).toBeLessThan(beforeLeave.x);
    expect(pointer.value(32)).toEqual({ x: 0, y: 0 });
  });

  it("reverses continuously and bounds out-of-canvas input without overshoot", () => {
    const pointer = createDepthPointer();
    pointer.aim(0, { x: 99999, y: 99999, inside: true }, 1400, 860);
    const beforeReverse = pointer.value(0.2);
    pointer.aim(0.2, { x: -99999, y: -99999, inside: true }, 1400, 860);
    expect(pointer.value(0.2)).toEqual(beforeReverse);
    for (const t of [0.2, 0.25, 0.5, 1, 10]) {
      for (const coordinate of Object.values(pointer.value(t))) {
        expect(coordinate).toBeGreaterThanOrEqual(-1);
        expect(coordinate).toBeLessThanOrEqual(1);
      }
    }
    expect(pointer.value(10)).toEqual({ x: -1, y: -1 });
  });

  it("clears the pose immediately for reduced motion, without a settling tail", () => {
    const pointer = createDepthPointer();
    pointer.aim(0, edge, 1400, 860);
    expect(pointer.value(0.2).x).toBeGreaterThan(0);
    pointer.reset(0.2);
    expect(pointer.value(0.2)).toEqual({ x: 0, y: 0 });
    expect(pointer.value(10)).toEqual({ x: 0, y: 0 });
  });

  it("keeps the far horizon level, limits motion, and moves opposite the pointer", () => {
    for (const width of [700, 1400, 2560]) {
      for (const dpr of [1, 1.5, 2]) {
        const full = depthOffsets({ x: 1, y: -1 }, width, dpr, "full");
        const lite = depthOffsets({ x: 1, y: -1 }, width, dpr, "lite");
        const still = depthOffsets({ x: 1, y: -1 }, width, dpr, "still");
        expect(Math.abs(full.far.y)).toBe(0);
        expect(Math.abs(lite.far.y)).toBe(0);
        expect(Math.abs(full.far.x)).toBeLessThanOrEqual(3 + 0.5 / dpr);
        expect(Math.abs(full.ground.x)).toBeLessThanOrEqual(8);
        expect(Math.abs(full.frame.x)).toBeLessThanOrEqual(16);
        expect(Math.abs(full.frame.y)).toBeLessThanOrEqual(4);
        expect(lite.frame).toEqual(lite.ground);
        for (const layer of ["far", "ground", "frame"] as const) {
          expect(full[layer].x).toBeLessThanOrEqual(0);
          expect(full[layer].y).toBeGreaterThanOrEqual(0);
          expect(Math.abs(lite[layer].x)).toBeLessThanOrEqual(Math.abs(full[layer].x));
          expect(Math.abs(still[layer].x) + Math.abs(still[layer].y)).toBe(0);
        }
      }
    }
    const faded = depthOffsets({ x: 1, y: 1 }, 1400, 1, "full", 0);
    expect(Object.values(faded).every(({ x, y }) => x === 0 && y === 0)).toBe(true);
  });
});

describe("ambient temporary depth budget", () => {
  it("requires ten stable seconds even on a 144 Hz display", () => {
    const budget = createDepthBudget();
    budget.reset("lite");
    for (let i = 0; i < 15; i++) budget.sample(1000 / 144, 0, .9, "auto");
    expect(budget.tier).toBe("lite");
    budget.sample(1000 / 144, 0, .9, "auto");
    expect(budget.tier).toBe("full");
  });
  it("ignores an isolated slow sample and degrades sustained overload one tier at a time", () => {
    const budget = createDepthBudget();
    expect(budget.sample(30, 0.3, 0.1, "auto")).toBe("full");
    expect(budget.sample(16.7, 0, 0.9, "auto")).toBe("full");
    expect(budget.sample(30, 0.3, 0.1, "auto")).toBe("full");
    expect(budget.sample(30, 0.3, 0.1, "auto")).toBe("lite");
    expect(budget.sample(30, 0.3, 0.1, "auto")).toBe("lite");
    expect(budget.sample(30, 0.3, 0.1, "auto")).toBe("still");
  });

  it("recovers gradually after sustained headroom instead of oscillating on a good frame", () => {
    const budget = createDepthBudget();
    budget.reset("still");
    expect(budget.sample(16.7, 0, 0.9, "auto")).toBe("still");
    for (let i = 0; i < 6; i++) budget.sample(16.7, 0, 0.9, "auto");
    expect(budget.tier).toBe("lite");
    expect(budget.sample(16.7, 0, 0.9, "auto")).toBe("lite");
    for (let i = 0; i < 6; i++) budget.sample(16.7, 0, 0.9, "auto");
    expect(budget.tier).toBe("full");
  });

  it("honors always-max under overload and never promotes lightly above lite", () => {
    const budget = createDepthBudget();
    budget.reset("still");
    for (let i = 0; i < 20; i++) expect(budget.sample(50, 1, 0, "max")).toBe("full");
    expect(budget.sample(16.7, 0, 1, "lite")).toBe("lite");
    for (let i = 0; i < 20; i++) expect(budget.sample(16.7, 0, 1, "lite")).toBe("lite");
    for (let i = 0; i < 2; i++) budget.sample(50, 1, 1, "lite");
    expect(budget.tier).toBe("still");
    for (let i = 0; i < 7; i++) budget.sample(16.7, 0, 1, "lite");
    expect(budget.tier).toBe("lite");
    expect(budget.sample(16.7, 0, 1, "off")).toBe("still");
  });
});
