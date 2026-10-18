import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const voice = vi.hoisted(() => vi.fn(() => true));
vi.mock("@/lib/ui/sfx", () => ({ playCompanionVoice: voice, playCompanionSample: vi.fn(() => false) }));
import { COMPANION_SOUND_MOMENTS, createCompanionSoundBudget, playCompanionSound, previewCompanionSound } from "@/lib/ui/viewer-companion/companion-sound";

let now = 0;
let html: { dataset: Record<string, string>; hasAttribute: (name: string) => boolean };
beforeEach(() => {
  now += 20000; voice.mockReset().mockReturnValue(true);
  html = { dataset: {}, hasAttribute: () => false };
  vi.stubGlobal("document", { hidden: false, documentElement: html });
  vi.stubGlobal("window", { __companionSfxTrace: [] });
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("finite companion event sound", () => {
  it("does no audio work while hidden, creature/sound OFF, volume zero or own category OFF", () => {
    for (const patch of [{ enabled: false }, { sound: false }, { soundVolume: 0 }, { soundCare: false }]) expect(playCompanionSound("pet", { ...DEFAULT_COMPANION_PREFERENCES, ...patch })).toBe(false);
    vi.stubGlobal("document", { hidden: true, documentElement: html });
    expect(playCompanionSound("gift")).toBe(false);
    expect(voice).not.toHaveBeenCalled();
    expect(html.dataset).toEqual({});
  });
  it("never bypasses the creature or sound master for an explicit audition", () => {
    expect(previewCompanionSound("care", { ...DEFAULT_COMPANION_PREFERENCES, enabled: false })).toBe(false);
    expect(previewCompanionSound("keepsakes", { ...DEFAULT_COMPANION_PREFERENCES, sound: false })).toBe(false);
    expect(voice).not.toHaveBeenCalled();
  });
  it("mutes motion cues under reduced motion and soft/off graphics without muting care", () => {
    for (const mode of ["reduce", "soft", "off"]) {
      now += 20000;
      html.hasAttribute = name => mode === "reduce" && name === "data-reduce-motion";
      html.dataset.gfx = mode === "reduce" ? "" : mode;
      expect(playCompanionSound("tumble")).toBe(false);
      expect(playCompanionSound("pet")).toBe(true);
    }
    expect(voice).toHaveBeenCalledTimes(3);
  });
  it("uses fourteen short distinct authored cues, at most three voices and no legacy category gate", () => {
    const signatures = [];
    for (const moment of COMPANION_SOUND_MOMENTS) {
      now += 20000;
      expect(playCompanionSound(moment, { ...DEFAULT_COMPANION_PREFERENCES, soundVolume: 35 })).toBe(true);
      const [notes, volume] = voice.mock.lastCall! as unknown as [Array<{ f: number; at?: number; tau?: number; vol?: number }>, number];
      expect(volume).toBe(35); expect(voice.mock.lastCall).toHaveLength(2);
      expect(notes.length).toBeGreaterThan(0); expect(notes.length).toBeLessThanOrEqual(3);
      for (const note of notes) { expect(note.f).toBeGreaterThanOrEqual(100); expect(note.f).toBeLessThanOrEqual(880); expect((note.at ?? 0) + .006 + (note.tau ?? .06) * 7).toBeLessThan(.5); expect(note.vol).toBeLessThanOrEqual(.22); }
      signatures.push(JSON.stringify(notes));
    }
    expect(new Set(signatures).size).toBe(COMPANION_SOUND_MOMENTS.length);
  });
  it("limits bursts, repeated landings and long sleep cues without replaying dropped work", () => {
    const budget = createCompanionSoundBudget();
    expect(budget.allows("land", 0)).toBe(true); budget.played("land", 0);
    expect(budget.allows("land", 649)).toBe(false);
    expect(budget.allows("eat", 119)).toBe(false);
    expect(budget.allows("eat", 120)).toBe(true); budget.played("eat", 120);
    budget.played("gift", 240); expect(budget.allows("equip", 360)).toBe(false);
    expect(budget.allows("land", 1200)).toBe(true);
    budget.played("sleep", 2000); expect(budget.allows("sleep", 9999)).toBe(false); expect(budget.allows("sleep", 10000)).toBe(true);
  });
  it("does not consume a budget or publish a played trace when browser audio declines", () => {
    voice.mockReturnValueOnce(false);
    expect(playCompanionSound("gift")).toBe(false);
    expect(html.dataset).toEqual({});
    expect(playCompanionSound("gift")).toBe(true);
    expect(html.dataset.companionSfxLast).toBe("gift");
    expect((window as unknown as { __companionSfxTrace: string[] }).__companionSfxTrace).toEqual(["gift"]);
    expect(playCompanionSound("gift")).toBe(false);
  });
});
