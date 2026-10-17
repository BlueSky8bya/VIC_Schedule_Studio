import { describe, expect, it } from "vitest";
import { companionTapReaction, sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import type { CompanionPlay } from "@/lib/ui/viewer-companion/brain";
import { companionPlayDuration, COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";

describe("finite authored companion play", () => {
  const kinds: CompanionPlay[] = ["tumble", "bump", "slip", "bonk-sad", "bonk-tears", "celebrate", "groom", "pounce", "bow", "dizzy"];
  it.each(kinds)("%s terminates, preserves its support and returns upright", kind => {
    for (let i = 0; i <= 100; i++) {
      const pose = sampleCompanionPlay(kind, i / 100);
      expect(pose.row).toBeGreaterThanOrEqual(20); expect(pose.row).toBeLessThanOrEqual(31);
      expect(pose.phase).toBeGreaterThanOrEqual(0); expect(pose.phase).toBeLessThanOrEqual(1);
      const maxLean = kind === "dizzy" && pose.beat === "recover" ? 8 : 3;
      expect(Math.abs(pose.lift)).toBeLessThanOrEqual(9); expect(Math.abs(pose.lean)).toBeLessThanOrEqual(maxLean);
    }
    expect(sampleCompanionPlay(kind, 1)).toMatchObject({ row: 23, phase: 1, lift: 0, lean: 0 });
  });
  it("tumbles through genuine back poses, dizzy, glances, then recovery", () => {
    const duration = companionPlayDuration("tumble");
    expect([100, 700, 1000, 1600].map(ms => sampleCompanionPlay("tumble", ms / duration).row)).toEqual([21, 22, 26, 23]);
    expect(sampleCompanionPlay("bonk-sad", .5).row).toBe(28);
    expect(sampleCompanionPlay("bonk-tears", .5).row).toBe(27);
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
  it("shakes its head briskly three times before opening its eyes on the same support", () => {
    const duration = companionPlayDuration("dizzy");
    const poses = Array.from({ length: 161 }, (_, i) => sampleCompanionPlay("dizzy", (520 + i * 5) / duration));
    expect(new Set(poses.map(pose => pose.lean.toFixed(3))).size).toBeGreaterThan(80);
    expect(new Set(poses.map(pose => pose.phase))).toEqual(new Set([0, 1]));
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
    for (const ms of [519.99, 520, 520.01, 1039.99, 1040, 1040.01, 1319.99, 1320]) {
      const pose = sampleCompanionPlay("dizzy", ms / duration);
      expect(Math.abs(pose.lean)).toBeLessThan(.001); expect(pose.compression).toBeLessThan(.001);
    }
    expect(poses.slice(0, 112).every(pose => pose.phase === 0)).toBe(true);
    expect(poses.slice(112).every(pose => pose.phase === 1)).toBe(true);
    expect(poses.slice(104).every(pose => Math.abs(pose.lean) < 1e-12 && pose.compression < 1e-12)).toBe(true);
  });
  it("adds no compression to other reactions or reduced motion", () => {
    for (const kind of kinds) for (const progress of [0, .2, .5, .8, 1]) {
      expect(sampleCompanionPlay(kind, progress, true).compression).toBe(0);
      if (kind !== "dizzy") expect(sampleCompanionPlay(kind, progress).compression).toBe(0);
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
      expect(timing.duration).toBeLessThan(2000);
    }
  });
  it("reduced motion has no lift/rotation or rolling", () => {
    for (const kind of kinds) expect(sampleCompanionPlay(kind, .3, true)).toMatchObject({ lift: 0, lean: 0, beat: "recover" });
  });
  it("a deliberate short click has context; dragging/cancel/holds never bonk", () => {
    expect(companionTapReaction({ elapsed: 100, moved: 2, cancelled: false, recentMishap: false })).toBe("bonk-tears");
    expect(companionTapReaction({ elapsed: 100, moved: 2, cancelled: false, recentMishap: true })).toBe("bonk-sad");
    for (const patch of [{ elapsed: 500 }, { moved: 7 }, { cancelled: true }, { elapsed: NaN }]) expect(companionTapReaction({ elapsed: 100, moved: 2, cancelled: false, recentMishap: true, ...patch })).toBeNull();
  });
});
