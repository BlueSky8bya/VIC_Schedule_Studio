import { describe, expect, it } from "vitest";
import { COMPANION_CLIP_TIMING, COMPANION_PLAY_TIMING, COMPANION_TIMING } from "@/lib/ui/viewer-companion/timing";
import { createCompanionMotion } from "@/lib/ui/viewer-companion/motion";

describe("reviewed companion motion catalogue", () => {
  it("covers every logical row exactly once and keeps ballistic/distance clocks renderer-owned", () => {
    expect(COMPANION_CLIP_TIMING.map(clip => clip.row)).toEqual(Array.from({ length: 32 }, (_, index) => index));
    expect(new Set(COMPANION_CLIP_TIMING.map(clip => clip.name)).size).toBe(32);
    for (const row of [2, 4, 5, 20]) expect(COMPANION_CLIP_TIMING[row].duration).toBeNull();
    expect(COMPANION_CLIP_TIMING[7].playback).toBe("unused");
    for (const clip of COMPANION_CLIP_TIMING) {
      if (clip.duration !== null) expect(clip.duration).toBeGreaterThan(0);
      if (clip.frameRate) expect(clip.frameRate).toBeLessThanOrEqual(14);
    }
  });
  it("keeps impact short and sleep/wake finite without a global speed multiplier", () => {
    expect(COMPANION_PLAY_TIMING["bonk-tears"].beats[0].duration).toBeLessThanOrEqual(110);
    expect(COMPANION_TIMING.jumpAnticipation).toBeLessThan(COMPANION_TIMING.jumpLanding);
    expect(COMPANION_TIMING.sleepWake).toBeLessThan(COMPANION_TIMING.sleepYawn);
    expect(COMPANION_PLAY_TIMING.groom.duration).toBeGreaterThan(COMPANION_PLAY_TIMING.pounce.duration);
  });
  it("shows a250ms blink on the existing8Hz idle cadence and holds every reduced-motion frame", () => {
    const motion = createCompanionMotion({ loopRows: [0] });
    const sample = (now: number, reduced = false) => motion.sample({ row: 0, phase: 0, status: "idle", x: 100, y: 400, now, reduced });
    expect(sample(0).column).toBe(0);
    expect(sample(1125).column).toBe(9);
    expect(sample(1374).column).toBe(10);
    expect(sample(1375).column).toBe(11);
    expect(sample(1500, true)).toMatchObject({ column: 0, bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
  });
});
