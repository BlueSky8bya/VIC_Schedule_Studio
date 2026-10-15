import { describe, expect, it } from "vitest";
import { advanceBrain, createBrain, getCompanionMood, recordCompanionEvent } from "@/lib/ui/viewer-companion/brain";

describe("brief nonpunitive companion appraisals", () => {
  it("reacts to a blocked visual heart or a lost actual food target without changing care", () => {
    const brain = createBrain(0, () => .5);
    for (const event of ["heart-blocked", "food-lost"] as const) {
      const next = recordCompanionEvent(brain, event);
      expect(getCompanionMood(next)).toBe("disappointed");
      expect([next.hunger, next.energy, next.affection, next.curiosity]).toEqual([brain.hunger, brain.energy, brain.affection, brain.curiosity]);
    }
    expect(getCompanionMood(brain)).toBe("neutral");
  });

  it("one pickup stays playful, distinct repeated handling earns a brief pout", () => {
    let brain = recordCompanionEvent(createBrain(0, () => .5), "handled");
    expect(getCompanionMood(brain)).toBe("neutral");
    for (let i = 0; i < 20; i++) brain = recordCompanionEvent(brain, "handled");
    expect(getCompanionMood(brain)).toBe("neutral"); // one gesture, no per-frame accumulation
    brain = recordCompanionEvent(advanceBrain(brain, 700), "dragged");
    brain = recordCompanionEvent(advanceBrain(brain, 700), "handled");
    expect(getCompanionMood(brain)).toBe("sulky");
    expect(getCompanionMood(advanceBrain(brain, 650))).toBe("sulky");
    expect(getCompanionMood(advanceBrain(brain, 1500))).toBe("sulky");
    expect(getCompanionMood(advanceBrain(brain, 2000))).toBe("disappointed");
    expect(getCompanionMood(advanceBrain(brain, 8000))).toBe("neutral");
  });

  it("petting and eating immediately take priority over disappointment and recover gently", () => {
    const disappointed = recordCompanionEvent(createBrain(0, () => .5), "heart-blocked");
    const sulky = recordCompanionEvent(disappointed, "food-lost"); expect(getCompanionMood(sulky)).toBe("sulky");
    for (const event of ["petted", "ate"] as const) {
      const happy = recordCompanionEvent(sulky, event);
      expect(getCompanionMood(happy)).toBe("happy");
      expect(happy.affect.frustration).toBeLessThan(sulky.affect.frustration);
      expect(getCompanionMood(advanceBrain(happy, 12000))).toBe("neutral");
    }
  });

  it("advances only supplied active time, never remembers absence or touches storage", () => {
    const brain = recordCompanionEvent(createBrain(0, () => .5), "heart-blocked"), before = JSON.stringify(brain);
    expect(advanceBrain(brain, 0)).toEqual(brain);
    expect(advanceBrain(brain, -1)).toEqual(brain);
    expect(advanceBrain(brain, 86400000)).toEqual(advanceBrain(brain, 30000));
    expect(JSON.stringify(brain)).toBe(before);
    expect(Object.keys(brain.affect).sort()).toEqual(["frustration", "handling", "handlingQuietMs", "joy"]);
  });
});
