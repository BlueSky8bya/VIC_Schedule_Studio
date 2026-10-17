import { describe, expect, it } from "vitest";
import { COMPANION_CLIP_TIMING, COMPANION_PLAY_TIMING, COMPANION_TIMING } from "@/lib/ui/viewer-companion/timing";
import { createCompanionMotion } from "@/lib/ui/viewer-companion/motion";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

describe("reviewed companion motion catalogue", () => {
  it("covers every logical row exactly once and keeps ballistic/distance clocks renderer-owned", () => {
    expect(companionSpriteMetadata.rows).toHaveLength(33);
    expect(COMPANION_CLIP_TIMING.map(clip => clip.row)).toEqual(Array.from({ length: companionSpriteMetadata.rows.length }, (_, index) => index));
    expect(new Set(COMPANION_CLIP_TIMING.map(clip => clip.name)).size).toBe(companionSpriteMetadata.rows.length);
    for (const row of [2, 4, 5, 20]) expect(COMPANION_CLIP_TIMING[row].duration).toBeNull();
    expect(COMPANION_CLIP_TIMING[7].playback).toBe("unused");
    expect(COMPANION_CLIP_TIMING[32]).toMatchObject({ row: 32, name: "throw", playback: "phase", duration: null });
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
  it.each([
    { kind: "dizzy" as const, duration: 1320, rows: [22, 23], ends: [520, 1320] },
    { kind: "tumble" as const, duration: 2160, rows: [21, 22, 26, 23], ends: [620, 920, 1360, 2160] },
    { kind: "slip-tumble" as const, duration: 2220, rows: [24, 21, 22, 26, 23], ends: [180, 800, 1100, 1420, 2220] },
  ])("keeps $kind causal beats finite and reserves800ms for complete recovery", ({ kind, duration, rows, ends }) => {
    const clip = COMPANION_PLAY_TIMING[kind];
    expect(clip.duration).toBe(duration);
    expect(clip.duration).toBeLessThan(2300);
    expect(clip.beats.map(beat => beat.row)).toEqual(rows);
    let elapsed = 0;
    expect(clip.beats.map(beat => elapsed += beat.duration)).toEqual(ends);
    expect(clip.beats.at(-1)).toEqual({ row: 23, duration: 800, beat: "recover" });
    if (kind !== "dizzy") expect(clip.beats.find(beat => beat.row === 21)).toEqual({ row: 21, duration: 620, beat: "impact", cycles: 2 });
    for (const beat of clip.beats) {
      expect(Number.isFinite(beat.duration)).toBe(true);
      expect(beat.duration).toBeGreaterThan(0);
    }
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
