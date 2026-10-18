import { describe, expect, it } from "vitest";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_LIFE } from "@/lib/ui/viewer-companion/life";
import { DEFAULT_COMPANION_HABITS } from "@/lib/ui/viewer-companion/habits";
import { observedCompanionBehavior } from "@/lib/ui/viewer-companion/collection";
import { canStartCompanionRadioReaction, companionRadioFoodPriority, COMPANION_RADIO_REACTION_MS, createCompanionRadioReactionInbox, getCompanionRadioReaction, sampleCompanionRadioReaction, type CompanionRadioMoment } from "@/lib/ui/viewer-companion/radio-reaction";

const preferences = { ...DEFAULT_COMPANION_PREFERENCES };
const moment: CompanionRadioMoment = { generation: 1, playing: true, mood: "lively", bpm: 112 };

describe("actual local radio reactions", () => {
  it("lets a full pet ignore leftover food without suppressing a reachable meal at the actual hunger threshold", () => {
    expect(companionRadioFoodPriority({ feeding: true, hunger: .1, availableFoods: 1 })).toBe(false);
    expect(companionRadioFoodPriority({ feeding: true, hunger: .35, availableFoods: 1 })).toBe(true);
    expect(companionRadioFoodPriority({ feeding: true, hunger: .7, availableFoods: 0 })).toBe(false);
    expect(companionRadioFoodPriority({ feeding: false, hunger: .7, availableFoods: 1 })).toBe(false);
  });
  it("uses chosen personality/species and actual earned tendencies, while learning OFF retains the authored baseline", () => {
    const base = { mood: "lively" as const, preferences, life: { ...DEFAULT_COMPANION_LIFE }, energy: .9 };
    expect(getCompanionRadioReaction(base)).toBe("bounce");
    expect(getCompanionRadioReaction({ ...base, preferences: { ...preferences, animalMode: "cat" } })).toBe("sway");
    expect(getCompanionRadioReaction({ ...base, preferences: { ...preferences, personality: "sleepy" } })).toBe("ignore");
    expect(getCompanionRadioReaction({ ...base, energy: .2 })).toBe("ignore");
    expect(getCompanionRadioReaction({ ...base, preferences: { ...preferences, roam: false } })).toBe("ignore");
    expect(getCompanionRadioReaction({ ...base, mood: "graceful", preferences: { ...preferences, personality: "affectionate" } })).toBe("calm");
    const playful = { ...base, mood: "calm" as const, life: { ...base.life, play: .8 }, habits: { ...DEFAULT_COMPANION_HABITS, playfulness: .8 } };
    const original = JSON.stringify(playful);
    expect(getCompanionRadioReaction(playful)).toBe("bored");
    expect(getCompanionRadioReaction({ ...playful, preferences: { ...preferences, learnFromYou: false } })).toBe("sway");
    expect(JSON.stringify(playful)).toBe(original);
  });
  it("requires actual visibility, an enabled reaction, stable safe space and no higher-priority owner", () => {
    const safe = { enabled: true, react: true, roam: true, focused: true, hidden: false, reduced: false, graphics: "full", stable: true, safe: true, busy: false, headroom: 130, edgeClearance: 70, energy: .9 };
    expect(canStartCompanionRadioReaction(safe)).toBe(true);
    for (const patch of [{ enabled: false }, { react: false }, { roam: false }, { focused: false }, { hidden: true }, { reduced: true }, { graphics: "off" }, { graphics: "soft" }, { stable: false }, { safe: false }, { busy: true }, { headroom: 111 }, { edgeClearance: 47 }, { energy: .29 }, { headroom: NaN }]) expect(canStartCompanionRadioReaction({ ...safe, ...patch })).toBe(false);
  });
  it("consumes one current playback generation, expires busy offers and never replays a blocked or previous-page song", () => {
    const inbox = createCompanionRadioReactionInbox(0);
    inbox.offer({ ...moment, playing: false }, 0, true); expect(inbox.peek(moment, 0)).toBeUndefined();
    inbox.offer(moment, 100, true); expect(inbox.take(moment, 200)).toEqual(moment); expect(inbox.take(moment, 201)).toBeUndefined();
    inbox.offer(moment, 250, true); expect(inbox.peek(moment, 250)).toBeUndefined();
    const second = { ...moment, generation: 2 }; inbox.offer(second, 300, false); inbox.offer(second, 400, true); expect(inbox.peek(second, 400)).toBeUndefined();
    const third = { ...moment, generation: 3 }; inbox.offer(third, 500, true); expect(inbox.take(third, 8501)).toBeUndefined();
    const fourth = { ...moment, generation: 4 }; inbox.offer(fourth, 9000, true); inbox.offer({ ...fourth, playing: false }, 9001, true); expect(inbox.peek(fourth, 9002)).toBeUndefined();
    const fifth = { ...moment, generation: 5 }; inbox.offer(fifth, 10000, true); inbox.clear(); expect(inbox.take(fifth, 10001)).toBeUndefined();
    const remounted = createCompanionRadioReactionInbox(5); remounted.offer(fifth, 11000, true); expect(remounted.take(fifth, 11000)).toBeUndefined();
  });
  it("keeps every finite musical pose on the same support and outside discovered-behavior rows", () => {
    const signatures = new Set<string>();
    for (const reaction of ["bounce", "sway", "calm", "bored", "ignore"] as const) {
      const samples = Array.from({ length: 53 }, (_, index) => sampleCompanionRadioReaction(reaction, index * 100, 112));
      for (const sample of samples) {
        expect([sample.row, sample.frame, sample.bob, sample.tilt, sample.squash].every(Number.isFinite)).toBe(true);
        expect([0, 1, 9, 10]).toContain(sample.row); expect(sample.bob).toBeGreaterThanOrEqual(-5); expect(Math.abs(sample.tilt)).toBeLessThanOrEqual(6);
        expect(observedCompanionBehavior({ requestedRow: sample.row, requestedIndex: 0, adoptedIndex: 0, requestedSrc: "/actual.webp", adoptedSrc: "/actual.webp", decoded: true, visible: true })).toBeUndefined();
      }
      expect(samples[0].bob).toBe(0); expect(samples.at(-1)).toMatchObject({ bob: 0, tilt: 0, squash: 0, done: true });
      expect(sampleCompanionRadioReaction(reaction, COMPANION_RADIO_REACTION_MS + 5000, NaN)).toMatchObject({ bob: 0, tilt: 0, squash: 0, done: true });
      signatures.add(JSON.stringify(samples));
    }
    expect(signatures.size).toBe(5);
  });
});
