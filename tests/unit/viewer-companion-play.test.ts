import { describe, expect, it } from "vitest";
import { companionTapReaction, sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import type { CompanionPlay } from "@/lib/ui/viewer-companion/brain";
import { companionPlayDuration, COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";

describe("finite authored companion play", () => {
  const kinds: CompanionPlay[] = ["tumble", "bump", "slip", "bonk-sad", "bonk-tears", "celebrate", "groom", "pounce", "bow"];
  it.each(kinds)("%s terminates, preserves its support and returns upright", kind => {
    for (let i = 0; i <= 100; i++) {
      const pose = sampleCompanionPlay(kind, i / 100);
      expect(pose.row).toBeGreaterThanOrEqual(20); expect(pose.row).toBeLessThanOrEqual(31);
      expect(pose.phase).toBeGreaterThanOrEqual(0); expect(pose.phase).toBeLessThanOrEqual(1);
      expect(Math.abs(pose.lift)).toBeLessThanOrEqual(9); expect(Math.abs(pose.lean)).toBeLessThanOrEqual(3);
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
