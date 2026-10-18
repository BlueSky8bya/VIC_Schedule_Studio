import { describe, expect, it } from "vitest";
import { COMPANION_CLIP_TIMING, COMPANION_PLAY_TIMING, COMPANION_TIMING } from "@/lib/ui/viewer-companion/timing";
import { createCompanionMotion } from "@/lib/ui/viewer-companion/motion";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

describe("reviewed companion motion catalogue", () => {
  it("covers every logical row exactly once and keeps ballistic/distance clocks renderer-owned", () => {
    expect(companionSpriteMetadata.rows).toHaveLength(41);
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
  it("preserves every existing logical clip and its original clock before appending living gestures", () => {
    expect(COMPANION_CLIP_TIMING.slice(0, 33).map(clip => [clip.name, clip.playback, clip.duration, clip.frameRate ?? null])).toEqual([
      ["idle", "loop", 2000, 8],
      ["look", "phase", 750, null],
      ["walk", "distance", null, 14],
      ["crouch", "phase", 120, null],
      ["rise", "phase", null, null],
      ["fall", "phase", null, null],
      ["land", "phase", 180, null],
      ["legacy-unused", "unused", null, null],
      ["held", "loop", 1333, 12],
      ["happy", "loop", 2000, 8],
      ["yawn", "hold", 700, null],
      ["sleep", "hold", null, 6],
      ["wake", "phase", 650, null],
      ["heart", "phase", 1300, null],
      ["hide", "phase", 700, null],
      ["emerge", "hold", 700, null],
      ["stretch", "phase", 1000, null],
      ["shake", "phase", 550, null],
      ["disappointed", "phase", 1400, null],
      ["sulky", "phase", 1600, null],
      ["sprint", "distance", null, 14],
      ["tumble", "phase", 310, null],
      ["dizzy", "phase", 300, null],
      ["recover", "phase", 280, null],
      ["slip", "phase", 220, null],
      ["bump", "phase", 100, null],
      ["glance", "phase", 440, null],
      ["tears", "phase", 900, null],
      ["sulk", "phase", 1030, null],
      ["bow", "phase", 1060, null],
      ["groom", "phase", 520, null],
      ["pounce", "phase", 820, null],
      ["throw", "phase", null, null],
    ]);
    expect(COMPANION_CLIP_TIMING.slice(33)).toEqual([
      { row: 33, name: "ask-petting", playback: "phase", duration: 1500 },
      { row: 34, name: "lean-nuzzle", playback: "phase", duration: 1400 },
      { row: 35, name: "paper-knead", playback: "phase", duration: 500 },
      { row: 36, name: "paper-nest", playback: "phase", duration: 850 },
      { row: 37, name: "cheer-tangled", playback: "phase", duration: 850 },
      { row: 38, name: "cheer-peek", playback: "phase", duration: 650 },
      { row: 39, name: "cheer-tidy", playback: "phase", duration: 950 },
      { row: 40, name: "doze-curl", playback: "hold", duration: null, frameRate: 6 },
    ]);
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
  it("advances the quiet doze drawing at6Hz on the shared motion clock and freezes reduced motion", () => {
    const motion = createCompanionMotion({ rowCount: 41, loopRows: [40], clips: { 40: [0, 2, 4, 6, 8, 10, 12, 15] } });
    const sample = (now: number, reduced = false) => motion.sample({ row: 40, phase: 0, status: "sleep", x: 100, y: 400, now, reduced });
    expect(sample(0).column).toBe(0);
    expect(sample(166.6).column).toBe(0);
    expect(sample(166.667).column).toBe(2);
    expect(sample(333.334).column).toBe(4);
    expect(sample(1166.667).column).toBe(15);
    expect(sample(1333.334).column).toBe(0);
    expect(sample(4000, true)).toMatchObject({ row: 40, column: 0, bob: 0, tilt: 0, scaleX: 1, scaleY: 1 });
  });
});
