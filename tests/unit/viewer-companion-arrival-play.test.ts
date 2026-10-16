import { describe, expect, it, vi } from "vitest";
import { getCompanionArrivalPlay, type CompanionArrivalPlayInput } from "@/lib/ui/viewer-companion/arrival-play";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const preferences = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true };
const arrival: CompanionArrivalPlayInput = {
  kind: "walk", pace: "scoot", distanceCSS: 100, natural: true, ordinaryCard: true,
  width: 200, edgeClearance: 40, energy: .8, cooldownReady: true, stable: true,
};

describe("finite play chosen once at actual calendar contact", () => {
  it("distinguishes a real card edge, interior run and ballistic landing", () => {
    expect(getCompanionArrivalPlay(arrival, preferences, () => 0)).toBe("tumble");
    expect(getCompanionArrivalPlay({ ...arrival, edgeClearance: 24 }, preferences, () => 0)).toBe("bump");
    expect(getCompanionArrivalPlay({ ...arrival, kind: "jump", pace: undefined, distanceCSS: 0 }, preferences, () => 0)).toBe("slip");
    // Geometry spans already prove full-body text clearance. A landing slip
    // has no lateral shift and needs no running-room width requirement.
    expect(getCompanionArrivalPlay({ ...arrival, kind: "jump", width: 24 }, preferences, () => 0)).toBe("slip");
    expect(getCompanionArrivalPlay({ ...arrival, kind: "jump", width: 0 }, preferences, () => 0)).toBeNull();
    expect(getCompanionArrivalPlay(arrival, { ...preferences, jump: false }, () => 0)).toBe("bump");
  });

  it("does not consume randomness for quiet, manual, food, unsafe or editing arrivals", () => {
    const rng = vi.fn(() => 0);
    for (const patch of [
      { natural: false }, { ordinaryCard: false }, { stable: false }, { cooldownReady: false },
      { width: 63.99 }, { energy: .279 }, { pace: "amble" as const }, { distanceCSS: 47.99 },
      { distanceCSS: -1 }, { width: NaN }, { edgeClearance: Infinity }, { edgeClearance: -1 }, { energy: NaN },
    ]) expect(getCompanionArrivalPlay({ ...arrival, ...patch }, preferences, rng)).toBeNull();
    for (const patch of [{ enabled: false }, { roam: false }]) expect(getCompanionArrivalPlay(arrival, { ...preferences, ...patch }, rng)).toBeNull();
    expect(getCompanionArrivalPlay({ ...arrival, kind: "jump" }, { ...preferences, jump: false }, rng)).toBeNull();
    expect(rng).not.toHaveBeenCalled();
  });

  it("keeps actor clumsiness when the independent card tilt switch is OFF", () => {
    expect(getCompanionArrivalPlay(arrival, { ...preferences, cardPrank: false }, () => 0)).toBe("tumble");
    expect(getCompanionArrivalPlay({ ...arrival, kind: "jump" }, { ...preferences, cardPrank: false }, () => 0)).toBe("slip");
  });

  it("draws once per eligible completion and respects species and gait", () => {
    const rng = vi.fn(() => .1);
    expect(getCompanionArrivalPlay(arrival, preferences, rng)).toBe("tumble");
    expect(rng).toHaveBeenCalledTimes(1);
    expect(getCompanionArrivalPlay(arrival, { ...preferences, animalMode: "dog" }, () => .03)).toBe("tumble");
    expect(getCompanionArrivalPlay(arrival, { ...preferences, animalMode: "cat" }, () => .03)).toBeNull();
    expect(getCompanionArrivalPlay(arrival, { ...preferences, speed: "relaxed" }, () => .1)).toBeNull();
    expect(getCompanionArrivalPlay(arrival, { ...preferences, speed: "lively" }, () => .2)).toBe("tumble");
    for (const draw of [NaN, Infinity, -1, .9, 1]) expect(getCompanionArrivalPlay(arrival, preferences, () => draw)).toBeNull();
  });

  it("leaves policy input unchanged and accepts precise safe thresholds", () => {
    const contact = { ...arrival, width: 64, distanceCSS: 48, energy: .28, edgeClearance: 0 };
    const before = JSON.stringify({ contact, preferences });
    expect(getCompanionArrivalPlay(contact, preferences, () => 0)).toBe("bump");
    expect(JSON.stringify({ contact, preferences })).toBe(before);
  });
});
