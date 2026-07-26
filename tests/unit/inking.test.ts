import { describe, expect, it } from "vitest";

import {
  isPenContact,
  mapPenPressure,
  PALM_GUARD_MS,
  PEN_PRESSURE_FLOOR,
  PEN_PRESSURE_GAMMA,
  PRESSURE_SMOOTHING_TAU_MS,
  shouldIgnoreTouchAfterPen,
  smoothPressure
} from "@/lib/broadcast/inking";

describe("palm rejection", () => {
  it("does not reject initial touch without prior pen contact", () => {
    expect(shouldIgnoreTouchAfterPen("touch", 100, null)).toBe(false);
  });

  it("rejects touch inside guard window, excluding exact boundary", () => {
    expect(shouldIgnoreTouchAfterPen("touch", 1999, 1000)).toBe(true);
    expect(shouldIgnoreTouchAfterPen("touch", 2000, 1000)).toBe(false);
    expect(PALM_GUARD_MS).toBe(1000);
  });

  it("does not reject mouse or timestamps before pen contact", () => {
    expect(shouldIgnoreTouchAfterPen("mouse", 1500, 1000)).toBe(false);
    expect(shouldIgnoreTouchAfterPen("touch", 999, 1000)).toBe(false);
    expect(shouldIgnoreTouchAfterPen("touch", 1000, -1)).toBe(false);
  });
});

describe("pen contact", () => {
  it("distinguishes hover from pressure or primary-button contact", () => {
    expect(isPenContact("pen", 0, 0)).toBe(false);
    expect(isPenContact("pen", 0.25, 0)).toBe(true);
    expect(isPenContact("pen", 0, 1)).toBe(true);
    expect(isPenContact("pen", 0, 2)).toBe(false);
    expect(isPenContact("mouse", 0.5, 1)).toBe(false);
  });
});

describe("pen pressure", () => {
  it("clamps input, applies gamma, and preserves visible floor", () => {
    expect(mapPenPressure(-1)).toBe(PEN_PRESSURE_FLOOR);
    expect(mapPenPressure(0)).toBe(PEN_PRESSURE_FLOOR);
    expect(mapPenPressure(0.25)).toBeCloseTo(0.25 ** PEN_PRESSURE_GAMMA);
    expect(mapPenPressure(1)).toBe(1);
    expect(mapPenPressure(2)).toBe(1);
    expect(mapPenPressure(Number.NaN)).toBe(PEN_PRESSURE_FLOOR);
  });

  it("smooths by elapsed time, independent of sample rate", () => {
    const evolve = (stepMs: number, samples: number) => {
      let value = 0.2;
      for (let i = 0; i < samples; i += 1) {
        value = smoothPressure(value, 0.9, stepMs);
      }
      return value;
    };

    const at60Hz = evolve(1000 / 60, 6);
    const at240Hz = evolve(1000 / 240, 24);
    expect(at60Hz).toBeCloseTo(at240Hz, 12);
    expect(PRESSURE_SMOOTHING_TAU_MS).toBe(12);
  });

  it("keeps invalid and out-of-range filter inputs finite and clamped", () => {
    expect(smoothPressure(Number.NaN, 0.7, 8)).toBeGreaterThanOrEqual(0);
    expect(smoothPressure(2, -1, 12)).toBeGreaterThanOrEqual(0);
    expect(smoothPressure(2, -1, 12)).toBeLessThanOrEqual(1);
    expect(smoothPressure(0.4, 0.9, Number.NaN)).toBe(0.4);
    expect(smoothPressure(0.4, 0.9, 12, 0)).toBeGreaterThan(0.4);
  });
});
