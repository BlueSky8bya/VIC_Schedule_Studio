import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { companionPettingResponse } from "@/lib/ui/viewer-companion/petting";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, normalizeCompanionPreferences, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import {
  COMPANION_SOUND_LEVELS, companionBehaviorPreferences, companionPlayful, companionPlayfulPatch, companionQaStoredMotion,
  companionSoundLevel, companionSoundLevelPatch, type CompanionSoundLevel,
} from "@/lib/ui/viewer-companion/settings-levels";

// Redesign stage 0 (docs/ux/companion-settings-redesign-proposal.md 5-1): the
// read/write rules as pure functions. Sound is live since stage 2-나, pranks since stage 4.
// Movement stopped being a setting on 2026-11-19 (owner): the companion always walks and jumps.
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
  const moves = (state: CompanionPreferences, storedMotion?: boolean) => { const { roam, jump } = companionBehaviorPreferences(state, storedMotion); return [roam, jump]; };
  it("movement: always free, whichever of the 4 mixes an older screen stored", () => {
    expect(motionStates).toHaveLength(4);
    for (const state of motionStates) expect(moves(state), `${state.roam}/${state.jump}`).toEqual([true, true]);
  });
  it("movement: only the screen checks' flag keeps the stored reading", () => {
    expect(motionStates.map(state => moves(state, true))).toEqual([[false, false], [false, false], [true, false], [true, true]]);
    for (const state of motionStates) expect(moves(state, false)).toEqual([true, true]);
  });
  it("the flag is one fixed local key that is read, never written", () => {
    const seen: string[] = [], fake = (value: string | null) => ({ localStorage: { getItem: (key: string) => { seen.push(key); return value; } } });
    expect(companionQaStoredMotion()).toBe(false); // no window here
    try {
      vi.stubGlobal("window", fake("1")); expect(companionQaStoredMotion()).toBe(true);
      for (const other of [null, "0", "true"]) { vi.stubGlobal("window", fake(other)); expect(companionQaStoredMotion(), String(other)).toBe(false); }
      vi.stubGlobal("window", { get localStorage(): never { throw new Error("blocked"); } }); expect(companionQaStoredMotion()).toBe(false);
    } finally { vi.unstubAllGlobals(); }
    expect(new Set(seen)).toEqual(new Set(["vic.qa.companionStoredMotion"]));
  });
  it("pranks: the 16 stored mixes act as on or off as a whole, and every chosen value acts as itself (32 cases)", () => {
    const acts = (state: CompanionPreferences) => { const { heartPrank, cardPrank, ambientPrank, rarePrank } = companionBehaviorPreferences(state); return [heartPrank, cardPrank, ambientPrank, rarePrank]; };
    for (const state of playfulStates) {
      const on = companionPlayful(state);
      expect(acts(state)).toEqual([on, on, on, on]);
      for (const next of bools) expect(acts(apply(state, companionPlayfulPatch(next)))).toEqual([next, next, next, next]);
    }
  });
  it("the panel move is one of the pranks: it acts only while the prank switch is on (32 cases)", () => {
    for (const state of playfulStates) for (const panelPrank of bools)
      expect(companionBehaviorPreferences({ ...state, panelPrank }).panelPrank, JSON.stringify(state)).toBe(panelPrank && companionPlayful(state));
  });
  it("pranks are only ever calmer than the stored mix, and everything else is left alone", () => {
    const pranks = ["heartPrank", "cardPrank", "ambientPrank", "rarePrank", "panelPrank"] as const;
    for (const motion of motionStates) for (const playful of playfulStates) for (const panelPrank of bools) for (const storedMotion of bools) {
      const state = stored({ roam: motion.roam, jump: motion.jump, heartPrank: playful.heartPrank, cardPrank: playful.cardPrank, ambientPrank: playful.ambientPrank, rarePrank: playful.rarePrank, panelPrank, soundVolume: 25, speed: "relaxed" });
      const acted = companionBehaviorPreferences(state, storedMotion);
      for (const key of pranks) expect(!state[key] && acted[key], key).toBe(false);
      const rest = (value: CompanionPreferences) => { const copy: Partial<CompanionPreferences> = { ...value }; for (const key of [...pranks, "roam", "jump"] as const) delete copy[key]; return copy; };
      expect(rest(acted)).toEqual(rest(state));
    }
  });
  it("returns the same object when nothing differs and never changes the stored one", () => {
    const whole = stored({});
    expect(companionBehaviorPreferences(whole)).toBe(whole);
    expect(companionBehaviorPreferences(whole, true)).toBe(whole);
    const calm = stored({ ...companionPlayfulPatch(false), panelPrank: false });
    expect(companionBehaviorPreferences(calm)).toBe(calm);
    const still = stored({ roam: false, jump: false });
    expect(companionBehaviorPreferences(still, true)).toBe(still);
    const mixed = Object.freeze(stored({ roam: false, jump: true, heartPrank: false }));
    const acted = companionBehaviorPreferences(mixed);
    expect(acted).not.toBe(mixed); expect(mixed).toMatchObject({ roam: false, cardPrank: true, panelPrank: true });
    expect(acted).toMatchObject({ roam: true, jump: true, heartPrank: false, cardPrank: false, ambientPrank: false, rarePrank: false, panelPrank: false });
  });
});

// The pure reading is only worth something if the companion really acts on it.
describe("the companion acts on the read choices", () => {
  const source = readFileSync(resolve(process.cwd(), "components/poster/viewer-companion/viewer-companion.tsx"), "utf8");
  it("takes the stored choices in one place and never reads them again", () => {
    expect(source.match(/storedPreferences/g)).toHaveLength(3); // the prop, and the two in the one useMemo
    expect(source).toContain("const [storedMotion] = useState(companionQaStoredMotion);");
    expect(source).toContain("const preferences = useMemo(() => companionBehaviorPreferences(storedPreferences, storedMotion), [storedPreferences, storedMotion]);");
  });
  it("a real consumer answers the same whatever movement an older screen stored", () => {
    // Petting is a direct interaction that reads `jump`.
    for (const personality of COMPANION_PERSONALITIES) for (const petting of bools) {
      const answer = (roam: boolean, jump: boolean) => companionPettingResponse(personality, companionBehaviorPreferences(stored({ roam, jump, personality, petting })));
      for (const state of motionStates) expect(answer(state.roam, state.jump), personality).toEqual(answer(true, true));
    }
  });
  it("the settings page writes the prank switch through its patch and has no movement control", () => {
    const page = readFileSync(resolve(process.cwd(), "components/shared/companion-settings.tsx"), "utf8");
    expect(page).toContain("onChange(companionPlayfulPatch(!playful))");
    for (const gone of ["companion-motion-level", "companion-roam", "companion-jump", "companion-heart-prank", "companion-card-prank", "companion-hide", "companion-rare-prank"]) expect(page, gone).not.toContain(gone);
    expect(page).not.toMatch(/MotionLevel|MOTION_PREVIEWS|rhh-motion-preview|걷기만|뛰어다니기|\b(?:roam|jump)\b/);
  });
});

describe("no new stored value", () => {
  const patches: Partial<CompanionPreferences>[] = [
    ...COMPANION_SOUND_LEVELS.flatMap(level => [companionSoundLevelPatch(level, stored({})), companionSoundLevelPatch(level, stored({ soundVolume: 0 }))]),
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
      [companionPlayfulPatch(false), ["heartPrank", "cardPrank", "ambientPrank", "rarePrank"]],
    ];
    for (const [patch, own] of groups) {
      const next = apply(base, patch);
      for (const key of Object.keys(base) as (keyof CompanionPreferences)[]) if (!own.includes(key)) expect(next[key], key).toEqual(base[key]);
    }
  });
});
