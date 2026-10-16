import { describe, expect, it } from "vitest";
import { companionTapReaction, sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import type { CompanionPlay } from "@/lib/ui/viewer-companion/brain";

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
    expect([.1, .5, .7, .95].map(p => sampleCompanionPlay("tumble", p).row)).toEqual([21, 22, 26, 23]);
    expect(sampleCompanionPlay("bonk-sad", .5).row).toBe(28);
    expect(sampleCompanionPlay("bonk-tears", .5).row).toBe(27);
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
