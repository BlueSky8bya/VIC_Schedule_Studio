import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { ACT } from "@/lib/activity/labels";

const voice = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/ui/sfx", () => ({ playCompanionVoice: voice, playCompanionSample: vi.fn(() => false) }));
import { COMPANION_SOUND_AUDITIONS, COMPANION_SOUND_MOMENTS, COMPANION_SOUND_NAMES, auditionCompanionSound, companionSoundAllowed, playCompanionSound, previewCompanionSoundLevel, previewCompanionSoundVolume } from "@/lib/ui/viewer-companion/companion-sound";
import { COMPANION_SOUND_LEVELS, companionSoundLevel, companionSoundLevelPatch } from "@/lib/ui/viewer-companion/settings-levels";

// Settings redesign stage 2-가: every sound carries who started it ("direct" =
// the user's own touch and its reaction chain, "auto" = the companion alone).
// Stage 2-나: the gate reads that mark together with the one sound level.
let now = 0;
let html: { dataset: Record<string, string>; hasAttribute: (name: string) => boolean };
let origins: string[];
beforeEach(() => {
  now += 60000; voice.mockReset().mockReturnValue(true); origins = [];
  html = { dataset: {}, hasAttribute: () => false };
  vi.stubGlobal("document", { hidden: false, documentElement: html });
  vi.stubGlobal("window", { __companionSfxTrace: [], __companionSfxOrigins: origins });
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("the mark reaches the gate", () => {
  it("is auto unless the caller says the user started it", () => {
    expect(playCompanionSound("land")).toBe(true);
    now += 60000; expect(playCompanionSound("land", DEFAULT_COMPANION_PREFERENCES, "direct")).toBe(true);
    now += 60000; expect(playCompanionSound("land", DEFAULT_COMPANION_PREFERENCES, "auto")).toBe(true);
    expect(origins).toEqual(["land:auto", "land:direct", "land:auto"]);
  });

  it("a level is auditioned with the kind of sound it adds", () => {
    expect(previewCompanionSoundLevel("touch")).toBe(true);
    now += 60000; expect(previewCompanionSoundLevel("all")).toBe(true);
    expect(origins).toEqual(["pet:direct", "play:auto"]);
  });

  it("on a device that rests its own sounds, choosing all and setting the volume are still heard", () => {
    html.hasAttribute = name => name === "data-reduce-motion";
    expect(previewCompanionSoundLevel("all")).toBe(true);
    now += 60000; expect(previewCompanionSoundVolume()).toBe(true);
    expect(origins).toEqual(["pet:direct", "pet:direct"]);
    // Off is silent for both, as is a disabled companion.
    now += 60000; expect(previewCompanionSoundVolume({ ...DEFAULT_COMPANION_PREFERENCES, sound: false })).toBe(false);
    expect(previewCompanionSoundVolume({ ...DEFAULT_COMPANION_PREFERENCES, soundVolume: 0 })).toBe(false);
    expect(previewCompanionSoundLevel("all", { ...DEFAULT_COMPANION_PREFERENCES, enabled: false })).toBe(false);
    expect(origins).toHaveLength(2);
  });

  it("records nothing for a sound that did not play", () => {
    expect(playCompanionSound("pet", { ...DEFAULT_COMPANION_PREFERENCES, sound: false }, "direct")).toBe(false);
    expect(origins).toEqual([]);
  });
});

describe("the level and the mark decide together (proposal 4-2)", () => {
  const bools = [false, true];
  const audible = (moment: (typeof COMPANION_SOUND_MOMENTS)[number], preferences: CompanionPreferences, origin: "direct" | "auto", reduce: boolean, gfx: string) => {
    html.hasAttribute = name => reduce && name === "data-reduce-motion"; html.dataset.gfx = gfx;
    now += 60000; return playCompanionSound(moment, preferences, origin);
  };

  it("matches the rule for every sound, stored combination, mark and device state", () => {
    let cases = 0;
    for (const moment of COMPANION_SOUND_MOMENTS) for (const enabled of bools) for (const sound of bools) for (const soundVolume of [0, 40])
      for (const soundCare of bools) for (const soundMotion of bools) for (const soundKeepsakes of bools) for (const reduce of bools) for (const gfx of ["full", "lite", "soft", "off"]) for (const origin of ["direct", "auto"] as const) {
        const preferences: CompanionPreferences = { ...DEFAULT_COMPANION_PREFERENCES, enabled, sound, soundVolume, soundCare, soundMotion, soundKeepsakes };
        // Written out from the design, not from the function under test.
        const level = !sound || soundVolume === 0 || !soundCare ? "off" : soundMotion && soundKeepsakes ? "all" : "touch";
        const resting = reduce || gfx === "soft" || gfx === "off";
        const expected = enabled && level !== "off" && (origin === "direct" || level === "all" && !resting);
        expect(audible(moment, preferences, origin, reduce, gfx), `${moment} ${origin} ${level} ${JSON.stringify({ enabled, reduce, gfx })}`).toBe(expected);
        cases += 1;
      }
    expect(cases).toBe(COMPANION_SOUND_MOMENTS.length * 2 ** 7 * 4 * 2);
  });

  it("the three levels as chosen on the screen", () => {
    const moments = ["pet", "lift", "dizzy", "play", "sleep", "feed", "land", "discover", "gift", "equip"] as const;
    for (const level of COMPANION_SOUND_LEVELS) for (const start of [DEFAULT_COMPANION_PREFERENCES, { ...DEFAULT_COMPANION_PREFERENCES, soundVolume: 0 }, { ...DEFAULT_COMPANION_PREFERENCES, soundCare: false, soundMotion: false }]) {
      const preferences = { ...start, ...companionSoundLevelPatch(level, start) };
      expect(companionSoundLevel(preferences)).toBe(level);
      for (const moment of moments) {
        expect(audible(moment, preferences, "direct", false, "full"), `${level} ${moment} direct`).toBe(level !== "off");
        expect(audible(moment, preferences, "auto", false, "full"), `${level} ${moment} auto`).toBe(level === "all");
      }
    }
  });

  it("left alone, a device never gains a sound it did not have (proposal 5-3)", () => {
    // Before this stage a sound needed: master, volume, its own group, and for the motion group no resting device.
    const groups = { care: ["cushion", "feed", "land", "eat", "pet"], motion: ["lift", "dizzy", "tumble", "sleep", "play"], keepsakes: ["discover", "gift", "equip", "unequip"] } as const;
    for (const sound of bools) for (const soundVolume of [0, 40]) for (const soundCare of bools) for (const soundMotion of bools) for (const soundKeepsakes of bools) for (const reduce of bools) for (const gfx of ["full", "soft", "off"]) {
      const preferences: CompanionPreferences = { ...DEFAULT_COMPANION_PREFERENCES, sound, soundVolume, soundCare, soundMotion, soundKeepsakes };
      const before = { care: soundCare, motion: soundMotion && !reduce && gfx === "full", keepsakes: soundKeepsakes };
      for (const group of ["care", "motion", "keepsakes"] as const) for (const moment of groups[group]) {
        const played = sound && soundVolume > 0 && before[group];
        if (!played) expect(audible(moment, preferences, "auto", reduce, gfx), `auto ${moment} ${JSON.stringify(preferences)} ${reduce} ${gfx}`).toBe(false);
      }
    }
  });
});

describe("audition tiles (stage 2-다)", () => {
  it("offer every sound once, named, in the group of who can start it", () => {
    const all = COMPANION_SOUND_AUDITIONS.flatMap(group => group.moments);
    expect([...all].sort()).toEqual([...COMPANION_SOUND_MOMENTS].sort());
    expect(new Set(all).size).toBe(all.length);
    for (const moment of COMPANION_SOUND_MOMENTS) expect(COMPANION_SOUND_NAMES[moment], moment).toBeTruthy();
    // Only the two sounds the user can never start are auditioned as the companion's own (proposal 4-3).
    expect(COMPANION_SOUND_AUDITIONS.filter(group => group.origin === "auto").flatMap(group => group.moments)).toEqual(["eat", "tumble"]);
    expect((ACT["companion-sound-audition"] as { opts?: Record<string, string> }).opts).toEqual({ ...COMPANION_SOUND_NAMES });
  });

  it("a tile is heard exactly when the screen allows it, in every level and device state", () => {
    const bools = [false, true];
    for (const level of COMPANION_SOUND_LEVELS) for (const enabled of bools) for (const reduce of bools) for (const gfx of ["full", "lite", "soft", "off"]) for (const group of COMPANION_SOUND_AUDITIONS) for (const moment of group.moments) {
      const preferences = { ...DEFAULT_COMPANION_PREFERENCES, ...companionSoundLevelPatch(level, DEFAULT_COMPANION_PREFERENCES), enabled };
      html.hasAttribute = name => reduce && name === "data-reduce-motion"; html.dataset.gfx = gfx;
      const allowed = companionSoundAllowed(preferences, group.origin, { reduceMotion: reduce, gfx });
      // The same rule written from the design.
      expect(allowed, `${moment} ${level} ${enabled} ${reduce} ${gfx}`).toBe(enabled && level !== "off" && (group.origin === "direct" || level === "all" && !reduce && gfx !== "soft" && gfx !== "off"));
      now += 60000; origins.length = 0;
      expect(auditionCompanionSound(moment, preferences)).toBe(allowed);
      expect(origins).toEqual(allowed ? [`${moment}:${group.origin}`] : []);
    }
  });
});

// Each place that starts a sound must say who started it. A forgotten mark
// would silently fall to "auto"; these checks make forgetting loud.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const calls = (source: string) => [...source.matchAll(/playCompanionSound\(("[a-z]+"|[^,()]+(?:\([^()]*\))?[^,()]*),\s*([^,()]+(?:\.[a-zA-Z]+)*)(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g)]
  .map(match => ({ moment: match[1].trim(), origin: match[3]?.trim() }));

describe("every caller states who started the sound", () => {
  const files = ["components/poster/viewer-companion/viewer-companion.tsx", "components/poster/viewer-companion/companion-meadow-walk.tsx", "components/shared/companion-wardrobe.tsx"];

  it("has no caller outside the three files that are checked", () => {
    const walk = (dir: string): string[] => readdirSync(resolve(process.cwd(), dir), { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(`${dir}/${entry.name}`) : /\.tsx?$/.test(entry.name) ? [`${dir}/${entry.name}`] : []);
    const callers = [...walk("components"), ...walk("lib"), ...walk("app")].filter(file => /playCompanionSound\(/.test(read(file)) && !file.endsWith("companion-sound.ts"));
    expect(callers.sort()).toEqual([...files].sort());
    // Calls are written on one line; a call split over lines would escape the scan below.
    for (const file of files) expect(read(file)).not.toMatch(/playCompanionSound\(\s*$/m);
  });

  it("passes an explicit mark at all 16 call sites", () => {
    const all = files.flatMap(file => calls(read(file)).map(call => ({ file, ...call })));
    expect(all).toHaveLength(16); // companion 12, meadow 2, wardrobe 2 (counted from the code; the design note said 15)
    for (const call of all) expect(call.origin, `${call.file} ${call.moment}`).toBeTruthy();
  });

  it("marks the user's own actions as direct", () => {
    const companion = calls(read(files[0])), direct = (moment: string) => companion.filter(call => call.moment === `"${moment}"`).map(call => call.origin);
    expect(direct("feed")).toEqual(['"direct"']);       // the user pressed the dispenser
    expect(direct("cushion")).toEqual(['"direct"']);    // called home
    expect(direct("lift")).toEqual(['"direct"', '"direct"']); // pointer and keyboard pick-up
    expect(direct("pet")).toEqual(['"direct"']);
    expect(direct("sleep")).toEqual(['"direct"']);      // put to bed while its drawing is paused
    expect(direct("gift")).toEqual(['"direct"']);       // the user opened the box
    expect(direct("equip")).toEqual(['"direct"']);
    expect(direct("play")).toEqual(['"direct"', '"direct"']); // toy taken out, toy put back
    // Food landing follows the food's own mark; the queued sound follows the mark it was queued with.
    expect(direct("land")).toEqual(['direct ? "direct" : "auto"']);
    expect(companion.filter(call => call.moment === "moment").map(call => call.origin)).toEqual(["soundOrigin(direct)"]);
    expect(calls(read(files[1])).map(call => `${call.moment}:${call.origin}`)).toEqual(['"dizzy":"direct"', '"lift":"direct"']);
    expect(calls(read(files[2])).map(call => call.origin)).toEqual(['"direct"', '"direct"']);
  });

  it("queues sounds only through the helper that pairs a sound with its mark", () => {
    const source = read(files[0]);
    // The only writes: the helper itself, and clearing (after the sound left, and when the companion pauses).
    expect([...source.matchAll(/pendingCue = ([^;]*);/g)].map(match => match[1]).sort()).toEqual(["undefined", "undefined", "{ moment, direct }"]);
    const queued = [...source.matchAll(/queueCue\(([^;]*?)\);/g)].map(match => match[1]);
    expect(queued).toHaveLength(12);
    // The user's: put to bed, stroked, the launched action's own mark, landing after their drop.
    expect(queued.filter(args => /direct|true/.test(args))).toEqual([
      '"sleep", direct', '"pet", true',
      'next.play === "dizzy" ? "dizzy" : ["tumble", "slip-tumble", "bump", "slip"].includes(next.play) ? "tumble" : "play", Boolean(next.direct)',
      '"sleep", Boolean(next.direct)', '"land", Boolean(completed.direct)',
    ]);
    // The companion's own: reunion, accessory trick, toy scene, its own dispenser, scattering, hat landing, meal.
    expect(queued.filter(args => !/direct|true/.test(args))).toEqual(['"play"', '"play"', '"play"', '"feed"', '"play"', '"land"', 'firstFood ? "discover" : "eat"']);
  });

  it("starts a direct chain only from the user's own tap, stroke reply, drop or bedtime", () => {
    const source = read(files[0]);
    expect(source.match(/direct: true(?: as const)?/g)).toHaveLength(6); // tap reply, two stroke replies, bedtime, arrival after a direct fall, the landing leg of a throw
    // pointer release, overlay drop, cancelled-press release, keyboard release, Escape while holding, two placement clicks,
    // a throw that ran out of flight, a user's fall re-aimed after the layout changed
    expect(source.match(/markDirect\(\);/g)).toHaveLength(9);
    // A throw keeps its mark when the flight touches down and a new landing leg replaces it.
    expect(source).toMatch(/duration: COMPANION_TIMING\.jumpLanding, \.\.\.\(action\?\.direct \? \{ direct: true as const \} : \{\}\)/);
    // Shaken while held: a first-time discovery in the hand is the user's.
    expect(source).toMatch(/discoveredDirect = discovered && Boolean\(action\?\.direct \|\| pressed\?\.grabbed \|\| keyboardHeld\)/);
    // Called home and resting there is the companion's own, as is the washing pad.
    expect(source).toMatch(/if \(preferences\.sleep && document\.hasFocus\(\)\) startRest\(\);/);
    expect(source).not.toMatch(/wash[^\n]{0,200}direct: true/);
  });
});
