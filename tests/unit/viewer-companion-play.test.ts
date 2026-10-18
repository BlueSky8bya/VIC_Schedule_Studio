import { describe, expect, it } from "vitest";
import { companionTapReaction, sampleCompanionCozySleep, sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import type { CompanionPlay } from "@/lib/ui/viewer-companion/brain";
import { companionPlayDuration, COMPANION_PLAY_TIMING, COMPANION_TIMING } from "@/lib/ui/viewer-companion/timing";

describe("finite authored companion play", () => {
  const kinds: CompanionPlay[] = ["tumble", "slip-tumble", "bump", "slip", "bonk-sad", "bonk-tears", "celebrate", "groom", "pounce", "bow", "dizzy"];
  const livingGestures = [
    { kind: "ask-petting", duration: 2150, rows: [33, 33], ends: [1500, 2150], finalRow: 33, finalBeat: "checking" },
    { kind: "lean-nuzzle", duration: 1950, rows: [34, 9], ends: [1400, 1950], finalRow: 9, finalBeat: "checking" },
    { kind: "cozy-nest", duration: 3200, rows: [35, 36, 40], ends: [1500, 2350, 3200], finalRow: 40, finalBeat: "checking" },
    { kind: "cheer-rehearsal", duration: 3800, rows: [9, 37, 38, 39, 9], ends: [750, 1600, 2250, 3200, 3800], finalRow: 9, finalBeat: "checking" },
    { kind: "doze-curl", duration: 2800, rows: [40], ends: [2800], finalRow: 40, finalBeat: "play" },
  ] as const;
  const allKinds = [...kinds, ...livingGestures.map(gesture => gesture.kind)];
  const shakeRecoveries: { kind: CompanionPlay; start: number; duration: number }[] = [
    { kind: "dizzy", start: 520, duration: 1320 },
    { kind: "tumble", start: 1360, duration: 2160 },
    { kind: "slip-tumble", start: 1420, duration: 2220 },
  ];
  const shakesHead = (kind: CompanionPlay) => shakeRecoveries.some(recovery => recovery.kind === kind);
  it("checks every authored play kind instead of silently skipping a new finite clip", () => {
    expect(new Set(allKinds)).toEqual(new Set(Object.keys(COMPANION_PLAY_TIMING)));
  });
  it.each(kinds)("%s terminates, preserves its support and returns upright", kind => {
    for (let i = 0; i <= 100; i++) {
      const pose = sampleCompanionPlay(kind, i / 100);
      expect(pose.row).toBeGreaterThanOrEqual(20); expect(pose.row).toBeLessThanOrEqual(31);
      expect(pose.phase).toBeGreaterThanOrEqual(0); expect(pose.phase).toBeLessThanOrEqual(1);
      const maxLean = shakesHead(kind) && pose.beat === "recover" ? 8 : 3;
      expect(Math.abs(pose.lift)).toBeLessThanOrEqual(9); expect(Math.abs(pose.lean)).toBeLessThanOrEqual(maxLean);
    }
    expect(sampleCompanionPlay(kind, 1)).toEqual({ row: 23, phase: 1, beat: "recover", lift: 0, lean: 0, shift: 0, compression: 0 });
  });
  it("tumbles through genuine back poses, dizzy, glances, then recovery", () => {
    const duration = companionPlayDuration("tumble");
    expect([100, 700, 1000, 1600].map(ms => sampleCompanionPlay("tumble", ms / duration).row)).toEqual([21, 22, 26, 23]);
    expect(sampleCompanionPlay("bonk-sad", .5).row).toBe(28);
    expect(sampleCompanionPlay("bonk-tears", .5).row).toBe(27);
  });
  it("slips before two actual roll cycles, then gets dizzy, checks and recovers", () => {
    const duration = companionPlayDuration("slip-tumble");
    expect(duration).toBe(2220);
    const samples = [0, 179.99, 180, 799.99, 800, 1099.99, 1100, 1419.99, 1420, 2219.99];
    expect(samples.map(ms => sampleCompanionPlay("slip-tumble", ms / duration).row)).toEqual([24, 24, 21, 21, 22, 22, 26, 26, 23, 23]);
    for (const ms of [335, 645]) expect(sampleCompanionPlay("slip-tumble", ms / duration).phase).toBeCloseTo(.5);
    expect(sampleCompanionPlay("slip-tumble", 489.9 / duration).phase).toBeGreaterThan(.99);
    expect(sampleCompanionPlay("slip-tumble", 490.1 / duration).phase).toBeLessThan(.01);
  });
  it("shifts only the rolling body while the preceding slip stays on its support", () => {
    expect(sampleCompanionPlay("slip-tumble", 90 / 2220)).toMatchObject({ row: 24, beat: "impact", lift: -3, lean: 0, shift: 0 });
    expect(sampleCompanionPlay("slip-tumble", 490 / 2220)).toMatchObject({ row: 21, beat: "impact", lift: -5, lean: 0, shift: 22 });
    expect(sampleCompanionPlay("tumble", 310 / 2160).shift).toBe(22);
    expect(sampleCompanionPlay("slip", 110 / companionPlayDuration("slip")).shift).toBe(0);
    expect(sampleCompanionPlay("bump", 60 / companionPlayDuration("bump")).shift).toBe(0);
  });
  it("acknowledges a bonk within110ms, settles the teary face within280ms and recovers by1.28s", () => {
    const duration = companionPlayDuration("bonk-tears");
    expect(duration).toBe(1280);
    expect(sampleCompanionPlay("bonk-tears", 99 / duration).row).toBe(25);
    expect(sampleCompanionPlay("bonk-tears", 100 / duration).row).toBe(27);
    expect(sampleCompanionPlay("bonk-tears", 280 / duration).phase).toBeCloseTo(.84);
    expect(sampleCompanionPlay("bonk-tears", 1000 / duration).row).toBe(23);
    expect(sampleCompanionPlay("bonk-sad", 110 / companionPlayDuration("bonk-sad")).row).toBe(28);
  });
  it("never rewinds a finite bow/pounce drawing while its movement decelerates", () => {
    for (const kind of ["bow", "pounce"] as const) {
      const beat = COMPANION_PLAY_TIMING[kind].beats[0], duration = companionPlayDuration(kind);
      const phases = Array.from({ length: 101 }, (_, step) => sampleCompanionPlay(kind, beat.duration * step / 101 / duration).phase);
      expect(phases.every((phase, index) => index === 0 || phase >= phases[index - 1])).toBe(true);
      expect(phases.at(-1)).toBeGreaterThan(.98);
    }
  });
  it("recovers from shaking without a new bump, roll or displacement", () => {
    const duration = companionPlayDuration("dizzy");
    expect(duration).toBe(1320);
    expect(sampleCompanionPlay("dizzy", 0)).toMatchObject({ row: 22, beat: "dizzy", lift: 0, shift: 0 });
    expect(sampleCompanionPlay("dizzy", 519 / duration)).toMatchObject({ row: 22, beat: "dizzy", lift: 0, shift: 0 });
    expect(sampleCompanionPlay("dizzy", 520 / duration)).toMatchObject({ row: 23, beat: "recover", lift: 0, lean: 0, shift: 0, compression: 0 });
  });
  it.each(shakeRecoveries)("$kind shakes its head briskly three times before opening its eyes on the same support", ({ kind, start, duration }) => {
    expect(companionPlayDuration(kind)).toBe(duration);
    const poses = Array.from({ length: 161 }, (_, i) => sampleCompanionPlay(kind, (start + i * 5) / duration));
    expect(new Set(poses.map(pose => pose.lean.toFixed(3))).size).toBeGreaterThan(80);
    expect(new Set(poses.map(pose => pose.phase))).toEqual(new Set([0, .35, .65, 1]));
    for (let i = 0; i < poses.length; i++) {
      const pose = poses[i];
      expect(pose).toMatchObject({ row: 23, beat: "recover", lift: 0, shift: 0 });
      expect(Math.abs(pose.lean)).toBeLessThanOrEqual(8);
      expect(pose.compression).toBeGreaterThanOrEqual(0); expect(pose.compression).toBeLessThanOrEqual(.026);
      if (i) {
        expect(Math.abs(pose.lean - poses[i - 1].lean)).toBeLessThan(1.5);
        expect(Math.abs(pose.compression - poses[i - 1].compression)).toBeLessThan(.003);
      }
    }
    const extrema = poses.flatMap((pose, i) => i > 0 && i < poses.length - 1
      && (pose.lean > poses[i - 1].lean && pose.lean > poses[i + 1].lean
        || pose.lean < poses[i - 1].lean && pose.lean < poses[i + 1].lean)
      ? [{ lean: pose.lean, elapsed: i * 5 }] : []);
    expect(extrema).toHaveLength(6);
    expect(Math.max(...poses.map(pose => pose.lean))).toBeGreaterThan(6);
    expect(Math.min(...poses.map(pose => pose.lean))).toBeLessThan(-6);
    extrema.forEach((peak, i) => {
      expect(peak.elapsed).toBeLessThan(520);
      expect(Math.sign(peak.lean)).toBe(i % 2 ? -1 : 1);
      if (i) expect(peak.elapsed - extrema[i - 1].elapsed).toBeLessThan(105);
    });
    expect(Math.abs(extrema[0].lean)).toBeLessThan(Math.abs(extrema[2].lean));
    expect(Math.abs(extrema[5].lean)).toBeLessThan(Math.abs(extrema[3].lean));
    for (const elapsed of [0, .01, 519.99, 520, 520.01, 559.99, 560, 560.01, 799.99, 800]) {
      const pose = sampleCompanionPlay(kind, (start + elapsed) / duration);
      expect(Math.abs(pose.lean)).toBeLessThan(.001); expect(pose.compression).toBeLessThan(.001);
    }
    expect(sampleCompanionPlay(kind, (start + 559.99) / duration).phase).toBe(0);
    expect(sampleCompanionPlay(kind, (start + 560) / duration).phase).toBe(1);
    expect(poses.slice(0, 112).every(pose => pose.phase < 1)).toBe(true);
    expect(poses.slice(112).every(pose => pose.phase === 1)).toBe(true);
    expect(poses.slice(104).every(pose => Math.abs(pose.lean) < 1e-12 && pose.compression < 1e-12)).toBe(true);
  });
  it("adds no compression to other reactions or reduced motion", () => {
    for (const kind of kinds) for (const progress of [0, .2, .5, .8, 1]) {
      expect(sampleCompanionPlay(kind, progress, true).compression).toBe(0);
      const pose = sampleCompanionPlay(kind, progress);
      if (!shakesHead(kind) || pose.beat !== "recover") expect(pose.compression).toBe(0);
    }
  });
  it("preserves quick contact, readable expression and finite recovery independently for every gesture", () => {
    const durations = kinds.map(kind => companionPlayDuration(kind));
    expect(new Set(durations).size).toBeGreaterThanOrEqual(7);
    for (const kind of kinds) {
      const timing = COMPANION_PLAY_TIMING[kind];
      expect(timing.beats.reduce((sum, beat) => sum + beat.duration, 0)).toBe(timing.duration);
      expect(timing.beats.at(-1)).toMatchObject({ row: 23, beat: "recover" });
      expect(companionPlayDuration(kind, true)).toBe(650);
      expect(timing.duration).toBeLessThan(kind === "tumble" || kind === "slip-tumble" ? 2300 : 2000);
    }
  });
  it("reduced motion has no lift/rotation or rolling", () => {
    for (const kind of allKinds) expect(sampleCompanionPlay(kind, .3, true)).toMatchObject({ lift: 0, lean: 0, shift: 0, compression: 0, beat: "recover" });
  });
  it.each(livingGestures)("$kind presents its complete finite sequence on the same support", ({ kind, duration, rows, ends, finalRow, finalBeat }) => {
    expect(companionPlayDuration(kind)).toBe(duration);
    expect(companionPlayDuration(kind, true)).toBe(650);
    let start = 0;
    for (let index = 0; index < rows.length; index++) {
      expect(sampleCompanionPlay(kind, start / duration).row).toBe(rows[index]);
      expect(sampleCompanionPlay(kind, (ends[index] - .001) / duration).row).toBe(rows[index]);
      start = ends[index];
    }
    const samples = Array.from({ length: 201 }, (_, index) => sampleCompanionPlay(kind, index / 200));
    for (const pose of samples) {
      expect(rows).toContain(pose.row);
      expect(pose.phase).toBeGreaterThanOrEqual(0); expect(pose.phase).toBeLessThanOrEqual(1);
      expect(Math.abs(pose.lift)).toBeLessThanOrEqual(3); expect(Math.abs(pose.lean)).toBeLessThanOrEqual(7);
      expect(pose.shift).toBe(0);
      expect(pose.compression).toBeGreaterThanOrEqual(0); expect(pose.compression).toBeLessThanOrEqual(.045);
    }
    expect(samples.at(-1)).toEqual({ row: finalRow, phase: 1, beat: finalBeat, lift: 0, lean: 0, shift: 0, compression: 0 });
    expect(sampleCompanionPlay(kind, 2)).toEqual(samples.at(-1));
    for (const progress of [0, .2, .5, .8, 1]) expect(sampleCompanionPlay(kind, progress, true)).toMatchObject({ lift: 0, lean: 0, shift: 0, compression: 0 });
  });
  it("kneads three finite cycles before nesting, quiet sleep and the existing wake beat", () => {
    for (const age of [250, 750, 1250]) expect(sampleCompanionPlay("cozy-nest", age / 3200)).toMatchObject({ row: 35, phase: .5 });
    expect(sampleCompanionPlay("cozy-nest", 499.99 / 3200).phase).toBeGreaterThan(.99);
    expect(sampleCompanionPlay("cozy-nest", 500.01 / 3200).phase).toBeLessThan(.01);
    const duration = 12000, wakeAt = duration - COMPANION_TIMING.sleepWake;
    expect(sampleCompanionCozySleep(0, duration)).toMatchObject({ row: 35, dreaming: false });
    expect(sampleCompanionCozySleep(1500, duration)).toMatchObject({ row: 36, dreaming: false });
    expect(sampleCompanionCozySleep(3200, duration)).toMatchObject({ row: 40, phase: 0, dreaming: true });
    expect(sampleCompanionCozySleep(wakeAt - .001, duration)).toMatchObject({ row: 40, dreaming: true });
    expect(sampleCompanionCozySleep(wakeAt, duration)).toMatchObject({ row: 12, phase: 0, dreaming: false });
    expect(sampleCompanionCozySleep(duration, duration)).toMatchObject({ row: 12, phase: 1, dreaming: false, lift: 0, lean: 0, shift: 0, compression: 0 });
    expect(sampleCompanionCozySleep(0, duration, true)).toMatchObject({ row: 40, dreaming: true });
    expect(sampleCompanionCozySleep(0, duration, false, true)).toMatchObject({ row: 11, dreaming: true, lift: 0, lean: 0, shift: 0, compression: 0 });
  });
  it("a deliberate short click has context; dragging/cancel/holds never bonk", () => {
    expect(companionTapReaction({ elapsed: 100, moved: 2, cancelled: false, recentMishap: false })).toBe("bonk-tears");
    expect(companionTapReaction({ elapsed: 100, moved: 2, cancelled: false, recentMishap: true })).toBe("bonk-sad");
    for (const patch of [{ elapsed: 500 }, { moved: 7 }, { cancelled: true }, { elapsed: NaN }]) expect(companionTapReaction({ elapsed: 100, moved: 2, cancelled: false, recentMishap: true, ...patch })).toBeNull();
  });
});
