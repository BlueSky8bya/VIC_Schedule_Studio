import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { companionPettingResponse } from "@/lib/ui/viewer-companion/petting";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, normalizeCompanionPreferences, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import {
  COMPANION_MOTION_LEVELS, COMPANION_SOUND_LEVELS, companionBehaviorPreferences, companionMotionLevel, companionMotionLevelPatch, companionPlayful, companionPlayfulPatch,
  companionSoundLevel, companionSoundLevelPatch, type CompanionMotionLevel, type CompanionSoundLevel,
} from "@/lib/ui/viewer-companion/settings-levels";

// Redesign stage 0 (docs/ux/companion-settings-redesign-proposal.md 5-1): the
// read/write rules as pure functions. Sound is live since stage 2-나, movement and pranks since stage 4.
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

// Stage 4: the runtime acts on the same reading as the screen, so mixes that show as one choice behave as one.
describe("companion behaviour follows the shown choice", () => {
  it("movement: the 4 stored mixes act as 3 levels, and every chosen level acts as itself (12 cases)", () => {
    const acts = (state: CompanionPreferences) => { const { roam, jump } = companionBehaviorPreferences(state); return { roam, jump }; };
    const byLevel: Record<CompanionMotionLevel, { roam: boolean; jump: boolean }> = { still: { roam: false, jump: false }, walk: { roam: true, jump: false }, run: { roam: true, jump: true } };
    for (const state of motionStates) {
      expect(acts(state), `${state.roam}/${state.jump}`).toEqual(byLevel[companionMotionLevel(state)]);
      for (const level of COMPANION_MOTION_LEVELS) expect(acts(apply(state, companionMotionLevelPatch(level))), `${state.roam}/${state.jump} -> ${level}`).toEqual(byLevel[level]);
    }
  });
  it("pranks: the 16 stored mixes act as on or off as a whole, and every chosen value acts as itself (32 cases)", () => {
    const acts = (state: CompanionPreferences) => { const { heartPrank, cardPrank, ambientPrank, rarePrank } = companionBehaviorPreferences(state); return [heartPrank, cardPrank, ambientPrank, rarePrank]; };
    for (const state of playfulStates) {
      const on = companionPlayful(state);
      expect(acts(state)).toEqual([on, on, on, on]);
      for (const next of bools) expect(acts(apply(state, companionPlayfulPatch(next)))).toEqual([next, next, next, next]);
    }
  });
  it("is only ever calmer than the stored mix, and leaves everything else alone", () => {
    const keys = ["jump", "heartPrank", "cardPrank", "ambientPrank", "rarePrank"] as const;
    for (const motion of motionStates) for (const playful of playfulStates) for (const panelPrank of bools) {
      const state = stored({ roam: motion.roam, jump: motion.jump, heartPrank: playful.heartPrank, cardPrank: playful.cardPrank, ambientPrank: playful.ambientPrank, rarePrank: playful.rarePrank, panelPrank, soundVolume: 25, speed: "relaxed" });
      const acted = companionBehaviorPreferences(state);
      for (const key of keys) expect(!state[key] && acted[key], key).toBe(false);
      const rest = (value: CompanionPreferences) => { const copy: Partial<CompanionPreferences> = { ...value }; for (const key of keys) delete copy[key]; return copy; };
      expect(rest(acted)).toEqual(rest(state));
    }
  });
  it("returns the same object when nothing differs and never changes the stored one", () => {
    const whole = stored({});
    expect(companionBehaviorPreferences(whole)).toBe(whole);
    const mixed = Object.freeze(stored({ roam: false, jump: true, heartPrank: false }));
    const acted = companionBehaviorPreferences(mixed);
    expect(acted).not.toBe(mixed); expect(mixed.jump).toBe(true); expect(mixed.cardPrank).toBe(true);
    expect(acted).toMatchObject({ roam: false, jump: false, heartPrank: false, cardPrank: false, ambientPrank: false, rarePrank: false });
  });
});

// The pure reading is only worth something if the companion really acts on it.
describe("the companion acts on the read choices", () => {
  const source = readFileSync(resolve(process.cwd(), "components/poster/viewer-companion/viewer-companion.tsx"), "utf8");
  it("takes the stored choices in one place and never reads them again", () => {
    expect(source.match(/storedPreferences/g)).toHaveLength(3); // the prop, and the two in the one useMemo
    expect(source).toContain("const preferences = useMemo(() => companionBehaviorPreferences(storedPreferences), [storedPreferences]);");
  });
  it("a real consumer answers the same for mixes that show as the same choice", () => {
    // Petting is a direct interaction that reads `jump`: under "가만히" a jump left on must not change the answer.
    for (const personality of COMPANION_PERSONALITIES) for (const petting of bools) {
      const answer = (jump: boolean) => companionPettingResponse(personality, companionBehaviorPreferences(stored({ roam: false, jump, personality, petting })));
      expect(answer(true), personality).toEqual(answer(false));
    }
  });
  it("the settings page writes through the same patch functions and marks the movement row as its place", () => {
    const page = readFileSync(resolve(process.cwd(), "components/shared/companion-settings.tsx"), "utf8");
    expect(page).toContain("onChange(companionMotionLevelPatch(level))");
    expect(page).toContain("onChange(companionPlayfulPatch(!playful))");
    expect(page).toMatch(/data-settings-place="companion-roam">\s*<RowLabel[^\n]{0,80}>움직임<\/RowLabel>/);
    for (const gone of ["companion-roam", "companion-jump", "companion-heart-prank", "companion-card-prank", "companion-hide", "companion-rare-prank"]) expect(page, gone).not.toContain(`dataAct="${gone}`);
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
