import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES, normalizeCompanionPreferences, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import {
  COMPANION_MOTION_LEVELS, COMPANION_SOUND_LEVELS, companionMotionLevel, companionMotionLevelPatch, companionPlayful, companionPlayfulPatch,
  companionSoundLevel, companionSoundLevelPatch, type CompanionMotionLevel, type CompanionSoundLevel,
} from "@/lib/ui/viewer-companion/settings-levels";

// Redesign stage 0 (docs/ux/companion-settings-redesign-proposal.md 5-1): the
// read/write rules exist as pure functions only. No screen or behavior uses them yet.
const bools = [false, true] as const;
const known = new Set(Object.keys(DEFAULT_COMPANION_PREFERENCES));
const apply = (base: CompanionPreferences, patch: Partial<CompanionPreferences>) => normalizeCompanionPreferences({ ...base, ...patch }, base);
const stored = (overrides: Partial<CompanionPreferences>): CompanionPreferences => ({ ...DEFAULT_COMPANION_PREFERENCES, ...overrides });

const soundStates = bools.flatMap(sound => bools.flatMap(soundCare => bools.flatMap(soundMotion => bools.flatMap(soundKeepsakes => [0, 45].map(soundVolume =>
  stored({ sound, soundCare, soundMotion, soundKeepsakes, soundVolume }))))));
const motionStates = bools.flatMap(roam => bools.map(jump => stored({ roam, jump })));
const playfulStates = bools.flatMap(heartPrank => bools.flatMap(cardPrank => bools.flatMap(ambientPrank => bools.map(rarePrank =>
  stored({ heartPrank, cardPrank, ambientPrank, rarePrank })))));

describe("companion sound level", () => {
  it("reads all 32 legacy states as the quieter level", () => {
    expect(soundStates).toHaveLength(32);
    const expected = (p: CompanionPreferences): CompanionSoundLevel =>
      !p.sound || p.soundVolume === 0 || !p.soundCare ? "off" : p.soundMotion && p.soundKeepsakes ? "all" : "touch";
    const counts = { off: 0, touch: 0, all: 0 };
    for (const state of soundStates) { const level = companionSoundLevel(state); expect(level).toBe(expected(state)); counts[level] += 1; }
    // Audible needs master, volume and care: 4 states. Only one of them has both other groups on.
    expect(counts).toEqual({ off: 28, touch: 3, all: 1 });
  });

  it("reads each mixed audible state as touch-only, by name", () => {
    const audible = { sound: true, soundCare: true, soundVolume: 45 };
    expect(companionSoundLevel(stored({ ...audible, soundMotion: true, soundKeepsakes: true }))).toBe("all");
    expect(companionSoundLevel(stored({ ...audible, soundMotion: false, soundKeepsakes: true }))).toBe("touch");
    expect(companionSoundLevel(stored({ ...audible, soundMotion: true, soundKeepsakes: false }))).toBe("touch");
    expect(companionSoundLevel(stored({ ...audible, soundMotion: false, soundKeepsakes: false }))).toBe("touch");
    expect(companionSoundLevel(stored({ ...audible, soundCare: false }))).toBe("off");
    expect(companionSoundLevel(stored({ ...audible, soundVolume: 0 }))).toBe("off");
    expect(companionSoundLevel(stored({ ...audible, sound: false }))).toBe("off");
  });

  it("reads back the chosen level from every state (96 cases)", () => {
    let cases = 0;
    for (const state of soundStates) for (const level of COMPANION_SOUND_LEVELS) {
      expect(companionSoundLevel(apply(state, companionSoundLevelPatch(level, state)))).toBe(level);
      cases += 1;
    }
    expect(cases).toBe(96);
  });

  it("writes exactly the documented fields", () => {
    const loud = stored({ soundVolume: 45 }), muted = stored({ soundVolume: 0 });
    expect(companionSoundLevelPatch("off", loud)).toEqual({ sound: false });
    expect(companionSoundLevelPatch("off", muted)).toEqual({ sound: false });
    expect(companionSoundLevelPatch("touch", loud)).toEqual({ sound: true, soundCare: true, soundMotion: false, soundKeepsakes: true });
    expect(companionSoundLevelPatch("all", loud)).toEqual({ sound: true, soundCare: true, soundMotion: true, soundKeepsakes: true });
    expect(companionSoundLevelPatch("touch", muted)).toEqual({ sound: true, soundCare: true, soundMotion: false, soundKeepsakes: true, soundVolume: 60 });
    expect(companionSoundLevelPatch("all", muted)).toEqual({ sound: true, soundCare: true, soundMotion: true, soundKeepsakes: true, soundVolume: 60 });
  });

  it("keeps the previous mix and volume when turned off", () => {
    const before = stored({ soundMotion: false, soundVolume: 25 });
    const after = apply(before, companionSoundLevelPatch("off", before));
    expect(after).toEqual({ ...before, sound: false });
  });
});

describe("companion motion level", () => {
  it("reads the 4 legacy states", () => {
    expect(motionStates.map(state => [state.roam, state.jump, companionMotionLevel(state)])).toEqual([
      [false, false, "still"], [false, true, "still"], [true, false, "walk"], [true, true, "run"],
    ]);
  });

  it("reads back the chosen level from every state (12 cases)", () => {
    let cases = 0;
    for (const state of motionStates) for (const level of COMPANION_MOTION_LEVELS) {
      expect(companionMotionLevel(apply(state, companionMotionLevelPatch(level)))).toBe(level);
      cases += 1;
    }
    expect(cases).toBe(12);
  });

  it("writes exactly the documented fields", () => {
    const patches: Record<CompanionMotionLevel, unknown> = { still: companionMotionLevelPatch("still"), walk: companionMotionLevelPatch("walk"), run: companionMotionLevelPatch("run") };
    expect(patches).toEqual({ still: { roam: false }, walk: { roam: true, jump: false }, run: { roam: true, jump: true } });
  });
});

describe("companion playful switch", () => {
  it("is on only when all four pranks are on (16 states)", () => {
    expect(playfulStates).toHaveLength(16);
    expect(playfulStates.filter(companionPlayful)).toEqual([stored({})]);
  });

  it("reads back the chosen value from every state (32 cases)", () => {
    let cases = 0;
    for (const state of playfulStates) for (const on of bools) {
      const next = apply(state, companionPlayfulPatch(on));
      expect(companionPlayful(next)).toBe(on);
      expect([next.heartPrank, next.cardPrank, next.ambientPrank, next.rarePrank]).toEqual([on, on, on, on]);
      cases += 1;
    }
    expect(cases).toBe(32);
  });

  it("leaves the panel-seat prank alone", () => {
    for (const panelPrank of bools) for (const on of bools) expect(apply(stored({ panelPrank }), companionPlayfulPatch(on)).panelPrank).toBe(panelPrank);
  });
});

describe("no new stored value", () => {
  const patches: Partial<CompanionPreferences>[] = [
    ...COMPANION_SOUND_LEVELS.flatMap(level => [companionSoundLevelPatch(level, stored({})), companionSoundLevelPatch(level, stored({ soundVolume: 0 }))]),
    ...COMPANION_MOTION_LEVELS.map(companionMotionLevelPatch),
    ...bools.map(companionPlayfulPatch),
  ];

  it("writes only fields an older screen already knows", () => {
    for (const patch of patches) for (const key of Object.keys(patch)) expect(known.has(key), key).toBe(true);
  });

  it("survives the older screen's allowlist unchanged", () => {
    for (const patch of patches) {
      const next = { ...DEFAULT_COMPANION_PREFERENCES, ...patch };
      expect(normalizeCompanionPreferences(JSON.parse(JSON.stringify(next)))).toEqual(next);
    }
  });

  it("touches nothing outside its own group", () => {
    const base = stored({ enabled: false, sleep: false, drag: false, speed: "relaxed", animalMode: "cat", personality: "tidy", panelPrank: false, learnFromYou: false });
    const groups: [Partial<CompanionPreferences>, (keyof CompanionPreferences)[]][] = [
      [companionSoundLevelPatch("all", stored({ soundVolume: 0 })), ["sound", "soundVolume", "soundCare", "soundMotion", "soundKeepsakes"]],
      [companionMotionLevelPatch("run"), ["roam", "jump"]],
      [companionPlayfulPatch(false), ["heartPrank", "cardPrank", "ambientPrank", "rarePrank"]],
    ];
    for (const [patch, own] of groups) {
      const next = apply(base, patch);
      for (const key of Object.keys(base) as (keyof CompanionPreferences)[]) if (!own.includes(key)) expect(next[key], key).toEqual(base[key]);
    }
  });
});
