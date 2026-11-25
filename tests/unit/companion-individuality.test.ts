import { afterEach, describe, expect, it, vi } from "vitest";
import { advanceCompanionIndividuality, companionIndividualEffects, learnCompanionIndividuality, normalizeCompanionIndividuality } from "@/lib/ui/viewer-companion/individuality";
import { createCompanionIndividualityStore, COMPANION_INDIVIDUAL_KEY } from "@/lib/ui/viewer-companion/individuality-store";
import { createCompanionInteractionLearning } from "@/lib/ui/viewer-companion/interaction-learning";
import { DEFAULT_COMPANION_PREFERENCES as prefs } from "@/lib/ui/viewer-companion/preferences";
import { getCompanionBehaviorProfile } from "@/lib/ui/viewer-companion/behavior-profile";
import { createBrain, getFoodAction, type CompanionWorld } from "@/lib/ui/viewer-companion/brain";
import { getLivingAction } from "@/lib/ui/viewer-companion/living";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function trained(event: Parameters<typeof learnCompanionIndividuality>[1], where: "home" | "outside" = "outside") {
  let memory = normalizeCompanionIndividuality(undefined);
  for (let i = 0; i < 24; i++) memory = learnCompanionIndividuality(advanceCompanionIndividuality(memory, 18000, true), event, where, "card", true);
  return memory;
}
describe("local individuality and existing behavior boundaries", () => {
  it("learns slowly with active-time credit, not absence, and stops while disabled", () => {
    const initial = normalizeCompanionIndividuality(undefined);
    const learned = learnCompanionIndividuality(initial, "long-contact", "outside", "floor", true);
    expect(companionIndividualEffects(learned).contact).toBe(0);
    expect(learnCompanionIndividuality(learned, "long-contact", "outside", "floor", true)).toBe(learned);
    expect(advanceCompanionIndividuality(learned, 30000000, false)).toBe(learned);
    expect(learnCompanionIndividuality(initial, "long-contact", "outside", "floor", false)).toBe(initial);
    expect(initial.contexts.outside.contact.evidence).toBe(0);
  });
  it("changes actual finite social actions within one temperament while keeping the meal first", () => {
    const platform = { id: "card", x: 0, y: 500, width: 700, kind: "card" as const };
    const world: CompanionWorld = { x: 300, y: 500, platformId: "card", platforms: [platform], width: 1000, height: 800, animated: true, pointer: { x: 325, y: 470, stableMs: 2000 } };
    const brain = { ...createBrain(0), hunger: .1, affection: .4, energy: .7, activeMs: 100000 };
    const p = { ...prefs, personality: "affectionate" as const };
    const short = getLivingAction({ ...brain, individuality: trained("short-contact") }, world, p, 100000, () => .99)!;
    const long = getLivingAction({ ...brain, individuality: trained("long-contact") }, world, p, 100000, () => .99)!;
    expect(short.play).toBe("ask-petting"); expect(long.play).toBe(short.play); expect(long.duration).toBeGreaterThan(short.duration);
    expect(getLivingAction({ ...brain, hunger: .8, individuality: trained("long-contact") }, { ...world, foods: [{ id: "meal", kind: "apple", x: 315, y: 500, platformId: "card" }] }, p, 100000)).toBeUndefined();
    expect(getFoodAction({ ...brain, hunger: .8 }, { ...world, foods: [{ id: "meal", kind: "apple", x: 315, y: 500, platformId: "card" }] }, p, 100000)?.kind).toBe("eat");
  });
  it("keeps contexts distinct, earned tendencies bounded, and cat/dog and learning OFF unchanged", () => {
    const memory = trained("home-called", "home");
    expect(companionIndividualEffects(memory, "home").company).toBeGreaterThan(0);
    expect(companionIndividualEffects(memory).company).toBe(0);
    for (const animalMode of ["cat", "dog"] as const) expect(getCompanionBehaviorProfile({ ...prefs, animalMode }, undefined, memory, "home")).toEqual(getCompanionBehaviorProfile({ ...prefs, animalMode }));
    expect(getCompanionBehaviorProfile({ ...prefs, learnFromYou: false }, undefined, memory, "home")).toEqual(getCompanionBehaviorProfile({ ...prefs, learnFromYou: false }));
    const changed = getCompanionBehaviorProfile(prefs, undefined, trained("shared-discovery"));
    const base = getCompanionBehaviorProfile(prefs);
    expect(changed.noveltyWeight).toBeGreaterThan(base.noveltyWeight);
    expect(changed.noveltyWeight).toBeLessThanOrEqual(base.noveltyWeight * 1.2);
    expect(changed.walkSpeed).toBe(base.walkSpeed); expect(changed.sleepEnergy).toBe(base.sleepEnergy);
  });
  it("serializes only bounded tendencies and loses neither ordinary settings nor earned assets", () => {
    const values = new Map<string, string>([["vic.viewerCompanion", "existing-settings"], ["vic.viewerCompanionCollection", "earned-assets"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const store = createCompanionIndividualityStore(storage); store.settle("curious"); store.save(trained("long-contact"));
    expect(values.get("vic.viewerCompanion")).toBe("existing-settings"); expect(values.get("vic.viewerCompanionCollection")).toBe("earned-assets");
    const raw = JSON.parse(values.get(COMPANION_INDIVIDUAL_KEY)!); raw.email = "CANARY"; raw.learning.contexts.outside.contact.title = "CANARY";
    values.set(COMPANION_INDIVIDUAL_KEY, JSON.stringify(raw)); store.synchronize(); store.save(store.load(0));
    expect(values.get(COMPANION_INDIVIDUAL_KEY)).not.toContain("CANARY");
    store.reset(1); expect(store.personality()).toBe("curious"); expect(store.load(1).contexts.outside.contact.evidence).toBe(0);
    expect(store.save(trained("long-contact"))).toBe(false); expect(store.load(1).contexts.outside.contact.evidence).toBe(0);
  });
  it("keeps volatile learning through quota failures and sanitizes corrupted storage", () => {
    const store = createCompanionIndividualityStore({ getItem: () => null, setItem: () => { throw Error("quota"); } });
    store.settle("tidy"); store.save(trained("short-contact"));
    expect(store.personality()).toBe("tidy"); expect(store.load(0).contexts.outside.contact.value).toBeLessThan(0);
    for (const raw of ["{", JSON.stringify({ version: 99, personality: "tidy" }), "x".repeat(9000)]) {
      const corrupt = createCompanionIndividualityStore({ getItem: () => raw, setItem: vi.fn() });
      expect(corrupt.personality()).toBeUndefined(); expect(corrupt.load(0)).toEqual(normalizeCompanionIndividuality(undefined));
    }
  });
  it("does not treat a discovery, missing response, old generation or cancelled contact as satisfaction", () => {
    const learner = createCompanionInteractionLearning();
    learner.discovered(0, 0, "outside"); expect(learner.finish(12000, 0)).toBeUndefined();
    learner.contact(20000, 0, "outside", "card"); learner.touch(24000); learner.reset(); expect(learner.finish(25000, 0, true)).toBeUndefined();
    learner.contact(30000, 0, "outside", "card"); expect(learner.finish(32000, 1, true)).toBeUndefined();
    learner.contact(40000, 1, "home", "home"); learner.touch(44000); expect(learner.finish(45000, 1, true)).toMatchObject({ kind: "long-contact", context: "home" });
    expect(learner.finish(46000, 1, true)).toBeUndefined();
  });
  it("credits sharing only after actual direct contact/play within the same discovery context", () => {
    const learner = createCompanionInteractionLearning();
    learner.discovered(1000, 0, "outside"); expect(learner.play(2000, 0, "home")).toBe("shared-play");
    expect(learner.play(2500, 0, "outside")).toBe("shared-discovery");
    expect(learner.play(3000, 0, "outside")).toBe("shared-play");
    learner.discovered(5000, 0, "outside"); expect(learner.play(18001, 0, "outside")).toBe("shared-play");
  });
  it("discards interrupted contact without erasing a real pending discovery", () => {
    const learner = createCompanionInteractionLearning();
    learner.discovered(0, 0, "outside");
    learner.contact(100, 0, "outside", "card"); learner.touch(1500);
    learner.cancelContact();
    expect(learner.finish(2500, 0, true)).toBeUndefined();
    expect(learner.play(3000, 0, "outside")).toBe("shared-discovery");
  });
  it("rejects a delayed same-generation tab instead of erasing newer evidence", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const a = createCompanionIndividualityStore(storage), b = createCompanionIndividualityStore(storage);
    const old = b.load(0);
    const first = learnCompanionIndividuality(a.load(0), "long-contact", "home", "home", true);
    expect(a.save(first)).toBe(true);
    expect(b.save(old)).toBe(false);
    expect(a.load(0).contexts.home.contact).toEqual(first.contexts.home.contact);
    expect(b.save(b.load(0))).toBe(true);
  });
});
