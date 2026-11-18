import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

const voice = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/ui/sfx", () => ({ playCompanionVoice: voice, playCompanionSample: vi.fn(() => false) }));
import { COMPANION_SOUND_MOMENTS, playCompanionSound, previewCompanionSound } from "@/lib/ui/viewer-companion/companion-sound";

// Settings redesign stage 2-가: every sound carries who started it ("direct" =
// the user's own touch and its reaction chain, "auto" = the companion alone).
// The mark only travels in this stage: nothing may sound differently.
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

  it("an audition from the settings screen is the user's", () => {
    expect(previewCompanionSound("motion")).toBe(true);
    expect(origins).toEqual(["play:direct"]);
  });

  it("records nothing for a sound that did not play", () => {
    expect(playCompanionSound("pet", { ...DEFAULT_COMPANION_PREFERENCES, sound: false }, "direct")).toBe(false);
    expect(origins).toEqual([]);
  });
});

describe("the mark changes no sound yet", () => {
  it("plays or stays silent identically for both marks in every setting combination", () => {
    const bools = [false, true];
    let cases = 0;
    for (const moment of COMPANION_SOUND_MOMENTS) for (const enabled of bools) for (const sound of bools) for (const soundVolume of [0, 40])
      for (const soundCare of bools) for (const soundMotion of bools) for (const soundKeepsakes of bools) for (const reduce of bools) for (const gfx of ["full", "soft", "off"]) {
        const preferences: CompanionPreferences = { ...DEFAULT_COMPANION_PREFERENCES, enabled, sound, soundVolume, soundCare, soundMotion, soundKeepsakes };
        html.hasAttribute = name => reduce && name === "data-reduce-motion"; html.dataset.gfx = gfx;
        now += 60000; const auto = playCompanionSound(moment, preferences, "auto");
        now += 60000; const direct = playCompanionSound(moment, preferences, "direct");
        expect(direct, `${moment} ${JSON.stringify(preferences)} ${reduce} ${gfx}`).toBe(auto);
        cases += 1;
      }
    expect(cases).toBe(COMPANION_SOUND_MOMENTS.length * 2 ** 7 * 3);
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
